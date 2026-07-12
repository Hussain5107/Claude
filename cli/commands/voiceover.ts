import fs from "node:fs";
import path from "node:path";
import type { ScriptSegment } from "./script.js";
import type { PipelineConfig } from "../lib/config.js";
import { resolveVoiceId, synthesizeSegment } from "../lib/zahra-client.js";
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
  /** Called after each segment (narration or pause) finishes — narration segments are the slow, CPU-bound ones worth surfacing progress for. */
  onSegmentDone?: (done: number, total: number, segment: ScriptSegment) => void;
}

/**
 * Synthesizes each narration segment via a locally running Zahra Studio
 * instance (free, cloned-voice TTS — see voice_cloning_studio/ on the
 * claude/voice-note-script-generation branch), generates silence for each
 * pause segment, then concatenates everything in script order. Segment
 * durations are corrected in-place to the actual rendered audio length so
 * downstream subtitle/visual timing stays in sync with real narration speed.
 */
export async function renderVoiceover({
  segments,
  segmentsDir,
  narrationOutPath,
  config,
  onSegmentDone,
}: RenderVoiceoverOptions): Promise<void> {
  fs.mkdirSync(segmentsDir, { recursive: true });
  const segmentFiles: string[] = [];

  const baseUrl = process.env.ZAHRA_STUDIO_BASE_URL || config.voiceover.baseUrl;
  const voiceName = process.env.ZAHRA_VOICE_NAME || config.voiceover.voiceName;
  const hasNarration = segments.some((s) => s.type === "narration");
  const voiceId = hasNarration ? await resolveVoiceId(baseUrl, voiceName) : -1;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const filePath = path.join(
      segmentsDir,
      `${String(segment.order).padStart(3, "0")}-${segment.type}.wav`
    );

    if (segment.type === "narration") {
      await synthesizeSegment({ text: segment.text, outPath: filePath, voiceId, config });
    } else {
      await generateSilence(segment.duration, filePath);
    }

    segment.duration = await getAudioDurationSeconds(filePath);
    segmentFiles.push(filePath);
    onSegmentDone?.(i + 1, segments.length, segment);
  }

  await concatAudioFiles(segmentFiles, narrationOutPath);
}
