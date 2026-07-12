export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitIntoSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g);
  return (sentences ?? [text]).map((s) => s.trim()).filter(Boolean);
}

export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Word-level n-gram set, used for Jaccard-similarity comparison between scripts. */
export function shingles(text: string, n = 6): Set<string> {
  const words = normalizeForCompare(text).split(" ").filter(Boolean);
  const result = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    result.add(words.slice(i, i + n).join(" "));
  }
  return result;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
