import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isEmailValid, sendWelcomeEmail } from "@/lib/resend";
import { grantPass, recordAnalyticsEvent, recordUserPayment } from "@/lib/userPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const customerEmail = (body.email || "").toString().trim().toLowerCase();
    const planName = body.planName ? String(body.planName).slice(0, 80) : null;
    const expiryAt = body.expiryAt ? new Date(body.expiryAt).toISOString() : null;
    const durationMs = Number(body.durationMs) || 0;
    const amountPaise = Math.max(0, parseInt(body.amountPaise, 10) || 0);

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

    // Persist pass to user_passes (so it survives sign-out / new device)
    let serverExpiryAt = expiryAt;
    if (isEmailValid(customerEmail)) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        if (durationMs > 0) {
          const granted = await grantPass(supabase, {
            email: customerEmail,
            planName,
            durationMs,
            source: "paid",
          });
          if (granted?.expiresAt) serverExpiryAt = granted.expiresAt;
        }
        try {
          await supabase.from("email_subscribers").upsert(
            {
              email: customerEmail,
              plan_name: planName,
              expiry_at: serverExpiryAt,
              source: "paid",
              opted_out: false,
            },
            { onConflict: "email" }
          );
        } catch {
          // ignore — table may not exist
        }
        await recordUserPayment(supabase, {
          email: customerEmail,
          planName,
          amountPaise,
          source: "paid",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          expiresAt: serverExpiryAt,
          raw: {
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            plan_name: planName,
          },
        });
        await recordAnalyticsEvent(supabase, {
          eventType: "payment_success",
          email: customerEmail,
          data: {
            source: "paid",
            plan_name: planName,
            amount_paise: amountPaise,
            razorpay_order_id,
            razorpay_payment_id,
          },
        });
      }
      sendWelcomeEmail({
        to: customerEmail,
        planName,
        expiryAt: serverExpiryAt,
        source: "paid",
      }).catch((err) => console.error("welcome email failed", err));
    }

    return NextResponse.json({ success: true, expiresAt: serverExpiryAt });
  } catch (err) {
    console.error("verify-payment error", err);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
