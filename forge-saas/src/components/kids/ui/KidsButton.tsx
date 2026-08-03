import { forwardRef, type ButtonHTMLAttributes } from "react";

/**
 * The kids-mode equivalent of src/components/ui.tsx's Button — larger touch
 * target, rounder, brighter. Not a shared component: docs/kids-mode/00-principles.md
 * P6 is "share primitives, not screens," and the adult Button already differs
 * enough in size and tone that forcing one component to serve both would mean
 * threading kids-only props through adult code. A sibling costs one small file.
 */
export interface KidsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

const KidsButton = forwardRef<HTMLButtonElement, KidsButtonProps>(function KidsButton(
  { variant = "primary", className = "", style, ...props },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--kids-border-radius-full)] px-6 font-extrabold transition active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-[var(--kids-primary)] text-[var(--kids-text-on-primary)] shadow-[var(--kids-shadow-md)]"
      : "bg-[var(--kids-bg-card)] text-[var(--kids-text-primary)] border-2 border-[var(--kids-primary-light)]";

  return (
    <button
      ref={ref}
      className={`${base} ${styles} ${className}`}
      style={{ minHeight: "var(--kids-touch-target-preferred)", ...style }}
      {...props}
    />
  );
});

export default KidsButton;
