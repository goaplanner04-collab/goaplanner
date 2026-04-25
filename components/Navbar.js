"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

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
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [showPlanBadge]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(7, 9, 14, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-glass)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <a href="/" className="brand-mark" style={{ fontSize: 14 }}>
          <span className="app-icon" style={{ width: 34, height: 34 }}>
            <Icon name="sun" size={18} />
          </span>
          GoaNow
        </a>

        {showPlanBadge && planInfo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(255, 61, 129, 0.12)",
              border: "1px solid rgba(255, 61, 129, 0.3)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <span className="pulse-dot" style={{ width: 6, height: 6 }} />
            <span>{planInfo.plan}</span>
            <span style={{ color: "var(--text-muted)" }}>|</span>
            <span style={{ color: planInfo.expired ? "#f87171" : "var(--neon-cyan)" }}>
              {planInfo.label}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
