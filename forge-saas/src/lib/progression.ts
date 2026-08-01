import type { ExperienceLevel } from "./exercises/types";

/**
 * Decides when someone has earned a step up from beginner to intermediate, or
 * intermediate to advanced.
 *
 * Deliberately gated on workouts actually completed as well as time elapsed.
 * Calendar time alone would promote someone who signed up three months ago,
 * trained five times, and stopped — handing them heavier volume they haven't
 * built up to. Training age is time *under the bar*, not time since signup.
 */

export interface ProgressionRule {
  next: ExperienceLevel;
  minDays: number;
  minWorkouts: number;
  label: string;
}

const RULES: Partial<Record<ExperienceLevel, ProgressionRule>> = {
  beginner: {
    next: "intermediate",
    minDays: 90,
    // ~3 sessions a week across three months.
    minWorkouts: 36,
    label: "Intermediate",
  },
  intermediate: {
    next: "advanced",
    // Advanced is a real training age, not a few consistent months — the
    // generator gives it noticeably more volume and higher RPE.
    minDays: 300,
    minWorkouts: 150,
    label: "Advanced",
  },
};

export interface ProgressionStatus {
  eligible: boolean;
  /** Null when already advanced — there's no level beyond it. */
  next: ExperienceLevel | null;
  nextLabel: string | null;
  daysTrained: number;
  workoutsDone: number;
  daysNeeded: number;
  workoutsNeeded: number;
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

export function checkProgression(
  experience: ExperienceLevel,
  accountCreatedAt: string,
  totalWorkouts: number,
  now: Date = new Date(),
): ProgressionStatus {
  const rule = RULES[experience];
  const daysTrained = daysSince(accountCreatedAt, now);

  if (!rule) {
    return {
      eligible: false,
      next: null,
      nextLabel: null,
      daysTrained,
      workoutsDone: totalWorkouts,
      daysNeeded: 0,
      workoutsNeeded: 0,
    };
  }

  return {
    eligible: daysTrained >= rule.minDays && totalWorkouts >= rule.minWorkouts,
    next: rule.next,
    nextLabel: rule.label,
    daysTrained,
    workoutsDone: totalWorkouts,
    daysNeeded: rule.minDays,
    workoutsNeeded: rule.minWorkouts,
  };
}
