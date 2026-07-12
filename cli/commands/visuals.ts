import fs from "node:fs";
import path from "node:path";
import type { PipelineConfig } from "../lib/config.js";
import {
  downloadClip,
  findFreshClips,
  markClipsUsed,
  type StockClip,
} from "../lib/stock-footage-client.js";

export interface VisualManifestEntry {
  source: "custom" | "pexels" | "pixabay";
  filePath: string;
  durationSeconds: number;
  zoomDirection: "in" | "out";
  panDirection: "left" | "right" | "up" | "down";
}

export interface BuildVisualManifestOptions {
  theme: string;
  totalDurationSeconds: number;
  /** Absolute path to the video's base folder (videos/<slug>) — manifest paths are stored relative to this, for Remotion's staticFile(). */
  videoBaseDir: string;
  customDir: string;
  downloadedDir: string;
  manifestPath: string;
  slug: string;
  config: PipelineConfig;
}

const STOPWORDS = new Set([
  "a", "an", "the", "for", "and", "of", "on", "to", "with", "meditation",
]);

function themeKeywords(theme: string): string[] {
  const words = theme
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  // Always include the full theme phrase as a keyword too, plus a generic
  // "calm nature" fallback so short/abstract themes still return results.
  return [...new Set([theme, ...words, "calm nature"])];
}

function randomKenBurns(): Pick<VisualManifestEntry, "zoomDirection" | "panDirection"> {
  const zoomDirection = Math.random() > 0.5 ? "in" : "out";
  const pans: VisualManifestEntry["panDirection"][] = ["left", "right", "up", "down"];
  const panDirection = pans[Math.floor(Math.random() * pans.length)];
  return { zoomDirection, panDirection };
}

function listCustomAssets(customDir: string): string[] {
  if (!fs.existsSync(customDir)) return [];
  return fs
    .readdirSync(customDir)
    .filter((f) => /\.(mp4|mov|webm|jpg|jpeg|png)$/i.test(f))
    .map((f) => path.join(customDir, f));
}

export async function buildVisualManifest({
  theme,
  totalDurationSeconds,
  videoBaseDir,
  customDir,
  downloadedDir,
  manifestPath,
  slug,
  config,
}: BuildVisualManifestOptions): Promise<VisualManifestEntry[]> {
  const { minSegmentSeconds, maxSegmentSeconds } = config.visuals.kenBurns;
  const avgSegment = (minSegmentSeconds + maxSegmentSeconds) / 2;
  const neededClipCount = Math.max(3, Math.ceil(totalDurationSeconds / avgSegment));

  const entries: VisualManifestEntry[] = [];
  const toRelative = (absPath: string) => path.relative(videoBaseDir, absPath);

  // Prefer the user's own footage first — always original, zero API dependency.
  for (const filePath of listCustomAssets(customDir)) {
    entries.push({
      source: "custom",
      filePath: toRelative(filePath),
      durationSeconds: minSegmentSeconds + Math.random() * (maxSegmentSeconds - minSegmentSeconds),
      ...randomKenBurns(),
    });
  }

  const remaining = neededClipCount - entries.length;
  if (remaining > 0) {
    const keywords = themeKeywords(theme);
    const perKeyword = Math.max(1, Math.ceil(remaining / keywords.length));
    const stockClips: StockClip[] = [];
    for (const keyword of keywords) {
      if (stockClips.length >= remaining) break;
      const found = await findFreshClips(keyword, perKeyword);
      stockClips.push(...found);
    }

    if (stockClips.length === 0) {
      throw new Error(
        "No stock footage found. Set PEXELS_API_KEY and/or PIXABAY_API_KEY in .env, " +
          "or add your own clips to the video's visuals/custom folder."
      );
    }

    const chosen = stockClips.slice(0, remaining);
    for (const clip of chosen) {
      const filePath = await downloadClip(clip, downloadedDir);
      entries.push({
        source: clip.provider,
        filePath: toRelative(filePath),
        durationSeconds: Math.min(
          maxSegmentSeconds,
          Math.max(minSegmentSeconds, clip.durationSeconds || avgSegment)
        ),
        ...randomKenBurns(),
      });
    }
    markClipsUsed(chosen, slug);
  }

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2));
  return entries;
}
