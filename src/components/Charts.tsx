"use client";

import React from "react";

/* Rulethu chart palette — brand green primary, gold accent, distinct categoricals. */
const CAT = ["#0b6e4f", "#c9a227", "#1c7293", "#6d2e46", "#84b59f", "#b85042", "#50808e", "#a17e12"];

/** Horizontal bar chart (single series, magnitude). Responsive, labelled. */
export function BarChart({ data, format = (n: number) => String(n), color = "var(--brand)" }: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.length === 0) return <p className="text-sm" style={{ color: "var(--text-faint)" }}>No data.</p>;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{d.label}</span>
            <span className="text-xs font-semibold shrink-0" style={{ color: "var(--text)" }}>{format(d.value)}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut chart (composition / allocation) with a legend. */
export function Donut({ data, format = (n: number) => String(n), size = 160 }: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2, stroke = size * 0.17, rad = r - stroke / 2;
  const circ = 2 * Math.PI * rad;
  let offset = 0;
  const segs = data.map((d, i) => {
    const frac = d.value / total;
    const seg = { color: CAT[i % CAT.length], dash: frac * circ, gap: circ - frac * circ, off: -offset * circ, pct: frac };
    offset += frac;
    return { ...d, ...seg };
  });
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label="composition">
        <circle cx={r} cy={r} r={rad} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {segs.map((s, i) => (
          <circle key={i} cx={r} cy={r} r={rad} fill="none" stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={s.off}
            transform={`rotate(-90 ${r} ${r})`} strokeLinecap="butt">
            <title>{s.label}: {format(s.value)}</title>
          </circle>
        ))}
        <text x={r} y={r - 2} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: size * 0.1, fontWeight: 800, fill: "var(--text)" }}>{data.length}</text>
        <text x={r} y={r + size * 0.11} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: size * 0.055, fill: "var(--text-faint)" }}>items</text>
      </svg>
      <ul className="space-y-1.5 min-w-0">
        {segs.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="truncate" style={{ color: "var(--text-muted)" }}>{s.label}</span>
            <span className="ml-auto font-semibold shrink-0" style={{ color: "var(--text)" }}>{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Simple area/line sparkline (change over time). */
export function AreaChart({ data, format = (n: number) => String(n), height = 120, color = "var(--brand)" }: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
  height?: number;
  color?: string;
}) {
  const W = 480, H = height, pad = 6;
  if (data.length < 2) return <p className="text-sm" style={{ color: "var(--text-faint)" }}>Not enough data to chart yet.</p>;
  const max = Math.max(...data.map((d) => d.value)), min = Math.min(...data.map((d) => d.value));
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad - 14);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="trend" style={{ maxHeight: height }}>
        <path d={area} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={2.5} fill={color}><title>{d.label}: {format(d.value)}</title></circle>)}
      </svg>
      <div className="flex justify-between mt-1 text-[10px]" style={{ color: "var(--text-faint)" }}>
        <span>{data[0].label}</span><span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
