import type { Goal } from "./exercises/types";

/**
 * Short, friendly food reminders shown partway through a session.
 *
 * Deliberately kept to general "eat enough protein, drink water" territory and
 * rotated by date so it doesn't become wallpaper. It does NOT tailor to the
 * health conditions people record in their profile: adjusting someone's diet
 * around diabetes or blood pressure is medical advice, and this is a training
 * app writing an encouraging one-liner.
 */

export interface NutritionTip {
  emoji: string;
  message: string;
}

const SHARED: NutritionTip[] = [
  {
    emoji: "🥚",
    message:
      "Halfway there. When you're done, get some protein in — eggs, chicken, fish, yoghurt and lentils all do the job.",
  },
  {
    emoji: "💧",
    message:
      "Keep sipping. Even mild dehydration makes the last few sets feel harder than they should.",
  },
  {
    emoji: "🍗",
    message:
      "Nice work. Try to eat a proper meal within a couple of hours — your muscles rebuild with what you give them.",
  },
  {
    emoji: "😴",
    message:
      "Good session. Food and sleep are where the actual progress happens — the gym just starts it.",
  },
];

const BY_GOAL: Record<Goal, NutritionTip[]> = {
  muscle: [
    {
      emoji: "🥛",
      message:
        "Building muscle needs surplus fuel. If you're not gaining, it's usually not the training — it's the eating.",
    },
    {
      emoji: "🍚",
      message: "Carbs aren't the enemy here. They're what makes the next heavy session feel strong.",
    },
  ],
  strength: [
    {
      emoji: "🥩",
      message: "Strength runs on food. Under-eating shows up as a bar that suddenly won't move.",
    },
    {
      emoji: "🍌",
      message: "Something to eat before you lift heavy makes a real difference to how the top sets feel.",
    },
  ],
  fat_loss: [
    {
      emoji: "🥗",
      message:
        "Protein keeps you full and protects the muscle you're working for while you lose fat. Don't cut it.",
    },
    {
      emoji: "🫘",
      message:
        "Losing fat is mostly about being a little under, consistently — not being drastic for three days.",
    },
  ],
  general_fitness: [
    {
      emoji: "🥦",
      message: "Whole foods most of the time, protein at every meal. That's genuinely most of it.",
    },
    {
      emoji: "🍎",
      message: "You don't need a perfect diet to get fitter. You just need a decent one, repeatedly.",
    },
  ],
};

/** Deterministic per day, so the tip is stable if the page re-renders but
 *  changes tomorrow. */
export function tipForDay(goal: Goal, isoDate: string): NutritionTip {
  const pool = [...(BY_GOAL[goal] ?? []), ...SHARED];
  let hash = 0;
  for (let i = 0; i < isoDate.length; i++) {
    hash = (hash * 31 + isoDate.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}
