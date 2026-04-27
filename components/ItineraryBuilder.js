"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

function ItineraryWithPhotos({ text, placePhotos }) {
  if (!text) return null;
  const lines = text.split("\n");
  // Sort place names by length DESC so longer names match first when they share a prefix
  const placeNames = Object.keys(placePhotos).sort((a, b) => b.length - a.length);

  return (
    <div style={{ lineHeight: 1.7, fontSize: 15, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      {lines.map((line, idx) => {
        let matched = null;
        if (line.startsWith("📍")) {
          matched = placeNames.find((n) => line.includes(n)) || null;
        }
        const photos = matched ? placePhotos[matched] : null;
        const hasPhotos = Array.isArray(photos) && photos.length > 0;
        return (
          <div key={idx}>
            <div style={{ whiteSpace: "pre-wrap" }}>{line || " "}</div>
            {hasPhotos && (
              <div style={{ display: "flex", gap: 4, margin: "8px 0 12px" }}>
                {photos.slice(0, 2).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={matched}
                    loading="lazy"
                    style={{
                      flex: 1,
                      width: "50%",
                      height: 140,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PLACEHOLDERS = [
  "I'm in Calangute for 3 days, Rs 4000 budget, want beaches and good food...",
  "Staying in Morjim, 2 of us, Rs 8000, she wants chill, I want adventure...",
  "Solo in Palolem, Rs 2000/day, show me hidden Goa most tourists never find...",
  "First time in Goa, Baga area, Rs 5000 for 2 days, we love parties and seafood...",
];

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("goanow_session_id");
    if (!id) {
      id = (crypto.randomUUID?.() || `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
      localStorage.setItem("goanow_session_id", id);
    }
    return id;
  } catch {
    return "";
  }
}

export default function ItineraryBuilder() {
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null); // { dataSource, placesChecked, redditSourced, userArea, language, budgetMissing, buildsRemaining }
  const [placePhotos, setPlacePhotos] = useState(null);
  const [toast, setToast] = useState(null);
  const [phIndex, setPhIndex] = useState(0);
  const [clarification, setClarification] = useState(null); // { message, areaSuggestions }
  const [limitModal, setLimitModal] = useState(null); // { message, canBuyExtension }
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [shareId, setShareId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [thanked, setThanked] = useState(false);
  const [budgetTipDismissed, setBudgetTipDismissed] = useState(false);
  const [buildsRemaining, setBuildsRemaining] = useState(null);
  const resultRef = useRef(null);
  const sessionIdRef = useRef("");

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 4500);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const submitWithText = async (text) => {
    setError(null);
    setClarification(null);
    setLimitModal(null);
    setLoading(true);
    setResult(null);
    setMeta(null);
    setPlacePhotos(null);
    setShareId(null);
    setThanked(false);
    setBudgetTipDismissed(false);

    try {
      let userEmail = "";
      try { userEmail = localStorage.getItem("goanow_email") || ""; } catch {}

      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: sessionIdRef.current,
          email: userEmail,
        }),
      });
      const data = await res.json();

      if (data.limitReached) {
        setLimitModal({
          message: data.message || "You've used all your plan generations today.",
          canBuyExtension: !!data.canBuyExtension,
        });
        setBuildsRemaining(0);
        setLoading(false);
        return;
      }
      if (data.needsClarification) {
        setClarification({
          type: data.clarificationType || "area",
          message: data.message,
          areaSuggestions: data.areaSuggestions || [],
          transportOptions: data.transportOptions || [],
        });
        if (typeof data.buildsRemaining === "number") setBuildsRemaining(data.buildsRemaining);
        setLoading(false);
        return;
      }
      if (!res.ok || !data.itinerary) {
        setError(data.error || "Could not build your plan. Try again.");
        setLoading(false);
        return;
      }

      setResult(data.itinerary);
      setMeta({
        dataSource: data.dataSource,
        placesChecked: data.placesChecked,
        redditSourced: data.redditSourced,
        userArea: data.userArea,
        language: data.language,
        budgetMissing: !!data.budgetMissing,
      });
      setPlacePhotos(
        data.placePhotos && typeof data.placePhotos === "object" ? data.placePhotos : null
      );
      if (typeof data.buildsRemaining === "number") setBuildsRemaining(data.buildsRemaining);

      // analytics fire-and-forget
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "itinerary_built",
          area: data.userArea,
          language: data.language,
          data: { session_id: sessionIdRef.current, data_source: data.dataSource },
        }),
      }).catch(() => {});

      setLoading(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length < 8) {
      setError("Tell us a bit more: where are you staying and what is your budget?");
      return;
    }
    submitWithText(trimmed);
  };

  const handleAreaPick = (area) => {
    const newText = input.trim() + (input.trim() ? " · " : "") + `Staying in ${area}`;
    setInput(newText);
    setClarification(null);
    submitWithText(newText);
  };

  const handleTransportPick = (option) => {
    const phrase = option.value === "none"
      ? "I don't have my own vehicle, will use autos"
      : option.value === "scooter"
      ? "I have a scooter"
      : option.value === "car"
      ? "I have a car"
      : "I have a motorcycle";
    const newText = input.trim() + (input.trim() ? " · " : "") + phrase;
    setInput(newText);
    setClarification(null);
    submitWithText(newText);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      showToast("Copied");
    } catch {
      showToast("Could not copy. Try selecting manually.");
    }
  };

  const handleBuyExtension = async () => {
    let userEmail = "";
    try { userEmail = localStorage.getItem("goanow_email") || ""; } catch {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      showToast("Sign in first so we can credit your account");
      return;
    }
    setExtensionLoading(true);
    try {
      // Load Razorpay script if needed
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }

      const orderRes = await fetch("/api/user/buy-extension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.orderId) {
        showToast(orderData.error || "Could not start payment");
        setExtensionLoading(false);
        return;
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const rzp = new window.Razorpay({
        key: keyId,
        amount: orderData.amount,
        currency: "INR",
        name: "GoaNow",
        description: `${orderData.builds} more plan generations`,
        order_id: orderData.orderId,
        theme: { color: "#FF3D81" },
        prefill: { email: userEmail },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/user/verify-extension", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: userEmail,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              showToast(`+${verifyData.added} plan generations added 🎉`);
              setLimitModal(null);
              setBuildsRemaining(verifyData.added);
            } else {
              showToast(verifyData.error || "Verification failed");
            }
          } catch {
            showToast("Verification failed");
          } finally {
            setExtensionLoading(false);
          }
        },
        modal: { ondismiss: () => setExtensionLoading(false) },
      });
      rzp.on("payment.failed", () => {
        showToast("Payment failed. Try again.");
        setExtensionLoading(false);
      });
      rzp.open();
    } catch {
      showToast("Could not start payment");
      setExtensionLoading(false);
    }
  };

  const handleEmailPlan = async () => {
    if (!result) return;
    let emailToUse = "";
    try { emailToUse = localStorage.getItem("goanow_email") || ""; } catch {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
      const entered = window.prompt("Send plan to which email?");
      if (!entered) return;
      emailToUse = entered.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
        showToast("That doesn't look like a valid email");
        return;
      }
      try { localStorage.setItem("goanow_email", emailToUse); } catch {}
    }
    try {
      const res = await fetch("/api/email/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToUse,
          itineraryText: result,
          userArea: meta?.userArea,
          shareId,
        }),
      });
      const data = await res.json();
      if (data.success) showToast("Sent to your email 📧");
      else showToast(data.error || "Could not send email");
    } catch {
      showToast("Could not send email");
    }
  };

  const handleSavePlan = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/save-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itineraryText: result,
          userArea: meta?.userArea,
          durationDays: null,
          language: meta?.language,
          dataSource: meta?.dataSource,
          placesChecked: meta?.placesChecked,
          redditSourced: meta?.redditSourced,
        }),
      });
      const data = await res.json();
      if (data.success && data.shareId) {
        setShareId(data.shareId);
        try {
          const stored = JSON.parse(localStorage.getItem("goanow_saved_plans") || "[]");
          if (!stored.includes(data.shareId)) {
            stored.push(data.shareId);
            localStorage.setItem("goanow_saved_plans", JSON.stringify(stored));
          }
        } catch {}
        showToast("Plan saved! 🎉");
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: "plan_saved", data: { share_id: data.shareId } }),
        }).catch(() => {});
      } else {
        showToast(data.error || "Save failed");
      }
    } catch {
      showToast("Save failed");
    }
    setSaving(false);
  };

  const handleSharePlan = async () => {
    if (!shareId) return;
    const url = `${window.location.origin}/plan/${shareId}`;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "plan_shared", data: { share_id: shareId } }),
    }).catch(() => {});

    if (navigator.share) {
      try {
        await navigator.share({ title: "My Goa Plan — GoaNow 🔥", text: "Check out my Goa itinerary!", url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied!");
    } catch {
      showToast(url);
    }
  };

  const handleRate = async (rating) => {
    if (!shareId || thanked) return;
    setThanked(true);
    fetch("/api/rate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, rating }),
    }).catch(() => {});
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: rating === "up" ? "thumbs_up" : "thumbs_down", data: { share_id: shareId } }),
    }).catch(() => {});
  };

  const handleReset = () => {
    setResult(null);
    setMeta(null);
    setPlacePhotos(null);
    setInput("");
    setError(null);
    setShareId(null);
    setThanked(false);
  };

  const dataBadge = (() => {
    if (!meta) return null;
    if (meta.dataSource === "live") {
      return {
        text: `✓ Built with live Google Maps data — ${meta.placesChecked || 0} places checked${meta.userArea ? ` near ${meta.userArea}` : ""}${meta.redditSourced ? `, ${meta.redditSourced} with community intel` : ""}`,
        color: "rgba(0,200,140,0.85)",
      };
    }
    if (meta.dataSource === "partial") {
      return { text: "⚡ Mostly live data — some saved data used", color: "rgba(251,191,36,0.85)" };
    }
    return {
      text: "⚠️ Built from our curated Goa database — live data unavailable right now. Distances may vary.",
      color: "rgba(251,191,36,0.85)",
    };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glass-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <span className="icon-tile"><Icon name="route" size={22} /></span>
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
            onChange={(e) => { setInput(e.target.value); if (error) setError(null); }}
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

          <button type="submit" disabled={loading || buildsRemaining === 0} className="neon-btn" style={{ width: "100%", marginTop: 14, fontSize: 16 }}>
            <Icon name="sparkles" size={18} />
            {loading ? "Building..." : "Build My Goa Plan"}
            {!loading && <Icon name="arrow-right" size={18} />}
          </button>

          {typeof buildsRemaining === "number" && buildsRemaining >= 0 && (
            <div style={{
              marginTop: 10, fontSize: 13, textAlign: "center",
              color: buildsRemaining === 1 ? "#FFD93D" : "var(--text-muted)",
              fontWeight: buildsRemaining === 1 ? 600 : 400,
            }}>
              🎯 {buildsRemaining} itinerary build{buildsRemaining === 1 ? "" : "s"} remaining on your pass
            </div>
          )}
        </form>
      </div>

      {/* CLARIFICATION CARD */}
      {clarification && (
        <div className="glass-card" style={{ padding: 18 }}>
          <p style={{ margin: "0 0 12px", color: "#fff", lineHeight: 1.55 }}>{clarification.message}</p>

          {clarification.type === "transport" && clarification.transportOptions?.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {clarification.transportOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTransportPick(opt)}
                  className="neon-btn-ghost"
                  style={{
                    fontSize: 13, padding: "12px 14px", minHeight: 56,
                    textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                    borderColor: "rgba(0,245,255,0.5)", color: "#fff", lineHeight: 1.3,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {clarification.areaSuggestions.map((a) => (
                <button
                  key={a}
                  onClick={() => handleAreaPick(a)}
                  className="neon-btn-ghost"
                  style={{
                    fontSize: 13, padding: "8px 14px", minHeight: 36, whiteSpace: "nowrap",
                    borderColor: "rgba(0,245,255,0.5)", color: "var(--neon-cyan)",
                  }}
                >
                  📍 {a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="glass-card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 700, color: "var(--neon-pink)", animation: "pulseNeon 1.6s ease-in-out infinite", textShadow: "0 0 16px rgba(255,45,120,0.42)" }}>
            <Icon name="sparkles" size={20} />
            GoaNow AI is crafting your plan
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
            Checking live places + crowd intel... usually 10–20 seconds
          </div>
        </div>
      )}

      {/* RESULT */}
      {result && (
        <div ref={resultRef} className="glass-card" style={{ padding: 22 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 14px", fontSize: 22, color: "var(--neon-cyan)", textShadow: "0 0 12px rgba(51,214,200,0.32)" }}>
            <Icon name="sparkles" size={18} />
            Your Personalized Goa Plan
          </h3>
          {placePhotos && Object.keys(placePhotos).length > 0 ? (
            <ItineraryWithPhotos text={result} placePhotos={placePhotos} />
          ) : (
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 15, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
              {result}
            </div>
          )}

          {dataBadge && (
            <div style={{ color: dataBadge.color, fontSize: 12, marginTop: 16, textAlign: "center" }}>
              {dataBadge.text}
            </div>
          )}

          {meta?.budgetMissing && !budgetTipDismissed && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(0,245,255,0.05)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <span>💡 Add your budget next time for a more accurate cost breakdown</span>
              <button onClick={() => setBudgetTipDismissed(true)} aria-label="Dismiss" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, padding: 4 }}>×</button>
            </div>
          )}

          <div className="card-actions" style={{ marginTop: 18, flexWrap: "wrap" }}>
            <button onClick={handleCopy} className="neon-btn mobile-full" style={{ flex: 1, minWidth: 140 }}>
              <Icon name="card" size={17} />
              Copy Plan
            </button>
            {!shareId ? (
              <button onClick={handleSavePlan} disabled={saving} className="neon-btn-ghost mobile-full" style={{ flex: 1, minWidth: 140, borderColor: "rgba(255,215,0,0.5)", color: "#FFD93D" }}>
                <Icon name="card" size={17} />
                {saving ? "Saving..." : "💾 Save This Plan"}
              </button>
            ) : (
              <button onClick={handleSharePlan} className="neon-btn-ghost mobile-full" style={{ flex: 1, minWidth: 140, borderColor: "rgba(0,245,255,0.5)", color: "var(--neon-cyan)" }}>
                <Icon name="card" size={17} />
                📤 Share Plan
              </button>
            )}
            <button onClick={handleEmailPlan} className="neon-btn-ghost mobile-full" style={{ flex: 1, minWidth: 140, borderColor: "rgba(0,245,255,0.4)", color: "var(--neon-cyan)" }}>
              <Icon name="card" size={17} />
              📧 Email Me This Plan
            </button>
            <button onClick={handleReset} className="neon-btn-ghost mobile-full" style={{ flex: 1, minWidth: 140 }}>
              <Icon name="refresh" size={17} />
              Build Another
            </button>
          </div>

          {/* Thumbs */}
          {shareId && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              {thanked ? (
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Thanks for the feedback! 🙏</span>
              ) : (
                <>
                  <span style={{ color: "var(--text-muted)", fontSize: 13, marginRight: 10 }}>Was this plan helpful?</span>
                  <button onClick={() => handleRate("up")} className="neon-btn-ghost" style={{ padding: "4px 12px", minHeight: 32, fontSize: 16, marginRight: 6 }}>👍</button>
                  <button onClick={() => handleRate("down")} className="neon-btn-ghost" style={{ padding: "4px 12px", minHeight: 32, fontSize: 16 }}>👎</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* LIMIT MODAL */}
      {limitModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setLimitModal(null); }}
        >
          <div className="glass-card" style={{ maxWidth: 480, padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎯</div>
            <h3 style={{ margin: "0 0 12px", color: "var(--neon-pink)", fontSize: 26 }}>Daily limit reached</h3>
            <p style={{ color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
              {limitModal.message}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {limitModal.canBuyExtension && (
                <button
                  onClick={handleBuyExtension}
                  disabled={extensionLoading}
                  className="neon-btn"
                  style={{ fontSize: 15 }}
                >
                  {extensionLoading ? "Opening..." : "💎 Buy 15 more for ₹30"}
                </button>
              )}
              {result && !shareId && (
                <button onClick={() => { handleSavePlan(); setLimitModal(null); }} className="neon-btn-ghost">
                  💾 Save My Plan
                </button>
              )}
              {shareId && (
                <button onClick={() => { handleSharePlan(); setLimitModal(null); }} className="neon-btn-ghost">
                  📤 Share GoaNow
                </button>
              )}
              <button onClick={() => setLimitModal(null)} className="neon-btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
