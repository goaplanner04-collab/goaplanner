import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isEmailValid, sendWelcomeEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const email = (body.email || "").toString().trim().toLowerCase();
    if (!isEmailValid(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const planName = body.plan_name ? String(body.plan_name).slice(0, 80) : null;
    const expiryAt = body.expiry_at ? new Date(body.expiry_at).toISOString() : null;
    const source = ["paid", "trial", "itinerary", "blast"].includes(body.source) ? body.source : "itinerary";
    const sendWelcome = !!body.send_welcome;

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase.from("email_subscribers").upsert(
          {
            email,
            plan_name: planName,
            expiry_at: expiryAt,
            source,
            opted_out: false,
          },
          { onConflict: "email" }
        );
      } catch {
        // table may not exist — non-fatal
      }
    }

    let welcomeResult = { sent: false };
    if (sendWelcome) {
      welcomeResult = await sendWelcomeEmail({
        to: email,
        planName,
        expiryAt,
        source,
      });
    }

    return NextResponse.json({ success: true, welcome: welcomeResult });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Subscribe failed" }, { status: 500 });
  }
}
