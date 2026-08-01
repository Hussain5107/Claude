import type { DayTemplate, DaysPerWeek, ExerciseTemplate, MuscleKey } from "./types";

/**
 * Builds a weekly split at the frequency the user asked for, out of whichever
 * exercise library their training location selected (gym / home+dumbbells /
 * bodyweight).
 *
 * Six days returns the library's own templates untouched — that split is
 * hand-written and is what every existing user is already on, so changing
 * frequency must never quietly reshuffle their plan.
 *
 * Lower frequencies can't just drop days off a 6-day Push/Pull/Legs: training
 * chest once every seven days trains it badly. Three days becomes full-body,
 * four becomes upper/lower, five splits the difference — so each muscle still
 * gets hit roughly twice a week whatever the frequency.
 */

export type { DaysPerWeek };
export const DAYS_PER_WEEK_OPTIONS: DaysPerWeek[] = [3, 4, 5, 6];

const PUSH_MUSCLES: MuscleKey[] = ["chest", "frontDelts", "sideDelts", "triceps"];
const PULL_MUSCLES: MuscleKey[] = ["lats", "traps", "rearDelts", "biceps", "forearms"];
const LEG_MUSCLES: MuscleKey[] = ["quads", "hamstrings", "glutes", "calves"];
const CORE_MUSCLES: MuscleKey[] = ["abs", "obliques", "lowerBack"];

type Category = "push" | "pull" | "legs" | "core";

interface PooledExercise {
  exercise: ExerciseTemplate;
  category: Category;
  /** Position in its original day. The libraries list the day's main compound
   *  first, so a low index means "heavier, put this early in the session". */
  order: number;
}

function categorise(primary: MuscleKey[]): Category {
  if (primary.some((m) => CORE_MUSCLES.includes(m))) return "core";
  if (primary.some((m) => LEG_MUSCLES.includes(m))) return "legs";
  if (primary.some((m) => PULL_MUSCLES.includes(m))) return "pull";
  if (primary.some((m) => PUSH_MUSCLES.includes(m))) return "push";
  return "push";
}

/** Every distinct exercise in a library, grouped by category and ordered so the
 *  compound lifts come first. Deterministic — the same library always yields the
 *  same pool, so regenerating a plan doesn't shuffle it. */
function buildPool(library: DayTemplate[]): Record<Category, ExerciseTemplate[]> {
  const seen = new Map<string, PooledExercise>();
  for (const day of library) {
    day.exercises.forEach((exercise, index) => {
      if (seen.has(exercise.slug)) return;
      seen.set(exercise.slug, {
        exercise,
        category: categorise(exercise.primary),
        order: index,
      });
    });
  }

  const pool: Record<Category, ExerciseTemplate[]> = { push: [], pull: [], legs: [], core: [] };
  for (const item of seen.values()) pool[item.category].push(item.exercise);

  // Compounds first, then a stable alphabetical tiebreak.
  for (const category of Object.keys(pool) as Category[]) {
    const orderOf = (e: ExerciseTemplate) => seen.get(e.slug)!.order;
    pool[category].sort((a, b) => orderOf(a) - orderOf(b) || a.slug.localeCompare(b.slug));
  }
  return pool;
}

/** Pulls the next `count` exercises of a category that aren't already in today's
 *  session. The cursor keeps advancing across days so consecutive days get
 *  different movements; it wraps when a category is too small to fill every day
 *  without repeats (the bodyweight library only has a handful of real pulling
 *  movements, for instance). */
function take(
  pool: Record<Category, ExerciseTemplate[]>,
  cursors: Record<Category, number>,
  category: Category,
  count: number,
  usedToday: Set<string>,
  musclesToday: Set<MuscleKey>,
): ExerciseTemplate[] {
  const list = pool[category];
  const picked: ExerciseTemplate[] = [];
  if (list.length === 0) return picked;

  for (let n = 0; n < count; n++) {
    // Two passes. The first only accepts an exercise that trains a muscle the
    // session hasn't hit yet, so a day doesn't end up as bench press followed by
    // incline press with no shoulder or triceps work. The second pass drops that
    // requirement, for small categories where everything overlaps.
    let chosen: ExerciseTemplate | null = null;
    let chosenIndex = 0;

    for (const requireNewMuscle of [true, false]) {
      for (let offset = 0; offset < list.length; offset++) {
        const index = (cursors[category] + offset) % list.length;
        const exercise = list[index];
        if (usedToday.has(exercise.slug)) continue;
        if (requireNewMuscle && !exercise.primary.some((m) => !musclesToday.has(m))) continue;
        chosen = exercise;
        chosenIndex = index;
        break;
      }
      if (chosen) break;
    }

    if (!chosen) break;
    usedToday.add(chosen.slug);
    chosen.primary.forEach((m) => musclesToday.add(m));
    picked.push(chosen);
    // Resume after the one we took, so later days keep moving through the pool.
    cursors[category] = chosenIndex + 1;
  }
  return picked;
}

