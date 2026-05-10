"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import PaywallModal from "@/components/PaywallModal";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

const PLANS = {
  day:  { key: "day",  name: "DAY PASS",  duration: "24 hours", price: 8 },
  week: { key: "week", name: "WEEK PASS", duration: "7 days",   price: 21 },
  trip: { key: "trip", name: "TRIP PASS", duration: "19 days",  price: 59 },
};

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("week");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("week");
  const [user, setUser] = useState(null);
  const [hasActivePass, setHasActivePass] = useState(false);

  // ── auth state for nav button ─────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    let mounted = true;

    const refresh = async (u) => {
      if (!mounted) return;
      setUser(u || null);
      if (u?.email) {
        try { localStorage.setItem("goanow_email", u.email); } catch {}
        try {
          const res = await fetch(`/api/user/pass?email=${encodeURIComponent(u.email)}`);
          const data = await res.json();
          if (data?.active && data?.expiresAt) {
            const expiryMs = new Date(data.expiresAt).getTime();
            if (expiryMs > Date.now()) {
              localStorage.setItem("goanow_plan", data.planName || "Pass");
              localStorage.setItem("goanow_expiry", String(expiryMs));
              if (mounted) setHasActivePass(true);
              return;
            }
          }
          if (mounted) setHasActivePass(false);
        } catch {}
      }
    };

    sb.auth.getSession().then(({ data }) => refresh(data?.session?.user || null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      refresh(session?.user || null);
    });
    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  // ── resume modal after OAuth redirect ─────────────────────────
  useEffect(() => {
    if (!user?.email) return;
    let pendingPlan = "";
    try { pendingPlan = sessionStorage.getItem("goanow_pending_plan") || ""; } catch {}
    if (!pendingPlan) return;
    try { sessionStorage.removeItem("goanow_pending_plan"); } catch {}
    setInitialPlan(pendingPlan);
    setAutoAdvance(true);
    setModalOpen(true);
  }, [user?.email]);

  // ── fade-up on scroll for cards ───────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll(".gn-rev");
    if (!els.length || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-vis"));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-vis");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const openModal = (plan) => {
    setInitialPlan(plan);
    setAutoAdvance(false);
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setAutoAdvance(false); };

  const navCTA = user && hasActivePass ? (
    <a href="/dashboard" className="gn-nav-btn">Dashboard →</a>
  ) : (
    <button onClick={() => openModal("week")} className="gn-nav-btn">Get Access</button>
  );

  const sel = PLANS[selectedPlan] || PLANS.week;
  const payColors = {
    day:  { bg: "var(--cyan)", color: "#0A0A0F", glow: "0 0 28px rgba(0,245,255,0.3)" },
    week: { bg: "var(--pink)", color: "#fff",    glow: "0 0 28px rgba(255,45,120,0.4)" },
    trip: { bg: "var(--gold)", color: "#0A0A0F", glow: "0 0 28px rgba(255,215,0,0.3)" },
  }[selectedPlan];

  return (
    <main className="gn-root">
      {/* ─────── NAVBAR ─────── */}
      <nav className="gn-nav">
        <div className="gn-nav-inner">
          <div className="gn-brand">
            <span className="brand-mark__icon"><Icon name="sun" size={18} /></span>
            <span className="gn-brand-text">GOANOW</span>
          </div>
          {navCTA}
        </div>
      </nav>

      {/* ─────── HERO (fits in one viewport) ─────── */}
      <section className="gn-hero">
        <div className="gn-live-badge">
          <span className="gn-live-dot" />
          Updated daily for Goa tourists
        </div>

        <h1 className="gn-h1">
          <span style={{ color: "#fff" }}>STOP GUESSING</span>
          <br />
          <span style={{ color: "var(--pink)", textShadow: "0 0 40px rgba(255,45,120,0.35)" }}>IN GOA.</span>
        </h1>

        <p className="gn-prop">
          Google shows popular.<br />
          GoaNow shows nearest, open, right now.
        </p>

        <p className="gn-support">
          Cafes, parties, beaches, hotels —<br />
          sorted by your GPS. Updated every night.
        </p>

        <button onClick={() => openModal("week")} className="gn-hero-cta">
          Get Full Access →
        </button>

        <div className="gn-price-hint">
          Rs 8 for today · Rs 21 for a week · Rs 59 for a month<br />
          <span style={{ color: "rgba(255,255,255,0.35)" }}>One-time. No subscription.</span>
        </div>
      </section>

      {/* ─────── COMPARISON LINE ─────── */}
      <section className="gn-compare">
        <div className="gn-divider" />
        <div className="gn-compare-text">
          <div style={{ color: "var(--muted)" }}>GOOGLE SHOWS WHAT'S POPULAR.</div>
          <div style={{ color: "#fff" }}>WE SHOW WHAT'S NEAREST.</div>
          <div style={{ color: "var(--pink)" }}>RIGHT NOW. FROM WHERE YOU STAND.</div>
        </div>
      </section>

      {/* ─────── FEATURES ─────── */}
      <section className="gn-features">
        <div className="gn-eyebrow gn-eyebrow-cyan">WHAT YOU GET</div>
        <h2 className="gn-h2">EVERYTHING.<br />IN ONE TAP.</h2>

        <div className="gn-feat-stack">
          {/* CARD 1 — NEARBY */}
          <div className="gn-feat-card gn-feat-cyan gn-rev" style={{ "--d": "0ms" }}>
            <div className="gn-feat-head">
              <span className="gn-feat-icon" style={{ background: "rgba(0,245,255,0.10)" }}>📍</span>
              <span className="gn-feat-cat" style={{ color: "var(--cyan)" }}>NEARBY SPOTS</span>
            </div>
            <div className="gn-feat-title">SORTED BY WHERE<br />YOU'RE STANDING.</div>
            <div className="gn-feat-body">
              Not Google's popular. Your real distance.<br />
              4.0+ rated. Live open/closed. Real photos.
            </div>
            <div className="gn-pill-row">
              <span className="gn-pill">GPS-accurate</span>
              <span className="gn-pill">Live status</span>
              <span className="gn-pill">Real photos</span>
            </div>
          </div>

          {/* CARD 2 — PARTIES */}
          <div className="gn-feat-card gn-feat-pink gn-rev" style={{ "--d": "80ms" }}>
            <div className="gn-feat-head">
              <span className="gn-feat-icon" style={{ background: "rgba(255,45,120,0.10)" }}>🎉</span>
              <span className="gn-feat-cat" style={{ color: "var(--pink)" }}>TONIGHT'S PARTIES</span>
            </div>
            <div className="gn-feat-title">KNOW BEFORE<br />YOU GO.</div>
            <div className="gn-feat-body">
              Human-curated nightly. Real entry fees.<br />
              Real crowd timing — not what the flyer says.
            </div>
            <div className="gn-callout gn-callout-pink">
              🕐 Flyer says 10 PM.<br />Real crowd: midnight.
            </div>
            <div className="gn-pill-row">
              <span className="gn-pill">Entry fees</span>
              <span className="gn-pill">Crowd timing</span>
              <span className="gn-pill">Daily update</span>
            </div>
          </div>

          {/* CARD 3 — AI ITINERARY */}
          <div className="gn-feat-card gn-feat-gold gn-rev" style={{ "--d": "160ms" }}>
            <div className="gn-feat-head">
              <span className="gn-feat-icon" style={{ background: "rgba(255,215,0,0.10)" }}>🗺️</span>
              <span className="gn-feat-cat" style={{ color: "var(--gold)" }}>AI ITINERARY</span>
            </div>
            <div className="gn-feat-title">YOUR TRIP IN<br />60 SECONDS.</div>
            <div className="gn-feat-body">
              Tell it your area, budget, vibe. It fetches<br />
              live Google data — only open, only nearby.
            </div>
            <div className="gn-callout gn-callout-gold">
              <em style={{ color: "var(--muted)", fontSize: 12 }}>"Morjim, 3 days, Rs 5000, party + beach"</em>
              <div style={{ color: "#fff", fontSize: 13, marginTop: 4 }}>→ Full day-by-day plan. Real prices.</div>
            </div>
            <div className="gn-pill-row">
              <span className="gn-pill">Live Google data</span>
              <span className="gn-pill">Real distances</span>
              <span className="gn-pill">Hidden gems</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────── QUOTE ─────── */}
      <section className="gn-quote-wrap">
        <div className="gn-quote-card gn-rev">
          <span className="gn-quote-mark">&ldquo;</span>
          <div className="gn-quote-text">
            GoaNow told me the crowd comes at midnight. I showed up at midnight. Best night of my Goa trip.
          </div>
          <div className="gn-attr">
            <span className="gn-attr-dot" />
            Riya S. · Vagator, Goa
          </div>
        </div>
        <div className="gn-quote-foot">50+ insider tips built into every AI plan.</div>
      </section>

      {/* ─────── PRICING + PAY ─────── */}
      <section className="gn-pricing">
        <div className="gn-eyebrow gn-eyebrow-cyan">SIMPLE PRICING</div>
        <h2 className="gn-h2">ONE-TIME.<br />NO SUBSCRIPTION.</h2>
        <p className="gn-pricing-sub">One bad party entry costs more than this.</p>

        <div className="gn-plans">
          {Object.values(PLANS).map((p, i) => {
            const isSel = selectedPlan === p.key;
            const accent = p.key === "week" ? "var(--pink)" : p.key === "day" ? "var(--cyan)" : "var(--gold)";
            const accentBg = p.key === "week" ? "rgba(255,45,120,0.07)" : p.key === "day" ? "rgba(0,245,255,0.05)" : "rgba(255,215,0,0.05)";
            const perDay = p.key === "week" ? "≈ Rs 3 per day"
              : p.key === "trip" ? "≈ Rs 2 per day"
              : "for today only";
            return (
              <button
                type="button"
                key={p.key}
                onClick={() => setSelectedPlan(p.key)}
                className={`gn-plan ${isSel ? "is-sel" : ""} gn-rev`}
                style={{
                  "--d": `${i * 80}ms`,
                  border: isSel ? `2px solid ${accent}` : "1.5px solid var(--border)",
                  background: isSel ? accentBg : "rgba(255,255,255,0.04)",
                  boxShadow: isSel && p.key === "week" ? "0 0 20px rgba(255,45,120,0.10)" : "none",
                }}
              >
                {p.key === "week" && <span className="gn-popular-tag">MOST POPULAR</span>}
                <div className="gn-plan-top">
                  <div>
                    <div className="gn-plan-name">{p.name}</div>
                    <div className="gn-plan-dur">{p.duration}</div>
                  </div>
                  {isSel && (
                    <div className="gn-plan-tick" style={{ background: accent }}>✓</div>
                  )}
                </div>
                <div className="gn-plan-price" style={{ color: p.key === "week" ? "var(--pink)" : "#fff" }}>
                  Rs {p.price}
                </div>
                <div className="gn-plan-perday">{perDay}</div>
                <div className="gn-plan-divider" />
                <ul className="gn-plan-feats">
                  <li><span className="gn-tick">✓</span>Nearby spots by GPS</li>
                  <li><span className="gn-tick">✓</span>Live party feed</li>
                  <li><span className="gn-tick">✓</span>AI itinerary builder</li>
                </ul>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => openModal(selectedPlan)}
          className="gn-pay-btn"
          style={{ background: payColors.bg, color: payColors.color, boxShadow: payColors.glow }}
        >
          Unlock {sel.name.charAt(0) + sel.name.slice(1).toLowerCase()} — Rs {sel.price} →
        </button>

        <div className="gn-trust">
          🔒 Razorpay secured · UPI · Card · Netbanking<br />
          No account needed until you pay
        </div>
      </section>

      <PaywallModal
        open={modalOpen}
        onClose={closeModal}
        initialPlan={initialPlan}
        autoAdvance={autoAdvance}
      />

      <style jsx global>{`
        :root {
          --bg: #0A0A0F;
          --card: rgba(255,255,255,0.04);
          --pink: #FF2D78;
          --cyan: #00F5FF;
          --gold: #FFD700;
          --white: #FFFFFF;
          --muted: rgba(255,255,255,0.5);
          --border: rgba(255,255,255,0.08);
        }
        body {
          background: var(--bg);
          color: var(--white);
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          margin: 0;
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,45,120,0.5); }
          50% { opacity: 0.85; box-shadow: 0 0 0 5px rgba(255,45,120,0); }
        }

        .gn-root { background: var(--bg); }
        .gn-rev {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.4s ease, transform 0.4s ease;
          transition-delay: var(--d, 0ms);
        }
        .gn-rev.is-vis {
          opacity: 1;
          transform: translateY(0);
        }

        /* NAVBAR */
        .gn-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 52px;
          background: rgba(10,10,15,0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
        }
        .gn-nav-inner {
          height: 100%;
          padding: 0 20px;
          max-width: 1080px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .gn-brand { display: flex; align-items: center; gap: 8px; }
        .gn-brand-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          color: #fff;
          letter-spacing: 3px;
        }
        .gn-nav-btn {
          background: var(--pink);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 9px 16px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 0 14px rgba(255,45,120,0.3);
        }

        /* HERO */
        .gn-hero {
          min-height: calc(100svh - 52px);
          padding: 20px 20px 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background:
            radial-gradient(ellipse at 50% 90%, rgba(255,45,120,0.12) 0%, transparent 60%),
            var(--bg);
        }
        .gn-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,45,120,0.10);
          border: 1px solid rgba(255,45,120,0.25);
          border-radius: 20px;
          padding: 5px 12px;
          width: fit-content;
          margin-bottom: 18px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--pink);
          font-weight: 500;
        }
        .gn-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--pink);
          flex-shrink: 0;
          animation: livePulse 2s infinite;
        }
        .gn-h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(48px, 13vw, 60px);
          line-height: 0.9;
          letter-spacing: 0.5px;
          margin: 0 0 18px;
        }
        .gn-prop {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 17px;
          color: #fff;
          line-height: 1.4;
          margin: 0 0 6px;
        }
        .gn-support {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 14px;
          color: var(--muted);
          line-height: 1.55;
          margin: 0 0 24px;
        }
        .gn-hero-cta {
          width: 100%;
          height: 56px;
          background: var(--pink);
          color: #fff;
          border: none;
          border-radius: 14px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 17px;
          cursor: pointer;
          box-shadow: 0 0 32px rgba(255,45,120,0.45), 0 4px 20px rgba(255,45,120,0.25);
          transition: transform 0.18s ease;
          margin-bottom: 12px;
        }
        .gn-hero-cta:active { transform: scale(0.98); }
        .gn-price-hint {
          text-align: center;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--muted);
          line-height: 1.6;
        }

        /* COMPARISON */
        .gn-compare {
          padding: 0 20px 48px;
          text-align: center;
        }
        .gn-divider {
          border-top: 1px solid var(--border);
          margin-bottom: 32px;
        }
        .gn-compare-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px;
          line-height: 1.2;
          max-width: 340px;
          margin: 0 auto;
          letter-spacing: 0.5px;
        }
        .gn-compare-text > div + div {
          margin-top: 4px;
        }

        /* SECTION HELPERS */
        .gn-features { padding: 48px 20px; background: var(--bg); }
        .gn-pricing  { padding: 48px 20px 80px; background: var(--bg); }
        .gn-quote-wrap { padding: 40px 20px; background: #0D0D16; }

        .gn-eyebrow {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .gn-eyebrow-cyan { color: var(--cyan); }
        .gn-h2 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 40px;
          color: #fff;
          line-height: 1;
          margin: 0 0 24px;
          letter-spacing: 0.5px;
        }

        /* FEATURE CARDS */
        .gn-feat-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .gn-feat-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px 18px;
          overflow: hidden;
          position: relative;
        }
        .gn-feat-cyan { border-left: 3px solid var(--cyan); }
        .gn-feat-pink { border-left: 3px solid var(--pink); }
        .gn-feat-gold { border-left: 3px solid var(--gold); }

        .gn-feat-head {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .gn-feat-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .gn-feat-cat {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 600;
        }
        .gn-feat-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 26px;
          color: #fff;
          line-height: 1.05;
          margin: 14px 0 8px;
          letter-spacing: 0.5px;
        }
        .gn-feat-body {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: var(--muted);
          line-height: 1.55;
          margin: 0;
        }
        .gn-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 14px;
        }
        .gn-pill {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: #fff;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 3px 9px;
        }
        .gn-callout {
          margin-top: 12px;
          border-radius: 8px;
          padding: 10px 12px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #fff;
          line-height: 1.5;
        }
        .gn-callout-pink {
          background: rgba(255,45,120,0.08);
          border: 1px solid rgba(255,45,120,0.2);
        }
        .gn-callout-gold {
          background: rgba(255,215,0,0.05);
          border: 1px solid rgba(255,215,0,0.12);
        }

        /* QUOTE */
        .gn-quote-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-left: 3px solid var(--pink);
          border-radius: 14px;
          padding: 24px 20px;
          position: relative;
        }
        .gn-quote-mark {
          font-size: 64px;
          color: var(--pink);
          opacity: 0.3;
          line-height: 0.5;
          font-family: Georgia, serif;
          display: block;
          margin-bottom: 8px;
        }
        .gn-quote-text {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 17px;
          color: #fff;
          line-height: 1.55;
          margin-bottom: 16px;
        }
        .gn-attr {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .gn-attr-dot {
          width: 6px;
          height: 6px;
          background: var(--pink);
          border-radius: 50%;
          display: inline-block;
        }
        .gn-quote-foot {
          text-align: center;
          margin-top: 14px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--muted);
        }

        /* PRICING */
        .gn-pricing-sub {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: var(--muted);
          margin: 0 0 24px;
        }
        .gn-plans {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .gn-plan {
          position: relative;
          border-radius: 14px;
          padding: 20px 18px;
          cursor: pointer;
          transition: all 0.18s ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          color: #fff;
          font-family: 'Inter', sans-serif;
          text-align: left;
          width: 100%;
        }
        .gn-plan:active { transform: scale(0.99); }
        .gn-popular-tag {
          position: absolute;
          top: -1px;
          right: 14px;
          background: var(--pink);
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 0 0 8px 8px;
        }
        .gn-plan-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .gn-plan-name {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          color: #fff;
          letter-spacing: 1px;
        }
        .gn-plan-dur {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .gn-plan-tick {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .gn-plan-price {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 44px;
          line-height: 1;
          margin-top: 12px;
        }
        .gn-plan-perday {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .gn-plan-divider {
          margin: 14px 0;
          border-top: 1px solid var(--border);
        }
        .gn-plan-feats {
          list-style: none;
          padding: 0;
          margin: 0;
          font-family: 'Inter', sans-serif;
        }
        .gn-plan-feats li {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          color: #fff;
          font-size: 13px;
        }
        .gn-tick {
          color: var(--cyan);
          font-size: 13px;
          font-weight: 700;
        }

        .gn-pay-btn {
          margin-top: 16px;
          width: 100%;
          height: 58px;
          border: none;
          border-radius: 14px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 17px;
          cursor: pointer;
          transition: transform 0.18s ease;
        }
        .gn-pay-btn:active { transform: scale(0.98); }

        .gn-trust {
          text-align: center;
          margin-top: 14px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--muted);
          line-height: 1.9;
        }
      `}</style>
    </main>
  );
}
