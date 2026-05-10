"use client";

import Icon from "@/components/Icon";

export default function TrialInterstitial({ onTrialStart, onBuyNow }) {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        background:
          "radial-gradient(ellipse at 50% 60%, rgba(255,45,120,0.10) 0%, transparent 60%), #0A0A0F",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Logo + brand */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <span className="brand-mark__icon"><Icon name="sun" size={20} /></span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#fff", letterSpacing: 4 }}>
          GOANOW
        </span>
      </div>

      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
        Welcome to GoaNow
      </div>

      <h1
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 44,
          color: "#fff",
          lineHeight: 1,
          letterSpacing: 1,
          margin: "0 0 6px",
        }}
      >
        HOW DO YOU WANT
        <br />
        TO GET STARTED?
      </h1>

      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.6,
          margin: "0 auto 36px",
          maxWidth: 300,
        }}
      >
        Explore the full platform free for 10 minutes, or unlock immediately.
      </p>

      {/* OPTION A — TRIAL */}
      <button
        onClick={onTrialStart}
        className="gn-int-trial-btn"
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#FF2D78",
          border: "none",
          borderRadius: 16,
          padding: "20px 24px",
          cursor: "pointer",
          textAlign: "left",
          color: "#fff",
          boxShadow: "0 0 32px rgba(255,45,120,0.35), 0 4px 20px rgba(255,45,120,0.2)",
          transition: "all 0.18s ease",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>
              Try Free for 10 mins
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              Full access — no payment needed
            </div>
          </div>
          <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>⏱</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {["📍 Nearby spots", "🎉 Party feed", "🗺️ AI itinerary"].map((t) => (
            <span
              key={t}
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: "4px 10px",
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "#fff",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </button>

      {/* OPTION B — BUY NOW */}
      <button
        onClick={onBuyNow}
        className="gn-int-buy-btn"
        style={{
          width: "100%",
          maxWidth: 360,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "18px 24px",
          cursor: "pointer",
          textAlign: "left",
          color: "#fff",
          transition: "all 0.18s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16, color: "#fff" }}>
              No, buy access now
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              Rs 8 for today · Rs 21 for a week
            </div>
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 20, color: "rgba(255,255,255,0.4)" }}>
            →
          </div>
        </div>
      </button>

      <div style={{ marginTop: 20, fontFamily: "Inter, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
        Trial is 10 minutes. No card required.
      </div>

      <style jsx>{`
        .gn-int-trial-btn:active,
        .gn-int-buy-btn:active {
          transform: scale(0.98);
        }
        .gn-int-buy-btn:hover {
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.06);
        }
      `}</style>
    </main>
  );
}
