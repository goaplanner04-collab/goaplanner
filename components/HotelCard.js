"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

const HOSTEL_TIP =
  "🗣️ GoaNow Tip: Book directly on zostel.com or hostelworld.com for best rates. Walk-in rates are usually higher.";

export default function HotelCard({ hotel, stayType }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = Array.isArray(hotel.photos) ? hotel.photos.filter(Boolean) : [];
  const hasPhotos = photos.length > 0;
  const currentPhoto = hasPhotos ? photos[photoIndex] : null;
  const showHostelTip = stayType === "hostel";

  const cyclePhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIndex((i) => (i + 1) % photos.length);
  };

  return (
    <div className="glass-card spot-card">
      <div
        onClick={cyclePhoto}
        style={{
          width: "calc(100% + 32px)",
          marginTop: -16,
          marginLeft: -16,
          marginRight: -16,
          marginBottom: 12,
          height: 220,
          background: hasPhotos
            ? `url(${currentPhoto}) center/cover no-repeat`
            : "linear-gradient(135deg, rgba(30,32,42,0.9), rgba(15,17,25,0.95))",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          position: "relative",
          cursor: photos.length > 1 ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!hasPhotos && <div style={{ fontSize: 56 }}>🏨</div>}
        {hasPhotos && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(7,9,14,0) 60%, rgba(7,9,14,0.55) 100%)",
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
            }}
          />
        )}
        {photos.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 6,
              zIndex: 1,
            }}
          >
            {photos.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === photoIndex ? "#fff" : "rgba(255,255,255,0.4)",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card-header-row">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Bebas Neue'",
              fontSize: 26,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: 0.5,
            }}
          >
            {hotel.name}
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--neon-cyan)",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            <Icon name="map-pin" size={13} />
            <span>{hotel.area}</span>
            {hotel.distanceKm != null && (
              <span style={{ color: "var(--text-muted)" }}>· {hotel.distanceKm} km</span>
            )}
          </div>
        </div>
      </div>

      <div className="card-meta-row" style={{ fontSize: 13 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: "var(--neon-gold)",
          }}
        >
          <Icon name="star" size={14} />
          {hotel.rating}
          <span style={{ color: "var(--text-muted)" }}>({hotel.reviews} reviews)</span>
        </span>
        <span style={{ color: "var(--neon-cyan)", fontSize: 13 }}>
          {hotel.priceRange}
          {hotel.avgPricePerNight
            ? ` · Est. ₹${Number(hotel.avgPricePerNight).toLocaleString("en-IN")}/night`
            : ""}
        </span>
      </div>

      {hotel.description && (
        <p
          style={{
            color: "var(--text-primary)",
            fontSize: 14,
            margin: 0,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {hotel.description}
        </p>
      )}

      {showHostelTip && (
        <div className="tip-box" style={{ display: "flex", gap: 8, fontSize: 13 }}>
          <span>{HOSTEL_TIP}</span>
        </div>
      )}

      <div className="card-actions">
        <a
          href={hotel.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neon-btn mobile-full"
          style={{
            flex: 1,
            minWidth: 130,
            textAlign: "center",
            padding: "10px 14px",
            fontSize: 14,
          }}
        >
          📍 Directions
        </a>
        {hotel.website ? (
          <a
            href={hotel.website}
            target="_blank"
            rel="noopener noreferrer"
            className="neon-btn-ghost mobile-full"
            style={{
              flex: 1,
              minWidth: 130,
              textAlign: "center",
              padding: "10px 14px",
              fontSize: 14,
              borderColor: "rgba(0,245,255,0.4)",
              color: "var(--neon-cyan)",
            }}
          >
            🌐 Website
          </a>
        ) : (
          <a
            href={hotel.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="neon-btn-ghost mobile-full"
            style={{
              flex: 1,
              minWidth: 130,
              textAlign: "center",
              padding: "10px 14px",
              fontSize: 14,
            }}
          >
            📞 Call
          </a>
        )}
      </div>
    </div>
  );
}
