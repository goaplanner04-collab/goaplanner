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

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {trialMs !== null && (
            <div
              className={trialUrgent ? "gn-trial-pill gn-trial-urgent" : "gn-trial-pill"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.06)",
                border: trialUrgent ? "1px solid rgba(255,68,68,0.3)" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: "5px 12px",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: trialUrgent ? "#FF4444" : "#00F5FF",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  color: trialUrgent ? "#FF6B6B" : "#fff",
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
