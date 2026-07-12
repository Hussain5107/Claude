import fs from "node:fs";
import path from "node:path";
import type { PipelineConfig } from "../lib/config.js";
import { generateNarrationSections } from "../lib/anthropic-client.js";
import { estimateSpeechSeconds } from "../lib/tts-timing.js";

export interface ScriptSegment {
  type: "narration" | "pause";
  text: string;
  duration: number;
  order: number;
}

export interface GenerateScriptForVideoOptions {
  theme: string;
  targetDurationSeconds: number;
  config: PipelineConfig;
  avoidRepeatingFrom?: string[];
}

/**
 * Distributes a fixed total pause budget across N gaps with natural variation
 * (not uniform), clamped to [minPauseSeconds, maxPauseSeconds] per gap.
 */
function distributePauses(
  totalPauseSeconds: number,
  gapCount: number,
  minPause: number,
  maxPause: number
): number[] {
  if (gapCount === 0) return [];
  const weights = Array.from({ length: gapCount }, () => 0.6 + Math.random() * 0.8);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / weightSum) * totalPauseSeconds);
  return raw.map((d) => Math.min(maxPause, Math.max(minPause, Math.round(d * 10) / 10)));
}

export async function generateScriptForVideo({
  theme,
  targetDurationSeconds,
  config,
  avoidRepeatingFrom,
}: GenerateScriptForVideoOptions): Promise<ScriptSegment[]> {
  const { wordsPerMinute, minPauseSeconds, maxPauseSeconds, wordsPerNarrationSection } =
    config.script;

  const narrationBudget =
    targetDurationSeconds - config.script.introSilenceSeconds - config.script.outroSilenceSeconds;
  const approxSectionSeconds = (wordsPerNarrationSection / wordsPerMinute) * 60;
  const avgPause = (minPauseSeconds + maxPauseSeconds) / 2;
  const sectionCount = Math.max(
    3,
    Math.round(narrationBudget / (approxSectionSeconds + avgPause))
  );

  const sections = await generateNarrationSections({
    theme,
    sectionCount,
    wordsPerSection: wordsPerNarrationSection,
    config,
    avoidRepeatingFrom,
  });

  const narrationDurations = sections.map((text) => estimateSpeechSeconds(text, wordsPerMinute));
  const totalNarration = narrationDurations.reduce((a, b) => a + b, 0);
  const totalPauseBudget = Math.max(
    (sections.length + 1) * minPauseSeconds,
    targetDurationSeconds - totalNarration
  );
  const pauseDurations = distributePauses(
    totalPauseBudget,
    sections.length + 1,
    minPauseSeconds,
    maxPauseSeconds
  );

  const segments: ScriptSegment[] = [];
  let order = 0;

  segments.push({ type: "pause", text: "", duration: pauseDurations[0], order: order++ });
  sections.forEach((text, i) => {
    segments.push({ type: "narration", text, duration: narrationDurations[i], order: order++ });
    segments.push({ type: "pause", text: "", duration: pauseDurations[i + 1], order: order++ });
  });

  return segments;
}

export function writeScriptFile(scriptPath: string, segments: ScriptSegment[]): void {
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, JSON.stringify(segments, null, 2));
}

export function totalScriptDuration(segments: ScriptSegment[]): number {
  return Math.round(segments.reduce((sum, s) => sum + s.duration, 0) * 10) / 10;
}
