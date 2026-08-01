/**
 * Where someone is in their cycle, from three numbers they entered.
 *
 * This is arithmetic on a self-reported average, not a measurement. Real cycles
 * vary by several days month to month, ovulation isn't observable from a
 * calendar, and a stressful week can move the whole thing. So the output is
 * treated everywhere as "roughly this phase" — it never gates anything, and the
 * user's own check-in overrides it.
 *
 * The luteal phase is the most consistent part of a cycle (about 14 days for
 * most people, largely independent of total length), so ovulation is placed by
 * counting back from the next period rather than assuming day 14. That way a
 * 34-day cycle doesn't get an ovulation window a week early.
 */

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface CycleSettings {
  enabled: boolean;
  lastPeriodStart: string | null; // ISO date
  averageCycleLength: number;
  periodDuration: number;
}

export interface CycleStatus {
  cycleDay: number;
  phase: CyclePhase;
  /** Days until the next period is expected, by the same arithmetic. */
  daysUntilNextPeriod: number;
  /** True once the entered start date is old enough that the running count has
   *  probably drifted. The UI asks for a fresh date rather than pretending. */
  stale: boolean;
}

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal",
};

/** How many cycles can elapse before the stored start date is treated as stale. */
const STALE_AFTER_CYCLES = 3;

/** Typical luteal length, used to place ovulation relative to the next period. */
const LUTEAL_LENGTH = 14;

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_DURATION = 5;

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso + "T00:00:00");
  const today = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((today.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Returns null when there's nothing to calculate from — tracking off, no date
 * entered, or a start date in the future. Callers render the un-adapted app in
 * that case rather than guessing.
 */
export function cycleStatus(settings: CycleSettings, today: Date = new Date()): CycleStatus | null {
  if (!settings.enabled || !settings.lastPeriodStart) return null;

  const elapsed = daysBetween(settings.lastPeriodStart, today);
  if (elapsed < 0) return null;

  const length = clamp(settings.averageCycleLength || DEFAULT_CYCLE_LENGTH, 20, 45);
  const period = clamp(settings.periodDuration || DEFAULT_PERIOD_DURATION, 1, 10);

  const cycleDay = (elapsed % length) + 1;
  const cyclesElapsed = Math.floor(elapsed / length);

  return {
    cycleDay,
    phase: phaseFor(cycleDay, length, period),
    daysUntilNextPeriod: length - cycleDay + 1,
    stale: cyclesElapsed >= STALE_AFTER_CYCLES,
  };
}

export function phaseFor(cycleDay: number, cycleLength: number, periodDuration: number): CyclePhase {
  if (cycleDay <= periodDuration) return "menstrual";

  // Ovulation sits a fixed-ish distance before the next period, with a window
  // either side of it — the exact day isn't knowable from a calendar.
  const ovulationDay = Math.max(periodDuration + 2, cycleLength - LUTEAL_LENGTH);
  if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) return "ovulation";

  return cycleDay < ovulationDay ? "follicular" : "luteal";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
