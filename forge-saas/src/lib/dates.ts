/**
 * The seven ISO dates of the week containing `from`, index 0 = Sunday, so
 * `weekDates[date.getDay()]` is always that day's own date.
 */
export function weekDatesFor(from: Date): string[] {
  const weekStart = new Date(from);
  weekStart.setDate(from.getDate() - from.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function isBirthdayToday(dateOfBirth: string | null): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth + "T00:00:00Z");
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return dob.getUTCMonth() === todayUtc.getUTCMonth() && dob.getUTCDate() === todayUtc.getUTCDate();
}
