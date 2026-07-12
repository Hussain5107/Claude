// Estimates spoken duration for calm-paced narration. ElevenLabs output is the
// source of truth once rendered (see voiceover.ts, which corrects segment
// durations to match actual audio length); this is only used to plan the
// script's segment structure before any audio exists.
export function estimateSpeechSeconds(text: string, wordsPerMinute = 130): number {
  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (wordCount === 0) return 0;
  const minutes = wordCount / wordsPerMinute;
  return Math.round(minutes * 60 * 10) / 10;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
