"use client";

import Image from "next/image";
import { useTheme } from "./ThemeProvider";

/**
 * The FORGE wordmark.
 *
 * The mark follows the active theme. Outside the signed-in shell there's no
 * provider, so the context default (FORGE violet) applies — which is what the
 * landing, login and signup pages should show anyway.
 */
export function Logo({ className = "text-lg" }: { className?: string }) {
  const theme = useTheme();

  return (
    <span className={`inline-flex items-center gap-2.5 font-[family-name:var(--font-display)] font-extrabold ${className}`}>
      <Image
        src={theme.logo}
        alt=""
        width={40}
        height={40}
        className="h-[1.9em] w-[1.9em] shrink-0"
        priority
      />
      FORGE
    </span>
  );
}
