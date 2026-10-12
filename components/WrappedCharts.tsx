"use client";

// Small charts for the Wrapped slides. They sit on the dark violet slide
// gradient, so colours are the dark-mode categorical steps validated against
// that surface (all checks pass), and every mark is also labelled directly —
// identity never depends on colour alone.

export const SERIES = ["#3987e5", "#d95926", "#199e70"]; // fixed order, never cycled
const HIGHLIGHT = "#fcd34d"; // the slides' accent (amber-300)
const MUTED_BAR = "rgba(255,255,255,0.28)";

export interface Slice {
  label: string;
  count: number;
}

/** Donut with a 2px surface gap between segments and a direct-labelled legend. */
export function Donut({ slices, size = 168 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.filter((x) => x.count > 0).length > 1 ? 3 : 0; // ≈2px of surface at this radius
  const lengths = slices.map((x) => (x.count / total) * c);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={slices.map((x) => `${x.label}: ${x.count}`).join(", ")}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((x, i) => {
            const len = lengths[i];
            return (
              <circle
                key={x.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={SERIES[i % SERIES.length]}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-starts[i]}
              >
                <title>{`${x.label}: ${x.count} (${Math.round((x.count / total) * 100)}%)`}</title>
              </circle>
            );
          })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" className="fill-white font-extrabold" fontSize="30">
          {total}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-white/60" fontSize="12">
          authors
        </text>
      </svg>
      <div className="flex gap-5 justify-center flex-wrap">
        {slices.map((x, i) => (
          <div key={x.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="text-white text-sm">
              {x.label} <span className="font-bold">{Math.round((x.count / total) * 100)}%</span>
              <span className="text-white/50"> · {x.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Column chart, one series, "emphasis" form: highlighted columns in the
 * accent, the rest muted. Bars ≤ 24px with a 4px rounded top and a square
 * base; only highlighted columns carry a value label.
 */
export function Columns({
  values,
  labels,
  highlight,
  height = 96,
  unit = "",
}: {
  values: number[];
  labels: string[];
  highlight: Set<number>;
  height?: number;
  unit?: string;
}) {
  const max = Math.max(1, ...values);
  const slot = 26;
  const bar = 16;
  const width = values.length * slot;
  const top = 18; // room for value labels
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height + top + 18}`} className="max-w-xs mx-auto block" role="img"
      aria-label={labels.map((l, i) => `${l}: ${values[i]}`).join(", ")}>
      {values.map((v, i) => {
        const h = v === 0 ? 0 : Math.max(4, (v / max) * height);
        const x = i * slot + (slot - bar) / 2;
        const y = top + height - h;
        const on = highlight.has(i);
        const rr = Math.min(4, h);
        return (
          <g key={i}>
            <title>{`${labels[i]}: ${v}${unit}`}</title>
            {/* invisible hit target taller than the bar */}
            <rect x={i * slot} y={top} width={slot} height={height} fill="transparent" />
            {h > 0 && (
              <path
                d={`M${x},${top + height} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + bar - rr} Q${x + bar},${y} ${x + bar},${y + rr} V${top + height} Z`}
                fill={on ? HIGHLIGHT : MUTED_BAR}
              />
            )}
            {on && v > 0 && (
              <text x={x + bar / 2} y={y - 5} textAnchor="middle" fontSize="11" className="fill-white font-bold">
                {v}
              </text>
            )}
            <text x={x + bar / 2} y={top + height + 14} textAnchor="middle" fontSize="10"
              className={on ? "fill-white font-bold" : "fill-white/55"}>
              {labels[i]}
            </text>
          </g>
        );
      })}
      <line x1="0" x2={width} y1={top + height} y2={top + height} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
    </svg>
  );
}

/** Horizontal bars with labels and counts written beside them; first row accented. */
export function RankedBars({ rows }: { rows: Slice[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-3 text-sm" title={`${r.label}: ${r.count}`}>
          <span className={`w-20 text-right truncate ${i === 0 ? "text-white font-bold" : "text-white/70"}`}>{r.label}</span>
          <div className="flex-1 h-4">
            <div
              className="h-4 rounded-r wrapped-grow"
              style={{
                width: `${(r.count / max) * 100}%`,
                background: i === 0 ? HIGHLIGHT : MUTED_BAR,
                animationDelay: `${i * 90}ms`,
              }}
            />
          </div>
          <span className={`w-6 tabular-nums ${i === 0 ? "text-white font-bold" : "text-white/70"}`}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}
