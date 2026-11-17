"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeSolar, downloadSolarWorkbook, KHAYAH_SOLAR, SolarInputs } from "@/lib/solarmodel";
import { Section, NumField, Tabs } from "@/components/model/ModelKit";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { compact } from "@/lib/format";

const money = (v: number) => compact(v, "USD");
const pct = (v: number | null) => (v == null ? "n/a" : `${(v * 100).toFixed(1)}%`);
type Tab = "overview" | "projection" | "sensitivity";
const TAB_ITEMS = [
  { key: "overview" as const, label: "Assumptions & Summary" },
  { key: "projection" as const, label: "Projection" },
  { key: "sensitivity" as const, label: "Sensitivity" },
];

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "pos" | "neg" }) {
  return (
    <Card className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className="text-lg font-semibold tabular" style={{ color: tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--text)" }}>{value}</span>
      {hint && <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{hint}</span>}
    </Card>
  );
}

export default function SolarModel() {
  const [inp, setInp] = useState<SolarInputs>(KHAYAH_SOLAR);
  const [tab, setTab] = useState<Tab>("overview");
  const set = (k: keyof SolarInputs, v: number) => setInp((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => computeSolar(inp), [inp]);

  const csv = () => {
    const head = ["Year", "Generation MWh", "Tariff", "Revenue", "Opex", "EBITDA", "Debt service", "DSCR", "Tax", "Project FCF", "Equity CF"];
    const rows = r.years.map((y) => [y.year, y.genMWh.toFixed(0), y.tariff.toFixed(4), y.revenue.toFixed(0), y.opex.toFixed(0), y.ebitda.toFixed(0), y.debtService.toFixed(0), y.dscr?.toFixed(2) ?? "", y.tax.toFixed(0), y.projectFCF.toFixed(0), y.equityCF.toFixed(0)]);
    const content = [head, ...rows].map((r2) => r2.join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "solar-projection.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // sensitivity: equity IRR over tariff × EPC cost
  const tariffs = [-0.1, -0.05, 0, 0.05, 0.1];
  const epcs = [-0.1, 0, 0.1];
  const grid = epcs.map((e) => tariffs.map((t) => computeSolar({ ...inp, tariffCOD: inp.tariffCOD * (1 + t), epcPerWp: inp.epcPerWp * (1 + e) }).equityIRR));

  const maxCum = Math.max(1, ...r.years.map((y) => Math.abs(y.cumProject)), r.totalUses);

  return (
    <div>
      <PageHeader
        title="Solar PV (IPP) — project finance"
        subtitle="Full Khayah-style model: degradation, PPA tariff escalation, senior debt with DSCR, tax & depreciation, project & equity IRR and LCOE. Export to Excel with live formulas."
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadSolarWorkbook(inp, "Rulethu-Solar-Model.xlsx")} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13l2 2 4-4" /></svg>
              Download Excel (formulas)
            </button>
            <button onClick={csv} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>CSV</button>
            <button onClick={() => setInp(KHAYAH_SOLAR)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Reset to Khayah</button>
            <Link href="/investments/models" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Models hub</Link>
          </div>
        }
      />
      <ModuleTabs moduleKey="investments" />
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-[420px] lg:shrink-0">
            <Section title="Project & output" cols={2}>
              <NumField label="Park size (DC)" value={inp.parkMWp} onChange={(v) => set("parkMWp", v)} suffix="MWp" step={1} />
              <NumField label="Specific yield (P50)" value={inp.specificYield} onChange={(v) => set("specificYield", v)} suffix="kWh/kWp" step={50} />
              <NumField label="Yr-1 degradation" value={inp.degYr1 * 100} onChange={(v) => set("degYr1", v / 100)} suffix="%" step={0.5} />
              <NumField label="Stable degradation" value={inp.degStable * 100} onChange={(v) => set("degStable", v / 100)} suffix="%" step={0.1} />
            </Section>
            <Section title="Revenue — PPA" cols={2}>
              <NumField label="Tariff at COD" value={inp.tariffCOD} onChange={(v) => set("tariffCOD", v)} suffix="$/kWh" step={0.005} />
              <NumField label="Tariff escalation" value={inp.tariffEsc * 100} onChange={(v) => set("tariffEsc", v / 100)} suffix="%" step={0.5} />
              <NumField label="PPA term" value={inp.ppaTermYears} onChange={(v) => set("ppaTermYears", v)} suffix="yrs" step={1} />
            </Section>
            <Section title="Opex (Year 1)" cols={2}>
              <NumField label="O&M" value={inp.omPerKwp} onChange={(v) => set("omPerKwp", v)} suffix="$/kWp" step={1} />
              <NumField label="Insurance" value={inp.insurance} onChange={(v) => set("insurance", v)} suffix="$" step={5000} />
              <NumField label="Management" value={inp.mgmtPctRev * 100} onChange={(v) => set("mgmtPctRev", v / 100)} suffix="% rev" step={0.5} />
              <NumField label="Security" value={inp.security} onChange={(v) => set("security", v)} suffix="$" step={5000} />
              <NumField label="G&A" value={inp.ga} onChange={(v) => set("ga", v)} suffix="$" step={5000} />
              <NumField label="Opex escalation" value={inp.opexEsc * 100} onChange={(v) => set("opexEsc", v / 100)} suffix="%" step={0.5} />
            </Section>
            <Section title="Capex" cols={2}>
              <NumField label="EPC + owner's" value={inp.epcPerWp} onChange={(v) => set("epcPerWp", v)} suffix="$/Wp" step={0.05} />
              <NumField label="Development" value={inp.developmentCost} onChange={(v) => set("developmentCost", v)} suffix="$" step={50000} />
              <NumField label="Contingency" value={inp.contingencyPct * 100} onChange={(v) => set("contingencyPct", v / 100)} suffix="% EPC" step={1} />
              <NumField label="Financing costs" value={inp.financingCostsPctDebt * 100} onChange={(v) => set("financingCostsPctDebt", v / 100)} suffix="% debt" step={1} />
              <NumField label="Initial WC" value={inp.initialWC} onChange={(v) => set("initialWC", v)} suffix="$" step={25000} />
            </Section>
            <Section title="Financing & tax" cols={2}>
              <NumField label="Gearing (sr debt)" value={inp.gearingPct * 100} onChange={(v) => set("gearingPct", v / 100)} suffix="%" step={5} />
              <NumField label="Senior tenor" value={inp.seniorTenorYears} onChange={(v) => set("seniorTenorYears", v)} suffix="yrs" step={1} />
              <NumField label="Senior rate" value={inp.seniorRate * 100} onChange={(v) => set("seniorRate", v / 100)} suffix="%" step={0.25} />
              <NumField label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={0.5} />
              <NumField label="Depreciation" value={inp.depreciationYears} onChange={(v) => set("depreciationYears", v)} suffix="yrs" step={1} />
              <NumField label="Discount rate" value={inp.discountRate * 100} onChange={(v) => set("discountRate", v / 100)} suffix="%" step={0.5} />
            </Section>
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Project IRR" value={pct(r.projectIRR)} tone={r.projectIRR && r.projectIRR >= inp.discountRate ? "pos" : "neg"} />
              <Kpi label="Equity IRR" value={pct(r.equityIRR)} tone="pos" />
              <Kpi label="Min DSCR" value={r.minDSCR?.toFixed(2) ?? "n/a"} hint="≥1.2x is bankable" tone={r.minDSCR && r.minDSCR >= 1.2 ? "pos" : "neg"} />
              <Kpi label="Avg DSCR" value={r.avgDSCR?.toFixed(2) ?? "n/a"} />
              <Kpi label="Project NPV" value={money(r.projectNPV)} tone={r.projectNPV >= 0 ? "pos" : "neg"} />
              <Kpi label="LCOE" value={`$${r.lcoe.toFixed(3)}/kWh`} hint="all-in cost of power" />
              <Kpi label="Payback" value={r.paybackYears ? `${r.paybackYears} yrs` : ">term"} />
              <Kpi label="EBITDA margin" value={pct(r.ebitdaMarginAvg)} hint="life average" />
            </div>

            <Card>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Sources &amp; Uses</h3>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                <Row k="EPC + owner's cost" v={money(r.epc)} />
                <Row k="Senior debt" v={money(r.seniorDebt)} />
                <Row k="Contingency" v={money(r.contingency)} />
                <Row k="Equity (SHL + pref + ord.)" v={money(r.equity)} />
                <Row k="Development + financing + WC" v={money(r.totalUses - r.epc - r.contingency)} />
                <Row k="Cost per MWp" v={money(r.costPerMWp)} />
                <div className="sm:col-span-2 flex justify-between py-1.5 mt-1 px-2 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <span className="font-semibold" style={{ color: "var(--text)" }}>Total uses of funds</span>
                  <span className="font-semibold tabular" style={{ color: "var(--text)" }}>{money(r.totalUses)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Cumulative project cash flow</h3>
              <svg width="100%" viewBox="0 0 720 150" style={{ display: "block" }}>
                <line x1={16} y1={115} x2={704} y2={115} stroke="var(--border)" />
                {[{ year: 0, cum: -r.totalUses }, ...r.years.map((y) => ({ year: y.year, cum: y.cumProject }))].map((b, i, arr) => {
                  const bw = (720 - 32) / arr.length;
                  const h = (Math.abs(b.cum) / maxCum) * 92;
                  const x = 16 + i * bw + bw * 0.15;
                  const w = bw * 0.7;
                  const yy = b.cum >= 0 ? 115 - h : 115;
                  return <g key={i}><rect x={x} y={yy} width={w} height={h} rx={2} fill={b.cum >= 0 ? "var(--pos)" : "var(--neg)"} />{i % 3 === 0 && <text x={x + w / 2} y={132} fontSize={9} textAnchor="middle" fill="var(--text-faint)">{b.year}</text>}</g>;
                })}
              </svg>
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Year 0 is total construction cost; green once the project has paid back.</p>
            </Card>
            <div className="rounded-lg border p-3 flex gap-2.5" style={{ borderColor: "var(--border)", background: "var(--lz-green-bg)" }}>
              <span style={{ color: "var(--lz-green-fg)" }}>📗</span>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}><b>Download Excel (formulas)</b> gives your client a real .xlsx — Inputs, Sources &amp; Uses, a year-by-year Model and a Summary — all <b>linked by live formulas</b> (IRR, NPV, DSCR), so they can change any input in Excel and everything recalculates.</p>
            </div>
          </div>
        </div>
      )}

      {tab === "projection" && (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--surface-2)" }}>
                <tr>{["Year", "Gen MWh", "Tariff", "Revenue", "Opex", "EBITDA", "Debt svc", "DSCR", "Tax", "Project FCF", "Equity CF"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`} style={{ color: "var(--text-faint)" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {r.years.map((y) => (
                  <tr key={y.year}>
                    <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{y.year}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{y.genMWh.toFixed(0)}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>${y.tariff.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{money(y.revenue)}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{money(y.opex)}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{money(y.ebitda)}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{y.debtService ? money(y.debtService) : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: y.dscr && y.dscr < 1.2 ? "var(--neg)" : "var(--text)" }}>{y.dscr?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{money(y.tax)}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{money(y.projectFCF)}</td>
                    <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: y.equityCF >= 0 ? "var(--pos)" : "var(--neg)" }}>{money(y.equityCF)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "sensitivity" && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>Equity IRR — tariff vs EPC cost</h3>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>Rows: EPC cost change · Columns: tariff change</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--surface-2)" }}>
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase" style={{ color: "var(--text-faint)" }}>EPC \ Tariff</th>
                  {tariffs.map((t) => <th key={t} className="px-4 py-2 text-right text-[11px] font-semibold uppercase" style={{ color: "var(--text-faint)" }}>{t > 0 ? "+" : ""}{(t * 100).toFixed(0)}%</th>)}
                </tr>
              </thead>
              <tbody>
                {epcs.map((e, ei) => (
                  <tr key={e}>
                    <td className="px-4 py-2 font-medium" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{e > 0 ? "+" : ""}{(e * 100).toFixed(0)}%</td>
                    {grid[ei].map((v, ti) => (
                      <td key={ti} className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: v == null ? "var(--text-faint)" : v >= inp.discountRate ? "var(--pos)" : "var(--neg)", background: ti === 2 && ei === 1 ? "var(--surface-2)" : undefined }}>{pct(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>{k}</span><span className="tabular font-medium" style={{ color: "var(--text)" }}>{v}</span></div>;
}
