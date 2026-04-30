import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { image, mediaType } = await req.json();
    if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(image, "base64");

    const { error: uploadError } = await supabase.storage
      .from("event-flyers")
      .upload(filename, buffer, { contentType: mediaType || "image/jpeg", upsert: false });

    if (uploadError) {
      console.error("Storage upload error", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("event-flyers").getPublicUrl(filename);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error("upload-flyer-image error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
