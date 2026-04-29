import Razorpay from "razorpay";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  if (!keyId || !keySecret) {
    return NextResponse.json({
      ok: false,
      error: "Keys not set on server",
      keyIdSet: !!keyId,
      secretSet: !!keySecret,
    });
  }

  const keyPrefix = keyId.slice(0, 12);
  const isLive = keyId.startsWith("rzp_live_");
  const isTest = keyId.startsWith("rzp_test_");

  // Try creating a minimal test order to confirm the keys actually work
  try {
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await rzp.orders.create({
      amount: 100,
      currency: "INR",
      receipt: "check_" + Date.now(),
    });
    return NextResponse.json({
      ok: true,
      keyPrefix,
      isLive,
      isTest,
      testOrderId: order.id,
      testOrderStatus: order.status,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      keyPrefix,
      isLive,
      isTest,
      error: err?.error?.description || err?.message || String(err),
    });
  }
}
