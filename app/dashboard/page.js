"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Icon from "@/components/Icon";
import SpotCard from "@/components/SpotCard";
import EventCard from "@/components/EventCard";
import ItineraryBuilder from "@/components/ItineraryBuilder";
import LoadingSkeleton, { PulsingDotLoader } from "@/components/LoadingSkeleton";
import ShareButton from "@/components/ShareButton";
import { getDistanceKm } from "@/lib/haversine";
import { getSavedTheme, applyTheme } from "@/lib/theme";

const TABS = [
  { key: "nearby", label: "📍 Nearby", icon: null },
  { key: "events", label: "🎉 Parties", icon: null },
  { key: "ai", label: "🗺️ AI Plan", icon: null },
  { key: "settings", label: "⚙️ Settings", icon: null },
];

const NEARBY_CATEGORIES = [
  { key: "featured",        label: "For You",          emoji: "✨" },
  { key: "rentals",         label: "Rentals",           emoji: "🛵" },
  { key: "stay",            label: "Stay",              emoji: "🏨" },
  { key: "breakfast_cafes", label: "Breakfast & Cafes", emoji: "☕" },
  { key: "beaches",         label: "Beaches",           emoji: "🏖️" },
  { key: "tourist_spots",   label: "Tourist Spots",     emoji: "🛕" },
  { key: "water_sports",    label: "Water Sports",      emoji: "🌊" },
  { key: "restobars",       label: "Restobars",         emoji: "🍹" },
  { key: "seafood",         label: "Seafood",           emoji: "🦞" },
  { key: "hidden_gems",     label: "Hidden Gems",       emoji: "🌿" },
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

  useEffect(() => {
    if (!authChecked || typeof window === "undefined") return;
    let email = "";
    try { email = localStorage.getItem("goanow_email") || ""; } catch {}
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "tab_viewed", data: { email, tab } }),
    }).catch(() => {});
  }, [authChecked, tab]);

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
          background: "var(--surface-strong)",
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
              {item.icon ? <Icon name={item.icon} size={17} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 14px" }} className="animate-fadeUp">
        {tab === "nearby" && <NearbyTab />}
        {tab === "events" && <EventsTab />}
        {tab === "ai" && <ItineraryBuilder />}
        {tab === "settings" && <SettingsTab />}
      </div>

      <ShareButton />
    </main>
  );
}

