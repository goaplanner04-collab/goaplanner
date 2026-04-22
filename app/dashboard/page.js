"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CategoryFilter from "@/components/CategoryFilter";
import SpotCard from "@/components/SpotCard";
import EventCard from "@/components/EventCard";
import ItineraryBuilder from "@/components/ItineraryBuilder";
import LoadingSkeleton, { PulsingDotLoader } from "@/components/LoadingSkeleton";
import ShareButton from "@/components/ShareButton";
import { spots } from "@/lib/spotsData";
import { getDistanceKm } from "@/lib/haversine";

const TABS = [
  { key: "nearby", label: "📍 Nearby", short: "Nearby" },
  { key: "events", label: "🎉 Parties", short: "Parties" },
  { key: "ai", label: "🗺️ AI Plan", short: "AI Plan" }
];

const GOA_CENTER = { lat: 15.2993, lng: 74.1240 };

const AREAS_FALLBACK = {
  morjim: { lat: 15.6390, lng: 73.7219 },
  arambol: { lat: 15.6870, lng: 73.7037 },
  mandrem: { lat: 15.6612, lng: 73.7134 },
  vagator: { lat: 15.6021, lng: 73.7340 },
  anjuna: { lat: 15.5766, lng: 73.7404 },
  baga: { lat: 15.5617, lng: 73.7519 },
  calangute: { lat: 15.5440, lng: 73.7628 },
  candolim: { lat: 15.5151, lng: 73.7622 },
  panjim: { lat: 15.4978, lng: 73.8311 },
  panaji: { lat: 15.4978, lng: 73.8311 },
  margao: { lat: 15.2832, lng: 73.9862 },
  colva: { lat: 15.2792, lng: 73.9220 },
  palolem: { lat: 15.0100, lng: 74.0230 },
  cavelossim: { lat: 15.1824, lng: 73.9478 },
  assagao: { lat: 15.5891, lng: 73.7629 },
  ashvem: { lat: 15.6531, lng: 73.7128 }
};

export default function DashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("nearby");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const expiry = parseInt(localStorage.getItem("goanow_expiry") || "0", 10);
    if (!expiry) {
      router.replace("/");
      return;
    }
    if (expiry <= Date.now()) {
      router.replace("/expired");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [tab]);

  if (!authChecked) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PulsingDotLoader text="Checking your pass..." />
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", paddingBottom: 100 }}>
      <Navbar showPlanBadge />

      {/* Tabs */}
      <nav
        style={{
          position: "sticky",
          top: 60,
          zIndex: 40,
          background: "rgba(10, 10, 15, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-glass)"
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "10px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: tab === t.key
                  ? "linear-gradient(135deg, rgba(255,45,120,0.2), rgba(255,45,120,0.06))"
                  : "transparent",
                border: tab === t.key
                  ? "1px solid var(--neon-pink)"
                  : "1px solid var(--border-glass)",
                color: tab === t.key ? "#fff" : "var(--text-muted)",
                padding: "10px 8px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                transition: "all 0.2s ease",
                boxShadow: tab === t.key ? "0 0 16px rgba(255,45,120,0.3)" : "none"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "20px 16px"
        }}
        className="animate-fadeUp"
      >
        {tab === "nearby" && <NearbyTab />}
        {tab === "events" && <EventsTab />}
        {tab === "ai" && <ItineraryBuilder />}
      </div>

      <ShareButton />
    </main>
  );
}

