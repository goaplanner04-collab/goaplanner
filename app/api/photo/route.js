// Server-side proxy for Google Places photos so we never expose
// GOOGLE_PLACES_API_KEY to the browser.
// New Places API: /api/photo?name=<photoName>&w=800
// photoName looks like "places/ChIJ.../photos/AUc7..."

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const w = Math.min(1600, Math.max(160, parseInt(searchParams.get("w") || "800", 10) || 800));

  if (!name) {
    return new NextResponse("Missing name", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return new NextResponse("Photos not configured", { status: 503 });
  }

  // New Places API photo media endpoint
  const upstream = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&key=${apiKey}&skipHttpRedirect=true`;

  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return new NextResponse("Upstream error", { status: res.status });
    }
    const json = await res.json();
    const photoUri = json?.photoUri;
    if (!photoUri) {
      return new NextResponse("No photo URI", { status: 404 });
    }

    // Fetch the actual image bytes
    const imgRes = await fetch(photoUri);
    if (!imgRes.ok) {
      return new NextResponse("Image fetch error", { status: imgRes.status });
    }
    const buf = await imgRes.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": imgRes.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (err) {
    return new NextResponse("Proxy error", { status: 502 });
  }
}
