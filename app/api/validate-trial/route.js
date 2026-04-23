import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Parse env var trial keys: TRIAL_KEYS=CODE1:HOURS,CODE2:HOURS
// e.g. TRIAL_KEYS=GOA2024:168,PRESS:72
function getEnvTrialKeys() {
  const raw = process.env.TRIAL_KEYS || "";
  if (!raw.trim()) return [];
  return raw.split(",").map((entry) => {
    const [code, hours] = entry.trim().split(":");
    return {
      code: (code || "").toUpperCase().trim(),
      duration_hours: Math.max(1, parseInt(hours, 10) || 168),
      label: "Trial Pass",
    };
  }).filter((k) => k.code);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = (body.code || "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ success: false, error: "No trial key provided" }, { status: 400 });
    }

    // 1. Check env var keys first (always works, no DB needed)
    const envKeys = getEnvTrialKeys();
    const envMatch = envKeys.find((k) => k.code === code);
    if (envMatch) {
      return NextResponse.json({
        success: true,
        plan: {
          name: envMatch.label || "Trial Pass",
          duration_ms: envMatch.duration_hours * 3600 * 1000,
        },
      });
    }

    // 2. Check Supabase DB keys
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Invalid trial key" });
    }

    const { data, error: dbError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "trial_keys")
      .single();

    if (dbError || !data) {
      // Table may not exist yet — key simply not found
      return NextResponse.json({ success: false, error: "Invalid trial key" });
    }

    const keys = Array.isArray(data.value) ? data.value : [];
    const idx = keys.findIndex(
      (k) => k.code === code && k.used_count < k.max_uses
    );

    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Invalid or expired trial key" });
    }

    const matched = keys[idx];

    // Increment usage count
    keys[idx] = { ...matched, used_count: (matched.used_count || 0) + 1 };
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
    return NextResponse.json({ success: false, error: "Server error — could not validate key" }, { status: 500 });
  }
}
