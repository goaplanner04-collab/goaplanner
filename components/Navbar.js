"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import GoogleSignIn from "@/components/GoogleSignIn";
import { getTrialStatus, formatCountdown } from "@/lib/trialUtils";

export default function Navbar({ showPlanBadge = false }) {
  const [planInfo, setPlanInfo] = useState(null);
  const [trialMs, setTrialMs] = useState(null);

  // Plan badge (paid users)
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

  // Trial countdown — ticks every second
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = () => {
      const status = getTrialStatus();
      if (status.active) setTrialMs(status.remainingMs);
      else setTrialMs(null);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const trialUrgent = trialMs !== null && trialMs <= 2 * 60 * 1000;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#FFFFFF",
        borderBottom: "1px solid var(--border-glass)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
          <img src="/logo.png" alt="GoaNow" style={{ height: 36, width: "auto", display: "block" }} />
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {trialMs !== null && (
            <div
              className={trialUrgent ? "gn-trial-pill gn-trial-urgent" : "gn-trial-pill"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: trialUrgent ? "rgba(239,68,68,0.08)" : "rgba(0,180,198,0.08)",
                border: trialUrgent ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(0,180,198,0.25)",
                borderRadius: 20,
                padding: "5px 12px",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: trialUrgent ? "#EF4444" : "var(--neon-pink)",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  color: trialUrgent ? "#B91C1C" : "var(--neon-pink)",
                }}
              >
                {formatCountdown(trialMs)} free
              </span>
            </div>
          )}

          {showPlanBadge && planInfo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(0, 180, 198, 0.08)",
                border: "1px solid rgba(0, 180, 198, 0.25)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <span className="pulse-dot" style={{ width: 6, height: 6 }} />
              <span>{planInfo.plan}</span>
              <span style={{ color: "var(--text-muted)" }}>|</span>
              <span style={{ color: planInfo.expired ? "#DC2626" : "var(--neon-cyan)" }}>
                {planInfo.label}
              </span>
            </div>
          )}
          <GoogleSignIn
            compact
            onUser={(u) => {
              if (u?.email) {
                try { localStorage.setItem("goanow_email", u.email); } catch {}
              }
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes urgentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .gn-trial-urgent {
          animation: urgentPulse 1s infinite;
        }
      `}</style>
    </header>
  );
}
