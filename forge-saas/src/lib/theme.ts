/**
 * FORGE themes.
 *
 * A theme is two brand colours plus a logo. Every component already paints with
 * `var(--primary)` / `var(--secondary)`, so switching a theme is a matter of
 * setting `data-theme` on a wrapping element — the colour overrides live in
 * globals.css and cascade from there. Nothing branches on the theme name.
 *
 * The colours below are the source of truth for anything that needs a theme
 * colour in JavaScript (SVG gradients, Leaflet markers) rather than in CSS.
 */

export type ThemeName = "forge" | "blue" | "pink";

export const THEME_NAMES: ThemeName[] = ["forge", "blue", "pink"];

export interface Theme {
  name: ThemeName;
  label: string;
  /** Shown next to the swatch in the picker. */
  description: string;
  logo: string;
  colors: {
    primary: string;
    secondary: string;
  };
}

export const THEMES: Record<ThemeName, Theme> = {
  forge: {
    name: "forge",
    label: "FORGE",
    description: "The original violet and cyan.",
    logo: "/logo-mark.png",
    colors: { primary: "#8b5cf6", secondary: "#22d3ee" },
  },
  blue: {
    name: "blue",
    label: "Blue",
    description: "Royal blue on near-black.",
    logo: "/logo-blue.png",
    colors: { primary: "#3b82f6", secondary: "#38bdf8" },
  },
  pink: {
    name: "pink",
    label: "Pink",
    description: "Pink and orchid purple.",
    logo: "/logo-pink.png",
    colors: { primary: "#ec4899", secondary: "#a855f7" },
  },
};

export const DEFAULT_THEME: ThemeName = "forge";

/** Anything unrecognised — including null from a row created before themes
 *  existed — falls back to FORGE rather than throwing. */
export function resolveTheme(value: string | null | undefined): Theme {
  return THEMES[(value ?? "") as ThemeName] ?? THEMES[DEFAULT_THEME];
}

/** What a newly onboarded user gets, pre-selected from the sex they entered
 *  for their calorie targets. They can pick something else before submitting,
 *  and change it later in Settings. */
export function suggestedTheme(sex: string | null | undefined): ThemeName {
  if (sex === "male") return "blue";
  if (sex === "female") return "pink";
  return DEFAULT_THEME;
}
