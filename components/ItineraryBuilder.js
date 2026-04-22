"use client";

import { useEffect, useRef, useState } from "react";

const PLACEHOLDERS = [
  "I'm in Calangute for 3 days, ₹4000 budget, want beaches and good food...",
  "Staying in Morjim, 2 of us, ₹8000, she wants chill, I want adventure...",
  "Solo in Palolem, ₹2000/day, show me hidden Goa most tourists never find...",
  "First time in Goa, Baga area, ₹5000 for 2 days, we love parties and seafood..."
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
    const t = setInterval(() => {
      setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    const trimmed = input.trim();
    if (trimmed.length < 20) {
      setError("Tell us a bit more — where are you staying and what's your budget? 😊");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed })
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
    } catch (e) {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setToast("Copied! 📋");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast("Couldn't copy. Try selecting manually.");
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
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: 28,
            color: "var(--neon-pink)",
            textShadow: "0 0 16px rgba(255,45,120,0.4)"
          }}
        >
          🗺️ AI Itinerary Builder
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "0 0 14px", fontSize: 13 }}>
          Tell us where you're staying, your budget, how many days, and what you feel like doing.
          The more detail, the better your plan.
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
            style={{
              resize: "vertical",
              minHeight: 120,
              fontSize: 15,
              lineHeight: 1.5,
              fontFamily: "inherit"
            }}
            disabled={loading}
          />

          {error && (
            <div
              style={{
                color: "#fca5a5",
                fontSize: 13,
                marginTop: 8,
                background: "rgba(239,68,68,0.08)",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.2)"
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="neon-btn"
            style={{ width: "100%", marginTop: 14, fontSize: 16 }}
          >
            {loading ? "Building..." : "Build My Goa Plan →"}
          </button>
        </form>
      </div>

      {loading && (
        <div
          className="glass-card"
          style={{ padding: 30, textAlign: "center" }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--neon-pink)",
              animation: "pulseNeon 1.6s ease-in-out infinite",
              textShadow: "0 0 16px rgba(255,45,120,0.5)"
            }}
          >
            🔥 GoaNow AI is crafting your perfect Goa plan...
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
            This usually takes 8–15 seconds
          </div>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="glass-card" style={{ padding: 22 }}>
          <h3
            style={{
              margin: "0 0 14px",
              fontSize: 22,
              color: "var(--neon-cyan)",
              textShadow: "0 0 12px rgba(0,245,255,0.4)"
            }}
          >
            ✨ Your Personalized Goa Plan
          </h3>
          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
              fontSize: 15,
              color: "#fff",
              fontFamily: "'Inter', sans-serif"
            }}
          >
            {result}
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 20,
              flexWrap: "wrap"
            }}
          >
            <button onClick={handleCopy} className="neon-btn" style={{ flex: 1, minWidth: 140 }}>
              📋 Copy Plan
            </button>
            <button onClick={handleReset} className="neon-btn-ghost" style={{ flex: 1, minWidth: 140 }}>
              🔄 Build Another
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
