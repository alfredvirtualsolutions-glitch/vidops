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
};

export function buildReelProps({ clips, audioTrack, audioVolume = 0.8 }: BuildOptions): ReelProps {
  return {
    resolution: { ...RESOLUTION },
    fps: FPS,
    audioTrack,
    audioVolume,
    clips: clips.map((c) => ({ ...c })),
  };
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
