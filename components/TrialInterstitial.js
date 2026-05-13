"use client";

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
        background: "#FFFFFF",
        color: "#1B3A5C",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <img
        src="/logo.png"
        alt="GoaNow"
        style={{ height: 56, width: "auto", marginBottom: 28 }}
      />

      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: 14,
          color: "#6B7E8F",
          marginBottom: 8,
        }}
      >
        Welcome to GoaNow
      </div>

      <h1
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 800,
          fontSize: 32,
          color: "#1B3A5C",
          lineHeight: 1.15,
          letterSpacing: -0.01,
          margin: "0 0 8px",
          maxWidth: 320,
        }}
      >
        How do you want to get started?
      </h1>

      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
          color: "#6B7E8F",
          lineHeight: 1.6,
          margin: "0 auto 32px",
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
          background: "#00B4C6",
          border: "none",
          borderRadius: 14,
          padding: "20px 22px",
          cursor: "pointer",
          textAlign: "left",
          color: "#FFFFFF",
          boxShadow: "0 4px 16px rgba(0,180,198,0.35)",
          transition: "all 0.18s ease",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 17, color: "#FFFFFF" }}>
              Try Free for 10 mins
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
              Full access — no payment needed
            </div>
          </div>
          <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>⏱</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {["📍 Nearby spots", "🎉 Party feed", "🗺️ AI itinerary"].map((t) => (
            <span
              key={t}
              style={{
                background: "rgba(255,255,255,0.18)",
                borderRadius: 20,
                padding: "4px 10px",
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "#FFFFFF",
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
          background: "#FFFFFF",
          border: "1px solid #E2E8ED",
          borderRadius: 14,
          padding: "18px 22px",
          cursor: "pointer",
          textAlign: "left",
          color: "#1B3A5C",
          transition: "all 0.18s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 15, color: "#1B3A5C" }}>
              No, buy access now
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#6B7E8F", marginTop: 4 }}>
              ₹8 for today · ₹21 for a week
            </div>
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 20, color: "#6B7E8F" }}>
            →
          </div>
        </div>
      </button>

      <div style={{ marginTop: 20, fontFamily: "Inter, sans-serif", fontSize: 11, color: "#6B7E8F" }}>
        Trial is 10 minutes. No card required.
      </div>

      <style jsx>{`
        .gn-int-trial-btn:active,
        .gn-int-buy-btn:active {
          transform: scale(0.98);
        }
        .gn-int-trial-btn:hover {
          background: #009DB5;
          box-shadow: 0 6px 20px rgba(0,180,198,0.45);
        }
        .gn-int-buy-btn:hover {
          border-color: #00B4C6;
          color: #00B4C6;
        }
      `}</style>
    </main>
  );
}
