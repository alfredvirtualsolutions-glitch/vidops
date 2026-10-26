export const SUPPORTED_LOCAL_MODELS = [
  "wan2.2-ti2v-5b",
  "wan2.1-1.3b",
  "wan2.1-14b",
  "hunyuan-1.5",
  "ltx2-local",
  "cogvideo-5b",
] as const;

export type VideoGenStatus = {
  enabled: boolean;
  model: string;
  supported: boolean;
  available: boolean;
  detail: string;
};

export function readVideoGenConfig() {
  const enabled = process.env.VIDEO_GEN_LOCAL_ENABLED === "true";
  const model = process.env.VIDEO_GEN_LOCAL_MODEL ?? SUPPORTED_LOCAL_MODELS[0];
  return { enabled, model };
}
