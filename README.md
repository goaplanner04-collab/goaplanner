# GoaNow 🔥

Real-time Goa discovery platform — built with Next.js 14, Supabase, Razorpay
and Anthropic's Claude.

A tourist lands in Goa, opens GoaNow, and in under 60 seconds knows the
closest cafés, what's happening tonight, and gets a personalised AI itinerary.

---

## ✨ Features

- **Nearby Cafés & Restobars** — sorted by GPS distance using the Haversine
  formula
- **Live Party Intel** — events feed with crowd-arrival timing tips
- **AI Itinerary Builder** — server-side Claude (Sonnet 4) personalisation
  with real Goa pricing baked into the system prompt
- **Razorpay paywall** — one-time unlock (₹49 / ₹99 / ₹149)
- **Admin panel** — password protected, includes AI flyer extraction and
  bulk upload

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + custom CSS variables, no UI libraries
- **Payments:** Razorpay (frontend SDK + signature-verified backend)
- **Database:** Supabase (Postgres) with RLS
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Fonts:** Bebas Neue + Inter

---

## 📦 Local Setup

```bash
# 1. install
npm install

# 2. create env
cp .env.example .env.local
# then fill in keys (see "Environment variables" below)

# 3. dev server
npm run dev
# → http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

---

## 🔐 Environment variables

Create a `.env.local` file at the project root:

```env
# Razorpay (https://dashboard.razorpay.com)
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_HERE
RAZORPAY_KEY_SECRET=your_secret_here
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_HERE

# Supabase (https://supabase.com)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Anthropic (https://console.anthropic.com)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Admin panel
ADMIN_PASSWORD=choose_a_strong_password_here
```

> **Never** commit `.env.local`. Only the `NEXT_PUBLIC_*` keys are exposed
> to the browser; everything else stays server-side.

---

## 💳 Getting Razorpay test keys

1. Sign up at <https://dashboard.razorpay.com>
2. **Settings → API Keys → Generate Test Keys**
3. Copy the `Key ID` (starts with `rzp_test_…`) into both
   `RAZORPAY_KEY_ID` *and* `NEXT_PUBLIC_RAZORPAY_KEY_ID`
4. Copy the `Key Secret` into `RAZORPAY_KEY_SECRET`
5. In test mode use the card `4111 1111 1111 1111`, any future date,
   any CVV, and OTP `1234`. UPI: `success@razorpay`.

When you go live, repeat the steps under *Live mode* to get
`rzp_live_…` keys.

---

## 🗄️ Supabase setup

1. Create a project at <https://supabase.com>
2. Open **SQL Editor** and paste:

```sql
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

CREATE POLICY "Public read"  ON events FOR SELECT USING (true);
CREATE POLICY "Service write" ON events FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX events_date_idx       ON events (date);
CREATE INDEX events_publish_on_idx ON events (publish_on);
```

3. **Project Settings → API** — copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (never expose this)

> If Supabase is not configured, the public events feed automatically
> falls back to the curated mock list.

---

## 🚂 Deploying to Railway

1. Push the project to GitHub.
2. <https://railway.app> → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects Next.js. In the service's **Variables** tab,
   add every key from your `.env.local`.
4. Set **Build command:** `npm run build`
   **Start command:** `npm run start`
   Railway provides `$PORT` automatically — `package.json` already
   reads it.
5. Generate a domain from **Settings → Networking → Generate domain**,
   or add your custom domain.
6. **Update Razorpay** → add your Railway domain to *Allowed Origins*
   in the Razorpay dashboard so checkout loads correctly in production.

> Tip: keep two Razorpay key sets — one for the test/staging Railway
> service, one for production.

---

## 👤 Admin panel guide

URL: `/admin`

1. Log in with `ADMIN_PASSWORD`.
2. **Add Tonight's Party** form on the left:
   - Required: Event Name, Venue, Area, Date, Start Time
   - `Publish On` — set a future date to schedule (the public feed
     filters `publish_on <= today`)
   - Leave `Entry Fee` blank to display *Entry TBC*
3. **Got a flyer?** — drop an Instagram-story screenshot, click
   *Extract with AI*. Claude vision parses the flyer and fills the
   form; ✨AI badges mark every auto-filled field. Edit anything before
   submitting.
4. Right panel lists today's events; toggle **Show last 7 days** to
   see history. Edit / delete inline.
5. Bulk upload is available via `POST /api/admin/bulk-upload` (JSON
   array of events, header `x-admin-auth: <ADMIN_PASSWORD>`).

---

## 🌐 API reference

| Route                                | Method | Purpose                                   |
|--------------------------------------|--------|-------------------------------------------|
| `/api/create-order`                  | POST   | Create Razorpay order                     |
| `/api/verify-payment`                | POST   | Verify Razorpay HMAC signature            |
| `/api/itinerary`                     | POST   | Anthropic itinerary generation            |
| `/api/events`                        | GET    | Public events feed (Supabase + fallback)  |
| `/api/admin/login`                   | POST   | Admin password check                      |
| `/api/admin/events`                  | POST   | Create event                              |
| `/api/admin/events/[id]`             | PUT    | Update event                              |
| `/api/admin/events/[id]`             | DELETE | Delete event                              |
| `/api/admin/extract-flyer`           | POST   | Vision-based flyer parsing                |
| `/api/admin/bulk-upload`             | POST   | Bulk upsert events                        |

All admin routes require the header `x-admin-auth: <ADMIN_PASSWORD>`.

---

## 📁 Project structure

```
app/
  layout.js            # html shell + fonts
  globals.css          # CSS variables + utility classes
  page.js              # landing
  expired/page.js      # pass-expired page
  dashboard/page.js    # 3-tab dashboard (protected)
  admin/page.js        # admin panel (password)
  api/
    create-order/
    verify-payment/
    itinerary/
    events/
    admin/login/
    admin/events/
    admin/events/[id]/
    admin/extract-flyer/
    admin/bulk-upload/

components/
  Navbar.js
  PaywallModal.js
  SpotCard.js
  EventCard.js
  ItineraryBuilder.js
  CategoryFilter.js
  LoadingSkeleton.js
  ShareButton.js

lib/
  haversine.js
  spotsData.js
  supabase.js
```

---

## 🪄 Notes

- The spots dataset (`lib/spotsData.js`) is intentionally hard-coded —
  it ships ready to demo without any database hits.
- The events API is deliberately resilient: if Supabase is offline or
  empty, public users still see a curated fallback list.
- Pass enforcement happens client-side via `localStorage` (`goanow_plan`,
  `goanow_expiry`). Expired passes redirect to `/expired`, never
  silently to home.
- Every external request (Razorpay, Supabase admin, Anthropic) is
  performed server-side; the only public env keys are the Razorpay
  publishable key, the Supabase project URL, and the anon key.

Made with 🔥 in Goa.
