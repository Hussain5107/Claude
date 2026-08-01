"use client";

import { createContext, useContext } from "react";
import { DEFAULT_THEME, THEMES, type Theme } from "@/lib/theme";

/**
 * Carries the active theme to components that need it in JavaScript rather
 * than in CSS — an SVG gradient, a map marker, the logo file.
 *
 * It deliberately holds no state and runs no effect: the theme arrives already
 * resolved from the server, and the colours themselves are applied by the
 * `data-theme` attribute in the markup. There is nothing to swap on the client,
 * so there is nothing to flicker.
 */
const ThemeContext = createContext<Theme>(THEMES[DEFAULT_THEME]);

export function ThemeProvider({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
