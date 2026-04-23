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

const SYSTEM = `You are an event data extractor. You will receive raw HTML/text from district.in, a Goa events listing website.

Extract ALL events that are in Goa or are Goa-related. For each event return a JSON object with:
- name: event name (string)
- venue: venue name (string)
- area: area/neighbourhood in Goa e.g. "Vagator", "Anjuna", "Panaji", "Calangute" (string)
- date: date in YYYY-MM-DD format (string)
- start_time: start time e.g. "9 PM", "10:30 PM" (string)
- entry_fee: entry fee e.g. "₹500", "Free", "Check at venue" (string, default "Check at venue")
- vibe: music genre/vibe if mentioned e.g. "Techno", "EDM", "Live Band" (string, empty if unknown)
- description: short description (string, empty if none)
- source: "district.in" (string, always this value)

Return ONLY a valid JSON array of event objects. No explanation. No markdown. No code blocks. No backticks.
If no Goa events are found, return an empty array: []`;

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

async function fetchDistrictPage() {
  const urls = [
    "https://www.district.in/",
    "https://www.district.in/events/",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-IN,en;q=0.9",
          "Accept-Encoding": "identity",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const html = await res.text();
        // trim to first 80k chars so it fits in Haiku context
        return { url, html: html.slice(0, 80000) };
      }
    } catch {
      // try next url
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
    const page = await fetchDistrictPage();
    if (!page) {
      return NextResponse.json({ success: false, error: "Could not reach district.in. Try again." }, { status: 502 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const client = new Anthropic({ apiKey });

    const completion = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Today's date is ${today}. Extract all Goa events from this page (${page.url}):\n\n${page.html}`
        }
      ]
    });

    const text = (completion.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const events = tryParseJsonArray(text);

    if (!events) {
      return NextResponse.json({ success: false, error: "Could not parse events from district.in" }, { status: 200 });
    }

    // normalize each event
    const normalized = events.map((ev) => ({
      name: ev.name || "",
      venue: ev.venue || "",
      area: ev.area || "",
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
