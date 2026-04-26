import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendPartyBlast } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://goanow.online";

function authorized(req) {
  // Either admin auth header OR a Cron secret (for Railway/Vercel cron jobs)
  const adminPwd = process.env.ADMIN_PASSWORD;
  const cronSecret = process.env.CRON_SECRET;
  const adminHeader = req.headers.get("x-admin-auth");
  const cronHeader = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (adminPwd && adminHeader === adminPwd) return true;
  if (cronSecret && cronHeader === cronSecret) return true;
  return false;
}

async function getTonightsEvents(supabase) {
  if (!supabase) return [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("date", today)
      .lte("publish_on", today)
      .order("start_time", { ascending: true })
      .limit(8);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getActiveSubscribers(supabase) {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("email_subscribers")
      .select("email")
      .eq("opted_out", false);
    return Array.isArray(data) ? data.map((r) => r.email).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function POST(req) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runBlast();
}

// Allow GET for cron-style invocation (Railway cron, external pings)
export async function GET(req) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runBlast();
}

async function runBlast() {
  const supabase = getSupabaseAdmin();
  const events = await getTonightsEvents(supabase);

  if (!events.length) {
    return NextResponse.json({ success: true, sent: 0, reason: "no_events_tonight" });
  }

  const recipients = await getActiveSubscribers(supabase);
  if (!recipients.length) {
    return NextResponse.json({ success: true, sent: 0, reason: "no_subscribers" });
  }

  // Send sequentially to respect Resend free-tier rate limits
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    const unsubscribeUrl = `${SITE_URL}/api/email/unsubscribe?email=${encodeURIComponent(to)}`;
    try {
      const result = await sendPartyBlast({ to, events, unsubscribeUrl });
      if (result.sent) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ success: true, sent, failed, total: recipients.length, events: events.length });
}
