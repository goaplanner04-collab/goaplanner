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
  placesSearch, placeDetails,
  priceLevelToRange, passesQualityFilter,
  getOpenNow, getCoords, getMapsUrl, inferArea,
  resolveGoaCoords, GOA_CENTER,
} from "@/lib/googlePlaces";
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
      max_tokens: 320,
      system: `Extract Goa travel details from a user message. Return ONLY JSON, no markdown:
{ "area": string|null, "budget": number|null, "duration_days": number|null,
  "group_type": "solo"|"couple"|"group"|"family"|"unknown",
  "interests": string[], "isVague": boolean,
  "transport": "scooter"|"car"|"bike"|"none"|"unknown" }

isVague = true if area is just "north goa", "south goa", "goa", or no specific town/village.
area should be a specific Goa town/village name when possible (e.g. "Vagator", "Palolem").
budget in INR per person for the whole trip if stated, else null.
interests: short tags like ["beaches","parties","seafood","romantic","adventure","budget","casinos","first time"].

transport: detect explicit mentions only:
- "scooter" / "moped" / "rented a scooter" → "scooter"
- "car" / "rented a car" / "self-drive" → "car"
- "bike" / "motorcycle" → "bike"
- "no vehicle" / "without a vehicle" / "rely on autos" / "by auto" / "on foot" → "none"
- otherwise → "unknown"`,
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

