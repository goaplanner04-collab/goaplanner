"use client";

import { useEffect, useState } from "react";

export default function Navbar({ showPlanBadge = false }) {
  const [planInfo, setPlanInfo] = useState(null);

  useEffect(() => {
    if (!showPlanBadge) return;
    if (typeof window === "undefined") return;

    const update = () => {
      const plan = localStorage.getItem("goanow_plan");
      const expiry = parseInt(localStorage.getItem("goanow_expiry") || "0", 10);
      if (!plan || !expiry) {
        setPlanInfo(null);
        return;
      }
      const msLeft = expiry - Date.now();
      if (msLeft <= 0) {
        setPlanInfo({ plan, expired: true, label: "Expired" });
        return;
      }
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
      const label =
        daysLeft > 1
          ? `${daysLeft} days left`
          : hoursLeft > 1
          ? `${hoursLeft} hrs left`
          : `${Math.max(1, Math.round(msLeft / 60000))} min left`;
      setPlanInfo({ plan, expired: false, label });
    };

    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [showPlanBadge]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(10, 10, 15, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-glass)"
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            letterSpacing: "0.08em",
            color: "var(--neon-pink)",
            textShadow: "0 0 16px rgba(255, 45, 120, 0.6)"
          }}
        >
          GoaNow 🔥
        </a>

        {showPlanBadge && planInfo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(255, 45, 120, 0.12)",
              border: "1px solid rgba(255, 45, 120, 0.3)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500
            }}
          >
            <span className="pulse-dot" style={{ width: 6, height: 6 }} />
            <span>{planInfo.plan}</span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span style={{ color: planInfo.expired ? "#f87171" : "var(--neon-cyan)" }}>
              {planInfo.label}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
