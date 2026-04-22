"use client";

import { useEffect, useState, useCallback } from "react";

const PLANS = {
  day: {
    key: "day",
    name: "Day Pass",
    price: 49,
    paise: 4900,
    duration: 24 * 60 * 60 * 1000,
    durationLabel: "24 hours"
  },
  week: {
    key: "week",
    name: "Week Pass",
    price: 99,
    paise: 9900,
    duration: 7 * 24 * 60 * 60 * 1000,
    durationLabel: "7 days",
    popular: true
  },
  trip: {
    key: "trip",
    name: "Trip Pass",
    price: 149,
    paise: 14900,
    duration: 30 * 24 * 60 * 60 * 1000,
    durationLabel: "30 days"
  }
};

export default function PaywallModal({ open, onClose, initialPlan = "week" }) {
  const [selected, setSelected] = useState(initialPlan);
  const [scriptState, setScriptState] = useState("idle"); // idle | loading | ready | error
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSelected(initialPlan);
      setError(null);
    }
  }, [open, initialPlan]);

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
      const existing = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );
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
    if (open) {
      loadRazorpayScript();
    }
  }, [open, loadRazorpayScript]);

  if (!open) return null;

  const plan = PLANS[selected] || PLANS.week;

  const handlePay = async () => {
    setError(null);
    setProcessing(true);
    try {
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) {
        setError(
          "Payment failed to load. Please check your connection and try again."
        );
        setProcessing(false);
        return;
      }

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: plan.paise, plan: plan.name })
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
        theme: { color: "#FF2D78" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              localStorage.setItem("goanow_plan", plan.name);
              localStorage.setItem(
                "goanow_expiry",
                String(Date.now() + plan.duration)
              );
              window.location.href = "/dashboard";
            } else {
              setError("Payment verification failed. Contact support.");
              setProcessing(false);
            }
          } catch (e) {
            setError("Payment verification failed. Contact support.");
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setProcessing(false)
        },
        prefill: {},
        notes: { plan: plan.name }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
        setProcessing(false);
      });
      rzp.open();
    } catch (e) {
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
    : `Pay ₹${plan.price} — UPI / Card / Netbanking`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !processing) onClose && onClose();
      }}
    >
      <div
        className="glass-card animate-slideIn"
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 24,
          background: "linear-gradient(180deg, rgba(20,20,30,0.95), rgba(10,10,15,0.98))",
          border: "1px solid rgba(255, 45, 120, 0.3)",
          boxShadow: "0 0 60px rgba(255, 45, 120, 0.25)",
          position: "relative",
          maxHeight: "95vh",
          overflowY: "auto"
        }}
      >
        <button
          onClick={() => !processing && onClose && onClose()}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border-glass)",
            color: "#fff",
            width: 36,
            height: 36,
            borderRadius: "50%",
            cursor: processing ? "not-allowed" : "pointer",
            fontSize: 18
          }}
        >
          ×
        </button>

        <h2
          style={{
            fontSize: 34,
            margin: "4px 0 4px",
            color: "var(--neon-pink)",
            textShadow: "0 0 20px rgba(255,45,120,0.5)"
          }}
        >
          UNLOCK GOANOW
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "0 0 20px", fontSize: 14 }}>
          One-time unlock. No subscription. No spam.
        </p>

        {/* Plan selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 20
          }}
        >
          {Object.values(PLANS).map((p) => {
            const active = selected === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setSelected(p.key)}
                style={{
                  background: active
                    ? "linear-gradient(135deg, rgba(255,45,120,0.2), rgba(255,45,120,0.08))"
                    : "rgba(255,255,255,0.03)",
                  border: active
                    ? "1.5px solid var(--neon-pink)"
                    : "1px solid var(--border-glass)",
                  borderRadius: 14,
                  padding: "14px 8px",
                  cursor: "pointer",
                  color: "#fff",
                  transition: "all 0.2s ease",
                  position: "relative",
                  boxShadow: active && p.popular
                    ? "0 0 24px rgba(255,45,120,0.4)"
                    : "none"
                }}
              >
                {p.popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "var(--neon-pink)",
                      color: "#fff",
                      fontSize: 9,
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 700,
                      letterSpacing: "0.05em"
                    }}
                  >
                    POPULAR
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {p.name}
                </div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, margin: "4px 0" }}>
                  ₹{p.price}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {p.durationLabel}
                </div>
              </button>
            );
          })}
        </div>

        {/* Benefits */}
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 20px",
            fontSize: 14,
            lineHeight: 1.7
          }}
        >
          {[
            "Nearest cafes & restobars by real GPS distance",
            "Live party & event feed with real crowd arrival times",
            "AI itinerary tailored to your exact vibe and budget",
            "Water sports, casinos, hidden gems — real pricing",
            "Works across all of Goa — Morjim to Palolem"
          ].map((b) => (
            <li key={b} style={{ display: "flex", gap: 10, alignItems: "start" }}>
              <span style={{ color: "var(--neon-cyan)", fontWeight: 700 }}>✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#fca5a5",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 12
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={processing || scriptState === "loading"}
          className="neon-btn"
          style={{ width: "100%", fontSize: 16 }}
        >
          {(processing || scriptState === "loading") && (
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite"
              }}
            />
          )}
          {btnLabel}
        </button>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginTop: 14,
            flexWrap: "wrap"
          }}
        >
          {["UPI", "Visa", "Mastercard", "RuPay"].map((pay) => (
            <span
              key={pay}
              style={{
                fontSize: 10,
                padding: "4px 10px",
                border: "1px solid var(--border-glass)",
                borderRadius: 6,
                color: "var(--text-muted)",
                letterSpacing: "0.05em"
              }}
            >
              {pay}
            </span>
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 12,
            marginTop: 14,
            marginBottom: 0
          }}
        >
          Secured by Razorpay · 256-bit encryption
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
