import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { MainComposition } from "./MainComposition";
import { ReelProps } from "@/lib/types";
import { totalDuration } from "@/lib/props";

const FPS = 30;

const defaultProps: ReelProps = {
  resolution: { width: 1080, height: 1920 },
  fps: FPS,
  audioTrack: null,
  audioVolume: 0.8,
  clips: [],
};

const calculateMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => {
  return {
    durationInFrames: Math.max(1, Math.ceil(totalDuration(props) * props.fps)),
    fps: props.fps,
    width: props.resolution.width,
    height: props.resolution.height,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainComposition"
      component={MainComposition}
      durationInFrames={30 * 60}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  );
};
