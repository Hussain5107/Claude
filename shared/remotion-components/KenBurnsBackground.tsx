import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface VisualClip {
  filePath: string;
  durationSeconds: number;
  zoomDirection: "in" | "out";
  panDirection: "left" | "right" | "up" | "down";
}

interface KenBurnsBackgroundProps {
  clips: VisualClip[];
  zoomRange: [number, number];
  panRange: number;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isImage(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * One clip per Sequence, each with its own subtle zoom/pan so the background
 * never sits static — this is the "not templated/looped footage" signal for
 * manual review, distinct from a single looping background clip.
 */
const KenBurnsClip: React.FC<{ clip: VisualClip; zoomRange: [number, number]; panRange: number }> = ({
  clip,
  zoomRange,
  panRange,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const [zoomFrom, zoomTo] =
    clip.zoomDirection === "in" ? [zoomRange[0], zoomRange[1]] : [zoomRange[1], zoomRange[0]];
  const scale = interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panPercent = interpolate(frame, [0, durationInFrames], [0, panRange * 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateX =
    clip.panDirection === "left" ? -panPercent : clip.panDirection === "right" ? panPercent : 0;
  const translateY =
    clip.panDirection === "up" ? -panPercent : clip.panDirection === "down" ? panPercent : 0;

  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
  };

  return isImage(clip.filePath) ? (
    <Img src={clip.filePath} style={style} />
  ) : (
    <OffthreadVideo src={clip.filePath} style={style} muted />
  );
};

export const KenBurnsBackground: React.FC<KenBurnsBackgroundProps> = ({
  clips,
  zoomRange,
  panRange,
}) => {
  const { fps } = useVideoConfig();
  let startFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {clips.map((clip, i) => {
        const durationInFrames = Math.round(clip.durationSeconds * fps);
        const sequence = (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <KenBurnsClip clip={clip} zoomRange={zoomRange} panRange={panRange} />
          </Sequence>
        );
        startFrame += durationInFrames;
        return sequence;
      })}
    </AbsoluteFill>
  );
};
