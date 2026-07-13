import fs from "node:fs";
import path from "node:path";
import { loadVideoConfig } from "../lib/config.js";
import { ASSETS_DIR, videoPaths } from "../lib/paths.js";
import type { GeneratedMetadata } from "../lib/anthropic-client.js";
import { scaffoldVideo } from "./create.js";
import {
  buildScriptFromText,
  generateScriptForVideo,
  scriptDurationInFrames,
  totalScriptDuration,
  writeScriptFile,
  type ScriptSegment,
} from "./script.js";
import { renderVoiceover } from "./voiceover.js";
import { buildVisualManifest } from "./visuals.js";
import { mixMusicUnderNarration } from "./music.js";
import { buildCaptions, writeSubtitleFiles } from "./subtitles.js";
import { renderVideo } from "./render.js";
import { buildAndWriteMetadata } from "./metadata.js";
import { inspectScript, type ComplianceReport } from "./inspect.js";
import { todayISODate, themeSlugOnly } from "../lib/slugify.js";

export interface RunPipelineOptions {
  theme: string;
  targetDurationSeconds: number;
  formats: Array<"horizontal" | "vertical">;
  musicPath?: string;
  /** Skip Claude script generation and use this text instead (paragraphs = narration sections). */
  scriptText?: string;
  /** Skip the automatic compliance check on scriptText. */
  skipInspection?: boolean;
  /** Skip Claude metadata generation and use this instead. */
  manualMetadata?: GeneratedMetadata;
}

export type PipelineEvent =
  | { type: "step"; step: number; total: number; label: string }
  | { type: "inspection"; report: ComplianceReport }
  | { type: "inspection-failed" }
  | { type: "voiceover-progress"; done: number; total: number }
  | { type: "render-progress"; format: string; framesDone: number; framesTotal: number }
  | { type: "output"; path: string }
  | { type: "done"; slug: string; outputs: string[]; metadataPath: string };

export class InspectionFailedError extends Error {
  constructor(public report: ComplianceReport) {
    super("Compliance check failed — fix the issues before generating.");
  }
}

const TOTAL_STEPS = 8;

/**
 * Runs the full theme/script -> finished video(s) + metadata pipeline. Shared
 * by the CLI (`meditate create`) and the local web UI so both drive the exact
 * same logic — only how progress is reported differs, via onEvent.
 */
export async function runPipeline(
  options: RunPipelineOptions,
  onEvent: (event: PipelineEvent) => void
): Promise<{ slug: string; outputs: string[]; metadataPath: string }> {
  const { theme, targetDurationSeconds, formats, musicPath, scriptText, skipInspection, manualMetadata } =
    options;

  onEvent({ type: "step", step: 1, total: TOTAL_STEPS, label: `Scaffolding video folder for "${theme}"` });
  const { slug, paths } = scaffoldVideo({ theme, targetDurationSeconds });

  const config = loadVideoConfig(paths.config);

  let segments: ScriptSegment[];
  if (scriptText) {
    onEvent({ type: "step", step: 2, total: TOTAL_STEPS, label: "Using manually-provided script" });
    if (!skipInspection) {
      const report = inspectScript({ text: scriptText, targetDurationSeconds, excludeSlug: slug, config });
      onEvent({ type: "inspection", report });
      if (report.verdict === "fail") {
        onEvent({ type: "inspection-failed" });
        throw new InspectionFailedError(report);
      }
    }
    segments = buildScriptFromText(scriptText, targetDurationSeconds, config);
  } else {
    onEvent({
      type: "step",
      step: 2,
      total: TOTAL_STEPS,
      label: `Generating original narration script (~${targetDurationSeconds}s)`,
    });
    segments = await generateScriptForVideo({ theme, targetDurationSeconds, config });
  }
  writeScriptFile(paths.script, segments);

  onEvent({ type: "step", step: 3, total: TOTAL_STEPS, label: "Synthesizing narration voiceover via Zahra Studio" });
  await renderVoiceover({
    segments,
    segmentsDir: paths.audio.segments,
    narrationOutPath: paths.audio.narration,
    config,
    onSegmentDone: (done, total) => onEvent({ type: "voiceover-progress", done, total }),
  });
  writeScriptFile(paths.script, segments); // durations corrected to actual audio length

  onEvent({ type: "step", step: 4, total: TOTAL_STEPS, label: `Selecting background visuals for "${theme}"` });
  const totalNarrationDuration = totalScriptDuration(segments);
  await buildVisualManifest({
    theme,
    totalDurationSeconds: totalNarrationDuration,
    videoBaseDir: paths.base,
    customDir: paths.visuals.custom,
    downloadedDir: paths.visuals.downloaded,
    manifestPath: paths.visuals.manifest,
    slug,
    config,
  });

  onEvent({ type: "step", step: 5, total: TOTAL_STEPS, label: "Mixing ambient music under narration" });
  await mixMusicUnderNarration({
    narrationPath: paths.audio.narration,
    musicLibraryDir: path.join(ASSETS_DIR, "music"),
    musicTrackPath: musicPath,
    mixedOutPath: paths.audio.mixed,
    config,
  });

  onEvent({ type: "step", step: 6, total: TOTAL_STEPS, label: "Generating subtitles" });
  const captions = buildCaptions(segments);
  writeSubtitleFiles(paths.subtitles.srt, paths.subtitles.json, captions);

  onEvent({ type: "step", step: 7, total: TOTAL_STEPS, label: "Rendering final video(s) with Remotion" });
  const filenameStem = `${themeSlugOnly(theme)}_${targetDurationSeconds}s_${todayISODate()}`;
  const outputs = await renderVideo({
    slug,
    remotionDir: paths.remotion.dir,
    outDir: paths.out,
    audioDir: paths.audio.dir,
    visualsDir: paths.visuals.dir,
    filenameStem,
    formats,
    fps: config.render.fps,
    durationInFrames: scriptDurationInFrames(segments, config.render.fps),
    onRenderProgress: (format, framesDone, framesTotal) =>
      onEvent({ type: "render-progress", format, framesDone, framesTotal }),
  });
  outputs.forEach((p) => onEvent({ type: "output", path: p }));

  onEvent({
    type: "step",
    step: 8,
    total: TOTAL_STEPS,
    label: manualMetadata ? "Using manually-provided metadata" : "Generating YouTube metadata",
  });
  const metadataPath = path.join(paths.out, `${filenameStem}_metadata.txt`);
  await buildAndWriteMetadata({
    theme,
    segments,
    durationSeconds: totalNarrationDuration,
    config,
    outPath: metadataPath,
    manualMetadata,
  });

  onEvent({ type: "done", slug, outputs, metadataPath });
  return { slug, outputs, metadataPath };
}

