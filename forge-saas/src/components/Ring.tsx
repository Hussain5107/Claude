/**
 * A progress ring.
 *
 * Deliberately caps the arc at 100% rather than looping it — drinking three
 * litres past your target shouldn't draw a second lap and imply another goal.
 */
interface Props {
  value: number;
  max: number;
  color: string;
  label: string;
  display: string;
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Ring({ value, max, color, label, display }: Props) {
  const fraction = max > 0 ? Math.min(1, value / max) : 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[68px] w-[68px]">
        <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
          <circle
            cx="34"
            cy="34"
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth="6"
          />
          <circle
            cx="34"
            cy="34"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold">
          {display}
        </span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </span>
    </div>
  );
}
