import Anthropic from "@anthropic-ai/sdk";
import { getDistanceKm } from "@/lib/haversine";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export const PLACE_QUALITY = {
  MIN_RATING: 4.0,
  MIN_REVIEWS: 50,
};

export function priceLevelToRange(level) {
  if (level === 0 || level === 1) return "₹";
  if (level === 2) return "₹₹";
  if (level === 3 || level === 4) return "₹₹₹";
  return "₹₹";
}

export function buildPhotoUrl(reference, key, maxwidth = 800) {
  if (!reference || !key) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(reference)}&key=${key}`;
}

export function calcDistanceKm(originLat, originLng, lat, lng) {
  if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const km = getDistanceKm(originLat, originLng, lat, lng);
  if (km == null) return null;
  return Math.round(km * 10) / 10;
}

export function passesQualityFilter(rating, reviewCount) {
  const r = Number(rating) || 0;
  const c = Number(reviewCount) || 0;
  return r >= PLACE_QUALITY.MIN_RATING && c >= PLACE_QUALITY.MIN_REVIEWS;
}

const PRICE_SYSTEM = `Extract price per person from these restaurant reviews.
Return ONLY JSON: { "avgPricePerPerson": number|null, "confidence": "high"|"low" }
Look for total bill mentions. If a group size is mentioned, divide accordingly.
Return null if no clear price data found. No markdown. No code blocks.`;

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

export async function extractPriceFromReviews(reviews, anthropicKey) {
  if (!reviews || !reviews.length || !anthropicKey) {
    return { avgPricePerPerson: null, confidence: null };
  }
  const text = reviews
    .map((r) => (r.text || r).toString().slice(0, 600))
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);

  if (!text) return { avgPricePerPerson: null, confidence: null };

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const completion = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 100,
      system: PRICE_SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const out = (completion.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const parsed = tryParseJsonObject(out);
    if (!parsed) return { avgPricePerPerson: null, confidence: null };
    const price = Number(parsed.avgPricePerPerson);
    return {
      avgPricePerPerson: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
      confidence: parsed.confidence === "high" ? "high" : (parsed.confidence === "low" ? "low" : null),
    };
  } catch {
    return { avgPricePerPerson: null, confidence: null };
  }
}

const REDDIT_HEADERS = {
  "User-Agent": "GoaNow/1.0",
  "Accept": "application/json",
};

async function fetchRedditJson(url) {
  try {
    const res = await fetch(url, { headers: REDDIT_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function snippetsFromReddit(json) {
  const out = [];
  const children = json?.data?.children || [];
  for (const child of children) {
    const d = child.data || {};
    if ((d.score || 0) <= 2) continue;
    const title = (d.title || "").toString().trim();
    const body = (d.selftext || "").toString().trim().slice(0, 1200);
    if (title) out.push(title + (body ? "\n" + body : ""));
    if (out.length >= 20) break;
  }
  return out;
}

export async function fetchRedditSnippets(placeName, area) {
  const queries = [
    `https://www.reddit.com/r/goaindia/search.json?q=${encodeURIComponent(`${placeName} ${area || "Goa"}`)}&sort=top&limit=10&t=year&restrict_sr=on`,
    `https://www.reddit.com/r/india/search.json?q=${encodeURIComponent(`${placeName} Goa`)}&sort=top&limit=5&t=year&restrict_sr=on`,
  ];
  const results = await Promise.all(queries.map(fetchRedditJson));
  const snippets = [];
  for (const r of results) {
    if (r) snippets.push(...snippetsFromReddit(r));
  }
  return snippets.slice(0, 20);
}

const CROWD_SYSTEM = `Analyze Reddit posts about a Goa venue.
Return ONLY this JSON, no other text:
{
  "bestTimeToVisit": string|null,
  "peakCrowdTime": string|null,
  "avgPricePerPerson": number|null,
  "priceRange": { "min": number, "max": number }|null,
  "commonComplaints": string[],
  "insiderTips": string[],
  "dataQuality": "high"|"medium"|"low"|"none",
  "postCount": number
}
Base answers ONLY on provided text. Never invent.
commonComplaints and insiderTips: max 2 items each, short strings.
dataQuality: 'high' = 5+ relevant posts, 'medium' = 2-4, 'low' = 1, 'none' = 0.`;

