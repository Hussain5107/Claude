#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { loadDefaultConfig, loadVideoConfig } from "./lib/config.js";
import { ASSETS_DIR } from "./lib/paths.js";
import { scaffoldVideo } from "./commands/create.js";
import {
  buildScriptFromText,
  generateScriptForVideo,
  totalScriptDuration,
  writeScriptFile,
} from "./commands/script.js";
import { renderVoiceover } from "./commands/voiceover.js";
import { buildVisualManifest } from "./commands/visuals.js";
import { mixMusicUnderNarration } from "./commands/music.js";
import { buildCaptions, writeSubtitleFiles } from "./commands/subtitles.js";
import { renderVideo } from "./commands/render.js";
import { buildAndWriteMetadata } from "./commands/metadata.js";
import type { GeneratedMetadata } from "./lib/anthropic-client.js";
import { inspectScript, printComplianceReport } from "./commands/inspect.js";
import { todayISODate, themeSlugOnly } from "./lib/slugify.js";

const program = new Command();

program
  .name("meditate")
  .description("Generate an original guided meditation video end-to-end")
  .version("1.0.0");

program
  .command("create")
  .description("Generate a full meditation video from a theme")
  .argument("<theme>", 'Meditation theme, e.g. "morning gratitude meditation"')
  .option("-d, --duration <seconds>", "Target duration in seconds", "900")
  .option(
    "-f, --format <format>",
    "Output format: both | 16x9 | 9x16",
    "both"
  )
  .option("--music <path>", "Path to a specific music track to use")
  .option(
    "--script-file <path>",
    "Use a manually-written script instead of generating one via Claude " +
      "(plain text, paragraphs separated by a blank line = narration sections)"
  )
  .option(
    "--skip-inspection",
    "Skip the automatic compliance check on --script-file (not recommended)"
  )
  .option(
    "--metadata-file <path>",
    "Use manually-provided metadata instead of generating it via Claude " +
      '(JSON file: {"title", "description", "tags": [...], "chapterTitles": [...]})'
  )
  .action(async (theme: string, opts) => {
    const targetDurationSeconds = parseInt(opts.duration, 10);
    const formats: Array<"horizontal" | "vertical"> =
      opts.format === "16x9" ? ["horizontal"] : opts.format === "9x16" ? ["vertical"] : ["horizontal", "vertical"];

    console.log(`\n[1/8] Scaffolding video folder for "${theme}"...`);
    const { slug, paths } = scaffoldVideo({ theme, targetDurationSeconds });
    console.log(`      -> videos/${slug}`);

    const config = loadVideoConfig(paths.config);

    let segments;
    if (opts.scriptFile) {
      console.log(`[2/8] Using manually-provided script: ${opts.scriptFile}`);
      const scriptText = fs.readFileSync(path.resolve(opts.scriptFile), "utf-8");
      if (!opts.skipInspection) {
        const report = inspectScript({ text: scriptText, targetDurationSeconds, excludeSlug: slug, config });
        printComplianceReport(report);
        if (report.verdict === "fail") {
          console.error(
            "\nCompliance check failed — fix the issues above before generating, or re-run with --skip-inspection."
          );
          process.exitCode = 1;
          return;
        }
      }
      segments = buildScriptFromText(scriptText, targetDurationSeconds, config);
    } else {
      console.log(`[2/8] Generating original narration script (~${targetDurationSeconds}s)...`);
      segments = await generateScriptForVideo({ theme, targetDurationSeconds, config });
    }
    writeScriptFile(paths.script, segments);
    const actualScriptDuration = totalScriptDuration(segments);
    console.log(`      -> ${segments.length} segments, ~${actualScriptDuration}s planned`);

    console.log(`[3/8] Synthesizing narration voiceover via Zahra Studio...`);
    await renderVoiceover({
      segments,
      segmentsDir: paths.audio.segments,
      narrationOutPath: paths.audio.narration,
      config,
    });
    writeScriptFile(paths.script, segments); // durations corrected to actual audio length
    console.log(`      -> ${paths.audio.narration}`);

    console.log(`[4/8] Selecting background visuals for "${theme}"...`);
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
    console.log(`      -> ${paths.visuals.manifest}`);

    console.log(`[5/8] Mixing ambient music under narration...`);
    await mixMusicUnderNarration({
      narrationPath: paths.audio.narration,
      musicLibraryDir: path.join(ASSETS_DIR, "music"),
      musicTrackPath: opts.music,
      mixedOutPath: paths.audio.mixed,
      config,
    });
    console.log(`      -> ${paths.audio.mixed}`);

    console.log(`[6/8] Generating subtitles...`);
    const captions = buildCaptions(segments);
    writeSubtitleFiles(paths.subtitles.srt, paths.subtitles.json, captions);
    console.log(`      -> ${captions.length} caption cues`);

    console.log(`[7/8] Rendering final video(s) with Remotion...`);
    const filenameStem = `${themeSlugOnly(theme)}_${targetDurationSeconds}s_${todayISODate()}`;
    const outputs = await renderVideo({
      slug,
      remotionDir: paths.remotion.dir,
      outDir: paths.out,
      audioDir: paths.audio.dir,
      visualsDir: paths.visuals.dir,
      filenameStem,
      formats,
    });
    outputs.forEach((p) => console.log(`      -> ${p}`));

    let manualMetadata: GeneratedMetadata | undefined;
    if (opts.metadataFile) {
      console.log(`[8/8] Using manually-provided metadata: ${opts.metadataFile}`);
      manualMetadata = JSON.parse(fs.readFileSync(path.resolve(opts.metadataFile), "utf-8"));
    } else {
      console.log(`[8/8] Generating YouTube metadata...`);
    }
    const metadataPath = path.join(paths.out, `${filenameStem}_metadata.txt`);
    await buildAndWriteMetadata({
      theme,
      segments,
      durationSeconds: totalNarrationDuration,
      config,
      outPath: metadataPath,
      manualMetadata,
    });
    console.log(`      -> ${metadataPath}`);

    console.log(`\nDone. Video ready in videos/${slug}/out/\n`);
  });

program
  .command("inspect")
  .description(
    "Review a manually-written script for YouTube policy compliance and originality (no API calls)"
  )
  .argument("<file>", "Path to a plain-text script file")
  .option("-d, --duration <seconds>", "Target duration in seconds, to sanity-check narration pacing")
  .action((file: string, opts) => {
    const text = fs.readFileSync(path.resolve(file), "utf-8");
    const targetDurationSeconds = opts.duration ? parseInt(opts.duration, 10) : undefined;
    const report = inspectScript({
      text,
      targetDurationSeconds,
      config: targetDurationSeconds ? loadDefaultConfig() : undefined,
    });
    printComplianceReport(report);
    if (report.verdict === "fail") process.exitCode = 1;
  });

program.parseAsync(process.argv);
