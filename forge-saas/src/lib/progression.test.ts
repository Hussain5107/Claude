import { describe, expect, it } from "vitest";
import { checkProgression, daysSince } from "./progression";

describe("daysSince", () => {
  it("computes whole days elapsed", () => {
    expect(daysSince("2026-01-01T00:00:00Z", new Date("2026-01-11T00:00:00Z"))).toBe(10);
  });

  it("never goes negative for a future timestamp", () => {
    expect(daysSince("2026-06-01T00:00:00Z", new Date("2026-01-01T00:00:00Z"))).toBe(0);
  });

  it("returns 0 rather than NaN for an unparseable date", () => {
    expect(daysSince("not-a-date", new Date())).toBe(0);
  });
});

describe("checkProgression", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("is not eligible for a beginner short on both days and workouts", () => {
    const status = checkProgression("beginner", "2026-05-01T00:00:00Z", 5, now);
    expect(status.eligible).toBe(false);
    expect(status.next).toBe("intermediate");
    expect(status.daysNeeded).toBe(90);
    expect(status.workoutsNeeded).toBe(36);
  });

  it("is not eligible on days alone, without enough workouts", () => {
    // 90+ days elapsed, but nowhere near 36 workouts.
    const status = checkProgression("beginner", "2026-01-01T00:00:00Z", 10, now);
    expect(status.daysTrained).toBeGreaterThanOrEqual(90);
    expect(status.eligible).toBe(false);
  });

  it("is not eligible on workouts alone, without enough elapsed time", () => {
    // Plenty of workouts logged, but the account is only a week old — this is
    // the exact case the rule exists to catch: calendar time and training
    // volume must both be satisfied, not either one alone.
    const status = checkProgression("beginner", "2026-05-25T00:00:00Z", 50, now);
    expect(status.workoutsDone).toBeGreaterThanOrEqual(36);
    expect(status.eligible).toBe(false);
  });

  it("is eligible once both thresholds are met", () => {
    const status = checkProgression("beginner", "2026-01-01T00:00:00Z", 40, now);
    expect(status.eligible).toBe(true);
    expect(status.next).toBe("intermediate");
    expect(status.nextLabel).toBe("Intermediate");
  });

  it("promotes intermediate to advanced on a much longer, higher-volume threshold", () => {
    const notYet = checkProgression("intermediate", "2026-01-01T00:00:00Z", 40, now);
    expect(notYet.eligible).toBe(false);

    const farEnoughBack = new Date(now.getTime() - 301 * 86_400_000).toISOString();
    const ready = checkProgression("intermediate", farEnoughBack, 160, now);
    expect(ready.eligible).toBe(true);
    expect(ready.nextLabel).toBe("Advanced");
  });

  it("has nothing to progress to once already advanced", () => {
    const status = checkProgression("advanced", "2020-01-01T00:00:00Z", 1000, now);
    expect(status.eligible).toBe(false);
    expect(status.next).toBeNull();
    expect(status.nextLabel).toBeNull();
  });
});
