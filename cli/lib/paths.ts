import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolves to the repo root regardless of which cwd the CLI is invoked from.
export const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const SHARED_DIR = path.join(ROOT_DIR, "shared");
export const ASSETS_DIR = path.join(ROOT_DIR, "assets");
export const CACHE_DIR = path.join(ROOT_DIR, "cache");
export const VIDEOS_DIR = path.join(ROOT_DIR, "videos");
export const LOGS_DIR = path.join(ROOT_DIR, "logs");
// Remotion's render/dev server only serves files from the project ROOT's
// public/ folder (resolved from the nearest package.json), regardless of
// which video's remotion/index.ts is passed as the entry point. Assets are
// staged here per-slug right before rendering — see render.ts syncAssetsToPublic().
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");

export const DEFAULT_CONFIG_PATH = path.join(
  SHARED_DIR,
  "config",
  "default.config.json"
);

export function videoDir(slug: string): string {
  return path.join(VIDEOS_DIR, slug);
}

/**
 * Converts an OS-native relative path to forward-slash form. Required
 * whenever a path is going to be embedded in a URL (e.g. Remotion's
 * staticFile()) rather than used for local filesystem access — on Windows,
 * path.relative()/path.join() produce backslash-separated paths, which are
 * not valid URL path separators and get percent-encoded literally (%5C)
 * instead of being treated as directory separators, breaking asset loading.
 */
export function toUrlPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export function videoPaths(slug: string) {
  const base = videoDir(slug);
  return {
    base,
    config: path.join(base, "video.config.json"),
    script: path.join(base, "script.json"),
    notes: path.join(base, "notes.md"),
    audio: {
      dir: path.join(base, "audio"),
      segments: path.join(base, "audio", "segments"),
      narration: path.join(base, "audio", "narration.wav"),
      music: path.join(base, "audio", "music.mp3"),
      mixed: path.join(base, "audio", "mixed.wav"),
    },
    visuals: {
      dir: path.join(base, "visuals"),
      downloaded: path.join(base, "visuals", "downloaded"),
      custom: path.join(base, "visuals", "custom"),
      manifest: path.join(base, "visuals", "manifest.json"),
    },
    subtitles: {
      dir: path.join(base, "subtitles"),
      srt: path.join(base, "subtitles", "captions.srt"),
      json: path.join(base, "subtitles", "captions.json"),
    },
    remotion: {
      dir: path.join(base, "remotion"),
      root: path.join(base, "remotion", "Root.tsx"),
      composition: path.join(base, "remotion", "Composition.tsx"),
      config: path.join(base, "remotion", "remotion.config.ts"),
    },
    out: path.join(base, "out"),
  };
}