export async function analyzeCrowdWithHaiku(placeName, area, snippets, anthropicKey) {
  if (!anthropicKey) {
    return { bestTimeToVisit: null, peakCrowdTime: null, avgPricePerPerson: null, priceRange: null, commonComplaints: [], insiderTips: [], dataQuality: "none", postCount: 0 };
  }
  if (!snippets || !snippets.length) {
    return { bestTimeToVisit: null, peakCrowdTime: null, avgPricePerPerson: null, priceRange: null, commonComplaints: [], insiderTips: [], dataQuality: "none", postCount: 0 };
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const completion = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      system: CROWD_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Venue: ${placeName}, ${area || "Goa"}, Goa\n\n${snippets.join("\n---\n")}`,
        },
      ],
    });
    const out = (completion.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const parsed = tryParseJsonObject(out);
    if (!parsed) {
      return { bestTimeToVisit: null, peakCrowdTime: null, avgPricePerPerson: null, priceRange: null, commonComplaints: [], insiderTips: [], dataQuality: "none", postCount: snippets.length };
    }
    return {
      bestTimeToVisit: parsed.bestTimeToVisit || null,
      peakCrowdTime: parsed.peakCrowdTime || null,
      avgPricePerPerson: Number.isFinite(Number(parsed.avgPricePerPerson)) ? Number(parsed.avgPricePerPerson) : null,
      priceRange: parsed.priceRange && typeof parsed.priceRange === "object" ? parsed.priceRange : null,
      commonComplaints: Array.isArray(parsed.commonComplaints) ? parsed.commonComplaints.slice(0, 2) : [],
      insiderTips: Array.isArray(parsed.insiderTips) ? parsed.insiderTips.slice(0, 2) : [],
      dataQuality: ["high", "medium", "low", "none"].includes(parsed.dataQuality) ? parsed.dataQuality : "none",
      postCount: Number.isFinite(Number(parsed.postCount)) ? Number(parsed.postCount) : snippets.length,
    };
  } catch {
    return { bestTimeToVisit: null, peakCrowdTime: null, avgPricePerPerson: null, priceRange: null, commonComplaints: [], insiderTips: [], dataQuality: "none", postCount: snippets.length };
  }
}

export async function fetchCrowdIntel({ placeId, placeName, area, supabase, anthropicKey }) {
  if (!placeId || !placeName) return null;

  // 1. Cache check (24h)
  if (supabase) {
    try {
      const { data } = await supabase
        .from("crowd_intel")
        .select("*")
        .eq("place_id", placeId)
        .single();
      if (data && data.cached_at) {
        const ageMs = Date.now() - new Date(data.cached_at).getTime();
        if (ageMs < 24 * 3600 * 1000) {
          return {
            bestTimeToVisit: data.best_time,
            peakCrowdTime: data.peak_crowd_time,
            avgPricePerPerson: data.avg_price_per_person,
            priceRange: data.price_range,
            commonComplaints: data.common_complaints || [],
            insiderTips: data.insider_tips || [],
            dataQuality: data.data_quality || "none",
            postCount: data.post_count || 0,
            cached: true,
          };
        }
      }
    } catch {
      // ignore — table may be missing
    }
  }

  // 2. Fetch fresh from Reddit + Haiku
  const snippets = await fetchRedditSnippets(placeName, area);
  const intel = await analyzeCrowdWithHaiku(placeName, area, snippets, anthropicKey);

  // 3. Save to cache
  if (supabase) {
    try {
      await supabase.from("crowd_intel").upsert({
        place_id: placeId,
        place_name: placeName,
        area: area || null,
        best_time: intel.bestTimeToVisit,
        peak_crowd_time: intel.peakCrowdTime,
        avg_price_per_person: intel.avgPricePerPerson,
        price_range: intel.priceRange,
        common_complaints: intel.commonComplaints,
        insider_tips: intel.insiderTips,
        data_quality: intel.dataQuality,
        post_count: intel.postCount,
        cached_at: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }

  return intel;
}
