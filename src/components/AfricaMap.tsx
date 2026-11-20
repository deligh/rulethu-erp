"use client";

import { useState } from "react";
import { GeoNode, GEO_HQ } from "@/lib/boardroom";
import { compact, fmtMoney } from "@/lib/format";

// Interactive geographic-exposure panel. Bubbles are sized by total exposure
// ($ pipeline + portfolio) and positioned over a stylised Southern/Central
// Africa backdrop. Click a country to drill into what sits there. This is real:
// every bubble reflects live deal tickets and holding fair values.
export default function AfricaMap({ nodes }: { nodes: GeoNode[] }) {
  const [active, setActive] = useState<string | null>(nodes[0]?.country ?? null);
  const max = Math.max(...nodes.map((n) => n.total), 1);
  const sel = nodes.find((n) => n.country === active) ?? null;
  const radius = (total: number) => 3 + Math.sqrt(total / max) * 7; // viewBox units

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="relative rounded-lg overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <svg viewBox="0 0 100 100" className="w-full h-full block" style={{ minHeight: 300 }} role="img" aria-label="Geographic exposure map">
          {/* soft landmass backdrop */}
          <path
            d="M34 16 L58 14 L70 22 L74 34 L80 44 L78 58 L70 70 L60 84 L48 90 L38 84 L30 74 L26 60 L24 46 L26 32 Z"
            fill="color-mix(in srgb, var(--brand) 12%, transparent)"
            stroke="color-mix(in srgb, var(--brand) 35%, transparent)"
            strokeWidth={0.5}
          />
          {/* connector lines from HQ to each exposure */}
          {nodes.map((n) => (
            <line key={`l-${n.country}`} x1={GEO_HQ.x} y1={GEO_HQ.y} x2={n.x} y2={n.y}
              stroke="color-mix(in srgb, var(--brand) 40%, transparent)" strokeWidth={0.35} strokeDasharray="1 1" />
          ))}
          {/* exposure bubbles */}
          {nodes.map((n) => {
            const isSel = n.country === active;
            return (
              <g key={n.country} style={{ cursor: "pointer" }} onClick={() => setActive(n.country)}>
                <circle cx={n.x} cy={n.y} r={radius(n.total)}
                  fill={isSel ? "var(--brand)" : "color-mix(in srgb, var(--brand) 55%, transparent)"}
                  stroke="var(--surface)" strokeWidth={0.6} opacity={0.92}>
                  <title>{n.country}: {fmtMoney(n.total)}</title>
                </circle>
                <text x={n.x} y={n.y - radius(n.total) - 1.5} textAnchor="middle"
                  style={{ fontSize: 3, fontWeight: 700, fill: "var(--text)" }}>{n.country}</text>
                <text x={n.x} y={n.y + 1} textAnchor="middle"
                  style={{ fontSize: 2.6, fontWeight: 700, fill: isSel ? "#fff" : "var(--text)" }}>{compact(n.total, "USD")}</text>
              </g>
            );
          })}
          {/* HQ star */}
          <circle cx={GEO_HQ.x} cy={GEO_HQ.y} r={1.3} fill="var(--accent, #c9a227)" stroke="#fff" strokeWidth={0.4} />
        </svg>
        <div className="absolute bottom-2 left-3 text-[10px]" style={{ color: "var(--text-faint)" }}>
          ● Harare HQ · bubble size = total exposure
        </div>
      </div>

      {/* Drill-in panel */}
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {sel ? (
          <>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>{sel.country}</h3>
              <span className="text-lg font-bold tabular" style={{ color: "var(--brand)" }}>{compact(sel.total, "USD")}</span>
            </div>
            <div className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
              {sel.holdingValue > 0 && <>Portfolio {compact(sel.holdingValue, "USD")}</>}
              {sel.holdingValue > 0 && sel.dealValue > 0 && " · "}
              {sel.dealValue > 0 && <>Pipeline {compact(sel.dealValue, "USD")}</>}
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {sel.items.sort((a, b) => b.value - a.value).map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm py-1 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <span className="min-w-0 truncate" style={{ color: "var(--text)" }}>
                    <span className="inline-block h-2 w-2 rounded-sm mr-2 align-middle" style={{ background: it.kind === "holding" ? "var(--brand)" : "var(--lz-blue-fg)" }} />
                    {it.name}
                  </span>
                  <span className="shrink-0 tabular font-medium" style={{ color: "var(--text-muted)" }}>{compact(it.value, "USD")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[10px]" style={{ color: "var(--text-faint)" }}>
              <span><span className="inline-block h-2 w-2 rounded-sm mr-1 align-middle" style={{ background: "var(--brand)" }} />Holding</span>
              <span><span className="inline-block h-2 w-2 rounded-sm mr-1 align-middle" style={{ background: "var(--lz-blue-fg)" }} />Pipeline deal</span>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No geographic exposure to show yet.</p>
        )}
      </div>
    </div>
  );
}
