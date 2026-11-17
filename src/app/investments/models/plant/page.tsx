"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { computeProjectFinance, pfSensitivity, ProjectFinanceInputs } from "@/lib/finmodels";
import { Section, NumField, Tabs, ModelKpis, ModelChartCard, ModelTableCard, GridTable } from "@/components/model/ModelKit";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

type Preset = { label: string; sector: string; inputs: ProjectFinanceInputs };
const P = (o: Partial<ProjectFinanceInputs>): ProjectFinanceInputs => ({
  energy: false, unit: "tons", capex: 8_000_000, operatingYears: 20, annualOutput: 3_000, utilizationPct: 0.85,
  degradationPct: 0, pricePerUnit: 3_500, priceEscalationPct: 0.03, variableCostPerUnit: 2_600, fixedOpex: 700_000,
  opexEscalationPct: 0.033, depreciationYears: 15, debtPct: 0.7, interestRate: 0.15, debtTenorYears: 10,
  taxRate: 0.25, discountRate: 0.12, terminalGrowthPct: 0.02, ...o,
});

export const PRESETS: Record<string, Preset> = {
  aluminium: { label: "Aluminium cable", sector: "Manufacturing", inputs: P({ unit: "tons", capex: 8_000_000, annualOutput: 3_000, pricePerUnit: 3_500, variableCostPerUnit: 2_600, fixedOpex: 700_000 }) },
  cement: { label: "Cement plant", sector: "Manufacturing", inputs: P({ unit: "tons", capex: 15_000_000, annualOutput: 200_000, utilizationPct: 0.8, pricePerUnit: 120, variableCostPerUnit: 55, fixedOpex: 2_000_000, depreciationYears: 20, debtPct: 0.6, discountRate: 0.13 }) },
  plastics: { label: "Plastics manufacturing", sector: "Manufacturing", inputs: P({ unit: "tons", capex: 4_000_000, annualOutput: 5_000, utilizationPct: 0.8, pricePerUnit: 2_200, variableCostPerUnit: 1_400, fixedOpex: 600_000, depreciationYears: 12, debtPct: 0.6, debtTenorYears: 7, discountRate: 0.13 }) },
  bricks: { label: "Clay bricks", sector: "Manufacturing", inputs: P({ unit: "'000 bricks", capex: 7_063_400, operatingYears: 10, annualOutput: 156_000, utilizationPct: 0.9, pricePerUnit: 108, variableCostPerUnit: 45, fixedOpex: 900_000, depreciationYears: 10, debtPct: 0.6, debtTenorYears: 5 }) },
  mining: { label: "Mining project", sector: "Mining", inputs: P({ unit: "tons", capex: 30_000_000, annualOutput: 60_000, utilizationPct: 0.85, pricePerUnit: 1_500, variableCostPerUnit: 700, fixedOpex: 4_000_000, depreciationYears: 12, debtPct: 0.5, interestRate: 0.14, debtTenorYears: 8, discountRate: 0.16 }) },
  power: { label: "Thermal / hydro power", sector: "Power", inputs: P({ energy: true, unit: "MWh", capex: 40_000_000, annualOutput: 250_000, utilizationPct: 0.6, pricePerUnit: 90, variableCostPerUnit: 35, fixedOpex: 3_000_000, depreciationYears: 20, debtPct: 0.7, interestRate: 0.13, debtTenorYears: 12, discountRate: 0.11 }) },
  toll: { label: "Toll road (concession)", sector: "Infrastructure", inputs: P({ unit: "vehicles", capex: 25_000_000, operatingYears: 20, annualOutput: 3_650_000, utilizationPct: 1.0, pricePerUnit: 2, priceEscalationPct: 0.05, variableCostPerUnit: 0.2, fixedOpex: 1_500_000, depreciationYears: 25, debtPct: 0.65, interestRate: 0.13, debtTenorYears: 15, discountRate: 0.12 }) },
  housing: { label: "Housing development", sector: "Infrastructure", inputs: P({ unit: "units", capex: 6_000_000, operatingYears: 6, annualOutput: 60, utilizationPct: 1.0, pricePerUnit: 85_000, priceEscalationPct: 0.04, variableCostPerUnit: 55_000, fixedOpex: 400_000, depreciationYears: 6, debtPct: 0.5, interestRate: 0.15, debtTenorYears: 5, discountRate: 0.16 }) },
  water: { label: "Water utility (concession)", sector: "Infrastructure", inputs: P({ unit: "'000 m³", capex: 18_000_000, operatingYears: 20, annualOutput: 12_000, utilizationPct: 0.85, pricePerUnit: 600, priceEscalationPct: 0.05, variableCostPerUnit: 200, fixedOpex: 1_500_000, depreciationYears: 25, debtPct: 0.6, interestRate: 0.13, debtTenorYears: 15, discountRate: 0.12 }) },
  underground: { label: "Underground mine", sector: "Mining", inputs: P({ unit: "tons", capex: 45_000_000, annualOutput: 40_000, utilizationPct: 0.8, pricePerUnit: 1_800, variableCostPerUnit: 900, fixedOpex: 6_000_000, depreciationYears: 12, debtPct: 0.5, interestRate: 0.14, debtTenorYears: 8, discountRate: 0.17 }) },
  processing: { label: "Mineral processing", sector: "Mining", inputs: P({ unit: "tons", capex: 20_000_000, annualOutput: 100_000, utilizationPct: 0.85, pricePerUnit: 400, variableCostPerUnit: 220, fixedOpex: 3_000_000, depreciationYears: 15, debtPct: 0.55, interestRate: 0.14, debtTenorYears: 8, discountRate: 0.15 }) },
  hydro: { label: "Mini-hydro power", sector: "Energy", inputs: P({ energy: true, unit: "MWh", capex: 22_000_000, annualOutput: 90_000, utilizationPct: 1.0, pricePerUnit: 85, variableCostPerUnit: 5, fixedOpex: 1_200_000, depreciationYears: 25, debtPct: 0.7, interestRate: 0.12, debtTenorYears: 15, discountRate: 0.10 }) },
  maize: { label: "Row crop (maize)", sector: "Agriculture", inputs: P({ unit: "tons", capex: 5_000_000, operatingYears: 10, annualOutput: 8_000, utilizationPct: 0.9, pricePerUnit: 350, priceEscalationPct: 0.03, variableCostPerUnit: 180, fixedOpex: 500_000, depreciationYears: 10, debtPct: 0.5, interestRate: 0.15, debtTenorYears: 6, discountRate: 0.16 }) },
  poultry: { label: "Poultry / livestock", sector: "Agriculture", inputs: P({ unit: "birds", capex: 3_000_000, operatingYears: 8, annualOutput: 1_200_000, utilizationPct: 0.9, pricePerUnit: 6, priceEscalationPct: 0.03, variableCostPerUnit: 4.2, fixedOpex: 300_000, depreciationYears: 8, debtPct: 0.5, interestRate: 0.15, debtTenorYears: 5, discountRate: 0.16 }) },
};
const PRESET_KEYS = Object.keys(PRESETS);

