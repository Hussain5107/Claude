export function slugifyTheme(theme: string, dateStr: string): string {
  const base = theme
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `${base}-${dateStr}`;
}

export function themeSlugOnly(theme: string): string {
  return theme
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}
