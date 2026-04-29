import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERS = {
  dhananjay: process.env.ADMIN_PASS_DHANANJAY,
  shishir:   process.env.ADMIN_PASS_SHISHIR,
};

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Username and password required" }, { status: 400 });
    }

    const key = String(username).trim().toLowerCase();
    const expected = USERS[key];

    if (!expected) {
      return NextResponse.json({ success: false, error: "Unknown user" }, { status: 401 });
    }

    if (password !== expected) {
      return NextResponse.json({ success: false, error: "Wrong password" }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: key });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
