"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import PaywallModal from "@/components/PaywallModal";
import GoogleSignIn from "@/components/GoogleSignIn";
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
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

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

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setAuthChecked(true);
      return;
    }

    let mounted = true;
    let resolved = false;

    // If the URL contains OAuth tokens we're mid-redirect — wait longer
    // before declaring "no session" because supabase-js detects them async.
    const url = typeof window !== "undefined" ? window.location.href : "";
    const hasOAuthFragment =
      url.includes("access_token=") ||
      url.includes("refresh_token=") ||
      url.includes("?code=") ||
      url.includes("&code=");

    const finish = async (u) => {
      if (!mounted || resolved) return;
      resolved = true;
      setUser(u || null);
      setAuthChecked(true);

      // If user is signed in, check the server for an active pass
      // and auto-redirect to dashboard if one exists. This makes the
      // pass survive sign-out / new device.
      if (u?.email) {
        try {
          localStorage.setItem("goanow_email", u.email);
          const res = await fetch(`/api/user/pass?email=${encodeURIComponent(u.email)}`);
          const data = await res.json();
          if (data?.active && data?.expiresAt) {
            const expiryMs = new Date(data.expiresAt).getTime();
            if (expiryMs > Date.now()) {
              localStorage.setItem("goanow_plan", data.planName || "Pass");
              localStorage.setItem("goanow_expiry", String(expiryMs));
              window.location.replace("/dashboard");
            }
          }
        } catch {}
      }
    };

    // Auth state changes (fires when OAuth tokens are processed)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) finish(session.user);
    });

    // Cached session check
    sb.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        finish(data.session.user);
        return;
      }
      // No cached session yet. If URL had OAuth tokens, wait for the listener.
      // Otherwise give up after a short timeout.
      const fallback = hasOAuthFragment ? 3000 : 600;
      setTimeout(() => finish(null), fallback);
    });

    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  const openModal = (plan) => {
    setInitialPlan(plan);
    setModalOpen(true);
  };

  // ── GATE: Show sign-in screen if not authenticated ────────────────
  if (authChecked && !user) {
    const pills = [
      { icon: "🔓", text: "One-time pass — no subscription" },
      { icon: "✉️", text: "Plan and receipts emailed to your Gmail" },
      { icon: "🔔", text: "Tonight's party alerts (opt out anytime)" },
    ];
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(255,45,120,0.04) 0%, #0A0A0F 60%)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 480,
            padding: "var(--gn-pad, 40px 36px)",
            textAlign: "center",
            background: "#0A0A0F",
            border: "1px solid rgba(255,45,120,0.2)",
            borderRadius: 24,
            boxShadow:
              "0 0 60px rgba(255,45,120,0.08), 0 0 120px rgba(0,245,255,0.04)",
            overflow: "hidden",
          }}
        >
          {/* Inner radial pulse */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(255,45,120,0.06) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            {/* Logo row */}
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <span className="brand-mark__icon"><Icon name="sun" size={20} /></span>
              <span
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 22,
                  letterSpacing: 4,
                  color: "#fff",
                  marginLeft: 10,
                }}
              >
                GOANOW
              </span>
            </div>

            {/* Headline */}
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(34px, 6vw, 42px)",
                lineHeight: 1.1,
                letterSpacing: 1,
                margin: "0 0 16px",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              <span style={{ color: "#FF2D78" }}>Your Goa </span>
              <span style={{ color: "#fff" }}>concierge</span>
              <span style={{ color: "#FF2D78" }}> in one tap.</span>
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: 16,
                color: "#fff",
                margin: "0 0 8px",
              }}
            >
              GoaNow is a hyper-local guide for travellers in Goa.
            </p>

            {/* Description */}
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 400,
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.6,
                margin: "0 0 28px",
              }}
            >
              Nearby cafes sorted by your real distance. Tonight's parties with crowd-arrival timing. An AI itinerary tailored to your area, vibe and budget — places verified open before they reach you.
            </p>

            {/* Continue label */}
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Continue to GoaNow
            </div>

            {/* Google Sign In (functionality untouched) */}
            <GoogleSignIn onUser={(u) => { if (u) setUser(u); }} />

            {/* Divider */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "24px 0" }} />

            {/* Feature pills */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 8,
                marginBottom: 28,
              }}
            >
              {pills.map((p) => (
                <span
                  key={p.text}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 20,
                    padding: "8px 16px",
                    margin: 4,
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#fff",
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{p.icon}</span>
                  <span style={{ color: "#00F5FF", fontWeight: 700, marginRight: 4 }}>✓</span>
                  {p.text}
                </span>
              ))}
            </div>

            {/* Privacy note */}
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1.5,
                marginTop: 20,
                marginBottom: 0,
                textAlign: "center",
              }}
            >
              Sign in to continue. We use your email only for receipts, your itinerary, and party alerts.{" "}
              <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                Never sold or spammed.
              </span>
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authChecked) {
    return (
      <main className="site-shell" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
      </main>
    );
  }

  // ── Authenticated landing page ─────────────────────────────────────
  return (
    <main className="site-shell">
      <section className="landing-hero">
        <div className="landing-hero__inner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div className="brand-mark">
              <span className="brand-mark__icon"><Icon name="sun" size={20} /></span>
              GoaNow
            </div>
            <GoogleSignIn compact onUser={(u) => setUser(u)} />
          </div>

          <h1 className="hero-title">
            Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
            <span> to GoaNow.</span>
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
        onClose={() => setModalOpen(false)}
        initialPlan={initialPlan}
        prefillEmail={user?.email}
      />
    </main>
  );
}
