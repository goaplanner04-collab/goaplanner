import { NextResponse } from "next/server";
import { spots as fallbackSpots } from "@/lib/spotsData";
import { calcDistanceKm, extractPriceFromReviews } from "@/lib/placeUtils";
import {
  fsqSearch, fsqPhotos, fsqTips,
  fsqPriceToRange, fsqRatingTo5, fsqPassesQuality,
  fsqOpenNow, fsqArea, fsqCoords, fsqGoogleMapsUrl,
} from "@/lib/foursquare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15 * 60 * 1000;
const placeCache = new Map();

// Foursquare category IDs (from FSQ taxonomy)
const CATEGORY_QUERIES = {
  cafe:           { categories: "13032,13035",        query: "cafe" },
  restobar:       { categories: "13003,13057,13065",  query: "restobar bar" },
  seafood:        { categories: "13145",              query: "seafood" },
  beach:          { categories: "16003",              query: "beach" },
  hidden_gem:     { categories: "16019,16039,16031",  query: "viewpoint lake fort" },
  scooter_rental: { categories: null,                 query: "scooter bike rental" },
};

function getCacheKey(lat, lng, category) {
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

async function enrichOnePlace(apiKey, anthropicKey, place, category, originLat, originLng) {
  const rawRating = Number(place.rating) || 0;
  const reviewCount = Number(place.stats?.total_ratings) || 0;
  if (!fsqPassesQuality(rawRating, reviewCount)) return null;

  const placeId = place.fsq_place_id || place.fsq_id;
  if (!placeId) return null;

  const { lat, lng } = fsqCoords(place);
  if (lat == null || lng == null) return null;

  // Photos + tips in parallel
  const [photos, tips] = await Promise.all([
    fsqPhotos(apiKey, placeId, 3),
    fsqTips(apiKey, placeId, 5),
  ]);

  const { avgPricePerPerson, confidence } = await extractPriceFromReviews(tips, anthropicKey);

  return {
    place_id: placeId,
    name: place.name || "",
    category,
    area: fsqArea(place),
    lat, lng,
    rating: fsqRatingTo5(rawRating),
    reviews: reviewCount,
    priceRange: fsqPriceToRange(place.price),
    avgPricePerPerson,
    priceConfidence: confidence,
    openNow: fsqOpenNow(place),
    description: place.description || "",
    photos,
    distanceKm: calcDistanceKm(originLat, originLng, lat, lng),
    googleMapsUrl: fsqGoogleMapsUrl(place),
    googleReviews: tips.slice(0, 5),
  };
}

async function fetchOneCategory(apiKey, anthropicKey, category, originLat, originLng, radius) {
  const def = CATEGORY_QUERIES[category];
  if (!def) return [];

  const cacheKey = getCacheKey(originLat, originLng, category);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const results = await fsqSearch(apiKey, {
    lat: originLat, lng: originLng, radius,
    query: def.query,
    categories: def.categories,
    sort: "DISTANCE",
    limit: 15,
  });
  if (results === null) return null; // failure (caller may retry)

  const top = results.slice(0, 10);
  const enriched = await Promise.all(top.map((p) => enrichOnePlace(apiKey, anthropicKey, p, category, originLat, originLng)));
  const filtered = enriched.filter(Boolean).sort(
    (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)
  );

  setCached(cacheKey, filtered);
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

  const fsqKey = process.env.FOURSQUARE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!fsqKey) {
    const list = fallbackForCategory(category, lat, lng);
    return NextResponse.json({ places: list }, { headers: { "X-Data-Source": "fallback" } });
  }

  const categoriesToFetch = category === "all"
    ? Object.keys(CATEGORY_QUERIES)
    : [category];

  const results = await Promise.all(
    categoriesToFetch.map((c) => fetchWithRetry(fsqKey, anthropicKey, c, lat, lng, radius))
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
