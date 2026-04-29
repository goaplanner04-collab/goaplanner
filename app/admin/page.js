"use client";

import { useEffect, useRef, useState } from "react";

const VIBE_OPTIONS = [
  "Psy Trance",
  "Techno",
  "EDM",
  "Commercial/Bollywood",
  "Live Band",
  "Sunset Session",
  "Silent Disco",
  "Indie/Folk",
  "World Music"
];

const STATUS_OPTIONS = [
  { value: "tonight", label: "Tonight" },
  { value: "starting_soon", label: "Starting Soon" },
  { value: "happening_now", label: "Happening Now" }
];

const EMPTY_EVENT = {
  id: null,
  name: "",
  venue: "",
  area: "",
  date: new Date().toISOString().slice(0, 10),
  publish_on: new Date().toISOString().slice(0, 10),
  start_time: "",
  entry_fee: "",
  vibe: "",
  status: "tonight",
  source: "",
  description: "",
  insider_tip: "",
  lat: "",
  lng: ""
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminUser, setAdminUser] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("admin_auth") === "true") {
      setAdminUser(sessionStorage.getItem("admin_user") || "");
      setAuthed(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: pwd }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("admin_auth", "true");
        sessionStorage.setItem("admin_user", data.user);
        setAdminUser(data.user);
        setAuthed(true);
      } else {
        setAuthError(data.error || "Wrong credentials");
      }
    } catch {
      setAuthError("Login failed. Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (!authed) {
    return (
      <main
        className="hero-gradient"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <form onSubmit={handleLogin} className="glass-card" style={{ padding: 30, width: "100%", maxWidth: 380 }}>
          <h1
            style={{
              margin: "0 0 6px",
              color: "var(--neon-pink)",
              fontSize: 38,
              textShadow: "0 0 16px rgba(255,45,120,0.5)",
            }}
          >
            🔐 Admin
          </h1>
          <p style={{ color: "var(--text-muted)", margin: "0 0 20px", fontSize: 14 }}>
            Sign in to manage GoaNow events and users.
          </p>

          <label style={{ display: "block", color: "var(--text-muted)", fontSize: 12, marginBottom: 6, letterSpacing: "0.04em" }}>
            USERNAME
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
            className="input-field"
            autoComplete="username"
            autoFocus
            style={{ marginBottom: 14 }}
          />

          <label style={{ display: "block", color: "var(--text-muted)", fontSize: 12, marginBottom: 6, letterSpacing: "0.04em" }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Enter your password"
            className="input-field"
          />
          {authError && (
            <div style={{ color: "#fca5a5", fontSize: 13, marginTop: 10 }}>{authError}</div>
          )}
          <button type="submit" disabled={authLoading || !pwd || !username.trim()} className="neon-btn" style={{ width: "100%", marginTop: 16 }}>
            {authLoading ? "Checking..." : "Enter"}
          </button>
        </form>
      </main>
    );
  }

  return <AdminDashboard adminUser={adminUser} onLogout={() => {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_user");
    setAdminUser("");
    setAuthed(false);
  }} />;
}

function AdminDashboard({ onLogout, adminUser }) {
  const [event, setEvent] = useState(EMPTY_EVENT);
  const [aiFilled, setAiFilled] = useState({}); // field -> true
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showWeek, setShowWeek] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [flyer, setFlyer] = useState(null);
  const [flyerPreview, setFlyerPreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState(null);
  const [scrapedEvents, setScrapedEvents] = useState([]);
  const [selectedScrape, setSelectedScrape] = useState({});
  const [importing, setImporting] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedHtml, setPastedHtml] = useState("");
  const [activeTab, setActiveTab] = useState("events");
  const [pricing, setPricing] = useState({
    day:  { price: 49,  name: "Day Pass",  label: "24 hours", popular: false },
    week: { price: 99,  name: "Week Pass", label: "7 days",   popular: true  },
    trip: { price: 149, name: "Trip Pass", label: "30 days",  popular: false },
  });
  const [trialKeys, setTrialKeys] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [newKey, setNewKey] = useState({ code: "", label: "Trial Pass", duration_hours: 168, max_uses: 1 });
  const formRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const url = showWeek ? "/api/events?range=week" : "/api/events?range=today&admin=1";
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        cache: "no-store"
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [showWeek]);

  function getAuthHeaders() {
    const pwd = typeof window !== "undefined" ? sessionStorage.getItem("admin_pwd") || "" : "";
    return {
      "Content-Type": "application/json",
      "x-admin-auth": pwd
    };
  }

  const set = (k, v) => {
    setEvent((prev) => ({ ...prev, [k]: v }));
    setAiFilled((prev) => {
      const cp = { ...prev };
      delete cp[k];
      return cp;
    });
  };

  const resetForm = () => {
    setEvent(EMPTY_EVENT);
    setAiFilled({});
    setFlyer(null);
    setFlyerPreview(null);
    setExtractError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!event.name || !event.venue || !event.area || !event.date || !event.start_time) {
      showToast("Fill required fields ⚠️");
      return;
    }
    setSubmitting(true);
    try {
      const isEdit = !!event.id;
      const payload = { ...event };
      if (payload.lat === "") payload.lat = null;
      else payload.lat = parseFloat(payload.lat);
      if (payload.lng === "") payload.lng = null;
      else payload.lng = parseFloat(payload.lng);
      if (!payload.entry_fee) payload.entry_fee = "Check at venue";

      const url = isEdit ? `/api/admin/events/${payload.id}` : "/api/admin/events";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? "Event updated! ✅" : "Event added! 🎉");
        resetForm();
        fetchEvents();
      } else {
        showToast(data.error || "Save failed");
      }
    } catch (e) {
      showToast("Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const editEvent = (ev) => {
    setEvent({
      id: ev.id,
      name: ev.name || "",
      venue: ev.venue || "",
      area: ev.area || "",
      date: ev.date || new Date().toISOString().slice(0, 10),
      publish_on: ev.publish_on || new Date().toISOString().slice(0, 10),
      start_time: ev.start_time || "",
      entry_fee: ev.entry_fee || "",
      vibe: ev.vibe || "",
      status: ev.status || "tonight",
      source: ev.source || "",
      description: ev.description || "",
      insider_tip: ev.insider_tip || "",
      lat: ev.lat ?? "",
      lng: ev.lng ?? ""
    });
    setAiFilled({});
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const deleteEvent = async (ev) => {
    if (!confirm(`Delete "${ev.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/events/${ev.id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast("Deleted 🗑️");
        fetchEvents();
      } else {
        showToast(data.error || "Delete failed");
      }
    } catch (e) {
      showToast("Delete failed");
    }
  };

  const handleFlyerChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/image\/(jpeg|png|webp)/.test(f.type)) {
      setExtractError("Use JPG, PNG or WEBP");
      return;
    }
    setFlyer(f);
    setExtractError(null);
    const reader = new FileReader();
    reader.onload = () => setFlyerPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    handleFlyerChange({ target: { files: [f] } });
  };

  const extractFlyer = async () => {
    if (!flyer) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => {
          const result = reader.result;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(flyer);
      });

      const res = await fetch("/api/admin/extract-flyer", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ image: base64, mediaType: flyer.type })
      });
      const data = await res.json();
      if (!data.success) {
        setExtractError(data.error || "Couldn't read flyer clearly. Please fill in manually.");
        return;
      }
      const fields = data.fields || {};
      const filled = {};
      const next = { ...event };
      ["name", "venue", "area", "date", "start_time", "entry_fee", "vibe", "source"].forEach((k) => {
        if (fields[k] && String(fields[k]).trim()) {
          next[k] = fields[k];
          filled[k] = true;
        }
      });
      setEvent(next);
      setAiFilled(filled);
      showToast("AI filled the form ✨");
    } catch (e) {
      setExtractError("Couldn't read flyer clearly. Please fill in manually.");
    } finally {
      setExtracting(false);
    }
  };

  const scrapeDistrict = async (usePaste = false) => {
    setScraping(true);
    setScrapeError(null);
    setScrapedEvents([]);
    setSelectedScrape({});
    try {
      const body = usePaste && pastedHtml.trim()
        ? { pastedHtml }
        : {};
      const res = await fetch("/api/admin/scrape-district", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setScrapeError(data.error || "Scrape failed");
        if (data.usePaste) setPasteMode(true);
        return;
      }
      if (data.events.length === 0) {
        setScrapeError("No Goa events found. Try the Paste HTML method below.");
        setPasteMode(true);
        return;
      }
      const sel = {};
      data.events.forEach((_, i) => { sel[i] = true; });
      setScrapedEvents(data.events);
      setSelectedScrape(sel);
      setPasteMode(false);
      setPastedHtml("");
      showToast(`Found ${data.events.length} event(s) from district.in ✨`);
    } catch {
      setScrapeError("Failed to reach district.in.");
      setPasteMode(true);
    } finally {
      setScraping(false);
    }
  };

  const importSelected = async () => {
    const toImport = scrapedEvents.filter((_, i) => selectedScrape[i]);
    if (!toImport.length) { showToast("Select at least one event"); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(toImport),
      });
      const data = await res.json();
      if (data.inserted !== undefined) {
        showToast(`Imported ${data.inserted} event(s)! 🎉`);
        setScrapedEvents([]);
        setSelectedScrape({});
        fetchEvents();
      } else {
        showToast(data.error || "Import failed");
      }
    } catch {
      showToast("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        if (data.pricing) setPricing({
          day:  { ...data.pricing.day  },
          week: { ...data.pricing.week },
          trip: { ...data.pricing.trip },
        });
        if (data.trial_keys) setTrialKeys(data.trial_keys);
        setDbStatus(data.db_status || "ok");
      }
    } catch { setDbStatus("error"); }
    setSettingsLoading(false);
  };

  const normalizeTrialCode = (value) => String(value || "").trim().toUpperCase();
  const resetNewKey = () => setNewKey({ code: "", label: "Trial Pass", duration_hours: 168, max_uses: 1 });
  const hasTrialKey = (keys, code) => keys.some((k) => normalizeTrialCode(k.code) === code);
  const buildPendingTrialKey = () => {
    const code = normalizeTrialCode(newKey.code);
    if (!code) return null;
    return { ...newKey, code, used_count: 0 };
  };

  const saveSettings = async (options = {}) => {
    const targetPricing = options.pricing || pricing;
    const hasExplicitTrialKeys = Object.prototype.hasOwnProperty.call(options, "trialKeys");
    let targetTrialKeys = hasExplicitTrialKeys ? options.trialKeys : trialKeys;
    let pendingKey = null;

    if (!hasExplicitTrialKeys) {
      pendingKey = buildPendingTrialKey();
      if (pendingKey) {
        if (hasTrialKey(targetTrialKeys, pendingKey.code)) {
          showToast("Key already exists");
          return false;
        }
        targetTrialKeys = [...targetTrialKeys, pendingKey];
      }
    }

    const successMessage = options.successMessage || (pendingKey ? "Trial key added and settings saved ✅" : "Settings saved ✅");

    setSettingsSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ pricing: targetPricing, trial_keys: targetTrialKeys }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(successMessage);
        setDbStatus("ok");
        if (pendingKey) {
          setTrialKeys(targetTrialKeys);
          resetNewKey();
        }
        return true;
      } else if (data.setup_required) {
        setDbStatus("table_missing");
        showToast("Settings table missing in Supabase — see setup instructions below");
      } else {
        showToast(data.error || "Save failed");
      }
    } catch { showToast("Save failed"); }
    finally { setSettingsSaving(false); }
    return false;
  };

  const addTrialKey = async () => {
    const nextKey = buildPendingTrialKey();
    if (!nextKey) { showToast("Enter a key code"); return; }
    if (hasTrialKey(trialKeys, nextKey.code)) { showToast("Key already exists"); return; }

    const nextTrialKeys = [...trialKeys, nextKey];
    setTrialKeys(nextTrialKeys);
    resetNewKey();

    await saveSettings({
      trialKeys: nextTrialKeys,
      successMessage: "Trial key added and saved ✅",
    });
  };

  const removeTrialKey = (code) => setTrialKeys((prev) => prev.filter((k) => k.code !== code));

  useEffect(() => {
    if (activeTab === "settings") loadSettings();
  }, [activeTab]);

  const aiBadge = (
    <span
      style={{
        background: "rgba(255,215,0,0.12)",
        border: "1px solid rgba(255,215,0,0.4)",
        color: "var(--neon-gold)",
        padding: "2px 6px",
        borderRadius: 6,
        fontSize: 9,
        marginLeft: 6,
        letterSpacing: "0.05em",
        fontWeight: 700
      }}
    >
      ✨ AI
    </span>
  );

  const labelStyle = { fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" };

  return (
    <main style={{ minHeight: "100vh", padding: "20px 16px", maxWidth: 1300, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 38,
            color: "var(--neon-pink)",
            textShadow: "0 0 16px rgba(255,45,120,0.5)"
          }}
        >
          🛠️ GoaNow Admin
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {adminUser && (
            <span style={{ color: "var(--text-muted)", fontSize: 13, textTransform: "capitalize" }}>
              👤 {adminUser}
            </span>
          )}
          <button onClick={onLogout} className="neon-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }}>
            Logout
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { id: "events", label: "Events" },
          { id: "users", label: "Users & Emails" },
          { id: "settings", label: "Settings & Pricing" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={activeTab === t.id ? "neon-btn" : "neon-btn-ghost"}
            style={{ fontSize: 14, padding: "8px 20px", minHeight: 36 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {settingsLoading ? (
            <div style={{ color: "var(--text-muted)", padding: 20 }}>Loading settings...</div>
          ) : (
            <>
              {/* DB STATUS BANNER */}
              {dbStatus === "table_missing" && (
                <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 12, padding: 16 }}>
                  <div style={{ color: "#fbbf24", fontWeight: 700, marginBottom: 8 }}>⚠️ Supabase settings table missing</div>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 10px" }}>
                    Trial keys from Railway env vars still work. To save keys via admin panel, run this SQL in your Supabase SQL editor:
                  </p>
                  <pre style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, fontSize: 11, color: "#a3e635", overflowX: "auto", margin: 0 }}>{`CREATE TABLE IF NOT EXISTS settings (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service full access" ON settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');`}</pre>
                </div>
              )}

              {dbStatus === "ok" && (
                <div style={{ background: "rgba(0,255,200,0.05)", border: "1px solid rgba(0,255,200,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--neon-cyan)" }}>
                  ✅ Supabase settings table connected
                </div>
              )}

              {/* PRICING */}
              <div className="glass-card" style={{ padding: 18 }}>
                <h2 style={{ margin: "0 0 16px", fontSize: 24, color: "#fff" }}>💰 Pricing</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  {["day", "week", "trip"].map((key) => (
                    <div key={key} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-glass)", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                        {key} pass
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Display Name
                          <input className="input-field" style={{ marginTop: 4 }} value={pricing[key]?.name || ""} onChange={(e) => setPricing((p) => ({ ...p, [key]: { ...p[key], name: e.target.value } }))} />
                        </label>
                        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Price (₹)
                          <input type="number" min="1" className="input-field" style={{ marginTop: 4 }} value={pricing[key]?.price || ""} onChange={(e) => setPricing((p) => ({ ...p, [key]: { ...p[key], price: parseInt(e.target.value) || 0 } }))} />
                        </label>
                        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Duration Label
                          <input className="input-field" style={{ marginTop: 4 }} value={pricing[key]?.label || ""} onChange={(e) => setPricing((p) => ({ ...p, [key]: { ...p[key], label: e.target.value } }))} />
                        </label>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <input type="checkbox" checked={!!pricing[key]?.popular} onChange={(e) => setPricing((p) => ({ ...p, [key]: { ...p[key], popular: e.target.checked } }))} style={{ accentColor: "var(--neon-pink)" }} />
                          Mark as Popular
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TRIAL KEYS */}
              <div className="glass-card" style={{ padding: 18 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 24, color: "#fff" }}>🔑 Trial Keys</h2>
                <p style={{ color: "var(--text-muted)", margin: "0 0 8px", fontSize: 13 }}>
                  Give free access to testers, influencers or press.
                </p>
                <div style={{ background: "rgba(0,245,255,0.05)", border: "1px solid rgba(0,245,255,0.15)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--neon-cyan)" }}>Quickest way:</strong> Add <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 5px", borderRadius: 4 }}>TRIAL_KEYS=CODE:HOURS</code> to Railway Variables (e.g. <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 5px", borderRadius: 4 }}>GOA2024:168</code>). Works immediately, no DB needed.
                </div>

                {/* Add new key */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "end", marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 0 }}>
                    Key Code
                    <input className="input-field" style={{ marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }} placeholder="GOA2024" value={newKey.code} onChange={(e) => setNewKey((k) => ({ ...k, code: e.target.value.toUpperCase() }))} />
                  </label>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 0 }}>
                    Label
                    <input className="input-field" style={{ marginTop: 4 }} placeholder="Trial Pass" value={newKey.label} onChange={(e) => setNewKey((k) => ({ ...k, label: e.target.value }))} />
                  </label>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 0 }}>
                    Hours
                    <input type="number" min="1" className="input-field" style={{ marginTop: 4 }} value={newKey.duration_hours} onChange={(e) => setNewKey((k) => ({ ...k, duration_hours: parseInt(e.target.value) || 168 }))} />
                  </label>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 0 }}>
                    Max Uses
                    <input type="number" min="1" className="input-field" style={{ marginTop: 4 }} value={newKey.max_uses} onChange={(e) => setNewKey((k) => ({ ...k, max_uses: parseInt(e.target.value) || 1 }))} />
                  </label>
                  <button type="button" onClick={addTrialKey} disabled={settingsSaving} className="neon-btn-ghost" style={{ padding: "10px 14px", alignSelf: "end", width: "100%" }}>
                    {settingsSaving ? "Saving..." : "➕ Add"}
                  </button>
                </div>

                {trialKeys.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No trial keys yet.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)" }}>
                          {["Code", "Label", "Duration", "Uses", ""].map((h) => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trialKeys.map((k) => (
                          <tr key={k.code} style={{ borderTop: "1px solid var(--border-glass)", opacity: k.from_env ? 0.75 : 1 }}>
                            <td style={{ padding: "10px", color: "var(--neon-cyan)", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                              {k.code}
                              {k.from_env && <span style={{ marginLeft: 6, fontSize: 9, background: "rgba(0,245,255,0.15)", color: "var(--neon-cyan)", padding: "1px 5px", borderRadius: 4 }}>ENV</span>}
                            </td>
                            <td style={{ padding: "10px", color: "#fff" }}>{k.label}</td>
                            <td style={{ padding: "10px", color: "#fff" }}>{k.duration_hours}h</td>
                            <td style={{ padding: "10px", color: k.used_count >= k.max_uses ? "#fca5a5" : "#fff" }}>
                              {k.from_env ? "∞" : `${k.used_count}/${k.max_uses}`}
                            </td>
                            <td style={{ padding: "10px" }}>
                              {k.from_env
                                ? <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Railway env</span>
                                : <button onClick={() => removeTrialKey(k.code)} className="neon-btn-ghost" style={{ padding: "4px 8px", minHeight: 28, fontSize: 12, borderColor: "rgba(239,68,68,0.3)", color: "#fca5a5" }}>🗑️</button>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => saveSettings()} disabled={settingsSaving} className="neon-btn" style={{ alignSelf: "flex-start", minWidth: 180 }}>
                {settingsSaving ? "Saving..." : "💾 Save All Settings"}
              </button>

              {/* PARTY BLAST */}
              <div className="glass-card" style={{ padding: 18 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#fff" }}>📧 Tonight's Party Blast</h2>
                <p style={{ color: "var(--text-muted)", margin: "0 0 14px", fontSize: 13 }}>
                  Sends today's events as an email to all subscribed users via Resend. Use sparingly — typically once per evening.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Send tonight's party blast to all email subscribers?")) return;
                    try {
                      const res = await fetch("/api/email/party-blast", { method: "POST", headers: getAuthHeaders() });
                      const data = await res.json();
                      if (data.success) showToast(`Sent ${data.sent}/${data.total} 📧 (${data.events} event${data.events === 1 ? "" : "s"})`);
                      else showToast(data.error || "Blast failed");
                    } catch { showToast("Blast failed"); }
                  }}
                  className="neon-btn neon-btn-cyan"
                  style={{ alignSelf: "flex-start", minWidth: 220 }}
                >
                  🌙 Send Tonight's Blast Now
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <UsersTab getAuthHeaders={getAuthHeaders} showToast={showToast} />
      )}

      {activeTab === "events" && <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
          gap: 18
        }}
      >
        {/* LEFT — FORM */}
        <div ref={formRef} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <form onSubmit={submit} className="glass-card" style={{ padding: 18 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 24, color: "#fff" }}>
              {event.id ? "✏️ Edit Event" : "➕ Add Tonight's Party"}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <Field label="Event Name *" filled={aiFilled.name} aiBadge={aiBadge}>
                <input className="input-field" value={event.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>

              <Field label="Venue *" filled={aiFilled.venue} aiBadge={aiBadge}>
                <input className="input-field" value={event.venue} onChange={(e) => set("venue", e.target.value)} required />
              </Field>

              <Field label='Area * (e.g. "Vagator")' filled={aiFilled.area} aiBadge={aiBadge}>
                <input className="input-field" value={event.area} onChange={(e) => set("area", e.target.value)} required />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Date *" filled={aiFilled.date} aiBadge={aiBadge}>
                  <input type="date" className="input-field" value={event.date} onChange={(e) => set("date", e.target.value)} required />
                </Field>
                <Field label="Publish On" hint="Set future date to schedule">
                  <input type="date" className="input-field" value={event.publish_on} onChange={(e) => set("publish_on", e.target.value)} />
                </Field>
              </div>

              <Field label='Start Time * (e.g. "10 PM")' filled={aiFilled.start_time} aiBadge={aiBadge}>
                <input className="input-field" value={event.start_time} onChange={(e) => set("start_time", e.target.value)} required />
              </Field>

              <Field
                label="Entry Fee"
                hint="Leave blank if unknown — shows as 'Entry TBC'"
                filled={aiFilled.entry_fee}
                aiBadge={aiBadge}
              >
                <input
                  className="input-field"
                  placeholder="Free / ₹500 / Check at venue"
                  value={event.entry_fee}
                  onChange={(e) => set("entry_fee", e.target.value)}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Vibe" filled={aiFilled.vibe} aiBadge={aiBadge}>
                  <select className="input-field" value={event.vibe} onChange={(e) => set("vibe", e.target.value)}>
                    <option value="" style={{ background: "#0A0A0F" }}>Select…</option>
                    {VIBE_OPTIONS.map((v) => (
                      <option key={v} value={v} style={{ background: "#0A0A0F" }}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select className="input-field" value={event.status} onChange={(e) => set("status", e.target.value)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value} style={{ background: "#0A0A0F" }}>{s.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label='Source (e.g. "@goavibes")' filled={aiFilled.source} aiBadge={aiBadge}>
                <input className="input-field" value={event.source} onChange={(e) => set("source", e.target.value)} />
              </Field>

              <Field label="Description (optional)">
                <textarea
                  className="input-field"
                  rows={2}
                  style={{ resize: "vertical", minHeight: 60 }}
                  value={event.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>

              <Field label="Insider Tip (optional)">
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="e.g. Crowd comes after midnight, park on main road, free entry before 11PM..."
                  style={{ resize: "vertical", minHeight: 60 }}
                  value={event.insider_tip}
                  onChange={(e) => set("insider_tip", e.target.value)}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Lat (optional)">
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    value={event.lat}
                    onChange={(e) => set("lat", e.target.value)}
                  />
                </Field>
                <Field label="Lng (optional)">
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    value={event.lng}
                    onChange={(e) => set("lng", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button type="submit" disabled={submitting} className="neon-btn" style={{ flex: 1, minWidth: 160 }}>
                {submitting ? "Saving..." : event.id ? "✅ Update Event" : "➕ Add Event"}
              </button>
              <button type="button" onClick={resetForm} className="neon-btn-ghost">
                {event.id ? "✕ Cancel Edit" : "🗑️ Clear Form"}
              </button>
            </div>
          </form>

          {/* FLYER UPLOAD */}
          <div className="glass-card" style={{ padding: 18 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#fff" }}>
              📸 Got a flyer? AI will fill the form
            </h2>
            <p style={{ color: "var(--text-muted)", margin: "0 0 14px", fontSize: 13 }}>
              Screenshot the Instagram story and upload it
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                border: "2px dashed var(--border-glass)",
                borderRadius: 14,
                padding: 20,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: "rgba(255,255,255,0.02)"
              }}
              onClick={() => document.getElementById("flyer-input").click()}
            >
              <input
                id="flyer-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFlyerChange}
                style={{ display: "none" }}
              />
              {flyerPreview ? (
                <img src={flyerPreview} alt="Flyer" style={{ maxHeight: 280, maxWidth: "100%", borderRadius: 10 }} />
              ) : (
                <div style={{ color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 36 }}>📤</div>
                  <div>Drop a flyer image, or click to upload</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>JPG, PNG, WEBP</div>
                </div>
              )}
            </div>

            {flyer && (
              <button
                type="button"
                onClick={extractFlyer}
                disabled={extracting}
                className="neon-btn neon-btn-cyan"
                style={{ width: "100%", marginTop: 12 }}
              >
                {extracting ? "🤖 Reading your flyer..." : "🔍 Extract with AI"}
              </button>
            )}

            {extractError && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5",
                  borderRadius: 8,
                  fontSize: 13
                }}
              >
                {extractError}
              </div>
            )}
          </div>

          {/* DISTRICT.IN IMPORT */}
          <div className="glass-card" style={{ padding: 18 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#fff" }}>
              🌐 Import from District.in
            </h2>
            <p style={{ color: "var(--text-muted)", margin: "0 0 14px", fontSize: 13 }}>
              Claude Haiku extracts live Goa events from district.in.
            </p>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => { setPasteMode(false); setScrapeError(null); }}
                className={!pasteMode ? "neon-btn" : "neon-btn-ghost"}
                style={{ flex: 1, fontSize: 13, padding: "8px 12px", minHeight: 36 }}
              >
                🔍 Auto Fetch
              </button>
              <button
                type="button"
                onClick={() => { setPasteMode(true); setScrapeError(null); }}
                className={pasteMode ? "neon-btn" : "neon-btn-ghost"}
                style={{ flex: 1, fontSize: 13, padding: "8px 12px", minHeight: 36 }}
              >
                📋 Paste HTML
              </button>
            </div>

            {!pasteMode ? (
              <>
                <button
                  type="button"
                  onClick={() => scrapeDistrict(false)}
                  disabled={scraping}
                  className="neon-btn neon-btn-cyan"
                  style={{ width: "100%" }}
                >
                  {scraping ? "🤖 Haiku is scanning district.in..." : "🔍 Fetch Goa Events from District.in"}
                </button>
              </>
            ) : (
              <>
                <div style={{ background: "rgba(0,245,255,0.05)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--neon-cyan)" }}>How to paste Goa events:</strong>
                  <ol style={{ margin: "6px 0 0 16px", padding: 0 }}>
                    <li>Open <strong>district.in</strong> in your browser</li>
                    <li>Make sure <strong>Goa</strong> is selected as city (as shown in the top bar)</li>
                    <li>Press <strong>Ctrl+A</strong> then <strong>Ctrl+C</strong> to copy the whole page</li>
                    <li>Paste below and click Extract</li>
                  </ol>
                </div>
                <textarea
                  value={pastedHtml}
                  onChange={(e) => setPastedHtml(e.target.value)}
                  placeholder="Paste the copied page content here..."
                  className="input-field"
                  style={{ width: "100%", minHeight: 120, resize: "vertical", fontSize: 12, fontFamily: "monospace", marginBottom: 10, boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => scrapeDistrict(true)}
                  disabled={scraping || !pastedHtml.trim()}
                  className="neon-btn neon-btn-cyan"
                  style={{ width: "100%" }}
                >
                  {scraping ? "🤖 Haiku is extracting events..." : "🤖 Extract Goa Events with Haiku"}
                </button>
              </>
            )}

            {scrapeError && (
              <div style={{ marginTop: 10, padding: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", borderRadius: 8, fontSize: 13 }}>
                {scrapeError}
              </div>
            )}

            {scrapedEvents.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {Object.values(selectedScrape).filter(Boolean).length} of {scrapedEvents.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = scrapedEvents.every((_, i) => selectedScrape[i]);
                      const next = {};
                      scrapedEvents.forEach((_, i) => { next[i] = !allSelected; });
                      setSelectedScrape(next);
                    }}
                    className="neon-btn-ghost"
                    style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
                  >
                    {scrapedEvents.every((_, i) => selectedScrape[i]) ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {scrapedEvents.map((ev, i) => (
                    <label
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: 10,
                        borderRadius: 8,
                        background: selectedScrape[i] ? "rgba(0,255,200,0.06)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selectedScrape[i] ? "rgba(0,255,200,0.2)" : "var(--border-glass)"}`,
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedScrape[i]}
                        onChange={(e) => setSelectedScrape((prev) => ({ ...prev, [i]: e.target.checked }))}
                        style={{ marginTop: 2, accentColor: "var(--neon-cyan)" }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{ev.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          {ev.venue} · {ev.area} · {ev.date} · {ev.start_time || "TBC"} · {ev.entry_fee}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={importSelected}
                  disabled={importing || !Object.values(selectedScrape).some(Boolean)}
                  className="neon-btn"
                  style={{ width: "100%", marginTop: 12 }}
                >
                  {importing ? "Importing..." : `⬇️ Import Selected Events`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — TABLE */}
        <div className="glass-card" style={{ padding: 18, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 22, color: "#fff" }}>📅 Events</h2>
            <button
              onClick={() => setShowWeek((s) => !s)}
              className="category-pill"
            >
              🗓️ {showWeek ? "Show Today" : "Show last 7 days"}
            </button>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 10 }}>
            Showing {events.length} event{events.length === 1 ? "" : "s"}
          </div>

          {loadingEvents ? (
            <div style={{ color: "var(--text-muted)", padding: 20 }}>Loading...</div>
          ) : events.length === 0 ? (
            <div style={{ color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
              No events yet. Add one on the left.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={th}>Name</th>
                    <th style={th}>Area</th>
                    <th style={th}>Time</th>
                    <th style={th}>Entry</th>
                    <th style={th}>Status</th>
                    <th style={th}>Publish</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} style={{ borderTop: "1px solid var(--border-glass)" }}>
                      <td style={td}>{ev.name}</td>
                      <td style={td}>{ev.area}</td>
                      <td style={td}>{ev.start_time}</td>
                      <td style={td}>{ev.entry_fee || "—"}</td>
                      <td style={td}>{ev.status}</td>
                      <td style={td}>{ev.publish_on || "—"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => editEvent(ev)}
                            className="neon-btn-ghost"
                            style={{ padding: "4px 8px", minHeight: 28, fontSize: 12 }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteEvent(ev)}
                            className="neon-btn-ghost"
                            style={{ padding: "4px 8px", minHeight: 28, fontSize: 12, borderColor: "rgba(239,68,68,0.3)", color: "#fca5a5" }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>}

      {toast && <div className="toast">{toast}</div>}

      <style jsx>{`
        @media (max-width: 900px) {
          main > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

const USER_PAYMENTS_SQL = `CREATE TABLE IF NOT EXISTS user_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  plan_name TEXT,
  amount_paise INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  source TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_payments_email_idx ON user_payments(email);
ALTER TABLE user_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service full access" ON user_payments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');`;

function UsersTab({ getAuthHeaders, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      const json = await res.json();
      if (json.success) setData(json);
      else showToast(json.error || "Could not load users");
    } catch {
      showToast("Could not load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const sendWelcome = async (email = null) => {
    const target = email || "all non-unsubscribed users";
    if (!confirm(`Send welcome email to ${target}?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/users/welcome", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(email ? { email } : {}),
      });
      const json = await res.json();
      if (json.sent !== undefined) {
        showToast(`Welcome sent ${json.sent}/${json.total}${json.failed ? `, failed ${json.failed}` : ""}`);
      } else {
        showToast(json.error || "Welcome email failed");
      }
    } catch {
      showToast("Welcome email failed");
    } finally {
      setActionLoading(false);
    }
  };

  const stats = data?.stats || {};
  const emailStatus = data?.email_status || {};
  const missingTables = data?.missing_tables || [];
  const users = data?.users || [];
  const featureTotals = data?.feature_totals || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="glass-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 26, color: "#fff" }}>Users & Emails</h2>
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
              Passes, paid history, repeat purchases, feature usage, and welcome email status.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={loadUsers} disabled={loading} className="neon-btn-ghost" style={{ minHeight: 36 }}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={() => sendWelcome()} disabled={actionLoading || loading || !users.length} className="neon-btn neon-btn-cyan" style={{ minHeight: 36 }}>
              {actionLoading ? "Sending..." : "Send Welcome To All"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 20 }}>Loading users...</div>
      ) : (
        <>
          <div className="admin-stats-grid">
            <StatCard label="Total users" value={stats.total_users || 0} />
            <StatCard label="Active passes" value={stats.active_passes || 0} />
            <StatCard label="Paid users" value={stats.paid_users || 0} />
            <StatCard label="Repeat payers" value={stats.repeat_payers || 0} />
            <StatCard label="Payments" value={stats.payment_count || 0} />
            <StatCard label="Revenue" value={`Rs ${stats.total_revenue_inr || 0}`} />
            <StatCard label="Trial users" value={stats.trial_users || 0} />
            <StatCard label="Opted out" value={stats.opted_out || 0} />
          </div>

          <div className="admin-user-grid">
            <div className="glass-card" style={{ padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 20 }}>Resend Status</h3>
              <InfoRow label="API key" value={emailStatus.configured ? "Configured" : "Missing"} good={emailStatus.configured} />
              <InfoRow label="From" value={emailStatus.from || "Not set"} />
              <InfoRow label="Site URL" value={emailStatus.siteUrl || "Not set"} />
              {!emailStatus.configured && (
                <div style={{ marginTop: 12, color: "#fca5a5", fontSize: 13 }}>
                  Add RESEND_API_KEY on Railway, and make sure RESEND_FROM uses a verified Resend domain.
                </div>
              )}
            </div>

            <div className="glass-card" style={{ padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 20 }}>Most Used Features</h3>
              {featureTotals.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No feature usage recorded yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {featureTotals.slice(0, 7).map((item) => (
                    <div key={item.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#fff", fontSize: 13 }}>
                      <span>{item.name}</span>
                      <strong style={{ color: "var(--neon-cyan)" }}>{item.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {missingTables.length > 0 && (
            <div className="glass-card" style={{ padding: 18, borderColor: "rgba(251,191,36,0.4)" }}>
              <h3 style={{ margin: "0 0 8px", color: "#fbbf24", fontSize: 18 }}>Supabase setup needed</h3>
              <p style={{ color: "var(--text-muted)", margin: "0 0 12px", fontSize: 13 }}>
                Missing table(s): {missingTables.join(", ")}. Payment history will start tracking after the table exists.
              </p>
              {missingTables.includes("user_payments") && (
                <pre style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, fontSize: 11, color: "#a3e635", overflowX: "auto", margin: 0 }}>
                  {USER_PAYMENTS_SQL}
                </pre>
              )}
            </div>
          )}

          {data?.errors?.length > 0 && (
            <div className="glass-card" style={{ padding: 14, borderColor: "rgba(239,68,68,0.35)", color: "#fca5a5", fontSize: 13 }}>
              {data.errors.map((err) => `${err.table}: ${err.message}`).join(" | ")}
            </div>
          )}

          <div className="glass-card" style={{ padding: 18, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 22 }}>User Details</h3>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{users.length} user{users.length === 1 ? "" : "s"}</span>
            </div>

            {users.length === 0 ? (
              <div style={{ color: "var(--text-muted)", padding: 20, textAlign: "center" }}>No users found yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 980 }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={th}>Email</th>
                      <th style={th}>Plan</th>
                      <th style={th}>Status</th>
                      <th style={th}>Payments</th>
                      <th style={th}>Most used</th>
                      <th style={th}>Subscriber</th>
                      <th style={th}>Last seen</th>
                      <th style={th}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.email} style={{ borderTop: "1px solid var(--border-glass)" }}>
                        <td style={td}>
                          <div style={{ fontWeight: 700 }}>{user.email}</div>
                          {user.bonus_builds > 0 && (
                            <div style={{ color: "var(--neon-cyan)", fontSize: 12, marginTop: 3 }}>
                              {user.bonus_builds} bonus AI builds
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          <div>{user.plan_name || "Unknown"}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{user.source || "no source"}</div>
                        </td>
                        <td style={td}>
                          <StatusPill active={user.active} />
                          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 5 }}>
                            {user.expires_at ? `Expires ${formatDate(user.expires_at)}` : "No expiry"}
                          </div>
                        </td>
                        <td style={td}>
                          <div>{user.payment_count} time{user.payment_count === 1 ? "" : "s"}</div>
                          <div style={{ color: "var(--neon-cyan)", fontSize: 12 }}>Rs {Math.round(user.total_paid_inr || 0)}</div>
                          {user.last_payment_at && (
                            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatDate(user.last_payment_at)}</div>
                          )}
                        </td>
                        <td style={td}>
                          {user.most_used_feature ? (
                            <>
                              <div>{user.most_used_feature.name}</div>
                              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{user.most_used_feature.count} event{user.most_used_feature.count === 1 ? "" : "s"}</div>
                            </>
                          ) : "No usage"}
                        </td>
                        <td style={td}>
                          {user.opted_out ? (
                            <span style={{ color: "#fca5a5" }}>Opted out</span>
                          ) : (
                            <span style={{ color: "var(--neon-cyan)" }}>Subscribed</span>
                          )}
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{user.subscriber_source || "-"}</div>
                        </td>
                        <td style={td}>{user.last_seen_at ? formatDate(user.last_seen_at) : "-"}</td>
                        <td style={td}>
                          <button
                            type="button"
                            onClick={() => sendWelcome(user.email)}
                            disabled={actionLoading}
                            className="neon-btn-ghost"
                            style={{ padding: "5px 10px", minHeight: 30, fontSize: 12 }}
                          >
                            Welcome
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .admin-user-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
          gap: 14px;
        }
        @media (max-width: 760px) {
          .admin-stats-grid,
          .admin-user-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="glass-card" style={{ padding: 14 }}>
      <div style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ color: "#fff", fontSize: 28, fontFamily: "'Bebas Neue'", marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value, good }) {
  const color = good === undefined ? "#fff" : good ? "var(--neon-cyan)" : "#fca5a5";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-glass)", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function StatusPill({ active }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      padding: "3px 8px",
      fontSize: 11,
      fontWeight: 700,
      color: active ? "var(--neon-cyan)" : "#fca5a5",
      border: `1px solid ${active ? "rgba(51,214,200,0.35)" : "rgba(239,68,68,0.35)"}`,
      background: active ? "rgba(51,214,200,0.08)" : "rgba(239,68,68,0.08)",
    }}>
      {active ? "Active" : "Expired"}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

const th = {
  padding: "8px 10px",
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  fontWeight: 600
};
const td = {
  padding: "10px",
  color: "#fff",
  verticalAlign: "top"
};

function Field({ label, hint, filled, aiBadge, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
        {label}
        {filled && aiBadge}
      </div>
      {children}
      {hint && (
        <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}
