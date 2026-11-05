export type Clip = {
  /** Path relative to public/, e.g. "clips/highlights/solo/dunk.mp4" */
  key: string;
  /** Public URL the browser and Remotion can load */
  url: string;
  name: string;
  category: string;
  /** Seconds, null when unknown (ffprobe not available server-side) */
  duration: number | null;
};

export type ReelClip = {
  src: string;
  objectFit: "cover" | "contain";
  volume: number;
  effects: string[];
  durationInSeconds?: number;
  /** Seconds into the source file to start playing from (default 0). */
  startFromInSeconds?: number;
  /** Slow push-in over the clip's length (beat-synced reels use this). */
  zoom?: boolean;
  /** Length of the source file in seconds, when known. */
  sourceDuration?: number;
};

export type ReelProps = {
  resolution: { width: number; height: number };
  fps: number;
  audioTrack: string | null;
  audioVolume: number;
  clips: ReelClip[];
  /** Fade audio and picture out over this many seconds at the end (default 0). */
  fadeOutSeconds?: number;
};

/** Output of scripts/beat_sync_audio.py, stored next to the track in public/audio/. */
export type BeatMap = {
  track: string;
  durationInSeconds: number;
  bpm: number;
  barSeconds: number;
  /** Cut boundaries in seconds, starting at 0 and ending at the track length. */
  cuts: number[];
};

export type AudioResult = {
  ok: boolean;
  url: string | null;
  fallback: boolean;
  error?: string;
};

export const REEL_TYPES = ["highlights", "bloopers", "wildlife"] as const;
export type ReelType = (typeof REEL_TYPES)[number];

export const RESOLUTION = { width: 1080, height: 1920 } as const;
export const FPS = 30;
export const TARGET_DURATION = 60;
