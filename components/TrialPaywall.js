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
        background: "rgba(8, 8, 12, 0.98)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      <div
        style={{
          background: "#111119",
          border: "1px solid rgba(255,45,120,0.2)",
          borderRadius: 24,
          padding: "36px 24px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 0 80px rgba(255,45,120,0.07), 0 40px 80px rgba(0,0,0,0.4)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 20, lineHeight: 1 }}>⏰</div>

        <h2
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 40,
            color: "#fff",
            lineHeight: 1,
            letterSpacing: 1,
            margin: "0 0 12px",
          }}
        >
          YOUR 10 MINUTES
          <br />
          ARE UP.
        </h2>

        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 15,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.6,
            margin: "0 auto 28px",
            maxWidth: 300,
          }}
        >
          You've seen what GoaNow can do. Keep exploring for just Rs {prices.day} today.
        </p>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 28 }} />

        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          FULL ACCESS TODAY
        </div>

        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 80,
            color: "#FF2D78",
            lineHeight: 1,
            textShadow: "0 0 40px rgba(255,45,120,0.4)",
          }}
        >
          Rs {prices.day}
        </div>

        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            color: "rgba(255,255,255,0.5)",
            marginTop: 4,
            marginBottom: 24,
          }}
        >
          for 24 hours · one-time · no subscription
        </div>

        <button
          onClick={() => open("day")}
          className="gn-trial-pay-btn"
          style={{
            width: "100%",
            height: 58,
            background: "#FF2D78",
            border: "none",
            borderRadius: 14,
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: "#fff",
            cursor: "pointer",
            boxShadow: "0 0 32px rgba(255,45,120,0.5), 0 4px 20px rgba(255,45,120,0.3)",
            transition: "all 0.18s ease",
            marginBottom: 12,
          }}
        >
          Unlock for Rs {prices.day} →
        </button>

        <div
          style={{
            marginTop: 4,
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
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
              color: "rgba(255,255,255,0.5)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Rs {prices.week} for a week
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
              color: "rgba(255,255,255,0.5)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Rs {prices.trip} for a month
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.25)",
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
      `}</style>
    </div>
  );
}
