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

  // Test 1: Nearby Search (Vagator)
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=15.6027,73.7351&radius=5000&type=cafe&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    result.tests.nearby_search = {
      http_status: res.status,
      google_status: json.status,
      error_message: json.error_message || null,
      result_count: Array.isArray(json.results) ? json.results.length : 0,
    };
  } catch (err) {
    result.tests.nearby_search = { error: err?.message || "fetch failed" };
  }

  // Test 2: Geocoding
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

  // Test 3: Place Details (Sublime Vagator — known place_id)
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=ChIJDR3wuFK_vzsRyJrqx-9-Txw&fields=name,rating&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    result.tests.place_details = {
      http_status: res.status,
      google_status: json.status,
      error_message: json.error_message || null,
    };
  } catch (err) {
    result.tests.place_details = { error: err?.message || "fetch failed" };
  }

  // Diagnose
  const sampleStatus = result.tests.nearby_search?.google_status;
  const errMsg = result.tests.nearby_search?.error_message;

  if (sampleStatus === "OK") {
    result.diagnosis = "✅ GOOD — Google Places is responding. If you still see the fallback banner, hard-refresh the dashboard (Ctrl+Shift+R) to clear cached responses.";
  } else if (sampleStatus === "REQUEST_DENIED") {
    result.diagnosis = `❌ REQUEST_DENIED. Most likely causes:
1. Places API not enabled — go to https://console.cloud.google.com/apis/library/places-backend.googleapis.com and click ENABLE.
2. Billing not enabled — go to https://console.cloud.google.com/billing and link a billing account (Google won't charge until $200/mo free credit is exceeded).
3. API key restricted to wrong APIs — go to your key in Credentials, set "API restrictions" to "Don't restrict key" temporarily to test.
Google's exact error: ${errMsg || "(none provided)"}`;
  } else if (sampleStatus === "OVER_QUERY_LIMIT") {
    result.diagnosis = `❌ OVER_QUERY_LIMIT. You've exceeded your daily quota or hit a per-second rate limit. Check Cloud Console → APIs & Services → Quotas. Google's error: ${errMsg || ""}`;
  } else if (sampleStatus === "ZERO_RESULTS") {
    result.diagnosis = "ℹ️ Working but no results for the test query (unusual for Vagator). Try /api/places?lat=15.6&lng=73.7&category=cafe directly.";
  } else if (sampleStatus === "INVALID_REQUEST") {
    result.diagnosis = `❌ INVALID_REQUEST: ${errMsg || ""}. Bad parameters — should not happen with our code.`;
  } else if (!sampleStatus) {
    result.diagnosis = `❌ Network or fetch error reaching Google. The Railway server might be having connectivity problems. Error: ${result.tests.nearby_search?.error || "(unknown)"}`;
  } else {
    result.diagnosis = `❌ Unexpected status: ${sampleStatus}. Error message: ${errMsg || "(none)"}`;
  }

  return NextResponse.json(result);
}
