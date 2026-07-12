import fs from "node:fs";
import { DEFAULT_CONFIG_PATH } from "./paths.js";

export interface PipelineConfig {
  script: {
    provider: string;
    model: string;
    wordsPerMinute: number;
    minPauseSeconds: number;
    maxPauseSeconds: number;
    pauseDistribution: string;
    introSilenceSeconds: number;
    outroSilenceSeconds: number;
    wordsPerNarrationSection: number;
  };
  voiceover: {
    provider: string;
    baseUrl: string;
    voiceName: string;
    language: string;
    exaggeration: number;
    cfgWeight: number;
    pollIntervalMs: number;
    jobTimeoutMs: number;
  };
  visuals: {
    providers: string[];
    clipMinDurationSeconds: number;
    maxRepeatsOfSameClip: number;
    kenBurns: {
      zoomRange: [number, number];
      panRange: number;
      minSegmentSeconds: number;
      maxSegmentSeconds: number;
    };
  };
  music: {
    narrationVolumeDb: number;
    musicVolumeDb: number;
    duckingVolumeDb: number;
    duckAttackSeconds: number;
    duckReleaseSeconds: number;
  };
  subtitles: {
    fontFamily: string;
    fontSizePx: number;
    color: string;
    backgroundColor: string;
    position: string;
    fadeInMs: number;
    fadeOutMs: number;
    maxCharsPerLine: number;
  };
  branding: {
    channelName: string;
    introDurationSeconds: number;
    introText: string;
    accentColor: string;
  };
  render: {
    fps: number;
    formats: Record<string, { width: number; height: number }>;
  };
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  if (typeof base !== "object" || base === null) return (override ?? base) as T;
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(override ?? {})) {
    const overrideVal = (override as any)[key];
    const baseVal = (base as any)[key];
    if (
      overrideVal &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      baseVal &&
      typeof baseVal === "object"
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

export function loadDefaultConfig(): PipelineConfig {
  const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as PipelineConfig;
}

export function loadVideoConfig(
  overridesPath: string | null
): PipelineConfig {
  const base = loadDefaultConfig();
  if (!overridesPath || !fs.existsSync(overridesPath)) return base;
  const raw = fs.readFileSync(overridesPath, "utf-8");
  const parsed = JSON.parse(raw);
  const overrides = parsed.configOverrides ?? {};
  return deepMerge(base, overrides);
}