type Tab = "overview" | "projection" | "sensitivity";
const TAB_ITEMS = [
  { key: "overview" as const, label: "Assumptions & Summary" },
  { key: "projection" as const, label: "Projection" },
  { key: "sensitivity" as const, label: "Sensitivity" },
];

function PlantInner() {
  const params = useSearchParams();
  const initialKey = params.get("preset") && PRESETS[params.get("preset")!] ? params.get("preset")! : "aluminium";
  const [presetKey, setPresetKey] = useState(initialKey);
  const [inp, setInp] = useState<ProjectFinanceInputs>(PRESETS[initialKey].inputs);
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => { setInp(PRESETS[presetKey].inputs); }, [presetKey]);

  const set = (k: keyof ProjectFinanceInputs, v: number) => setInp((p) => ({ ...p, [k]: v }) as ProjectFinanceInputs);
  const r = useMemo(() => computeProjectFinance(inp), [inp]);
  const sens = useMemo(() => pfSensitivity(inp), [inp]);

  return (
    <div>
      <PageHeader
        title="Manufacturing / Plant — Project Finance"
        subtitle="One project-finance engine across sectors — output ramp, unit economics, DSCR, NPV and equity IRR."
        actions={<Link href="/investments/models" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>All models</Link>}
      />
      <ModuleTabs moduleKey="investments" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: "var(--text-faint)" }}>Preset</span>
        {PRESET_KEYS.map((k) => (
          <button key={k} onClick={() => setPresetKey(k)} className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: presetKey === k ? "var(--brand)" : "var(--border)", background: presetKey === k ? "var(--brand)" : "transparent", color: presetKey === k ? "#fff" : "var(--text-muted)" }}>{PRESETS[k].label}</button>
        ))}
        <Badge tone="neutral">{PRESETS[presetKey].sector}</Badge>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-[380px] lg:shrink-0">
            <Section title="Production" cols={2}>
              <NumField label="Annual capacity" value={inp.annualOutput} onChange={(v) => set("annualOutput", v)} suffix={inp.unit} step={100} />
              <NumField label="Utilisation" value={inp.utilizationPct * 100} onChange={(v) => set("utilizationPct", v / 100)} suffix="%" step={5} />
              <NumField label="Operating years" value={inp.operatingYears} onChange={(v) => set("operatingYears", v)} suffix="yrs" step={1} />
            </Section>
            <Section title="Unit economics" cols={2}>
              <NumField label="Selling price" value={inp.pricePerUnit} onChange={(v) => set("pricePerUnit", v)} suffix={`$/${inp.unit}`} step={10} />
              <NumField label="Price escalation" value={inp.priceEscalationPct * 100} onChange={(v) => set("priceEscalationPct", v / 100)} suffix="%" step={0.5} />
              <NumField label="Variable cost" value={inp.variableCostPerUnit} onChange={(v) => set("variableCostPerUnit", v)} suffix={`$/${inp.unit}`} step={10} />
            </Section>
            <Section title="Fixed costs" cols={2}>
              <NumField label="Fixed opex / yr" value={inp.fixedOpex} onChange={(v) => set("fixedOpex", v)} suffix="$" step={10000} />
              <NumField label="Opex escalation" value={inp.opexEscalationPct * 100} onChange={(v) => set("opexEscalationPct", v / 100)} suffix="%" step={0.5} />
              <NumField label="Depreciation life" value={inp.depreciationYears} onChange={(v) => set("depreciationYears", v)} suffix="yrs" step={1} />
            </Section>
            <Section title="Capex & financing" cols={2}>
              <NumField label="Total capex" value={inp.capex} onChange={(v) => set("capex", v)} suffix="$" step={100000} />
              <NumField label="Debt share" value={inp.debtPct * 100} onChange={(v) => set("debtPct", v / 100)} suffix="%" step={5} />
              <NumField label="Interest rate" value={inp.interestRate * 100} onChange={(v) => set("interestRate", v / 100)} suffix="%" step={0.25} />
              <NumField label="Debt tenor" value={inp.debtTenorYears} onChange={(v) => set("debtTenorYears", v)} suffix="yrs" step={1} />
            </Section>
            <Section title="Tax & discounting" cols={2}>
              <NumField label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={1} />
              <NumField label="Discount rate" value={inp.discountRate * 100} onChange={(v) => set("discountRate", v / 100)} suffix="%" step={0.5} />
              <NumField label="Terminal growth" value={inp.terminalGrowthPct * 100} onChange={(v) => set("terminalGrowthPct", v / 100)} suffix="%" step={0.5} />
            </Section>
          </div>
          <div className="flex-1 min-w-0 w-full space-y-4">
            <ModelKpis kpis={r.kpis} />
            <ModelChartCard bars={r.bars} />
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
          <GridTable columns={sens.columns} rows={sens.rows} firstColLabel="Selling-price scenario" />
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>How returns move as the selling price shifts ±20% from the base case.</p>
        </div>
      )}
    </div>
  );
}

export default function PlantModel() {
  return (
    <Suspense fallback={<div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>}>
      <PlantInner />
    </Suspense>
  );
}
