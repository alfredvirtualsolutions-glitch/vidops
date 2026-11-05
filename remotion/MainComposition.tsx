import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ReelClip, ReelProps } from "@/lib/types";
import { clipDuration } from "@/lib/props";

const START_DELAY = 0;
const FADE_IN_SECONDS = 0.3;
const ZOOM_END_SCALE = 1.05;

/**
 * Site-relative paths ("/clips/a.mp4") point into public/. The Next.js Player serves them
 * as-is, but `remotion render` serves public/ under its own prefix, so route them through
 * staticFile(), which gives the right URL in both. Full URLs pass through untouched.
 */
const resolveSrc = (src: string): string =>
  src.startsWith("/") && !src.startsWith("//") ? staticFile(src.slice(1)) : src;

/** Slow push-in across the length of the enclosing Sequence. */
const ZoomIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, Math.max(frames, 1)], [1, ZOOM_END_SCALE], {
    easing: Easing.linear,
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};

export const MainComposition: React.FC<ReelProps> = ({
  audioTrack,
  audioVolume,
  clips,
  fadeOutSeconds = 0,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeFrames = Math.round(fadeOutSeconds * fps);
  const fadeStart = durationInFrames - fadeFrames;
  const videoFade =
    fadeFrames > 0
      ? interpolate(frame, [fadeStart, durationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const audioGain = (f: number) => {
    if (fadeFrames === 0) return audioVolume;
    const fadeIn = interpolate(f, [0, Math.round(FADE_IN_SECONDS * fps)], [0, 1], {
      extrapolateRight: "clamp",
    });
    const fadeOut = interpolate(f, [fadeStart, durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return audioVolume * fadeIn * fadeOut;
  };
  let cursor = START_DELAY;

  const sequences = clips.map((clip: ReelClip, index: number) => {
    const from = Math.round(cursor * fps);
    const duration = Math.round(clipDuration(clip) * fps);
    cursor += clipDuration(clip);
    const video = (
      <OffthreadVideo
        src={resolveSrc(clip.src)}
        volume={clip.volume}
        startFrom={Math.round((clip.startFromInSeconds ?? 0) * fps)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: clip.objectFit,
        }}
      />
    );
    return (
      <Sequence key={`${clip.src}-${index}`} from={from} durationInFrames={duration}>
        {clip.zoom ? <ZoomIn frames={duration}>{video}</ZoomIn> : video}
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ opacity: videoFade }}>{sequences}</AbsoluteFill>
      {audioTrack ? <Audio src={resolveSrc(audioTrack)} volume={audioGain} /> : null}
    </AbsoluteFill>
  );
};
