import fs from "node:fs";
import path from "node:path";
import type { ScriptSegment } from "./script.js";
import type { PipelineConfig } from "../lib/config.js";
import { synthesizeSegment } from "../lib/elevenlabs-client.js";
import {
  concatAudioFiles,
  generateSilence,
  getAudioDurationSeconds,
} from "../lib/audio-utils.js";

export interface RenderVoiceoverOptions {
  segments: ScriptSegment[];
  segmentsDir: string;
  narrationOutPath: string;
  config: PipelineConfig;
}

/**
 * Synthesizes each narration segment via ElevenLabs, generates silence for
 * each pause segment, then concatenates everything in script order. Segment
 * durations are corrected in-place to the actual rendered audio length so
 * downstream subtitle/visual timing stays in sync with real narration speed.
 */
export async function renderVoiceover({
  segments,
  segmentsDir,
  narrationOutPath,
  config,
}: RenderVoiceoverOptions): Promise<void> {
  fs.mkdirSync(segmentsDir, { recursive: true });
  const segmentFiles: string[] = [];

  for (const segment of segments) {
    const filePath = path.join(
      segmentsDir,
      `${String(segment.order).padStart(3, "0")}-${segment.type}.${
        segment.type === "narration" ? "mp3" : "wav"
      }`
    );

    if (segment.type === "narration") {
      await synthesizeSegment({ text: segment.text, outPath: filePath, config });
    } else {
      await generateSilence(segment.duration, filePath);
    }

    segment.duration = await getAudioDurationSeconds(filePath);
    segmentFiles.push(filePath);
  }

  await concatAudioFiles(segmentFiles, narrationOutPath);
}
