import { promises as fs } from "fs";
import path from "path";
import { AudioResult } from "./types";

const MUREKA_API_URL =
  process.env.MUREKA_API_URL ?? "https://api.mureka.ai/v1/generate";
const FALLBACK_AUDIO = "/audio/default_beat.mp3";
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Requests a generated track from Mureka and downloads it to public/audio/.
 * Never throws: returns { ok: false } so the caller can decide on fallback.
 */
export async function fetchMurekaAudio(
  prompt: string,
  filename: string
): Promise<AudioResult> {
  const apiKey = process.env.MUREKA_API_KEY;
  if (!apiKey) {
    return { ok: false, url: FALLBACK_AUDIO, fallback: true, error: "MUREKA_API_KEY not set" };
  }

  try {
    const res = await fetch(MUREKA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, duration: 60, format: "mp3" }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        ok: false,
        url: FALLBACK_AUDIO,
        fallback: true,
        error: `Mureka responded ${res.status}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const audioUrl = extractAudioUrl(data);
    if (!audioUrl) {
      return {
        ok: false,
        url: FALLBACK_AUDIO,
        fallback: true,
        error: "No audio_url in Mureka response",
      };
    }

    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!audioRes.ok) {
      return {
        ok: false,
        url: FALLBACK_AUDIO,
        fallback: true,
        error: `Audio download failed: ${audioRes.status}`,
      };
    }

    const buf = Buffer.from(await audioRes.arrayBuffer());
    if (buf.byteLength === 0) {
      return { ok: false, url: FALLBACK_AUDIO, fallback: true, error: "Empty audio file" };
    }

    const dir = path.join(process.cwd(), "public", "audio");
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, filename);
    await fs.writeFile(dest, buf);

    return { ok: true, url: `/audio/${filename}`, fallback: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, url: FALLBACK_AUDIO, fallback: true, error: message };
  }
}

function extractAudioUrl(data: Record<string, unknown>): string | null {
  const direct = data.audio_url;
  if (typeof direct === "string") return direct;
  const nested = data.data;
  if (nested && typeof nested === "object") {
    const url = (nested as Record<string, unknown>).audio_url;
    if (typeof url === "string") return url;
  }
  return null;
}
