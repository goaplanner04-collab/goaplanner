// Diagnostic endpoint — tells you exactly why /api/places is failing.
// Hit /api/places/debug in the browser and read the JSON.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const result = {
    env_var_set: !!apiKey,
    env_var_length: apiKey ? apiKey.length : 0,
    env_var_starts_with: apiKey ? apiKey.slice(0, 5) + "..." : null,
    tests: {},
  };

  if (!apiKey) {
    result.diagnosis = "GOOGLE_PLACES_API_KEY env var is NOT set on the server. Add it in Railway → Variables.";
    return NextResponse.json(result);
  }

  // Test 1: New Text Search API (Vagator cafes)
  try {
    const body = {
      textQuery: "cafe Vagator Goa",
      maxResultCount: 5,
      locationBias: {
        circle: {
          center: { latitude: 15.6027, longitude: 73.7351 },
          radius: 5000,
        },
      },
    };
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    result.tests.text_search = {
      http_status: res.status,
      result_count: Array.isArray(json?.places) ? json.places.length : 0,
      error: json?.error?.message || null,
      first_place: json?.places?.[0]?.displayName?.text || null,
    };
  } catch (err) {
    result.tests.text_search = { error: err?.message || "fetch failed" };
  }

  // Test 2: Geocoding API (still old API, same key)
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=Vagator,+Goa,+India&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    result.tests.geocoding = {
      http_status: res.status,
      google_status: json.status,
      error_message: json.error_message || null,
      result_count: Array.isArray(json.results) ? json.results.length : 0,
    };
  } catch (err) {
    result.tests.geocoding = { error: err?.message || "fetch failed" };
  }

  // Test 3: Photo proxy (fetch photo name from first search result)
  const firstPhotoResult = result.tests.text_search;
  result.tests.photo_proxy = { skipped: "run text_search first — photo name needed" };

  // Diagnose
  const textSearchErr = result.tests.text_search?.error;
  const httpStatus = result.tests.text_search?.http_status;
  const resultCount = result.tests.text_search?.result_count;

  if (httpStatus === 200 && resultCount > 0) {
    result.diagnosis = `✅ GOOD — New Places API is responding (found ${resultCount} results). If you still see the fallback banner, hard-refresh the dashboard (Ctrl+Shift+R).`;
  } else if (httpStatus === 403 || (textSearchErr && textSearchErr.includes("API_KEY_INVALID"))) {
    result.diagnosis = `❌ 403 / API key invalid. Causes:
1. Places API (New) not enabled — go to console.cloud.google.com/apis/library and enable "Places API (New)".
2. Key restricted to wrong APIs — temporarily set "Don't restrict key" to test.
3. Billing not enabled — link a billing account in console.cloud.google.com/billing.`;
  } else if (httpStatus === 200 && resultCount === 0) {
    result.diagnosis = "ℹ️ API working but zero results for Vagator cafes (unusual). Try /api/places?lat=15.6027&lng=73.7351&category=cafe directly.";
  } else if (!httpStatus) {
    result.diagnosis = `❌ Network/fetch error reaching Google. The server might have connectivity issues. Error: ${textSearchErr || "(unknown)"}`;
  } else {
    result.diagnosis = `❌ Unexpected response HTTP ${httpStatus}. Error: ${textSearchErr || "(none)"}`;
  }

  return NextResponse.json(result);
}
