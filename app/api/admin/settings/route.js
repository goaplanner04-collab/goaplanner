import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_PRICING } from "@/app/api/settings/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return req.headers.get("x-admin-auth") === expected;
}

async function getSetting(supabase, key, fallback) {
  const { data } = await supabase.from("settings").select("value").eq("key", key).single();
  return data?.value ?? fallback;
}

export async function GET(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const pricing = await getSetting(supabase, "pricing", DEFAULT_PRICING);
    const trialKeys = await getSetting(supabase, "trial_keys", []);
    return NextResponse.json({ success: true, pricing, trial_keys: trialKeys });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const updates = [];

    if (body.pricing) {
      const sanitized = {};
      for (const key of ["day", "week", "trip"]) {
        if (!body.pricing[key]) continue;
        const p = body.pricing[key];
        const price = Math.max(1, parseInt(p.price, 10) || DEFAULT_PRICING[key].price);
        sanitized[key] = {
          price,
          paise: price * 100,
          label: String(p.label || DEFAULT_PRICING[key].label).slice(0, 50),
          name: String(p.name || DEFAULT_PRICING[key].name).slice(0, 50),
          popular: !!p.popular,
          duration_ms: DEFAULT_PRICING[key].duration_ms,
        };
      }
      updates.push(
        supabase.from("settings").upsert({ key: "pricing", value: sanitized, updated_at: new Date().toISOString() })
      );
    }

    if (body.trial_keys !== undefined) {
      const keys = (body.trial_keys || []).map((k) => ({
        code: String(k.code || "").toUpperCase().trim().slice(0, 30),
        label: String(k.label || "Trial").slice(0, 50),
        duration_hours: Math.max(1, parseInt(k.duration_hours, 10) || 168),
        max_uses: Math.max(1, parseInt(k.max_uses, 10) || 1),
        used_count: parseInt(k.used_count, 10) || 0,
      })).filter((k) => k.code);

      updates.push(
        supabase.from("settings").upsert({ key: "trial_keys", value: keys, updated_at: new Date().toISOString() })
      );
    }

    await Promise.all(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
