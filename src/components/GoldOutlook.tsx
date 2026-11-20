"use client";

import { useMemo, useRef, useState } from "react";
import { buildForecast, type Horizon, type GoldPoint } from "@/lib/forecast";
import { goldExcel } from "@/lib/goldexport";
import { useAppData } from "@/lib/store";
import { useAuth } from "@/lib/auth";

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const YEAR_MS = 365.25 * 86_400_000;

// Deterministic undulation so the projection reads like a real price path, not a
// straight line — bounded well inside the ±1σ band.
function wiggle(i: number, years: number, vol: number): number {
  const w = Math.sin(i * 0.7) * 0.55 + Math.sin(i * 0.29 + 1.1) * 0.3 + Math.sin(i * 1.9 + 0.5) * 0.15;
  return 0.5 * vol * Math.sqrt(Math.max(0, years)) * w;
}

interface Props { series: GoldPoint[]; anchor: number; anchorAt: string }

/* ----------------------------- Compact tile ----------------------------- */
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
    <button onClick={onExpand} className="rz-card group text-left rounded-xl border p-3 w-full flex flex-col" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
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
interface HoverPt { x: number; y: number; label: string; value: number; kind: "history" | "projection"; lo?: number; hi?: number }

export default function GoldOutlook({ series, anchor, anchorAt }: Props) {
  const [horizon, setHorizon] = useState<Horizon>("monthly");
  const [hover, setHover] = useState<HoverPt | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { orgConfig, setOrgFlag } = useAppData();
  const { isAdmin } = useAuth();
  const downloadOn = !!orgConfig?.goldExcel;

  const f = useMemo(() => buildForecast(series ?? [], anchor, anchorAt, horizon), [series, anchor, anchorAt, horizon]);

  const W = 760, H = 240, padL = 56, padR = 14, padT = 16, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const nowMs = new Date(f.anchorAt).getTime();

  const geom = useMemo(() => {
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
    return { tMin, tMax, tSpan, yMin, yMax, ySpan };
  }, [f, nowMs, anchor]);

  const X = (ms: number) => padL + ((ms - geom.tMin) / geom.tSpan) * plotW;
  const Y = (v: number) => padT + (1 - (v - geom.yMin) / geom.ySpan) * plotH;

  // Drawn projection path with deterministic wiggle (the band + numbers stay smooth).
  const drawnMid = (p: { t: string; mid: number }, i: number) => {
    const yrs = (new Date(p.t).getTime() - nowMs) / YEAR_MS;
    return p.mid * (1 + wiggle(i, yrs, f.volAnnual));
  };

  const histPath = f.history.map((p, i) => `${i ? "L" : "M"}${X(new Date(p.t).getTime()).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ");
  const midPath = f.projection.map((p, i) => `${i ? "L" : "M"}${X(new Date(p.t).getTime()).toFixed(1)},${Y(drawnMid(p, i)).toFixed(1)}`).join(" ");
  const bandPath =
    f.projection.map((p, i) => `${i ? "L" : "M"}${X(new Date(p.t).getTime()).toFixed(1)},${Y(p.hi).toFixed(1)}`).join(" ") + " " +
    [...f.projection].reverse().map((p) => `L${X(new Date(p.t).getTime()).toFixed(1)},${Y(p.lo).toFixed(1)}`).join(" ") + " Z";

  const last = f.projection[f.projection.length - 1];
  const nowX = X(nowMs);
  const yTicks = [geom.yMin + geom.ySpan * 0.12, geom.yMin + geom.ySpan * 0.5, geom.yMin + geom.ySpan * 0.88];
  const xTicks = [geom.tMin, geom.tMin + geom.tSpan * 0.5, geom.tMax];

  // Period high / low (over the displayed window, incl. the live spot).
  const hiLo = useMemo(() => {
    const vals = [...f.history.map((p) => p.price), anchor];
    return { hi: Math.max(...vals), lo: Math.min(...vals) };
  }, [f.history, anchor]);

  // Hover points for the crosshair/tooltip.
  const hoverPts = useMemo(() => {
    const h: HoverPt[] = f.history.map((p) => ({ x: X(new Date(p.t).getTime()), y: Y(p.price), label: new Date(p.t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), value: p.price, kind: "history" as const }));
    const pr: HoverPt[] = f.projection.map((p, i) => ({ x: X(new Date(p.t).getTime()), y: Y(drawnMid(p, i)), label: new Date(p.t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), value: p.mid, kind: "projection" as const, lo: p.lo, hi: p.hi }));
    return [...h, ...pr];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, geom]);

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current; if (!svg || !hoverPts.length) return;
    const rect = svg.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    let best = hoverPts[0], bd = Infinity;
    for (const p of hoverPts) { const d = Math.abs(p.x - vbX); if (d < bd) { bd = d; best = p; } }
    setHover(best);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          From today&apos;s <b style={{ color: "var(--text)" }}>{usd(anchor)}</b>, projected to {f.endLabel} — the model re-fits to the stored gold trend each time.
        </p>
        <div className="flex gap-1">
          {HORIZONS.map((h) => (
            <button key={h.key} onClick={() => { setHorizon(h.key); setHover(null); }}
              className="rounded-md px-2.5 py-1 text-xs font-semibold border"
              style={horizon === h.key ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" }}
            >{h.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
        <Stat label="Spot (now)" value={usd(anchor)} />
        <Stat label={`Projected · ${f.endLabel}`} value={usd(last?.mid ?? anchor)} accent />
        <Stat label="Scenario range" value={`${usd(last?.lo ?? anchor)} – ${usd(last?.hi ?? anchor)}`} />
        <Stat label="Period high" value={usd(hiLo.hi)} pos />
        <Stat label="Period low" value={usd(hiLo.lo)} />
        <Stat label="Drift" value={`${(f.driftAnnual * 100).toFixed(1)}%/yr`} />
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 320 }} role="img" aria-label="Gold price projection"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
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

        {/* Hover crosshair + tooltip */}
        {hover && (() => {
          const boxW = 128, boxH = hover.kind === "projection" ? 46 : 34;
          const bx = Math.min(Math.max(hover.x - boxW / 2, padL), W - padR - boxW);
          const by = Math.max(hover.y - boxH - 12, padT);
          return (
            <g pointerEvents="none">
              <line x1={hover.x} x2={hover.x} y1={padT} y2={padT + plotH} stroke="var(--brand)" strokeWidth={1} opacity={0.5} />
              <circle cx={hover.x} cy={hover.y} r={4} fill={hover.kind === "projection" ? "var(--brand)" : "var(--text)"} stroke="var(--surface)" strokeWidth={1.5} />
              <rect x={bx} y={by} width={boxW} height={boxH} rx={5} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
              <text x={bx + 8} y={by + 14} fontSize={9.5} fill="var(--text-faint)">{hover.label}{hover.kind === "projection" ? " · projected" : ""}</text>
              <text x={bx + 8} y={by + 27} fontSize={12} fontWeight="700" fill="var(--text)">{usd(hover.value)}</text>
              {hover.kind === "projection" && hover.lo != null && hover.hi != null && (
                <text x={bx + 8} y={by + 40} fontSize={9} fill="var(--text-faint)">range {usd(hover.lo)}–{usd(hover.hi)}</text>
              )}
            </g>
          );
        })()}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 h-0.5" style={{ background: "var(--text)" }} />History ({f.basedOn})</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "var(--brand)" }} />Projection</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 h-2 rounded-sm" style={{ background: "var(--brand)", opacity: 0.18 }} />±1σ band (vol {(f.volAnnual * 100).toFixed(0)}%)</span>
        <span className="ml-auto" style={{ color: "var(--text-faint)" }}>hover the chart for values</span>
      </div>

      {/* Download + admin control */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        {(downloadOn || isAdmin) && (
          <button onClick={() => goldExcel(f, HORIZONS.find((h) => h.key === horizon)?.label ?? "")} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
            ⬇ Download Excel
          </button>
        )}
        {isAdmin && (
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
            <input type="checkbox" checked={downloadOn} onChange={(e) => setOrgFlag("goldExcel", e.target.checked)} />
            <span>Allow everyone to download <span style={{ color: "var(--text-faint)" }}>(admin)</span></span>
          </label>
        )}
        {!downloadOn && !isAdmin && (
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>Downloads are disabled by the admin.</span>
        )}
      </div>

      <p className="mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
        Model scenario from a real multi-year gold trend plus this platform&apos;s live readings — not a prediction or advice. It re-fits as new prices arrive, so the trend self-corrects.
      </p>
    </div>
  );
}

function Stat({ label, value, accent, pos }: { label: string; value: string; accent?: boolean; pos?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</div>
      <div className="text-sm font-bold" style={{ color: accent ? "var(--brand)" : pos ? "var(--pos)" : "var(--text)" }}>{value}</div>
    </div>
  );
}