/** Warmup/cooldown blocks reused from whichever library day matches best, so
 *  the guidance still fits the equipment the user actually has. */
function blocksFor(library: DayTemplate[], prefix: string) {
  const day = library.find((d) => d.key.toLowerCase().startsWith(prefix)) ?? library[0];
  return { warmup: day.warmup, cooldown: day.cooldown };
}

function mergedBlocks(library: DayTemplate[]) {
  const legs = blocksFor(library, "legs");
  const push = blocksFor(library, "push");
  return {
    warmup: [...new Set([...legs.warmup.slice(0, 2), ...push.warmup.slice(1, 3)])],
    cooldown: [...new Set([...legs.cooldown.slice(0, 2), ...push.cooldown.slice(0, 2)])],
  };
}

interface DayPlan {
  key: string;
  name: string;
  subtitle: string;
  blocks: "push" | "pull" | "legs" | "full";
  slots: { category: Category; count: number }[];
}

const THREE_DAY: DayPlan[] = ["A", "B", "C"].map((letter) => ({
  key: `fullBody${letter}`,
  name: `Full Body ${letter}`,
  subtitle: "Full Body",
  blocks: "full",
  slots: [
    { category: "legs", count: 1 },
    { category: "push", count: 2 },
    { category: "pull", count: 2 },
    { category: "legs", count: 1 },
    { category: "core", count: 1 },
  ],
}));

const FOUR_DAY: DayPlan[] = ["A", "B"].flatMap((letter) => [
  {
    key: `upper${letter}`,
    name: `Upper ${letter}`,
    subtitle: "Chest, Back, Shoulders, Arms",
    blocks: "push" as const,
    slots: [
      { category: "push" as Category, count: 2 },
      { category: "pull" as Category, count: 2 },
      { category: "push" as Category, count: 1 },
      { category: "pull" as Category, count: 1 },
      { category: "core" as Category, count: 1 },
    ],
  },
  {
    key: `lower${letter}`,
    name: `Lower ${letter}`,
    subtitle: "Quads, Hamstrings, Glutes, Calves",
    blocks: "legs" as const,
    slots: [
      { category: "legs" as Category, count: 5 },
      { category: "core" as Category, count: 2 },
    ],
  },
]);

const FIVE_DAY: DayPlan[] = [
  {
    key: "push",
    name: "Push",
    subtitle: "Chest, Shoulders, Triceps",
    blocks: "push",
    slots: [
      { category: "push", count: 5 },
      { category: "core", count: 1 },
    ],
  },
  {
    key: "pull",
    name: "Pull",
    subtitle: "Back, Biceps, Rear Delts",
    blocks: "pull",
    slots: [
      { category: "pull", count: 5 },
      { category: "core", count: 1 },
    ],
  },
  {
    key: "legs",
    name: "Legs",
    subtitle: "Quads, Hamstrings, Glutes, Calves",
    blocks: "legs",
    slots: [
      { category: "legs", count: 5 },
      { category: "core", count: 1 },
    ],
  },
  {
    key: "upper",
    name: "Upper",
    subtitle: "Chest, Back, Shoulders, Arms",
    blocks: "push",
    slots: [
      { category: "push", count: 3 },
      { category: "pull", count: 3 },
    ],
  },
  {
    key: "lower",
    name: "Lower",
    subtitle: "Quads, Hamstrings, Glutes, Calves",
    blocks: "legs",
    slots: [
      { category: "legs", count: 4 },
      { category: "core", count: 2 },
    ],
  },
];

const PLANS: Record<Exclude<DaysPerWeek, 6>, DayPlan[]> = {
  3: THREE_DAY,
  4: FOUR_DAY,
  5: FIVE_DAY,
};

export function buildSplit(library: DayTemplate[], daysPerWeek: DaysPerWeek): DayTemplate[] {
  if (daysPerWeek === 6) return library;

  const pool = buildPool(library);
  const cursors: Record<Category, number> = { push: 0, pull: 0, legs: 0, core: 0 };

  return PLANS[daysPerWeek].map((plan, index) => {
    const usedToday = new Set<string>();
    const musclesToday = new Set<MuscleKey>();
    const exercises = plan.slots.flatMap((slot) =>
      take(pool, cursors, slot.category, slot.count, usedToday, musclesToday),
    );

    const blocks = plan.blocks === "full" ? mergedBlocks(library) : blocksFor(library, plan.blocks);

    return {
      key: plan.key,
      dayNumber: index + 1,
      name: plan.name,
      subtitle: plan.subtitle,
      warmup: blocks.warmup,
      cooldown: blocks.cooldown,
      exercises,
    };
  });
}

