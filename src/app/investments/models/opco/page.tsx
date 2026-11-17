"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeOpco, opcoSensitivity, OpcoInputs, OpcoLine } from "@/lib/finmodels";
import { NumField, Tabs, ModelKpis, ModelChartCard, ModelTableCard, GridTable } from "@/components/model/ModelKit";
import { PageHeader, Card } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

const SAMPLE: OpcoInputs = {
  years: 5, taxRate: 0.25, discountRate: 0.15, terminalGrowthPct: 0.03,
  lines: [
    { name: "Guards", year1Revenue: 886_085, growthPct: 0.6, netMarginPct: 0.073, startYear: 1, initialInvestment: 283_009 },
    { name: "Security Shop", year1Revenue: 25_833, growthPct: 0.5, netMarginPct: 0.09, startYear: 1, initialInvestment: 33_048 },
    { name: "Security Consultancy", year1Revenue: 10_062, growthPct: 0.7, netMarginPct: 0.05, startYear: 1, initialInvestment: 143_634 },
    { name: "Rapid Response", year1Revenue: 123_750, growthPct: 0.37, netMarginPct: 0.17, startYear: 2, initialInvestment: 97_591 },
    { name: "CIT Services", year1Revenue: 82_333, growthPct: 0.6, netMarginPct: 0.13, startYear: 2, initialInvestment: 80_748 },
    { name: "Custodial Services", year1Revenue: 260_416, growthPct: 1.8, netMarginPct: 0.41, startYear: 2, initialInvestment: 1_007_404 },
  ],
};
type Tab = "overview" | "projection" | "sensitivity";
const TAB_ITEMS = [
  { key: "overview" as const, label: "Assumptions & Summary" },
  { key: "projection" as const, label: "Projection" },
  { key: "sensitivity" as const, label: "Sensitivity" },
];

export default function OpcoModel() {
  const [inp, setInp] = useState<OpcoInputs>(SAMPLE);
  const [tab, setTab] = useState<Tab>("overview");
  const set = (k: "years" | "taxRate" | "discountRate" | "terminalGrowthPct", v: number) => setInp((p) => ({ ...p, [k]: v }));
  const setLine = (i: number, patch: Partial<OpcoLine>) => setInp((p) => ({ ...p, lines: p.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  const addLine = () => setInp((p) => ({ ...p, lines: [...p.lines, { name: "New line", year1Revenue: 100_000, growthPct: 0.2, netMarginPct: 0.1, startYear: 1, initialInvestment: 50_000 }] }));
  const delLine = (i: number) => setInp((p) => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }));
  const r = useMemo(() => computeOpco(inp), [inp]);
  const sens = useMemo(() => opcoSensitivity(inp), [inp]);

  const cell = "rounded-md border px-2 py-1 text-sm tabular w-full";
  const cellStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  return (
    <div>
      <PageHeader
        title="Multi-Service Operating Company"
        subtitle="Roll several revenue lines into one P&L, cash flow, IRR and NPV — add or remove lines as the business grows."
        actions={
          <div className="flex gap-2">
            <button onClick={() => setInp(SAMPLE)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Reset to sample</button>
            <Link href="/investments/models" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>All models</Link>
          </div>
        }
      />
      <ModuleTabs moduleKey="investments" />
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Revenue lines</h3>
              <button onClick={addLine} className="text-sm font-medium" style={{ color: "var(--brand)" }}>+ Add line</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-faint)" }}>
                    {["Line", "Yr-1 revenue", "Growth %", "Net margin %", "Start yr", "Investment", ""].map((h) => (
                      <th key={h} className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inp.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1"><input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} className={cell} style={cellStyle} /></td>
                      <td className="px-2 py-1"><input type="number" value={l.year1Revenue} step={10000} onChange={(e) => setLine(i, { year1Revenue: +e.target.value })} className={cell + " text-right"} style={cellStyle} /></td>
                      <td className="px-2 py-1"><input type="number" value={Math.round(l.growthPct * 100)} step={5} onChange={(e) => setLine(i, { growthPct: +e.target.value / 100 })} className={cell + " text-right"} style={cellStyle} /></td>
                      <td className="px-2 py-1"><input type="number" value={Math.round(l.netMarginPct * 100)} step={1} onChange={(e) => setLine(i, { netMarginPct: +e.target.value / 100 })} className={cell + " text-right"} style={cellStyle} /></td>
                      <td className="px-2 py-1"><input type="number" value={l.startYear} step={1} min={1} onChange={(e) => setLine(i, { startYear: +e.target.value })} className={cell + " text-right"} style={cellStyle} /></td>
                      <td className="px-2 py-1"><input type="number" value={l.initialInvestment} step={10000} onChange={(e) => setLine(i, { initialInvestment: +e.target.value })} className={cell + " text-right"} style={cellStyle} /></td>
                      <td className="px-2 py-1 text-center"><button onClick={() => delLine(i)} style={{ color: "var(--text-faint)" }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid sm:grid-cols-4 gap-3 mt-4">
              <NumField label="Projection years" value={inp.years} onChange={(v) => set("years", v)} suffix="yrs" step={1} />
              <NumField label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={1} />
              <NumField label="Discount rate" value={inp.discountRate * 100} onChange={(v) => set("discountRate", v / 100)} suffix="%" step={0.5} />
              <NumField label="Terminal growth" value={inp.terminalGrowthPct * 100} onChange={(v) => set("terminalGrowthPct", v / 100)} suffix="%" step={0.5} />
            </div>
          </Card>
          <ModelKpis kpis={r.kpis} />
          <ModelChartCard bars={r.bars} />
        </div>
      )}

      {tab === "projection" && (
        <div className="space-y-4">
          <ModelKpis kpis={r.kpis} />
          <ModelTableCard columns={r.columns} rows={r.rows} />
        </div>
      )}

      {tab === "sensitivity" && (
        <div>
          <GridTable columns={sens.columns} rows={sens.rows} firstColLabel="Growth scenario" />
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>How consolidated returns move as every line&apos;s growth rate shifts ±20 points.</p>
        </div>
      )}
    </div>
  );
}
