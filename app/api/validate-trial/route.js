import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ success: false, error: "No key provided" }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Service not configured" }, { status: 500 });
    }

    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "trial_keys")
      .single();

    const keys = data?.value || [];
    const idx = keys.findIndex(
      (k) => k.code === normalized && k.used_count < k.max_uses
    );

    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Invalid or expired trial key" });
    }

    const matched = keys[idx];
    keys[idx] = { ...matched, used_count: matched.used_count + 1 };

    await supabase
      .from("settings")
      .upsert({ key: "trial_keys", value: keys, updated_at: new Date().toISOString() });

    return NextResponse.json({
      success: true,
      plan: {
        name: matched.label || "Trial Pass",
        duration_ms: (matched.duration_hours || 168) * 3600 * 1000,
      },
    });
  } catch (err) {
    console.error("validate-trial error", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
