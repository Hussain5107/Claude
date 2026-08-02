import { describe, expect, it } from "vitest";
import { deriveDayOffset, trainingWeekdays, weekdayToDayNumber } from "./dayRotation";

describe("trainingWeekdays", () => {
  it("spaces 3 days with a rest day between each (Mon/Wed/Fri)", () => {
    expect(trainingWeekdays(3)).toEqual([1, 3, 5]);
  });

  it("falls back to the 6-day week for an unrecognised frequency", () => {
    // @ts-expect-error deliberately out-of-range input
    expect(trainingWeekdays(7)).toEqual(trainingWeekdays(6));
  });
});

describe("weekdayToDayNumber", () => {
  it("returns null on a rest day", () => {
    // 3-day week trains Mon/Wed/Fri (1,3,5) — Sunday (0) is a rest day.
    expect(weekdayToDayNumber(0, 0, 3)).toBeNull();
  });

  it("maps weekday -> day number 1..N with zero offset, in order", () => {
    expect(weekdayToDayNumber(1, 0, 3)).toBe(1); // Mon
    expect(weekdayToDayNumber(3, 0, 3)).toBe(2); // Wed
    expect(weekdayToDayNumber(5, 0, 3)).toBe(3); // Fri
  });

  it("rotates which day number lands on which weekday as the offset increases", () => {
    // Same 3-day week, offset 1: everyone's plan shifts by one slot so two
    // people don't get identical days on identical weekdays.
    expect(weekdayToDayNumber(1, 1, 3)).toBe(2);
    expect(weekdayToDayNumber(3, 1, 3)).toBe(3);
    expect(weekdayToDayNumber(5, 1, 3)).toBe(1);
  });

  it("normalises a negative offset the same way a positive one wraps", () => {
    expect(weekdayToDayNumber(1, -1, 3)).toBe(weekdayToDayNumber(1, 2, 3));
  });

  it("covers 1..N exactly once across a full week, for every supported frequency", () => {
    for (const daysPerWeek of [3, 4, 5, 6] as const) {
      for (let offset = 0; offset < 6; offset++) {
        const seen = new Set<number>();
        for (let weekday = 0; weekday < 7; weekday++) {
          const dayNumber = weekdayToDayNumber(weekday, offset, daysPerWeek);
          if (dayNumber !== null) seen.add(dayNumber);
        }
        expect(seen.size).toBe(daysPerWeek);
        expect([...seen].sort((a, b) => a - b)).toEqual(
          Array.from({ length: daysPerWeek }, (_, i) => i + 1),
        );
      }
    }
  });
});

describe("deriveDayOffset", () => {
  it("is deterministic for the same id", () => {
    expect(deriveDayOffset("user-123")).toBe(deriveDayOffset("user-123"));
  });

  it("stays within the 6-day rotation range", () => {
    for (const id of ["a", "user-123", "00000000-0000-0000-0000-000000000000", "z".repeat(50)]) {
      const offset = deriveDayOffset(id);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(6);
    }
  });

  it("spreads different ids across different offsets rather than collapsing to one value", () => {
    // Not a cryptographic requirement — just confirms the rotation actually
    // varies by user instead of accidentally being a constant.
    const offsets = new Set(
      Array.from({ length: 30 }, (_, i) => deriveDayOffset(`user-${i}`)),
    );
    expect(offsets.size).toBeGreaterThan(1);
  });
});
