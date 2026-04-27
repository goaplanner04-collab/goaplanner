// Server-side proxy for Google Places photos so we never expose
// GOOGLE_PLACES_API_KEY to the browser.
// Usage: /api/photo?ref=<photo_reference>&w=800

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const w = Math.min(1600, Math.max(160, parseInt(searchParams.get("w") || "800", 10) || 800));

  if (!ref) {
    return new NextResponse("Missing ref", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return new NextResponse("Photos not configured", { status: 503 });
  }

  const upstream = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${w}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;

  try {
    const res = await fetch(upstream, { redirect: "follow" });
    if (!res.ok) {
      return new NextResponse("Upstream error", { status: res.status });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (err) {
    return new NextResponse("Proxy error", { status: 502 });
  }
}
