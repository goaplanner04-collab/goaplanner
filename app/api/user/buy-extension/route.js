import Razorpay from "razorpay";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Buy 15 extra plan generations for ₹30
export const EXTENSION_PRICE_INR = 30;
export const EXTENSION_BUILDS = 15;

export async function POST(req) {
  try {
    const body = await req.json();
    const email = (body.email || "").toString().trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const order = await razorpay.orders.create({
      amount: EXTENSION_PRICE_INR * 100,
      currency: "INR",
      receipt: "ext_" + Date.now(),
      notes: { email, type: "extension", builds: String(EXTENSION_BUILDS) },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      builds: EXTENSION_BUILDS,
      price: EXTENSION_PRICE_INR,
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Could not create extension order" }, { status: 500 });
  }
}
