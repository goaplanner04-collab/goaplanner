// Google Places API (NEW) client.
// Uses places.googleapis.com/v1/places:searchText and /v1/places/{id}
// Auth: X-Goog-Api-Key header. Required field masks via X-Goog-FieldMask.

const PLACES_NEW = "https://places.googleapis.com/v1";
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

const PLACE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.photos",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.priceLevel",
  "places.editorialSummary",
  "places.googleMapsUri",
  "places.reviews",
  "places.nationalPhoneNumber",
  "places.websiteUri",
].join(",");

const PLACE_DETAILS_FIELD_MASK = PLACE_FIELD_MASK.replace(/places\./g, "");

// Search using new Text Search API. Returns array of place objects in NEW format.
// opts: { lat, lng, radius, type, keyword, openNowOnly }
export async function placesSearch(apiKey, opts) {
  if (!apiKey) return null;

  // Build a text query that combines the type and keyword.
  // The new API uses textQuery for keyword-style search.
  const queryParts = [];
  if (opts.keyword) queryParts.push(opts.keyword);
  if (opts.type) queryParts.push(opts.type.replace(/_/g, " "));
  queryParts.push("Goa");
  const textQuery = queryParts.filter(Boolean).join(" ");

  const body = {
    textQuery,
    maxResultCount: 20,
    rankPreference: "DISTANCE",
    locationBias: {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: Math.min(50000, opts.radius || 10000),
      },
    },
  };

  if (opts.openNowOnly) body.openNow = true;

  // Map our internal "type" hints to new API includedType where it makes sense
  if (opts.type === "cafe") body.includedType = "cafe";
  else if (opts.type === "restaurant") body.includedType = "restaurant";
  else if (opts.type === "tourist_attraction") body.includedType = "tourist_attraction";
  else if (opts.type === "night_club") body.includedType = "night_club";
  else if (opts.type === "natural_feature") body.includedType = "beach"; // closest analog

  try {
    const res = await fetch(`${PLACES_NEW}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACE_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[placesSearch] HTTP", res.status, errBody.slice(0, 400));
      return null;
    }
    const json = await res.json();
    return Array.isArray(json?.places) ? json.places : [];
  } catch (err) {
    console.error("[placesSearch] fetch threw:", err?.message);
    return null;
  }
}

// Get details for one place by id. Most callers won't need this since
// placesSearch returns full details, but keep it for special cases.
export async function placeDetails(apiKey, placeId) {
  if (!apiKey || !placeId) return null;
  const cleanId = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
  try {
    const res = await fetch(`${PLACES_NEW}/${cleanId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[placeDetails] HTTP", res.status, errBody.slice(0, 400));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[placeDetails] fetch threw:", err?.message);
    return null;
  }
}

// Photos in the new API are referenced by their name (e.g. "places/.../photos/...").
// The actual photo URL: GET /v1/{photoName}/media?maxWidthPx=800&key=<KEY>
// We proxy via /api/photo so the key never reaches the browser.
export function buildPhotoProxyUrl(photoName, w = 800) {
  if (!photoName) return null;
  return `/api/photo?name=${encodeURIComponent(photoName)}&w=${w}`;
}

// New API price levels are string enums.
export function priceLevelToRange(level) {
  if (!level) return "₹₹";
  switch (level) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return "₹";
    case "PRICE_LEVEL_MODERATE":
      return "₹₹";
    case "PRICE_LEVEL_EXPENSIVE":
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "₹₹₹";
    default:
      return "₹₹";
  }
}

export function passesQualityFilter(rating, reviewCount) {
  const r = Number(rating) || 0;
  const c = Number(reviewCount) || 0;
  return r >= PLACE_QUALITY.MIN_RATING && c >= PLACE_QUALITY.MIN_REVIEWS;
}

// Returns true / false / null. Prefers currentOpeningHours over regularOpeningHours.
export function getOpenNow(place) {
  const cur = place?.currentOpeningHours?.openNow;
  if (typeof cur === "boolean") return cur;
  const oh = place?.regularOpeningHours?.openNow;
  if (typeof oh === "boolean") return oh;
  return null;
}

export function getCoords(place) {
  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  return { lat, lng };
}

export function getMapsUrl(place) {
  return place?.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${(place?.id || "").replace(/^places\//, "")}`;
}

export function getDisplayName(place) {
  return place?.displayName?.text || "";
}

export function getEditorialSummary(place) {
  return place?.editorialSummary?.text || "";
}

export function getReviewTexts(place) {
  if (!Array.isArray(place?.reviews)) return [];
  return place.reviews
    .map((r) => r?.text?.text || r?.originalText?.text || "")
    .filter(Boolean);
}

export function getPhotoNames(place, max = 3) {
  if (!Array.isArray(place?.photos)) return [];
  return place.photos.slice(0, max).map((p) => p?.name).filter(Boolean);
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
