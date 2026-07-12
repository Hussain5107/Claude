import Anthropic from "@anthropic-ai/sdk";
import type { PipelineConfig } from "./config.js";

const SECTIONS_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["sections"],
  additionalProperties: false,
};

export interface GenerateScriptOptions {
  theme: string;
  sectionCount: number;
  wordsPerSection: number;
  config: PipelineConfig;
  /** Prior video summaries for this theme family, so Claude avoids repeating phrasing/structure. */
  avoidRepeatingFrom?: string[];
}

/**
 * Generates original narration text for a meditation script. Each call produces
 * fresh wording (never a template), which is what lets every video in the
 * channel pass as distinct, non-reused content under manual review.
 */
export async function generateNarrationSections({
  theme,
  sectionCount,
  wordsPerSection,
  config,
  avoidRepeatingFrom = [],
}: GenerateScriptOptions): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
  const client = new Anthropic({ apiKey });

  const avoidance =
    avoidRepeatingFrom.length > 0
      ? `\n\nThis channel has already published meditations with these opening lines — write something with different wording, imagery, and structure than each of these:\n${avoidRepeatingFrom
          .map((s, i) => `${i + 1}. "${s}"`)
          .join("\n")}`
      : "";

  const prompt = `Write an original guided meditation script on the theme: "${theme}".

Return exactly ${sectionCount} narration sections, each roughly ${wordsPerSection} words (spoken calmly at ~130 words/minute). Sections should flow as a continuous guided meditation from grounding/settling in, through the core theme, to a gentle close — but each section will be separated by a silent pause in the final audio, so each section should read naturally as a standalone spoken passage that doesn't depend on the listener having just heard a sentence cut off.

Write in second person, present tense, calm and unhurried. Use concrete sensory language rather than generic affirmations. Do not use headings, stage directions, or bracketed notes — only the words to be spoken aloud.${avoidance}`;

  const response = await client.messages.create({
    model: config.script.model,
    max_tokens: 8000,
    output_config: {
      format: { type: "json_schema", schema: SECTIONS_SCHEMA },
    },
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Anthropic response contained no text block");
  }
  const parsed = JSON.parse(textBlock.text) as { sections: string[] };
  if (!parsed.sections || parsed.sections.length === 0) {
    throw new Error("Anthropic response did not include narration sections");
  }
  return parsed.sections;
}

const METADATA_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    chapterTitles: { type: "array", items: { type: "string" } },
  },
  required: ["title", "description", "tags", "chapterTitles"],
  additionalProperties: false,
};

export interface GenerateMetadataOptions {
  theme: string;
  narrationSections: string[];
  durationSeconds: number;
  config: PipelineConfig;
}

export interface GeneratedMetadata {
  title: string;
  description: string;
  tags: string[];
  /** One short (2-5 word) chapter label per narration section, in order. */
  chapterTitles: string[];
}

export async function generateMetadata({
  theme,
  narrationSections,
  durationSeconds,
  config,
}: GenerateMetadataOptions): Promise<GeneratedMetadata> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
  const client = new Anthropic({ apiKey });

  const minutes = Math.round(durationSeconds / 60);
  const prompt = `You are writing YouTube metadata for a guided meditation video on the theme: "${theme}". The video is approximately ${minutes} minutes long.

Here is the narration, broken into its sections in order:
${narrationSections.map((s, i) => `Section ${i + 1}: ${s}`).join("\n\n")}

Write:
- "title": an SEO-optimized YouTube title for the meditation/wellness niche, under 70 characters, no clickbait, no emoji spam (one emoji max if natural).
- "description": a 3-5 paragraph YouTube description. Include what the meditation helps with, who it's for, and a soft call to subscribe. Optimize naturally for meditation/wellness/sleep/anxiety search terms relevant to the theme without keyword-stuffing.
- "tags": 15-25 relevant YouTube tags (lowercase, no # symbol) for meditation/wellness SEO.
- "chapterTitles": exactly ${narrationSections.length} short chapter labels (2-5 words each), one per narration section above, in order, describing what that section covers.`;

  const response = await client.messages.create({
    model: config.script.model,
    max_tokens: 4000,
    output_config: {
      format: { type: "json_schema", schema: METADATA_SCHEMA },
    },
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Anthropic response contained no text block");
  }
  return JSON.parse(textBlock.text) as GeneratedMetadata;
}
