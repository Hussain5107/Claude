import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface CaptionCue {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface SubtitleStyleConfig {
  fontFamily: string;
  fontSizePx: number;
  color: string;
  backgroundColor: string;
  position: "bottom" | "top" | "center";
  fadeInMs: number;
  fadeOutMs: number;
}

interface SubtitleOverlayProps {
  captions: CaptionCue[];
  style: SubtitleStyleConfig;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ captions, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSeconds = frame / fps;

  const active = captions.find(
    (c) => timeSeconds >= c.startSeconds && timeSeconds <= c.endSeconds
  );
  if (!active) return null;

  const fadeInSeconds = style.fadeInMs / 1000;
  const fadeOutSeconds = style.fadeOutMs / 1000;
  const opacity = interpolate(
    timeSeconds,
    [
      active.startSeconds,
      active.startSeconds + fadeInSeconds,
      active.endSeconds - fadeOutSeconds,
      active.endSeconds,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const justifyContent =
    style.position === "top" ? "flex-start" : style.position === "center" ? "center" : "flex-end";

  return (
    <AbsoluteFill
      style={{
        justifyContent,
        alignItems: "center",
        padding: "6%",
      }}
    >
      <div
        style={{
          opacity,
          fontFamily: style.fontFamily,
          fontSize: style.fontSizePx,
          color: style.color,
          backgroundColor: style.backgroundColor,
          padding: "0.4em 0.8em",
          borderRadius: 12,
          textAlign: "center",
          maxWidth: "80%",
          lineHeight: 1.3,
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};
