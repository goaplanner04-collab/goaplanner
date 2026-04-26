"use client";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client = null;

export function getBrowserSupabase() {
  if (typeof window === "undefined") return null;
  if (!URL || !KEY) return null;
  if (_client) return _client;
  _client = createClient(URL, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: window.localStorage,
      storageKey: "goanow.sb.auth",
    },
  });
  return _client;
}

export async function signInWithGoogle({ redirectTo } = {}) {
  const sb = getBrowserSupabase();
  if (!sb) throw new Error("Supabase not configured");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const target = redirectTo || `${origin}/auth/callback`;
  return sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: target },
  });
}

export async function signOut() {
  const sb = getBrowserSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function getCurrentUser() {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.user || null;
}
