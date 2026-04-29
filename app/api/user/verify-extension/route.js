import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addBonusBuilds, recordAnalyticsEvent, recordUserPayment } from "@/lib/userPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSION_BUILDS = 5;
const EXTENSION_PRICE_INR = 10;

export async function POST(req) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const email = (body.email || "").toString().trim().toLowerCase();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ success: false, error: "Email required" }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ success: false, error: "Server not configured" }, { status: 500 });
    }

    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return NextResponse.json({ success: false, error: "Verification failed" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Storage not configured" }, { status: 500 });
    }

    const result = await addBonusBuilds(supabase, { email, count: EXTENSION_BUILDS });
    await recordUserPayment(supabase, {
      email,
      planName: "AI Build Extension",
      amountPaise: EXTENSION_PRICE_INR * 100,
      source: "extension",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      raw: { added_builds: EXTENSION_BUILDS },
    });
    await recordAnalyticsEvent(supabase, {
      eventType: "payment_success",
      email,
      data: {
        source: "extension",
        plan_name: "AI Build Extension",
        builds: EXTENSION_BUILDS,
        amount_paise: EXTENSION_PRICE_INR * 100,
        razorpay_order_id,
        razorpay_payment_id,
      },
    });
    return NextResponse.json({
      success: true,
      bonusBuilds: result?.bonusBuilds || 0,
      added: EXTENSION_BUILDS,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message || "Failed" }, { status: 500 });
  }
}
