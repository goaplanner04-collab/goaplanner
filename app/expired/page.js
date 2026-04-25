"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import PaywallModal from "@/components/PaywallModal";

const PLANS = [
  { key: "day", name: "Day Pass", price: 49, duration: "24 hours" },
  { key: "week", name: "Week Pass", price: 99, duration: "7 days", popular: true },
  { key: "trip", name: "Trip Pass", price: 149, duration: "30 days" },
];

export default function ExpiredPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("week");

  const openModal = (plan) => {
    setInitialPlan(plan);
    setModalOpen(true);
  };

  return (
    <main className="site-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 18px" }}>
      <div style={{ maxWidth: 760, width: "100%", textAlign: "center" }}>
        <span className="icon-tile" style={{ width: 62, height: 62, marginBottom: 16 }}>
          <Icon name="clock" size={30} />
        </span>
        <h1 style={{ fontSize: 48, lineHeight: 1, color: "var(--neon-pink)", textShadow: "0 0 24px rgba(255,45,120,0.36)", margin: "0 0 12px" }}>
          Your GoaNow Pass Has Expired
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 17, margin: "0 0 34px", lineHeight: 1.5 }}>
          Still in Goa? Renew in seconds and keep your plans moving.
        </p>

        <div className="pricing-grid" style={{ marginBottom: 28 }}>
          {PLANS.map((plan) => (
            <div key={plan.key} className={`glass-card plan-card ${plan.popular ? "is-popular" : ""}`} style={{ textAlign: "left" }}>
              {plan.popular && (
                <span className="badge badge-pink" style={{ alignSelf: "flex-start" }}>
                  <Icon name="star" size={14} />
                  Popular
                </span>
              )}
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {plan.name}
                </div>
                <div className="plan-price" style={{ color: plan.popular ? "var(--neon-pink)" : "#fff" }}>
                  Rs {plan.price}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{plan.duration}</div>
              </div>
              <button onClick={() => openModal(plan.key)} className={plan.popular ? "neon-btn" : "neon-btn-ghost"} style={{ width: "100%" }}>
                <Icon name="ticket" size={17} />
                Renew
              </button>
            </div>
          ))}
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Already paid? Contact us on Instagram{" "}
          <a href="https://instagram.com/goanow" target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-pink)", textShadow: "0 0 10px rgba(255,45,120,0.3)" }}>
            @goanow
          </a>
        </p>
      </div>

      <PaywallModal open={modalOpen} onClose={() => setModalOpen(false)} initialPlan={initialPlan} />
    </main>
  );
}
