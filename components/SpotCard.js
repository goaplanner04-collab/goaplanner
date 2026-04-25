"use client";

import Icon from "@/components/Icon";
import { formatDistance } from "@/lib/haversine";

const CATEGORY_ICON = {
  cafe: "coffee",
  restobar: "cocktail",
  seafood: "fish",
  beach: "waves",
  hidden_gem: "leaf",
  scooter_rental: "scooter",
};

function priceLabel(value) {
  const raw = String(value || "");
  const count = (raw.match(/Rs/g) || []).length;
  if (!count) return raw || "Price varies";
  return Array.from({ length: Math.min(count, 3) }, () => "Rs").join(" ");
}

export default function SpotCard({ spot, distanceKm }) {
  const icon = CATEGORY_ICON[spot.category] || "map-pin";
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
  const isScooter = spot.category === "scooter_rental";

  return (
    <div className="glass-card spot-card">
      <div className="card-header-row">
        <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }}>
          <span className="icon-tile" style={{ width: 42, height: 42 }}>
            <Icon name={icon} size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontFamily: "'Bebas Neue'",
                fontSize: 24,
                color: "#fff",
                lineHeight: 1.1,
              }}
            >
              {spot.name}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              <Icon name="map-pin" size={14} />
              {spot.area}
            </div>
          </div>
        </div>

        {distanceKm != null && (
          <span className="badge badge-cyan">
            <Icon name="compass" size={14} />
            {formatDistance(distanceKm)}
          </span>
        )}
      </div>

      <div className="card-meta-row" style={{ fontSize: 13 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--neon-gold)" }}>
          <Icon name="star" size={14} />
          {spot.rating}
          <span style={{ color: "var(--text-muted)" }}>({spot.reviews})</span>
        </span>
        <span className="badge badge-grey">{priceLabel(spot.priceRange)}</span>
        {spot.openNow ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4ade80" }}>
            <span className="pulse-dot green" style={{ width: 7, height: 7 }} />
            Open Now
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
            <Icon name="clock" size={14} />
            Closed
          </span>
        )}
      </div>

      <p style={{ color: "var(--text-primary)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
        {spot.description}
      </p>

      {isScooter && (
        <div className="tip-box" style={{ display: "flex", gap: 8 }}>
          <Icon name="scooter" size={17} style={{ color: "var(--neon-gold)", marginTop: 2 }} />
          <span>
            <strong>GoaNow Tip:</strong> Prices vary by area and season. Check the bike before taking it and negotiate weekly rates.
          </span>
        </div>
      )}

      <div className="card-actions">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neon-btn mobile-full"
          style={{ flex: isScooter ? 1 : "0 1 auto", minWidth: 150, textAlign: "center", padding: "10px 14px", fontSize: 14 }}
        >
          <Icon name="directions" size={17} />
          Directions
        </a>
        {isScooter && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Hi, I want to rent a scooter from ${spot.name} (${spot.area}, Goa).`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="neon-btn-ghost mobile-full"
            style={{ flex: 1, minWidth: 150, textAlign: "center", padding: "10px 14px", fontSize: 14 }}
          >
            <Icon name="phone" size={17} />
            Call / WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
