import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface IntroCardProps {
  channelName: string;
  accentColor: string;
  durationSeconds: number;
}

const IntroCardContent: React.FC<{ channelName: string; accentColor: string; totalFrames: number }> = ({
  channelName,
  accentColor,
  totalFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Opacity covers the whole card — background included — not just the text,
  // so once it fades out the footage underneath crossfades in cleanly instead
  // of staying hidden behind a solid background for the rest of the video.
  const opacity = interpolate(
    frame,
    [0, fps * 0.6, totalFrames - fps * 0.6, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scale = interpolate(frame, [0, fps], [0.96, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0e14", opacity, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
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

/**
 * A brief branded title card at the start of every video — a consistent,
 * original element (not stock footage) that signals channel identity to
 * reviewers rather than a bare cold-open into narration. Confined to a
 * Sequence spanning only the intro period so it's fully unmounted afterward
 * — it can never sit on top of the background footage for the rest of the
 * video, however its opacity math works out.
 */
export const IntroCard: React.FC<IntroCardProps> = ({ channelName, accentColor, durationSeconds }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const totalFrames = Math.min(durationInFrames, Math.round(durationSeconds * fps));

  return (
    <Sequence from={0} durationInFrames={totalFrames}>
      <IntroCardContent channelName={channelName} accentColor={accentColor} totalFrames={totalFrames} />
    </Sequence>
  );
};
