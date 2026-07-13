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

  // Fade in/out independently (rather than one 4-point interpolate over
  // [start, start+fadeIn, end-fadeOut, end]) so short caption cues — shorter
  // than fadeInSeconds + fadeOutSeconds — can't produce a non-monotonic input
  // range (interpolate() requires strictly increasing values).
  const duration = active.endSeconds - active.startSeconds;
  const fadeIn = Math.max(0.001, Math.min(style.fadeInMs / 1000, duration / 2));
  const fadeOut = Math.max(0.001, Math.min(style.fadeOutMs / 1000, duration / 2));
  const fadeInOpacity = interpolate(
    timeSeconds,
    [active.startSeconds, active.startSeconds + fadeIn],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fadeOutOpacity = interpolate(
    timeSeconds,
    [active.endSeconds - fadeOut, active.endSeconds],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

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
