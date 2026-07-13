import React from "react";
import { AbsoluteFill } from "remotion";
import { KenBurnsBackground, type VisualClip } from "../../../shared/remotion-components/KenBurnsBackground";
import { SubtitleOverlay, type CaptionCue, type SubtitleStyleConfig } from "../../../shared/remotion-components/SubtitleOverlay";
import { IntroCard } from "../../../shared/remotion-components/IntroCard";
import { AudioTrack } from "../../../shared/remotion-components/AudioTrack";

export interface MeditationVideoProps {
  clips: VisualClip[];
  captions: CaptionCue[];
  subtitleStyle: SubtitleStyleConfig;
  audioSrc: string;
  channelName: string;
  accentColor: string;
  introDurationSeconds: number;
  kenBurnsZoomRange: [number, number];
  kenBurnsPanRange: number;
}

export const MeditationVideo: React.FC<MeditationVideoProps> = ({
  clips,
  captions,
  subtitleStyle,
  audioSrc,
  channelName,
  accentColor,
  introDurationSeconds,
  kenBurnsZoomRange,
  kenBurnsPanRange,
}) => {
  return (
    <AbsoluteFill>
      <KenBurnsBackground clips={clips} zoomRange={kenBurnsZoomRange} panRange={kenBurnsPanRange} />
      <SubtitleOverlay captions={captions} style={subtitleStyle} />
      <IntroCard
        channelName={channelName}
        accentColor={accentColor}
        durationSeconds={introDurationSeconds}
      />
      <AudioTrack src={audioSrc} />
    </AbsoluteFill>
  );
};
