import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isEmailValid, sendItineraryEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const email = (body.email || "").toString().trim().toLowerCase();
    const itineraryText = (body.itineraryText || "").toString();
    const userArea = body.userArea ? String(body.userArea).slice(0, 80) : null;
    const shareId = body.shareId ? String(body.shareId).toUpperCase().slice(0, 12) : null;

    if (!isEmailValid(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!itineraryText || itineraryText.length < 50) {
      return NextResponse.json({ error: "Missing itinerary text" }, { status: 400 });
    }

    // Best-effort save to subscribers (so they get future blasts unless opted out)
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase.from("email_subscribers").upsert(
          { email, source: "itinerary", opted_out: false },
          { onConflict: "email" }
        );
      } catch {
        // ignore
      }
    }

    const result = await sendItineraryEmail({
      to: email,
      itineraryText,
      userArea,
      shareId,
    });

    if (!result.sent) {
      return NextResponse.json({ error: result.reason || "Could not send email" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Send failed" }, { status: 500 });
  }
}
