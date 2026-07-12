import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { PUBLIC_DIR } from "../lib/paths.js";

const execFileAsync = promisify(execFile);

export interface RenderVideoOptions {
  slug: string;
  remotionDir: string;
  outDir: string;
  audioDir: string;
  visualsDir: string;
  /** Filename stem, e.g. "morning-gratitude_900s_2026-07-12" — format suffix is appended per render. */
  filenameStem: string;
  formats?: Array<"horizontal" | "vertical">;
}

const FORMAT_SUFFIX: Record<string, string> = {
  horizontal: "16x9",
  vertical: "9x16",
};

/**
 * Remotion's render/dev server resolves the `public/` folder relative to the
 * detected project ROOT (nearest package.json) — not relative to whichever
 * video's remotion/index.ts is passed as the entry point, and not a per-video
 * `remotion/public/` folder. Stage this video's finalized audio and visuals
 * under public/<slug>/ once, right before rendering, so Root.tsx's
 * staticFile('<slug>/audio/...') / staticFile('<slug>/visuals/...')
 * references resolve. Scoping by slug keeps concurrent/successive videos
 * from clobbering each other's staged assets.
 */
export function syncAssetsToPublic({
  slug,
  audioDir,
  visualsDir,
}: {
  slug: string;
  audioDir: string;
  visualsDir: string;
}): void {
  const stagingDir = path.join(PUBLIC_DIR, slug);
  fs.cpSync(audioDir, path.join(stagingDir, "audio"), { recursive: true });
  fs.cpSync(visualsDir, path.join(stagingDir, "visuals"), { recursive: true });
}

/**
 * Renders both the 16:9 (YouTube long-form) and 9:16 (Shorts) compositions
 * via the Remotion CLI, using the video's own remotion.config.ts.
 */
export async function renderVideo({
  slug,
  remotionDir,
  outDir,
  audioDir,
  visualsDir,
  filenameStem,
  formats = ["horizontal", "vertical"],
}: RenderVideoOptions): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  syncAssetsToPublic({ slug, audioDir, visualsDir });
  const outputPaths: string[] = [];

  for (const format of formats) {
    const outPath = path.join(outDir, `${filenameStem}_${FORMAT_SUFFIX[format]}.mp4`);
    await execFileAsync(
      "npx",
      ["remotion", "render", "index.ts", format, outPath],
      { cwd: remotionDir, maxBuffer: 1024 * 1024 * 64 }
    );
    outputPaths.push(outPath);
  }

  return outputPaths;
}
