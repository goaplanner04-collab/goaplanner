import { NextResponse } from "next/server";
import { spots as fallbackSpots } from "@/lib/spotsData";
import {
  buildPhotoUrl,
  calcDistanceKm,
  extractPriceFromReviews,
  passesQualityFilter,
  priceLevelToRange,
} from "@/lib/placeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15 * 60 * 1000;
const placeCache = new Map();

const CATEGORY_QUERIES = {
  cafe: { type: "cafe", keyword: "cafe Goa" },
  restobar: { type: "restaurant", keyword: "restobar bar Goa" },
  seafood: { type: "restaurant", keyword: "seafood fish Goa" },
  beach: { type: "natural_feature", keyword: "beach Goa" },
  hidden_gem: { type: null, keyword: "hidden gem viewpoint lake Goa" },
  scooter_rental: { type: null, keyword: "bike scooter rental Goa" },
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

async function nearbySearch(googleKey, { lat, lng, radius, type, keyword }) {
  const params = new URLSearchParams();
  params.set("location", `${lat},${lng}`);
  params.set("radius", String(radius));
  params.set("rankby", "prominence");
  if (type) params.set("type", type);
  if (keyword) params.set("keyword", keyword);
  params.set("key", googleKey);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status === "OK" || json.status === "ZERO_RESULTS") {
      return Array.isArray(json.results) ? json.results : [];
    }
    return null;
  } catch {
    return null;
  }
}

async function placeDetails(googleKey, placeId) {
  const fields = [
    "name", "rating", "user_ratings_total", "formatted_address",
    "geometry", "photos", "opening_hours", "price_level",
    "editorial_summary", "reviews", "url", "types",
  ].join(",");
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${googleKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result || null;
  } catch {
    return null;
  }
}

function inferAreaFromAddress(address) {
  if (!address) return "Goa";
  // Try to match a known Goa town from the address string
  const knownAreas = [
    "Morjim", "Arambol", "Mandrem", "Ashvem", "Vagator", "Anjuna",
    "Calangute", "Baga", "Candolim", "Panjim", "Panaji", "Assagao",
    "Palolem", "Cavelossim", "Colva", "Benaulim", "Mapusa", "Margao",
    "Old Goa", "Chapora", "Sinquerim",
  ];
  for (const a of knownAreas) {
    if (address.toLowerCase().includes(a.toLowerCase())) return a;
  }
  return "Goa";
}

function fallbackForCategory(category, originLat, originLng) {
  const matchCat = (s) =>
    category === "all" ? true : s.category === category;
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
      priceRange: s.priceRange?.includes("Rs Rs Rs") ? "₹₹₹" : (s.priceRange?.includes("Rs Rs") ? "₹₹" : "₹₹"),
      avgPricePerPerson: null,
      priceConfidence: null,
      openNow: typeof s.openNow === "boolean" ? s.openNow : null,
      description: s.description || "",
      photos: [],
      distanceKm: calcDistanceKm(originLat, originLng, s.lat, s.lng),
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " " + s.area + " Goa")}`,
      googleReviews: [],
    }))
    .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
}

async function fetchOneCategory(googleKey, anthropicKey, category, originLat, originLng, radius) {
  const def = CATEGORY_QUERIES[category];
  if (!def) return [];

  const cacheKey = getCacheKey(originLat, originLng, category);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const search = await nearbySearch(googleKey, {
    lat: originLat, lng: originLng, radius,
    type: def.type, keyword: def.keyword,
  });
  if (!search) return null; // null signals failure (caller may retry/fallback)

  const top = search.slice(0, 10);
  const detailsList = await Promise.all(top.map((p) => placeDetails(googleKey, p.place_id)));

  const enriched = await Promise.all(detailsList.map(async (d, i) => {
    if (!d) return null;
    const rating = Number(d.rating) || 0;
    const reviewCount = Number(d.user_ratings_total) || 0;
    if (!passesQualityFilter(rating, reviewCount)) return null;

    const lat = d.geometry?.location?.lat;
    const lng = d.geometry?.location?.lng;
    const photos = Array.isArray(d.photos)
      ? d.photos.slice(0, 3).map((p) => buildPhotoUrl(p.photo_reference, googleKey)).filter(Boolean)
      : [];

    const reviewTexts = Array.isArray(d.reviews)
      ? d.reviews.slice(0, 5).map((r) => r.text).filter(Boolean)
      : [];

    const { avgPricePerPerson, confidence } = await extractPriceFromReviews(reviewTexts, anthropicKey);

    const sourcePlace = top[i];
    return {
      place_id: d.place_id || sourcePlace?.place_id,
      name: d.name,
      category,
      area: inferAreaFromAddress(d.formatted_address),
      lat, lng,
      rating,
      reviews: reviewCount,
      priceRange: priceLevelToRange(d.price_level),
      avgPricePerPerson,
      priceConfidence: confidence,
      openNow: d.opening_hours?.open_now ?? null,
      description: d.editorial_summary?.overview || "",
      photos,
      distanceKm: calcDistanceKm(originLat, originLng, lat, lng),
      googleMapsUrl: d.url || `https://www.google.com/maps/place/?q=place_id:${d.place_id || ""}`,
      googleReviews: reviewTexts.slice(0, 5),
    };
  }));

  const filtered = enriched.filter(Boolean).sort(
    (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)
  );

  setCached(cacheKey, filtered);
  return filtered;
}

async function fetchWithRetry(googleKey, anthropicKey, category, originLat, originLng, radius) {
  let result = await fetchOneCategory(googleKey, anthropicKey, category, originLat, originLng, radius);
  if (result === null) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await fetchOneCategory(googleKey, anthropicKey, category, originLat, originLng, radius);
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

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!googleKey) {
    const list = fallbackForCategory(category, lat, lng);
    return NextResponse.json({ places: list }, { headers: { "X-Data-Source": "fallback" } });
  }

  const categoriesToFetch = category === "all"
    ? Object.keys(CATEGORY_QUERIES)
    : [category];

  const results = await Promise.all(
    categoriesToFetch.map((c) => fetchWithRetry(googleKey, anthropicKey, c, lat, lng, radius))
  );

  // If ALL categories failed → fallback
  if (results.every((r) => r === null)) {
    const list = fallbackForCategory(category, lat, lng);
    return NextResponse.json({ places: list }, { headers: { "X-Data-Source": "fallback" } });
  }

  // Merge + dedupe by place_id
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
