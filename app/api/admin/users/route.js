import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getResendStatus } from "@/lib/resend";
import { normalizeEmail } from "@/lib/userPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function isMissingTable(error) {
  const msg = String(error?.message || error?.details || "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

async function readTable(supabase, table, { orderBy, limit } = {}) {
  const run = async (withOrder = true) => {
    let query = supabase.from(table).select("*");
    if (withOrder && orderBy) query = query.order(orderBy, { ascending: false });
    if (limit) query = query.limit(limit);
    return query;
  };

  try {
    let { data, error } = await run(true);
    if (error && orderBy && !isMissingTable(error)) {
      const retry = await run(false);
      data = retry.data;
      error = retry.error;
    }
    return { data: Array.isArray(data) ? data : [], error };
  } catch (err) {
    return { data: [], error: err };
  }
}

function safeDate(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function isAfterNow(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) && time > Date.now();
}

function moneyFromPaise(value) {
  return Math.max(0, parseInt(value, 10) || 0) / 100;
}

function tabLabel(tab) {
  const key = String(tab || "").toLowerCase();
  const labels = {
    nearby: "Nearby",
    events: "Parties",
    ai: "AI Plan",
    settings: "Settings",
  };
  return labels[key] || (tab ? `Tab: ${tab}` : "Dashboard tabs");
}

function featureLabel(event) {
  const data = event?.data && typeof event.data === "object" ? event.data : {};
  switch (event?.event_type) {
    case "itinerary_built":
      return "AI itinerary";
    case "plan_saved":
      return "Saved plans";
    case "plan_shared":
      return "Shared plans";
    case "thumbs_up":
    case "thumbs_down":
      return "Feedback";
    case "tab_viewed":
      return tabLabel(data.tab);
    case "paywall_opened":
      return "Paywall";
    case "payment_success":
      return "Payment";
    default:
      return event?.event_type || "Other";
  }
}

function getEventEmail(event) {
  const data = event?.data && typeof event.data === "object" ? event.data : {};
  return normalizeEmail(event?.email || data.email || "");
}

function createUser(email) {
  return {
    email,
    name: null,
    avatar_url: null,
    signed_up_at: null,
    last_sign_in_at: null,
    auth_provider: null,
    plan_name: null,
    source: null,
    expires_at: null,
    active: false,
    bonus_builds: 0,
    subscriber_source: null,
    opted_out: false,
    subscribed_at: null,
    payment_count: 0,
    total_paid_inr: 0,
    last_payment_at: null,
    last_seen_at: null,
    feature_counts: {},
    most_used_feature: null,
    payments: [],
  };
}

async function listAuthUsers(supabase) {
  // Pull every user who has ever signed in via Supabase Auth (Google etc.).
  // Paginate up to ~5000 users.
  const all = [];
  for (let page = 1; page <= 5; page++) {
    try {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        return { data: all, error };
      }
      const users = data?.users || [];
      all.push(...users);
      if (users.length < 1000) break;
    } catch (err) {
      return { data: all, error: err };
    }
  }
  return { data: all, error: null };
}

