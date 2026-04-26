// Server-side helpers for the user_passes table.
// Pass persistence so a user's pass survives sign-out / device change.

export function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

// Save or extend a pass. If the user already has an unexpired pass, the
// new pass extends from the existing expiry, not from now (so paying
// twice on the same day actually adds time).
export async function grantPass(supabase, { email, planName, durationMs, source }) {
  if (!supabase || !email || !durationMs) return null;
  const normEmail = normalizeEmail(email);

  try {
    const { data: existing } = await supabase
      .from("user_passes")
      .select("expires_at, bonus_builds")
      .eq("email", normEmail)
      .single();

    const now = Date.now();
    const existingExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
    const startFrom = Math.max(now, existingExpiry);
    const newExpiry = new Date(startFrom + durationMs).toISOString();

    await supabase.from("user_passes").upsert({
      email: normEmail,
      plan_name: planName || existing?.plan_name || "Pass",
      expires_at: newExpiry,
      source: source || "paid",
      bonus_builds: existing?.bonus_builds || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "email" });

    return { expiresAt: newExpiry };
  } catch (err) {
    console.error("grantPass error", err);
    return null;
  }
}

export async function addBonusBuilds(supabase, { email, count }) {
  if (!supabase || !email || !count) return null;
  const normEmail = normalizeEmail(email);
  try {
    const { data: existing } = await supabase
      .from("user_passes")
      .select("bonus_builds")
      .eq("email", normEmail)
      .single();

    const next = (existing?.bonus_builds || 0) + count;
    await supabase
      .from("user_passes")
      .upsert(
        { email: normEmail, bonus_builds: next, updated_at: new Date().toISOString() },
        { onConflict: "email" }
      );
    return { bonusBuilds: next };
  } catch (err) {
    console.error("addBonusBuilds error", err);
    return null;
  }
}

// Count today's itinerary_built events for this email.
export async function getDailyBuildCount(supabase, email) {
  if (!supabase || !email) return 0;
  const normEmail = normalizeEmail(email);
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("analytics")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "itinerary_built")
      .filter("data->>email", "eq", normEmail)
      .gte("created_at", startOfDay.toISOString());
    return count || 0;
  } catch {
    return 0;
  }
}

export async function getBonusBuilds(supabase, email) {
  if (!supabase || !email) return 0;
  const normEmail = normalizeEmail(email);
  try {
    const { data } = await supabase
      .from("user_passes")
      .select("bonus_builds")
      .eq("email", normEmail)
      .single();
    return Number(data?.bonus_builds) || 0;
  } catch {
    return 0;
  }
}

// Decrement bonus_builds by 1 if available. Used after a build that
// consumed a bonus credit (count > BASE_DAILY_LIMIT).
export async function consumeBonusBuild(supabase, email) {
  if (!supabase || !email) return false;
  const normEmail = normalizeEmail(email);
  try {
    const { data } = await supabase
      .from("user_passes")
      .select("bonus_builds")
      .eq("email", normEmail)
      .single();
    const current = Number(data?.bonus_builds) || 0;
    if (current <= 0) return false;
    await supabase
      .from("user_passes")
      .update({ bonus_builds: current - 1, updated_at: new Date().toISOString() })
      .eq("email", normEmail);
    return true;
  } catch {
    return false;
  }
}
