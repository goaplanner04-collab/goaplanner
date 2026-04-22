"use client";

import { useState } from "react";
import PaywallModal from "@/components/PaywallModal";

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("week");

  const openModal = (plan) => {
    setInitialPlan(plan);
    setModalOpen(true);
  };

  const features = [
    {
      icon: "📍",
      title: "Nearby Cafes & Restobars",
      desc: "Sorted by YOUR location, not Google's algorithm"
    },
    {
      icon: "🎉",
      title: "Live Party Intel",
      desc: "Tonight's events, entry fees, real crowd times — updated daily"
    },
    {
      icon: "🗺️",
      title: "AI Itinerary Builder",
      desc: "Tell us your vibe and budget. Get a full Goa plan in 10 seconds."
    }
  ];

  const plans = [
    { key: "day", name: "Day Pass", price: 49, duration: "24 hours" },
    { key: "week", name: "Week Pass", price: 99, duration: "7 days", popular: true },
    { key: "trip", name: "Trip Pass", price: 149, duration: "30 days" }
  ];

  return (
    <main
      className="hero-gradient"
      style={{ minHeight: "100vh", color: "#fff" }}
    >
      {/* HERO */}
      <section
        style={{
          padding: "60px 20px 50px",
          textAlign: "center",
          maxWidth: 1100,
          margin: "0 auto"
        }}
      >
        <h1
          style={{
            fontSize: "clamp(48px, 12vw, 96px)",
            margin: 0,
            color: "var(--neon-pink)",
            textShadow: "0 0 32px rgba(255,45,120,0.6), 0 0 64px rgba(255,45,120,0.3)",
            lineHeight: 1
          }}
          className="animate-fadeUp"
        >
          GoaNow 🔥
        </h1>
        <h2
          style={{
            fontSize: "clamp(20px, 5vw, 36px)",
            margin: "16px 0 8px",
            color: "#fff",
            fontWeight: 400,
            letterSpacing: "0.02em"
          }}
        >
          Know what's happening in Goa. Right now.
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            margin: "0 auto",
            fontSize: "clamp(14px, 3.5vw, 18px)",
            maxWidth: 640,
            lineHeight: 1.5,
            fontFamily: "'Inter', sans-serif"
          }}
        >
          Cafes sorted by your real distance. Live party intel. AI-built itineraries.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginTop: 32,
            flexWrap: "wrap"
          }}
        >
          <button onClick={() => openModal("week")} className="neon-btn" style={{ fontSize: 16 }}>
            Get Access for ₹99 →
          </button>
          <a href="#pricing" className="neon-btn-ghost">
            See plans
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section
        style={{
          padding: "20px 20px 60px",
          maxWidth: 1100,
          margin: "0 auto"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18
          }}
        >
          {features.map((f) => (
            <div key={f.title} className="glass-card" style={{ padding: 24 }}>
              <div style={{ fontSize: 38 }}>{f.icon}</div>
              <h3
                style={{
                  margin: "12px 0 8px",
                  fontSize: 24,
                  color: "#fff",
                  letterSpacing: "0.04em"
                }}
              >
                {f.title}
              </h3>
              <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        style={{
          padding: "40px 20px 80px",
          maxWidth: 1100,
          margin: "0 auto"
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(32px, 7vw, 52px)",
            margin: "0 0 8px",
            color: "var(--neon-cyan)",
            textShadow: "0 0 20px rgba(0,245,255,0.4)"
          }}
        >
          Pick Your Pass
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", margin: "0 0 36px" }}>
          One-time unlock. No subscription. No spam.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 18,
            alignItems: "center"
          }}
        >
          {plans.map((p) => (
            <div
              key={p.key}
              className="glass-card"
              style={{
                padding: 28,
                textAlign: "center",
                position: "relative",
                transform: p.popular ? "scale(1.04)" : "scale(1)",
                border: p.popular
                  ? "1.5px solid var(--neon-pink)"
                  : "1px solid var(--border-glass)",
                boxShadow: p.popular ? "0 0 40px rgba(255,45,120,0.35)" : "none"
              }}
            >
              {p.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--neon-pink)",
                    color: "#fff",
                    padding: "4px 14px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    boxShadow: "0 0 16px rgba(255,45,120,0.6)"
                  }}
                >
                  ★ MOST POPULAR
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 6
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 64,
                  letterSpacing: "0.02em",
                  color: p.popular ? "var(--neon-pink)" : "#fff",
                  textShadow: p.popular ? "0 0 20px rgba(255,45,120,0.5)" : "none",
                  lineHeight: 1
                }}
              >
                ₹{p.price}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 14, margin: "6px 0 20px" }}>
                {p.duration}
              </div>
              <button
                onClick={() => openModal(p.key)}
                className={p.popular ? "neon-btn" : "neon-btn-ghost"}
                style={{ width: "100%", fontSize: 15 }}
              >
                Get Access →
              </button>
            </div>
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            margin: "32px auto 0",
            maxWidth: 600,
            fontSize: 14,
            lineHeight: 1.6
          }}
        >
          One bad party in Goa costs ₹500 entry + ₹300 auto + a ruined night.
          GoaNow costs ₹99 for your whole trip.
        </p>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          padding: "30px 20px",
          textAlign: "center",
          borderTop: "1px solid var(--border-glass)",
          color: "var(--text-muted)",
          fontSize: 13
        }}
      >
        Made with 🔥 for travelers in Goa · GoaNow © 2025
      </footer>

      <PaywallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlan={initialPlan}
      />
    </main>
  );
}
