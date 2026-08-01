"use client";

import Image from "next/image";
import { THEMES, THEME_NAMES, type ThemeName } from "@/lib/theme";

/**
 * Three swatches, one per theme. Shared by onboarding and Settings so the
 * choice looks and behaves the same in both places.
 *
 * Each swatch previews its own colours rather than the active theme's, which is
 * why the gradient and logo here come from the theme record instead of
 * `var(--primary)`.
 */
interface Props {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
  disabled?: boolean;
}

export default function ThemePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEME_NAMES.map((name) => {
        const theme = THEMES[name];
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onChange(name)}
            aria-pressed={active}
            className={`rounded-2xl border p-3 text-center transition active:scale-[0.97] disabled:opacity-50 ${
              active
                ? "border-transparent bg-[var(--surface-hi)]"
                : "border-[var(--border)] hover:border-[var(--border-hi)]"
            }`}
            style={active ? { boxShadow: `0 0 0 2px ${theme.colors.primary}` } : undefined}
          >
            <span
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
              }}
            >
              <Image src={theme.logo} alt="" width={26} height={26} className="h-6 w-6" />
            </span>
            <span className="mt-2 block text-xs font-bold">{theme.label}</span>
            <span className="mt-0.5 block text-[10px] leading-tight text-[var(--text-faint)]">
              {theme.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
