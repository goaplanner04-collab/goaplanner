import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addBonusBuilds } from "@/lib/userPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSION_BUILDS = 15;

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
    return NextResponse.json({
      success: true,
      bonusBuilds: result?.bonusBuilds || 0,
      added: EXTENSION_BUILDS,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message || "Failed" }, { status: 500 });
  }
}
