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
  const [pwd, setPwd] = useState("");
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("admin_auth") === "true") {
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
        body: JSON.stringify({ password: pwd })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("admin_auth", "true");
        sessionStorage.setItem("admin_pwd", pwd);
        setAuthed(true);
      } else {
        setAuthError("Wrong password");
      }
    } catch (e) {
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
          padding: 20
        }}
      >
        <form onSubmit={handleLogin} className="glass-card" style={{ padding: 30, width: "100%", maxWidth: 380 }}>
          <h1
            style={{
              margin: "0 0 6px",
              color: "var(--neon-pink)",
              fontSize: 38,
              textShadow: "0 0 16px rgba(255,45,120,0.5)"
            }}
          >
            🔐 Admin
          </h1>
          <p style={{ color: "var(--text-muted)", margin: "0 0 18px", fontSize: 14 }}>
            Enter the admin password to manage events.
          </p>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Password"
            className="input-field"
            autoFocus
          />
          {authError && (
            <div style={{ color: "#fca5a5", fontSize: 13, marginTop: 10 }}>{authError}</div>
          )}
          <button type="submit" disabled={authLoading} className="neon-btn" style={{ width: "100%", marginTop: 16 }}>
            {authLoading ? "Checking..." : "Enter"}
          </button>
        </form>
      </main>
    );
  }

  return <AdminDashboard onLogout={() => {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_pwd");
    setAuthed(false);
  }} />;
}

function AdminDashboard({ onLogout }) {
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
  const [activeTab, setActiveTab] = useState("events");
  const [pricing, setPricing] = useState({
    day:  { price: 49,  name: "Day Pass",  label: "24 hours", popular: false },
    week: { price: 99,  name: "Week Pass", label: "7 days",   popular: true  },
    trip: { price: 149, name: "Trip Pass", label: "30 days",  popular: false },
  });
  const [trialKeys, setTrialKeys] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
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

  const scrapeDistrict = async () => {
    setScraping(true);
    setScrapeError(null);
    setScrapedEvents([]);
    setSelectedScrape({});
    try {
      const res = await fetch("/api/admin/scrape-district", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!data.success) {
        setScrapeError(data.error || "Scrape failed");
        return;
      }
      if (data.events.length === 0) {
        setScrapeError("No Goa events found on district.in right now. Try again later.");
        return;
      }
      const sel = {};
      data.events.forEach((_, i) => { sel[i] = true; });
      setScrapedEvents(data.events);
      setSelectedScrape(sel);
      showToast(`Found ${data.events.length} event(s) from district.in ✨`);
    } catch {
      setScrapeError("Failed to reach district.in. Check your connection.");
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
      }
    } catch {}
    setSettingsLoading(false);
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ pricing, trial_keys: trialKeys }),
      });
      const data = await res.json();
      if (data.success) showToast("Settings saved ✅");
      else showToast(data.error || "Save failed");
    } catch { showToast("Save failed"); }
    setSettingsSaving(false);
  };

  const addTrialKey = () => {
    if (!newKey.code.trim()) { showToast("Enter a key code"); return; }
    const code = newKey.code.trim().toUpperCase();
    if (trialKeys.find((k) => k.code === code)) { showToast("Key already exists"); return; }
    setTrialKeys((prev) => [...prev, { ...newKey, code, used_count: 0 }]);
    setNewKey({ code: "", label: "Trial Pass", duration_hours: 168, max_uses: 1 });
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
        <button onClick={onLogout} className="neon-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }}>
          Logout
        </button>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[{ id: "events", label: "📅 Events" }, { id: "settings", label: "⚙️ Settings & Pricing" }].map((t) => (
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
                <p style={{ color: "var(--text-muted)", margin: "0 0 16px", fontSize: 13 }}>
                  Give free access to testers, influencers or press. Each key can be used a limited number of times.
                </p>

                {/* Add new key */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 80px auto", gap: 8, alignItems: "end", marginBottom: 16, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Key Code
                    <input className="input-field" style={{ marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }} placeholder="GOA2024" value={newKey.code} onChange={(e) => setNewKey((k) => ({ ...k, code: e.target.value.toUpperCase() }))} />
                  </label>
                  <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Label
                    <input className="input-field" style={{ marginTop: 4 }} placeholder="Trial Pass" value={newKey.label} onChange={(e) => setNewKey((k) => ({ ...k, label: e.target.value }))} />
                  </label>
                  <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Hours
                    <input type="number" min="1" className="input-field" style={{ marginTop: 4 }} value={newKey.duration_hours} onChange={(e) => setNewKey((k) => ({ ...k, duration_hours: parseInt(e.target.value) || 168 }))} />
                  </label>
                  <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Max Uses
                    <input type="number" min="1" className="input-field" style={{ marginTop: 4 }} value={newKey.max_uses} onChange={(e) => setNewKey((k) => ({ ...k, max_uses: parseInt(e.target.value) || 1 }))} />
                  </label>
                  <button type="button" onClick={addTrialKey} className="neon-btn-ghost" style={{ padding: "10px 14px", alignSelf: "end" }}>
                    ➕ Add
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
                          <tr key={k.code} style={{ borderTop: "1px solid var(--border-glass)" }}>
                            <td style={{ padding: "10px", color: "var(--neon-cyan)", fontFamily: "monospace", letterSpacing: "0.1em" }}>{k.code}</td>
                            <td style={{ padding: "10px", color: "#fff" }}>{k.label}</td>
                            <td style={{ padding: "10px", color: "#fff" }}>{k.duration_hours}h</td>
                            <td style={{ padding: "10px", color: k.used_count >= k.max_uses ? "#fca5a5" : "#fff" }}>
                              {k.used_count}/{k.max_uses}
                            </td>
                            <td style={{ padding: "10px" }}>
                              <button onClick={() => removeTrialKey(k.code)} className="neon-btn-ghost" style={{ padding: "4px 8px", minHeight: 28, fontSize: 12, borderColor: "rgba(239,68,68,0.3)", color: "#fca5a5" }}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <button type="button" onClick={saveSettings} disabled={settingsSaving} className="neon-btn" style={{ alignSelf: "flex-start", minWidth: 180 }}>
                {settingsSaving ? "Saving..." : "💾 Save All Settings"}
              </button>
            </>
          )}
        </div>
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
              Claude Haiku scrapes live Goa events from district.in and imports them automatically.
            </p>

            <button
              type="button"
              onClick={scrapeDistrict}
              disabled={scraping}
              className="neon-btn neon-btn-cyan"
              style={{ width: "100%" }}
            >
              {scraping ? "🤖 Haiku is scanning district.in..." : "🔍 Fetch Goa Events from District.in"}
            </button>

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