// ===========================
// Nearby tab
// ===========================
function NearbyTab() {
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState("loading"); // loading | ok | denied | manual
  const [areaInput, setAreaInput] = useState("");
  const [category, setCategory] = useState("all");
  const [sortMode, setSortMode] = useState("distance"); // distance | rating

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocStatus("denied");
      return;
    }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("ok");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const handleAreaSubmit = (e) => {
    e.preventDefault();
    const key = areaInput.trim().toLowerCase();
    if (!key) return;
    const match = AREAS_FALLBACK[key];
    if (match) {
      setCoords(match);
      setLocStatus("manual");
    } else {
      // fall back to Goa center if area is not in our small list
      setCoords(GOA_CENTER);
      setLocStatus("manual");
    }
  };

  const useCenterFallback = () => {
    setCoords(GOA_CENTER);
    setLocStatus("manual");
  };

  const userLat = coords ? coords.lat : null;
  const userLng = coords ? coords.lng : null;

  const list = useMemo(() => {
    let arr = spots.slice();
    if (category !== "all") arr = arr.filter((s) => s.category === category);
    arr = arr.map((s) => ({
      ...s,
      distance: userLat != null ? getDistanceKm(userLat, userLng, s.lat, s.lng) : null
    }));
    if (sortMode === "distance" && userLat != null) {
      arr.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else {
      arr.sort((a, b) => b.rating - a.rating);
    }
    return arr;
  }, [category, userLat, userLng, sortMode]);

  if (locStatus === "loading") {
    return <PulsingDotLoader text="Finding spots near you..." />;
  }

  return (
    <div>
      {locStatus === "denied" && !coords && (
        <div className="glass-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ color: "#fff", fontSize: 14, marginBottom: 10 }}>
            📍 We couldn't access your location.
          </div>
          <form onSubmit={handleAreaSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              placeholder="Enter your area in Goa (e.g. Morjim, Calangute)"
              className="input-field"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button type="submit" className="neon-btn" style={{ padding: "10px 16px" }}>
              Find Spots
            </button>
          </form>
          <button
            type="button"
            onClick={useCenterFallback}
            className="neon-btn-ghost"
            style={{ marginTop: 10, fontSize: 12, padding: "6px 12px", minHeight: 32 }}
          >
            Or just show me everything in Goa
          </button>
        </div>
      )}

      {locStatus === "manual" && (
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>
          Showing results based on manual location
        </div>
      )}
      {locStatus === "ok" && (
        <div style={{ color: "var(--neon-cyan)", fontSize: 12, marginBottom: 8 }}>
          📍 Showing results closest to your live location
        </div>
      )}

      <CategoryFilter active={category} onChange={setCategory} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          onClick={() => setSortMode((m) => (m === "distance" ? "rating" : "distance"))}
          className="category-pill"
          style={{ background: "rgba(0,245,255,0.08)", borderColor: "rgba(0,245,255,0.3)", color: "var(--neon-cyan)" }}
        >
          {sortMode === "distance" ? "📍 Nearest First" : "⭐ Top Rated"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.length === 0 ? (
          <div className="glass-card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
            No spots match this filter. Try another category.
          </div>
        ) : (
          list.map((s) => <SpotCard key={s.id} spot={s} distanceKm={s.distance} />)
        )}
      </div>
    </div>
  );
}

// ===========================
// Events tab
// ===========================
function EventsTab() {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    }
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = await res.json();
      setEvents(data.events || []);
      setUpdatedAt(new Date());
    } catch (e) {
      setError("Could not load events. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8
        }}
      >
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {updatedAt
            ? `Last updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
            : "Loading..."}
        </div>
        <button
          onClick={fetchEvents}
          className="category-pill"
          style={{ borderColor: "var(--neon-pink)", color: "var(--neon-pink)" }}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <LoadingSkeleton count={4} height={210} />}

      {error && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: 14,
            marginBottom: 12
          }}
        >
          {error}
        </div>
      )}

      {!loading && events && events.length === 0 && (
        <div
          className="glass-card"
          style={{
            padding: 36,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center"
          }}
        >
          <div style={{ fontSize: 50 }}>🎉</div>
          <h3 style={{ margin: 0, fontSize: 24, color: "#fff" }}>No parties listed yet</h3>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Check back after 6 PM — we update the feed daily
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>
            In the meantime, check Instagram:{" "}
            <a href="https://instagram.com/goavibes" target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-pink)" }}>@goavibes</a>{" "}
            <a href="https://instagram.com/goanightlife" target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-pink)" }}>@goanightlife</a>{" "}
            <a href="https://instagram.com/sinqpark" target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-pink)" }}>@sinqpark</a>
          </div>
        </div>
      )}

      {!loading && events && events.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {events.map((e) => {
            const dist = coords && e.lat && e.lng
              ? getDistanceKm(coords.lat, coords.lng, e.lat, e.lng)
              : null;
            return <EventCard key={e.id} event={e} distanceKm={dist} />;
          })}
        </div>
      )}
    </div>
  );
}
