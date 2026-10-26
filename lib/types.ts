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
};

export type ReelProps = {
  resolution: { width: number; height: number };
  fps: number;
  audioTrack: string | null;
  audioVolume: number;
  clips: ReelClip[];
};

export type AudioResult = {
  ok: boolean;
  url: string | null;
  fallback: boolean;
  error?: string;
};

export const REEL_TYPES = ["highlights", "bloopers"] as const;
export type ReelType = (typeof REEL_TYPES)[number];

export const RESOLUTION = { width: 1080, height: 1920 } as const;
export const FPS = 30;
export const TARGET_DURATION = 60;
