import type { DaysPerWeek } from "./exercises/splits";

// Spreads a user's training days across the week, and rotates which workout
// lands on which day so colleagues sharing the app don't all hit leg day on the
// same Tuesday.

/** Which weekdays are training days at each frequency (0=Sun … 6=Sat).
 *  Lower frequencies are spaced out rather than crammed into consecutive days —
 *  three sessions land Mon/Wed/Fri so there's a recovery day between each. */
const TRAINING_WEEKDAYS: Record<DaysPerWeek, number[]> = {
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

export function trainingWeekdays(daysPerWeek: DaysPerWeek): number[] {
  return TRAINING_WEEKDAYS[daysPerWeek] ?? TRAINING_WEEKDAYS[6];
}

/** Maps a weekday (0=Sun … 6=Sat, matching JS Date#getDay()) to the workout
 *  number that falls on it, or null when it's a rest day. */
export function weekdayToDayNumber(
  weekday: number,
  offset: number,
  daysPerWeek: DaysPerWeek = 6,
): number | null {
  const days = trainingWeekdays(daysPerWeek);
  const index = days.indexOf(weekday);
  if (index === -1) return null;

  const count = days.length;
  const normalizedOffset = ((offset % count) + count) % count;
  return ((index + normalizedOffset) % count) + 1;
}

/** Deterministic offset derived from the user's id, computed once at onboarding
 *  and stored so it stays stable across sessions. */
export function deriveDayOffset(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 6;
}
