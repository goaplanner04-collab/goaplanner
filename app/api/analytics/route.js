import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "itinerary_built",
  "plan_saved",
  "plan_shared",
  "thumbs_up",
  "thumbs_down",
  "tab_viewed",
  "paywall_opened",
  "payment_success",
]);

export async function POST(req) {
  try {
    const body = await req.json();
    const eventType = (body.event_type || "").toString().trim();
    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ error: "Unknown event_type" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Silently no-op if analytics unavailable — never block the user flow
      return NextResponse.json({ success: true, recorded: false });
    }

    await supabase.from("analytics").insert({
      event_type: eventType,
      area: body.area ? String(body.area).slice(0, 80) : null,
      language: body.language ? String(body.language).slice(0, 8) : null,
      plan: Number.isFinite(Number(body.plan)) ? Number(body.plan) : null,
      data: body.data && typeof body.data === "object" ? body.data : null,
    });

    return NextResponse.json({ success: true, recorded: true });
  } catch (err) {
    return NextResponse.json({ success: true, recorded: false });
  }
}
