"use client";

import React from "react";
import type { PowerOut, SourceKey } from "@/lib/lab/power";
import { MERIT, SOURCE_META } from "@/lib/lab/power";
import type { BarItem } from "@/lib/lab/types";
import { fmtBy } from "@/lib/lab/types";

const STACK: SourceKey[] = [...MERIT, "battery", "diesel"];

/** 24-hour supply stack vs demand; unserved demand shaded red. */
export function HourlyChart({ o }: { o: PowerOut }) {
  const W = 760, H = 306, x0 = 52, y0 = 26, x1 = W - 12, yb = H - 34;
  const maxV = Math.max(...o.hours.map((h) => h.demand), ...o.hours.map((h) => STACK.reduce((s, k) => s + h.served[k], 0))) * 1.08 || 1;
  const x = (h: number) => x0 + (h / 23) * (x1 - x0);
  const y = (v: number) => yb - (v / maxV) * (yb - y0);
  const step = maxV > 4000 ? 1000 : maxV > 2000 ? 500 : 250;
  const ticks: number[] = [];
  for (let t = 0; t <= maxV; t += step) ticks.push(t);

  // cumulative stacks
  const cum = o.hours.map(() => 0);
  const layers = STACK.map((k) => {
    const lower = [...cum];
    o.hours.forEach((h, idx) => { cum[idx] += h.served[k]; });
    const upper = [...cum];
    const total = o.hours.reduce((s, h) => s + h.served[k], 0);
    if (total < 0.5) return null;
    const pts = upper.map((v, h) => `${x(h)},${y(v)}`).join(" ") + " " + lower.map((v, h) => `${x(h)},${y(v)}`).reverse().join(" ");
    return { k, pts };
  }).filter(Boolean) as { k: SourceKey; pts: string }[];

  const served = cum;
  const unservedPts = o.hours.map((h, i) => `${x(i)},${y(h.demand)}`).join(" ") + " " + served.map((v, i) => `${x(i)},${y(Math.min(v, o.hours[i].demand))}`).reverse().join(" ");
  const demandLine = o.hours.map((h, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(h.demand)}`).join(" ");
  const worst = o.hours[o.worstHour];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Supply and demand across a typical day">
        <defs>
          <pattern id="shed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(201,55,44,0.18)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(201,55,44,0.7)" strokeWidth="2" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={x0 - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">{t.toLocaleString("en-US")}</text>
          </g>
        ))}
        <text x={x0 - 8} y={11} textAnchor="end" fontSize="10" fill="var(--text-faint)">MW</text>
        {layers.map((l) => (
          <polygon key={l.k} points={l.pts} fill={SOURCE_META[l.k].color} fillOpacity="0.85">
            <title>{SOURCE_META[l.k].label}</title>
          </polygon>
        ))}
        {o.unservedMWh > 0.5 && <polygon points={unservedPts} fill="url(#shed)"><title>Unserved demand (load-shedding)</title></polygon>}
        <path d={demandLine} fill="none" stroke="var(--text)" strokeWidth="2.5" />
        {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
          <text key={h} x={x(h)} y={yb + 18} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{String(h).padStart(2, "0")}:00</text>
        ))}
        {worst.unserved > 1 && (
          <g>
            <line x1={x(o.worstHour)} x2={x(o.worstHour)} y1={y(worst.demand) - 4} y2={y(worst.demand) - 26} stroke="var(--neg)" strokeWidth="1.5" />
            <text x={Math.min(x(o.worstHour), x1 - 150)} y={y(worst.demand) - 30} fontSize="12" fontWeight="700" fill="var(--neg)">
              {`${Math.round(worst.unserved).toLocaleString("en-US")} MW short at ${String(o.worstHour).padStart(2, "0")}:00`}
            </text>
          </g>
        )}
        {o.hours.map((h, i) => (
          <rect key={i} x={x(i) - (x1 - x0) / 46} y={y0} width={(x1 - x0) / 23} height={yb - y0} fill="transparent">
            <title>{`${String(i).padStart(2, "0")}:00 — demand ${Math.round(h.demand).toLocaleString("en-US")} MW; served ${Math.round(h.demand - h.unserved).toLocaleString("en-US")} MW; short ${Math.round(h.unserved).toLocaleString("en-US")} MW`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5" style={{ background: "var(--text)" }} />Demand</span>
        {layers.map((l) => (
          <span key={l.k} className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SOURCE_META[l.k].color }} />{SOURCE_META[l.k].label}</span>
        ))}
        {o.unservedMWh > 0.5 && <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(201,55,44,0.55)" }} />Load-shedding</span>}
      </div>
    </div>
  );
}

/** Horizontal ranked bars; highlighted bar in brand colour, others grey. Handles negatives. */
export function RankBars({ items, format }: { items: BarItem[]; format: "usd" | "num" | "pct" | "mw" | "t" }) {
  const max = Math.max(...items.map((d) => Math.abs(d.value)), 1);
  const hasNeg = items.some((d) => d.value < 0);
  return (
    <div className="space-y-2.5">
      {items.map((d) => {
        const w = (Math.abs(d.value) / max) * (hasNeg ? 50 : 100);
        return (
          <div key={d.label}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-xs truncate" style={{ color: d.highlight ? "var(--text)" : "var(--text-muted)", fontWeight: d.highlight ? 700 : 400 }}>{d.label}</span>
              <span className="text-xs font-semibold shrink-0" style={{ color: d.value < 0 ? "var(--neg)" : "var(--text)" }}>{fmtBy(format, d.value)}</span>
            </div>
            <div className="h-2.5 rounded-full relative overflow-hidden" style={{ background: "var(--surface-2, #f1f2f4)" }}>
              <div
                className="h-full rounded-full absolute top-0 transition-all duration-500"
                style={{
                  width: `${Math.max(1.5, w)}%`,
                  left: hasNeg ? (d.value < 0 ? `${50 - w}%` : "50%") : 0,
                  background: d.value < 0 ? "var(--neg)" : d.highlight ? "var(--brand)" : "#a5adba",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
