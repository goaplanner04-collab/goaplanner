"use client";

import { useEffect, useState } from "react";
import PaywallModal from "@/components/PaywallModal";

const DEFAULT_PRICES = { day: 49, week: 8, trip: 149 };

export default function TrialPaywall() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("day");
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  // Pull live pricing from settings (matches the rest of the site)
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d?.pricing) {
          const next = { ...DEFAULT_PRICES };
          ["day", "week", "trip"].forEach((k) => {
            if (typeof d.pricing[k]?.price === "number") next[k] = d.pricing[k].price;
          });
          setPrices(next);
        }
      })
      .catch(() => {});
  }, []);

  // Mark that an unlock attempt is in progress so the dashboard can show
  // the success toast after Razorpay redirects back.
  const open = (plan) => {
    try { sessionStorage.setItem("goanow_pending_unlock", "1"); } catch {}
    setInitialPlan(plan);
    setModalOpen(true);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8ED",
          borderRadius: 20,
          padding: "32px 24px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 12px 40px rgba(0,119,168,0.15)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 16, lineHeight: 1 }}>⏰</div>

        <h2
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            fontSize: 28,
            color: "#1B3A5C",
            lineHeight: 1.15,
            letterSpacing: -0.01,
            margin: "0 0 10px",
          }}
        >
          Your 10 minutes are up.
        </h2>

        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            color: "#6B7E8F",
            lineHeight: 1.6,
            margin: "0 auto 24px",
            maxWidth: 300,
          }}
        >
          You&apos;ve seen what GoaNow can do. Keep exploring for just ₹{prices.day} today.
        </p>

        <div style={{ borderTop: "1px solid #E2E8ED", marginBottom: 22 }} />

        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: 11,
            color: "#00B4C6",
            letterSpacing: 2.5,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Full access today
        </div>

        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            fontSize: 56,
            color: "#1B3A5C",
            lineHeight: 1,
          }}
        >
          ₹{prices.day}
        </div>

        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "#6B7E8F",
            marginTop: 4,
            marginBottom: 22,
          }}
        >
          for 24 hours · one-time · no subscription
        </div>

        <button
          onClick={() => open("day")}
          className="gn-trial-pay-btn"
          style={{
            width: "100%",
            height: 54,
            background: "#00B4C6",
            border: "none",
            borderRadius: 12,
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 16,
            color: "#FFFFFF",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,180,198,0.35)",
            transition: "all 0.18s ease",
            marginBottom: 12,
          }}
        >
          Unlock for ₹{prices.day} →
        </button>

        <div
          style={{
            marginTop: 4,
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "#6B7E8F",
          }}
        >
          Or:{" "}
          <button
            type="button"
            onClick={() => open("week")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "#0077A8",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            ₹{prices.week} for a week
          </button>
          {" · "}
          <button
            type="button"
            onClick={() => open("trip")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "#0077A8",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            ₹{prices.trip} for a month
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "#6B7E8F",
          }}
        >
          🔒 Razorpay · UPI · Card · Netbanking
        </div>
      </div>

      {/* Reuse the existing PaywallModal — autoAdvance skips plan/auth steps
          for users who are already signed in (which is everyone hitting this
          screen, since the trial only starts after Google sign-in). */}
      <PaywallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlan={initialPlan}
        autoAdvance={true}
      />

      <style jsx>{`
        .gn-trial-pay-btn:active {
          transform: scale(0.98);
        }
        .gn-trial-pay-btn:hover {
          background: #009DB5;
          box-shadow: 0 6px 20px rgba(0,180,198,0.45);
        }
      `}</style>
    </div>
  );
}
