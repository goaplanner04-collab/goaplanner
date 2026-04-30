import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getResendStatus, isEmailValid, sendWelcomeEmail } from "@/lib/resend";
import { normalizeEmail } from "@/lib/userPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


function safeDate(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

async function readTable(supabase, table) {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(5000);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function POST(req) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = getResendStatus();
  if (!status.configured) {
    return NextResponse.json({
      success: false,
      error: "RESEND_API_KEY is missing on Railway",
      email_status: status,
    }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const singleEmail = normalizeEmail(body.email || "");
  const includeOptedOut = body.include_opted_out === true;

  if (singleEmail && !isEmailValid(singleEmail)) {
    return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase && !singleEmail) {
    return NextResponse.json({
      success: false,
      error: "Supabase is not configured, so there is no user list to email.",
      email_status: status,
    }, { status: 500 });
  }

  const recipients = new Map();

  if (singleEmail) {
    recipients.set(singleEmail, { email: singleEmail, planName: "GoaNow Pass", expiryAt: null, source: "paid" });
  }

  if (supabase) {
    const [passes, subscribers] = await Promise.all([
      readTable(supabase, "user_passes"),
      readTable(supabase, "email_subscribers"),
    ]);
    const optedOut = new Set(
      subscribers
        .filter((row) => row.opted_out === true)
        .map((row) => normalizeEmail(row.email))
        .filter(Boolean)
    );

    for (const row of passes) {
      const email = normalizeEmail(row.email);
      if (!email || (singleEmail && email !== singleEmail)) continue;
      if (optedOut.has(email) && !includeOptedOut) continue;
      recipients.set(email, {
        email,
        planName: row.plan_name || "GoaNow Pass",
        expiryAt: safeDate(row.expires_at),
        source: row.source || "paid",
      });
    }

    for (const row of subscribers) {
      const email = normalizeEmail(row.email);
      if (!email || (singleEmail && email !== singleEmail)) continue;
      if (row.opted_out === true && !includeOptedOut) continue;
      const existing = recipients.get(email) || { email };
      recipients.set(email, {
        ...existing,
        planName: existing.planName || row.plan_name || "GoaNow Pass",
        expiryAt: existing.expiryAt || safeDate(row.expiry_at),
        source: existing.source || row.source || "paid",
      });
    }
  }

  const list = Array.from(recipients.values()).filter((r) => isEmailValid(r.email));
  if (!list.length) {
    return NextResponse.json({ success: false, error: "No valid recipients found" }, { status: 400 });
  }

  const results = [];
  for (const recipient of list) {
    const result = await sendWelcomeEmail({
      to: recipient.email,
      planName: recipient.planName,
      expiryAt: recipient.expiryAt,
      source: recipient.source,
    });
    results.push({
      email: recipient.email,
      sent: result.sent === true,
      id: result.id || null,
      reason: result.reason || null,
    });
  }

  const sent = results.filter((r) => r.sent).length;
  const failed = results.length - sent;

  return NextResponse.json({
    success: failed === 0,
    sent,
    failed,
    total: results.length,
    email_status: status,
    results,
  }, { status: failed === results.length ? 500 : 200 });
}
