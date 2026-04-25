import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateShareId() {
  // 8-char alphanumeric, URL-safe
  return crypto.randomBytes(6).toString("base64").replace(/[+/=]/g, "").slice(0, 8).toUpperCase();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const itineraryText = (body.itineraryText || "").toString().trim();
    if (!itineraryText || itineraryText.length < 50) {
      return NextResponse.json({ error: "Missing or too-short itinerary" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Sharing not configured on server" }, { status: 500 });
    }

    // Try a few times in case of share_id collision
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const shareId = generateShareId();
      const { error } = await supabase.from("saved_itineraries").insert({
        share_id: shareId,
        itinerary_text: itineraryText,
        user_area: (body.userArea || "").toString().slice(0, 80) || null,
        user_budget: Number.isFinite(Number(body.userBudget)) ? Number(body.userBudget) : null,
        duration_days: Number.isFinite(Number(body.durationDays)) ? Number(body.durationDays) : null,
        group_type: (body.groupType || "").toString().slice(0, 30) || null,
        language: (body.language || "en").toString().slice(0, 8),
        data_source: (body.dataSource || "live").toString().slice(0, 16),
        places_checked: Number.isFinite(Number(body.placesChecked)) ? Number(body.placesChecked) : null,
        reddit_sourced: Number.isFinite(Number(body.redditSourced)) ? Number(body.redditSourced) : null,
      });
      if (!error) {
        return NextResponse.json({ success: true, shareId });
      }
      lastError = error;
      if (!/duplicate/i.test(error.message || "")) break;
    }

    return NextResponse.json({ error: lastError?.message || "Could not save plan" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Save failed" }, { status: 500 });
  }
}
