/** Shared XP/level math so every module agrees on the same curve. */

export function xpForLevel(level) {
  return Math.round(50 * Math.pow(level, 1.5));
}

/** Given total accumulated XP, derive the current level and progress within it. */
export function levelFromXp(totalXp) {
  let level = 1;
  let floor = 0;
  while (totalXp >= floor + xpForLevel(level)) {
    floor += xpForLevel(level);
    level += 1;
  }
  const need = xpForLevel(level);
  const into = totalXp - floor;
  return { level, xpIntoLevel: into, xpNeeded: need, percent: Math.min(100, Math.round((into / need) * 100)) };
}

/** Age-band seed used by the adaptive engine and content selection. */
export function ageGroupFor(age) {
  if (age <= 5) return "5";
  if (age <= 9) return "7";
  return "12";
}
