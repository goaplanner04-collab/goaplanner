"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Icon from "@/components/Icon";
import CategoryFilter from "@/components/CategoryFilter";
import SpotCard from "@/components/SpotCard";
import EventCard from "@/components/EventCard";
import HotelCard from "@/components/HotelCard";
import ItineraryBuilder from "@/components/ItineraryBuilder";
import LoadingSkeleton, { PulsingDotLoader } from "@/components/LoadingSkeleton";
import ShareButton from "@/components/ShareButton";
import { spots } from "@/lib/spotsData";
import { getDistanceKm } from "@/lib/haversine";

const TABS = [
  { key: "nearby", label: "Nearby", icon: "map-pin" },
  { key: "hotels", label: "🏨 Hotels", icon: null },
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

const HOTEL_AREAS = [
  { name: "Morjim",      subtitle: "Quiet beach, turtle nesting" },
  { name: "Arambol",     subtitle: "Boho vibes, hippie paradise" },
  { name: "Mandrem",     subtitle: "Most peaceful beach in Goa" },
  { name: "Vagator",     subtitle: "Party scene, cliff views" },
  { name: "Anjuna",      subtitle: "Flea market, nightlife" },
  { name: "Calangute",   subtitle: "Most popular, lively" },
  { name: "Baga",        subtitle: "Restaurants, watersports" },
  { name: "Candolim",    subtitle: "Calm, upscale" },
  { name: "Panjim",      subtitle: "Capital city, heritage" },
  { name: "Assagao",     subtitle: "Boutique cafes, peaceful" },
  { name: "Palolem",     subtitle: "South Goa, beautiful bay" },
  { name: "Cavelossim",  subtitle: "South Goa, luxury resorts" },
  { name: "Colva",       subtitle: "South Goa, long beach" },
  { name: "Benaulim",    subtitle: "South Goa, quiet" },
  { name: "Margao",      subtitle: "South Goa, city center" },
];

const STAY_TYPES = [
  { key: "beachside_resort", emoji: "🏖️", label: "Beachside Resort", subtitle: "Wake up steps from the beach" },
  { key: "hotel",            emoji: "🏨", label: "Hotel",             subtitle: "Comfortable, all amenities" },
  { key: "boutique_villa",   emoji: "🌿", label: "Boutique / Villa",  subtitle: "Intimate, unique, Insta-worthy" },
  { key: "hostel",           emoji: "🎒", label: "Hostel / Zostel",   subtitle: "Budget-friendly, meet travelers" },
  { key: "guesthouse",       emoji: "🏡", label: "Guesthouse",        subtitle: "Local, homely, affordable" },
];

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
              {item.icon ? <Icon name={item.icon} size={17} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 14px" }} className="animate-fadeUp">
        {tab === "nearby" && <NearbyTab />}
        {tab === "hotels" && <HotelsTab />}
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
  const [livePlaces, setLivePlaces] = useState(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [dataSource, setDataSource] = useState(null);

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
    if (!coords) return;
    setPlacesLoading(true);
    const url = `/api/places?lat=${coords.lat}&lng=${coords.lng}&category=${category}&radius=10000`;
    fetch(url)
      .then(async (r) => {
        const headerSource = r.headers.get("X-Data-Source") || "live";
        const data = await r.json();
        return { data, headerSource };
      })
      .then(({ data, headerSource }) => {
        setLivePlaces(Array.isArray(data?.places) ? data.places : []);
        setDataSource(headerSource);
      })
      .catch(() => {
        setLivePlaces([]);
        setDataSource("fallback");
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

  const list = useMemo(() => {
    let arr;
    if (livePlaces && livePlaces.length > 0) {
      arr = livePlaces.map((p) => ({
        ...p,
        id: p.place_id,
        distance: p.distanceKm,
      }));
    } else {
      arr = spots.slice().map((s) => ({ ...s, photos: [] }));
      if (category !== "all") arr = arr.filter((spot) => spot.category === category);
      arr = arr.map((spot) => ({
        ...spot,
        distance: coords ? getDistanceKm(coords.lat, coords.lng, spot.lat, spot.lng) : null,
      }));
    }

    if (sortMode === "distance" && coords) {
      arr.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else {
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return arr;
  }, [category, coords, sortMode, livePlaces]);

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

      {dataSource === "fallback" && (
        <div style={{
          background: "rgba(251,191,36,0.08)",
          border: "1px solid rgba(251,191,36,0.3)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          color: "#fbbf24",
          marginBottom: 12,
        }}>
          ⚠️ Live Google data unavailable — showing curated spots. Photos and live opening hours may be missing.
        </div>
      )}
      {dataSource === "partial" && (
        <div style={{
          background: "rgba(251,191,36,0.06)",
          border: "1px solid rgba(251,191,36,0.2)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          color: "#9aa3b2",
          marginBottom: 12,
        }}>
          ⚡ Some categories used saved data — most are live.
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
        {placesLoading ? (
          <PulsingDotLoader text="Pulling live spots from Google…" />
        ) : list.length === 0 ? (
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

function HotelsTab() {
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedStayType, setSelectedStayType] = useState(null);
  const [hotels, setHotels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fallbackMessage, setFallbackMessage] = useState(null);

  useEffect(() => {
    if (!selectedArea || !selectedStayType) return;
    setLoading(true);
    setError(null);
    setFallbackMessage(null);
    const url = `/api/hotels?area=${encodeURIComponent(selectedArea)}&stayType=${encodeURIComponent(selectedStayType)}&radius=5000`;
    fetch(url)
      .then(async (r) => {
        const headerSource = r.headers.get("X-Data-Source") || "live";
        const data = await r.json();
        return { data, headerSource };
      })
      .then(({ data, headerSource }) => {
        setHotels(Array.isArray(data?.hotels) ? data.hotels : []);
        if (headerSource === "fallback" && data?.message) {
          setFallbackMessage(data.message);
        }
      })
      .catch(() => {
        setHotels([]);
        setError("Couldn't load hotels. Check your connection and try again.");
      })
      .finally(() => setLoading(false));
  }, [selectedArea, selectedStayType]);

  const handleAreaPick = (area) => {
    setSelectedArea(area);
    setSelectedStayType(null);
    setHotels(null);
  };
  const handleStayTypePick = (stayType) => {
    setSelectedStayType(stayType);
  };
  const handleChangeArea = () => {
    setSelectedArea(null);
    setSelectedStayType(null);
    setHotels(null);
  };
  const handleChangeStayType = (newType) => {
    setSelectedStayType(newType);
    setHotels(null);
  };

  if (!selectedArea) {
    return (
      <div>
        <h2 style={{
          margin: "8px 0 6px",
          fontFamily: "'Bebas Neue'",
          fontSize: 32,
          color: "#fff",
          letterSpacing: 0.5,
          lineHeight: 1.1,
        }}>
          Where in Goa are you staying?
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "0 0 18px", fontSize: 14 }}>
          We'll find the best stays near you
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}>
          {HOTEL_AREAS.map((a) => (
            <button
              key={a.name}
              onClick={() => handleAreaPick(a.name)}
              className="glass-card"
              style={{
                padding: "14px 14px",
                textAlign: "left",
                cursor: "pointer",
                border: "1px solid var(--border-glass)",
                background: "rgba(15,17,25,0.7)",
                transition: "border-color 0.18s, transform 0.18s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--neon-pink)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-glass)"; }}
            >
              <div style={{
                fontFamily: "'Bebas Neue'",
                fontSize: 24,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: 0.4,
              }}>
                {a.name}
              </div>
              <div style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginTop: 4,
                lineHeight: 1.4,
              }}>
                {a.subtitle}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedStayType) {
    return (
      <div>
        <button
          onClick={handleChangeArea}
          style={{
            background: "none",
            border: "none",
            color: "var(--neon-cyan)",
            cursor: "pointer",
            fontSize: 13,
            padding: "4px 0",
            marginBottom: 8,
          }}
        >
          ← Change area
        </button>

        <h2 style={{
          margin: "0 0 6px",
          fontFamily: "'Bebas Neue'",
          fontSize: 32,
          color: "#fff",
          letterSpacing: 0.5,
          lineHeight: 1.1,
        }}>
          What kind of stay?
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "0 0 18px", fontSize: 14 }}>
          Showing options near {selectedArea}
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}>
          {STAY_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => handleStayTypePick(t.key)}
              className="glass-card"
              style={{
                padding: "16px 14px",
                textAlign: "left",
                cursor: "pointer",
                border: "1px solid var(--border-glass)",
                background: "rgba(15,17,25,0.7)",
                transition: "border-color 0.18s, transform 0.18s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--neon-pink)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-glass)"; }}
            >
              <div style={{ fontSize: 26, marginBottom: 6 }}>{t.emoji}</div>
              <div style={{
                fontFamily: "'Bebas Neue'",
                fontSize: 22,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: 0.4,
              }}>
                {t.label}
              </div>
              <div style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginTop: 4,
                lineHeight: 1.4,
              }}>
                {t.subtitle}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleChangeArea}
        style={{
          background: "none",
          border: "none",
          color: "var(--neon-cyan)",
          cursor: "pointer",
          fontSize: 13,
          padding: "4px 0",
          marginBottom: 12,
        }}
      >
        ← Change area
      </button>

      <div style={{ marginBottom: 8, color: "var(--text-muted)", fontSize: 13 }}>
        Stays in <span style={{ color: "#fff", fontWeight: 600 }}>{selectedArea}</span>
      </div>

      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        flexWrap: "nowrap",
        overflowX: "auto",
        paddingBottom: 4,
      }}>
        {STAY_TYPES.map((t) => {
          const active = t.key === selectedStayType;
          return (
            <button
              key={t.key}
              onClick={() => handleChangeStayType(t.key)}
              className="category-pill"
              style={{
                whiteSpace: "nowrap",
                background: active ? "rgba(255,45,120,0.18)" : "rgba(255,255,255,0.04)",
                borderColor: active ? "var(--neon-pink)" : "var(--border-glass)",
                color: active ? "#fff" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 16 }}>{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading && <PulsingDotLoader text="Finding hotels…" />}

      {!loading && error && (
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.3)",
          color: "#fca5a5",
          fontSize: 14,
          marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {!loading && fallbackMessage && (
        <div style={{
          background: "rgba(251,191,36,0.08)",
          border: "1px solid rgba(251,191,36,0.3)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 13,
          color: "#fbbf24",
          marginBottom: 12,
        }}>
          ⚠️ {fallbackMessage}
        </div>
      )}

      {!loading && hotels && hotels.length === 0 && !error && !fallbackMessage && (
        <div className="glass-card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
          No stays match this filter near {selectedArea}. Try a different stay type or area.
        </div>
      )}

      {!loading && hotels && hotels.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {hotels.map((hotel) => (
            <HotelCard key={hotel.place_id} hotel={hotel} stayType={selectedStayType} />
          ))}
        </div>
      )}
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