function NearbyPill({ catKey, emoji, label, active, setCategory, forYou }) {
  const isActive = active === catKey;
  return (
    <button
      onClick={() => setCategory(catKey)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: forYou ? "center" : undefined,
        gap: 6,
        padding: forYou ? "10px 14px" : "8px 14px",
        borderRadius: 20,
        fontFamily: forYou ? "'Bebas Neue'" : "Inter, sans-serif",
        fontSize: forYou ? 16 : 13,
        letterSpacing: forYou ? "0.05em" : undefined,
        fontWeight: 500,
        cursor: "pointer",
        border: `1px solid ${isActive ? "var(--neon-pink)" : "var(--border-glass)"}`,
        background: isActive ? "var(--neon-pink)" : "var(--bg-card)",
        color: isActive ? "#fff" : "var(--text-primary)",
        boxShadow: isActive ? "0 0 12px rgba(255,45,120,0.4)" : "none",
        margin: forYou ? "0 0 8px 0" : "4px 6px 4px 0",
        width: forYou ? "100%" : undefined,
        whiteSpace: "nowrap",
        minHeight: 36,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (isActive) return;
        e.currentTarget.style.borderColor = "var(--neon-pink)";
        e.currentTarget.style.color = "var(--neon-pink)";
      }}
      onMouseLeave={(e) => {
        if (isActive) return;
        e.currentTarget.style.borderColor = "var(--border-glass)";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
    >
      {emoji} {label}
    </button>
  );
}

function getDefaultSort(category) {
  if (["beaches", "tourist_spots", "hidden_gems", "water_sports"].includes(category)) return "rating";
  return "distance";
}

function showSortToggle(category) {
  return !["featured", "water_sports"].includes(category);
}

function NearbyTab() {
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState("loading");
  const [areaInput, setAreaInput] = useState("");
  const [category, setCategory] = useState("featured");
  const [sortMode, setSortMode] = useState("distance");
  const [livePlaces, setLivePlaces] = useState(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [dataSource, setDataSource] = useState(null);
  const [heroVisible, setHeroVisible] = useState(true);

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

  useEffect(() => {
    setSortMode(getDefaultSort(category) === "rating" ? "rating" : "distance");
  }, [category]);

  useEffect(() => {
    if (!coords) return;
    setPlacesLoading(true);
    setLivePlaces(null);
    const url = `/api/places?lat=${coords.lat}&lng=${coords.lng}&category=${category}`;
    fetch(url)
      .then(async (r) => {
        const headerSource = r.headers.get("X-Data-Source") || "live";
        const data = await r.json();
        return { data, headerSource };
      })
      .then(({ data, headerSource }) => {
        setLivePlaces(Array.isArray(data?.places) ? data.places : []);
        setDataSource(headerSource);
        setHeroVisible(false);
      })
      .catch(() => {
        setLivePlaces([]);
        setDataSource("fallback");
        setHeroVisible(false);
      })
      .finally(() => setPlacesLoading(false));
  }, [coords, category]);

  const handleAreaSubmit = (e) => {
    e.preventDefault();
    const key = areaInput.trim().toLowerCase();
    if (!key) return;
    setCoords(AREAS_FALLBACK[key] || GOA_CENTER);
    setLocStatus("manual");
  };

  const sorted = useMemo(() => {
    if (!livePlaces) return [];
    const arr = livePlaces.map((p) => ({ ...p, id: p.place_id || p.id }));
    if (sortMode === "rating") {
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else {
      arr.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }
    return arr;
  }, [livePlaces, sortMode]);

  const grouped = useMemo(() => {
    if (category !== "tourist_spots" || !sorted.length) return null;
    const groups = [
      { key: "religious", label: "Churches & Temples", items: [] },
      { key: "heritage",  label: "Forts & Heritage",   items: [] },
      { key: "nature",    label: "Nature & Treks",      items: [] },
      { key: "other",     label: "Attractions",         items: [] },
    ];
    for (const spot of sorted) {
      const lower = (spot.name || "").toLowerCase();
      if (lower.includes("church") || lower.includes("chapel") || lower.includes("temple") || lower.includes("mosque") || lower.includes("cathedral")) {
        groups[0].items.push(spot);
      } else if (lower.includes("fort") || lower.includes("heritage") || lower.includes("museum") || lower.includes("palace")) {
        groups[1].items.push(spot);
      } else if (lower.includes("trek") || lower.includes("viewpoint") || lower.includes("waterfall") || lower.includes("falls") || lower.includes("lake")) {
        groups[2].items.push(spot);
      } else {
        groups[3].items.push(spot);
      }
    }
    return groups.filter((g) => g.items.length > 0);
  }, [category, sorted]);

  if (locStatus === "loading") {
    return <PulsingDotLoader text="Finding spots near you..." />;
  }

  const isFeatured = category === "featured";
  const showSort = showSortToggle(category);
  const activeCat = NEARBY_CATEGORIES.find((c) => c.key === category);

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
            onClick={() => { setCoords(GOA_CENTER); setLocStatus("manual"); }}
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

      {dataSource === "fallback" && (
        <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#fbbf24", marginBottom: 12 }}>
          ⚠️ Live Google data unavailable — showing curated spots. Photos and live opening hours may be missing.
        </div>
      )}

      {/* Hero banner — visible while featured is loading for the first time */}
      {isFeatured && (heroVisible || placesLoading) && (
        <div style={{
          width: "100%",
          height: 120,
          borderRadius: 12,
          background: "linear-gradient(135deg, #FF2D78, #FF6B6B, #00F5FF, #FF2D78)",
          backgroundSize: "300% 300%",
          animation: "gradientShift 4s ease infinite",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          opacity: heroVisible ? 1 : 0,
          transition: "opacity 0.5s ease",
          pointerEvents: "none",
        }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "#fff", letterSpacing: 0.5 }}>
            🌴 What&apos;s good near you in Goa?
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
            Live spots pulled from Google Maps
          </div>
        </div>
      )}

      {/* Category filter — grouped rows */}
      <div style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--border-glass)", marginBottom: 16 }}>
        {/* For You — full-width pill */}
        <NearbyPill catKey="featured" emoji="✨" label="For You" active={category} setCategory={setCategory} forYou />

        {/* Essentials */}
        <span style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", margin: "12px 0 6px 0" }}>Essentials</span>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <NearbyPill catKey="rentals"  emoji="🛵" label="Rentals" active={category} setCategory={setCategory} />
          <NearbyPill catKey="stay"     emoji="🏨" label="Stay"    active={category} setCategory={setCategory} />
        </div>

        {/* Eat & Drink */}
        <span style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", margin: "12px 0 6px 0" }}>Eat &amp; Drink</span>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <NearbyPill catKey="breakfast_cafes" emoji="☕" label="Cafes"     active={category} setCategory={setCategory} />
          <NearbyPill catKey="restobars"        emoji="🍹" label="Restobars" active={category} setCategory={setCategory} />
          <NearbyPill catKey="seafood"          emoji="🦞" label="Seafood"   active={category} setCategory={setCategory} />
        </div>

        {/* Explore */}
        <span style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", margin: "12px 0 6px 0" }}>Explore</span>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <NearbyPill catKey="beaches"       emoji="🏖️" label="Beaches"       active={category} setCategory={setCategory} />
          <NearbyPill catKey="tourist_spots" emoji="🛕" label="Tourist Spots" active={category} setCategory={setCategory} />
          <NearbyPill catKey="hidden_gems"   emoji="🌿" label="Hidden Gems"   active={category} setCategory={setCategory} />
        </div>

        {/* Activities */}
        <span style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", margin: "12px 0 6px 0" }}>Activities</span>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <NearbyPill catKey="water_sports" emoji="🌊" label="Water Sports" active={category} setCategory={setCategory} />
        </div>
      </div>

      {/* Sort toggle */}
      {showSort && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button
            onClick={() => setSortMode((m) => (m === "distance" ? "rating" : "distance"))}
            className="category-pill"
            style={{ background: "rgba(51,214,200,0.08)", borderColor: "rgba(51,214,200,0.3)", color: "var(--neon-cyan)" }}
          >
            <Icon name={sortMode === "distance" ? "map-pin" : "star"} size={15} />
            {sortMode === "distance" ? "Nearest First" : "Top Rated"}
          </button>
        </div>
      )}

      {/* Section header for non-featured categories */}
      {!isFeatured && activeCat && !placesLoading && sorted.length > 0 && (
        <div style={{
          fontFamily: "'Bebas Neue'",
          fontSize: 18,
          color: "var(--text-muted)",
          marginBottom: 12,
        }}>
          {activeCat.emoji} {activeCat.label} near you ({sorted.length} found)
        </div>
      )}

      {/* Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {placesLoading ? (
          <>
            <LoadingSkeleton height={200} />
            <LoadingSkeleton height={200} />
            <LoadingSkeleton height={200} />
          </>
        ) : sorted.length === 0 && !placesLoading ? (
          <div className="glass-card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
            No spots found for this category. Try another one.
          </div>
        ) : category === "tourist_spots" && grouped ? (
          grouped.map((group) => (
            <div key={group.key}>
              <div style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                color: "var(--neon-cyan)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                margin: "16px 0 8px",
              }}>
                {group.label}
              </div>
              {group.items.map((spot) => (
                <div key={spot.id || spot.place_id} style={{ marginBottom: 14 }}>
                  <SpotCard spot={spot} distanceKm={spot.distanceKm} />
                </div>
              ))}
            </div>
          ))
        ) : (
          sorted.map((spot) => (
            <SpotCard key={spot.id || spot.place_id} spot={spot} distanceKm={spot.distanceKm} />
          ))
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
  const [activeFilter, setActiveFilter] = useState("all");

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
      const localDate = new Date().toLocaleDateString("en-CA");
      const res = await fetch(`/api/events?date=${localDate}`, { cache: "no-store" });
      const data = await res.json();
      setEvents(data.events || []);
      setUpdatedAt(new Date());
    } catch {
      setError("Could not load events. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  // Build dynamic filter pills from loaded events
  const filterPills = useMemo(() => {
    if (!events || events.length === 0) return [];
    const pills = [{ key: "all", label: "🎉 All" }];

    if (events.some((e) => e.status === "happening_now"))
      pills.push({ key: "status:happening_now", label: "🔴 Now" });
    if (events.some((e) => e.status === "starting_soon"))
      pills.push({ key: "status:starting_soon", label: "🟡 Soon" });
    if (events.some((e) => String(e.entry_fee || "").toLowerCase() === "free"))
      pills.push({ key: "free", label: "✅ Free Entry" });

    // Unique areas
    const areas = [...new Set(events.map((e) => e.area).filter(Boolean))];
    areas.forEach((area) => pills.push({ key: `area:${area}`, label: `📍 ${area}` }));

    // Unique vibes
    const vibes = [...new Set(events.map((e) => e.vibe).filter(Boolean))];
    vibes.forEach((vibe) => pills.push({ key: `vibe:${vibe}`, label: vibe }));

    return pills;
  }, [events]);

  const filtered = useMemo(() => {
    if (!events) return [];
    if (activeFilter === "all") return events;
    if (activeFilter === "free")
      return events.filter((e) => String(e.entry_fee || "").toLowerCase() === "free");
    if (activeFilter.startsWith("status:"))
      return events.filter((e) => e.status === activeFilter.slice(7));
    if (activeFilter.startsWith("area:"))
      return events.filter((e) => e.area === activeFilter.slice(5));
    if (activeFilter.startsWith("vibe:"))
      return events.filter((e) => e.vibe === activeFilter.slice(5));
    return events;
  }, [events, activeFilter]);

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
            : "Loading..."}
        </div>
        <button onClick={fetchEvents} className="category-pill" style={{ borderColor: "var(--neon-pink)", color: "var(--neon-pink)" }} disabled={loading}>
          <Icon name="refresh" size={15} /> Refresh
        </button>
      </div>

      {/* Filter pills */}
      {!loading && filterPills.length > 1 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 14, scrollbarWidth: "none" }}>
          {filterPills.map((pill) => {
            const active = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setActiveFilter(pill.key)}
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: active ? "1.5px solid var(--neon-pink)" : "1px solid var(--border-glass)",
                  background: active ? "rgba(255,61,129,0.15)" : "rgba(255,255,255,0.04)",
                  color: active ? "#fff" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      )}

      {loading && <LoadingSkeleton count={4} height={210} />}

      {error && (
        <div style={{ padding: 16, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 14, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && events && events.length === 0 && (
        <div className="glass-card" style={{ padding: 36, textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <span className="icon-tile"><Icon name="music" size={24} /></span>
          <h3 style={{ margin: 0, fontSize: 24, color: "#fff" }}>No parties listed yet</h3>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Check back after 6 PM. We update the feed daily.</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>
            Check Instagram:{" "}
            <a href="https://instagram.com/goavibes" target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-pink)" }}>@goavibes</a>{" "}
            <a href="https://instagram.com/goanightlife" target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-pink)" }}>@goanightlife</a>
          </div>
        </div>
      )}

      {!loading && filtered && filtered.length === 0 && events && events.length > 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 14 }}>
          No events match this filter.
          <button onClick={() => setActiveFilter("all")} style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: "var(--neon-pink)", cursor: "pointer", fontSize: 13 }}>
            Show all
          </button>
        </div>
      )}

      {!loading && filtered && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((event) => {
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

function SettingsTab() {
  const [theme, setTheme] = useState("dark");
  const [storedEmail, setStoredEmail] = useState("");
  const [notifsOn, setNotifsOn] = useState(true);
  const [showReEnter, setShowReEnter] = useState(false);
  const [reEnterEmail, setReEnterEmail] = useState("");
  const [statusMsg, setStatusMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [passInfo, setPassInfo] = useState(null);
  const [shareToast, setShareToast] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTheme(getSavedTheme());

    let email = "";
    try { email = localStorage.getItem("goanow_email") || ""; } catch {}
    setStoredEmail(email);

    let notifsFlag = "on";
    try { notifsFlag = localStorage.getItem("goanow_notifications") || "on"; } catch {}
    setNotifsOn(notifsFlag !== "off");

    try {
      const plan = localStorage.getItem("goanow_plan") || "Trial Pass";
      const expiry = parseInt(localStorage.getItem("goanow_expiry") || "0", 10);
      if (expiry > 0) {
        const daysLeft = Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
        setPassInfo({
          plan,
          daysRemaining: daysLeft,
          expiryDate: new Date(expiry).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          }),
        });
      }
    } catch {}
  }, []);

  const handleThemeChange = (newTheme) => {
    applyTheme(newTheme);
    setTheme(newTheme);
  };

  const resubscribe = async (email) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const expiry = parseInt(localStorage.getItem("goanow_expiry") || "0", 10);
      const plan = localStorage.getItem("goanow_plan") || "Trial Pass";
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          plan_name: plan,
          expiry_at: expiry > 0 ? new Date(expiry).toISOString() : null,
          source: "paid",
        }),
      });
      const data = await res.json();
      if (data?.success) {
        try { localStorage.setItem("goanow_notifications", "on"); } catch {}
        try { localStorage.setItem("goanow_email", email); } catch {}
        setStoredEmail(email);
        setNotifsOn(true);
        setShowReEnter(false);
        setReEnterEmail("");
        setStatusMsg("You'll receive party updates at 4:30 PM 🎉");
      } else {
        setStatusMsg(data?.error || "Could not re-subscribe. Try again.");
      }
    } catch {
      setStatusMsg("Could not re-subscribe. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (busy) return;
    if (notifsOn) {
      if (!storedEmail) {
        try { localStorage.setItem("goanow_notifications", "off"); } catch {}
        setNotifsOn(false);
        setStatusMsg("Notifications turned off");
        return;
      }
      setBusy(true);
      setStatusMsg(null);
      try {
        await fetch(`/api/email/unsubscribe?email=${encodeURIComponent(storedEmail)}`);
        try { localStorage.setItem("goanow_notifications", "off"); } catch {}
        setNotifsOn(false);
        setStatusMsg("You've unsubscribed from party emails");
      } catch {
        setStatusMsg("Could not unsubscribe. Try again.");
      } finally {
        setBusy(false);
      }
    } else {
      if (storedEmail) {
        await resubscribe(storedEmail);
      } else {
        setShowReEnter(true);
        setStatusMsg(null);
      }
    }
  };

  const handleReEnterSubmit = async (e) => {
    e.preventDefault();
    const email = reEnterEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatusMsg("Enter a valid email");
      return;
    }
    await resubscribe(email);
  };

  const handleShare = async () => {
    const url = "https://goanow.online";
    const text = "Check out GoaNow — live party intel + AI Goa trip planner!";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "GoaNow", text, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied!");
      setTimeout(() => setShareToast(null), 2500);
    } catch {
      setShareToast(url);
      setTimeout(() => setShareToast(null), 3500);
    }
  };

  const sectionLabelStyle = {
    color: "var(--text-muted)",
    fontSize: 13,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 600,
  };

  return (
    <div>
      <h2 style={{
        margin: "8px 0 22px",
        fontFamily: "'Bebas Neue'",
        fontSize: 36,
        color: "var(--text-primary)",
        letterSpacing: 0.5,
        lineHeight: 1.1,
      }}>
        Settings
      </h2>

      {/* Appearance */}
      <div style={{ marginBottom: 28 }}>
        <div style={sectionLabelStyle}>Theme</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { key: "dark", label: "Dark Mode", emoji: "🌙" },
            { key: "light", label: "Light Mode", emoji: "☀️" },
          ].map((opt) => {
            const active = theme === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handleThemeChange(opt.key)}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  textAlign: "center",
                  background: active ? "rgba(255,45,120,0.08)" : "var(--bg-card)",
                  border: active ? "2px solid var(--neon-pink)" : "1px solid var(--border-glass)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  transition: "all 0.18s ease",
                }}
              >
                <div style={{ fontSize: 24, lineHeight: 1 }}>{opt.emoji}</div>
                <div style={{ marginTop: 8, fontWeight: active ? 600 : 400 }}>{opt.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      <div style={{ marginBottom: 28 }}>
        <div style={sectionLabelStyle}>Party Email Notifications</div>
        <div className="glass-card" style={{ padding: 16 }}>
          {storedEmail ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
              Sending to: <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{storedEmail}</span>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
              No email registered. Email is collected at payment.
            </div>
          )}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 14, color: "var(--text-primary)", flex: 1, minWidth: 0 }}>
              Daily 4:30 PM party updates
            </div>
            <button
              type="button"
              onClick={handleToggleNotifications}
              className={"toggle-switch" + (notifsOn ? " on" : "")}
              disabled={busy}
              aria-label={notifsOn ? "Turn off notifications" : "Turn on notifications"}
              aria-pressed={notifsOn}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {showReEnter && (
            <form onSubmit={handleReEnterSubmit} style={{
              display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap",
            }}>
              <input
                type="email"
                value={reEnterEmail}
                onChange={(e) => setReEnterEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="input-field"
                style={{ flex: 1, minWidth: 180 }}
                required
              />
              <button type="submit" className="neon-btn" disabled={busy} style={{ minWidth: 130 }}>
                {busy ? "..." : "Re-subscribe"}
              </button>
            </form>
          )}

          {statusMsg && (
            <div style={{
              marginTop: 12,
              fontSize: 13,
              color: "var(--neon-cyan)",
            }}>
              {statusMsg}
            </div>
          )}
        </div>
      </div>

      {/* Pass Info */}
      {passInfo && (
        <div style={{ marginBottom: 28 }}>
          <div style={sectionLabelStyle}>Pass Info</div>
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ marginBottom: 6, fontSize: 14, color: "var(--text-primary)" }}>
              Current Pass:{" "}
              <span style={{ color: "var(--neon-pink)", fontWeight: 600 }}>{passInfo.plan}</span>
              {" "}({passInfo.daysRemaining} day{passInfo.daysRemaining === 1 ? "" : "s"} remaining)
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Pass expires: {passInfo.expiryDate}
            </div>
          </div>
        </div>
      )}

      {/* Account */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabelStyle}>Account</div>
        <div className="glass-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, color: "var(--text-primary)" }}>
            Share GoaNow with friends
          </div>
          <button onClick={handleShare} className="neon-btn" style={{ alignSelf: "flex-start" }}>
            📤 Share GoaNow
          </button>
        </div>
      </div>

      {shareToast && <div className="toast">{shareToast}</div>}
    </div>
  );
}
