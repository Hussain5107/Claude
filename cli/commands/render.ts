import { spawn, execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PUBLIC_DIR } from "../lib/paths.js";

const execFileAsync = promisify(execFile);

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
  /** Frames per second of the composition (config.render.fps) — needed to plan chunk boundaries. */
  fps: number;
  /** Total composition length in frames — must match Root.tsx's own calculation (see scriptDurationInFrames()). */
  durationInFrames: number;
  /** Render in fixed-length chunks and concat them, so a mid-render crash only costs the failed chunk, not the whole video. Default 60s. */
  chunkSeconds?: number;
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

/**
 * Runs `remotion render` for one frame range (or the whole composition, if
 * frameRange is omitted). `onProgress` reports frame numbers already offset
 * into the full composition's frame count, not just this chunk's.
 */
function runRemotionRender(
  remotionDir: string,
  format: string,
  outPath: string,
  frameRange: [number, number] | undefined,
  onProgress?: (framesDoneInChunk: number, framesTotalInChunk: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["remotion", "render", "index.ts", format, outPath];
    if (frameRange) args.push(`--frames=${frameRange[0]}-${frameRange[1]}`);

    const child = spawn("npx", args, {
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

interface ChunkPlan {
  index: number;
  start: number;
  end: number;
}

interface ChunkState {
  durationInFrames: number;
  fps: number;
  chunkFrames: number;
  doneIndexes: number[];
}

function planChunks(durationInFrames: number, fps: number, chunkSeconds: number): ChunkPlan[] {
  const chunkFrames = Math.max(1, Math.round(chunkSeconds * fps));
  const chunks: ChunkPlan[] = [];
  let start = 0;
  let index = 0;
  while (start < durationInFrames) {
    const end = Math.min(start + chunkFrames - 1, durationInFrames - 1);
    chunks.push({ index, start, end });
    start = end + 1;
    index += 1;
  }
  return chunks;
}

function chunkFilePath(workDir: string, index: number): string {
  return path.join(workDir, `chunk-${String(index).padStart(4, "0")}.mp4`);
}

/**
 * Renders one format in fixed-length chunks (via Remotion's --frames flag),
 * tracking completed chunks in a state file under outDir/.render-work/<format>/
 * so a crash partway through only costs the in-flight chunk — a retry skips
 * every chunk already rendered and picks up where it left off. Finishes by
 * concatenating the chunks into the final MP4 with a lossless ffmpeg stream
 * copy (no re-encoding).
 */
async function renderFormatChunked(
  remotionDir: string,
  format: string,
  outPath: string,
  fps: number,
  durationInFrames: number,
  chunkSeconds: number,
  workDir: string,
  onProgress?: (framesDone: number, framesTotal: number) => void
): Promise<void> {
  const chunks = planChunks(durationInFrames, fps, chunkSeconds);
  const chunkFrames = chunks.length > 0 ? chunks[0].end - chunks[0].start + 1 : durationInFrames;
  const statePath = path.join(workDir, "state.json");

  let state: ChunkState | undefined;
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, "utf-8")) as ChunkState;
    } catch {
      state = undefined;
    }
  }
  const stateMatches =
    state &&
    state.durationInFrames === durationInFrames &&
    state.fps === fps &&
    state.chunkFrames === chunkFrames;

  if (!stateMatches) {
    // Script/config changed since a prior attempt (or no prior attempt) —
    // stale chunk files would no longer line up with the new frame ranges.
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(workDir, { recursive: true });
    state = { durationInFrames, fps, chunkFrames, doneIndexes: [] };
  }

  const doneIndexes = new Set(
    (state?.doneIndexes ?? []).filter((i) => fs.existsSync(chunkFilePath(workDir, i)))
  );

  const saveState = () => {
    fs.writeFileSync(
      statePath,
      JSON.stringify({ durationInFrames, fps, chunkFrames, doneIndexes: [...doneIndexes] }, null, 2)
    );
  };
  saveState();

  for (const chunk of chunks) {
    if (doneIndexes.has(chunk.index)) {
      onProgress?.(chunk.end + 1, durationInFrames);
      continue;
    }
    await runRemotionRender(
      remotionDir,
      format,
      chunkFilePath(workDir, chunk.index),
      [chunk.start, chunk.end],
      (done) => onProgress?.(chunk.start + done, durationInFrames)
    );
    doneIndexes.add(chunk.index);
    saveState();
  }

  const listPath = path.join(workDir, "concat-list.txt");
  const listContents = chunks
    .map((c) => `file '${chunkFilePath(workDir, c.index).replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContents);

  await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);

  // Chunks are only useful for resuming an in-progress render — once the
  // concat above has succeeded, the final MP4 is self-contained.
  fs.rmSync(workDir, { recursive: true, force: true });
}

/**
 * Renders both the 16:9 (YouTube long-form) and 9:16 (Shorts) compositions
 * via the Remotion CLI, using the video's own remotion.config.ts. Each format
 * is rendered in chunks (see renderFormatChunked) so a crash partway through
 * doesn't require re-rendering frames already completed.
 */
export async function renderVideo({
  slug,
  remotionDir,
  outDir,
  audioDir,
  visualsDir,
  filenameStem,
  formats = ["horizontal", "vertical"],
  fps,
  durationInFrames,
  chunkSeconds = 60,
  onRenderProgress,
}: RenderVideoOptions): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  refreshRemotionTemplate(remotionDir);
  syncAssetsToPublic({ slug, audioDir, visualsDir });
  const outputPaths: string[] = [];

  for (const format of formats) {
    const outPath = path.join(outDir, `${filenameStem}_${FORMAT_SUFFIX[format]}.mp4`);
    const workDir = path.join(outDir, ".render-work", format);
    await renderFormatChunked(
      remotionDir,
      format,
      outPath,
      fps,
      durationInFrames,
      chunkSeconds,
      workDir,
      (done, total) => onRenderProgress?.(format, done, total)
    );
    outputPaths.push(outPath);
  }

  return outputPaths;
}