async function fetchCategoryEnriched(apiKey, anthropicKey, { lat, lng, type, keyword, radius, limit }) {
  // Use server-side opennow filter so closed venues never reach us
  const search = await placesSearch(apiKey, { lat, lng, radius, type, keyword, openNowOnly: true });
  if (search === null) return null;

  const top = search.slice(0, Math.max(limit + 3, 8));

  const enriched = await Promise.all(top.map(async (p) => {
    const d = await placeDetails(apiKey, p.place_id);
    if (!d) return null;

    const rating = Number(d.rating) || 0;
    const reviewCount = Number(d.user_ratings_total) || 0;
    if (!passesQualityFilter(rating, reviewCount)) return null;

    const openNow = getOpenNow(d);
    if (openNow === false) return null;

    const { lat: pLat, lng: pLng } = getCoords(d);
    if (pLat == null || pLng == null) return null;

    const photos = Array.isArray(d.photos)
      ? d.photos.slice(0, 3)
          .map((ph) => ph.photo_reference ? `/api/photo?ref=${encodeURIComponent(ph.photo_reference)}&w=800` : null)
          .filter(Boolean)
      : [];

    const reviewTexts = Array.isArray(d.reviews)
      ? d.reviews.slice(0, 5).map((r) => r.text).filter(Boolean)
      : [];

    const { avgPricePerPerson } = await extractPriceFromReviews(reviewTexts, anthropicKey);

    return {
      placeId: d.place_id || p.place_id,
      name: d.name || "",
      rating,
      reviews: reviewCount,
      lat: pLat, lng: pLng,
      address: d.formatted_address || "",
      priceLevel: priceLevelToRange(d.price_level),
      avgPricePerPerson,
      openNow,
      googleUrl: getMapsUrl(d),
      description: d.editorial_summary?.overview || "",
      reviewHighlights: reviewTexts.slice(0, 2),
      distanceKm: calcDistanceKm(lat, lng, pLat, pLng),
      photos,
      phone: d.formatted_phone_number || null,
      website: d.website || null,
    };
  }));

  return enriched
    .filter(Boolean)
    .slice(0, limit)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
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

async function buildEnrichedContext({ apiKey, anthropicKey, supabase, area, lat, lng, interests }) {
  const categories = [
    { key: "restaurants", type: "restaurant",         keyword: "restaurant cafe",       radius: 8000,  limit: 6, fb: "restobar" },
    { key: "attractions", type: "tourist_attraction", keyword: "tourist attraction",    radius: 8000,  limit: 6, fb: "hidden_gem" },
  ];

  const interestSet = new Set((interests || []).map((s) => String(s).toLowerCase()));
  const wants = (...keys) => keys.some((k) => interestSet.has(k));

  if (wants("party", "parties", "nightlife", "club")) {
    categories.push({ key: "nightlife",   type: "night_club",       keyword: "nightclub bar party",   radius: 15000, limit: 5, fb: "restobar" });
  }
  if (wants("beach", "beaches")) {
    categories.push({ key: "beaches",     type: "natural_feature",  keyword: "beach",                 radius: 15000, limit: 5, fb: "beach" });
  }
  if (wants("adventure", "water sports", "watersports")) {
    categories.push({ key: "waterSports", type: null,               keyword: "water sports adventure", radius: 15000, limit: 5, fb: "hidden_gem" });
  }
  if (wants("seafood")) {
    categories.push({ key: "seafood",     type: "restaurant",       keyword: "seafood fish",          radius: 15000, limit: 5, fb: "seafood" });
  }
  if (wants("casino", "casinos")) {
    categories.push({ key: "casinos",     type: null,               keyword: "casino",                radius: 25000, limit: 5, fb: "restobar" });
  }
  if (wants("romantic", "romance", "couple", "couples")) {
    categories.push({ key: "sunsetSpots", type: "tourist_attraction", keyword: "sunset viewpoint",    radius: 12000, limit: 4, fb: "hidden_gem" });
  }

  let dataSource = "live";
  const fetched = {};

  if (!apiKey) {
    dataSource = "fallback";
    for (const cat of categories) {
      fetched[cat.key] = fallbackPlaces(cat.fb, lat, lng);
    }
  } else {
    const results = await Promise.all(categories.map(async (cat) => {
      let res = await fetchCategoryEnriched(apiKey, anthropicKey, { lat, lng, type: cat.type, keyword: cat.keyword, radius: cat.radius, limit: cat.limit });
      if (res === null) {
        await new Promise((r) => setTimeout(r, 1500));
        res = await fetchCategoryEnriched(apiKey, anthropicKey, { lat, lng, type: cat.type, keyword: cat.keyword, radius: cat.radius, limit: cat.limit });
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
  return `You are GoaNow AI, a senior local travel concierge in Goa. You write polished, useful, day-by-day itineraries from live, verified data — no fluff, no clichés, no hype.

LANGUAGE
Always write in clear, professional English. Never translate place names.

WRITING STYLE — STRICT
- Plain text only. No markdown. No asterisks. No bold (**), no italics (*), no underscores. No headings with #.
- Tasteful, sparing emoji use. At most one short emoji per heading. Avoid emoji inside body paragraphs unless it adds genuine information (a calendar, a clock).
- Confident, conversational tone — like a friend who actually lives in Goa giving real advice. No travel-blogger gushing. No "embark on a journey", no "vibrant tapestry".
- Sentences should sound like you actually checked the data, not generated it.

DATA RULES — NON-NEGOTIABLE
1. Recommend ONLY places that appear in LIVE PLACES DATA. Never invent a place, an address, a rating, a price, or a phone number.
2. Skip any place where openNow is false. The data already filters most of these, but double-check before recommending.
3. Match each place to a sensible time of day. A breakfast cafe goes in the morning, a nightclub goes after 10 PM. If a place doesn't fit the slot, drop it.
4. Use the exact distanceKm value from the data. Round to one decimal. Never guess.
5. Inside each day, order stops nearest-first to minimise back-and-forth travel.
6. Only recommend places with rating >= 4.0. Skip everything below.
7. When avgPricePerPerson exists, use it for budget math (avgPricePerPerson × group size × meals).
8. When insiderTips exist, surface them as "Locals say…" or "Pro tip:". Never name the data source.
9. If the user's request can't be fulfilled near their area (e.g. casino seeker in Palolem = 2hr drive each way), say so honestly and offer a realistic alternative.
10. Never use placeholders like "[restaurant name]" or "TBD". If you have no specific place for a slot, drop the slot.
11. If the user is vague about budget, group size, or duration, use a reasonable default and note it in one short line.

USER TRANSPORT
The user's transport mode is in userTransport in the live data. Tailor every "Getting there" line to it:
- "scooter" → "Getting there: ~[X] min by scooter. Park near [landmark if relevant]." Mention parking when it's known to be hard (Anjuna market days, peak Baga, Old Goa church area).
- "car" → "Getting there: ~[X] min by car. [Note any parking constraint]." Suggest paid parking lots when narrow streets are an issue (Fontainhas, Old Goa, Panjim center).
- "bike" → same as scooter, add "easy bike parking" note when relevant.
- "none" → "Getting there: ~[X] min by auto, approx ₹[fare based on ₹15-20/km × distance]. Or ~[X] min by Uber if in North Goa." For stretches > 10 km, suggest renting a scooter for the day instead and explain why (cheaper, more flexible). For ferries (Chorao, Divar) note schedules. For airport pickups/long transfers note Uber works at the airport.

OUTPUT FORMAT
Write a clean structured plan. Use this exact shape, nothing else:

Day 1 — [a short, specific subtitle, e.g. "Morjim slow morning, Vagator sunset"]

Morning
[Place Name] · [X.X km away] · [rating]/5
A short, specific paragraph (2-3 sentences) about what to do here. If bestTimeToVisit or peakCrowdTime is known, mention it naturally. If insiderTips exist, weave one in as "Locals say:" or "Pro tip:". Mention price using avgPricePerPerson if available.
Getting there: [transport-specific guidance per the rules above]

Afternoon
[Place Name] · [X.X km away] · [rating]/5
[same shape]
Getting there: [transport-specific]

Evening
[Place Name] · [X.X km away] · [rating]/5
[same shape]
Getting there: [transport-specific]

Repeat for each day requested.

If userTransport is "none" and any single stop is more than 12 km from another, add a one-line "Transport tip:" suggesting they rent a scooter for the day with a price estimate.

After the last day, output exactly this block:

Estimated Budget
Food and drinks: ₹[amount]
Activities: ₹[amount]
Transport: ₹[amount]
Stay: ₹[amount, only if mentioned]
Total: ₹[amount]
[If user gave a budget, follow with one of:
"Under budget by ₹[X]. Use the extra on [specific suggestion]."
"Over budget by ₹[X]. Swap [Y] for [Z] to stay on track."]

Hidden gem
[One specific place from the list below that's near their area, with a single line explaining why and the rough cost.]

Verify before going
Opening hours change. Confirm by phone or Google Maps before you head out, especially for late-night spots.

REFERENCE DATA — for cases where the live data doesn't cover something:

Water sports (Baga, Calangute, Anjuna, Colva): standard speedboat ₹700-1000/person, premium "open sea" speedboat ₹1500/person (ask the boat operators directly — not advertised), parasailing ₹1500/person, jet ski ₹500-700 for 15 min, scuba at Grande Island ₹3500-5000. Negotiate; quoted is ~30% above final. Best 9 AM-4 PM.

Floating casinos (Panjim jetty, Mandovi River): Deltin Royale ₹3000 entry (₹1500 gaming credits + unlimited food and drinks). Deltin JAQK ₹2000. Casino Pride ₹1500. Open 8 PM-5 AM. Smart casual. If the user is in Palolem/Cavelossim/Colva, this is 1.5-2 hrs each way — be honest.

Scooter rentals: North Goa ₹300-400/day, Mid ₹350-450, South ₹400-500. Weekly ₹1800-2500. Inspect the bike. Strongly preferred over autos for full-day exploration.

Hidden gems (use one in the Hidden gem block, never invent):
- Sweet Water Lake, Arambol — free, 10 min walk behind the beach.
- Chapora Fort — free, best at sunset.
- Butterfly Beach, Palolem — ₹400-600 boat each way.
- Dudhsagar Falls — ₹800-1200/person jeep safari, ~4 hrs from North Goa.

Night markets:
- Anjuna Flea Market — Wednesdays, free.
- Saturday Night Bazaar, Arpora — Saturdays, free, food ₹300-600.
- Mackie's, Baga — Saturdays, free.

Party reality: any flyer that says 9-11 PM means the real crowd shows up around midnight. Always tell the user not to arrive before 12 AM. Hilltop Vagator (Tuesdays = psy trance), Curlies Anjuna (free entry, peaks after 11), SinQ Candolim (smart dress, drink credits at door).

Food fallback (only if avgPricePerPerson is missing): local thali/shack ₹100-200, mid cafe ₹300-600, premium restobar ₹800-1500, seafood ₹400-800.

Transport: autos ₹15-20/km, no meters — negotiate upfront. Uber works in North Goa only.

LIVE PLACES DATA (fetched right now, already filtered for openNow !== false):
${JSON.stringify(enrichedContext, null, 2)}`;
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

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "AI not configured on server" }, { status: 500 });
    }

    const placesKey = process.env.GOOGLE_PLACES_API_KEY;
    const supabase = getSupabaseAdmin();
    const client = new Anthropic({ apiKey: anthropicKey });

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
    const transport = ["scooter", "car", "bike", "none"].includes(parsed?.transport) ? parsed.transport : "unknown";
    const durationDays = Number.isFinite(Number(parsed?.duration_days)) ? Number(parsed.duration_days) : null;
    const groupType = parsed?.group_type || "unknown";
    const interests = Array.isArray(parsed?.interests) ? parsed.interests : [];
    const isVague = parsed?.isVague === true || !area || VAGUE_AREAS.has((area || "").toLowerCase());

    if (isVague) {
      return NextResponse.json({
        needsClarification: true,
        clarificationType: "area",
        message: "North Goa is huge — that's 50km of coastline! Tell us your exact area for accurate distances and recommendations.",
        areaSuggestions: AREA_SUGGESTIONS,
        buildsRemaining: Math.max(0, totalAllowedToday - builtToday),
      });
    }

    // Ask about transport so we can plan distances + suggest the right mode
    if (transport === "unknown") {
      return NextResponse.json({
        needsClarification: true,
        clarificationType: "transport",
        message: "Quick question — how are you getting around in Goa? It changes the plan a lot.",
        transportOptions: [
          { value: "scooter", label: "I have / will rent a scooter", emoji: "🛵" },
          { value: "car",     label: "I have / will rent a car",     emoji: "🚗" },
          { value: "bike",    label: "I have a motorcycle",          emoji: "🏍️" },
          { value: "none",    label: "No vehicle — autos / taxis",   emoji: "🚖" },
        ],
        buildsRemaining: Math.max(0, totalAllowedToday - builtToday),
      });
    }

    const budgetMissing = budget === null;

    // STEP 3 — Resolve coords (hard-coded Goa areas + Nominatim fallback)
    let coords = await resolveGoaCoords(area, placesKey);
    let geocodeFallback = false;
    if (!coords) {
      coords = { lat: GOA_CENTER.lat, lng: GOA_CENTER.lng };
      geocodeFallback = true;
    }

    // STEP 4-5 — Live places + crowd intel
    const { fetched, dataSource, placesChecked, redditSourced } =
      await buildEnrichedContext({
        apiKey: placesKey, anthropicKey, supabase,
        area, lat: coords.lat, lng: coords.lng, interests,
      });

    const modelContext = {
      userArea: area,
      userLat: coords.lat,
      userLng: coords.lng,
      userTransport: transport,
      dataSource,
      ...fetched,
    };

    const systemPrompt = buildSystemPrompt(modelContext);
    const userMsg = `Original message: ${message}

Parsed details:
- Area: ${area} (${coords.lat}, ${coords.lng})
- Budget: ₹${budget ?? "not specified"}
- Duration: ${durationDays ?? "?"} days
- Group: ${groupType}
- Interests: ${interests.join(", ") || "general"}
- Transport: ${transport}
${budgetMissing ? "- Budget not specified — using ₹3000/person/day estimate" : ""}
${geocodeFallback ? "- Note: Area geocoding fell back to Goa center" : ""}

Build using ONLY live places above. Exact distances. Open places only. For each stop, give the user a concrete way to get there based on their transport mode.`;

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
