import fs from "node:fs";
import path from "node:path";
import { VIDEOS_DIR } from "../lib/paths.js";
import { wordCount } from "../lib/tts-timing.js";
import type { PipelineConfig } from "../lib/config.js";
import {
  jaccardSimilarity,
  normalizeForCompare,
  shingles,
  splitIntoSentences,
} from "../lib/text-utils.js";
import { GENERIC_OPENER_PATTERNS, POLICY_KEYWORD_CATEGORIES } from "../lib/compliance-rules.js";
import { buildScriptFromText, totalScriptDuration } from "./script.js";

export interface ComplianceFinding {
  severity: "fail" | "warn" | "info";
  category: string;
  message: string;
}

export interface ComplianceReport {
  verdict: "pass" | "needs_review" | "fail";
  wordCount: number;
  estimatedDurationSeconds: number;
  /** Full projected video length (narration + distributed pauses), only computed when `config` is provided. */
  projectedTotalSeconds?: number;
  findings: ComplianceFinding[];
}

interface CorpusEntry {
  slug: string;
  text: string;
}

/** Every prior video's narration text in this channel — the corpus a new script is compared against for reused-content risk. */
function loadScriptCorpus(excludeSlug?: string): CorpusEntry[] {
  if (!fs.existsSync(VIDEOS_DIR)) return [];
  const corpus: CorpusEntry[] = [];
  for (const slug of fs.readdirSync(VIDEOS_DIR)) {
    if (slug === excludeSlug) continue;
    const scriptPath = path.join(VIDEOS_DIR, slug, "script.json");
    if (!fs.existsSync(scriptPath)) continue;
    try {
      const segments = JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as {
        type: string;
        text: string;
      }[];
      const text = segments
        .filter((s) => s.type === "narration")
        .map((s) => s.text)
        .join(" ");
      if (text.trim()) corpus.push({ slug, text });
    } catch {
      // ignore unreadable/malformed script.json — not this check's job to fix that
    }
  }
  return corpus;
}

export interface InspectScriptOptions {
  text: string;
  targetDurationSeconds?: number;
  wordsPerMinute?: number;
  /** Slug to exclude from the corpus (when re-inspecting a script already saved to videos/<slug>). */
  excludeSlug?: string;
  /** When provided along with targetDurationSeconds, the duration check simulates the real pause-fill math (buildScriptFromText) instead of comparing narration-only time against the target. */
  config?: PipelineConfig;
}

/**
 * Rule-based compliance/originality review of a script — no LLM call. Checks
 * pacing, cross-video text-reuse (Jaccard similarity against every prior
 * script in videos/), verbatim internal repetition, generic stock-meditation
 * openers, and a curated policy-keyword scan.
 */
