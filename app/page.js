"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PaywallModal from "@/components/PaywallModal";
import { getBrowserSupabase, signInWithGoogle } from "@/lib/supabaseBrowser";

const COLORS = {
  navy: "#1B3A5C",
  teal: "#00B4C6",
  ocean: "#0077A8",
  amber: "#F5A623",
  white: "#FFFFFF",
  offwhite: "#F7F9FB",
  border: "#E2E8ED",
  muted: "#6B7E8F",
  shadow: "0 2px 12px rgba(0,119,168,0.1)",
};

const PLANS = [
  {
    key: "day",
    name: "Day Pass",
    duration: "24 hours",
    price: "₹8",
    perDay: null,
    accent: COLORS.ocean,
    selectedBg: "rgba(0,119,168,0.04)",
    payShadow: "0 4px 16px rgba(0,119,168,0.3)",
    payLabel: "Get Day Pass — ₹8",
  },
  {
    key: "week",
    name: "Week Pass",
    duration: "7 days",
    price: "₹21",
    perDay: "≈ ₹3/day",
    accent: COLORS.teal,
    selectedBg: "rgba(0,180,198,0.04)",
    payShadow: "0 4px 16px rgba(0,180,198,0.3)",
    payLabel: "Get Week Pass — ₹21",
  },
  {
    key: "trip",
    name: "Trip Pass",
    duration: "19 days",
    price: "₹59",
    perDay: "≈ ₹2/day",
    accent: COLORS.navy,
    selectedBg: "rgba(27,58,92,0.04)",
    payShadow: "0 4px 16px rgba(27,58,92,0.2)",
    payLabel: "Get Trip Pass — ₹59",
  },
];

const USE_CASES = [
  {
    icon: "📍",
    iconBg: "rgba(0,180,198,0.1)",
    title: "Nearest cafes, beaches & restobars",
    desc: "Sorted by your real GPS distance — not what's popular, what's actually close.",
  },
  {
    icon: "🎉",
    iconBg: "rgba(245,166,35,0.1)",
    title: "Tonight's parties with real crowd timing",
    desc: "We check 10+ Goa party accounts nightly. You know when the crowd actually arrives.",
  },
  {
    icon: "🗺️",
    iconBg: "rgba(0,119,168,0.1)",
    title: "AI itinerary built for your budget",
    desc: "Tell it your area, days and budget. Get a real day-by-day Goa plan.",
  },
  {
    icon: "🏨",
    iconBg: "rgba(27,58,92,0.08)",
    title: "Hotels, water sports & tourist spots",
    desc: "Everything near you — scooter rentals, forts, beaches, hidden gems included.",
  },
];

