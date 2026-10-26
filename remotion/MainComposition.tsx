import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from "remotion";
import { ReelClip, ReelProps } from "@/lib/types";
import { clipDuration } from "@/lib/props";

const START_DELAY = 0;

export const MainComposition: React.FC<ReelProps> = ({
  audioTrack,
  audioVolume,
  clips,
}) => {
  const { fps } = useVideoConfig();
  let cursor = START_DELAY;

  const sequences = clips.map((clip: ReelClip, index: number) => {
    const from = Math.round(cursor * fps);
    const duration = Math.round(clipDuration(clip) * fps);
    cursor += clipDuration(clip);
    return (
      <Sequence key={`${clip.src}-${index}`} from={from} durationInFrames={duration}>
        <OffthreadVideo
          src={clip.src}
          volume={clip.volume}
          style={{
            width: "100%",
            height: "100%",
            objectFit: clip.objectFit,
          }}
        />
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {sequences}
      {audioTrack ? (
        <Audio src={audioTrack} volume={audioVolume} />
      ) : null}
    </AbsoluteFill>
  );
};
