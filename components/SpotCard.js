"use client";

import Icon from "@/components/Icon";
import HotelCard from "@/components/HotelCard";
import { formatDistance } from "@/lib/haversine";

const CATEGORY_ICON = {
  featured: "sparkles",
  rentals: "scooter",
  stay: "map-pin",
  breakfast_cafes: "coffee",
  beaches: "waves",
  tourist_spots: "map-pin",
  water_sports: "waves",
  restobars: "cocktail",
  seafood: "fish",
  hidden_gems: "leaf",
  // legacy keys
  cafe: "coffee",
  restobar: "cocktail",
  seafood_legacy: "fish",
  beach: "waves",
  hidden_gem: "leaf",
  scooter_rental: "scooter",
};

function getWaterSportInfo(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("scuba")) return { label: "🤿 Scuba Diving", price: "Est. ₹3,500–5,000/person" };
  if (lower.includes("parasail")) return { label: "🪂 Parasailing", price: "Est. ₹1,500/person" };
  if (lower.includes("jet ski") || lower.includes("jetski")) return { label: "🚤 Jet Ski", price: "Est. ₹500–700 / 15 mins" };
  return { label: "🌊 Water Sports", price: "Est. ₹700–1,500/person" };
}

function getTouristSpotType(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("church") || lower.includes("chapel") || lower.includes("cathedral")) return "⛪ Church";
  if (lower.includes("temple") || lower.includes("mandir") || lower.includes("devi")) return "🛕 Temple";
  if (lower.includes("fort") || lower.includes("fortress")) return "🏰 Fort";
  if (lower.includes("trek") || lower.includes("viewpoint") || lower.includes("view point")) return "🥾 Trek / Viewpoint";
  if (lower.includes("waterfall") || lower.includes("falls")) return "💧 Waterfall";
  if (lower.includes("museum") || lower.includes("gallery")) return "🏛️ Museum";
  return "📍 Attraction";
}

function getBeachIndicator(rating) {
  if (rating >= 4.7) return { dot: "🟢", label: "Quiet & clean" };
  if (rating >= 4.3) return { dot: "🟡", label: "Moderately busy" };
  return { dot: "🔴", label: "Can get crowded" };
}

export default function SpotCard({ spot, distanceKm }) {
  if (spot.category === "stay") {
    return <HotelCard hotel={spot} stayType="hotel" />;
  }

  const icon = CATEGORY_ICON[spot.category] || "map-pin";
  const mapsUrl = spot.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
  const isRental = spot.category === "rentals" || spot.category === "scooter_rental";
  const isWaterSports = spot.category === "water_sports";
  const isTouristSpot = spot.category === "tourist_spots";
  const isBeach = spot.category === "beaches" || spot.category === "beach";
  const photo = Array.isArray(spot.photos) && spot.photos.length > 0 ? spot.photos[0] : null;

  const waterInfo = isWaterSports ? getWaterSportInfo(spot.name) : null;
  const touristType = isTouristSpot ? getTouristSpotType(spot.name) : null;
  const beachIndicator = isBeach ? getBeachIndicator(Number(spot.rating) || 0) : null;

  return (
    <div className="glass-card spot-card">
      {photo && (
        <div style={{
          height: 180,
          marginTop: -16,
          marginLeft: -16,
          marginRight: -16,
          marginBottom: 12,
          width: "calc(100% + 32px)",
          backgroundImage: `url(${photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(7,9,14,0) 50%, rgba(7,9,14,0.55) 100%)",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }} />
        </div>
      )}

      <div className="card-header-row">
        <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }}>
          <span className="icon-tile" style={{ width: 42, height: 42, flexShrink: 0 }}>
            <Icon name={icon} size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              margin: 0,
              fontFamily: "'Bebas Neue'",
              fontSize: 24,
              color: "#fff",
              lineHeight: 1.1,
            }}>
              {spot.name}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginTop: 4, flexWrap: "wrap" }}>
              <Icon name="map-pin" size={14} />
              {spot.area}
              {isTouristSpot && touristType && (
                <span style={{
                  background: "rgba(139,92,246,0.15)",
                  color: "#a78bfa",
                  border: "1px solid rgba(139,92,246,0.3)",
                  borderRadius: 20,
                  padding: "1px 8px",
                  fontSize: 11,
                  fontWeight: 500,
                }}>
                  {touristType}
                </span>
              )}
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
        <span className="badge badge-grey">
          {spot.priceRange || "₹₹"}
          {spot.avgPricePerPerson ? ` · ~₹${spot.avgPricePerPerson}/person` : ""}
        </span>
        {spot.openNow === true && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4ade80" }}>
            <span className="pulse-dot green" style={{ width: 7, height: 7 }} />
            Open Now
          </span>
        )}
        {spot.openNow === false && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
            <Icon name="clock" size={14} />
            Closed
          </span>
        )}
      </div>

      {/* Beach crowd indicator */}
      {isBeach && beachIndicator && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", marginBottom: 2 }}>
          <span>{beachIndicator.dot}</span>
          <span>{beachIndicator.label}</span>
        </div>
      )}

      {/* Tourist spot entry info */}
      {isTouristSpot && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
          {spot.priceRange === "₹" ? "Entry: Free or minimal" : "Entry: Check before visiting"}
        </div>
      )}

      {spot.description && (
        <p style={{ color: "var(--text-primary)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          {spot.description}
        </p>
      )}

      {/* Water sports activity + pricing */}
      {isWaterSports && waterInfo && (
        <div style={{ marginTop: 6 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(0,245,255,0.08)",
            border: "1px solid rgba(0,245,255,0.2)",
            borderRadius: 20,
            padding: "3px 10px",
            fontSize: 12,
            color: "var(--neon-cyan)",
            fontWeight: 500,
            marginBottom: 4,
          }}>
            {waterInfo.label}
          </div>
          <div style={{ fontSize: 12, color: "var(--neon-cyan)", opacity: 0.7, fontStyle: "italic" }}>
            {waterInfo.price}
          </div>
        </div>
      )}

      {/* Rental tip */}
      {isRental && (
        <div className="tip-box" style={{ display: "flex", gap: 8 }}>
          <Icon name="scooter" size={17} style={{ color: "var(--neon-gold)", marginTop: 2 }} />
          <span>
            <strong>GoaNow Tip:</strong> Prices ₹300–500/day. Inspect before taking. Negotiate weekly rates.
          </span>
        </div>
      )}

      <div className="card-actions">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neon-btn mobile-full"
          style={{ flex: isRental ? 1 : "0 1 auto", minWidth: 150, textAlign: "center", padding: "10px 14px", fontSize: 14 }}
        >
          <Icon name="directions" size={17} />
          Directions
        </a>
        {isRental && spot.phone && (
          <a
            href={`tel:${spot.phone}`}
            className="neon-btn-ghost mobile-full"
            style={{ flex: 1, minWidth: 150, textAlign: "center", padding: "10px 14px", fontSize: 14 }}
          >
            <Icon name="phone" size={17} />
            Call
          </a>
        )}
      </div>
    </div>
  );
}
