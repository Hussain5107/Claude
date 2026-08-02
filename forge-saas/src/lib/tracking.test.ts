import { describe, expect, it } from "vitest";
import { estimated1RM, updateStreak, type StreakState } from "./tracking";

describe("estimated1RM", () => {
  it("computes the Epley formula", () => {
    // 100kg x 5 reps -> 100 * (1 + 5/30) = 116.666... -> rounded to 1dp = 116.7
    expect(estimated1RM(100, 5)).toBe(116.7);
  });

  it("returns the weight itself for a single rep", () => {
    expect(estimated1RM(100, 1)).toBe(103.3);
  });

  it("returns 0 for non-positive weight or reps rather than a negative or NaN result", () => {
    expect(estimated1RM(0, 5)).toBe(0);
    expect(estimated1RM(100, 0)).toBe(0);
    expect(estimated1RM(-10, 5)).toBe(0);
    expect(estimated1RM(100, -1)).toBe(0);
  });
});

describe("updateStreak", () => {
  const fresh: StreakState = {
    currentStreak: 0,
    longestStreak: 0,
    lastWorkoutDate: null,
    totalWorkouts: 0,
  };

  it("starts a streak at 1 on the first logged day", () => {
    const result = updateStreak(fresh, "2026-01-05");
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastWorkoutDate: "2026-01-05",
      totalWorkouts: 1,
    });
  });

  it("is idempotent for a second log on the same day", () => {
    const first = updateStreak(fresh, "2026-01-05");
    const second = updateStreak(first, "2026-01-05");
    expect(second).toEqual(first);
  });

  it("continues the streak on a consecutive day", () => {
    const day1 = updateStreak(fresh, "2026-01-05"); // Monday
    const day2 = updateStreak(day1, "2026-01-06"); // Tuesday
    expect(day2.currentStreak).toBe(2);
    expect(day2.longestStreak).toBe(2);
    expect(day2.totalWorkouts).toBe(2);
  });

  it("breaks the streak after a gap of more than one day", () => {
    const day1 = updateStreak(fresh, "2026-01-05"); // Monday
    const day3 = updateStreak(day1, "2026-01-07"); // Wednesday — Tue skipped, not a Sunday
    expect(day3.currentStreak).toBe(1);
    expect(day3.longestStreak).toBe(1); // the old streak of 1 isn't beaten
    expect(day3.totalWorkouts).toBe(2); // but total keeps counting
  });

  it("does not break the streak across a skipped Sunday (the program's rest day)", () => {
    // 2026-01-03 is a Saturday, 2026-01-04 is a Sunday, 2026-01-05 is a Monday.
    const sat = updateStreak(fresh, "2026-01-03");
    const mon = updateStreak(sat, "2026-01-05");
    expect(mon.currentStreak).toBe(2);
  });

  it("does break the streak across a skipped non-Sunday day", () => {
    // 2026-01-05 Monday -> 2026-01-07 Wednesday, skipping Tuesday (not Sunday).
    const mon = updateStreak(fresh, "2026-01-05");
    const wed = updateStreak(mon, "2026-01-07");
    expect(wed.currentStreak).toBe(1);
  });

  it("keeps longestStreak at its high-water mark after the current streak breaks", () => {
    let state = fresh;
    for (const iso of ["2026-01-05", "2026-01-06", "2026-01-07"]) {
      state = updateStreak(state, iso);
    }
    expect(state.currentStreak).toBe(3);

    // Big gap breaks it.
    state = updateStreak(state, "2026-01-20");
    expect(state.currentStreak).toBe(1);
    expect(state.longestStreak).toBe(3);
  });
});
