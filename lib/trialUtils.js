// 10-minute free trial — client-side only.
// Trial state lives in localStorage:
//   goanow_trial_start   — ms timestamp when trial began
//   goanow_trial_expired — "true" once locked out
//
// Paid users (goanow_plan + goanow_expiry > now) bypass everything.

const TRIAL_DURATION_MS = 10 * 60 * 1000;

export function hasPaidAccess() {
  if (typeof window === "undefined") return false;
  try {
    const plan = localStorage.getItem("goanow_plan");
    const expiry = parseInt(localStorage.getItem("goanow_expiry") || "0", 10);
    return !!(plan && expiry && Date.now() < expiry);
  } catch {
    return false;
  }
}

export function getTrialStatus() {
  if (typeof window === "undefined") {
    return { active: false, reason: "ssr" };
  }

  if (hasPaidAccess()) {
    return { active: false, reason: "paid" };
  }

  let trialStart = null;
  try { trialStart = localStorage.getItem("goanow_trial_start"); } catch {}

  if (!trialStart) {
    return { active: false, reason: "no_trial" };
  }

  let expiredFlag = "false";
  try { expiredFlag = localStorage.getItem("goanow_trial_expired") || "false"; } catch {}
  if (expiredFlag === "true") {
    return { active: false, reason: "expired" };
  }

  const elapsed = Date.now() - parseInt(trialStart, 10);
  if (elapsed >= TRIAL_DURATION_MS) {
    try { localStorage.setItem("goanow_trial_expired", "true"); } catch {}
    return { active: false, reason: "time_up" };
  }

  const remainingMs = TRIAL_DURATION_MS - elapsed;
  return {
    active: true,
    remainingMs,
    remainingSecs: Math.floor(remainingMs / 1000),
  };
}

export function startTrial() {
  if (typeof window === "undefined") return;
  if (hasPaidAccess()) return;
  try {
    if (localStorage.getItem("goanow_trial_start")) return;
    localStorage.setItem("goanow_trial_start", String(Date.now()));
    localStorage.setItem("goanow_trial_expired", "false");
  } catch {}
}

export function formatCountdown(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
