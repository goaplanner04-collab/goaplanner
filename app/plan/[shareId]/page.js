import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchPlan(shareId) {
  if (!shareId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("saved_itineraries")
      .select("itinerary_text, user_area, duration_days, language, created_at")
      .eq("share_id", shareId.toUpperCase())
      .single();
    return data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const plan = await fetchPlan(params.shareId);
  if (!plan) {
    return { title: "Plan not found — GoaNow" };
  }
  const preview = (plan.itinerary_text || "").slice(0, 150).replace(/\s+/g, " ");
  return {
    title: "My Goa Plan — GoaNow 🔥",
    description: preview,
    openGraph: {
      title: "My Goa Plan — GoaNow 🔥",
      description: preview,
      url: `https://goanow.in/plan/${params.shareId}`,
      siteName: "GoaNow",
      type: "article",
    },
  };
}

export default async function SharedPlanPage({ params }) {
  const plan = await fetchPlan(params.shareId);

  if (!plan) {
    return (
      <main style={{ minHeight: "100vh", background: "#07090e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>😔</div>
          <h1 style={{ fontSize: 32, color: "#FF3D81", marginBottom: 12 }}>Plan not found or expired</h1>
          <p style={{ color: "#9aa3b2", marginBottom: 28, fontSize: 15 }}>
            This shared GoaNow plan no longer exists, or the link is incorrect.
          </p>
          <Link href="/" style={{ display: "inline-block", padding: "14px 28px", background: "linear-gradient(135deg,#FF3D81,#FF6B6B)", color: "#fff", borderRadius: 12, textDecoration: "none", fontWeight: 700 }}>
            Create your own Goa plan on GoaNow →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#07090e,#0e1220)", color: "#fff", padding: "32px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 14, color: "#9aa3b2", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
            Created with GoaNow AI
          </div>
          <h1 style={{ fontSize: 44, color: "#FF3D81", margin: 0, textShadow: "0 0 24px rgba(255,61,129,0.4)" }}>
            🔥 Goa Itinerary
          </h1>
          {plan.user_area && (
            <div style={{ fontSize: 16, color: "#d8dce8", marginTop: 8 }}>
              📍 {plan.user_area}{plan.duration_days ? ` · ${plan.duration_days} day${plan.duration_days === 1 ? "" : "s"}` : ""}
            </div>
          )}
        </div>

        <article
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            padding: 28,
            backdropFilter: "blur(10px)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.7,
            fontSize: 15,
            color: "#e9ecf3",
          }}
        >
          {plan.itinerary_text}
        </article>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link
            href="/#itinerary"
            style={{
              display: "inline-block",
              padding: "16px 32px",
              background: "linear-gradient(135deg,#FF3D81,#FF6B6B)",
              color: "#fff",
              borderRadius: 14,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 16,
              boxShadow: "0 0 30px rgba(255,61,129,0.4)",
            }}
          >
            Build YOUR Goa plan →
          </Link>
          <p style={{ color: "#9aa3b2", fontSize: 13, marginTop: 16 }}>
            One-time access pass · Live data · AI-built itinerary
          </p>
        </div>
      </div>
    </main>
  );
}
