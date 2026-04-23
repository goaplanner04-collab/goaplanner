import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return req.headers.get("x-admin-auth") === expected;
}

const SYSTEM = `You are an event data extractor. You receive raw HTML or text from district.in which lists Goa events.

Extract ALL events that are in Goa. For each event return a JSON object with:
- name: event name (string)
- venue: venue name (string)
- area: area/neighbourhood in Goa e.g. "Vagator", "Anjuna", "Panaji", "Calangute", "North Goa", "South Goa" (string)
- date: event date in YYYY-MM-DD format. If it says "Daily" use today's date. (string)
- start_time: start time e.g. "8 PM", "9:00 PM", "8:00 PM onwards" (string)
- entry_fee: entry fee e.g. "₹1050", "₹500", "Free", "Check at venue" (string, default "Check at venue")
- vibe: music genre/vibe if mentioned e.g. "Live DJ", "Live Band", "Cruise Party" (string, empty if unknown)
- description: short 1-2 sentence description (string, empty if none)
- source: "district.in" (always this value)

Return ONLY a valid JSON array. No explanation. No markdown. No code blocks. No backticks.
If no Goa events found, return: []`;

function tryParseJsonArray(raw) {
  if (!raw) return null;
  let txt = raw.trim();
  txt = txt.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = txt.indexOf("[");
  const end = txt.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(txt.slice(start, end + 1));
  } catch {
    return null;
  }
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
  "Accept-Encoding": "identity",
  // send Goa city cookies — district.in stores city selection client-side
  "Cookie": "userCity=goa; selectedCity=goa; city=goa; city_name=Goa; z_gcl=goa",
  "Referer": "https://www.district.in/",
};

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Extract __NEXT_DATA__ JSON embedded in Next.js pages
function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.stringify(JSON.parse(match[1]), null, 2);
  } catch {
    return null;
  }
}

async function fetchDistrictContent() {
  const urlsToTry = [
    "https://www.district.in/",
    "https://www.district.in/events/",
    "https://www.district.in/search?q=goa+events",
    "https://www.district.in/search?q=goa+party",
  ];

  for (const url of urlsToTry) {
    const html = await fetchPage(url);
    if (!html) continue;

    // First try to extract the embedded Next.js JSON data (much more reliable)
    const nextData = extractNextData(html);
    if (nextData && nextData.length > 500) {
      return { url, content: nextData, type: "nextdata" };
    }

    // Fall back to raw HTML (strip script/style to reduce noise)
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s{2,}/g, " ")
      .slice(0, 80000);

    if (stripped.length > 1000) {
      return { url, content: stripped, type: "html" };
    }
  }
  return null;
}

export async function POST(req) {
  if (!checkAuth(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "AI not configured" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Support "paste HTML" mode: admin pastes HTML from their browser
    let content, sourceUrl;
    if (body.pastedHtml && body.pastedHtml.trim().length > 100) {
      content = body.pastedHtml.slice(0, 100000);
      sourceUrl = "district.in (pasted)";
    } else {
      const page = await fetchDistrictContent();
      if (!page) {
        return NextResponse.json({
          success: false,
          error: "district.in did not return usable content. Use 'Paste HTML' mode instead — open district.in in your browser with Goa selected, press Ctrl+A, Ctrl+C, then paste below.",
          usePaste: true,
        }, { status: 200 });
      }
      content = page.content;
      sourceUrl = page.url;
    }

    const today = new Date().toISOString().slice(0, 10);
    const client = new Anthropic({ apiKey });

    const completion = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Today's date is ${today}. Source: ${sourceUrl}\n\nExtract all Goa events from this content:\n\n${content}`,
        }
      ],
    });

    const text = (completion.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const events = tryParseJsonArray(text);
    if (!events) {
      return NextResponse.json({
        success: false,
        error: "Haiku could not find Goa events in the fetched content. Try 'Paste HTML' mode.",
        usePaste: true,
      });
    }

    const normalized = events.map((ev) => ({
      name: ev.name || "",
      venue: ev.venue || "",
      area: ev.area || "Goa",
      date: ev.date || today,
      start_time: ev.start_time || "",
      entry_fee: ev.entry_fee || "Check at venue",
      vibe: ev.vibe || "",
      description: ev.description || "",
      source: "district.in",
      status: "tonight",
      publish_on: ev.date || today,
    })).filter((ev) => ev.name && ev.venue);

    return NextResponse.json({ success: true, events: normalized, count: normalized.length });
  } catch (err) {
    console.error("scrape-district error", err);
    return NextResponse.json({ success: false, error: "Scrape failed: " + err.message }, { status: 500 });
  }
}
