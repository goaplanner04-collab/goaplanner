import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { spots as fallbackSpots } from "@/lib/spotsData";
import {
  calcDistanceKm,
  extractPriceFromReviews,
  fetchCrowdIntel,
} from "@/lib/placeUtils";
import {
  fsqSearch, fsqPhotos, fsqTips,
  fsqPriceToRange, fsqRatingTo5, fsqPassesQuality,
  fsqOpenNow, fsqArea, fsqCoords, fsqGoogleMapsUrl,
  resolveGoaCoords, GOA_CENTER,
} from "@/lib/foursquare";
import {
  getDailyBuildCount,
  getBonusBuilds,
  consumeBonusBuild,
  normalizeEmail,
} from "@/lib/userPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-20250514";
export const DAILY_BUILD_LIMIT = 15;

const VAGUE_AREAS = new Set([
  "north goa", "south goa", "near beach", "near beaches",
  "goa", "central goa", "the beach", "beach", "anywhere",
]);

const AREA_SUGGESTIONS = [
  "Morjim", "Arambol", "Mandrem", "Ashvem",
  "Vagator", "Anjuna", "Calangute", "Baga",
  "Candolim", "Panjim", "Assagao",
  "Palolem", "Cavelossim", "Colva", "Benaulim",
];

function tryParseJsonObject(raw) {
  if (!raw) return null;
  let txt = String(raw).trim();
  txt = txt.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(txt.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function parseUserInput(client, message) {
  try {
    const res = await client.messages.create({
      model: HAIKU,
      max_tokens: 250,
      system: `Extract Goa travel details from a user message. Return ONLY JSON, no markdown:
{ "area": string|null, "budget": number|null, "duration_days": number|null,
  "group_type": "solo"|"couple"|"group"|"family"|"unknown",
  "interests": string[], "isVague": boolean }

isVague = true if area is just "north goa", "south goa", "goa", or no specific town/village.
area should be a specific Goa town/village name when possible (e.g. "Vagator", "Palolem").
budget in INR per person for the whole trip if stated, else null.
interests: short tags like ["beaches","parties","seafood","romantic","adventure","budget","casinos","first time"].`,
      messages: [{ role: "user", content: message }],
    });
    const text = (res.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return tryParseJsonObject(text);
  } catch {
    return null;
  }
}

async function fetchCategoryEnriched(fsqKey, anthropicKey, { lat, lng, query, categories, radius, limit }) {
  const results = await fsqSearch(fsqKey, { lat, lng, radius, query, categories, sort: "DISTANCE", limit: Math.max(limit, 10) });
  if (results === null) return null;

  const top = results.slice(0, limit);

  const enriched = await Promise.all(top.map(async (p) => {
    const rawRating = Number(p.rating) || 0;
    const reviewCount = Number(p.stats?.total_ratings) || 0;
    if (!fsqPassesQuality(rawRating, reviewCount)) return null;
    if (fsqOpenNow(p) === false) return null;

    const placeId = p.fsq_place_id || p.fsq_id;
    if (!placeId) return null;
    const { lat: pLat, lng: pLng } = fsqCoords(p);
    if (pLat == null || pLng == null) return null;

    const [photos, tips] = await Promise.all([
      fsqPhotos(fsqKey, placeId, 3),
      fsqTips(fsqKey, placeId, 5),
    ]);
    const { avgPricePerPerson } = await extractPriceFromReviews(tips, anthropicKey);

    return {
      placeId,
      name: p.name || "",
      rating: fsqRatingTo5(rawRating),
      reviews: reviewCount,
      lat: pLat, lng: pLng,
      address: p.location?.formatted_address || "",
      priceLevel: fsqPriceToRange(p.price),
      avgPricePerPerson,
      openNow: fsqOpenNow(p),
      googleUrl: fsqGoogleMapsUrl(p),
      description: p.description || "",
      reviewHighlights: tips.slice(0, 2),
      distanceKm: calcDistanceKm(lat, lng, pLat, pLng),
      photos,
    };
  }));

  return enriched.filter(Boolean).sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

function fallbackPlaces(category, lat, lng) {
  const matchCat = (s) => (category === "all" ? true : s.category === category);
  return fallbackSpots
    .filter(matchCat)
    .map((s) => ({
      placeId: `fallback-${s.id}`,
      name: s.name,
      rating: s.rating,
      reviews: s.reviews,
      lat: s.lat, lng: s.lng,
      address: `${s.area}, Goa`,
      priceLevel: "₹₹",
      avgPricePerPerson: null,
      openNow: null,
      googleUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " " + s.area + " Goa")}`,
      description: s.description || "",
      reviewHighlights: [],
      distanceKm: calcDistanceKm(lat, lng, s.lat, s.lng),
      photos: [],
    }))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, 5);
}

async function buildEnrichedContext({ fsqKey, anthropicKey, supabase, area, lat, lng, interests }) {
  const categories = [
    { key: "restaurants", query: "restaurant",       categories: "13065", radius: 8000, limit: 5, fb: "restobar" },
    { key: "attractions", query: "tourist attraction", categories: "16000", radius: 8000, limit: 5, fb: "hidden_gem" },
  ];

  const interestSet = new Set((interests || []).map((s) => String(s).toLowerCase()));
  const wants = (...keys) => keys.some((k) => interestSet.has(k));

  if (wants("party", "parties", "nightlife", "club")) {
    categories.push({ key: "nightlife", query: "nightclub bar", categories: "13003,13003", radius: 15000, limit: 5, fb: "restobar" });
  }
  if (wants("beach", "beaches")) {
    categories.push({ key: "beaches", query: "beach", categories: "16003", radius: 15000, limit: 5, fb: "beach" });
  }
  if (wants("adventure", "water sports", "watersports")) {
    categories.push({ key: "waterSports", query: "water sports adventure", radius: 15000, limit: 5, fb: "hidden_gem" });
  }
  if (wants("seafood")) {
    categories.push({ key: "seafood", query: "seafood restaurant", categories: "13145", radius: 15000, limit: 5, fb: "seafood" });
  }
  if (wants("casino", "casinos")) {
    categories.push({ key: "casinos", query: "casino", radius: 25000, limit: 5, fb: "restobar" });
  }

  let dataSource = "live";
  const fetched = {};

  if (!fsqKey) {
    dataSource = "fallback";
    for (const cat of categories) {
      fetched[cat.key] = fallbackPlaces(cat.fb, lat, lng);
    }
  } else {
    const results = await Promise.all(categories.map(async (cat) => {
      let res = await fetchCategoryEnriched(fsqKey, anthropicKey, { lat, lng, query: cat.query, categories: cat.categories, radius: cat.radius, limit: cat.limit });
      if (res === null) {
        await new Promise((r) => setTimeout(r, 1500));
        res = await fetchCategoryEnriched(fsqKey, anthropicKey, { lat, lng, query: cat.query, categories: cat.categories, radius: cat.radius, limit: cat.limit });
      }
      return { key: cat.key, data: res, fb: cat.fb };
    }));
    for (const r of results) {
      if (r.data === null) {
        fetched[r.key] = fallbackPlaces(r.fb, lat, lng);
        if (dataSource === "live") dataSource = "partial";
      } else {
        fetched[r.key] = r.data;
      }
    }
    if (results.every((r) => r.data === null)) dataSource = "fallback";
  }

  // Crowd intel for top restaurants + attractions
  let redditSourced = 0;
  const intelTargets = [
    ...(fetched.restaurants || []).slice(0, 3),
    ...(fetched.attractions || []).slice(0, 2),
  ];
  const intelResults = await Promise.all(intelTargets.map(async (place) => {
    try {
      const intel = await fetchCrowdIntel({
        placeId: place.placeId,
        placeName: place.name,
        area,
        supabase,
        anthropicKey,
      });
      return { placeId: place.placeId, intel };
    } catch {
      return { placeId: place.placeId, intel: null };
    }
  }));

  const intelByPlace = new Map();
  for (const r of intelResults) {
    if (r.intel && r.intel.dataQuality !== "none") {
      intelByPlace.set(r.placeId, r.intel);
      redditSourced++;
    }
  }

  for (const key of Object.keys(fetched)) {
    fetched[key] = fetched[key].map((p) => {
      const intel = intelByPlace.get(p.placeId);
      if (!intel) return p;
      return {
        ...p,
        bestTimeToVisit: intel.bestTimeToVisit,
        peakCrowdTime: intel.peakCrowdTime,
        insiderTips: intel.insiderTips,
        avgPricePerPerson: (intel.dataQuality === "high" || intel.dataQuality === "medium") && intel.avgPricePerPerson
          ? intel.avgPricePerPerson
          : p.avgPricePerPerson,
      };
    });
  }

  const placesChecked = Object.values(fetched).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  return { fetched, dataSource, placesChecked, redditSourced };
}

function buildSystemPrompt(enrichedContext) {
  return `You are GoaNow AI — the world's best hyper-local Goa travel planner. You build personalized day-by-day itineraries using live, verified data.

LANGUAGE: Always respond in English. Do not translate place names.

ABSOLUTE RULES (non-negotiable):
1. ONLY recommend places from LIVE PLACES DATA below. Never invent a place name, address, or rating.
2. **OPENING HOURS**: Only include a place if openNow === true OR openNow === null. If openNow === false, SKIP it entirely.
3. **MATCH TIME OF DAY**: Match the place's typical hours to the time you slot it. Never put a brunch cafe at 11 PM or a nightclub at noon. If a place's category strongly contradicts the suggested time, drop it.
4. **DISTANCES**: Use the EXACT distanceKm value from the data. Never round more than 0.1 km. Never guess.
5. **NEAREST FIRST**: Within each day, sort stops by distanceKm ascending — minimise back-and-forth travel.
6. **CROSS-VERIFY**: If two sources disagree (e.g. tip says "always packed", rating says 4.8), trust the higher-confidence source and surface the tip as a caveat.
7. **PRICE MATH**: When avgPricePerPerson exists, use that exact value × group size × meals for the food budget. Never make up prices.
8. **CROWD INTEL**: When bestTimeToVisit / peakCrowdTime / insiderTips exist (from Reddit + community), weave them in naturally. Phrase as "Locals say…" or "Pro tip:" — NEVER mention Reddit by name.
9. **QUALITY**: Only recommend places with rating >= 4.0. Skip anything lower even if it's the only match.
10. **PERSONALIZATION**: Read the user's stated vibe, group, budget, days, interests carefully. Tailor every choice. Never give a generic itinerary that could fit anyone.
11. **HONESTY**: If the requested experience can't be fulfilled near their area (e.g. casino lover staying in Palolem = 2hr drive), say so plainly and offer a realistic alternative.
12. **NO PLACEHOLDERS**: Never write "[restaurant name]" or "TBD". If you don't have a specific place, drop that slot.

LIVE PLACES DATA (fetched right now):
${JSON.stringify(enrichedContext, null, 2)}

ACTIVITIES NOT IN PLACES DATA — use for water sports, hidden gems, markets, casinos:

WATER SPORTS (Baga, Calangute, Anjuna, Colva beaches):
- Standard speedboat: ₹700–1000/person
- Premium speedboat (open sea swim): ₹1500/person, ₹3000 for 2.
  INSIDER: not advertised — ask boat guys for 'open sea package'
- Parasailing: ₹1500/person (informal rate, always negotiate)
- Jet ski 15 min: ₹500–700
- Scuba Grande Island: ₹3500–5000/person
- Always negotiate — quoted price ~30% above final. Best 9AM–4PM.

FLOATING CASINOS (Panjim jetty, Mandovi River):
- Deltin Royale: ₹3000 (₹1500 credits + unlimited food + drinks)
- Deltin JAQK: ₹2000 (₹1000 credits + snacks)
- Casino Pride: ₹1500
- Open 8PM–5AM. Smart casual. No shorts at Deltin Royale.
- SOUTH GOA WARNING: If user area is Palolem/Cavelossim/Colva, casinos are 1.5–2hrs away. Be honest.

SCOOTER RENTALS:
- North Goa: ₹300–400/day | Mid Goa: ₹350–450 | South: ₹400–500
- Weekly ₹1800–2500. Always inspect bike thoroughly first.
- Strongly recommend over autos for full-day exploration.

HIDDEN GEMS (rarely on Foursquare — mention when relevant):
- Sweet Water Lake, Arambol: Free, 10 min walk behind beach
- Chapora Fort: Free, best at sunset, Dil Chahta Hai location
- Butterfly Beach, Palolem: ₹400–600 boat each way
- Dudhsagar Falls: ₹800–1200/person jeep safari (~4hrs from North Goa)

NIGHT MARKETS:
- Anjuna Flea Market (every Wednesday): Free entry
- Ingó's Saturday Night Bazaar, Arpora (Saturday): Free, food ₹300–600
- Mackie's Saturday Night Bazaar, Baga: Free

PARTY INSIDER — NON-NEGOTIABLE:
- ANY party with flyer time between 9PM–11PM: real crowd midnight.
  ALWAYS tell user: do not arrive before 12AM.
- Hilltop Vagator Tuesdays: legendary psy trance
- Curlies Anjuna: free entry, real energy after 11PM
- SinQ Candolim: entry includes drink credits, dress smart

FOOD FALLBACK (use ONLY if no avgPricePerPerson in data):
- Local thali/shack: ₹100–200 | Mid café: ₹300–600
- Premium restobar: ₹800–1500 | Seafood: ₹400–800
- Beach shack drinks: ₹150–300 each

TRANSPORT:
- Auto per km: ₹15–20. No meters in Goa. Always negotiate upfront.
- Scooter far better than autos for full-day trips.
- Uber available in North Goa only.

PERSONALIZATION:
- adventure → open with water sports, end with Dudhsagar if time
- romantic → nearest fine dining + sunset spot + casino evening
- budget → local thalis + free beaches + forts + scooter not auto
- party → nightlife venues + ALWAYS add midnight crowd arrival tip
- first time → 1 iconic + 1 hidden gem + clear how-to-get-there
- group → note group pricing, scooter fleet vs shared auto
- solo → mention safety, solo-friendly venues

FORMAT — day by day:

Day X: [Evocative day title]

📍 [Time] — [Place Name] ([exact X.X km from user area])
[One enthusiastic paragraph. If bestTimeToVisit known: weave in.
If insiderTip from community: 'locals say...' or 'pro tip:'
Travel to next: 🛵 ~[X] mins by scooter | 🚗 ~[X] mins by auto]

END EVERY ITINERARY WITH EXACTLY:

💰 ESTIMATED BUDGET BREAKDOWN
🍽️ Food & Drinks: ₹[calculated from avgPricePerPerson × group size × meals, or fallback estimates]
🎯 Activities: ₹[amount]
🚗 Transport: ₹[amount]
🏨 Stay (only if user mentioned it): ₹[amount]
──────────────────────────────────────
✅ Estimated Total: ₹[amount]

Then ONE of:
💚 Under budget by ₹[X] — [specific suggestion for the extra]
💡 Over by ₹[X] — skip [X] or swap for [cheaper specific alternative]
(Omit budget comparison if budget was not provided)

Then:
🌿 Hidden Gem: [one from hidden gems list, relevant to area]

⚠️ Note: Open/closed status checked at time of building. Verify before visiting as hours can change.`;
}

async function logBuilt(supabase, { email, sessionId, area, interests, durationDays, dataSource, redditSourced }) {
  if (!supabase) return;
  try {
    await supabase.from("analytics").insert({
      event_type: "itinerary_built",
      area: area || null,
      language: "en",
      data: {
        email: email || null,
        session_id: sessionId || null,
        interests: interests || [],
        duration_days: durationDays || null,
        data_source: dataSource,
        reddit_sourced: redditSourced,
      },
    });
  } catch {
    // ignore
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = (body.message || "").toString().trim();
    const sessionId = (body.sessionId || "").toString().trim();
    const email = normalizeEmail(body.email || "");

    if (message.length < 8) {
      return NextResponse.json({ error: "Tell us a bit more about your trip." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI not configured on server" }, { status: 500 });
    }

    const fsqKey = process.env.FOURSQUARE_API_KEY;
    const supabase = getSupabaseAdmin();
    const client = new Anthropic({ apiKey });

    // STEP 0 — Daily build limit (per email, resets at midnight)
    const builtToday = email ? await getDailyBuildCount(supabase, email) : 0;
    const bonusBuilds = email ? await getBonusBuilds(supabase, email) : 0;
    const totalAllowedToday = DAILY_BUILD_LIMIT + bonusBuilds;

    if (email && builtToday >= totalAllowedToday) {
      return NextResponse.json({
        limitReached: true,
        message: `You've used all ${totalAllowedToday} plan generations today. Buy 15 more for ₹30, or come back tomorrow.`,
        buildsRemaining: 0,
        canBuyExtension: true,
      });
    }

    // STEP 2 — Parse user input
    const parsed = await parseUserInput(client, message);
    const area = parsed?.area?.trim() || null;
    const budget = Number.isFinite(Number(parsed?.budget)) ? Number(parsed.budget) : null;
    const durationDays = Number.isFinite(Number(parsed?.duration_days)) ? Number(parsed.duration_days) : null;
    const groupType = parsed?.group_type || "unknown";
    const interests = Array.isArray(parsed?.interests) ? parsed.interests : [];
    const isVague = parsed?.isVague === true || !area || VAGUE_AREAS.has((area || "").toLowerCase());

    if (isVague) {
      return NextResponse.json({
        needsClarification: true,
        message: "North Goa is huge — that's 50km of coastline! Tell us your exact area for accurate distances and recommendations.",
        areaSuggestions: AREA_SUGGESTIONS,
        buildsRemaining: Math.max(0, totalAllowedToday - builtToday),
      });
    }

    const budgetMissing = budget === null;

    // STEP 3 — Resolve coords (hard-coded Goa areas + Nominatim fallback)
    let coords = await resolveGoaCoords(area);
    let geocodeFallback = false;
    if (!coords) {
      coords = { lat: GOA_CENTER.lat, lng: GOA_CENTER.lng };
      geocodeFallback = true;
    }

    // STEP 4-5 — Live places + crowd intel
    const { fetched, dataSource, placesChecked, redditSourced } =
      await buildEnrichedContext({
        fsqKey, anthropicKey: apiKey, supabase,
        area, lat: coords.lat, lng: coords.lng, interests,
      });

    const modelContext = {
      userArea: area,
      userLat: coords.lat,
      userLng: coords.lng,
      dataSource,
      ...fetched,
    };

    const systemPrompt = buildSystemPrompt(modelContext);
    const userMsg = `Original: ${message}

Parsed: Area: ${area} (${coords.lat}, ${coords.lng}) | Budget: ₹${budget ?? "not specified"} | Duration: ${durationDays ?? "?"} days | Group: ${groupType} | Interests: ${interests.join(", ") || "general"}
${budgetMissing ? "| Budget not specified — used ₹3000/person/day estimate" : ""}
${geocodeFallback ? "| Note: Area geocoding fell back to Goa center" : ""}

Build using ONLY live places above. Exact distances. Open places only.`;

    const completion = await client.messages.create({
      model: SONNET,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });

    const text = (completion.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "AI returned an empty response. Try again." }, { status: 502 });
    }

    await logBuilt(supabase, {
      email, sessionId, area,
      interests, durationDays, dataSource, redditSourced,
    });

    // If this build went past the free daily limit, consume one bonus credit
    if (email && builtToday + 1 > DAILY_BUILD_LIMIT) {
      await consumeBonusBuild(supabase, email);
    }

    const newBuildsRemaining = Math.max(0, totalAllowedToday - (builtToday + 1));

    return NextResponse.json({
      itinerary: text,
      dataSource,
      placesChecked,
      redditSourced,
      userArea: area,
      userCoords: coords,
      language: "en",
      budgetMissing,
      buildsRemaining: newBuildsRemaining,
      dailyLimit: DAILY_BUILD_LIMIT,
      bonusBuilds,
    });
  } catch (err) {
    console.error("itinerary error", err);
    return NextResponse.json({ error: err?.message || "AI request failed" }, { status: 500 });
  }
}
