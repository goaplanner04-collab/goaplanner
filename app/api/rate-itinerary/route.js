import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const shareId = (body.shareId || "").toString().trim().toUpperCase();
    const rating = (body.rating || "").toString().trim().toLowerCase();

    if (!shareId) {
      return NextResponse.json({ error: "shareId required" }, { status: 400 });
    }
    if (rating !== "up" && rating !== "down") {
      return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const column = rating === "up" ? "thumbs_up" : "thumbs_down";

    // Read existing → increment → write back (single round-trip query is harder without rpc)
    const { data: existing, error: readErr } = await supabase
      .from("saved_itineraries")
      .select("id, thumbs_up, thumbs_down")
      .eq("share_id", shareId)
      .single();

    if (readErr || !existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const newValue = (existing[column] || 0) + 1;
    const { error: updateErr } = await supabase
      .from("saved_itineraries")
      .update({ [column]: newValue })
      .eq("id", existing.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Rate failed" }, { status: 500 });
  }
}
