import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface IntroCardProps {
  channelName: string;
  accentColor: string;
  durationSeconds: number;
}

/**
 * A brief branded title card at the start of every video — a consistent,
 * original element (not stock footage) that signals channel identity to
 * reviewers rather than a bare cold-open into narration.
 */
export const IntroCard: React.FC<IntroCardProps> = ({
  channelName,
  accentColor,
  durationSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const totalFrames = Math.min(durationInFrames, Math.round(durationSeconds * fps));

  const opacity = interpolate(
    frame,
    [0, fps * 0.6, totalFrames - fps * 0.6, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scale = interpolate(frame, [0, fps], [0.96, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0e14", justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          fontFamily: "Georgia, serif",
          fontSize: 64,
          color: "#F4F1EA",
          letterSpacing: 2,
          textAlign: "center",
        }}
      >
        {channelName}
        <div style={{ width: 80, height: 3, background: accentColor, margin: "18px auto 0" }} />
      </div>
    </AbsoluteFill>
  );
};
