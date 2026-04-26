import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

// GET /api/user/pass?email=<email>
// Returns the user's active pass (if any).
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = normalizeEmail(searchParams.get("email"));
  if (!email) return NextResponse.json({ active: false }, { status: 200 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ active: false }, { status: 200 });

  try {
    const { data } = await supabase
      .from("user_passes")
      .select("*")
      .eq("email", email)
      .single();

    if (!data) return NextResponse.json({ active: false });

    const expiresMs = data.expires_at ? new Date(data.expires_at).getTime() : 0;
    const now = Date.now();
    const active = expiresMs > now;

    return NextResponse.json({
      active,
      planName: data.plan_name || null,
      expiresAt: data.expires_at,
      bonusBuilds: Number(data.bonus_builds) || 0,
    });
  } catch {
    return NextResponse.json({ active: false });
  }
}
