import Link from "next/link";
import Image from "next/image";

/**
 * The title bar for a tabbed screen.
 *
 * Sticks to the top like a native navigation bar and carries safe-area padding
 * so the title clears the notch when FORGE is installed to the home screen.
 * There's no back link — the tab bar is what moves you between sections.
 */
interface Props {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  right?: React.ReactNode;
}

export default function AppHeader({ title, subtitle, avatarUrl, right }: Props) {
  return (
    <header
      className="sticky top-0 z-30 -mx-4 mb-5 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] px-4 backdrop-blur-xl sm:-mx-6 sm:px-6"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold">{title}</h1>
          {subtitle && (
            <p className="truncate text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          {avatarUrl !== undefined && (
            <Link
              href="/dashboard/settings"
              aria-label="Profile"
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)]"
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm">👤</span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
