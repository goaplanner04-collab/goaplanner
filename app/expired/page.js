"use client";

import { useState } from "react";
import PaywallModal from "@/components/PaywallModal";

export default function ExpiredPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("week");

  const openModal = (plan) => {
    setInitialPlan(plan);
    setModalOpen(true);
  };

  const plans = [
    { key: "day", name: "Day Pass", price: 49, duration: "24 hours" },
    { key: "week", name: "Week Pass", price: 99, duration: "7 days", popular: true },
    { key: "trip", name: "Trip Pass", price: 149, duration: "30 days" }
  ];

  return (
    <main
      className="hero-gradient"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px"
      }}
    >
      <div style={{ maxWidth: 720, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 80, marginBottom: 12 }}>⏰</div>
        <h1
          style={{
            fontSize: "clamp(34px, 7vw, 56px)",
            color: "var(--neon-pink)",
            textShadow: "0 0 24px rgba(255,45,120,0.5)",
            margin: "0 0 12px"
          }}
        >
          Your GoaNow Pass Has Expired
        </h1>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 17,
            margin: "0 0 36px",
            lineHeight: 1.5
          }}
        >
          Still in Goa? You're missing out. Renew in seconds.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 28
          }}
        >
          {plans.map((p) => (
            <div
              key={p.key}
              className="glass-card"
              style={{
                padding: 22,
                textAlign: "center",
                border: p.popular ? "1.5px solid var(--neon-pink)" : "1px solid var(--border-glass)",
                boxShadow: p.popular ? "0 0 30px rgba(255,45,120,0.3)" : "none",
                position: "relative"
              }}
            >
              {p.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--neon-pink)",
                    color: "#fff",
                    padding: "3px 12px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em"
                  }}
                >
                  ★ POPULAR
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                {p.name.toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 48,
                  color: p.popular ? "var(--neon-pink)" : "#fff",
                  margin: "4px 0"
                }}
              >
                ₹{p.price}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
                {p.duration}
              </div>
              <button
                onClick={() => openModal(p.key)}
                className={p.popular ? "neon-btn" : "neon-btn-ghost"}
                style={{ width: "100%", fontSize: 14 }}
              >
                Renew →
              </button>
            </div>
          ))}
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Already paid? Contact us on Instagram{" "}
          <a
            href="https://instagram.com/goanow"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--neon-pink)", textShadow: "0 0 10px rgba(255,45,120,0.4)" }}
          >
            @goanow
          </a>
        </p>
      </div>

      <PaywallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlan={initialPlan}
      />
    </main>
  );
}
