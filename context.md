# GoaNow Project Context

## What This Project Is

GoaNow is a Next.js 14 App Router app for tourists in Goa. It sells one-time access passes, then shows a protected dashboard with nearby places, live party/event listings, and an AI itinerary builder. It also includes a password-protected admin panel for managing events, pricing, trial keys, flyer extraction, and District.in imports.

## Stack

- Framework: Next.js 14, React 18, App Router
- Styling: Tailwind CSS plus custom global CSS in `app/globals.css`
- Payments: Razorpay Checkout with server-side order creation and HMAC verification
- Database: Supabase Postgres via `@supabase/supabase-js`
- AI: Anthropic SDK
- Data helpers: hard-coded spots in `lib/spotsData.js`, distance calculation in `lib/haversine.js`, Google Places (New) v1 client in `lib/googlePlaces.js`

## Important Commands

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

The dev server normally runs at `http://localhost:3000`.

## Environment Variables

Required for full functionality:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=
ADMIN_PASSWORD=

TRIAL_KEYS=GOA2024:168,PRESS:72

# Google Places API (NEW) v1 — server-side only — never expose to browser
GOOGLE_PLACES_API_KEY=

# Resend transactional email (server-side only)
RESEND_API_KEY=
RESEND_FROM=GoaNow <hello@goanow.online>
NEXT_PUBLIC_SITE_URL=https://goanow.online

# Cron secret for /api/email/party-blast (used by Railway/external cron)
CRON_SECRET=
```

`GOOGLE_PLACES_API_KEY` setup:
1. https://console.cloud.google.com → APIs & Services → Library, enable both:
   - **Places API (New)** (places.googleapis.com — used for search + details)
   - **Geocoding API** (used for area name → coords fallback)
2. Credentials → Create API key. Set **Application restrictions = None** (or IP-restrict to your server). HTTP-referrer restrictions break server-side calls because the Referer header is empty.
3. Diagnose any 403/REQUEST_DENIED via `/api/places/debug` — it returns the exact Google error.
4. Geocoding fallback chain in `lib/googlePlaces.js`: hard-coded Goa town centroids → Geocoding API → `GOA_CENTER`.

`TRIAL_KEYS` is optional and uses `CODE:HOURS` pairs. Public browser-exposed variables are only the `NEXT_PUBLIC_*` values.

## App Routes

- `app/page.js`: public landing page with pricing cards and `PaywallModal`.
- `app/dashboard/page.js`: protected dashboard. Access is checked client-side using `localStorage` keys `goanow_plan` and `goanow_expiry`.
- `app/expired/page.js`: shown when a stored pass is expired.
- `app/admin/page.js`: admin dashboard. Login stores `admin_auth` and `admin_pwd` in `sessionStorage`.
- `app/layout.js`: root layout and fonts.
- `app/globals.css`: visual system, layout classes, animations, and shared component styling.

## Dashboard Behavior

The dashboard has four tabs (default: **Nearby**):

- **Nearby**: uses browser geolocation when available, falls back to manual Goa area lookup or Goa center. Spots come from `/api/places` (live Google data, with `lib/spotsData.js` as fallback) and are sorted by Haversine distance or rating.
- **🏨 Hotels**: 3-screen flow — area picker (15 Goa towns) → stay-type picker (Beachside Resort / Hotel / Boutique-Villa / Hostel-Zostel / Guesthouse) → results from `/api/hotels`. A stay-type pill bar on the results screen lets users switch type without going back. Renders via `components/HotelCard.js` with photo carousel + tap-to-cycle.
- **Parties**: fetches `/api/events`, optionally computes distance to events if the browser grants location.
- **AI Plan**: renders `components/ItineraryBuilder.js`, which posts trip details to `/api/itinerary`. The result is parsed line-by-line so 📍 place lines get an inline 2-photo strip below them when matching photos exist in the response's `placePhotos` map.

Pass enforcement is client-side only. Payment or trial success writes:

```js
localStorage.setItem("goanow_plan", planName);
localStorage.setItem("goanow_expiry", String(Date.now() + durationMs));
```

## Payments

- `components/PaywallModal.js` loads `https://checkout.razorpay.com/v1/checkout.js`.
- `/api/create-order` creates Razorpay orders server-side.
- `/api/verify-payment` verifies the Razorpay signature with `RAZORPAY_KEY_SECRET`.
- On successful verification, the browser grants local pass access and redirects to `/dashboard`.
- Pricing defaults live in both `components/PaywallModal.js` and `/api/settings`; dynamic pricing can override via the Supabase `settings` table.

