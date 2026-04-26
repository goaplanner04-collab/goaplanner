import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isEmailValid } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlPage(title, body) {
  return new NextResponse(
    `<!doctype html><html><head><title>${title}</title><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#07090e;color:#e9ecf3;font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.card{max-width:480px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;text-align:center;}
h1{margin:0 0 12px;color:#FF3D81;font-size:28px;}p{color:#d8dce8;line-height:1.6;}
a{color:#33D6C8;}</style></head><body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  if (!isEmailValid(email)) {
    return htmlPage("Unsubscribe", `<h1>Invalid link</h1><p>Could not unsubscribe — link is missing or malformed.</p>`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return htmlPage("Unsubscribe", `<h1>Service unavailable</h1><p>Please try again later.</p>`);
  }

  try {
    await supabase
      .from("email_subscribers")
      .update({ opted_out: true })
      .eq("email", email);
  } catch {
    // ignore — table may not exist
  }

  return htmlPage(
    "Unsubscribed",
    `<h1>You're unsubscribed ✓</h1>
     <p>You won't receive party-night emails from GoaNow anymore.</p>
     <p>Changed your mind? <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://goanow.in"}">Visit GoaNow</a> and we'll add you back next time you book a pass.</p>`
  );
}
