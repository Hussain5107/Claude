import fs from "node:fs";
import path from "node:path";
import type { ScriptSegment } from "./script.js";
import type { PipelineConfig } from "../lib/config.js";
import { generateMetadata } from "../lib/anthropic-client.js";

export interface BuildMetadataOptions {
  theme: string;
  segments: ScriptSegment[];
  durationSeconds: number;
  config: PipelineConfig;
  outPath: string;
}

function formatChapterTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function buildAndWriteMetadata({
  theme,
  segments,
  durationSeconds,
  config,
  outPath,
}: BuildMetadataOptions): Promise<void> {
  const narrationSegments = segments.filter((s) => s.type === "narration");

  const metadata = await generateMetadata({
    theme,
    narrationSections: narrationSegments.map((s) => s.text),
    durationSeconds,
    config,
  });

  // Chapters: YouTube requires the first entry at 0:00 and >=3 chapters total.
  let clock = 0;
  const chapters: { label: string; startSeconds: number }[] = [
    { label: "Intro", startSeconds: 0 },
  ];
  let narrationIndex = 0;
  for (const segment of segments) {
    if (segment.type === "narration") {
      if (narrationIndex > 0) {
        chapters.push({
          label: metadata.chapterTitles[narrationIndex] ?? `Part ${narrationIndex + 1}`,
          startSeconds: clock,
        });
      }
      narrationIndex++;
    }
    clock += segment.duration;
  }

  const chapterLines = chapters.map(
    (c) => `${formatChapterTimestamp(c.startSeconds)} ${c.label}`
  );

  const fileContents = [
    `Title: ${metadata.title}`,
    "",
    "Description:",
    metadata.description,
    "",
    "Chapters:",
    ...chapterLines,
    "",
    `Tags: ${metadata.tags.join(", ")}`,
  ].join("\n");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, fileContents);
}
