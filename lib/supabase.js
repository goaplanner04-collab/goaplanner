import { createClient } from "@supabase/supabase-js";

/*
  ===============================================================
  SUPABASE SQL SETUP — paste into Supabase SQL editor:
  ===============================================================

  CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    venue TEXT NOT NULL,
    area TEXT NOT NULL,
    lat FLOAT,
    lng FLOAT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TEXT NOT NULL,
    entry_fee TEXT DEFAULT 'Check at venue',
    vibe TEXT,
    status TEXT DEFAULT 'tonight',
    source TEXT,
    description TEXT,
    insider_tip TEXT,
    publish_on DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE events ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Public read" ON events FOR SELECT USING (true);
  CREATE POLICY "Service write" ON events FOR ALL
    USING (auth.role() = 'service_role');

  -- Optional helper indexes
  CREATE INDEX events_date_idx ON events (date);
  CREATE INDEX events_publish_on_idx ON events (publish_on);

  ===============================================================
*/

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
}

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const supabase = (typeof window !== "undefined")
  ? getSupabaseClient()
  : null;
