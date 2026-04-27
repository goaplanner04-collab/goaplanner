// Google Places API client.
// Endpoints: nearbysearch, details, photo, geocode

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode";

export const PLACE_QUALITY = {
  MIN_RATING: 4.0,
  MIN_REVIEWS: 30,
};

// Hard-coded Goa town centroids — used for area geocoding fallback.
export const GOA_AREAS = {
  morjim: { lat: 15.6286, lng: 73.7388 },
  arambol: { lat: 15.6870, lng: 73.7037 },
  mandrem: { lat: 15.6500, lng: 73.7180 },
  ashvem: { lat: 15.6650, lng: 73.7113 },
  vagator: { lat: 15.6027, lng: 73.7351 },
  anjuna: { lat: 15.5766, lng: 73.7404 },
  calangute: { lat: 15.5440, lng: 73.7628 },
  baga: { lat: 15.5617, lng: 73.7519 },
  candolim: { lat: 15.5181, lng: 73.7625 },
  panjim: { lat: 15.4978, lng: 73.8311 },
  panaji: { lat: 15.4978, lng: 73.8311 },
  assagao: { lat: 15.5945, lng: 73.7641 },
  palolem: { lat: 15.0099, lng: 74.0235 },
  cavelossim: { lat: 15.1718, lng: 73.9477 },
  colva: { lat: 15.2799, lng: 73.9156 },
  benaulim: { lat: 15.2547, lng: 73.9275 },
  mapusa: { lat: 15.5937, lng: 73.8142 },
  margao: { lat: 15.2832, lng: 73.9862 },
  "old goa": { lat: 15.5025, lng: 73.9111 },
  chapora: { lat: 15.6087, lng: 73.7385 },
  sinquerim: { lat: 15.5074, lng: 73.7607 },
};

export const GOA_CENTER = { lat: 15.2993, lng: 74.1240 };

export function geocodeGoaArea(area) {
  if (!area) return null;
  const key = String(area).toLowerCase().trim();
  if (GOA_AREAS[key]) return GOA_AREAS[key];
  for (const [town, coords] of Object.entries(GOA_AREAS)) {
    if (key.includes(town)) return coords;
  }
  return null;
}

// Google's Geocoding API for areas not in our hardcoded list.
async function googleGeocode(query, apiKey) {
  if (!apiKey || !query) return null;
  const url = `${GEOCODE_BASE}/json?address=${encodeURIComponent(query + ", Goa, India")}&key=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const loc = json.results?.[0]?.geometry?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveGoaCoords(area, apiKey) {
  if (!area) return null;
  const direct = geocodeGoaArea(area);
  if (direct) return direct;
  return await googleGeocode(area, apiKey);
}

// Nearby search
// opts: { lat, lng, radius, type, keyword, openNowOnly }
export async function placesSearch(apiKey, opts) {
  if (!apiKey) return null;
  const params = new URLSearchParams();
  params.set("location", `${opts.lat},${opts.lng}`);
  if (opts.radius) params.set("radius", String(Math.min(50000, opts.radius)));
  if (opts.type) params.set("type", opts.type);
  if (opts.keyword) params.set("keyword", opts.keyword);
  // opennow filters server-side — saves us a Detail call later
  if (opts.openNowOnly) params.set("opennow", "true");
  params.set("key", apiKey);

  try {
    const res = await fetch(`${PLACES_BASE}/nearbysearch/json?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error("[placesSearch] HTTP error", res.status);
      return null;
    }
    const json = await res.json();
    if (json.status === "OK" || json.status === "ZERO_RESULTS") {
      return Array.isArray(json.results) ? json.results : [];
    }
    console.error("[placesSearch] Google error:", json.status, json.error_message || "(no message)");
    return null;
  } catch (err) {
    console.error("[placesSearch] fetch threw:", err?.message);
    return null;
  }
}

// Place details
export async function placeDetails(apiKey, placeId, fields) {
  if (!apiKey || !placeId) return null;
  const f = fields || [
    "name", "rating", "user_ratings_total", "formatted_address",
    "geometry", "photos", "opening_hours", "price_level",
    "editorial_summary", "reviews", "url", "types",
    "formatted_phone_number", "website", "current_opening_hours",
  ].join(",");
  try {
    const res = await fetch(
      `${PLACES_BASE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=${f}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result || null;
  } catch {
    return null;
  }
}

// Photo URL builder. Photos require the API key, so we proxy through our server
// route /api/photo. Direct URLs would expose the key.
export function buildPhotoUrl(reference, apiKey, maxwidth = 800) {
  if (!reference || !apiKey) return null;
  return `${PLACES_BASE}/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(reference)}&key=${apiKey}`;
}

// Google price_level (0..4) → ₹ label
export function priceLevelToRange(level) {
  if (level === 0 || level === 1) return "₹";
  if (level === 2) return "₹₹";
  if (level === 3 || level === 4) return "₹₹₹";
  return "₹₹";
}

export function passesQualityFilter(rating, reviewCount) {
  const r = Number(rating) || 0;
  const c = Number(reviewCount) || 0;
  return r >= PLACE_QUALITY.MIN_RATING && c >= PLACE_QUALITY.MIN_REVIEWS;
}

// Returns true / false / null. Prefers current_opening_hours over opening_hours
export function getOpenNow(place) {
  const cur = place?.current_opening_hours?.open_now;
  if (typeof cur === "boolean") return cur;
  const oh = place?.opening_hours?.open_now;
  if (typeof oh === "boolean") return oh;
  return null;
}

export function getCoords(place) {
  const lat = Number(place?.geometry?.location?.lat);
  const lng = Number(place?.geometry?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  return { lat, lng };
}

export function getMapsUrl(place) {
  return place?.url || `https://www.google.com/maps/place/?q=place_id:${place?.place_id || ""}`;
}

const KNOWN_AREAS = [
  "Morjim", "Arambol", "Mandrem", "Ashvem", "Vagator", "Anjuna",
  "Calangute", "Baga", "Candolim", "Panjim", "Panaji", "Assagao",
  "Palolem", "Cavelossim", "Colva", "Benaulim", "Mapusa", "Margao",
  "Old Goa", "Chapora", "Sinquerim",
];

export function inferArea(formattedAddress) {
  if (!formattedAddress) return "Goa";
  const lower = formattedAddress.toLowerCase();
  for (const a of KNOWN_AREAS) {
    if (lower.includes(a.toLowerCase())) return a;
  }
  return "Goa";
}
