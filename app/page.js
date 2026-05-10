"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import PaywallModal from "@/components/PaywallModal";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import { startTrial } from "@/lib/trialUtils";

const DEFAULT_PLANS = [
  { key: "day",  name: "Day Pass",  price: 49,  duration: "24 hours",  popular: false },
  { key: "week", name: "Week Pass", price: 8,   duration: "7 days",    popular: true  },
  { key: "trip", name: "Trip Pass", price: 149, duration: "30 days",   popular: false },
];

const PROBLEMS = [
  {
    icon: "😤",
    title: "Google sent you somewhere 8km away",
    body: "There was a better cafe 300 meters from where you were standing. Google just doesn't know you're standing there.",
  },
  {
    icon: "😴",
    title: "You showed up to a dead party",
    body: "The flyer said 10 PM. You arrived at 10. Empty venue. Bartender looked at you. Real crowd comes at midnight. Nobody tells tourists this.",
  },
  {
    icon: "🤷",
    title: "ChatGPT gave you the same 5 spots",
    body: "Baga Beach. Tito's Lane. Calangute. Every tourist gets the same list. The real Goa is somewhere else entirely.",
  },
];

const INSIDER_TIPS = [
  {
    title: "🌊 The Open Sea Package",
    body: "Ask any Goa speedboat guy for the 'open sea package'. Rs 1,500 for 2 people. You ride out 3km and swim in the middle of the Arabian Sea. Not advertised anywhere.",
  },
  {
    title: "🏖️ Sweet Water Lake, Arambol",
    body: "10 minute walk behind Arambol beach. Freshwater lake. Almost zero tourists. Free. One of Goa's most magical spots. 90% of tourists never find it.",
  },
  {
    title: "🎉 Hilltop Vagator — Tuesday Night",
    body: "The best psy trance party in Goa. Every Tuesday. Outdoor. Legendary. Crowd arrives after midnight. Show up before 11 and you're alone.",
  },
  {
    title: "🎰 Deltin Royale Casino",
    body: "Rs 3,000 entry. Includes Rs 1,500 gaming credits + unlimited food + unlimited drinks. On a boat on the Mandovi River. Most underrated night out in all of Goa.",
  },
];

