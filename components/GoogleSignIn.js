"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase, signInWithGoogle, signOut } from "@/lib/supabaseBrowser";

export default function GoogleSignIn({ onUser, compact = false }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;

    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = data?.session?.user || null;
      setUser(u);
      if (u && onUser) onUser(u);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u && onUser) onUser(u);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [onUser]);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: oauthError } = await signInWithGoogle();
      if (oauthError) setError(oauthError.message || "Could not sign in");
    } catch (err) {
      setError(err?.message || "Could not sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    if (onUser) onUser(null);
  };

  if (user) {
    if (compact) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
          <span style={{ color: "#33D6C8" }}>✓</span>
          <span style={{ color: "#fff", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline", fontSize: 12, padding: 0 }}
          >
            Sign out
          </button>
        </div>
      );
    }
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", background: "rgba(0,200,140,0.08)",
        border: "1px solid rgba(0,200,140,0.3)", borderRadius: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url} alt="" width={32} height={32} style={{ borderRadius: "50%" }} />
          )}
          <div>
            <div style={{ fontSize: 13, color: "#33D6C8", fontWeight: 600 }}>✓ Signed in</div>
            <div style={{ fontSize: 13, color: "#fff", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.15)",
            color: "var(--text-muted)", cursor: "pointer", padding: "6px 10px",
            borderRadius: 8, fontSize: 12,
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", background: "#fff", color: "#1f1f1f",
          border: "none", borderRadius: 999, fontSize: 12, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1, whiteSpace: "nowrap",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.62z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.36 0-4.36-1.59-5.07-3.73H.96v2.34A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.93 10.69A5.4 5.4 0 0 1 3.64 9c0-.59.1-1.16.29-1.69V4.97H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.97-2.34z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.97L3.93 7.31C4.64 5.18 6.64 3.58 9 3.58z"/>
        </svg>
        {loading ? "..." : "Sign in"}
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        style={{
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "11px 16px",
          background: "#fff",
          color: "#1f1f1f",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 11,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.62z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.36 0-4.36-1.59-5.07-3.73H.96v2.34A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.93 10.69A5.4 5.4 0 0 1 3.64 9c0-.59.1-1.16.29-1.69V4.97H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.97-2.34z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.97L3.93 7.31C4.64 5.18 6.64 3.58 9 3.58z"/>
        </svg>
        {loading ? "Redirecting…" : "Sign in with Google"}
      </button>
      {error && (
        <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
