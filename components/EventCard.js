"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { formatDistance } from "@/lib/haversine";

const VIBE_EMOJI = {
  "Psy Trance": "🌀",
  "Techno": "⚡",
  "EDM": "🎵",
  "Commercial/Bollywood": "🎬",
  "Live Band": "🎸",
  "Live Music": "🎸",
  "Sunset Session": "🌅",
  "Silent Disco": "🎧",
  "Indie/Folk": "🎻",
  "World Music": "🥁",
};

const VIBE_FALLBACK_IMG = {
  "Psy Trance":           "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=900&q=80",
  "Techno":               "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=900&q=80",
  "EDM":                  "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=900&q=80",
  "Commercial/Bollywood": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900&q=80",
  "Live Band":            "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80",
  "Live Music":           "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80",
  "Sunset Session":       "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=900&q=80",
  "Silent Disco":         "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=900&q=80",
  "Indie/Folk":           "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&q=80",
  "World Music":          "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=900&q=80",
  _default:               "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80",
};

function vibeEmoji(vibe) {
  if (!vibe) return "🎉";
  const key = String(vibe).trim();
  if (VIBE_EMOJI[key]) return VIBE_EMOJI[key];
  // Loose match — handle e.g. "Silent Disco — 3 channels"
  for (const k of Object.keys(VIBE_EMOJI)) {
    if (key.toLowerCase().startsWith(k.toLowerCase())) return VIBE_EMOJI[k];
  }
  return "🎉";
}

function parseStartTime(s) {
  if (!s) return null;
  const str = String(s).trim().toLowerCase();
  const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3];
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 7) h += 12;
  return { h, min };
}

function formatHour12(h, min) {
  const hour12 = ((h + 11) % 12) + 1;
  const finalAmPm = h < 12 ? "AM" : "PM";
  const mStr = min && min > 0 ? `:${String(min).padStart(2, "0")}` : "";
  return `${hour12}${mStr} ${finalAmPm}`;
}

function cleanFee(value) {
  return String(value || "").replace(/\u00e2\u201a\u00b9/g, "Rs ");
}

export default function EventCard({ event, distanceKm }) {
  const [imgFailed, setImgFailed] = useState(false);
  const parsed = parseStartTime(event.start_time);

  let timingNote = null;
  if (parsed) {
    if (parsed.h >= 21 && parsed.h <= 23) {
      const newH = (parsed.h + 2) % 24;
      timingNote = (
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--neon-cyan)", fontSize: 12, marginTop: 2 }}>
          <Icon name="clock" size={14} />
          Crowd arrives around {formatHour12(newH, parsed.min)}
        </div>
      );
    } else if (parsed.h === 0 || parsed.h === 24 || (parsed.h >= 0 && parsed.h < 5)) {
      timingNote = (
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--neon-gold)", fontSize: 12, marginTop: 2 }}>
          <Icon name="sun" size={14} />
          Late night set that runs close to sunrise
        </div>
      );
    }
  }

  const fee = cleanFee(event.entry_fee).trim();
  let entryBadge;
  if (!fee || fee.toLowerCase() === "check at venue") {
    entryBadge = <span className="badge badge-grey">Entry TBC</span>;
  } else if (fee.toLowerCase() === "free") {
    entryBadge = <span className="badge badge-green">Free Entry</span>;
  } else if (fee.toLowerCase().includes("rs")) {
    entryBadge = <span className="badge badge-gold">{fee}</span>;
  } else {
    entryBadge = <span className="badge badge-grey">{fee}</span>;
  }

  let statusBadge = null;
  if (event.status === "happening_now") {
    statusBadge = (
      <span className="badge badge-red">
        <span className="pulse-dot red" style={{ width: 6, height: 6 }} />
        Happening Now
      </span>
    );
  } else if (event.status === "starting_soon") {
    statusBadge = (
      <span className="badge" style={{ background: "rgba(234,179,8,0.14)", color: "#facc15", border: "1px solid rgba(234,179,8,0.3)" }}>
        <span className="pulse-dot yellow" style={{ width: 6, height: 6 }} />
        Starting Soon
      </span>
    );
  } else if (event.status === "tonight") {
    statusBadge = (
      <span className="badge badge-blue">
        <Icon name="music" size={14} />
        Tonight
      </span>
    );
  }

  const mapsUrl = event.lat && event.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${event.venue}, ${event.area}, Goa`
      )}`;

  const hasFlyer = typeof event.image_url === "string" && event.image_url.trim().length > 0 && !imgFailed;
  const fallbackImg = VIBE_FALLBACK_IMG[event.vibe] || VIBE_FALLBACK_IMG._default;

  return (
    <div className="glass-card event-card">
      <div style={{
        marginTop: -16,
        marginLeft: -16,
        marginRight: -16,
        marginBottom: 14,
        width: "calc(100% + 32px)",
        height: 220,
        position: "relative",
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        overflow: "hidden",
      }}>
        <img
          src={hasFlyer ? event.image_url : fallbackImg}
          alt={event.name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* gradient overlay so text beneath is readable */}
        <div style={{
          position: "absolute", inset: 0,
          background: hasFlyer
            ? "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.85) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
        }} />
        {/* vibe emoji badge when using fallback */}
        {!hasFlyer && (
          <span style={{
            position: "absolute", top: 12, left: 12,
            fontSize: 28, lineHeight: 1,
            background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "4px 8px",
          }}>
            {vibeEmoji(event.vibe)}
          </span>
        )}
        {event.image_source === "instagram" && (
          <span style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(0,0,0,0.6)", color: "#fff",
            borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 500,
          }}>
            via Instagram
          </span>
        )}
      </div>
      <div className="card-header-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Bebas Neue'",
              fontSize: 28,
              color: "var(--neon-pink)",
              textShadow: "0 0 12px rgba(255,45,120,0.28)",
              lineHeight: 1.05,
            }}
          >
            {event.name}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#fff", fontSize: 14, marginTop: 6, flexWrap: "wrap" }}>
            <Icon name="map-pin" size={14} style={{ color: "var(--neon-cyan)" }} />
            {event.venue}
            <span style={{ color: "var(--text-muted)" }}>{event.area}</span>
          </div>
          {distanceKm != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--neon-cyan)", fontSize: 12, marginTop: 5 }}>
              <Icon name="compass" size={14} />
              {formatDistance(distanceKm)} away
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {statusBadge}
          <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid var(--border-glass)" }}>
            <Icon name="clock" size={14} />
            {event.start_time}
          </span>
        </div>
      </div>

      {timingNote}

      <div className="card-meta-row">
        {entryBadge}
        {event.vibe && (
          <span className="badge badge-pink">
            <Icon name="music" size={14} />
            {event.vibe}
          </span>
        )}
      </div>

      {event.description && (
        <p style={{ color: "var(--text-primary)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          {event.description}
        </p>
      )}

      {event.insider_tip && (
        <div className="tip-box" style={{ display: "flex", gap: 8 }}>
          <Icon name="sparkles" size={16} style={{ color: "var(--neon-gold)", marginTop: 2 }} />
          <span><strong>GoaNow Insider:</strong> {event.insider_tip}</span>
        </div>
      )}

      <div className="card-actions" style={{ justifyContent: "space-between" }}>
        {event.source && (
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            via {event.source}
          </span>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neon-btn mobile-full"
          style={{ padding: "8px 14px", fontSize: 13, marginLeft: "auto" }}
        >
          <Icon name="directions" size={16} />
          Directions
        </a>
      </div>
    </div>
  );
}
