// Foursquare Places API — Service API client
// https://docs.foursquare.com/

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_VERSION = "2025-06-17";

// Foursquare uses 0-10 rating scale; we convert to 0-5 internally.
// Minimum equivalent to Google's 4.0 = 8.0 on FSQ scale.
export const FSQ_QUALITY = {
  MIN_RATING_RAW: 8.0,
  MIN_REVIEWS: 30,
};

// Hard-coded Goa town centroids — used for area geocoding
// since Foursquare doesn't have a geocoding API.
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
  // partial match: "north goa - vagator" → look for known town in string
  for (const [town, coords] of Object.entries(GOA_AREAS)) {
    if (key.includes(town)) return coords;
  }
  return null;
}

// Free-tier OSM Nominatim fallback for areas not in our list
async function nominatimGeocode(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", Goa, India")}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GoaNow/1.0 (https://goanow.online)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const hit = json?.[0];
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function resolveGoaCoords(area) {
  if (!area) return null;
  const direct = geocodeGoaArea(area);
  if (direct) return direct;
  return await nominatimGeocode(area);
}

function fsqHeaders(apiKey) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "X-Places-Api-Version": FSQ_VERSION,
    "Accept": "application/json",
  };
}

// Search nearby places
// opts: { lat, lng, radius, query, categories, limit, sort }
export async function fsqSearch(apiKey, opts) {
  if (!apiKey) return null;
  const url = new URL(`${FSQ_BASE}/places/search`);
  url.searchParams.set("ll", `${opts.lat},${opts.lng}`);
  if (opts.radius) url.searchParams.set("radius", String(Math.min(100000, opts.radius)));
  if (opts.query) url.searchParams.set("query", opts.query);
  if (opts.categories) url.searchParams.set("fsq_category_ids", opts.categories);
  url.searchParams.set("sort", opts.sort || "DISTANCE");
  url.searchParams.set("limit", String(Math.min(50, opts.limit || 20)));
  // request the fields we need up front to skip a per-place details call when possible
  url.searchParams.set(
    "fields",
    [
      "fsq_place_id", "name", "categories", "location", "latitude", "longitude",
      "distance", "price", "rating", "stats", "verified",
      "description", "hours", "tel", "website",
    ].join(",")
  );

  try {
    const res = await fetch(url, { headers: fsqHeaders(apiKey), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.results) ? json.results : [];
  } catch {
    return null;
  }
}

// Photos: returns up to `limit` URLs at given size
export async function fsqPhotos(apiKey, fsqPlaceId, limit = 3) {
  if (!apiKey || !fsqPlaceId) return [];
  try {
    const res = await fetch(`${FSQ_BASE}/places/${encodeURIComponent(fsqPlaceId)}/photos?limit=${limit}`, {
      headers: fsqHeaders(apiKey),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json)) return [];
    return json
      .map((p) => (p.prefix && p.suffix ? `${p.prefix}800x600${p.suffix}` : null))
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// Tips (Foursquare's equivalent of reviews)
export async function fsqTips(apiKey, fsqPlaceId, limit = 5) {
  if (!apiKey || !fsqPlaceId) return [];
  try {
    const res = await fetch(`${FSQ_BASE}/places/${encodeURIComponent(fsqPlaceId)}/tips?limit=${limit}&sort=POPULAR`, {
      headers: fsqHeaders(apiKey),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json)) return [];
    return json
      .map((t) => (t.text || "").toString().trim())
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// FSQ price 1..4 → ₹ symbols
export function fsqPriceToRange(price) {
  if (price === 1) return "₹";
  if (price === 2) return "₹₹";
  if (price === 3 || price === 4) return "₹₹₹";
  return "₹₹";
}

// FSQ rating 0..10 → display rating 0..5
export function fsqRatingTo5(raw) {
  const r = Number(raw);
  if (!Number.isFinite(r)) return 0;
  return Math.round((r / 2) * 10) / 10;
}

export function fsqPassesQuality(rawRating, reviewCount) {
  const r = Number(rawRating) || 0;
  const c = Number(reviewCount) || 0;
  return r >= FSQ_QUALITY.MIN_RATING_RAW && c >= FSQ_QUALITY.MIN_REVIEWS;
}

export function fsqOpenNow(place) {
  if (!place?.hours) return null;
  if (typeof place.hours.open_now === "boolean") return place.hours.open_now;
  if (typeof place.hours.is_open === "boolean") return place.hours.is_open;
  return null;
}

// Pull the area name from FSQ location object
export function fsqArea(place) {
  const loc = place?.location || {};
  return (
    loc.locality ||
    loc.region ||
    loc.neighborhood?.[0] ||
    "Goa"
  );
}

export function fsqCoords(place) {
  // newer API: top-level latitude/longitude. older: geocodes.main.{lat,lng}
  const lat = Number(place?.latitude ?? place?.geocodes?.main?.latitude);
  const lng = Number(place?.longitude ?? place?.geocodes?.main?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  return { lat, lng };
}

export function fsqGoogleMapsUrl(place) {
  const { lat, lng } = fsqCoords(place);
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place?.name || "") + " Goa")}`;
}
