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

export async function PUT(req, { params }) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = params;

  try {
    const body = await req.json();
    const event = sanitize(body);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured on server" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("events")
      .update(event)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("admin update error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: data });
  } catch (err) {
    console.error("admin events PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = params;

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured on server" },
        { status: 500 }
      );
    }

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      console.error("admin delete error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
