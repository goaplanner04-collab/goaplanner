"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";

const DEFAULT_PLANS = {
  day: { key: "day", name: "Day Pass", price: 49, paise: 4900, duration_ms: 86400000, label: "24 hours" },
  week: { key: "week", name: "Week Pass", price: 99, paise: 9900, duration_ms: 604800000, label: "7 days", popular: true },
  trip: { key: "trip", name: "Trip Pass", price: 149, paise: 14900, duration_ms: 2592000000, label: "30 days" },
};

export default function PaywallModal({ open, onClose, initialPlan = "week", prefillEmail = "" }) {
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [selected, setSelected] = useState(initialPlan);
  const [scriptState, setScriptState] = useState("idle");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [trialCode, setTrialCode] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState(null);
  const [showTrial, setShowTrial] = useState(false);
  const [email, setEmail] = useState("");

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

  useEffect(() => {
    if (open) {
      setSelected(initialPlan);
      setError(null);
      setTrialCode("");
      setTrialError(null);
      setShowTrial(false);
      // Prefer the prop (passed from authed landing page) over localStorage
      if (prefillEmail) {
        setEmail(prefillEmail);
        try { localStorage.setItem("goanow_email", prefillEmail); } catch {}
      } else {
        try {
          const stored = typeof window !== "undefined" ? localStorage.getItem("goanow_email") : "";
          if (stored) setEmail(stored);
        } catch {}
      }
    }
  }, [open, initialPlan, prefillEmail]);

  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") {
        resolve(false);
        return;
      }
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      setScriptState("loading");
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", () => {
          setScriptState("ready");
          resolve(true);
        });
        existing.addEventListener("error", () => {
          setScriptState("error");
          resolve(false);
        });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      const timer = setTimeout(() => {
        setScriptState("error");
        resolve(false);
      }, 10000);
      script.onload = () => {
        clearTimeout(timer);
        setScriptState("ready");
        resolve(true);
      };
      script.onerror = () => {
        clearTimeout(timer);
        setScriptState("error");
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (open) loadRazorpayScript();
  }, [open, loadRazorpayScript]);

  if (!open) return null;

  const plan = plans[selected] || plans.week;

  const grantAccess = (planName, durationMs) => {
    localStorage.setItem("goanow_plan", planName);
    localStorage.setItem("goanow_expiry", String(Date.now() + durationMs));
    if (email && email.trim()) {
      try { localStorage.setItem("goanow_email", email.trim()); } catch {}
    }
    window.location.href = "/dashboard";
  };

  const isEmailValid = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

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
      if (data.success) {
        grantAccess(data.plan.name, data.plan.duration_ms);
      } else {
        setTrialError(data.error || "Invalid trial key");
      }
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

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) {
        setError("Payment not configured. Please contact support.");
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
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              grantAccess(plan.name, plan.duration_ms);
            } else {
              setError("Payment verification failed. Contact support.");
              setProcessing(false);
            }
          } catch {
            setError("Payment verification failed. Contact support.");
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
        prefill: isEmailValid(email) ? { email: email.trim() } : {},
        notes: { plan: plan.name },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
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
      onClick={(e) => {
        if (e.target === e.currentTarget && !processing) onClose?.();
      }}
    >
      <div
        className="glass-card animate-slideIn"
        style={{ width: "100%", maxWidth: 520, padding: 22, background: "linear-gradient(180deg,rgba(18,20,29,0.97),rgba(7,9,14,0.98))", border: "1px solid rgba(255,61,129,0.32)", boxShadow: "0 0 60px rgba(255,61,129,0.2)", position: "relative", maxHeight: "95vh", overflowY: "auto" }}
      >
        <button
          onClick={() => !processing && onClose?.()}
          aria-label="Close"
          style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-glass)", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: processing ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="x" size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span className="icon-tile">
            <Icon name="ticket" size={22} />
          </span>
          <div>
            <h2 style={{ fontSize: 34, margin: 0, color: "var(--neon-pink)", textShadow: "0 0 20px rgba(255,61,129,0.4)" }}>
              Unlock GoaNow
            </h2>
            <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 14 }}>
              One-time unlock. No subscription.
            </p>
          </div>
        </div>

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

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", color: "var(--text-muted)", fontSize: 12, marginBottom: 8, letterSpacing: "0.04em" }}>
            ✉️ Receipt + plan delivery
          </label>
          {prefillEmail ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: "rgba(0,200,140,0.08)",
              border: "1px solid rgba(0,200,140,0.3)",
              borderRadius: 11,
            }}>
              <span style={{ color: "#33D6C8", fontSize: 16 }}>✓</span>
              <span style={{ color: "#fff", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {email || prefillEmail}
              </span>
            </div>
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
              autoComplete="email"
            />
          )}
        </div>

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
                onChange={(e) => {
                  setTrialCode(e.target.value.toUpperCase());
                  setTrialError(null);
                }}
                placeholder="Enter trial key"
                className="input-field"
                style={{ flex: 1, textTransform: "uppercase", letterSpacing: "0.1em" }}
                autoFocus
              />
              <button type="submit" disabled={trialLoading || !trialCode.trim()} className="neon-btn-ghost" style={{ whiteSpace: "nowrap", padding: "0 14px" }}>
                {trialLoading ? "..." : "Apply"}
              </button>
            </form>
          )}

          {trialError && (
            <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 13 }}>{trialError}</div>
          )}
        </div>

        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 14, marginBottom: 0 }}>
          Secured by Razorpay | 256-bit encryption
        </p>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