function pickMostUsed(counts) {
  const entries = Object.entries(counts || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { name: entries[0][0], count: entries[0][1] };
}

export async function GET(req) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const emailStatus = getResendStatus();

  if (!supabase) {
    return NextResponse.json({
      success: true,
      users: [],
      stats: {
        total_users: 0,
        active_passes: 0,
        paid_users: 0,
        trial_users: 0,
        subscribers: 0,
        opted_out: 0,
        payment_count: 0,
        repeat_payers: 0,
        total_revenue_inr: 0,
      },
      feature_totals: [],
      payments_available: false,
      email_status: emailStatus,
      db_status: "no_supabase",
      missing_tables: [],
      errors: [],
    });
  }

  const [passesRes, subscribersRes, analyticsRes, paymentsRes, authUsersRes] = await Promise.all([
    readTable(supabase, "user_passes", { orderBy: "updated_at", limit: 5000 }),
    readTable(supabase, "email_subscribers", { orderBy: "created_at", limit: 5000 }),
    readTable(supabase, "analytics", { orderBy: "created_at", limit: 3000 }),
    readTable(supabase, "user_payments", { orderBy: "created_at", limit: 2000 }),
    listAuthUsers(supabase),
  ]);

  const tableResults = {
    user_passes: passesRes,
    email_subscribers: subscribersRes,
    analytics: analyticsRes,
    user_payments: paymentsRes,
  };

  const missingTables = [];
  const errors = [];
  for (const [table, result] of Object.entries(tableResults)) {
    if (!result.error) continue;
    if (isMissingTable(result.error)) {
      missingTables.push(table);
    } else {
      errors.push({ table, message: result.error.message || String(result.error) });
    }
  }
  if (authUsersRes.error) {
    errors.push({
      table: "auth.users",
      message: authUsersRes.error.message || String(authUsersRes.error),
    });
  }

  const users = new Map();
  const ensureUser = (email) => {
    const norm = normalizeEmail(email);
    if (!norm) return null;
    if (!users.has(norm)) users.set(norm, createUser(norm));
    return users.get(norm);
  };

  // Seed from Supabase Auth so every signed-in user appears, even if they
  // have no payments / subscriptions / analytics events.
  for (const authUser of authUsersRes.data || []) {
    const email = normalizeEmail(authUser.email);
    if (!email) continue;
    const user = ensureUser(email);
    if (!user) continue;
    const meta = authUser.user_metadata || {};
    user.name = meta.full_name || meta.name || null;
    user.avatar_url = meta.avatar_url || meta.picture || null;
    user.signed_up_at = safeDate(authUser.created_at);
    user.last_sign_in_at = safeDate(authUser.last_sign_in_at);
    user.auth_provider = authUser.app_metadata?.provider || null;
    if (user.last_sign_in_at && (!user.last_seen_at || new Date(user.last_sign_in_at) > new Date(user.last_seen_at))) {
      user.last_seen_at = user.last_sign_in_at;
    }
  }

  for (const row of passesRes.data) {
    const user = ensureUser(row.email);
    if (!user) continue;
    user.plan_name = row.plan_name || user.plan_name;
    user.source = row.source || user.source;
    user.expires_at = safeDate(row.expires_at) || user.expires_at;
    user.active = isAfterNow(user.expires_at);
    user.bonus_builds = Number(row.bonus_builds) || 0;
  }

  for (const row of subscribersRes.data) {
    const user = ensureUser(row.email);
    if (!user) continue;
    user.plan_name = user.plan_name || row.plan_name || null;
    user.subscriber_source = row.source || null;
    user.source = user.source || row.source || null;
    user.opted_out = row.opted_out === true;
    user.subscribed_at = safeDate(row.created_at) || null;
    user.expires_at = user.expires_at || safeDate(row.expiry_at);
    user.active = user.active || isAfterNow(user.expires_at);
  }

  const paymentsByEmail = new Map();
  for (const row of paymentsRes.data) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    const user = ensureUser(email);
    if (user && !user.plan_name) user.plan_name = row.plan_name || null;
    if (!paymentsByEmail.has(email)) paymentsByEmail.set(email, []);
    paymentsByEmail.get(email).push(row);
  }

  const analyticsPaymentsByEmail = new Map();
  const featureTotals = {};

  for (const event of analyticsRes.data) {
    const label = featureLabel(event);
    featureTotals[label] = (featureTotals[label] || 0) + 1;

    const email = getEventEmail(event);
    const user = ensureUser(email);
    if (!user) continue;

    user.feature_counts[label] = (user.feature_counts[label] || 0) + 1;
    const createdAt = safeDate(event.created_at);
    if (createdAt && (!user.last_seen_at || new Date(createdAt) > new Date(user.last_seen_at))) {
      user.last_seen_at = createdAt;
    }

    if (event.event_type === "payment_success") {
      if (!analyticsPaymentsByEmail.has(email)) analyticsPaymentsByEmail.set(email, []);
      analyticsPaymentsByEmail.get(email).push(event);
    }
  }

  for (const [email, user] of users.entries()) {
    const paymentRows = paymentsByEmail.get(email) || [];
    const analyticsPaymentRows = analyticsPaymentsByEmail.get(email) || [];
    const usingPaymentTable = paymentRows.length > 0;

    const payments = usingPaymentTable
      ? paymentRows.map((row) => ({
          plan_name: row.plan_name || null,
          amount_inr: moneyFromPaise(row.amount_paise),
          currency: row.currency || "INR",
          source: row.source || "paid",
          razorpay_order_id: row.razorpay_order_id || null,
          razorpay_payment_id: row.razorpay_payment_id || null,
          created_at: safeDate(row.created_at),
          expires_at: safeDate(row.expires_at),
        }))
      : analyticsPaymentRows.map((row) => {
          const data = row.data && typeof row.data === "object" ? row.data : {};
          return {
            plan_name: data.plan_name || data.planName || null,
            amount_inr: moneyFromPaise(data.amount_paise),
            currency: data.currency || "INR",
            source: data.source || "paid",
            razorpay_order_id: data.razorpay_order_id || null,
            razorpay_payment_id: data.razorpay_payment_id || null,
            created_at: safeDate(row.created_at),
            expires_at: null,
          };
        });

    payments.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    user.payments = payments.slice(0, 8);
    user.payment_count = payments.filter((p) => p.source !== "trial" && p.amount_inr > 0).length;
    user.total_paid_inr = payments.reduce((sum, p) => sum + (p.source !== "trial" ? p.amount_inr : 0), 0);
    user.last_payment_at = payments[0]?.created_at || null;
    user.most_used_feature = pickMostUsed(user.feature_counts);
  }

  const userList = Array.from(users.values()).sort((a, b) => {
    const aTime = new Date(a.last_payment_at || a.last_seen_at || a.last_sign_in_at || a.subscribed_at || a.signed_up_at || 0).getTime();
    const bTime = new Date(b.last_payment_at || b.last_seen_at || b.last_sign_in_at || b.subscribed_at || b.signed_up_at || 0).getTime();
    return bTime - aTime || a.email.localeCompare(b.email);
  });

  const featureTotalList = Object.entries(featureTotals)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const stats = {
    total_users: userList.length,
    active_passes: userList.filter((u) => u.active).length,
    paid_users: userList.filter((u) => u.payment_count > 0 || u.source === "paid").length,
    trial_users: userList.filter((u) => u.source === "trial").length,
    subscribers: subscribersRes.data.filter((row) => row.opted_out !== true).length,
    opted_out: subscribersRes.data.filter((row) => row.opted_out === true).length,
    payment_count: userList.reduce((sum, u) => sum + u.payment_count, 0),
    repeat_payers: userList.filter((u) => u.payment_count > 1).length,
    total_revenue_inr: Math.round(userList.reduce((sum, u) => sum + u.total_paid_inr, 0)),
  };

  return NextResponse.json({
    success: true,
    users: userList,
    stats,
    feature_totals: featureTotalList,
    payments_available: !missingTables.includes("user_payments"),
    email_status: emailStatus,
    db_status: errors.length ? "partial_error" : "ok",
    missing_tables: missingTables,
    errors,
  });
}
