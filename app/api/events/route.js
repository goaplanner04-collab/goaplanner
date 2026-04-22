import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK = [
  { id: "e1", name: "Hilltop Tuesday Psy", venue: "Hilltop", area: "Vagator",
    lat: 15.6021, lng: 73.7380, start_time: "10 PM",
    entry_fee: "₹300", vibe: "Psy Trance", status: "tonight",
    source: "@thehilltopmusicfestival",
    description: "Iconic Vagator psytrance party — runs every Tuesday in season.",
    insider_tip: "Crowd only arrives after midnight. Don't go before 12 AM." },
  { id: "e2", name: "Sunset Sessions", venue: "Antares", area: "Vagator",
    lat: 15.6021, lng: 73.7340, start_time: "5 PM",
    entry_fee: "Free", vibe: "Live Music", status: "starting_soon",
    source: "@vagatorofficial",
    description: "Live music with sunset cliff views at one of Goa's most iconic spots.",
    insider_tip: "Book a table in advance — fills up fast at sunset." },
  { id: "e3", name: "Curlies Beach Party", venue: "Curlies", area: "Anjuna",
    lat: 15.5766, lng: 73.7404, start_time: "9 PM",
    entry_fee: "Free", vibe: "Commercial/Bollywood", status: "happening_now",
    source: "@curliesanjuna",
    description: "Open beach shack party — free entry, beach vibes.",
    insider_tip: "Real energy starts after 11 PM. Earlier is mostly tourists warming up." },
  { id: "e4", name: "SinQ Saturday Night", venue: "SinQ Beach Club", area: "Candolim",
    lat: 15.5151, lng: 73.7622, start_time: "11 PM",
    entry_fee: "₹1000", vibe: "EDM", status: "tonight",
    source: "@sinqpark",
    description: "Premium beachfront club, big-name EDM DJs.",
    insider_tip: "Entry includes ₹500 drink credits. No chappals or shorts." },
  { id: "e5", name: "Arambol Drum Circle", venue: "Arambol Beach", area: "Arambol",
    lat: 15.6870, lng: 73.7037, start_time: "Sunset",
    entry_fee: "Free", vibe: "World Music", status: "starting_soon",
    source: "local",
    description: "Daily organic drum circle at the beach — bohemian Goa at its best.",
    insider_tip: "North end of beach near the rocks. Just follow the sound." },
  { id: "e6", name: "Silent Noise Club", venue: "Beach venue", area: "Morjim",
    lat: 15.6390, lng: 73.7219, start_time: "9 PM",
    entry_fee: "₹500", vibe: "Silent Disco — 3 channels", status: "tonight",
    source: "@silentnoiseclub",
    description: "Wireless headphones, three DJs, three channels — silent disco done right.",
    insider_tip: "3 DJs simultaneously on different headphone channels. Wildly fun." },
  { id: "e7", name: "Nyex Beach Club", venue: "Nyex", area: "Anjuna",
    lat: 15.5800, lng: 73.7380, start_time: "4 PM",
    entry_fee: "₹200", vibe: "Techno", status: "tonight",
    source: "@nyexclub",
    description: "Afternoon-into-night techno with epic sea views.",
    insider_tip: "Afternoon techno with beach view. One of Goa's most underrated spots." },
  { id: "e8", name: "Flea & Live Band Night", venue: "Mapusa Market", area: "Mapusa",
    lat: 15.5937, lng: 73.8144, start_time: "7 PM",
    entry_fee: "Free", vibe: "Indie/Folk", status: "tonight",
    source: "local",
    description: "Local musicians, food stalls, vintage shopping.",
    insider_tip: "Local Goan musicians. Very authentic, zero tourist-trap energy." }
];

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "today";
    const isAdmin = url.searchParams.get("admin") === "1";

    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const supabase = isAdmin ? getSupabaseAdmin() : (getSupabaseAdmin() || getSupabaseClient());

    if (!supabase) {
      // No DB configured → return fallback for public, empty for admin
      if (isAdmin) return NextResponse.json({ events: [] });
      return NextResponse.json({ events: FALLBACK });
    }

    let query = supabase.from("events").select("*").order("start_time", { ascending: true });

    if (range === "week") {
      query = query.gte("date", sevenDaysAgo).lte("date", today);
    } else {
      query = query.eq("date", today);
      if (!isAdmin) {
        query = query.lte("publish_on", today);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("supabase events error", error);
      if (isAdmin) return NextResponse.json({ events: [] });
      return NextResponse.json({ events: FALLBACK });
    }

    if (!isAdmin && (!data || data.length === 0)) {
      return NextResponse.json({ events: FALLBACK });
    }

    return NextResponse.json({ events: data || [] });
  } catch (err) {
    console.error("events route error", err);
    return NextResponse.json({ events: FALLBACK });
  }
}
