import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PUBLIC_DIR } from "../lib/paths.js";

const TEMPLATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "remotion-video"
);

/**
 * Each video's remotion/ folder is a one-time copy of cli/templates/remotion-video/
 * made at scaffold time (see create.ts). A `git pull` that fixes a bug in the
 * template doesn't touch already-scaffolded videos, so re-copy the template's
 * non-generated files here before every render — this way template fixes
 * (like the Windows backslash-path normalization in Root.tsx) apply
 * retroactively without the user needing to notice or re-scaffold.
 */
export function refreshRemotionTemplate(remotionDir: string): void {
  for (const file of ["Root.tsx", "Composition.tsx", "index.ts", "remotion.config.ts"]) {
    fs.copyFileSync(path.join(TEMPLATE_DIR, file), path.join(remotionDir, file));
  }
}

export interface RenderVideoOptions {
  slug: string;
  remotionDir: string;
  outDir: string;
  audioDir: string;
  visualsDir: string;
  /** Filename stem, e.g. "morning-gratitude_900s_2026-07-12" — format suffix is appended per render. */
  filenameStem: string;
  formats?: Array<"horizontal" | "vertical">;
  /** Called as Remotion prints frame-render progress for the given format. */
  onRenderProgress?: (format: string, framesDone: number, framesTotal: number) => void;
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

const RENDERED_LINE = /Rendered (\d+)\/(\d+)/;

function runRemotionRender(
  remotionDir: string,
  format: string,
  outPath: string,
  onProgress?: (framesDone: number, framesTotal: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["remotion", "render", "index.ts", format, outPath], {
      cwd: remotionDir,
      shell: process.platform === "win32",
    });

    let stderrOutput = "";
    let stdoutBuffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const match = line.match(RENDERED_LINE);
        if (match && onProgress) {
          onProgress(parseInt(match[1], 10), parseInt(match[2], 10));
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Remotion render (${format}) exited with code ${code}\n${stderrOutput}`));
    });
  });
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
  onRenderProgress,
}: RenderVideoOptions): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  refreshRemotionTemplate(remotionDir);
  syncAssetsToPublic({ slug, audioDir, visualsDir });
  const outputPaths: string[] = [];

  for (const format of formats) {
    const outPath = path.join(outDir, `${filenameStem}_${FORMAT_SUFFIX[format]}.mp4`);
    await runRemotionRender(remotionDir, format, outPath, (done, total) =>
      onRenderProgress?.(format, done, total)
    );
    outputPaths.push(outPath);
  }

  return outputPaths;
}