const ICON_GRID = [
  { icon: "🏨", label: "Hotels" },
  { icon: "🌊", label: "Water Sports" },
  { icon: "🛕", label: "Tourist Spots" },
  { icon: "🛵", label: "Rentals" },
  { icon: "🌿", label: "Hidden Gems" },
  { icon: "🦞", label: "Seafood" },
];

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("week");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [user, setUser] = useState(null);
  const [hasActivePass, setHasActivePass] = useState(false);

  // ── pricing fetch ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.pricing) {
          setPlans(["day", "week", "trip"].map((key) => {
            const p = d.pricing[key] || {};
            return {
              key,
              name: p.name || key,
              price: p.price,
              duration: p.label,
              popular: !!p.popular,
            };
          }));
        }
      })
      .catch(() => {});
  }, []);

  // ── Supabase auth (used only for the navbar CTA) ─────────────────
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    let mounted = true;

    const refresh = async (u) => {
      if (!mounted) return;
      setUser(u || null);
      if (u?.email) {
        try { localStorage.setItem("goanow_email", u.email); } catch {}
        startTrial();
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

  // ── auto-resume modal after OAuth redirect ───────────────────────
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

  // ── fade-up on scroll ────────────────────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll(".gn-fade");
    if (!els.length || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
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

  const scrollToHow = (e) => {
    e.preventDefault();
    document.getElementById("how")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── pricing strings ──────────────────────────────────────────────
  const planByKey = useMemo(() => {
    const map = {};
    plans.forEach((p) => { map[p.key] = p; });
    return map;
  }, [plans]);

  const pricingNote = `Rs ${planByKey.day?.price ?? "—"} for a day · Rs ${planByKey.week?.price ?? "—"} for a week · Rs ${planByKey.trip?.price ?? "—"} for a month`;

  const navCTA = user && hasActivePass ? (
    <a href="/dashboard" className="gn-pink-btn" style={{ padding: "10px 18px", fontSize: 14, height: 40 }}>
      Dashboard →
    </a>
  ) : (
    <button onClick={() => openModal("week")} className="gn-pink-btn" style={{ padding: "10px 18px", fontSize: 14, height: 40 }}>
      Get Access
    </button>
  );

  return (
    <main className="gn-page">
      {/* ─────── NAVBAR ─────── */}
      <nav className="gn-navbar">
        <div className="gn-navbar-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="brand-mark__icon"><Icon name="sun" size={20} /></span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#fff", letterSpacing: 3 }}>
              GOANOW
            </span>
          </div>
          {navCTA}
        </div>
      </nav>

      {/* ─────── HERO ─────── */}
      <section className="gn-hero">
        <div className="gn-hero-content">
          <div className="gn-eyebrow gn-eyebrow-pink gn-fade">
            <span className="gn-pulse-dot" />
            Updated daily for Goa tourists
          </div>

          <h1 className="gn-h1 gn-fade">
            <span style={{ color: "#fff" }}>STOP GUESSING</span>
            <br />
            <span style={{ color: "var(--gn-pink)" }}>IN GOA.</span>
          </h1>

          <p className="gn-subhead gn-fade">
            Google shows what's popular.<br />
            We show what's nearest, open, and actually worth your time — right now.
          </p>

          <p className="gn-body gn-fade">
            Nearby cafes sorted by your real GPS distance. Tonight's parties with real crowd timing. An AI itinerary built from live Google Maps data — only open places, real prices, hidden gems.
          </p>

          <div className="gn-chip-row gn-fade">
            <span className="gn-chip">📍 GPS-accurate spots</span>
            <span className="gn-chip">🎉 Updated nightly</span>
            <span className="gn-chip">🗺️ AI-powered plans</span>
          </div>

          <div className="gn-cta-stack gn-fade">
            <button onClick={() => openModal("week")} className="gn-pink-btn gn-pink-btn-lg">
              Get Full Access →
            </button>
            <a href="#how" onClick={scrollToHow} className="gn-ghost-btn">
              See how it works ↓
            </a>
          </div>

          <p className="gn-pricing-note gn-fade">
            {pricingNote}<br />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>One-time. No subscription. No hidden fees.</span>
          </p>
        </div>

        <div className="gn-scroll-indicator" aria-hidden>↓</div>
      </section>

      {/* ─────── PROBLEM ─────── */}
      <section id="how" className="gn-section gn-section-alt">
        <div className="gn-container">
          <div className="gn-eyebrow gn-eyebrow-cyan gn-fade">WHY TOURISTS STRUGGLE IN GOA</div>
          <h2 className="gn-h2 gn-fade">SOUND FAMILIAR?</h2>

          <div className="gn-problem-stack">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="gn-problem-card gn-fade">
                <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 6 }}>{p.icon}</div>
                <div className="gn-problem-title">{p.title}</div>
                <div className="gn-problem-body">{p.body}</div>
              </div>
            ))}
          </div>

          <div className="gn-fade" style={{ textAlign: "center", marginTop: 32 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--gn-pink)", letterSpacing: 1 }}>
              GoaNow fixes all three.
            </div>
            <div className="gn-bounce-arrow" aria-hidden>↓</div>
          </div>
        </div>
      </section>

      {/* ─────── FEATURES ─────── */}
      <section className="gn-section">
        <div className="gn-container">
          <div className="gn-eyebrow gn-eyebrow-cyan gn-fade">WHAT YOU GET</div>
          <h2 className="gn-h2 gn-fade">
            EVERYTHING YOU NEED.<br />
            <span style={{ color: "rgba(255,255,255,0.55)" }}>NOTHING YOU DON'T.</span>
          </h2>

          {/* FEATURE 1 — NEARBY */}
          <div className="gn-feat-card gn-feat-cyan gn-fade">
            <div className="gn-feat-head">
              <span className="gn-icon-badge gn-icon-badge-cyan">📍</span>
              <span className="gn-cat-tag" style={{ color: "var(--gn-cyan)" }}>NEARBY SPOTS</span>
            </div>
            <h3 className="gn-feat-title">Sorted by where you're standing.</h3>
            <p className="gn-feat-body">
              Cafes, restobars, beaches, water sports, hotels, and scooter rentals — all sorted by your exact GPS location. Not Google's guess. Your real distance. Right now.
            </p>
            <div className="gn-pill-row">
              <span className="gn-mini-pill">4.0+ rated only</span>
              <span className="gn-mini-pill">Live open/closed</span>
              <span className="gn-mini-pill">Real photos</span>
            </div>
          </div>

          {/* FEATURE 2 — PARTIES */}
          <div className="gn-feat-card gn-feat-pink gn-fade">
            <div className="gn-feat-head">
              <span className="gn-icon-badge gn-icon-badge-pink">🎉</span>
              <span className="gn-cat-tag" style={{ color: "var(--gn-pink)" }}>TONIGHT'S PARTIES</span>
            </div>
            <h3 className="gn-feat-title">Know before you go.</h3>
            <p className="gn-feat-body">
              Our team checks 10+ Goa party Instagram accounts every evening. You get the venue, entry fee, and the one thing nobody else tells you — when the crowd actually arrives.
            </p>
            <div className="gn-highlight gn-highlight-pink">
              🕐 Party says 10 PM. We tell you: crowd arrives at midnight. Don't show up before 12 AM.
            </div>
            <div className="gn-pill-row">
              <span className="gn-mini-pill">Entry fees</span>
              <span className="gn-mini-pill">Crowd timing</span>
              <span className="gn-mini-pill">Insider tips</span>
            </div>
          </div>

          {/* FEATURE 3 — AI ITINERARY */}
          <div className="gn-feat-card gn-feat-gold gn-fade">
            <div className="gn-feat-head">
              <span className="gn-icon-badge gn-icon-badge-gold">🗺️</span>
              <span className="gn-cat-tag" style={{ color: "var(--gn-gold)" }}>AI ITINERARY</span>
            </div>
            <h3 className="gn-feat-title">Your trip planned in 60 seconds.</h3>
            <p className="gn-feat-body">
              Tell the AI where you're staying, your budget, how many days, and what you feel like doing. It fetches live Google Maps data for your exact area — only places that are open right now, at their real distance from you.
            </p>
            <div className="gn-highlight gn-highlight-gold">
              <em style={{ color: "var(--gn-muted)" }}>"I'm in Morjim, 3 days, Rs 5000, want beaches and a party"</em>
              <div style={{ color: "#fff", marginTop: 6 }}>→ Full day-by-day plan with real places, real distances, real prices.</div>
            </div>
            <div className="gn-pill-row">
              <span className="gn-mini-pill">Live Google data</span>
              <span className="gn-mini-pill">Real distances</span>
              <span className="gn-mini-pill">Hidden gems</span>
            </div>
          </div>

          {/* FEATURE 4 — EVERYTHING ELSE */}
          <div className="gn-feat-card gn-feat-violet gn-fade">
            <div className="gn-feat-head">
              <span className="gn-icon-badge gn-icon-badge-violet">✨</span>
              <span className="gn-cat-tag" style={{ color: "#A78BFA" }}>AND MORE</span>
            </div>
            <h3 className="gn-feat-title">One platform. All of Goa.</h3>
            <p className="gn-feat-body">
              Hotels sorted by your area. Water sports with real pricing. Tourist spots, forts, temples, treks. Scooter rentals nearest to you. Hidden gems most tourists never find.
            </p>
            <div className="gn-icon-grid">
              {ICON_GRID.map((it) => (
                <div key={it.label} className="gn-icon-cell">
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{it.icon}</div>
                  <div>{it.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────── INSIDER KNOWLEDGE ─────── */}
      <section className="gn-section gn-section-alt">
        <div className="gn-container">
          <div className="gn-eyebrow gn-eyebrow-pink gn-fade">REAL GOA KNOWLEDGE</div>
          <h2 className="gn-h2 gn-fade">THINGS GOOGLE WON'T TELL YOU.</h2>

          <div className="gn-insight-stack">
            {INSIDER_TIPS.map((t) => (
              <div key={t.title} className="gn-insight-card gn-fade">
                <div className="gn-insight-title">{t.title}</div>
                <div className="gn-insight-body">{t.body}</div>
              </div>
            ))}
          </div>

          <p className="gn-fade" style={{ textAlign: "center", marginTop: 24, color: "var(--gn-muted)", fontFamily: "Inter", fontSize: 14 }}>
            GoaNow has 50+ insider tips like these built into every AI itinerary.
          </p>
        </div>
      </section>

      {/* ─────── PRICING ─────── */}
      <section id="pricing" className="gn-section">
        <div className="gn-container">
          <div className="gn-eyebrow gn-eyebrow-cyan gn-fade">SIMPLE PRICING</div>
          <h2 className="gn-h2 gn-fade">ONE-TIME. NO SUBSCRIPTION.</h2>
          <p className="gn-fade" style={{ color: "var(--gn-muted)", fontFamily: "Inter", fontSize: 15, margin: "0 0 24px" }}>
            One bad party entry costs more than this.
          </p>

          <div className="gn-price-stack">
            {plans.map((p) => {
              const perDay = p.key === "week" && p.price ? (p.price / 7).toFixed(2)
                : p.key === "trip" && p.price ? (p.price / 30).toFixed(2)
                : null;
              const subline = p.key === "day" ? "for 24 hours"
                : perDay ? `≈ Rs ${perDay} per day`
                : p.duration;
              return (
                <div key={p.key} className={`gn-price-card ${p.popular ? "gn-price-card-popular" : ""} gn-fade`}>
                  {p.popular && <div className="gn-popular-badge">MOST POPULAR</div>}
                  <div className="gn-price-name">{p.name}</div>
                  <div className="gn-price-duration">{p.duration}</div>
                  <div className="gn-price-amount" style={{ color: p.popular ? "var(--gn-pink)" : "#fff" }}>
                    Rs {p.price}
                  </div>
                  <div className="gn-price-subline">{subline}</div>
                  <div className="gn-price-divider" />
                  <ul className="gn-price-features">
                    <li><span style={{ color: "var(--gn-cyan)", fontWeight: 700, marginRight: 6 }}>✓</span>Nearby spots by GPS</li>
                    <li><span style={{ color: "var(--gn-cyan)", fontWeight: 700, marginRight: 6 }}>✓</span>Live party feed</li>
                    <li><span style={{ color: "var(--gn-cyan)", fontWeight: 700, marginRight: 6 }}>✓</span>AI itinerary builder</li>
                  </ul>
                  <button
                    onClick={() => openModal(p.key)}
                    className={p.popular ? "gn-pink-btn gn-pink-btn-md" : "gn-plain-btn"}
                  >
                    {p.popular ? `Unlock for Rs ${p.price}` : `Choose ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="gn-fade" style={{ textAlign: "center", marginTop: 28, color: "var(--gn-muted)", fontFamily: "Inter", fontSize: 13, lineHeight: 2 }}>
            🔒 One-time payment via Razorpay — UPI, card, netbanking<br />
            📧 Receipt sent to your email instantly<br />
            ✓ No account needed until you pay
          </div>
        </div>
      </section>

      {/* ─────── FINAL CTA ─────── */}
      <section className="gn-final-cta">
        <div className="gn-container" style={{ textAlign: "center" }}>
          <h2 className="gn-fade" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, lineHeight: 1, margin: 0, letterSpacing: 1 }}>
            <span style={{ color: "#fff" }}>YOUR GOA TRIP</span>
            <br />
            <span style={{ color: "var(--gn-pink)", textShadow: "0 0 30px rgba(255,45,120,0.5)" }}>STARTS HERE.</span>
          </h2>
          <p className="gn-fade" style={{ color: "var(--gn-muted)", fontFamily: "Inter", fontSize: 16, lineHeight: 1.6, maxWidth: 320, margin: "20px auto 0" }}>
            Stop asking strangers. Stop trusting Google. Open GoaNow the moment you land.
          </p>
          <button onClick={() => openModal("week")} className="gn-pink-btn gn-pink-btn-lg gn-fade" style={{ marginTop: 28 }}>
            Get Access Now →
          </button>
          <p className="gn-fade" style={{ color: "var(--gn-muted)", fontFamily: "Inter", fontSize: 12, marginTop: 14 }}>
            {pricingNote}
          </p>
        </div>
      </section>

      {/* ─────── FOOTER ─────── */}
      <footer className="gn-footer">
        <div className="gn-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "#fff", letterSpacing: 2 }}>
              GOANOW
            </span>
            <span style={{ fontFamily: "Inter", fontSize: 13, color: "var(--gn-muted)" }}>
              goanow.online
            </span>
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontFamily: "Inter", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            Built for Goa tourists · Real-time · Updated daily
          </div>
        </div>
      </footer>

      <PaywallModal
        open={modalOpen}
        onClose={closeModal}
        initialPlan={initialPlan}
        autoAdvance={autoAdvance}
      />

      <style jsx global>{`
        :root {
          --gn-bg: #0A0A0F;
          --gn-bg-alt: #0D0D14;
          --gn-card: rgba(255,255,255,0.04);
          --gn-pink: #FF2D78;
          --gn-cyan: #00F5FF;
          --gn-gold: #FFD700;
          --gn-muted: rgba(255,255,255,0.55);
          --gn-border: rgba(255,255,255,0.08);
        }

        @keyframes gnPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes gnBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }

        .gn-page {
          background: var(--gn-bg);
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
          font-display: swap;
          min-height: 100vh;
        }

        .gn-fade {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .gn-fade.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* NAVBAR */
        .gn-navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 56px;
          background: rgba(10,10,15,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--gn-border);
        }
        .gn-navbar-inner {
          height: 100%;
          max-width: 960px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* PINK BUTTONS */
        .gn-pink-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: var(--gn-pink);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 0 16px rgba(255,45,120,0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .gn-pink-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 28px rgba(255,45,120,0.55);
        }
        .gn-pink-btn-lg {
          width: 100%;
          height: 56px;
          border-radius: 14px;
          font-size: 17px;
          font-weight: 700;
          box-shadow: 0 0 24px rgba(255,45,120,0.45), 0 4px 16px rgba(255,45,120,0.3);
        }
        .gn-pink-btn-md {
          width: 100%;
          height: 48px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 0 20px rgba(255,45,120,0.35);
        }
        .gn-ghost-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 48px;
          background: transparent;
          color: var(--gn-muted);
          border: 1px solid var(--gn-border);
          border-radius: 14px;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 15px;
          cursor: pointer;
          text-decoration: none;
          margin-top: 10px;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .gn-ghost-btn:hover {
          border-color: var(--gn-pink);
          color: #fff;
        }
        .gn-plain-btn {
          width: 100%;
          height: 48px;
          background: rgba(255,255,255,0.08);
          color: #fff;
          border: 1px solid var(--gn-border);
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .gn-plain-btn:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.2);
        }

        /* HERO */
        .gn-hero {
          position: relative;
          min-height: 100svh;
          padding: 48px 20px 32px;
          background:
            radial-gradient(ellipse at 50% 100%, rgba(255,45,120,0.12) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(0,245,255,0.06) 0%, transparent 50%),
            #0A0A0F;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gn-hero-content {
          width: 100%;
          max-width: 640px;
          margin: 0 auto;
        }

        .gn-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,45,120,0.12);
          border: 1px solid rgba(255,45,120,0.3);
          border-radius: 20px;
          padding: 6px 14px;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12px;
          letter-spacing: 0.04em;
        }
        .gn-eyebrow-pink { color: var(--gn-pink); }
        .gn-eyebrow-cyan {
          color: var(--gn-cyan);
          background: rgba(0,245,255,0.08);
          border-color: rgba(0,245,255,0.3);
        }

        .gn-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--gn-pink);
          animation: gnPulse 2s infinite;
        }

        .gn-h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(52px, 13vw, 84px);
          line-height: 0.95;
          letter-spacing: 1px;
          margin: 16px 0 0;
        }
        .gn-h2 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(38px, 8vw, 48px);
          line-height: 1;
          letter-spacing: 1px;
          color: #fff;
          margin: 8px 0 16px;
        }

        .gn-subhead {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #fff;
          line-height: 1.4;
          margin: 20px 0 0;
        }
        .gn-body {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 15px;
          color: var(--gn-muted);
          line-height: 1.65;
          margin: 12px 0 0;
        }

        .gn-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }
        .gn-chip {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--gn-border);
          border-radius: 20px;
          padding: 6px 12px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #fff;
        }

        .gn-cta-stack { margin-top: 28px; }

        .gn-pricing-note {
          text-align: center;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: var(--gn-muted);
          margin-top: 14px;
          line-height: 1.6;
        }

        .gn-scroll-indicator {
          position: absolute;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          color: var(--gn-muted);
          font-size: 22px;
          animation: gnBounce 2s infinite;
          pointer-events: none;
        }

        /* SECTIONS */
        .gn-section {
          padding: 60px 20px;
          background: var(--gn-bg);
        }
        .gn-section-alt { background: var(--gn-bg-alt); }
        .gn-container {
          max-width: 760px;
          margin: 0 auto;
        }

        /* PROBLEM CARDS */
        .gn-problem-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 18px;
        }
        .gn-problem-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,59,59,0.2);
          border-left: 3px solid #FF3B3B;
          border-radius: 12px;
          padding: 18px 20px;
        }
        .gn-problem-title {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 15px;
          color: #fff;
          margin: 0 0 6px;
        }
        .gn-problem-body {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 14px;
          color: var(--gn-muted);
          line-height: 1.6;
        }

        .gn-bounce-arrow {
          color: var(--gn-pink);
          font-size: 28px;
          margin-top: 4px;
          animation: gnBounce 2s infinite;
        }

        /* FEATURE CARDS */
        .gn-feat-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--gn-border);
          border-radius: 16px;
          padding: 24px 20px;
          margin-bottom: 16px;
        }
        .gn-feat-cyan   { border-left: 4px solid var(--gn-cyan); }
        .gn-feat-pink   { border-left: 4px solid var(--gn-pink); }
        .gn-feat-gold   { border-left: 4px solid var(--gn-gold); }
        .gn-feat-violet { border-left: 4px solid #7C3AED; }

        .gn-feat-head {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .gn-icon-badge {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          font-size: 20px;
        }
        .gn-icon-badge-cyan   { background: rgba(0,245,255,0.10); }
        .gn-icon-badge-pink   { background: rgba(255,45,120,0.10); }
        .gn-icon-badge-gold   { background: rgba(255,215,0,0.10); }
        .gn-icon-badge-violet { background: rgba(124,58,237,0.15); }

        .gn-cat-tag {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .gn-feat-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px;
          color: #fff;
          margin: 12px 0 8px;
          letter-spacing: 0.5px;
        }
        .gn-feat-body {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          color: var(--gn-muted);
          line-height: 1.6;
          margin: 0;
        }

        .gn-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 14px;
        }
        .gn-mini-pill {
          background: rgba(255,255,255,0.07);
          border: 1px solid var(--gn-border);
          border-radius: 20px;
          padding: 4px 10px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: #fff;
        }

        .gn-highlight {
          border-radius: 8px;
          padding: 12px 14px;
          margin-top: 14px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #fff;
          line-height: 1.5;
        }
        .gn-highlight-pink {
          background: rgba(255,45,120,0.08);
          border: 1px solid rgba(255,45,120,0.2);
        }
        .gn-highlight-gold {
          background: rgba(255,215,0,0.06);
          border: 1px solid rgba(255,215,0,0.15);
        }

        .gn-icon-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 16px;
        }
        .gn-icon-cell {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--gn-border);
          border-radius: 10px;
          padding: 12px 6px;
          text-align: center;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--gn-muted);
        }

        /* INSIGHT CARDS */
        .gn-insight-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 18px;
        }
        .gn-insight-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--gn-border);
          border-radius: 12px;
          padding: 18px 20px;
        }
        .gn-insight-title {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 15px;
          color: #fff;
          margin: 0 0 6px;
        }
        .gn-insight-body {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: var(--gn-muted);
          line-height: 1.6;
        }

        /* PRICING */
        .gn-price-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 18px;
        }
        @media (min-width: 720px) {
          .gn-price-stack {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            align-items: stretch;
          }
        }
        .gn-price-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--gn-border);
          border-radius: 16px;
          padding: 24px 20px;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .gn-price-card-popular {
          background: rgba(255,45,120,0.08);
          border: 2px solid var(--gn-pink);
          box-shadow: 0 0 30px rgba(255,45,120,0.15);
        }
        .gn-popular-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--gn-pink);
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 2px;
          padding: 3px 12px;
          border-radius: 20px;
        }
        .gn-price-name {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          color: #fff;
          letter-spacing: 1px;
        }
        .gn-price-duration {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: var(--gn-muted);
          margin-top: 2px;
        }
        .gn-price-amount {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 52px;
          line-height: 1;
          margin-top: 14px;
        }
        .gn-price-subline {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--gn-muted);
          margin-top: 4px;
        }
        .gn-price-divider {
          height: 1px;
          background: var(--gn-border);
          margin: 16px 0;
        }
        .gn-price-features {
          list-style: none;
          padding: 0;
          margin: 0 0 18px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #fff;
          line-height: 2;
          flex: 1;
        }

        /* FINAL CTA */
        .gn-final-cta {
          padding: 80px 20px;
          background: linear-gradient(180deg, #0A0A0F 0%, #110818 100%);
        }

        /* FOOTER */
        .gn-footer {
          padding: 24px 20px;
          background: #060608;
          border-top: 1px solid var(--gn-border);
        }
      `}</style>
    </main>
  );
}
