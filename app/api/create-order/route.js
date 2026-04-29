import Razorpay from "razorpay";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const amount = parseInt(body.amount, 10);

    if (!amount || amount < 100) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay not configured on server" },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "goanow_" + Date.now(),
      notes: {
        plan: body.plan || "GoaNow Pass"
      }
    });

    return NextResponse.json({ orderId: order.id, amount: order.amount, keyId });
  } catch (err) {
    console.error("create-order error", err);
    return NextResponse.json(
      { error: err?.message || "Could not create order" },
      { status: 500 }
    );
  }
}