## Events And Supabase

Supabase helpers are in `lib/supabase.js`:

- `getSupabaseClient()`: anon client, safe for public reads.
- `getSupabaseAdmin()`: service role client for server-side writes/admin operations.

Main event routes:

- `/api/events`: public/admin event feed. Public users see today's events with `publish_on <= today`; if Supabase is not configured, errors, or returns no public data, the public route returns a curated fallback list.
- `/api/admin/events`: creates an event, requires `x-admin-auth: <ADMIN_PASSWORD>`.
- `/api/admin/events/[id]`: updates or deletes an event, requires admin header.
- `/api/admin/bulk-upload`: accepts an array of events or `{ events: [...] }`, sanitizes fields, and upserts to Supabase.

Additional Supabase tables (run these SQL statements):

```sql
-- Crowd intel cache (Reddit + Haiku output)
CREATE TABLE IF NOT EXISTS crowd_intel (
  place_id TEXT PRIMARY KEY,
  place_name TEXT,
  area TEXT,
  best_time TEXT,
  peak_crowd_time TEXT,
  avg_price_per_person INTEGER,
  price_range JSONB,
  common_complaints JSONB,
  insider_tips JSONB,
  data_quality TEXT,
  post_count INTEGER,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved/shared itineraries
CREATE TABLE IF NOT EXISTS saved_itineraries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id TEXT UNIQUE NOT NULL,
  itinerary_text TEXT NOT NULL,
  user_area TEXT,
  user_budget INTEGER,
  duration_days INTEGER,
  group_type TEXT,
  language TEXT DEFAULT 'en',
  data_source TEXT,
  places_checked INTEGER,
  reddit_sourced INTEGER,
  thumbs_up INTEGER DEFAULT 0,
  thumbs_down INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user analytics + itinerary build counter
CREATE TABLE IF NOT EXISTS analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  area TEXT,
  language TEXT,
  plan INTEGER,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event image columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_source TEXT;

-- Supabase Storage: create bucket "event-images", set PUBLIC.
```

Expected `events` table fields:

```sql
id uuid primary key default gen_random_uuid(),
name text not null,
venue text not null,
area text not null,
lat float,
lng float,
date date not null default current_date,
start_time text not null,
entry_fee text default 'Check at venue',
vibe text,
status text default 'tonight',
source text,
description text,
insider_tip text,
publish_on date default current_date,
created_at timestamptz default now()
```

RLS should allow public select and service-role writes.

## Settings And Trial Keys

- `/api/settings`: public pricing endpoint. Returns defaults if Supabase/settings are unavailable.
- `/api/admin/settings`: admin read/write for pricing and trial keys, requires `x-admin-auth`.
- `/api/validate-trial`: validates trial keys from `TRIAL_KEYS` first, then from the Supabase `settings` row with key `trial_keys`.

The optional `settings` table is:

```sql
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
```

Trial keys in Supabase track `code`, `label`, `duration_hours`, `max_uses`, and `used_count`. Env-based trial keys are treated as high-use keys and are not saved back to the DB.

## AI Features

