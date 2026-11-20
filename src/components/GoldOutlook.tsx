"use client";

import { useMemo, useState } from "react";
import { buildForecast, type Horizon, type GoldPoint } from "@/lib/forecast";

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

interface Props { series: GoldPoint[]; anchor: number; anchorAt: string }

/* ----------------------------- Compact tile ----------------------------- */
// A small self-updating sparkline that lives in the price row. Click to expand.
export function GoldOutlookMini({ series, anchor, anchorAt, onExpand }: Props & { onExpand: () => void }) {
  const f = useMemo(() => buildForecast(series ?? [], anchor, anchorAt, "yearly"), [series, anchor, anchorAt]);
  if (!(anchor > 0)) return null;

  const W = 260, H = 60;
  const hist = f.history.map((p) => ({ t: new Date(p.t).getTime(), v: p.price }));
  const proj = f.projection.map((p) => ({ t: new Date(p.t).getTime(), v: p.mid }));
  const all = [...hist, ...proj];
  const tMin = Math.min(...all.map((p) => p.t)), tMax = Math.max(...all.map((p) => p.t));
  const vMin = Math.min(...all.map((p) => p.v)), vMax = Math.max(...all.map((p) => p.v));
  const tSpan = Math.max(1, tMax - tMin), vSpan = Math.max(1, vMax - vMin);
  const X = (t: number) => 2 + ((t - tMin) / tSpan) * (W - 4);
  const Y = (v: number) => 4 + (1 - (v - vMin) / vSpan) * (H - 8);
  const line = (a: { t: number; v: number }[]) => a.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const nowX = X(new Date(f.anchorAt).getTime());
  const last = f.projection[f.projection.length - 1];

  return (
    <button
      onClick={onExpand}
      className="rz-card group text-left rounded-xl border p-3 w-full flex flex-col"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Gold outlook</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--pos)" }} />
        </div>
        <span className="text-[10px] font-semibold" style={{ color: "var(--brand)" }}>⤢ expand</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-1" preserveAspectRatio="none" style={{ height: 52 }}>
        <line x1={nowX} x2={nowX} y1={2} y2={H - 2} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        {hist.length > 1 && <path d={line(hist)} fill="none" stroke="var(--text)" strokeWidth={1.5} />}
        <path d={line(proj)} fill="none" stroke="var(--brand)" strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{usd(anchor)}</span>
        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>→ {f.endLabel}</span>
        <span className="text-sm font-bold" style={{ color: "var(--brand)" }}>{usd(last?.mid ?? anchor)}</span>
      </div>
    </button>
  );
}

/* ------------------------------ Full chart ------------------------------ */
export default function GoldOutlook({ series, anchor, anchorAt }: Props) {
  const [horizon, setHorizon] = useState<Horizon>("monthly");
  const f = useMemo(() => buildForecast(series ?? [], anchor, anchorAt, horizon), [series, anchor, anchorAt, horizon]);
  if (!(anchor > 0)) return null;

  const W = 760, H = 240, padL = 56, padR = 14, padT = 14, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const nowMs = new Date(f.anchorAt).getTime();
  const histMs = f.history.map((p) => new Date(p.t).getTime());
  const projMs = f.projection.map((p) => new Date(p.t).getTime());
  const tMin = Math.min(nowMs, ...(histMs.length ? histMs : [nowMs]));
  const tMax = Math.max(nowMs, ...(projMs.length ? projMs : [nowMs]));
  const tSpan = Math.max(1, tMax - tMin);
  const prices = [...f.history.map((p) => p.price), ...f.projection.map((p) => p.lo), ...f.projection.map((p) => p.hi), anchor];
  let yMin = Math.min(...prices), yMax = Math.max(...prices);
  const pad = (yMax - yMin) * 0.08 || yMax * 0.08;
  yMin -= pad; yMax += pad;
  const ySpan = Math.max(1, yMax - yMin);
  const X = (ms: number) => padL + ((ms - tMin) / tSpan) * plotW;
  const Y = (v: number) => padT + (1 - (v - yMin) / ySpan) * plotH;

  const histPath = f.history.map((p, i) => `${i ? "L" : "M"}${X(new Date(p.t).getTime()).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ");
  const midPath = f.projection.map((p, i) => `${i ? "L" : "M"}${X(new Date(p.t).getTime()).toFixed(1)},${Y(p.mid).toFixed(1)}`).join(" ");
  const bandPath =
    f.projection.map((p, i) => `${i ? "L" : "M"}${X(new Date(p.t).getTime()).toFixed(1)},${Y(p.hi).toFixed(1)}`).join(" ") + " " +
    [...f.projection].reverse().map((p) => `L${X(new Date(p.t).getTime()).toFixed(1)},${Y(p.lo).toFixed(1)}`).join(" ") + " Z";
  const last = f.projection[f.projection.length - 1];
  const nowX = X(nowMs);
  const yTicks = [yMin + ySpan * 0.12, yMin + ySpan * 0.5, yMin + ySpan * 0.88];
  const xTicks = [tMin, tMin + tSpan * 0.5, tMax];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          From today&apos;s <b style={{ color: "var(--text)" }}>{usd(anchor)}</b>, projected to {f.endLabel} — the model re-fits to the stored gold trend each time.
        </p>
        <div className="flex gap-1">
          {HORIZONS.map((h) => (
            <button key={h.key} onClick={() => setHorizon(h.key)}
              className="rounded-md px-2.5 py-1 text-xs font-semibold border"
              style={horizon === h.key ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" }}
            >{h.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-3">
        <Stat label="Spot (now)" value={usd(anchor)} />
        <Stat label={`Projected · ${f.endLabel}`} value={usd(last?.mid ?? anchor)} accent />
        <Stat label="Scenario range" value={`${usd(last?.lo ?? anchor)} – ${usd(last?.hi ?? anchor)}`} />
        <Stat label="Assumed drift" value={`${(f.driftAnnual * 100).toFixed(1)}%/yr`} />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 300 }} role="img" aria-label="Gold price projection">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth={1} opacity={0.6} />
            <text x={padL - 8} y={Y(v) + 3} textAnchor="end" fontSize={10} fill="var(--text-faint)">{usd(v)}</text>
          </g>
        ))}
        <path d={bandPath} fill="var(--brand)" opacity={0.12} />
        {f.history.length > 1 && <path d={histPath} fill="none" stroke="var(--text)" strokeWidth={2} />}
        <circle cx={nowX} cy={Y(anchor)} r={3.5} fill="var(--brand)" />
        <path d={midPath} fill="none" stroke="var(--brand)" strokeWidth={2} strokeDasharray="5 4" />
        <line x1={nowX} x2={nowX} y1={padT} y2={padT + plotH} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
        <text x={nowX + 3} y={padT + 10} fontSize={9} fill="var(--text-faint)">today</text>
        {xTicks.map((ms, i) => (
          <text key={i} x={X(ms)} y={H - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} fontSize={10} fill="var(--text-faint)">
            {new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 h-0.5" style={{ background: "var(--text)" }} />History ({f.basedOn} readings)</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "var(--brand)" }} />Projection</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 h-2 rounded-sm" style={{ background: "var(--brand)", opacity: 0.18 }} />±1σ band (vol {(f.volAnnual * 100).toFixed(0)}%)</span>
      </div>
      <p className="mt-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
        Model scenario from a real multi-year gold trend plus this platform&apos;s live readings — not a prediction or advice. It re-fits as new prices arrive, so the trend self-corrects.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</div>
      <div className="text-sm font-bold" style={{ color: accent ? "var(--brand)" : "var(--text)" }}>{value}</div>
    </div>
  );
}
