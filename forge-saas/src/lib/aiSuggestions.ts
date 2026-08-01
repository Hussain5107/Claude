/**
 * Reads exercise swaps out of an AI assistant's reply.
 *
 * The exported file asks the assistant to end with a ```forge-swaps block, but
 * assistants are inconsistent, so this is written to fail quietly: anything it
 * can't parse is simply skipped, and the user still sees the assistant's full
 * text. Nothing here decides anything — every parsed swap is validated against
 * the user's real program afterwards, and applied only if they tap approve.
 */

export interface ParsedSwap {
  dayName: string;
  fromName: string;
  toName: string;
}

const BLOCK = /```\s*forge-swaps\s*\n([\s\S]*?)```/i;

export function parseSwapBlock(text: string): ParsedSwap[] {
  const match = text.match(BLOCK);
  // Fall back to scanning the whole reply: assistants often describe the swaps
  // correctly but forget to fence them.
  const body = match ? match[1] : text;

  const swaps: ParsedSwap[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.replace(/^[-*\d.\s]+/, "").trim();
    if (!line) continue;

    const [dayPart, swapPart] = splitOnce(line, "|");
    if (!swapPart) continue;

    const [fromPart, toPart] = splitOnce(swapPart, /->|→/);
    if (!toPart) continue;

    const dayName = dayPart.trim();
    const fromName = fromPart.trim();
    const toName = toPart.trim();
    if (!dayName || !fromName || !toName) continue;
    if (dayName.length > 60 || fromName.length > 80 || toName.length > 80) continue;

    swaps.push({ dayName, fromName, toName });
  }

  // De-duplicate — assistants often restate the block in prose as well.
  const seen = new Set<string>();
  return swaps.filter((s) => {
    const key = `${s.dayName}|${s.fromName}|${s.toName}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitOnce(input: string, separator: string | RegExp): [string, string | null] {
  const source = typeof separator === "string" ? escapeRegExp(separator) : separator.source;
  const match = input.match(new RegExp(source));
  if (!match || match.index === undefined) return [input, null];
  return [
    input.slice(0, match.index),
    input.slice(match.index + match[0].length),
  ];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Loose match so "Incline DB Press" still finds "Incline Dumbbell Press". */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/\bbb\b/g, "barbell")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
