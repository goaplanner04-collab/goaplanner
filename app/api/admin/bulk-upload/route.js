import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function sanitize(body) {
  const allowed = [
    "name", "venue", "area", "lat", "lng", "date", "start_time",
    "entry_fee", "vibe", "status", "source", "description",
    "insider_tip", "publish_on"
  ];
  const out = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (out.entry_fee === "") out.entry_fee = "Check at venue";
  if (out.lat === "" || out.lat === undefined) out.lat = null;
  if (out.lng === "" || out.lng === undefined) out.lng = null;
  if (typeof out.lat === "string") out.lat = parseFloat(out.lat);
  if (typeof out.lng === "string") out.lng = parseFloat(out.lng);
  if (Number.isNaN(out.lat)) out.lat = null;
  if (Number.isNaN(out.lng)) out.lng = null;
  return out;
}

export async function POST(req) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const events = Array.isArray(body) ? body : body.events;
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "Send an array of events" },
        { status: 400 }
      );
    }

    const cleaned = events
      .map(sanitize)
      .filter((e) => e.name && e.venue && e.area && e.date && e.start_time);

    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: "No valid events to upload" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured on server" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("events")
      .upsert(cleaned)
      .select();

    if (error) {
      console.error("bulk upload error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: data ? data.length : cleaned.length
    });
  } catch (err) {
    console.error("bulk-upload error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
