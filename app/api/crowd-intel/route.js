import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchCrowdIntel } from "@/lib/placeUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const placeId = (searchParams.get("place_id") || "").trim();
  const placeName = (searchParams.get("place_name") || "").trim();
  const area = (searchParams.get("area") || "").trim();

  if (!placeId || !placeName) {
    return NextResponse.json({ error: "place_id and place_name required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const intel = await fetchCrowdIntel({
    placeId, placeName, area,
    supabase, anthropicKey,
  });

  if (!intel) {
    return NextResponse.json({
      bestTimeToVisit: null,
      peakCrowdTime: null,
      avgPricePerPerson: null,
      priceRange: null,
      commonComplaints: [],
      insiderTips: [],
      dataQuality: "none",
      postCount: 0,
    });
  }

  return NextResponse.json(intel);
}

// Admin: clear stale cache entries
export async function DELETE(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || req.headers.get("x-admin-auth") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const cutoff = new Date(Date.now() - 3600 * 1000).toISOString();
    const { error, count } = await supabase
      .from("crowd_intel")
      .delete({ count: "exact" })
      .lt("cached_at", cutoff);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, cleared: count || 0 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
