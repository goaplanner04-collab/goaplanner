import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DEFAULT_PRICING = {
  day:  { price: 49,  paise: 4900,  duration_ms: 24 * 3600 * 1000,  label: "24 hours", name: "Day Pass"  },
  week: { price: 99,  paise: 9900,  duration_ms: 7 * 24 * 3600 * 1000, label: "7 days",  name: "Week Pass", popular: true },
  trip: { price: 149, paise: 14900, duration_ms: 30 * 24 * 3600 * 1000, label: "30 days", name: "Trip Pass" },
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ pricing: DEFAULT_PRICING });

    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .eq("key", "pricing")
      .single();

    if (!data) return NextResponse.json({ pricing: DEFAULT_PRICING });

    const pricing = mergePricing(data.value);
    return NextResponse.json({ pricing });
  } catch {
    return NextResponse.json({ pricing: DEFAULT_PRICING });
  }
}

function mergePricing(stored) {
  const result = {};
  for (const key of ["day", "week", "trip"]) {
    const def = DEFAULT_PRICING[key];
    const s = stored?.[key] || {};
    const price = Number(s.price) || def.price;
    result[key] = {
      ...def,
      price,
      paise: price * 100,
      label: s.label || def.label,
      name: s.name || def.name,
      popular: s.popular ?? def.popular ?? false,
    };
  }
  return result;
}
