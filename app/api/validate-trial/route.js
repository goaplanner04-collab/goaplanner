import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TRIAL_HOURS = 168;

function normalizeTrialCode(value) {
  return String(value || "").trim().toUpperCase();
}

function toPositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toUsageCount(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// Parse env var trial keys: TRIAL_KEYS=CODE1:HOURS,CODE2:HOURS
// e.g. TRIAL_KEYS=GOA2024:168,PRESS:72
function getEnvTrialKeys() {
  const raw = process.env.TRIAL_KEYS || "";
  if (!raw.trim()) return [];
  return raw.split(",").map((entry) => {
    const [code, hours] = entry.trim().split(":");
    return {
      code: normalizeTrialCode(code),
      duration_hours: toPositiveInt(hours, DEFAULT_TRIAL_HOURS),
      label: "Trial Pass",
    };
  }).filter((k) => k.code);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeTrialCode(body.code);

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
    const idx = keys.findIndex((k) => {
      const keyCode = normalizeTrialCode(k?.code);
      const usedCount = toUsageCount(k?.used_count);
      const maxUses = toPositiveInt(k?.max_uses, 1);
      return keyCode === code && usedCount < maxUses;
    });

    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Invalid or expired trial key" });
    }

    const matched = keys[idx];
    const usedCount = toUsageCount(matched.used_count);
    const maxUses = toPositiveInt(matched.max_uses, 1);
    const durationHours = toPositiveInt(matched.duration_hours, DEFAULT_TRIAL_HOURS);
    const label = String(matched.label || "Trial Pass").trim() || "Trial Pass";

    // Increment usage count
    keys[idx] = {
      ...matched,
      code,
      label,
      duration_hours: durationHours,
      max_uses: maxUses,
      used_count: usedCount + 1,
    };
    const { error: updateError } = await supabase
      .from("settings")
      .upsert({ key: "trial_keys", value: keys, updated_at: new Date().toISOString() });

    if (updateError) {
      console.error("validate-trial usage update error", updateError);
      return NextResponse.json({ success: false, error: "Server error - could not validate key" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      plan: {
        name: label,
        duration_ms: durationHours * 3600 * 1000,
      },
    });
  } catch (err) {
    console.error("validate-trial error", err);
    return NextResponse.json({ success: false, error: "Server error — could not validate key" }, { status: 500 });
  }
}
