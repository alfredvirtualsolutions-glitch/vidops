import { NextRequest, NextResponse } from "next/server";
import { fetchMurekaAudio } from "@/lib/mureka";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { prompt, filename } = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    filename?: string;
  };

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const safeName = (filename ?? `track_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "");
  const result = await fetchMurekaAudio(prompt, `${safeName}.mp3`);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
