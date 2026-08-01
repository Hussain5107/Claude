import type { ExperienceLevel, Goal } from "./exercises/types";

/**
 * Cardio guidance to sit alongside the lifting plan — treadmill, bike, rower.
 *
 * The dose is goal-dependent on purpose. Long, frequent hard cardio genuinely
 * does blunt strength and muscle gain when it's stacked on top of heavy
 * lifting, so a "build muscle" plan gets less of it than a "lose fat" plan
 * rather than the same generic 30 minutes for everyone.
 */

export interface CardioPlan {
  /** Short line shown before lifting. */
  warmup: string;
  /** Optional session to do after lifting, or on a rest day. */
  session: string;
  frequency: string;
  /** Why this dose, in one plain sentence. */
  why: string;
  options: string[];
}

const OPTIONS = [
  "Treadmill — brisk walk or light incline",
  "Stationary bike — easy, steady pace",
  "Rower or elliptical",
  "Outdoors — walk, jog or cycle",
];

const PLANS: Record<Goal, Omit<CardioPlan, "options">> = {
  muscle: {
    warmup: "5 minutes easy, just enough to raise your temperature",
    session: "15–20 minutes at a conversational pace",
    frequency: "1–2× a week, ideally not before a leg day",
    why: "Kept short and easy so it doesn't eat into the recovery your muscle growth depends on.",
  },
  strength: {
    warmup: "5 minutes very easy — save your legs for the bar",
    session: "10–15 minutes easy, on non-lifting days",
    frequency: "1–2× a week, on rest days",
    why: "Minimal by design: hard cardio close to heavy sessions makes the bar feel heavier.",
  },
  fat_loss: {
    warmup: "5–8 minutes to get properly warm",
    session: "25–35 minutes at a steady, sustainable pace",
    frequency: "3–4× a week, after lifting or on rest days",
    why: "The bigger dose here is the point — it adds to your daily burn without wrecking recovery.",
  },
  general_fitness: {
    warmup: "5 minutes easy",
    session: "20–30 minutes at a comfortable pace",
    frequency: "2–3× a week",
    why: "Enough to build real aerobic fitness alongside the lifting.",
  },
};

export function cardioPlan(goal: Goal, experience: ExperienceLevel): CardioPlan {
  const base = PLANS[goal] ?? PLANS.general_fitness;
  return {
    ...base,
    // Beginners get the gentler end of every range regardless of goal.
    session:
      experience === "beginner"
        ? base.session.replace(/(\d+)–(\d+)/, (_, lo) => `${lo}`)
        : base.session,
    options: OPTIONS,
  };
}