- `/api/itinerary`: English-only, area-clarifying, transport-aware, daily-build-limited (15/email/day + ₹30 extension for 15 more) itinerary generator. Pulls live Google Places (New) + Reddit crowd intel, then `claude-sonnet-4-20250514` builds the day-by-day plan in the format `📍 [Time] — [Place] / 🗺️ Directions / 🛵 ~X mins by scooter`. Returns `placePhotos` (map of place name → first 2 photo URLs) for inline rendering.
- `/api/admin/extract-flyer`: uses `claude-sonnet-4-20250514` vision to extract event fields from an uploaded flyer image.
- `/api/admin/scrape-district`: fetches or accepts pasted District.in content and uses `claude-haiku-4-5-20251001` to extract Goa events.
- `/api/places`: server-side Google Places (New) v1 proxy with category-aware search, photo proxy data, quality filter (rating ≥ 4.0, reviews ≥ 30), avg-price extraction via Haiku, 15-minute in-memory cache, graceful fallback to `lib/spotsData.js`. The new API returns full details inside search results, so there is no separate `placeDetails` round-trip.
- `/api/hotels`: same Places (New) v1 client, keyed off `area` + `stayType` (5 stay-type → keyword mappings in `app/api/hotels/route.js`). Lower review threshold (≥ 20) since hotels accumulate fewer reviews. Sorted by rating DESC.
- `/api/photo`: server-side proxy for Place photos. The new API returns a `photoUri` JSON response (with `skipHttpRedirect=true`); we fetch and stream the image bytes so the API key never reaches the browser.
- `/api/places/debug`: diagnostic endpoint — calls Text Search + Geocoding directly, returns HTTP/Google status and a human-readable diagnosis. Use this first when live data shows the fallback banner.
- `/api/crowd-intel`: Reddit search → Haiku analysis → Supabase 24h cache. Returns best time, peak crowd, avg price, complaints, insider tips.

All AI routes require `ANTHROPIC_API_KEY`. Admin AI routes also require the admin auth header.

## Live Data Pipeline

The dashboard's "Nearby" tab and the itinerary builder both depend on this data flow:

```
User location/area
   ↓
/api/places (Google Places + quality filter + Haiku price extraction + haversine sort)
   ↓
/api/crowd-intel (Reddit r/goaindia + r/india + Haiku analysis)
   ↓
Enriched place objects with: rating, openNow, photos, avgPricePerPerson,
bestTimeToVisit, peakCrowdTime, insiderTips
   ↓
Either rendered as SpotCards, or fed into Sonnet for itinerary generation
```

If Google Places fails, `/api/places` retries once then falls back to `lib/spotsData.js` and sets `X-Data-Source: fallback`. The itinerary builder receives the same fallback signal and labels its output accordingly.

## Saved & Shared Plans

- `/api/save-itinerary`: stores itinerary text + metadata to Supabase, returns 8-char `share_id`.
- `/api/rate-itinerary`: thumbs up/down feedback per `share_id`.
- `/app/plan/[shareId]/page.js`: public view of a shared plan with OG meta for social previews. No auth required — these pages are organic marketing.

Frontend stores `share_id`s in `localStorage.goanow_saved_plans`.

## Itinerary Build Limit

Each verified email can build **15 itineraries per calendar day** (defined as `DAILY_BUILD_LIMIT` in `app/api/itinerary/route.js`). Counts come from the `analytics` table where `event_type = 'itinerary_built'` and `data->>'email'` matches the user's email — see `getDailyBuildCount` in `lib/userPass.js`. Once the daily limit is hit, the user can buy a **₹30 extension** for 15 additional builds via `/api/user/buy-extension` → Razorpay → `/api/user/verify-extension`. The frontend gets `buildsRemaining` on every response and surfaces a buy-extension modal when it hits 0.

## Authentication (Google via Supabase Auth)

- Google sign-in is implemented through Supabase Auth's OAuth flow (no NextAuth, no extra deps).
- `lib/supabaseBrowser.js` exposes a singleton browser client with session persistence (`localStorage` key `goanow.sb.auth`).
- `components/GoogleSignIn.js` provides both a full button (used in PaywallModal) and a compact pill (used in Navbar).
- Sign-in does **not** gate dashboard access; that remains controlled by the `goanow_plan` / `goanow_expiry` localStorage keys plus paid/trial flow. Auth is used purely to capture a verified email for receipts, itinerary delivery, and party blasts.
- When a user signs in we mirror their email into `localStorage.goanow_email` so other components (ItineraryBuilder, etc.) can pre-fill it.

Required setup steps for Google sign-in:
1. **Google Cloud Console** → APIs & Services → Credentials → **Create OAuth Client ID** (Web app)
   - Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Copy the Client ID + Secret.
2. **Supabase** → Authentication → Providers → **Google** → enable, paste Client ID + Secret.
3. **Supabase** → Authentication → URL Configuration → set **Site URL** to your production URL and add it to the Redirect URLs allowlist (plus `http://localhost:3000` for dev).

## Email (Resend)

