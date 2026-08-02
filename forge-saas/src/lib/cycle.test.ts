import { describe, expect, it } from "vitest";
import { cycleStatus, phaseFor } from "./cycle";

// These properties were originally checked by hand with a throwaway script
// while building cycle tracking (see the Kids Mode architecture audit's note
// on the resulting technical debt: "verified with throwaway scripts that were
// not kept"). Formalised here so the same regression can't slip back in.

describe("phaseFor", () => {
  it("covers every day of the cycle exactly once, contiguously, for every plausible length and period", () => {
    const order = ["menstrual", "follicular", "ovulation", "luteal"];
    for (let length = 20; length <= 45; length++) {
      for (let period = 1; period <= Math.min(10, length - 4); period++) {
        let previousIndex = -1;
        for (let day = 1; day <= length; day++) {
          const index = order.indexOf(phaseFor(day, length, period));
          expect(index).toBeGreaterThanOrEqual(previousIndex);
          previousIndex = index;
        }
      }
    }
  });

  it("treats days 1..period as menstrual", () => {
    expect(phaseFor(1, 28, 5)).toBe("menstrual");
    expect(phaseFor(5, 28, 5)).toBe("menstrual");
    expect(phaseFor(6, 28, 5)).not.toBe("menstrual");
  });

  it("places ovulation and luteal against a standard 28-day cycle", () => {
    expect(phaseFor(13, 28, 5)).toBe("ovulation");
    expect(phaseFor(14, 28, 5)).toBe("ovulation");
    expect(phaseFor(15, 28, 5)).toBe("ovulation");
    expect(phaseFor(16, 28, 5)).toBe("luteal");
    expect(phaseFor(28, 28, 5)).toBe("luteal");
  });

  it("places ovulation later in a longer cycle, rather than always on day 14", () => {
    // A 34-day cycle should not treat day 14 as ovulation — the luteal phase
    // length is roughly fixed, so ovulation is counted back from the *next*
    // period, not forward from this one.
    expect(phaseFor(14, 34, 5)).toBe("follicular");
    expect(phaseFor(20, 34, 5)).toBe("ovulation");
  });
});

describe("cycleStatus", () => {
  const settings = {
    enabled: true,
    lastPeriodStart: "2026-01-01",
    averageCycleLength: 28,
    periodDuration: 5,
  };

  it("returns null when tracking is off", () => {
    expect(cycleStatus({ ...settings, enabled: false })).toBeNull();
  });

  it("returns null when no start date has been entered", () => {
    expect(cycleStatus({ ...settings, lastPeriodStart: null })).toBeNull();
  });

  it("returns null for a start date in the future", () => {
    expect(cycleStatus(settings, new Date("2025-12-25T12:00:00"))).toBeNull();
  });

  it("counts the start date itself as day 1", () => {
    expect(cycleStatus(settings, new Date("2026-01-01T12:00:00"))?.cycleDay).toBe(1);
  });

  it("advances one day at a time", () => {
    expect(cycleStatus(settings, new Date("2026-01-02T12:00:00"))?.cycleDay).toBe(2);
    expect(cycleStatus(settings, new Date("2026-01-28T12:00:00"))?.cycleDay).toBe(28);
  });

  it("wraps back to day 1 at the start of the next cycle", () => {
    expect(cycleStatus(settings, new Date("2026-01-29T12:00:00"))?.cycleDay).toBe(1);
    expect(cycleStatus(settings, new Date("2026-01-31T12:00:00"))?.cycleDay).toBe(3);
  });

  it("is not stale within the first couple of cycles", () => {
    expect(cycleStatus(settings, new Date("2026-02-20T12:00:00"))?.stale).toBe(false);
  });

  it("flags staleness once the stored start date is old enough to have drifted", () => {
    expect(cycleStatus(settings, new Date("2026-04-01T12:00:00"))?.stale).toBe(true);
  });

  it("counts down the days remaining to the next expected period", () => {
    expect(cycleStatus(settings, new Date("2026-01-01T12:00:00"))?.daysUntilNextPeriod).toBe(28);
    expect(cycleStatus(settings, new Date("2026-01-28T12:00:00"))?.daysUntilNextPeriod).toBe(1);
  });
});
