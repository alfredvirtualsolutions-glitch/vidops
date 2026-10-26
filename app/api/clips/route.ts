import { NextResponse } from "next/server";
import { listClips } from "@/lib/clips";

export const dynamic = "force-dynamic";

export async function GET() {
  const clips = await listClips();
  return NextResponse.json({ clips });
}