Four email flows:
- **Welcome / payment confirmation** — sent on Razorpay verify or trial-key activation. Email collected in PaywallModal email field, persisted to `localStorage.goanow_email`.
- **Itinerary delivery** — "📧 Email Me This Plan" button under any generated itinerary. Falls back to a `prompt()` if no email stored. Saves recipient as a subscriber.
- **Tonight's Party Blast** — admin-triggered or cron-triggered (`/api/email/party-blast`). Pulls today's `events` and emails to all `email_subscribers` where `opted_out = false`. Authorized via either `x-admin-auth: ADMIN_PASSWORD` or `x-cron-secret: CRON_SECRET`.
- **Unsubscribe** — every blast includes an unsubscribe link to `/api/email/unsubscribe?email=...`, sets `opted_out = true`.

Add this Supabase table (RLS optional; reads are server-only):

```sql
CREATE TABLE IF NOT EXISTS email_subscribers (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT        UNIQUE NOT NULL,
  plan_name   TEXT,
  expiry_at   TIMESTAMPTZ,
  source      TEXT,
  opted_out   BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service full access" ON email_subscribers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

To run the party blast on a schedule, set `CRON_SECRET` and call:
```
POST https://goanow.online/api/email/party-blast
  Header: x-cron-secret: <CRON_SECRET>
```
Daily at 6 PM IST is a sensible cadence — Railway cron, GitHub Actions, or cron-job.org all work.

## Analytics

`/api/analytics` accepts `{ event_type, area, language, plan, data }` from the frontend. Events tracked: `itinerary_built`, `plan_saved`, `plan_shared`, `thumbs_up`, `thumbs_down`, `tab_viewed`, `paywall_opened`, `payment_success`. The admin panel's Analytics tab queries this table for stat cards (no charts).

## Admin Panel

`app/admin/page.js` is a large client component. It supports:

- Password login via `/api/admin/login`.
- Event create/edit/delete.
- Viewing today's events or the last 7 days.
- Flyer image upload and AI field extraction.
- District.in auto-fetch or pasted HTML extraction, then bulk import.
- Settings tab for pricing and trial keys.

Admin auth is intentionally simple: the password is compared to `ADMIN_PASSWORD`, then stored in session storage and sent as `x-admin-auth`.

## Key Components

- `components/Navbar.js`: dashboard navigation/header.
- `components/PaywallModal.js`: pricing, Razorpay flow, trial key entry.
- `components/ItineraryBuilder.js`: AI itinerary UI; includes the `ItineraryWithPhotos` renderer that walks the plan text line-by-line and injects 2-photo strips below 📍 lines whose place name matches `placePhotos`.
- `components/SpotCard.js`: nearby spot cards.
- `components/HotelCard.js`: hotel/stay cards with photo carousel (tap-to-cycle, dot indicators), per-night price estimate, and Directions + Website/Call buttons. Hostel/Zostel cards also surface a booking-direct tip.
- `components/EventCard.js`: event display cards.
- `components/CategoryFilter.js`: category pills for nearby spots.
- `components/ShareButton.js`: floating share affordance.
- `components/LoadingSkeleton.js`: loading states.
- `components/Icon.js`: local icon abstraction.

## Known Gotchas

- Some README/source text appears mojibaked in this checkout for rupee symbols, arrows, and emoji. Be careful when editing strings that already contain garbled characters.
- `npm run start` uses `next start -p ${PORT:-3000}`, which is Unix-style env expansion and may not behave in Windows PowerShell.
- `npm run lint` calls `next lint`; newer Next.js versions have changed lint behavior, but this project is pinned to Next 14.
- Access control for the paid dashboard is only client-side local storage. Do not treat it as strong entitlement enforcement.
- `/api/events` intentionally falls back to mock events for public users when Supabase is missing, failing, or empty.
- PowerShell needs `-LiteralPath` for paths containing `[id]`, such as `app/api/admin/events/[id]/route.js`.

## Working Style For Future Changes

- Prefer existing inline styling and CSS variable patterns unless doing a larger UI cleanup.
- Keep server-only secrets inside API routes. Do not expose service-role keys or Anthropic/Razorpay secrets to client components.
- When changing event fields, update admin forms, sanitizers, Supabase schema notes, cards, and bulk upload normalization together.
- When changing pricing plans, check `PaywallModal`, `/api/settings`, admin settings, and landing-page plan rendering.
- When touching admin auth, remember the current frontend stores the raw admin password in session storage to send as the auth header.
