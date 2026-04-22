"use client";

import { formatDistance } from "@/lib/haversine";

function parseStartTime(s) {
  if (!s) return null;
  const str = String(s).trim().toLowerCase();
  // Handle "10 PM", "10pm", "9:30 pm", "Sunset", etc.
  const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3];
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 7) h += 12; // assume afternoon if ambiguous low number
  return { h, min };
}

function formatHour12(h, min) {
  const hour12 = ((h + 11) % 12) + 1;
  const finalAmPm = h < 12 ? "AM" : "PM";
  const mStr = min && min > 0 ? `:${String(min).padStart(2, "0")}` : "";
  return `${hour12}${mStr} ${finalAmPm}`;
}

export default function EventCard({ event, distanceKm }) {
  const parsed = parseStartTime(event.start_time);

  let timingNote = null;
  if (parsed) {
    if (parsed.h >= 21 && parsed.h <= 23) {
      const newH = (parsed.h + 2) % 24;
      timingNote = (
        <div
          style={{
            color: "var(--neon-cyan)",
            fontSize: 12,
            marginTop: 6,
            opacity: 0.9
          }}
        >
          🕐 Crowd arrives around {formatHour12(newH, parsed.min)} — don't show up before then
        </div>
      );
    } else if (parsed.h === 0 || parsed.h === 24 || (parsed.h >= 0 && parsed.h < 5)) {
      timingNote = (
        <div
          style={{
            color: "var(--neon-gold)",
            fontSize: 12,
            marginTop: 6
          }}
        >
          🔥 Late night — this one goes till sunrise
        </div>
      );
    }
  }

  // Entry fee badge
  let entryBadge;
  const fee = (event.entry_fee || "").trim();
  if (!fee || fee.toLowerCase() === "check at venue") {
    entryBadge = <span className="badge badge-grey">Entry TBC</span>;
  } else if (fee.toLowerCase() === "free") {
    entryBadge = <span className="badge badge-green">Free Entry</span>;
  } else if (fee.includes("₹")) {
    entryBadge = <span className="badge badge-gold">{fee}</span>;
  } else {
    entryBadge = <span className="badge badge-grey">{fee}</span>;
  }

  // Status badge
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
    statusBadge = <span className="badge badge-blue">🌙 Tonight</span>;
  }

  const mapsUrl = event.lat && event.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${event.venue}, ${event.area}, Goa`
      )}`;

  return (
    <div className="glass-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Bebas Neue'",
              fontSize: 26,
              letterSpacing: "0.03em",
              color: "var(--neon-pink)",
              textShadow: "0 0 12px rgba(255,45,120,0.35)",
              lineHeight: 1.15
            }}
          >
            {event.name}
          </h3>
          <div style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>
            {event.venue}
            <span style={{ color: "var(--text-muted)" }}> · {event.area}</span>
          </div>
          {distanceKm != null && (
            <div style={{ color: "var(--neon-cyan)", fontSize: 12, marginTop: 4 }}>
              📍 {formatDistance(distanceKm)} away
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {statusBadge}
          <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid var(--border-glass)" }}>
            🕒 {event.start_time}
          </span>
        </div>
      </div>

      {timingNote}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {entryBadge}
        {event.vibe && (
          <span className="badge badge-pink">🎵 {event.vibe}</span>
        )}
      </div>

      {event.description && (
        <p style={{ color: "var(--text-primary)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          {event.description}
        </p>
      )}

      {event.insider_tip && (
        <div className="tip-box">
          🗣️ <strong>GoaNow Insider:</strong> {event.insider_tip}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
        {event.source && (
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            via {event.source}
          </span>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neon-btn"
          style={{ padding: "8px 14px", fontSize: 13, marginLeft: "auto" }}
        >
          Get Directions →
        </a>
      </div>
    </div>
  );
}
