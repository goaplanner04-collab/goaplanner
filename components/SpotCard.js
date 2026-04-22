"use client";

import { CATEGORY_EMOJI } from "@/lib/spotsData";
import { formatDistance } from "@/lib/haversine";

export default function SpotCard({ spot, distanceKm }) {
  const emoji = CATEGORY_EMOJI[spot.category] || "📍";
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
  const isScooter = spot.category === "scooter_rental";

  return (
    <div
      className="glass-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22 }}>{emoji}</span>
            <h3
              style={{
                margin: 0,
                fontFamily: "'Bebas Neue'",
                fontSize: 22,
                letterSpacing: "0.03em",
                color: "#fff"
              }}
            >
              {spot.name}
            </h3>
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
            📍 {spot.area}
          </div>
        </div>

        {distanceKm != null && (
          <span className="badge badge-cyan">
            {formatDistance(distanceKm)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
        <span style={{ color: "var(--neon-gold)" }}>
          ★ {spot.rating}
          <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
            ({spot.reviews})
          </span>
        </span>
        <span style={{ color: "var(--text-muted)" }}>•</span>
        <span style={{ color: "#fff" }}>{spot.priceRange}</span>
        <span style={{ color: "var(--text-muted)" }}>•</span>
        {spot.openNow ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4ade80" }}>
            <span className="pulse-dot green" style={{ width: 7, height: 7 }} />
            Open Now
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>● Closed</span>
        )}
      </div>

      <p style={{ color: "var(--text-primary)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
        {spot.description}
      </p>

      {isScooter && (
        <div className="tip-box">
          🗣️ <strong>GoaNow Tip:</strong> Prices vary ₹300–500/day depending on area and season.
          Always check the bike thoroughly before taking it. Negotiate for weekly rates.
        </div>
      )}

      {isScooter ? (
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="neon-btn"
            style={{ flex: 1, minWidth: 140, textAlign: "center", padding: "10px 14px", fontSize: 14 }}
          >
            📍 Get Directions
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Hi, I want to rent a scooter from ${spot.name} (${spot.area}, Goa).`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="neon-btn-ghost"
            style={{
              flex: 1,
              minWidth: 140,
              textAlign: "center",
              padding: "10px 14px",
              fontSize: 14
            }}
          >
            📞 Call / WhatsApp
          </a>
        </div>
      ) : (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neon-btn"
          style={{ textAlign: "center", padding: "10px 14px", fontSize: 14, marginTop: 4 }}
        >
          Get Directions →
        </a>
      )}
    </div>
  );
}
