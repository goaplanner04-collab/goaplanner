import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


const SYSTEM = `Extract event details from this party flyer image.
Return ONLY a valid JSON object with these exact fields:
name, venue, area, date (YYYY-MM-DD format), start_time,
entry_fee, vibe, source.
Rules:
- If entry_fee not found → use 'Check at venue'
- If date not found → use today's date in YYYY-MM-DD format
- If any other field not found → use empty string
Return ONLY the raw JSON object.
No explanation. No markdown. No code blocks. No backticks.`;

function tryParseJson(raw) {
  if (!raw) return null;
  let txt = raw.trim();
  // strip code fences if model added them
  txt = txt.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // attempt to grab first { ... } block
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const candidate = txt.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    return null;
  }
}

export async function POST(req) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { image, mediaType } = await req.json();
    if (!image) {
      return NextResponse.json(
        { success: false, error: "Missing image" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "AI not configured on server" },
        { status: 500 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const finalType = allowedTypes.includes(mediaType) ? mediaType : "image/jpeg";

    const client = new Anthropic({ apiKey });

    const today = new Date().toISOString().slice(0, 10);

    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: finalType,
                data: image
              }
            },
            {
              type: "text",
              text: `Today's date is ${today}. Extract fields now.`
            }
          ]
        }
      ]
    });

    const text = (completion.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const parsed = tryParseJson(text);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Couldn't read flyer clearly. Please fill in manually." },
        { status: 200 }
      );
    }

    // normalize
    const fields = {
      name: parsed.name || "",
      venue: parsed.venue || "",
      area: parsed.area || "",
      date: parsed.date || today,
      start_time: parsed.start_time || "",
      entry_fee: parsed.entry_fee || "Check at venue",
      vibe: parsed.vibe || "",
      source: parsed.source || ""
    };

    return NextResponse.json({ success: true, fields });
  } catch (err) {
    console.error("extract-flyer error", err);
    return NextResponse.json(
      { success: false, error: "AI extraction failed" },
      { status: 500 }
    );
  }
}
