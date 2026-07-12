import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { videoPaths } from "../lib/paths.js";
import { slugifyTheme, todayISODate } from "../lib/slugify.js";

const TEMPLATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "remotion-video"
);

export interface ScaffoldVideoOptions {
  theme: string;
  targetDurationSeconds: number;
  configOverrides?: Record<string, unknown>;
}

export interface ScaffoldResult {
  slug: string;
  paths: ReturnType<typeof videoPaths>;
}

/**
 * Creates a fresh, isolated videos/<slug>/ directory for one meditation video
 * — its own script, audio, visuals, subtitles, and Remotion composition — so
 * nothing here can be silently reused by a later run of the pipeline.
 */
export function scaffoldVideo({
  theme,
  targetDurationSeconds,
  configOverrides = {},
}: ScaffoldVideoOptions): ScaffoldResult {
  const slug = slugifyTheme(theme, todayISODate());
  const paths = videoPaths(slug);

  for (const dir of [
    paths.base,
    paths.audio.dir,
    paths.audio.segments,
    paths.visuals.dir,
    paths.visuals.downloaded,
    paths.visuals.custom,
    paths.subtitles.dir,
    paths.remotion.dir,
    paths.out,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const file of ["Root.tsx", "Composition.tsx", "index.ts", "remotion.config.ts"]) {
    fs.copyFileSync(path.join(TEMPLATE_DIR, file), path.join(paths.remotion.dir, file));
  }

  const videoConfig = {
    theme,
    slug,
    targetDurationSeconds,
    createdAt: new Date().toISOString(),
    // Relative to the video's base folder — combined with `slug` and resolved
    // via staticFile() in Root.tsx once render.ts stages assets into public/<slug>/.
    mixedAudioPath: path.relative(paths.base, paths.audio.mixed),
    configOverrides,
  };
  fs.writeFileSync(paths.config, JSON.stringify(videoConfig, null, 2));

  if (!fs.existsSync(paths.notes)) {
    fs.writeFileSync(
      paths.notes,
      `# Notes for ${slug}\n\nUse this file to log any manual adjustments or mistakes to avoid repeating in future videos.\n`
    );
  }

  return { slug, paths };
}
