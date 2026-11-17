"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeDCF, DCF_SAMPLE, DCFInputs } from "@/lib/dcf";
import { Section, NumField, Tabs, ModelKpis, ModelChartCard, ModelTableCard } from "@/components/model/ModelKit";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { compact } from "@/lib/format";

const money = (v: number) => compact(v, "USD");
type Tab = "overview" | "projection" | "sensitivity";
const TAB_ITEMS = [
  { key: "overview" as const, label: "Assumptions & Summary" },
  { key: "projection" as const, label: "Projection" },
  { key: "sensitivity" as const, label: "Sensitivity" },
];

export default function DCFPage() {
  const [inp, setInp] = useState<DCFInputs>(DCF_SAMPLE);
  const [tab, setTab] = useState<Tab>("overview");
  const set = (k: keyof DCFInputs, v: number) => setInp((p) => ({ ...p, [k]: v }) as DCFInputs);
  const r = useMemo(() => computeDCF(inp), [inp]);

  return (
    <div>
      <PageHeader
        title="DCF Valuation"
        subtitle="A full company DCF — WACC via CAPM, unlevered free cash flow, terminal value, enterprise → equity value, per share, with a sensitivity matrix."
        actions={
          <div className="flex gap-2">
            <button onClick={() => setInp(DCF_SAMPLE)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Reset to sample</button>
            <Link href="/investments/models" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Models hub</Link>
          </div>
        }
      />
      <ModuleTabs moduleKey="investments" />
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-[400px] lg:shrink-0">
            <Section title="Operating forecast" cols={2}>
              <NumField label="Revenue (Yr 0)" value={inp.revenue0} onChange={(v) => set("revenue0", v)} suffix="$" step={1000000} />
              <NumField label="Forecast years" value={inp.years} onChange={(v) => set("years", v)} suffix="yrs" step={1} />
              <NumField label="Revenue growth (Yr 1)" value={inp.growthStart * 100} onChange={(v) => set("growthStart", v / 100)} suffix="%" step={1} hint="fades to terminal growth" />
              <NumField label="EBIT margin" value={inp.ebitMargin * 100} onChange={(v) => set("ebitMargin", v / 100)} suffix="%" step={1} />
              <NumField label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={1} />
              <NumField label="D&A" value={inp.daPct * 100} onChange={(v) => set("daPct", v / 100)} suffix="% rev" step={0.5} />
              <NumField label="Capex" value={inp.capexPct * 100} onChange={(v) => set("capexPct", v / 100)} suffix="% rev" step={0.5} />
              <NumField label="ΔNWC" value={inp.nwcPct * 100} onChange={(v) => set("nwcPct", v / 100)} suffix="% Δrev" step={1} />
            </Section>
            <Section title="WACC (CAPM)" cols={2}>
              <NumField label="Risk-free rate" value={inp.riskFree * 100} onChange={(v) => set("riskFree", v / 100)} suffix="%" step={0.25} />
              <NumField label="Equity risk premium" value={inp.erp * 100} onChange={(v) => set("erp", v / 100)} suffix="%" step={0.25} />
              <NumField label="Beta" value={inp.beta} onChange={(v) => set("beta", v)} step={0.1} />
              <NumField label="Cost of debt (pre-tax)" value={inp.costOfDebt * 100} onChange={(v) => set("costOfDebt", v / 100)} suffix="%" step={0.5} />
              <NumField label="Debt weight" value={inp.debtWeight * 100} onChange={(v) => set("debtWeight", v / 100)} suffix="%" step={5} />
            </Section>
            <Section title="Terminal & equity" cols={2}>
              <label className="block sm:col-span-2"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Terminal method</span>
                <select value={inp.useExitMultiple ? "exit" : "perp"} onChange={(e) => setInp((p) => ({ ...p, useExitMultiple: e.target.value === "exit" }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  <option value="perp">Perpetuity growth</option><option value="exit">Exit EV/EBITDA multiple</option>
                </select>
              </label>
              <NumField label="Terminal growth" value={inp.terminalGrowth * 100} onChange={(v) => set("terminalGrowth", v / 100)} suffix="%" step={0.25} />
              <NumField label="Exit EV/EBITDA" value={inp.exitMultiple} onChange={(v) => set("exitMultiple", v)} suffix="x" step={0.5} />
              <NumField label="Net debt" value={inp.netDebt} onChange={(v) => set("netDebt", v)} suffix="$" step={1000000} />
              <NumField label="Shares outstanding" value={inp.shares} onChange={(v) => set("shares", v)} step={1000000} />
            </Section>
          </div>
          <div className="flex-1 min-w-0 w-full space-y-4">
            <ModelKpis kpis={r.kpis} />
            <Card>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Valuation bridge</h3>
              <div className="space-y-1.5 text-sm">
                <Row k="PV of forecast FCF" v={money(r.sumPvFcf)} />
                <Row k={`PV of terminal (${inp.useExitMultiple ? "exit multiple" : "perpetuity"})`} v={money(r.pvTV)} />
                <div className="flex justify-between py-1.5 px-2 rounded-lg font-semibold" style={{ background: "var(--surface-2)" }}><span style={{ color: "var(--text)" }}>Enterprise value</span><span className="tabular" style={{ color: "var(--text)" }}>{money(r.ev)}</span></div>
                <Row k="Less: net debt" v={"(" + money(inp.netDebt) + ")"} />
                <div className="flex justify-between py-1.5 px-2 rounded-lg font-semibold" style={{ background: "var(--surface-2)" }}><span style={{ color: "var(--text)" }}>Equity value</span><span className="tabular" style={{ color: "var(--pos)" }}>{money(r.equity)}</span></div>
                <Row k="Terminal value (perpetuity)" v={money(r.tvPerp)} />
                <Row k="Terminal value (exit multiple)" v={money(r.tvExit)} />
              </div>
            </Card>
            <ModelChartCard bars={r.bars} title="Unlevered free cash flow" />
          </div>
        </div>
      )}

      {tab === "projection" && (
        <div className="space-y-4">
          <ModelKpis kpis={r.kpis} />
          <ModelTableCard columns={r.columns} rows={r.rows} />
        </div>
      )}

      {tab === "sensitivity" && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}><span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Value per share</span> <span className="text-xs" style={{ color: "var(--text-faint)" }}>· WACC (rows) × terminal growth (columns)</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ background: "var(--surface-2)" }}>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase" style={{ color: "var(--text-faint)" }}>WACC ＼ g</th>
                {r.sensitivity.growths.map((g, i) => <th key={i} className="px-4 py-2 text-right text-[11px] font-semibold" style={{ color: "var(--text-faint)" }}>{(g * 100).toFixed(1)}%</th>)}
              </tr></thead>
              <tbody>
                {r.sensitivity.waccs.map((w, wi) => (
                  <tr key={wi}>
                    <td className="px-4 py-2 font-medium" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{(w * 100).toFixed(1)}%</td>
                    {r.sensitivity.grid[wi].map((val, gi) => {
                      const isBase = wi === 2 && gi === 2;
                      return <td key={gi} className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", background: isBase ? "color-mix(in srgb, var(--brand) 14%, transparent)" : "transparent", fontWeight: isBase ? 700 : 400, color: "var(--text)" }}>${isFinite(val) ? val.toFixed(2) : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Highlighted cell is the base case. Each cell recomputes the full DCF at that WACC and terminal growth.</p>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>{k}</span><span className="tabular font-medium" style={{ color: "var(--text)" }}>{v}</span></div>;
}
