"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { getBrowserSupabase, signInWithGoogle } from "@/lib/supabaseBrowser";

const DEFAULT_PLANS = {
  day: { key: "day", name: "Day Pass", price: 49, paise: 4900, duration_ms: 86400000, label: "24 hours" },
  week: { key: "week", name: "Week Pass", price: 8, paise: 800, duration_ms: 604800000, label: "7 days", popular: true },
  trip: { key: "trip", name: "Trip Pass", price: 149, paise: 14900, duration_ms: 2592000000, label: "30 days" },
};

export default function PaywallModal({ open, onClose, initialPlan = "week", autoAdvance = false }) {
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [selected, setSelected] = useState(initialPlan);
  const [step, setStep] = useState("plans"); // plans | auth | payment
  const [user, setUser] = useState(null);
  const [scriptState, setScriptState] = useState("idle");
  const [processing, setProcessing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [trialCode, setTrialCode] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState(null);
  const [showTrial, setShowTrial] = useState(false);

  // Pull pricing
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.pricing) {
          const merged = {};
          for (const key of ["day", "week", "trip"]) {
            merged[key] = { key, ...DEFAULT_PLANS[key], ...d.pricing[key] };
          }
          setPlans(merged);
        }
      })
      .catch(() => {});
  }, []);

  // Track Supabase session for the auth gate
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (mounted) setUser(data?.session?.user || null);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  // Reset modal state on open
  useEffect(() => {
    if (!open) return;
    setSelected(initialPlan);
    setError(null);
    setAuthError(null);
    setTrialCode("");
    setTrialError(null);
    setShowTrial(false);
    setProcessing(false);
    setSigningIn(false);

    // Skip past auth step if user already signed in OR resuming after OAuth.
    if (autoAdvance || user?.email) setStep("payment");
    else setStep("plans");
  }, [open, initialPlan, autoAdvance, user?.email]);

  // Razorpay loader
  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(false);
      if (window.Razorpay) return resolve(true);
      setScriptState("loading");
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", () => { setScriptState("ready"); resolve(true); });
        existing.addEventListener("error", () => { setScriptState("error"); resolve(false); });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      const timer = setTimeout(() => { setScriptState("error"); resolve(false); }, 10000);
      script.onload = () => { clearTimeout(timer); setScriptState("ready"); resolve(true); };
      script.onerror = () => { clearTimeout(timer); setScriptState("error"); resolve(false); };
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (open && step === "payment") loadRazorpayScript();
  }, [open, step, loadRazorpayScript]);

  if (!open) return null;

  const plan = plans[selected] || plans.week;
  const email = user?.email || "";
  const isEmailValid = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

  const grantAccess = (planName, durationMs) => {
    localStorage.setItem("goanow_plan", planName);
    localStorage.setItem("goanow_expiry", String(Date.now() + durationMs));
    if (email) {
      try { localStorage.setItem("goanow_email", email); } catch {}
    }
    window.location.href = "/dashboard";
  };

  const handleContinue = () => {
    if (user?.email) setStep("payment");
    else setStep("auth");
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      // Save plan so we can resume the modal after the OAuth redirect.
      try { sessionStorage.setItem("goanow_pending_plan", selected); } catch {}
      const { error: oauthError } = await signInWithGoogle();
      if (oauthError) {
        setAuthError(oauthError.message || "Could not sign in. Please try again.");
        setSigningIn(false);
      }
      // On success, browser is redirected to Google. Nothing else to do here.
    } catch (err) {
      setAuthError(err?.message || "Could not sign in. Please try again.");
      setSigningIn(false);
    }
  };

  const handleTrialSubmit = async (e) => {
    e.preventDefault();
    if (!trialCode.trim()) return;
    setTrialLoading(true);
    setTrialError(null);
    try {
      const res = await fetch("/api/validate-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trialCode.trim(),
          email: isEmailValid(email) ? email.trim().toLowerCase() : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) grantAccess(data.plan.name, data.plan.duration_ms);
      else setTrialError(data.error || "Invalid trial key");
    } catch {
      setTrialError("Could not validate key. Try again.");
    } finally {
      setTrialLoading(false);
    }
  };

  const handlePay = async () => {
    setError(null);
    setProcessing(true);
    try {
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) {
        setError("Payment failed to load. Please check your connection and try again.");
        setProcessing(false);
        return;
      }

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: plan.paise, plan: plan.name }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.orderId) {
        setError(orderData.error || "Could not create order. Try again.");
        setProcessing(false);
        return;
      }

      const keyId = orderData.keyId;
      if (!keyId) {
        setError("Payment not configured — key missing. Contact support.");
        setProcessing(false);
        return;
      }

      const options = {
        key: keyId,
        amount: plan.paise,
        currency: "INR",
        name: "GoaNow",
        description: plan.name,
        order_id: orderData.orderId,
        theme: { color: "#FF3D81" },
        handler: async (response) => {
          try {
            const expiryAt = new Date(Date.now() + plan.duration_ms).toISOString();
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: isEmailValid(email) ? email.trim().toLowerCase() : undefined,
                planName: plan.name,
                expiryAt,
                durationMs: plan.duration_ms,
                amountPaise: plan.paise,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) grantAccess(plan.name, plan.duration_ms);
            else { setError("Payment verification failed. Contact support."); setProcessing(false); }
          } catch {
            setError("Payment verification failed. Contact support.");
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
        prefill: isEmailValid(email)
          ? { email: email.trim(), name: user?.user_metadata?.full_name || "" }
          : {},
        notes: { plan: plan.name },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        const code = resp?.error?.code || "";
        const desc = resp?.error?.description || "";
        const reason = resp?.error?.reason || "";
        setError(`Payment failed: ${desc || reason || code || "Unknown error."}`);
        setProcessing(false);
      });
      rzp.open();
    } catch {
      setError("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  const btnLabel = processing
    ? "Processing..."
    : scriptState === "loading"
    ? "Loading payment..."
    : scriptState === "error"
    ? "Retry payment load"
    : `Pay Rs ${plan.price} - UPI / Card / Netbanking`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.84)", backdropFilter: "blur(10px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget && !processing && !signingIn) onClose?.(); }}
    >
      <div
        className="glass-card animate-slideIn"
        style={{ width: "100%", maxWidth: 520, padding: 22, background: "linear-gradient(180deg,rgba(18,20,29,0.97),rgba(7,9,14,0.98))", border: "1px solid rgba(255,61,129,0.32)", boxShadow: "0 0 60px rgba(255,61,129,0.2)", position: "relative", maxHeight: "95vh", overflowY: "auto" }}
      >
        <button
          onClick={() => !processing && !signingIn && onClose?.()}
          aria-label="Close"
          style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-glass)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: (processing || signingIn) ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="x" size={18} />
        </button>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span className="icon-tile">
            <Icon name="ticket" size={22} />
          </span>
          <div>
            <h2 style={{ fontSize: 30, margin: 0, color: "var(--neon-pink)", textShadow: "0 0 20px rgba(255,61,129,0.4)" }}>
              {step === "auth" ? "Almost there!" : "Unlock GoaNow"}
            </h2>
            <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>
              {step === "auth"
                ? "Sign in to save your plan and receive tonight's party updates"
                : "One-time unlock. No subscription."}
            </p>
          </div>
        </div>

        {/* STEP DOTS */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
          {["plans", "auth", "payment"].map((s) => {
            const order = ["plans", "auth", "payment"];
            const isActive = s === step;
            const isPast = order.indexOf(s) < order.indexOf(step);
            return (
              <span
                key={s}
                style={{
                  width: isActive ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: isActive ? "var(--neon-pink)" : isPast ? "rgba(255,61,129,0.5)" : "rgba(255,255,255,0.18)",
                  transition: "all 0.2s ease",
                }}
              />
            );
          })}
        </div>

        {/* STEP 1 — PLAN SELECTION */}
        {step === "plans" && (
          <>
            <div className="paywall-plan-grid">
              {Object.values(plans).map((item) => {
                const active = selected === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSelected(item.key)}
                    style={{ background: active ? "linear-gradient(135deg,rgba(255,61,129,0.2),rgba(51,214,200,0.08))" : "rgba(255,255,255,0.03)", border: active ? "1.5px solid var(--neon-pink)" : "1px solid var(--border-glass)", borderRadius: 8, padding: "14px 8px", cursor: "pointer", color: "#fff", transition: "all 0.2s ease", position: "relative", boxShadow: active && item.popular ? "0 0 24px rgba(255,61,129,0.28)" : "none" }}
                  >
                    {item.popular && (
                      <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "var(--neon-pink)", color: "#fff", fontSize: 9, padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                        POPULAR
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.name}</div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, margin: "4px 0" }}>Rs {item.price}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.label}</div>
                  </button>
                );
              })}
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", fontSize: 14, lineHeight: 1.7 }}>
              {["Nearest cafes and restobars by real GPS distance", "Live party feed with crowd arrival times", "AI itinerary tailored to your vibe and budget", "Works across Goa, from Morjim to Palolem"].map((benefit) => (
                <li key={benefit} style={{ display: "flex", gap: 10, alignItems: "start" }}>
                  <Icon name="check" size={16} style={{ color: "var(--neon-cyan)", marginTop: 4 }} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <button onClick={handleContinue} className="neon-btn" style={{ width: "100%", fontSize: 16 }}>
              Continue
              <Icon name="arrow-right" size={18} />
            </button>

            <div style={{ marginTop: 20, borderTop: "1px solid var(--border-glass)", paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowTrial((shown) => !shown)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: 0 }}
              >
                <Icon name="ticket" size={15} />
                {showTrial ? "Hide trial key" : "Have a trial key?"}
              </button>

              {showTrial && (
                <form onSubmit={handleTrialSubmit} className="trial-form">
                  <input
                    value={trialCode}
                    onChange={(e) => { setTrialCode(e.target.value.toUpperCase()); setTrialError(null); }}
                    placeholder="Enter trial key"
                    className="input-field"
                    style={{ flex: 1, textTransform: "uppercase", letterSpacing: "0.1em" }}
                  />
                  <button type="submit" disabled={trialLoading || !trialCode.trim()} className="neon-btn-ghost" style={{ whiteSpace: "nowrap", padding: "0 14px" }}>
                    {trialLoading ? "..." : "Apply"}
                  </button>
                </form>
              )}

              {trialError && <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 13 }}>{trialError}</div>}
            </div>
          </>
        )}

        {/* STEP 2 — GOOGLE SIGN IN */}
        {step === "auth" && (
          <>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-glass)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <Icon name="ticket" size={18} style={{ color: "var(--neon-pink)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{plan.name} — Rs {plan.price}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{plan.label}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "13px 18px",
                background: "#fff",
                color: "#1f1f1f",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: signingIn ? "not-allowed" : "pointer",
                boxShadow: "0 4px 20px rgba(255,255,255,0.12)",
                opacity: signingIn ? 0.7 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.36 0-4.36-1.59-5.07-3.73H.96v2.34A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.93 10.69A5.4 5.4 0 0 1 3.64 9c0-.59.1-1.16.29-1.69V4.97H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.97-2.34z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.97L3.93 7.31C4.64 5.18 6.64 3.58 9 3.58z"/>
              </svg>
              {signingIn ? "Redirecting…" : "Sign in with Google"}
            </button>

            {authError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginTop: 12 }}>
                {authError}
              </div>
            )}

            <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6, textAlign: "center", marginTop: 18 }}>
              We only use your email for receipts and party alerts.{" "}
              <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Never sold or spammed.</span>
            </p>

            <button
              type="button"
              onClick={() => setStep("plans")}
              disabled={signingIn}
              style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: "var(--text-muted)", cursor: signingIn ? "not-allowed" : "pointer", fontSize: 13 }}
            >
              ← Back to plans
            </button>
          </>
        )}

        {/* STEP 3 — PAYMENT */}
        {step === "payment" && (
          <>
            <div style={{
              background: "linear-gradient(135deg, rgba(255,61,129,0.12), rgba(51,214,200,0.06))",
              border: "1px solid rgba(255,61,129,0.3)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 18,
            }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                You selected
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: "#fff", lineHeight: 1 }}>
                    {plan.name}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{plan.label}</div>
                </div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: "var(--neon-pink)" }}>
                  Rs {plan.price}
                </div>
              </div>
            </div>

            {email && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "rgba(0,200,140,0.08)",
                border: "1px solid rgba(0,200,140,0.3)",
                borderRadius: 11,
                marginBottom: 14,
              }}>
                <span style={{ color: "#33D6C8", fontSize: 16 }}>✓</span>
                <span style={{ color: "#fff", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {email}
                </span>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button onClick={handlePay} disabled={processing || scriptState === "loading"} className="neon-btn" style={{ width: "100%", fontSize: 16 }}>
              {(processing || scriptState === "loading") && (
                <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              )}
              <Icon name="card" size={18} />
              {btnLabel}
            </button>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
              {["UPI", "Visa", "Mastercard", "RuPay"].map((pay) => (
                <span key={pay} style={{ fontSize: 10, padding: "4px 10px", border: "1px solid var(--border-glass)", borderRadius: 6, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{pay}</span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep("plans")}
              disabled={processing}
              style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: "var(--text-muted)", cursor: processing ? "not-allowed" : "pointer", fontSize: 13 }}
            >
              ← Back to plans
            </button>

            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 14, marginBottom: 0 }}>
              Secured by Razorpay | 256-bit encryption
            </p>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
