import { describe, expect, it } from "vitest";
import { generateProgram, libraryFor, prescribeExercise } from "./generator";
import { DAY_TEMPLATES } from "./data";
import { HOME_DUMBBELL_DAY_TEMPLATES } from "./homeDumbbellData";
import { BODYWEIGHT_DAY_TEMPLATES } from "./bodyweightData";
import type { ExerciseTemplate, UserProfile } from "./types";

// generateProgram(profile) is, per the architecture audit, the single most
// reusable asset in the codebase and the one most likely to gain a second
// consumer (a Kids Mode generator — see docs/kids-mode). It had no tests.

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    age: 30,
    sex: "male",
    heightCm: 180,
    weightKg: 80,
    goal: "muscle",
    experience: "intermediate",
    trainingLocation: "gym",
    hasDumbbellsAtHome: true,
    daysPerWeek: 6,
    ...overrides,
  };
}

describe("libraryFor", () => {
  it("picks the gym library for gym training", () => {
    expect(libraryFor(profile({ trainingLocation: "gym" }))).toBe(DAY_TEMPLATES);
  });

  it("picks the home-dumbbell library for home training with dumbbells", () => {
    expect(
      libraryFor(profile({ trainingLocation: "home", hasDumbbellsAtHome: true })),
    ).toBe(HOME_DUMBBELL_DAY_TEMPLATES);
  });

  it("picks the bodyweight library for home training without dumbbells", () => {
    expect(
      libraryFor(profile({ trainingLocation: "home", hasDumbbellsAtHome: false })),
    ).toBe(BODYWEIGHT_DAY_TEMPLATES);
  });
});

describe("generateProgram", () => {
  it("produces exactly daysPerWeek prescribed days for every supported frequency", () => {
    for (const daysPerWeek of [3, 4, 5, 6] as const) {
      const program = generateProgram(profile({ daysPerWeek }));
      expect(program.days).toHaveLength(daysPerWeek);
      expect(program.daysPerWeek).toBe(daysPerWeek);
    }
  });

  it("defaults to a 6-day program when daysPerWeek is omitted, for accounts created before the field existed", () => {
    const withoutDaysPerWeek: Partial<UserProfile> = profile();
    delete withoutDaysPerWeek.daysPerWeek;
    const program = generateProgram(withoutDaysPerWeek as UserProfile);
    expect(program.daysPerWeek).toBe(6);
    expect(program.days).toHaveLength(6);
  });

  it("carries the goal and experience through unchanged", () => {
    const program = generateProgram(profile({ goal: "fat_loss", experience: "advanced" }));
    expect(program.goal).toBe("fat_loss");
    expect(program.experience).toBe("advanced");
  });

  it("stamps a valid, current ISO timestamp", () => {
    const before = Date.now();
    const program = generateProgram(profile());
    const stamped = new Date(program.generatedAt).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });

  describe("nutrition targets (Mifflin-St Jeor)", () => {
    it("computes a known male/muscle case exactly", () => {
      const { nutrition } = generateProgram(
        profile({ sex: "male", age: 30, heightCm: 180, weightKg: 80, goal: "muscle" }),
      );
      expect(nutrition.bmr).toBe(1780);
      expect(nutrition.tdee).toBe(2759);
      expect(nutrition.calorieTarget).toBe(3059);
      expect(nutrition.proteinG).toBe(160);
      expect(nutrition.waterL).toBe(3.4);
    });

    it("computes a known female/fat_loss case exactly, including the calorie floor logic", () => {
      const { nutrition } = generateProgram(
        profile({ sex: "female", age: 25, heightCm: 165, weightKg: 65, goal: "fat_loss" }),
      );
      expect(nutrition.bmr).toBe(1395);
      expect(nutrition.tdee).toBe(2163);
      expect(nutrition.calorieTarget).toBe(1663);
      expect(nutrition.proteinG).toBe(117);
      expect(nutrition.waterL).toBe(2.9);
    });

    it("never prescribes below the 1200 calorie floor regardless of a large deficit", () => {
      const { nutrition } = generateProgram(
        profile({ sex: "female", age: 60, heightCm: 150, weightKg: 45, goal: "fat_loss" }),
      );
      expect(nutrition.calorieTarget).toBeGreaterThanOrEqual(1200);
    });
  });
});

describe("prescribeExercise", () => {
  const compound: ExerciseTemplate = {
    slug: "test-compound",
    name: "Test Compound",
    equip: "Barbell",
    primary: ["chest"],
    secondary: [],
    baseSets: 3,
    baseReps: "8-10",
    baseRest: "90s",
    baseRpe: "RPE 7-8",
    tempo: "2-1-2",
    difficulty: "beginner",
    breathing: "",
    cues: [],
    mistakes: [],
    alt: "",
    tip: "",
    image: "/images/test.jpg",
    videoUrl: null,
  };

  it("adds a set for an intermediate lifter's main compound lift", () => {
    const beginner = prescribeExercise(compound, 0, profile({ experience: "beginner" }));
    const intermediate = prescribeExercise(compound, 0, profile({ experience: "intermediate" }));
    expect(intermediate.sets).toBe(beginner.sets + 1);
  });

  it("caps prescribed sets at 6 even for an advanced lifter on the main lift", () => {
    const heavy: ExerciseTemplate = { ...compound, baseSets: 5 };
    const result = prescribeExercise(heavy, 0, profile({ experience: "advanced" }));
    expect(result.sets).toBeLessThanOrEqual(6);
  });

  it("never reduces accessory sets below the floor of 2 for general fitness", () => {
    const lightAccessory: ExerciseTemplate = { ...compound, baseSets: 2 };
    const result = prescribeExercise(lightAccessory, 1, profile({ goal: "general_fitness" }));
    expect(result.sets).toBeGreaterThanOrEqual(2);
  });

  it("tightens rep range and extends rest for a strength goal's main lift", () => {
    const result = prescribeExercise(compound, 0, profile({ goal: "strength", experience: "beginner" }));
    expect(result.reps).toBe("6–8");
    // baseRest 90s + 60 = 150s, under the 180s cap.
    expect(result.rest).toBe("150s");
  });

  it("caps strength rest at 180s even when the base rest is already long", () => {
    const longRest: ExerciseTemplate = { ...compound, baseRest: "150s" };
    const result = prescribeExercise(longRest, 0, profile({ goal: "strength" }));
    expect(result.rest).toBe("180s");
  });

  it("leaves a timed hold (e.g. a plank) untouched by rep-range logic", () => {
    const plank: ExerciseTemplate = { ...compound, baseReps: "45s hold" };
    const result = prescribeExercise(plank, 1, profile({ goal: "strength" }));
    expect(result.reps).toBe("45s hold");
  });
});
