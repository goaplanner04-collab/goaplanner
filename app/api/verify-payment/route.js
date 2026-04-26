import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isEmailValid, sendWelcomeEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const customerEmail = (body.email || "").toString().trim().toLowerCase();
    const planName = body.planName ? String(body.planName).slice(0, 80) : null;
    const expiryAt = body.expiryAt ? new Date(body.expiryAt).toISOString() : null;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ success: false, error: "Server not configured" }, { status: 500 });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, error: "Verification failed" }, { status: 400 });
    }

    // Save subscriber + send welcome email (best-effort, never block success)
    if (isEmailValid(customerEmail)) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from("email_subscribers").upsert(
            {
              email: customerEmail,
              plan_name: planName,
              expiry_at: expiryAt,
              source: "paid",
              opted_out: false,
            },
            { onConflict: "email" }
          );
        } catch {
          // ignore — table may not exist
        }
      }
      // fire and forget welcome email — don't await blocks payment success
      sendWelcomeEmail({
        to: customerEmail,
        planName,
        expiryAt,
        source: "paid",
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("verify-payment error", err);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