export function inspectScript({
  text,
  targetDurationSeconds,
  wordsPerMinute = 130,
  excludeSlug,
  config,
}: InspectScriptOptions): ComplianceReport {
  const findings: ComplianceFinding[] = [];
  const words = wordCount(text);
  const estimatedDurationSeconds = Math.round((words / wordsPerMinute) * 60);
  let projectedTotalSeconds: number | undefined;

  if (targetDurationSeconds) {
    if (config) {
      // Simulate the actual pipeline: narration + distributed pauses (each
      // clamped to [minPauseSeconds, maxPauseSeconds]) — this is what the
      // finished video's real length will be, not narration time alone.
      const segments = buildScriptFromText(text, targetDurationSeconds, config);
      projectedTotalSeconds = totalScriptDuration(segments);
      const diffPct = Math.abs(projectedTotalSeconds - targetDurationSeconds) / targetDurationSeconds;
      if (diffPct > 0.15) {
        const tooShort = projectedTotalSeconds < targetDurationSeconds;
        findings.push({
          severity: "warn",
          category: "duration",
          message: `Projected total video length (~${projectedTotalSeconds}s, narration + pauses) is ${Math.round(
            diffPct * 100
          )}% ${tooShort ? "short of" : "over"} the target ${targetDurationSeconds}s — pauses are capped at ${
            config.script.maxPauseSeconds
          }s each, so they can't fully make up a large gap on their own. ${
            tooShort ? "Write more narration sections." : "Trim narration or lower --duration."
          }`,
        });
      }
    } else {
      const diffPct = Math.abs(estimatedDurationSeconds - targetDurationSeconds) / targetDurationSeconds;
      if (diffPct > 0.15) {
        findings.push({
          severity: "warn",
          category: "duration",
          message: `Estimated narration length (~${estimatedDurationSeconds}s at ${wordsPerMinute}wpm) is ${Math.round(
            diffPct * 100
          )}% off the target ${targetDurationSeconds}s (pauses are separate — this is narration only). Adjust script length if that gap is too wide.`,
        });
      }
    }
  }

  // Cross-video uniqueness — the core "reused content" check.
  const corpus = loadScriptCorpus(excludeSlug);
  const newShingles = shingles(text);
  let maxSimilarity = 0;
  let mostSimilarSlug = "";
  for (const entry of corpus) {
    const sim = jaccardSimilarity(newShingles, shingles(entry.text));
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      mostSimilarSlug = entry.slug;
    }
  }
  if (maxSimilarity > 0.5) {
    findings.push({
      severity: "fail",
      category: "reused content",
      message: `${Math.round(
        maxSimilarity * 100
      )}% text overlap with a previous script (${mostSimilarSlug}) — too similar; likely to trip YouTube's reused-content review. Rewrite substantially.`,
    });
  } else if (maxSimilarity > 0.25) {
    findings.push({
      severity: "warn",
      category: "reused content",
      message: `${Math.round(
        maxSimilarity * 100
      )}% text overlap with a previous script (${mostSimilarSlug}). Consider varying phrasing/structure further.`,
    });
  }

  // Internal repetition — exact duplicate sentences within this one script.
  const sentences = splitIntoSentences(text).map(normalizeForCompare).filter(Boolean);
  const seen = new Map<string, number>();
  for (const s of sentences) {
    seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  const repeated = [...seen.entries()].filter(([, count]) => count > 1);
  if (repeated.length > 0) {
    const [example, count] = repeated[0];
    findings.push({
      severity: "warn",
      category: "internal repetition",
      message: `${repeated.length} sentence(s) repeated verbatim within this script (e.g. "${example.slice(
        0,
        60
      )}..." x${count}). Formulaic repetition can read as templated.`,
    });
  }

  // Generic/cliché opener heuristic — checked against the first ~300 chars.
  const openingNormalized = normalizeForCompare(text.slice(0, 300));
  for (const pattern of GENERIC_OPENER_PATTERNS) {
    if (openingNormalized.includes(pattern)) {
      findings.push({
        severity: "info",
        category: "generic phrasing",
        message: `Opening closely matches a very common stock meditation phrase ("${pattern}"). Not a violation, but personalizing it strengthens the originality signal.`,
      });
      break;
    }
  }

  // Curated policy-keyword scan.
  const normalizedFull = normalizeForCompare(text);
  for (const [category, phrases] of Object.entries(POLICY_KEYWORD_CATEGORIES)) {
    for (const phrase of phrases) {
      if (normalizedFull.includes(normalizeForCompare(phrase))) {
        findings.push({
          severity: "fail",
          category,
          message: `Contains a phrase matching "${phrase}" — flagged under "${category}". Review YouTube's advertiser-friendly guidelines before publishing.`,
        });
      }
    }
  }

  const verdict: ComplianceReport["verdict"] = findings.some((f) => f.severity === "fail")
    ? "fail"
    : findings.some((f) => f.severity === "warn")
    ? "needs_review"
    : "pass";

  return { verdict, wordCount: words, estimatedDurationSeconds, projectedTotalSeconds, findings };
}

export function printComplianceReport(report: ComplianceReport): void {
  console.log(`\nWord count: ${report.wordCount} (~${report.estimatedDurationSeconds}s of narration at default pacing)`);
  if (report.projectedTotalSeconds !== undefined) {
    console.log(`Projected total video length (narration + pauses): ~${report.projectedTotalSeconds}s`);
  }
  console.log(`Verdict: ${report.verdict.toUpperCase()}\n`);
  if (report.findings.length === 0) {
    console.log("No issues found.");
    return;
  }
  for (const f of report.findings) {
    const tag = f.severity === "fail" ? "[FAIL]" : f.severity === "warn" ? "[WARN]" : "[INFO]";
    console.log(`${tag} (${f.category}) ${f.message}`);
  }
}