export default function LandingPage() {
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState("week");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [selected, setSelected] = useState("week");
  const [user, setUser] = useState(null);
  const [hasActivePass, setHasActivePass] = useState(false);

  // auth state
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

  // resume modal OR start trial after OAuth redirect
  useEffect(() => {
    if (!user?.email) return;

    // Branch 1: came back from "Try Free" → start trial and go to dashboard
    let pendingTrial = "";
    try { pendingTrial = sessionStorage.getItem("goanow_pending_trial") || ""; } catch {}
    if (pendingTrial) {
      try { sessionStorage.removeItem("goanow_pending_trial"); } catch {}
      startTrialFlags();
      router.replace("/dashboard");
      return;
    }

    // Branch 2: came back from a paid plan CTA → resume PaywallModal
    let pendingPlan = "";
    try { pendingPlan = sessionStorage.getItem("goanow_pending_plan") || ""; } catch {}
    if (!pendingPlan) return;
    try { sessionStorage.removeItem("goanow_pending_plan"); } catch {}
    setInitialPlan(pendingPlan);
    setAutoAdvance(true);
    setModalOpen(true);
  }, [user?.email, router]);

  const openModal = (plan) => {
    setInitialPlan(plan);
    setAutoAdvance(false);
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setAutoAdvance(false); };

  // Set trial localStorage flags so the dashboard skips the interstitial and
  // starts the 10-min timer. startTrial() in trialUtils is idempotent — it
  // won't reset the timer if a previous trial start exists (abuse guard).
  const startTrialFlags = () => {
    if (typeof window === "undefined") return;
    try {
      const existingStart = localStorage.getItem("goanow_trial_start");
      const expired = localStorage.getItem("goanow_trial_expired") === "true";
      if (!existingStart && !expired) {
        localStorage.setItem("goanow_trial_start", String(Date.now()));
        localStorage.setItem("goanow_trial_expired", "false");
      }
      localStorage.setItem("goanow_trial_choice", "trial");
    } catch {}
  };

  const handleCTA = () => {
    // Paid users → straight to dashboard
    if (user && hasActivePass) {
      router.push("/dashboard");
      return;
    }

    // Signed in but no paid pass → start (or resume) trial, then dashboard.
    // Dashboard handles trial-expired-unpaid case by showing the paywall overlay.
    if (user?.email) {
      startTrialFlags();
      router.push("/dashboard");
      return;
    }

    // Not signed in → trigger Google OAuth, mark intent so we auto-resume on return
    try { sessionStorage.setItem("goanow_pending_trial", "1"); } catch {}
    signInWithGoogle().catch(() => {
      try { sessionStorage.removeItem("goanow_pending_trial"); } catch {}
    });
  };

  const selectedPlan = PLANS.find((p) => p.key === selected) || PLANS[1];

  // ── styles ────────────────────────────────────────────────────
  const s = {
    page: {
      background: COLORS.white,
      color: COLORS.navy,
      fontFamily: "'Inter', system-ui, sans-serif",
      minHeight: "100vh",
      WebkitFontSmoothing: "antialiased",
    },
    container: {
      maxWidth: 440,
      margin: "0 auto",
    },
    nav: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: COLORS.white,
      borderBottom: `1px solid ${COLORS.border}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      overflow: "visible",
    },
    navInner: {
      maxWidth: 440,
      margin: "0 auto",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logo: {
      display: "block",
      width: "auto",
      objectFit: "contain",
    },
    navBtn: {
      background: COLORS.teal,
      color: COLORS.white,
      border: "none",
      borderRadius: 8,
      padding: "10px 18px",
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      fontSize: 14,
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,180,198,0.3)",
      whiteSpace: "nowrap",
      flexShrink: 0,
    },
    hero: {
      padding: "48px 24px 40px",
      background: COLORS.white,
      textAlign: "center",
    },
    tagline: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(0,180,198,0.08)",
      border: "1px solid rgba(0,180,198,0.2)",
      borderRadius: 20,
      padding: "5px 14px",
      marginBottom: 18,
    },
    taglineDot: {
      width: 6,
      height: 6,
      background: COLORS.teal,
      borderRadius: "50%",
      display: "inline-block",
    },
    taglineText: {
      fontFamily: "'Inter', sans-serif",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.teal,
      letterSpacing: 0.2,
    },
    h1: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 800,
      fontSize: 42,
      lineHeight: 1.1,
      color: COLORS.navy,
      margin: "0 auto 12px",
      maxWidth: 320,
    },
    sub: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: 16,
      color: COLORS.muted,
      lineHeight: 1.55,
      maxWidth: 300,
      margin: "0 auto 28px",
    },
    heroCta: {
      display: "block",
      width: "calc(100% - 48px)",
      maxWidth: 320,
      height: 54,
      background: COLORS.teal,
      color: COLORS.white,
      border: "none",
      borderRadius: 12,
      fontFamily: "'Inter', sans-serif",
      fontWeight: 700,
      fontSize: 16,
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0,180,198,0.35)",
      transition: "all 0.18s ease",
      margin: "0 auto",
    },
    heroFine: {
      marginTop: 10,
      fontFamily: "'Inter', sans-serif",
      fontSize: 12,
      color: COLORS.muted,
      textAlign: "center",
    },
    sectionLabel: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      fontSize: 11,
      color: COLORS.teal,
      letterSpacing: 2.5,
      textTransform: "uppercase",
      marginBottom: 16,
      display: "block",
    },
    frame1: {
      background: COLORS.offwhite,
      padding: "36px 24px",
    },
    useCaseBox: {
      background: COLORS.white,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: COLORS.shadow,
    },
    useCaseRow: (isLast) => ({
      display: "flex",
      alignItems: "flex-start",
      gap: 16,
      padding: "18px 20px",
      borderBottom: isLast ? "none" : `1px solid ${COLORS.border}`,
    }),
    useCaseIcon: (bg) => ({
      width: 40,
      height: 40,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontSize: 20,
      background: bg,
    }),
    useCaseTitle: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      fontSize: 15,
      color: COLORS.navy,
      lineHeight: 1.3,
      display: "block",
      marginBottom: 3,
    },
    useCaseDesc: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: 13,
      color: COLORS.muted,
      lineHeight: 1.5,
      display: "block",
    },
    frame2: {
      background: COLORS.white,
      padding: "36px 24px",
    },
    sectionLabelTight: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      fontSize: 11,
      color: COLORS.teal,
      letterSpacing: 2.5,
      textTransform: "uppercase",
      marginBottom: 8,
      display: "block",
    },
    sectionHeading: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 700,
      fontSize: 22,
      color: COLORS.navy,
      margin: "0 0 4px",
    },
    sectionSubtext: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: 14,
      color: COLORS.muted,
      margin: "0 0 20px",
    },
    plansList: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    planCard: (plan, isSel) => ({
      position: "relative",
      borderRadius: 14,
      padding: "18px 20px",
      cursor: "pointer",
      transition: "all 0.18s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      border: isSel ? `2px solid ${plan.accent}` : `2px solid ${COLORS.border}`,
      background: isSel ? plan.selectedBg : COLORS.white,
      fontFamily: "'Inter', sans-serif",
      textAlign: "left",
      width: "100%",
      minHeight: 44,
      WebkitTapHighlightColor: "transparent",
    }),
    popularBadge: {
      position: "absolute",
      top: -1,
      right: 14,
      background: COLORS.teal,
      color: COLORS.white,
      fontFamily: "'Inter', sans-serif",
      fontWeight: 700,
      fontSize: 9,
      letterSpacing: 1,
      textTransform: "uppercase",
      padding: "3px 8px",
      borderRadius: "0 0 8px 8px",
    },
    planName: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 700,
      fontSize: 16,
      color: COLORS.navy,
    },
    planDuration: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: 13,
      color: COLORS.muted,
      marginTop: 2,
    },
    planPrice: (accent) => ({
      fontFamily: "'Inter', sans-serif",
      fontWeight: 800,
      fontSize: 28,
      color: accent,
      lineHeight: 1,
    }),
    planPerDay: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: 11,
      color: COLORS.muted,
      textAlign: "right",
      marginTop: 2,
    },
    includedBox: {
      marginTop: 16,
      background: COLORS.offwhite,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      padding: "14px 16px",
    },
    includedHead: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      fontSize: 13,
      color: COLORS.navy,
      marginBottom: 10,
    },
    includedRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 16,
    },
    includedItem: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: 13,
      color: COLORS.muted,
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
    check: {
      color: COLORS.teal,
      fontWeight: 700,
    },
    payBtn: (plan) => ({
      marginTop: 16,
      width: "100%",
      height: 54,
      background: plan.accent,
      color: COLORS.white,
      border: "none",
      borderRadius: 12,
      fontFamily: "'Inter', sans-serif",
      fontWeight: 700,
      fontSize: 16,
      cursor: "pointer",
      boxShadow: plan.payShadow,
      transition: "all 0.18s ease",
    }),
    trustLine: {
      marginTop: 12,
      textAlign: "center",
      fontFamily: "'Inter', sans-serif",
      fontSize: 12,
      color: COLORS.muted,
      lineHeight: 1.8,
    },
    founder: {
      background: COLORS.offwhite,
      borderTop: `1px solid ${COLORS.border}`,
      padding: "28px 24px",
      textAlign: "center",
    },
    quote: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: 15,
      color: COLORS.navy,
      lineHeight: 1.65,
      maxWidth: 320,
      margin: "0 auto 12px",
      fontStyle: "italic",
    },
    quoteMark: {
      fontSize: 32,
      color: COLORS.teal,
      lineHeight: 0,
      verticalAlign: -8,
      fontStyle: "normal",
      marginRight: 2,
    },
    attribution: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      fontSize: 13,
      color: COLORS.navy,
      marginTop: 4,
    },
    footerLogo: {
      height: 44,
      opacity: 0.7,
      marginTop: 14,
      display: "block",
      marginLeft: "auto",
      marginRight: "auto",
    },
  };

  return (
    <main style={s.page}>
      {/* NAVBAR */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={{ flex: 1 }} />
          <img src="/logo.png" alt="GoaNow" className="gn-nav-logo" style={{ height: 110, width: "auto", objectFit: "contain", display: "block" }} />
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleCTA} className="gn-btn-nav" style={s.navBtn}>
              {user && hasActivePass ? "Open GoaNow →" : "Try Free"}
            </button>
          </div>
        </div>
      </nav>

      <div style={s.container}>
        {/* HERO */}
        <section style={s.hero}>
          <div style={s.tagline}>
            <span style={s.taglineDot} />
            <span style={s.taglineText}>Built for Goa tourists</span>
          </div>

          <h1 style={s.h1}>
            Discover Goa.<br />Right Now.
          </h1>

          <p style={s.sub}>
            Everything a tourist needs in Goa — sorted by where you actually are.
          </p>

          <button
            onClick={handleCTA}
            className="gn-btn-hero"
            style={s.heroCta}
          >
            Try Free for 10 Minutes
          </button>

          <div style={s.heroFine}>
            No card needed · ₹8 to continue after trial
          </div>
        </section>

        {/* FRAME 1 — USE CASES */}
        <section style={s.frame1}>
          <span style={s.sectionLabel}>WHAT GOANOW DOES</span>
          <div style={s.useCaseBox}>
            {USE_CASES.map((row, i) => (
              <div key={i} style={s.useCaseRow(i === USE_CASES.length - 1)}>
                <div style={s.useCaseIcon(row.iconBg)}>{row.icon}</div>
                <div style={{ flex: 1 }}>
                  <span style={s.useCaseTitle}>{row.title}</span>
                  <span style={s.useCaseDesc}>{row.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FRAME 2 — PRICING */}
        <section style={s.frame2}>
          <span style={s.sectionLabelTight}>SIMPLE PRICING</span>
          <h2 style={s.sectionHeading}>One-time. No subscription.</h2>
          <p style={s.sectionSubtext}>Pay once for your trip. That's it.</p>

          <div style={s.plansList}>
            {PLANS.map((p) => {
              const isSel = selected === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelected(p.key)}
                  className="gn-plan"
                  style={s.planCard(p, isSel)}
                >
                  {p.key === "week" && (
                    <span style={s.popularBadge}>MOST POPULAR</span>
                  )}
                  <div>
                    <div style={s.planName}>{p.name}</div>
                    <div style={s.planDuration}>{p.duration}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={s.planPrice(p.accent)}>{p.price}</div>
                    {p.perDay && <div style={s.planPerDay}>{p.perDay}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={s.includedBox}>
            <div style={s.includedHead}>All plans include:</div>
            <div style={s.includedRow}>
              <span style={s.includedItem}>
                <span style={s.check}>✓</span>Nearby spots by GPS
              </span>
              <span style={s.includedItem}>
                <span style={s.check}>✓</span>Live party feed
              </span>
              <span style={s.includedItem}>
                <span style={s.check}>✓</span>AI itinerary builder
              </span>
            </div>
          </div>

          <button
            onClick={() => openModal(selected)}
            className="gn-pay"
            style={s.payBtn(selectedPlan)}
          >
            {selectedPlan.payLabel}
          </button>

          <div style={s.trustLine}>
            🔒 Secured by Razorpay · UPI · Card · Netbanking<br />
            One-time payment · No subscription · No hidden fees
          </div>
        </section>

        {/* FRAME 3 — FOUNDER LINE */}
        <section style={s.founder}>
          <div style={s.quote}>
            <span style={s.quoteMark}>“</span>
            We built GoaNow after wasting a Saturday night showing up to an empty party in Goa. The flyer said 10 PM. Nobody came till midnight. Nobody told us. So we built something that does.
          </div>
          <div style={s.attribution}>
            — Dhananjay &amp; Shishir, founders of GoaNow
          </div>
          <img src="/logo.png" alt="GoaNow" style={s.footerLogo} />
        </section>
      </div>

      <PaywallModal
        open={modalOpen}
        onClose={closeModal}
        initialPlan={initialPlan}
        autoAdvance={autoAdvance}
      />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        html, body {
          margin: 0;
          padding: 0;
          background: #FFFFFF;
          color: #1B3A5C;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }
        * { box-sizing: border-box; }

        .gn-btn-nav:hover { background: #009DB5; }
        .gn-btn-nav:active { transform: scale(0.98); }

        .gn-btn-hero:hover {
          background: #009DB5;
          box-shadow: 0 6px 20px rgba(0,180,198,0.45);
        }
        .gn-btn-hero:active { transform: scale(0.98); }

        .gn-plan:active { transform: scale(0.99); }

        .gn-pay:active { transform: scale(0.98); }
        .gn-pay:hover { filter: brightness(1.05); }

      `}</style>
    </main>
  );
}
