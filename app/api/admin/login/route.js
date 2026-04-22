import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { password } = await req.json();
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
      return NextResponse.json(
        { success: false, error: "Admin password not configured on server" },
        { status: 500 }
      );
    }

    if (typeof password === "string" && password === expected) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
