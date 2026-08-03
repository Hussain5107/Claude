import { AVATAR_IDS } from "./types";

/**
 * Lightweight placeholder glyphs for the 12 preset avatars — no illustrated
 * artwork yet (that's imagery work, tracked separately per
 * docs/kids-mode/03-architecture-and-data.md §8: "budget for it; keep files
 * small," not a Phase 1 foundation blocker). No photo upload — presets only,
 * per docs/kids-mode/04-safety-privacy-content.md §3.
 */
const AVATAR_EMOJI: Record<string, string> = {
  "animal-1": "🐶",
  "animal-2": "🐱",
  "animal-3": "🐰",
  "animal-4": "🦊",
  "animal-5": "🐻",
  "animal-6": "🐼",
  "animal-7": "🐨",
  "animal-8": "🦁",
  "animal-9": "🐯",
  "animal-10": "🐸",
  "animal-11": "🐵",
  "animal-12": "🦄",
};

export function avatarEmoji(avatarId: string): string {
  return AVATAR_EMOJI[avatarId] ?? "🐾";
}

export const AVATAR_CHOICES: readonly { id: string; emoji: string }[] = AVATAR_IDS.map((id) => ({
  id,
  emoji: avatarEmoji(id),
}));
