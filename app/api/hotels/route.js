import { NextResponse } from "next/server";
import { calcDistanceKm, extractPriceFromReviews } from "@/lib/placeUtils";
import {
  placesSearch,
  priceLevelToRange,
  getOpenNow, getCoords, getMapsUrl, inferArea,
  buildPhotoProxyUrl, getDisplayName, getEditorialSummary,
  getReviewTexts, getPhotoNames,
  resolveGoaCoords, GOA_CENTER,
} from "@/lib/googlePlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAY_TYPE_QUERIES = {
  beachside_resort: { keyword: "beachside resort hotel" },
  hotel:            { keyword: "hotel" },
  boutique_villa:   { keyword: "boutique villa resort" },
  hostel:           { keyword: "hostel zostel backpacker" },
  guesthouse:       { keyword: "guesthouse bed breakfast" },
};

// Hotels have fewer reviews than restaurants — lower threshold per spec.
const HOTEL_MIN_RATING = 4.0;
const HOTEL_MIN_REVIEWS = 20;

function passesHotelQuality(rating, reviewCount) {
  return (Number(rating) || 0) >= HOTEL_MIN_RATING
      && (Number(reviewCount) || 0) >= HOTEL_MIN_REVIEWS;
}

async function fetchHotelsOnce(apiKey, anthropicKey, lat, lng, stayType, radius) {
  const def = STAY_TYPE_QUERIES[stayType];
  if (!def) return [];

  const search = await placesSearch(apiKey, {
    lat, lng, radius,
    type: null,
    keyword: def.keyword,
  });
  if (search === null) return null;

  const top = search.slice(0, 15);

  const enriched = await Promise.all(top.map(async (p) => {
    const rating = Number(p.rating) || 0;
    const reviewCount = Number(p.userRatingCount) || 0;
    if (!passesHotelQuality(rating, reviewCount)) return null;

    const { lat: pLat, lng: pLng } = getCoords(p);
    if (pLat == null || pLng == null) return null;

    const photoNames = getPhotoNames(p, 4);
    const photos = photoNames.map((n) => buildPhotoProxyUrl(n, 800)).filter(Boolean);

    const reviewTexts = getReviewTexts(p).slice(0, 5);
    const { avgPricePerPerson } = await extractPriceFromReviews(reviewTexts, anthropicKey);

    const placeId = (p.id || "").replace(/^places\//, "");

    return {
      place_id: placeId,
      name: getDisplayName(p),
      area: inferArea(p.formattedAddress),
      lat: pLat, lng: pLng,
      rating,
      reviews: reviewCount,
      priceRange: priceLevelToRange(p.priceLevel),
      avgPricePerNight: avgPricePerPerson,
      openNow: getOpenNow(p),
      description: getEditorialSummary(p) || (reviewTexts[0] || "").slice(0, 180),
      photos,
      distanceKm: calcDistanceKm(lat, lng, pLat, pLng),
      googleMapsUrl: getMapsUrl(p),
      website: p.websiteUri || null,
    };
  }));

  return enriched
    .filter(Boolean)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 10);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const area = (searchParams.get("area") || "").trim();
  const stayType = (searchParams.get("stayType") || "").trim();
  const radius = Math.min(15000, Math.max(1000, parseInt(searchParams.get("radius") || "5000", 10) || 5000));

  if (!area || !stayType) {
    return NextResponse.json({ error: "area and stayType are required" }, { status: 400 });
  }
  if (!STAY_TYPE_QUERIES[stayType]) {
    return NextResponse.json({ error: "Invalid stayType" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        hotels: [],
        message: "Couldn't load live hotel data right now. Try again in a moment.",
      },
      { headers: { "X-Data-Source": "fallback" } }
    );
  }

  const coords = (await resolveGoaCoords(area, apiKey)) || { lat: GOA_CENTER.lat, lng: GOA_CENTER.lng };

  let result = await fetchHotelsOnce(apiKey, anthropicKey, coords.lat, coords.lng, stayType, radius);
  if (result === null) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await fetchHotelsOnce(apiKey, anthropicKey, coords.lat, coords.lng, stayType, radius);
  }

  if (result === null) {
    return NextResponse.json(
      {
        hotels: [],
        message: "Couldn't load live hotel data right now. Try again in a moment.",
      },
      { headers: { "X-Data-Source": "fallback" } }
    );
  }

  return NextResponse.json(
    { hotels: result, area, stayType, count: result.length },
    { headers: { "X-Data-Source": "live" } }
  );
}
