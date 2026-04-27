import { NextResponse } from "next/server";
import { spots as fallbackSpots } from "@/lib/spotsData";
import { calcDistanceKm, extractPriceFromReviews } from "@/lib/placeUtils";
import {
  placesSearch,
  priceLevelToRange, passesQualityFilter,
  getOpenNow, getCoords, getMapsUrl, inferArea,
  buildPhotoProxyUrl, getDisplayName, getEditorialSummary,
  getReviewTexts, getPhotoNames,
} from "@/lib/googlePlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15 * 60 * 1000;
const placeCache = new Map();

const CATEGORY_QUERIES = {
  cafe:           { type: "cafe",            keyword: "cafe" },
  restobar:       { type: "restaurant",      keyword: "restobar bar" },
  seafood:        { type: "restaurant",      keyword: "seafood fish" },
  beach:          { type: "natural_feature", keyword: "beach" },
  hidden_gem:     { type: "tourist_attraction", keyword: "viewpoint lake fort" },
  scooter_rental: { type: null,              keyword: "scooter bike rental" },
};

function cacheKey(lat, lng, category) {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}_${category}`;
}
function getCached(key) {
  const entry = placeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) {
    placeCache.delete(key);
    return null;
  }
  return entry.v;
}
function setCached(key, value) {
  placeCache.set(key, { v: value, t: Date.now() });
}

function fallbackForCategory(category, originLat, originLng) {
  const matchCat = (s) => (category === "all" ? true : s.category === category);
  return fallbackSpots
    .filter(matchCat)
    .map((s) => ({
      place_id: `fallback-${s.id}`,
      name: s.name,
      category: s.category,
      area: s.area,
      lat: s.lat,
      lng: s.lng,
      rating: s.rating,
      reviews: s.reviews,
      priceRange: s.priceRange?.includes("Rs Rs Rs") ? "₹₹₹" : "₹₹",
      avgPricePerPerson: null,
      priceConfidence: null,
      openNow: typeof s.openNow === "boolean" ? s.openNow : null,
      description: s.description || "",
      photos: [],
      distanceKm: calcDistanceKm(originLat, originLng, s.lat, s.lng),
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " " + s.area + " Goa")}`,
      googleReviews: [],
    }))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

// New Places API returns full details in search results — no extra details call needed.
async function enrichPlace(anthropicKey, place, category, originLat, originLng) {
  const rating = Number(place.rating) || 0;
  const reviewCount = Number(place.userRatingCount) || 0;
  if (!passesQualityFilter(rating, reviewCount)) return null;

  const openNow = getOpenNow(place);
  if (openNow === false) return null;

  const { lat, lng } = getCoords(place);
  if (lat == null || lng == null) return null;

  const photoNames = getPhotoNames(place, 3);
  const photos = photoNames.map((n) => buildPhotoProxyUrl(n, 800));

  const reviewTexts = getReviewTexts(place).slice(0, 5);
  const { avgPricePerPerson, confidence } = await extractPriceFromReviews(reviewTexts, anthropicKey);

  const placeId = place.id || "";
  const cleanId = placeId.replace(/^places\//, "");

  return {
    place_id: cleanId || placeId,
    name: getDisplayName(place),
    category,
    area: inferArea(place.formattedAddress),
    lat, lng,
    rating,
    reviews: reviewCount,
    priceRange: priceLevelToRange(place.priceLevel),
    avgPricePerPerson,
    priceConfidence: confidence,
    openNow,
    description: getEditorialSummary(place),
    photos,
    distanceKm: calcDistanceKm(originLat, originLng, lat, lng),
    googleMapsUrl: getMapsUrl(place),
    googleReviews: reviewTexts,
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
  };
}

async function fetchOneCategory(apiKey, anthropicKey, category, originLat, originLng, radius) {
  const def = CATEGORY_QUERIES[category];
  if (!def) return [];

  const key = cacheKey(originLat, originLng, category);
  const cached = getCached(key);
  if (cached) return cached;

  const search = await placesSearch(apiKey, {
    lat: originLat, lng: originLng, radius,
    type: def.type, keyword: def.keyword,
    openNowOnly: true,
  });
  if (search === null) return null;

  const top = search.slice(0, 10);
  const enriched = await Promise.all(
    top.map((p) => enrichPlace(anthropicKey, p, category, originLat, originLng))
  );
  const filtered = enriched.filter(Boolean).sort(
    (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)
  );

  setCached(key, filtered);
  return filtered;
}

async function fetchWithRetry(apiKey, anthropicKey, category, originLat, originLng, radius) {
  let result = await fetchOneCategory(apiKey, anthropicKey, category, originLat, originLng, radius);
  if (result === null) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await fetchOneCategory(apiKey, anthropicKey, category, originLat, originLng, radius);
  }
  return result;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  const category = (searchParams.get("category") || "all").toLowerCase();
  const radius = Math.min(50000, Math.max(500, parseInt(searchParams.get("radius") || "10000", 10) || 10000));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const list = fallbackForCategory(category, lat, lng);
    return NextResponse.json({ places: list }, { headers: { "X-Data-Source": "fallback" } });
  }

  const categoriesToFetch = category === "all"
    ? Object.keys(CATEGORY_QUERIES)
    : [category];

  const results = await Promise.all(
    categoriesToFetch.map((c) => fetchWithRetry(apiKey, anthropicKey, c, lat, lng, radius))
  );

  if (results.every((r) => r === null)) {
    const list = fallbackForCategory(category, lat, lng);
    return NextResponse.json({ places: list }, { headers: { "X-Data-Source": "fallback" } });
  }

  const seen = new Set();
  const merged = [];
  for (const arr of results) {
    if (!arr) continue;
    for (const p of arr) {
      if (seen.has(p.place_id)) continue;
      seen.add(p.place_id);
      merged.push(p);
    }
  }
  merged.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

  const partial = results.some((r) => r === null);
  return NextResponse.json(
    { places: merged },
    { headers: { "X-Data-Source": partial ? "partial" : "live" } }
  );
}
