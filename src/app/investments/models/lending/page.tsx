"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeLending, lendingSensitivity, LendingInputs } from "@/lib/finmodels";
import { Section, NumField, Tabs, ModelKpis, ModelChartCard, ModelTableCard, GridTable } from "@/components/model/ModelKit";
import { PageHeader } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

const SAMPLE: LendingInputs = {
  openingBook: 200_000, bookGrowthPct: 0.35,
  portfolioYield: 0.60, fundingShare: 0.6, costOfFunds: 0.16,
  opexRatio: 0.35, lossRate: 0.05, taxRate: 0.2472,
  years: 5, equity: 120_000, ke: 0.25, kd: 0.16, debtShare: 0.5,
  terminalGrowthPct: 0.03, exitEbitdaMultiple: 5, netDebt: 60_000,
};
type Tab = "overview" | "projection" | "sensitivity";
const TAB_ITEMS = [
  { key: "overview" as const, label: "Assumptions & Summary" },
  { key: "projection" as const, label: "Projection" },
  { key: "sensitivity" as const, label: "Sensitivity" },
];

export default function LendingModel() {
  const [inp, setInp] = useState<LendingInputs>(SAMPLE);
  const [tab, setTab] = useState<Tab>("overview");
  const set = (k: keyof LendingInputs, v: number) => setInp((p) => ({ ...p, [k]: v }) as LendingInputs);
  const r = useMemo(() => computeLending(inp), [inp]);
  const sens = useMemo(() => lendingSensitivity(inp), [inp]);

  return (
    <div>
      <PageHeader
        title="Lending / Microfinance — Valuation"
        subtitle="Loan-book growth, portfolio yield, cost of funds, provisions and ROE, drawn into a DCF valuation."
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
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-[380px] lg:shrink-0">
            <Section title="Loan book" cols={2}>
              <NumField label="Opening book" value={inp.openingBook} onChange={(v) => set("openingBook", v)} suffix="$" step={10000} />
              <NumField label="Annual growth" value={inp.bookGrowthPct * 100} onChange={(v) => set("bookGrowthPct", v / 100)} suffix="%" step={5} />
              <NumField label="Projection years" value={inp.years} onChange={(v) => set("years", v)} suffix="yrs" step={1} />
            </Section>
            <Section title="Income & cost" cols={2}>
              <NumField label="Portfolio yield" value={inp.portfolioYield * 100} onChange={(v) => set("portfolioYield", v / 100)} suffix="%" step={1} hint="effective interest on book" />
              <NumField label="Funding share" value={inp.fundingShare * 100} onChange={(v) => set("fundingShare", v / 100)} suffix="%" step={5} hint="of book that is borrowed" />
              <NumField label="Cost of funds" value={inp.costOfFunds * 100} onChange={(v) => set("costOfFunds", v / 100)} suffix="%" step={0.5} />
              <NumField label="Opex ratio" value={inp.opexRatio * 100} onChange={(v) => set("opexRatio", v / 100)} suffix="% inc" step={1} />
              <NumField label="Loss / provisions" value={inp.lossRate * 100} onChange={(v) => set("lossRate", v / 100)} suffix="% book" step={0.5} />
              <NumField label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={0.5} />
            </Section>
            <Section title="Valuation" cols={2}>
              <NumField label="Equity invested" value={inp.equity} onChange={(v) => set("equity", v)} suffix="$" step={10000} />
              <NumField label="Net debt" value={inp.netDebt} onChange={(v) => set("netDebt", v)} suffix="$" step={10000} />
              <NumField label="Cost of equity" value={inp.ke * 100} onChange={(v) => set("ke", v / 100)} suffix="%" step={1} />
              <NumField label="Cost of debt" value={inp.kd * 100} onChange={(v) => set("kd", v / 100)} suffix="%" step={0.5} />
              <NumField label="Debt share (WACC)" value={inp.debtShare * 100} onChange={(v) => set("debtShare", v / 100)} suffix="%" step={5} />
              <NumField label="Terminal growth" value={inp.terminalGrowthPct * 100} onChange={(v) => set("terminalGrowthPct", v / 100)} suffix="%" step={0.5} />
              <NumField label="Exit EBITDA multiple" value={inp.exitEbitdaMultiple} onChange={(v) => set("exitEbitdaMultiple", v)} suffix="x" step={0.5} />
            </Section>
          </div>
          <div className="flex-1 min-w-0 w-full space-y-4">
            <ModelKpis kpis={r.kpis} />
            <ModelChartCard bars={r.bars} title="Net income" />
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
        <div>
          <GridTable columns={sens.columns} rows={sens.rows} firstColLabel="Portfolio yield" />
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>How the valuation and ROE move as the portfolio yield shifts ±10 points.</p>
        </div>
      )}
    </div>
  );
}
