"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

/**
 * Native-style bottom navigation.
 *
 * Fixed to the bottom with safe-area padding so it clears the iPhone home
 * indicator when FORGE is installed to the home screen and running full screen.
 */

interface Tab {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const stroke = (active: boolean) => (active ? "url(#tabGradient)" : "currentColor");

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/workouts",
    label: "Workouts",
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/progress",
    label: "Progress",
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 20V10M12 20V4M19 20v-6" />
      </svg>
    ),
  },
  {
    href: "/dashboard/gyms",
    label: "Gyms",
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Profile",
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
      </svg>
    ),
  },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const theme = useTheme();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* One shared gradient definition for whichever icon is active. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="tabGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.colors.primary} />
            <stop offset="100%" stopColor={theme.colors.secondary} />
          </linearGradient>
        </defs>
      </svg>

      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {TABS.map((tab) => {
          // Exact match for Home, prefix match elsewhere, so a nested page
          // still highlights its section.
          const active =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 transition ${
                  active ? "text-[var(--secondary)]" : "text-[var(--text-faint)]"
                }`}
              >
                <span className="h-6 w-6">{tab.icon(active)}</span>
                <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
