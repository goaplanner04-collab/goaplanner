import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitize(body) {
  const allowed = [
    "name", "venue", "area", "lat", "lng", "date", "start_time",
    "entry_fee", "vibe", "status", "source", "description",
    "insider_tip", "publish_on", "image_url"
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
    const event = sanitize(body);

    if (!event.name || !event.venue || !event.area || !event.date || !event.start_time) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
      .insert(event)
      .select()
      .single();

    if (error) {
      console.error("admin insert error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: data });
  } catch (err) {
    console.error("admin events POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
