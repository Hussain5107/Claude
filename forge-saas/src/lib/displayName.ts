/**
 * What to call the user on screen.
 *
 * They can set a name in Settings. Until they do, the first word of their email
 * address is a better guess than "Athlete" — most people's addresses start with
 * their actual name.
 */

/** "hussain.raza7@gmail.com" -> "Hussain". */
export function fallbackName(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  // Split on the separators people put between name parts, so "hussain_raza"
  // and "ali.h92" both give the first name rather than the whole handle.
  const first = local.split(/[._\-+0-9]/).filter(Boolean)[0] ?? local;
  if (!first) return "Athlete";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function resolveDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed : fallbackName(email);
}
