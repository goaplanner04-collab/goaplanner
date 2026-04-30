"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      window.location.replace("/");
      return;
    }

    // With implicit flow, Supabase detects the #access_token fragment
    // automatically via detectSessionInUrl. We just poll until the session
    // is ready, then redirect home.
    let attempts = 0;
    const poll = async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (data?.session?.user) {
          try { localStorage.setItem("goanow_email", data.session.user.email || ""); } catch {}
          window.location.replace("/");
          return;
        }
      } catch {}

      if (attempts++ < 30) {
        setTimeout(poll, 200);
      } else {
        setStatus("Sign-in timed out. Redirecting…");
        setTimeout(() => window.location.replace("/"), 1500);
      }
    };

    poll();
  }, []);

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#07090e,#0e1220)",
      color: "#e9ecf3",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 36, height: 36,
          border: "3px solid rgba(255,255,255,0.15)",
          borderTopColor: "#FF3D81",
          borderRadius: "50%",
          margin: "0 auto 16px",
          animation: "goanowSpin 0.8s linear infinite",
        }} />
        <div style={{ color: "#9aa3b2", fontSize: 14 }}>{status}</div>
      </div>
      <style jsx global>{`
        @keyframes goanowSpin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
