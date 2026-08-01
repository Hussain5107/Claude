import { Card } from "@/components/ui";

// Static illustrative example — not real user data, clearly labeled below.
const POINTS = [40, 55, 50, 68, 74, 70, 85, 92];

export default function DashboardPreview() {
  const w = 560;
  const h = 200;
  const pad = 20;
  const min = Math.min(...POINTS);
  const max = Math.max(...POINTS);
  const range = max - min || 1;
  const coords = POINTS.map((v, i) => {
    const x = pad + (i / (POINTS.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${h - pad} L${pad},${h - pad} Z`;

  return (
    <Card className="p-5 sm:p-7">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold">Estimated 1RM over time</h3>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
          Example
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Example progress chart">
        <defs>
          <linearGradient id="preview-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#preview-fill)" />
        <path d={path} fill="none" stroke="var(--secondary)" strokeWidth="2.5" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--secondary)" />
        ))}
      </svg>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <PreviewStat label="Current streak" value="12d" accent="var(--amber)" />
        <PreviewStat label="Personal records" value="7" accent="var(--volt)" />
        <PreviewStat label="Workouts logged" value="34" accent="var(--secondary)" />
      </div>
      <p className="mt-4 text-center text-xs text-[var(--text-faint)]">
        Illustrative example — your dashboard fills in with your own real numbers as you train.
      </p>
    </Card>
  );
}

function PreviewStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-3 text-center">
      <div className="font-mono text-xl font-extrabold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
    </div>
  );
}
