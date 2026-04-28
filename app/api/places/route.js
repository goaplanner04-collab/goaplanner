import { NextResponse } from "next/server";
import { spots as fallbackSpots } from "@/lib/spotsData";
import { calcDistanceKm, extractPriceFromReviews } from "@/lib/placeUtils";
import {
  placesSearch,
  priceLevelToRange,
  getOpenNow, getCoords, getMapsUrl, inferArea,
  buildPhotoProxyUrl, getDisplayName, getEditorialSummary,
  getReviewTexts, getPhotoNames,
} from "@/lib/googlePlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15 * 60 * 1000;
const placeCache = new Map();

function cacheKey(lat, lng, category) {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}_${category}`;
}
function getCached(key) {
  const entry = placeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) { placeCache.delete(key); return null; }
  return entry.v;
}
function setCached(key, value) {
  placeCache.set(key, { v: value, t: Date.now() });
}

const CATEGORY_CONFIG = {
  featured: {
    queries: [
      { keyword: "best cafe Goa" },
      { keyword: "popular beach Goa" },
      { keyword: "top restaurant Goa" },
      { keyword: "tourist attraction Goa" },
    ],
    radius: 15000,
    minRating: 4.3,
    minReviews: 100,
    requirePhotos: true,
    skipOpenNow: true,
    limit: 15,
    sort: "weighted",
  },
  rentals: {
    queries: [{ keyword: "scooter bike rental Goa" }],
    radius: 8000,
    minRating: 4.0,
    minReviews: 20,
    skipOpenNow: false,
  },
  stay: {
    queries: [{ type: "lodging", keyword: "hotel resort guesthouse hostel Goa" }],
    radius: 8000,
    minRating: 4.0,
    minReviews: 20,
    skipOpenNow: true,
  },
  breakfast_cafes: {
    queries: [{ type: "cafe", keyword: "breakfast cafe Goa" }],
    radius: 10000,
    minRating: 4.0,
    minReviews: 30,
    skipOpenNow: false,
  },
  beaches: {
    queries: [{ type: "natural_feature", keyword: "beach Goa" }],
    radius: 15000,
    minRating: 4.0,
    minReviews: 20,
    skipOpenNow: true,
  },
  tourist_spots: {
    queries: [
      { type: "church", keyword: "church chapel Goa" },
      { type: "hindu_temple", keyword: "temple Goa" },
      { keyword: "fort Goa" },
      { keyword: "trek viewpoint Goa" },
      { keyword: "waterfall Goa" },
      { type: "museum", keyword: "museum Goa" },
      { keyword: "heritage site Goa" },
    ],
    radius: 20000,
    minRating: 4.0,
    minReviews: 20,
    skipOpenNow: true,
  },
  water_sports: {
    queries: [
      { keyword: "scuba diving Goa" },
      { keyword: "parasailing Goa" },
      { keyword: "water sports Goa" },
      { keyword: "jet ski Goa" },
      { keyword: "snorkeling Goa" },
      { keyword: "surfing Goa" },
      { keyword: "kayaking Goa" },
    ],
    radius: 20000,
    minRating: 4.0,
    minReviews: 20,
    skipOpenNow: false,
  },
  restobars: {
    queries: [{ type: "bar", keyword: "restobar restaurant bar Goa" }],
    radius: 10000,
    minRating: 4.0,
    minReviews: 30,
    skipOpenNow: false,
  },
  seafood: {
    queries: [{ type: "restaurant", keyword: "seafood fish curry Goa" }],
    radius: 10000,
    minRating: 4.0,
    minReviews: 30,
    skipOpenNow: false,
  },
  hidden_gems: {
    queries: [{ keyword: "hidden gem viewpoint lake secret Goa" }],
    radius: 15000,
    minRating: 4.2,
    minReviews: 50,
    maxReviews: 500,
    skipOpenNow: true,
  },
};

const CAT_FALLBACK_MAP = {
  featured: null,
  rentals: "scooter_rental",
  stay: null,
  breakfast_cafes: "cafe",
  beaches: "beach",
  tourist_spots: "hidden_gem",
  water_sports: null,
  restobars: "restobar",
  seafood: "seafood",
  hidden_gems: "hidden_gem",
};

function fallbackForCategory(category, originLat, originLng) {
  const mapped = CAT_FALLBACK_MAP[category] !== undefined ? CAT_FALLBACK_MAP[category] : category;
  const matchCat = (s) => (mapped === null ? true : s.category === mapped);
  return fallbackSpots
    .filter(matchCat)
    .map((s) => ({
      place_id: `fallback-${s.id}`,
      name: s.name,
      category,
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

async function enrichPlace(anthropicKey, place, category, originLat, originLng, cfg) {
  const rating = Number(place.rating) || 0;
  const reviewCount = Number(place.userRatingCount) || 0;

  if (rating < (cfg.minRating ?? 4.0)) return null;
  if (reviewCount < (cfg.minReviews ?? 30)) return null;
  if (cfg.maxReviews != null && reviewCount > cfg.maxReviews) return null;

  if (!cfg.skipOpenNow) {
    const openNow = getOpenNow(place);
    if (openNow === false) return null;
  }

  if (cfg.requirePhotos && (!Array.isArray(place.photos) || place.photos.length === 0)) return null;

  const { lat, lng } = getCoords(place);
  if (lat == null || lng == null) return null;

  const openNow = getOpenNow(place);
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

function weightedScore(place) {
  const rating = Number(place.rating) || 0;
  const normalizedReviews = Math.min((Number(place.reviews) || 0) / 1000, 1.0);
  return rating * 0.6 + normalizedReviews * 0.4;
}

async function fetchCategory(apiKey, anthropicKey, category, originLat, originLng) {
  const cfg = CATEGORY_CONFIG[category];
  if (!cfg) return [];

  const key = cacheKey(originLat, originLng, category);
  const cached = getCached(key);
  if (cached) return cached;

  const searchResults = await Promise.all(
    cfg.queries.map((q) =>
      placesSearch(apiKey, {
        lat: originLat, lng: originLng,
        radius: cfg.radius,
        type: q.type,
        keyword: q.keyword,
        openNowOnly: false,
      })
    )
  );

  if (searchResults.every((r) => r === null)) return null;

  const seen = new Set();
  const allPlaces = [];
  for (const arr of searchResults) {
    if (!arr) continue;
    for (const p of arr) {
      const id = p.id || "";
      if (seen.has(id)) continue;
      seen.add(id);
      allPlaces.push(p);
    }
  }

  const top = allPlaces.slice(0, 20);
  const enriched = await Promise.all(
    top.map((p) => enrichPlace(anthropicKey, p, category, originLat, originLng, cfg))
  );
  let filtered = enriched.filter(Boolean);

  if (cfg.sort === "weighted") {
    filtered.sort((a, b) => weightedScore(b) - weightedScore(a));
    if (cfg.limit) filtered = filtered.slice(0, cfg.limit);
  } else {
    filtered.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  setCached(key, filtered);
  return filtered;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  const category = (searchParams.get("category") || "featured").toLowerCase();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const list = fallbackForCategory(category, lat, lng);
    return NextResponse.json({ places: list }, { headers: { "X-Data-Source": "fallback" } });
  }

  let result = await fetchCategory(apiKey, anthropicKey, category, lat, lng);

  if (result === null) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await fetchCategory(apiKey, anthropicKey, category, lat, lng);
  }

  if (result === null) {
    const list = fallbackForCategory(category, lat, lng);
    return NextResponse.json({ places: list }, { headers: { "X-Data-Source": "fallback" } });
  }

  return NextResponse.json(
    { places: result },
    { headers: { "X-Data-Source": "live" } }
  );
}
