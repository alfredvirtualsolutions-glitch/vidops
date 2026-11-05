import { ReelClip, ReelProps, RESOLUTION, FPS, TARGET_DURATION } from "@/lib/types";

const DEFAULT_CLIP_DURATION = 8;

export function clipDuration(clip: ReelClip): number {
  return clip.durationInSeconds ?? DEFAULT_CLIP_DURATION;
}

export function totalDuration(props: ReelProps): number {
  return props.clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
}

type BuildOptions = {
  clips: ReelClip[];
  audioTrack: string | null;
  audioVolume?: number;
  fadeOutSeconds?: number;
};

export function buildReelProps({
  clips,
  audioTrack,
  audioVolume = 0.8,
  fadeOutSeconds,
}: BuildOptions): ReelProps {
  return {
    resolution: { ...RESOLUTION },
    fps: FPS,
    audioTrack,
    audioVolume,
    clips: clips.map((c) => ({ ...c })),
    ...(fadeOutSeconds ? { fadeOutSeconds } : {}),
  };
}

/** Source length assumed for a clip that does not report one (kept conservative so windows never run past the end). */
const DEFAULT_SOURCE_DURATION = 7;
/** Step between the windows used on repeat visits to the same clip (seconds). */
const WINDOW_STEP = 2.9;

/**
 * Cut the pool to a beat map: one reel clip per gap between cut times, cycling
 * through the pool in order. Each repeat visit to a clip starts from a different
 * window of it, so a short pool still gives varied picture across a long track.
 * Clips are muted because the beat map's track supplies the sound.
 */
export function buildBeatSyncedClips(pool: ReelClip[], cuts: number[]): ReelClip[] {
  if (pool.length === 0) return [];
  const visits = new Array(pool.length).fill(0);
  const out: ReelClip[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const length = cuts[i + 1] - cuts[i];
    if (length <= 0) continue;
    const c = i % pool.length;
    const source = pool[c].sourceDuration ?? DEFAULT_SOURCE_DURATION;
    const room = Math.max(source - 0.1 - length, 0);
    const start = room > 0 ? (visits[c] * WINDOW_STEP) % room : 0;
    visits[c] += 1;
    out.push({
      ...pool[c],
      volume: 0,
      zoom: true,
      startFromInSeconds: Math.round(start * 1000) / 1000,
      durationInSeconds: length,
    });
  }
  return out;
}

export function selectClipsForTarget(
  pool: ReelClip[],
  targetDuration: number = TARGET_DURATION
): ReelClip[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected: ReelClip[] = [];
  let duration = 0;
  for (const clip of shuffled) {
    if (duration >= targetDuration) break;
    selected.push(clip);
    duration += clipDuration(clip);
  }
  return selected;
}
