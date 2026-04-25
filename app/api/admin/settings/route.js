import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_PRICING } from "@/app/api/settings/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TRIAL_HOURS = 168;

function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return req.headers.get("x-admin-auth") === expected;
}

function normalizeTrialCode(value) {
  return String(value || "").trim().toUpperCase().slice(0, 30);
}

function toPositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toUsageCount(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sanitizeTrialKey(key, defaults = {}) {
  const code = normalizeTrialCode(key?.code);
  if (!code) return null;

  const label = String(key?.label || defaults.label || "Trial Pass").trim().slice(0, 50) || "Trial Pass";
  const sanitized = {
    code,
    label,
    duration_hours: toPositiveInt(key?.duration_hours, defaults.duration_hours || DEFAULT_TRIAL_HOURS),
    max_uses: toPositiveInt(key?.max_uses, defaults.max_uses || 1),
    used_count: toUsageCount(key?.used_count),
  };

  if (defaults.from_env) sanitized.from_env = true;
  return sanitized;
}

// Parse env var trial keys
function getEnvTrialKeys() {
  const raw = process.env.TRIAL_KEYS || "";
  if (!raw.trim()) return [];
  return raw.split(",").map((entry) => {
    const [code, hours] = entry.trim().split(":");
    return sanitizeTrialKey({
      code,
      duration_hours: hours,
      label: "Env Key (Railway)",
    }, {
      max_uses: 9999,
      from_env: true,
    });
  }).filter(Boolean);
}

export async function GET(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const envKeys = getEnvTrialKeys();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      success: true,
      pricing: DEFAULT_PRICING,
      trial_keys: envKeys,
      db_status: "no_supabase",
    });
  }

  try {
    const [pricingRes, keysRes] = await Promise.all([
      supabase.from("settings").select("value").eq("key", "pricing").single(),
      supabase.from("settings").select("value").eq("key", "trial_keys").single(),
    ]);

    // Check if settings table exists
    const tableExists = !(pricingRes.error?.message?.includes("does not exist") ||
                          keysRes.error?.message?.includes("does not exist"));

    const pricing = pricingRes.data?.value || DEFAULT_PRICING;
    const dbKeys = Array.isArray(keysRes.data?.value)
      ? keysRes.data.value.map((k) => sanitizeTrialKey(k)).filter(Boolean)
      : [];
    const allKeys = [...envKeys, ...dbKeys];

    return NextResponse.json({
      success: true,
      pricing,
      trial_keys: allKeys,
      db_status: tableExists ? "ok" : "table_missing",
    });
  } catch (err) {
    return NextResponse.json({
      success: true,
      pricing: DEFAULT_PRICING,
      trial_keys: envKeys,
      db_status: "error",
      db_error: err.message,
    });
  }
}

export async function POST(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured — set env vars on Railway" }, { status: 500 });

  try {
    const body = await req.json();
    const updates = [];

    if (body.pricing) {
      const sanitized = {};
      for (const key of ["day", "week", "trip"]) {
        if (!body.pricing[key]) continue;
        const p = body.pricing[key];
        const price = Math.max(1, parseInt(p.price, 10) || DEFAULT_PRICING[key]?.price || 99);
        sanitized[key] = {
          price,
          paise: price * 100,
          label: String(p.label || "").slice(0, 50),
          name: String(p.name || "").slice(0, 50),
          popular: !!p.popular,
          duration_ms: DEFAULT_PRICING[key]?.duration_ms,
        };
      }
      updates.push(
        supabase.from("settings").upsert({ key: "pricing", value: sanitized, updated_at: new Date().toISOString() })
      );
    }

    if (body.trial_keys !== undefined) {
      // Only save non-env keys to DB
      const seenCodes = new Set();
      const dbKeys = (body.trial_keys || [])
        .filter((k) => !k.from_env)
        .map((k) => sanitizeTrialKey(k, { label: "Trial" }))
        .filter(Boolean)
        .filter((k) => {
          if (seenCodes.has(k.code)) return false;
          seenCodes.add(k.code);
          return true;
        });

      updates.push(
        supabase.from("settings").upsert({ key: "trial_keys", value: dbKeys, updated_at: new Date().toISOString() })
      );
    }

    const results = await Promise.allSettled(updates);
    const failed = results.filter((r) => r.status === "rejected" || r.value?.error);

    if (failed.length > 0) {
      const errMsg = failed[0]?.reason?.message || failed[0]?.value?.error?.message || "DB write failed";
      if (errMsg.includes("does not exist")) {
        return NextResponse.json({
          error: "Settings table missing in Supabase. Run the setup SQL first.",
          setup_required: true,
        }, { status: 500 });
      }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
