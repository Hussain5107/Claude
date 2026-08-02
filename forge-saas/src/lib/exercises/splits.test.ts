import { describe, expect, it } from "vitest";
import { buildSplit, categorise } from "./splits";
import { DAY_TEMPLATES } from "./data";
import { HOME_DUMBBELL_DAY_TEMPLATES } from "./homeDumbbellData";
import { BODYWEIGHT_DAY_TEMPLATES } from "./bodyweightData";
import type { DayTemplate, DaysPerWeek, MuscleKey } from "./types";

// This module gets a second consumer if a Kids Mode generator is ever added
// (docs/kids-mode/01-decisions.md P-003 — currently proposed against, but
// undecided). It has no tests today despite being, per the architecture audit,
// "the most reusable asset in the codebase" — so it gets covered regardless of
// which way that decision goes.

const LIBRARIES: Record<string, DayTemplate[]> = {
  gym: DAY_TEMPLATES,
  home: HOME_DUMBBELL_DAY_TEMPLATES,
  park: BODYWEIGHT_DAY_TEMPLATES,
};

describe("categorise", () => {
  it("maps a leg muscle to legs even when combined with other muscles", () => {
    expect(categorise(["quads", "chest"])).toBe("legs");
  });

  it("maps a core muscle to core, taking priority over everything else", () => {
    expect(categorise(["abs", "chest", "quads"])).toBe("core");
  });

  it("falls back to push for an empty muscle list rather than throwing", () => {
    expect(categorise([] as MuscleKey[])).toBe("push");
  });
});

describe("buildSplit", () => {
  it("returns the library untouched at 6 days per week — the hand-written split every existing user is on", () => {
    for (const library of Object.values(LIBRARIES)) {
      expect(buildSplit(library, 6)).toBe(library);
    }
  });

  for (const [libraryName, library] of Object.entries(LIBRARIES)) {
    for (const daysPerWeek of [3, 4, 5] as DaysPerWeek[]) {
      it(`${libraryName}/${daysPerWeek}-day: produces exactly ${daysPerWeek} days, numbered 1..${daysPerWeek} in order`, () => {
        const split = buildSplit(library, daysPerWeek);
        expect(split).toHaveLength(daysPerWeek);
        expect(split.map((d) => d.dayNumber)).toEqual(
          Array.from({ length: daysPerWeek }, (_, i) => i + 1),
        );
      });

      it(`${libraryName}/${daysPerWeek}-day: never repeats an exercise within the same day`, () => {
        const split = buildSplit(library, daysPerWeek);
        for (const day of split) {
          const slugs = day.exercises.map((e) => e.slug);
          expect(new Set(slugs).size).toBe(slugs.length);
        }
      });

      it(`${libraryName}/${daysPerWeek}-day: every day has at least one exercise`, () => {
        const split = buildSplit(library, daysPerWeek);
        for (const day of split) {
          expect(day.exercises.length).toBeGreaterThan(0);
        }
      });

      it(`${libraryName}/${daysPerWeek}-day: every day trains a diverse set of muscles, not one repeated group`, () => {
        // Regression test for a real bug fixed during development: "Full Body A
        // had 2 chest presses, no delts/triceps" — take() in splits.ts now
        // prefers an exercise that hits a muscle the day hasn't trained yet.
        // Threshold of 4 is a safe floor measured against every library/
        // frequency combination that exists today; it will fail if that
        // preference regresses.
        const split = buildSplit(library, daysPerWeek);
        for (const day of split) {
          const muscles = new Set<MuscleKey>();
          for (const ex of day.exercises) ex.primary.forEach((m) => muscles.add(m));
          expect(muscles.size).toBeGreaterThanOrEqual(4);
        }
      });

      it(`${libraryName}/${daysPerWeek}-day: warmup and cooldown are never empty`, () => {
        const split = buildSplit(library, daysPerWeek);
        for (const day of split) {
          expect(day.warmup.length).toBeGreaterThan(0);
          expect(day.cooldown.length).toBeGreaterThan(0);
        }
      });
    }
  }

  it("is deterministic — building the same split twice gives the same exercises in the same order", () => {
    const first = buildSplit(DAY_TEMPLATES, 4);
    const second = buildSplit(DAY_TEMPLATES, 4);
    expect(first.map((d) => d.exercises.map((e) => e.slug))).toEqual(
      second.map((d) => d.exercises.map((e) => e.slug)),
    );
  });
});
