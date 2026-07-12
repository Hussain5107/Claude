#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { loadDefaultConfig } from "./lib/config.js";
import type { GeneratedMetadata } from "./lib/anthropic-client.js";
import { inspectScript, printComplianceReport } from "./commands/inspect.js";
import {
  InspectionFailedError,
  resumeRenderAndMetadata,
  runPipeline,
  type PipelineEvent,
} from "./commands/pipeline.js";

function consoleOnEvent(event: PipelineEvent): void {
  switch (event.type) {
    case "step":
      console.log(`\n[${event.step}/${event.total}] ${event.label}...`);
      break;
    case "inspection":
      printComplianceReport(event.report);
      break;
    case "inspection-failed":
      console.error(
        "\nCompliance check failed — fix the issues above before generating, or re-run with --skip-inspection."
      );
      break;
    case "voiceover-progress":
      process.stdout.write(`      -> segment ${event.done}/${event.total} done\r`);
      break;
    case "render-progress":
      process.stdout.write(`      -> [${event.format}] frame ${event.framesDone}/${event.framesTotal}\r`);
      break;
    case "output":
      console.log(`      -> ${event.path}`);
      break;
    case "done":
      console.log(`\nDone. Video ready in videos/${event.slug}/out/\n`);
      break;
  }
}

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

    const scriptText = opts.scriptFile
      ? fs.readFileSync(path.resolve(opts.scriptFile), "utf-8")
      : undefined;
    const manualMetadata: GeneratedMetadata | undefined = opts.metadataFile
      ? JSON.parse(fs.readFileSync(path.resolve(opts.metadataFile), "utf-8"))
      : undefined;

    try {
      await runPipeline(
        {
          theme,
          targetDurationSeconds,
          formats,
          musicPath: opts.music,
          scriptText,
          skipInspection: opts.skipInspection,
          manualMetadata,
        },
        consoleOnEvent
      );
    } catch (err) {
      if (err instanceof InspectionFailedError) {
        process.exitCode = 1;
        return;
      }
      throw err;
    }
  });

program
  .command("resume")
  .description(
    "Re-run only the render + metadata steps for a video whose script/voiceover/visuals/music/subtitles " +
      "already finished — recovers from a render failure without re-synthesizing voiceover"
  )
  .argument("<slug>", "The videos/<slug> folder name to resume (e.g. morning-gratitude-meditation-2026-07-12)")
  .option(
    "-f, --format <format>",
    "Output format: both | 16x9 | 9x16",
    "both"
  )
  .option(
    "--metadata-file <path>",
    "Use manually-provided metadata instead of generating it via Claude " +
      '(JSON file: {"title", "description", "tags": [...], "chapterTitles": [...]})'
  )
  .action(async (slug: string, opts) => {
    const formats: Array<"horizontal" | "vertical"> =
      opts.format === "16x9" ? ["horizontal"] : opts.format === "9x16" ? ["vertical"] : ["horizontal", "vertical"];
    const manualMetadata: GeneratedMetadata | undefined = opts.metadataFile
      ? JSON.parse(fs.readFileSync(path.resolve(opts.metadataFile), "utf-8"))
      : undefined;

    await resumeRenderAndMetadata({ slug, formats, manualMetadata }, consoleOnEvent);
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

program
  .command("web")
  .description("Launch the local web UI (paste script, inspect, generate, watch progress)")
  .option("-p, --port <port>", "Port to listen on", "4300")
  .action(async (opts) => {
    const { startWebServer } = await import("../web/server.js");
    await startWebServer(parseInt(opts.port, 10));
  });

program.parseAsync(process.argv);
