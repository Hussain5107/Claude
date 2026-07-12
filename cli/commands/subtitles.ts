import fs from "node:fs";
import path from "node:path";
import type { ScriptSegment } from "./script.js";
import { wordCount } from "../lib/tts-timing.js";
import { splitIntoSentences } from "../lib/text-utils.js";

export interface Caption {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

/**
 * Builds one caption cue per sentence within each narration segment, with
 * timing proportional to each sentence's share of the segment's word count
 * (a reasonable approximation absent word-level TTS alignment data).
 */
export function buildCaptions(segments: ScriptSegment[]): Caption[] {
  const captions: Caption[] = [];
  let clock = 0;

  for (const segment of segments) {
    if (segment.type !== "narration") {
      clock += segment.duration;
      continue;
    }

    const sentences = splitIntoSentences(segment.text);
    const words = sentences.map(wordCount);
    const totalWords = words.reduce((a, b) => a + b, 0) || 1;

    let cursor = clock;
    sentences.forEach((sentence, i) => {
      const share = words[i] / totalWords;
      const duration = segment.duration * share;
      captions.push({
        text: sentence,
        startSeconds: Math.round(cursor * 100) / 100,
        endSeconds: Math.round((cursor + duration) * 100) / 100,
      });
      cursor += duration;
    });

    clock += segment.duration;
  }

  return captions;
}

function formatSrtTimestamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const msRem = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0"
  )},${String(msRem).padStart(3, "0")}`;
}

export function captionsToSrt(captions: Caption[]): string {
  return captions
    .map((c, i) =>
      [
        String(i + 1),
        `${formatSrtTimestamp(c.startSeconds)} --> ${formatSrtTimestamp(c.endSeconds)}`,
        c.text,
        "",
      ].join("\n")
    )
    .join("\n");
}

export function writeSubtitleFiles(
  srtPath: string,
  jsonPath: string,
  captions: Caption[]
): void {
  fs.mkdirSync(path.dirname(srtPath), { recursive: true });
  fs.writeFileSync(srtPath, captionsToSrt(captions));
  fs.writeFileSync(jsonPath, JSON.stringify(captions, null, 2));
}
