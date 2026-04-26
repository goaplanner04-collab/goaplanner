"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setStatus("Auth not configured. Redirecting…");
      window.location.replace("/");
      return;
    }

    const handle = async () => {
      try {
        // PKCE flow: ?code=...
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
          if (error) {
            setStatus("Sign-in failed: " + error.message);
            setTimeout(() => window.location.replace("/"), 2200);
            return;
          }
        }

        // Implicit flow falls through getSession (handled by detectSessionInUrl)
        let attempts = 0;
        const waitForSession = async () => {
          const { data } = await sb.auth.getSession();
          if (data?.session?.user) {
            // Mirror email into localStorage for forms (PaywallModal etc.)
            try { localStorage.setItem("goanow_email", data.session.user.email || ""); } catch {}
            window.location.replace("/");
            return;
          }
          if (attempts++ < 20) {
            setTimeout(waitForSession, 150);
          } else {
            setStatus("Could not establish session. Redirecting…");
            setTimeout(() => window.location.replace("/"), 1500);
          }
        };
        waitForSession();
      } catch (err) {
        setStatus("Error: " + (err?.message || "unknown"));
        setTimeout(() => window.location.replace("/"), 2000);
      }
    };

    handle();
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
