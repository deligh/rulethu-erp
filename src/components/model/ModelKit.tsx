"use client";

import React from "react";
import { ModelResult } from "@/lib/finmodels";
import { Card } from "@/components/ui";

export function Section({ title, children, cols = 3 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <Card className="mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>{title}</h3>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>{children}</div>
    </Card>
  );
}

export function NumField({
  label, value, onChange, suffix, step = 1, hint,
}: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="mt-1 flex items-center rounded-md border px-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-transparent py-1.5 text-sm outline-none tabular"
        />
        {suffix && <span className="pl-1.5 text-xs shrink-0" style={{ color: "var(--text-faint)" }}>{suffix}</span>}
      </div>
      {hint && <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-faint)" }}>{hint}</span>}
    </label>
  );
}

/** Underline tab bar for a model's internal sections. */
export function Tabs<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <div className="flex gap-1 min-w-max">
        {items.map((t) => (
          <button key={t.key} onClick={() => onChange(t.key)} className="relative px-3 py-2.5 text-sm font-medium whitespace-nowrap" style={{ color: value === t.key ? "var(--brand)" : "var(--text-muted)" }}>
            {t.label}
            {value === t.key && <span className="absolute left-0 right-0 -bottom-px h-0.5" style={{ background: "var(--brand)" }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModelKpis({ kpis }: { kpis: ModelResult["kpis"] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((k) => (
        <Card key={k.label} className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{k.label}</span>
          <span className="text-xl font-semibold tabular" style={{ color: k.tone === "pos" ? "var(--pos)" : k.tone === "neg" ? "var(--neg)" : "var(--text)" }}>{k.value}</span>
          {k.hint && <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{k.hint}</span>}
        </Card>
      ))}
    </div>
  );
}

function MiniBars({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;
  const W = 720, H = 140, pad = 18;
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const bw = (W - pad * 2) / data.length;
  const zeroY = pad + (H - pad * 2) / 2;
  const half = (H - pad * 2) / 2;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="var(--border)" />
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * half;
        const x = pad + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const y = d.value >= 0 ? zeroY - h : zeroY;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={2} fill={d.value >= 0 ? "var(--pos)" : "var(--neg)"} />
            <text x={x + w / 2} y={H - 4} fontSize={9} textAnchor="middle" fill="var(--text-faint)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ModelChartCard({ bars, title = "Free cash flow" }: { bars: ModelResult["bars"]; title?: string }) {
  return (
    <Card>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>{title}</h3>
      <MiniBars data={bars} />
    </Card>
  );
}

export function ModelTableCard({ columns, rows }: { columns: ModelResult["columns"]; rows: ModelResult["rows"] }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider sticky left-0" style={{ color: "var(--text-faint)", background: "var(--surface-2)" }}>Line</th>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-faint)" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={r.section ? { background: "var(--surface-2)" } : undefined}>
                <td className={`px-3 py-1.5 whitespace-nowrap sticky left-0 ${r.strong ? "font-semibold" : ""} ${r.section ? "text-[11px] uppercase tracking-wider" : ""}`} style={{ borderTop: "1px solid var(--border)", color: r.section ? "var(--text-faint)" : "var(--text)", background: r.section ? "var(--surface-2)" : "var(--surface)" }}>{r.label}</td>
                {r.cells.map((c, ci) => (
                  <td key={ci} className={`px-3 py-1.5 text-right tabular whitespace-nowrap ${r.strong ? "font-semibold" : ""}`} style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Generic small table for sensitivity / analysis grids. */
export function GridTable({ columns, rows, firstColLabel = "" }: { columns: string[]; rows: { label: string; cells: string[] }[]; firstColLabel?: string }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{firstColLabel}</th>
              {columns.map((c) => <th key={c} className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-faint)" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-2 whitespace-nowrap" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{r.label}</td>
                {r.cells.map((c, ci) => <td key={ci} className="px-4 py-2 text-right tabular whitespace-nowrap" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ModelResults({ result }: { result: ModelResult }) {
  return (
    <div className="space-y-4">
      <ModelKpis kpis={result.kpis} />
      <ModelChartCard bars={result.bars} />
      <ModelTableCard columns={result.columns} rows={result.rows} />
      {result.note && <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{result.note}</p>}
    </div>
  );
}
