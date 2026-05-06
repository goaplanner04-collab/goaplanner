"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import PaywallModal from "@/components/PaywallModal";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

const DEFAULT_PLANS = [
  { key: "day", name: "Day Pass", price: 49, duration: "24 hours" },
  { key: "week", name: "Week Pass", price: 8, duration: "7 days", popular: true },
  { key: "trip", name: "Trip Pass", price: 149, duration: "30 days" },
];

const FEATURES = [
  { icon: "map-pin", title: "Near You First", desc: "Cafes, seafood, restobars, beaches and rentals sorted by real distance." },
  { icon: "music",   title: "Tonight Sorted", desc: "Live party listings with entry info, crowd timing, venue area and directions." },
  { icon: "route",   title: "Plans That Fit", desc: "A Goa itinerary shaped around your area, budget, group, days and vibe." },
];

const PHOTO_TILES = [
  { title: "Beach mornings", desc: "North to South Goa routes",       icon: "waves",    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80" },
  { title: "Sunset tables",  desc: "Cafes and restobars nearby",      icon: "cocktail", image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80" },
  { title: "Night plans",    desc: "Parties, music and late entries", icon: "ticket",   image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80" },
];

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("week");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [user, setUser] = useState(null);
  const [hasActivePass, setHasActivePass] = useState(false);

  // Pricing
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.pricing) {
          setPlans(["day", "week", "trip"].map((key) => {
            const p = d.pricing[key] || {};
            return { key, name: p.name || key, price: p.price, duration: p.label, popular: !!p.popular };
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Auth state — used ONLY to decide which navbar button to show.
  // The page never gates content behind sign-in.
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

  // Resume the paywall flow after a Google OAuth redirect.
  // PaywallModal stores the in-progress plan in sessionStorage before sign-in,
  // and we re-open the modal automatically when we land back here signed in.
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

  const openModal = (plan) => {
    setInitialPlan(plan);
    setAutoAdvance(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setAutoAdvance(false);
  };

  // Navbar button — Dashboard if signed in & paid, otherwise "Get Access"
  const NavbarCTA = () =>
    user && hasActivePass ? (
      <a href="/dashboard" className="neon-btn-ghost" style={{ padding: "8px 14px", fontSize: 13, minHeight: 36 }}>
        <Icon name="arrow-right" size={16} />
        Go to Dashboard
      </a>
    ) : (
      <button onClick={() => openModal("week")} className="neon-btn-ghost" style={{ padding: "8px 14px", fontSize: 13, minHeight: 36 }}>
        <Icon name="ticket" size={16} />
        Get Access
      </button>
    );

  return (
    <main className="site-shell">
      <section className="landing-hero">
        <div className="landing-hero__inner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div className="brand-mark">
              <span className="brand-mark__icon"><Icon name="sun" size={20} /></span>
              GoaNow
            </div>
            <NavbarCTA />
          </div>

          <h1 className="hero-title">
            Your Goa concierge<span> in one tap.</span>
          </h1>

          <p className="hero-copy">
            We're a hyper-local Goa concierge. Tell us your area and your vibe and we'll hand you a plan you can actually follow — places verified open right now, real distances, real prices, real local insight.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 8, marginBottom: 14, color: "#d8dce8", fontSize: 14, lineHeight: 1.55 }}>
            <div>
              <span style={{ color: "var(--neon-cyan)", fontWeight: 700, marginRight: 8 }}>1.</span>
              Pick a pass below — Day, Week or Trip. One-time payment, no subscription.
            </div>
            <div>
              <span style={{ color: "var(--neon-cyan)", fontWeight: 700, marginRight: 8 }}>2.</span>
              Tell our AI your area, days, group and budget. It builds a polished day-by-day plan.
            </div>
            <div>
              <span style={{ color: "var(--neon-cyan)", fontWeight: 700, marginRight: 8 }}>3.</span>
              Open the dashboard for nearby cafes, tonight's parties, and your saved itineraries — straight from your phone.
            </div>
          </div>

          <div className="hero-actions">
            <button onClick={() => openModal("week")} className="neon-btn">
              <Icon name="ticket" size={18} />
              Get Access for Rs 8
              <Icon name="arrow-right" size={18} />
            </button>
            <a href="#pricing" className="neon-btn-ghost">
              <Icon name="card" size={18} />
              See Plans
            </a>
          </div>

          <div className="hero-proof" aria-label="GoaNow highlights">
            <span className="hero-chip"><Icon name="map-pin" size={16} /> GPS-sorted spots</span>
            <span className="hero-chip"><Icon name="clock" size={16} /> Crowd timing</span>
            <span className="hero-chip"><Icon name="shield" size={16} /> One-time unlock</span>
          </div>
        </div>
      </section>

      <section className="section-wrap" aria-label="GoaNow travel snapshots">
        <div className="experience-strip">
          {PHOTO_TILES.map((tile) => (
            <div key={tile.title} className="photo-tile" style={{ backgroundImage: `url(${tile.image})` }}>
              <div className="photo-tile__content">
                <span className="icon-tile" style={{ width: 38, height: 38, marginBottom: 10 }}>
                  <Icon name={tile.icon} size={19} />
                </span>
                <h2 style={{ margin: 0, fontSize: 25, color: "#fff" }}>{tile.title}</h2>
                <p style={{ margin: "4px 0 0", color: "#d8dce8", fontSize: 13 }}>{tile.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-wrap">
        <h2 className="section-heading">Move Better Through Goa</h2>
        <p className="section-kicker">
          GoaNow keeps the useful bits close to your thumb: where to go, when to arrive, what it costs, and how to get there.
        </p>

        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="glass-card feature-card">
              <span className="icon-tile"><Icon name={feature.icon} size={22} /></span>
              <h3 style={{ margin: "16px 0 8px", fontSize: 25, color: "#fff" }}>{feature.title}</h3>
              <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 14, lineHeight: 1.6 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="section-wrap">
        <h2 className="section-heading" style={{ textAlign: "center" }}>Pick Your Pass</h2>
        <p className="section-kicker" style={{ textAlign: "center", marginLeft: "auto", marginRight: "auto" }}>
          One-time access, no subscription. Choose based on how long you are in Goa.
        </p>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <div key={plan.key} className={`glass-card plan-card ${plan.popular ? "is-popular" : ""}`}>
              {plan.popular && (
                <span className="badge badge-pink" style={{ alignSelf: "flex-start" }}>
                  <Icon name="star" size={14} /> Most picked
                </span>
              )}

              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {plan.name}
                </div>
                <div className="plan-price" style={{ color: plan.popular ? "var(--neon-pink)" : "#fff" }}>
                  Rs {plan.price}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{plan.duration}</div>
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: "auto" }}>
                {["Nearby places", "Live event feed", "AI itinerary"].map((item) => (
                  <span key={item} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#d8dce8", fontSize: 13 }}>
                    <Icon name="check" size={16} style={{ color: "var(--neon-cyan)" }} /> {item}
                  </span>
                ))}
              </div>

              <button
                onClick={() => openModal(plan.key)}
                className={plan.popular ? "neon-btn" : "neon-btn-ghost"}
                style={{ width: "100%", marginTop: 6 }}
              >
                <Icon name="ticket" size={17} /> Unlock <Icon name="arrow-right" size={17} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ padding: "28px 20px 34px", textAlign: "center", borderTop: "1px solid var(--border-glass)", color: "var(--text-muted)", fontSize: 13 }}>
        GoaNow for travelers in Goa. Built for fast decisions, late plans, and better days.
      </footer>

      <PaywallModal
        open={modalOpen}
        onClose={closeModal}
        initialPlan={initialPlan}
        autoAdvance={autoAdvance}
      />
    </main>
  );
}
