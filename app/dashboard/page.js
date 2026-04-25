"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Icon from "@/components/Icon";
import CategoryFilter from "@/components/CategoryFilter";
import SpotCard from "@/components/SpotCard";
import EventCard from "@/components/EventCard";
import ItineraryBuilder from "@/components/ItineraryBuilder";
import LoadingSkeleton, { PulsingDotLoader } from "@/components/LoadingSkeleton";
import ShareButton from "@/components/ShareButton";
import { spots } from "@/lib/spotsData";
import { getDistanceKm } from "@/lib/haversine";

const TABS = [
  { key: "nearby", label: "Nearby", icon: "map-pin" },
  { key: "events", label: "Parties", icon: "music" },
  { key: "ai", label: "AI Plan", icon: "route" },
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
  ashvem: { lat: 15.6531, lng: 73.7128 },
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

      <nav
        style={{
          position: "sticky",
          top: 60,
          zIndex: 40,
          background: "rgba(7, 9, 14, 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-glass)",
        }}
      >
        <div className="dashboard-tabs">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={"dashboard-tab" + (tab === item.key ? " active" : "")}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 14px" }} className="animate-fadeUp">
        {tab === "nearby" && <NearbyTab />}
        {tab === "events" && <EventsTab />}
        {tab === "ai" && <ItineraryBuilder />}
      </div>

      <ShareButton />
    </main>
  );
}

function NearbyTab() {
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState("loading");
  const [areaInput, setAreaInput] = useState("");
  const [category, setCategory] = useState("all");
  const [sortMode, setSortMode] = useState("distance");

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
    setCoords(AREAS_FALLBACK[key] || GOA_CENTER);
    setLocStatus("manual");
  };

  const list = useMemo(() => {
    let arr = spots.slice();
    if (category !== "all") arr = arr.filter((spot) => spot.category === category);
    arr = arr.map((spot) => ({
      ...spot,
      distance: coords ? getDistanceKm(coords.lat, coords.lng, spot.lat, spot.lng) : null,
    }));
    if (sortMode === "distance" && coords) {
      arr.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else {
      arr.sort((a, b) => b.rating - a.rating);
    }
    return arr;
  }, [category, coords, sortMode]);

  if (locStatus === "loading") {
    return <PulsingDotLoader text="Finding spots near you..." />;
  }

  return (
    <div>
      {locStatus === "denied" && !coords && (
        <div className="glass-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff", fontSize: 14, marginBottom: 10 }}>
            <Icon name="map-pin" size={17} style={{ color: "var(--neon-cyan)" }} />
            We could not access your location.
          </div>
          <form onSubmit={handleAreaSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              placeholder="Enter your area in Goa, e.g. Morjim"
              className="input-field"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button type="submit" className="neon-btn mobile-full" style={{ padding: "10px 16px" }}>
              <Icon name="compass" size={17} />
              Find Spots
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setCoords(GOA_CENTER);
              setLocStatus("manual");
            }}
            className="neon-btn-ghost mobile-full"
            style={{ marginTop: 10, fontSize: 12, padding: "6px 12px", minHeight: 34 }}
          >
            Show all Goa
          </button>
        </div>
      )}

      {locStatus === "manual" && (
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>
          Showing results based on manual location
        </div>
      )}
      {locStatus === "ok" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--neon-cyan)", fontSize: 12, marginBottom: 8 }}>
          <Icon name="map-pin" size={14} />
          Showing results closest to your live location
        </div>
      )}

      <CategoryFilter active={category} onChange={setCategory} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          onClick={() => setSortMode((mode) => (mode === "distance" ? "rating" : "distance"))}
          className="category-pill"
          style={{ background: "rgba(51,214,200,0.08)", borderColor: "rgba(51,214,200,0.3)", color: "var(--neon-cyan)" }}
        >
          <Icon name={sortMode === "distance" ? "map-pin" : "star"} size={15} />
          {sortMode === "distance" ? "Nearest First" : "Top Rated"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.length === 0 ? (
          <div className="glass-card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
            No spots match this filter. Try another category.
          </div>
        ) : (
          list.map((spot) => <SpotCard key={spot.id} spot={spot} distanceKm={spot.distance} />)
        )}
      </div>
    </div>
  );
}

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
    } catch {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
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
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {loading && <LoadingSkeleton count={4} height={210} />}

      {error && (
        <div style={{ padding: 16, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 14, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && events && events.length === 0 && (
        <div className="glass-card" style={{ padding: 36, textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <span className="icon-tile">
            <Icon name="music" size={24} />
          </span>
          <h3 style={{ margin: 0, fontSize: 24, color: "#fff" }}>No parties listed yet</h3>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Check back after 6 PM. We update the feed daily.
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
          {events.map((event) => {
            const dist = coords && event.lat && event.lng
              ? getDistanceKm(coords.lat, coords.lng, event.lat, event.lng)
              : null;
            return <EventCard key={event.id} event={event} distanceKm={dist} />;
          })}
        </div>
      )}
    </div>
  );
}
