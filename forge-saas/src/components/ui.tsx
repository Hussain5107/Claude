import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`glass rounded-[18px] border border-[var(--border)] bg-[var(--surface)] ${className}`}
      {...props}
    />
  );
}

export function Button({
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white shadow-[0_8px_22px_rgb(var(--primary-rgb)/0.35)] hover:brightness-110"
      : "border border-[var(--border-hi)] bg-[var(--surface-hi)] text-[var(--text)] hover:border-[var(--secondary)] hover:text-[var(--secondary)]";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]"
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--secondary)]"
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--secondary)]"
      {...props}
    />
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-[var(--rose)]">{children}</p>;
}

export function Checkbox({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 text-sm text-[var(--text-dim)] ${className}`}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...props} />
      {label}
    </label>
  );
}
