import React from "react";
import { Composition, staticFile } from "remotion";
import { MeditationVideo } from "./Composition";
import scriptSegments from "../script.json";
import visualManifest from "../visuals/manifest.json";
import captions from "../subtitles/captions.json";
import videoConfig from "../video.config.json";
import defaultConfig from "../../../shared/config/default.config.json";

const config = {
  ...defaultConfig,
  ...(videoConfig as any).configOverrides,
};

// Manifest/config paths are relative to the video's base folder. Remotion
// resolves public/ against the project ROOT (not this video's folder), so
// render.ts stages this video's finalized audio/visuals into
// public/<slug>/ right before rendering — prefix every path with slug here
// to match where they land.
const slug = (videoConfig as any).slug as string;
const resolvedClips = (visualManifest as { filePath: string; [k: string]: unknown }[]).map(
  (clip) => ({ ...clip, filePath: staticFile(`${slug}/${clip.filePath}`) })
);

const fps = config.render.fps;
const totalSeconds = (scriptSegments as { duration: number }[]).reduce(
  (sum, s) => sum + s.duration,
  0
);
const durationInFrames = Math.max(1, Math.round(totalSeconds * fps));

const sharedProps = {
  clips: resolvedClips as any,
  captions: captions as any,
  subtitleStyle: config.subtitles,
  audioSrc: staticFile(`${slug}/${(videoConfig as any).mixedAudioPath}`),
  channelName: config.branding.channelName,
  accentColor: config.branding.accentColor,
  introDurationSeconds: config.branding.introDurationSeconds,
  kenBurnsZoomRange: config.visuals.kenBurns.zoomRange,
  kenBurnsPanRange: config.visuals.kenBurns.panRange,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="horizontal"
        component={MeditationVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={config.render.formats["16x9"].width}
        height={config.render.formats["16x9"].height}
        defaultProps={sharedProps}
      />
      <Composition
        id="vertical"
        component={MeditationVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={config.render.formats["9x16"].width}
        height={config.render.formats["9x16"].height}
        defaultProps={sharedProps}
      />
    </>
  );
};