export interface ResumeRenderOptions {
  /** The videos/<slug> folder name of an existing, partially-completed run. */
  slug: string;
  formats: Array<"horizontal" | "vertical">;
  manualMetadata?: GeneratedMetadata;
}

/**
 * Re-runs only the render + metadata steps for a video whose script,
 * voiceover, visuals, music, and subtitles were already generated —
 * for recovering from a failure after the slow voiceover step without
 * re-synthesizing it. Reads theme/duration back from the video's own
 * video.config.json, so no need to re-supply them.
 */
export async function resumeRenderAndMetadata(
  options: ResumeRenderOptions,
  onEvent: (event: PipelineEvent) => void
): Promise<{ slug: string; outputs: string[]; metadataPath: string }> {
  const { slug, formats, manualMetadata } = options;
  const paths = videoPaths(slug);

  if (!fs.existsSync(paths.script)) {
    throw new Error(`No script.json found for "${slug}" — nothing to resume from.`);
  }
  if (!fs.existsSync(paths.audio.mixed)) {
    throw new Error(
      `No mixed audio found for "${slug}" (audio/mixed.wav) — voiceover/music steps didn't finish. Run "create" again instead of "resume".`
    );
  }
  if (!fs.existsSync(paths.visuals.manifest)) {
    throw new Error(
      `No visuals manifest found for "${slug}" — the visuals step didn't finish. Run "create" again instead of "resume".`
    );
  }

  const videoConfigRaw = JSON.parse(fs.readFileSync(paths.config, "utf-8"));
  const theme: string = videoConfigRaw.theme;
  const targetDurationSeconds: number = videoConfigRaw.targetDurationSeconds;
  const config = loadVideoConfig(paths.config);
  const segments: ScriptSegment[] = JSON.parse(fs.readFileSync(paths.script, "utf-8"));
  const totalNarrationDuration = totalScriptDuration(segments);

  onEvent({ type: "step", step: 7, total: TOTAL_STEPS, label: "Rendering final video(s) with Remotion" });
  const filenameStem = `${themeSlugOnly(theme)}_${targetDurationSeconds}s_${todayISODate()}`;
  const outputs = await renderVideo({
    slug,
    remotionDir: paths.remotion.dir,
    outDir: paths.out,
    audioDir: paths.audio.dir,
    visualsDir: paths.visuals.dir,
    filenameStem,
    formats,
    fps: config.render.fps,
    durationInFrames: scriptDurationInFrames(segments, config.render.fps),
    onRenderProgress: (format, framesDone, framesTotal) =>
      onEvent({ type: "render-progress", format, framesDone, framesTotal }),
  });
  outputs.forEach((p) => onEvent({ type: "output", path: p }));

  onEvent({
    type: "step",
    step: 8,
    total: TOTAL_STEPS,
    label: manualMetadata ? "Using manually-provided metadata" : "Generating YouTube metadata",
  });
  const metadataPath = path.join(paths.out, `${filenameStem}_metadata.txt`);
  await buildAndWriteMetadata({
    theme,
    segments,
    durationSeconds: totalNarrationDuration,
    config,
    outPath: metadataPath,
    manualMetadata,
  });

  onEvent({ type: "done", slug, outputs, metadataPath });
  return { slug, outputs, metadataPath };
}
