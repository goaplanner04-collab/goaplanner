"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

const PLACEHOLDERS = [
  "I'm in Calangute for 3 days, Rs 4000 budget, want beaches and good food...",
  "Staying in Morjim, 2 of us, Rs 8000, she wants chill, I want adventure...",
  "Solo in Palolem, Rs 2000/day, show me hidden Goa most tourists never find...",
  "First time in Goa, Baga area, Rs 5000 for 2 days, we love parties and seafood...",
];

export default function ItineraryBuilder() {
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [phIndex, setPhIndex] = useState(0);
  const resultRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    const trimmed = input.trim();
    if (trimmed.length < 20) {
      setError("Tell us a bit more: where are you staying and what is your budget?");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.itinerary) {
        setError(data.error || "Could not build your plan. Try again.");
        setLoading(false);
        return;
      }
      setResult(data.itinerary);
      setLoading(false);
      setTimeout(() => {
        resultRef.current && resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setToast("Copied");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Could not copy. Try selecting manually.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleReset = () => {
    setResult(null);
    setInput("");
    setError(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glass-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <span className="icon-tile">
            <Icon name="route" size={22} />
          </span>
          <h2 style={{ margin: 0, fontSize: 28, color: "var(--neon-pink)", textShadow: "0 0 16px rgba(255,45,120,0.32)" }}>
            AI Itinerary Builder
          </h2>
        </div>
        <p style={{ color: "var(--text-muted)", margin: "0 0 14px", fontSize: 13, lineHeight: 1.55 }}>
          Tell us your area, budget, number of days, and what kind of Goa you want.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder={PLACEHOLDERS[phIndex]}
            rows={5}
            className="input-field"
            style={{ resize: "vertical", minHeight: 120, fontSize: 15, lineHeight: 1.5, fontFamily: "inherit" }}
            disabled={loading}
          />

          {error && (
            <div style={{ color: "#fca5a5", fontSize: 13, marginTop: 8, background: "rgba(239,68,68,0.08)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="neon-btn" style={{ width: "100%", marginTop: 14, fontSize: 16 }}>
            <Icon name="sparkles" size={18} />
            {loading ? "Building..." : "Build My Goa Plan"}
            {!loading && <Icon name="arrow-right" size={18} />}
          </button>
        </form>
      </div>

      {loading && (
        <div className="glass-card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 700, color: "var(--neon-pink)", animation: "pulseNeon 1.6s ease-in-out infinite", textShadow: "0 0 16px rgba(255,45,120,0.42)" }}>
            <Icon name="sparkles" size={20} />
            GoaNow AI is crafting your plan
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
            This usually takes 8-15 seconds
          </div>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="glass-card" style={{ padding: 22 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 14px", fontSize: 22, color: "var(--neon-cyan)", textShadow: "0 0 12px rgba(51,214,200,0.32)" }}>
            <Icon name="sparkles" size={18} />
            Your Personalized Goa Plan
          </h3>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 15, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
            {result}
          </div>
          <div className="card-actions" style={{ marginTop: 20 }}>
            <button onClick={handleCopy} className="neon-btn mobile-full" style={{ flex: 1, minWidth: 140 }}>
              <Icon name="card" size={17} />
              Copy Plan
            </button>
            <button onClick={handleReset} className="neon-btn-ghost mobile-full" style={{ flex: 1, minWidth: 140 }}>
              <Icon name="refresh" size={17} />
              Build Another
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
