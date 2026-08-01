import { categorise } from "./splits";
import type { DayTemplate, ExerciseTemplate } from "./types";

/**
 * Finds replacements for an exercise the user can't or doesn't want to do —
 * a machine is taken, something aggravates an old injury, or there's no sturdy
 * table to row under.
 *
 * Candidates only ever come from the user's own library, so a bodyweight-at-home
 * user is never offered a cable machine, and anything already scheduled that day
 * is excluded so a swap can't create a duplicate.
 *
 * Matches are tiered, because a strict same-muscle rule leaves some users with
 * nothing: the bodyweight library has only two lat exercises, and both sit in
 * the same session. Rather than offer a dead end to exactly the person who most
 * needs a swap, it widens to related muscles and then to the same movement
 * pattern — always listing the closest matches first.
 */

/** How well a candidate replaces the original. Lower is closer. */
export type MatchQuality = "same-muscle" | "related" | "same-pattern";

export interface Alternative {
  exercise: ExerciseTemplate;
  match: MatchQuality;
}

export function findAlternatives(
  library: DayTemplate[],
  current: ExerciseTemplate,
  excludeSlugs: string[] = [],
): ExerciseTemplate[] {
  return rankAlternatives(library, current, excludeSlugs).map((a) => a.exercise);
}

export function rankAlternatives(
  library: DayTemplate[],
  current: ExerciseTemplate,
  excludeSlugs: string[] = [],
): Alternative[] {
  const excluded = new Set([current.slug, ...excludeSlugs]);
  const primary = new Set(current.primary);
  const involved = new Set([...current.primary, ...current.secondary]);
  const pattern = categorise(current.primary);

  const candidates = new Map<string, ExerciseTemplate>();
  for (const day of library) {
    for (const exercise of day.exercises) {
      if (excluded.has(exercise.slug)) continue;
      candidates.set(exercise.slug, exercise);
    }
  }

  const scored: Alternative[] = [];
  for (const exercise of candidates.values()) {
    if (exercise.primary.some((m) => primary.has(m))) {
      scored.push({ exercise, match: "same-muscle" });
    } else if (
      exercise.primary.some((m) => involved.has(m)) ||
      exercise.secondary.some((m) => primary.has(m))
    ) {
      scored.push({ exercise, match: "related" });
    } else if (categorise(exercise.primary) === pattern) {
      scored.push({ exercise, match: "same-pattern" });
    }
  }

  const rank: Record<MatchQuality, number> = {
    "same-muscle": 0,
    related: 1,
    "same-pattern": 2,
  };
  const overlap = (e: ExerciseTemplate) => e.primary.filter((m) => primary.has(m)).length;

  return scored.sort(
    (a, b) =>
      rank[a.match] - rank[b.match] ||
      overlap(b.exercise) - overlap(a.exercise) ||
      // Prefer a candidate the original already names as its alternative.
      Number(b.exercise.name === current.alt) - Number(a.exercise.name === current.alt) ||
      a.exercise.name.localeCompare(b.exercise.name),
  );
}
