"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeBlueberry, BLUEBERRY_SAMPLE, BlueberryInputs, CaseKey } from "@/lib/blueberry";
import { Section, NumField, ModelResults } from "@/components/model/ModelKit";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

type Tab = "overview" | "cashflow" | "debt" | "sensitivity";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "debt", label: "Debt Schedule" },
  { key: "sensitivity", label: "Sensitivity" },
];
const CASES: { key: CaseKey; label: string; sub: string }[] = [
  { key: "combined", label: "Combined", sub: "grows & exports" },
  { key: "bluedot", label: "BlueDot", sub: "buys, packs, exports" },
  { key: "ferungwe", label: "Ferungwe", sub: "grows, sells at farmgate" },
];

export default function BlueberryModel() {
  const [inp, setInp] = useState<BlueberryInputs>(BLUEBERRY_SAMPLE);
  const [tab, setTab] = useState<Tab>("overview");
  const [ck, setCk] = useState<CaseKey>("combined");
  const set = (k: keyof BlueberryInputs, v: number) => setInp((p) => ({ ...p, [k]: v }) as BlueberryInputs);
  const setArr = (k: "yields" | "packOut", i: number, v: number) => setInp((p) => ({ ...p, [k]: p[k].map((x, idx) => (idx === i ? v : x)) }));
  const r = useMemo(() => computeBlueberry(inp), [inp]);

  return (
    <div>
      <PageHeader
        title="Agriculture — BlueDot Blueberry"
        subtitle="The venture under three structures — Ferungwe (outgrower), BlueDot (exporter) and the two combined. The farmgate price drives the split."
        actions={
          <div className="flex gap-2">
            <button onClick={() => setInp(BLUEBERRY_SAMPLE)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Reset to sample</button>
            <Link href="/investments/models" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>All models</Link>
          </div>
        }
      />
      <ModuleTabs moduleKey="investments" />

      {/* Farmgate driver + internal tabs */}
      <div className="flex flex-wrap items-center gap-4 mb-4 rounded-lg border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Farmgate</span>
          <input type="range" min={4} max={9} step={0.5} value={inp.farmgate} onChange={(e) => set("farmgate", Number(e.target.value))} />
          <span className="text-lg font-semibold tabular" style={{ color: "var(--brand)" }}>${inp.farmgate.toFixed(2)}/kg</span>
        </div>
        <div className="text-xs" style={{ color: "var(--text-faint)" }}>the price Ferungwe sells to BlueDot — a transfer that splits returns between the two</div>
      </div>

      <div className="mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="relative px-3 py-2.5 text-sm font-medium whitespace-nowrap" style={{ color: tab === t.key ? "var(--brand)" : "var(--text-muted)" }}>
              {t.label}
              {tab === t.key && <span className="absolute left-0 right-0 -bottom-px h-0.5" style={{ background: "var(--brand)" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW = Summary + Value Chain + Assumptions */}
      {tab === "overview" && (
        <div className="max-w-3xl">
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>The venture under three structures</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Ferungwe<div className="font-normal normal-case">outgrower</div></th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>BlueDot<div className="font-normal normal-case">exporter</div></th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Combined<div className="font-normal normal-case">integrated</div></th>
                  </tr>
                </thead>
                <tbody>
                  {r.summary.rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{row.label}</td>
                      <td className="px-4 py-2.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{row.f}</td>
                      <td className="px-4 py-2.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{row.b}</td>
                      <td className="px-4 py-2.5 text-right tabular font-semibold" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{row.c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
            The farmgate is a transfer, so as it rises the grower gains exactly what the exporter gives up — the combined result barely moves. WACC {(r.wacc * 100).toFixed(1)}% on {(inp.debtShare * 100).toFixed(0)}% debt funding. Most value sits in the terminal (blueberries produce 15–20 years; the explicit horizon is only 5).
          </p>
        </div>
      )}

      {/* ASSUMPTIONS (within Overview) */}
      {tab === "overview" && (
        <div className="max-w-4xl">
          <Section title="Scale & yield" cols={4}>
            <NumField label="Hectares" value={inp.hectares} onChange={(v) => set("hectares", v)} suffix="ha" />
            <NumField label="Plants / ha" value={inp.plantsPerHa} onChange={(v) => set("plantsPerHa", v)} step={100} />
            <NumField label="Farmgate" value={inp.farmgate} onChange={(v) => set("farmgate", v)} suffix="$/kg" step={0.5} />
            <NumField label="Offtake (Yr1)" value={inp.offtakeStart} onChange={(v) => set("offtakeStart", v)} suffix="$/kg" step={0.5} />
          </Section>
          <Section title="Yield (kg/plant) & pack-out (%) by year" cols={5}>
            {inp.yields.map((y, i) => <NumField key={"y" + i} label={`Yield Y${i + 1}`} value={y} onChange={(v) => setArr("yields", i, v)} step={0.5} />)}
            {inp.packOut.map((p, i) => <NumField key={"p" + i} label={`Pack-out Y${i + 1}`} value={p * 100} onChange={(v) => setArr("packOut", i, v / 100)} suffix="%" />)}
          </Section>
          <Section title="Grower cost (Ferungwe)" cols={4}>
            <NumField label="Fertilizer" value={inp.fertilizer} onChange={(v) => set("fertilizer", v)} suffix="$/plant" step={0.05} />
            <NumField label="Chemicals" value={inp.chemicals} onChange={(v) => set("chemicals", v)} suffix="$/plant" step={0.05} />
            <NumField label="Agronomy" value={inp.agronomy} onChange={(v) => set("agronomy", v)} suffix="$/plant" step={0.05} />
            <NumField label="Field labour" value={inp.fieldLabourPerPlant} onChange={(v) => set("fieldLabourPerPlant", v)} suffix="$/plant" step={0.05} />
            <NumField label="Picking" value={inp.picking} onChange={(v) => set("picking", v)} suffix="$/kg" step={0.01} />
            <NumField label="Clearing" value={inp.clearing} onChange={(v) => set("clearing", v)} suffix="$/kg" step={0.01} />
          </Section>
          <Section title="Exporter cost (BlueDot)" cols={4}>
            <NumField label="Packaging" value={inp.packaging} onChange={(v) => set("packaging", v)} suffix="$/kg" step={0.01} />
            <NumField label="Export freight" value={inp.freight} onChange={(v) => set("freight", v)} suffix="$/kg" step={0.1} />
            <NumField label="Packhouse labour" value={inp.packhouseLabour} onChange={(v) => set("packhouseLabour", v)} suffix="$/yr" step={1000} />
            <NumField label="Offtake decline" value={inp.offtakeDecline * 100} onChange={(v) => set("offtakeDecline", v / 100)} suffix="%/yr" step={0.5} />
          </Section>
          <Section title="Capital & working capital" cols={4}>
            <NumField label="Farm capex" value={inp.farmCapex} onChange={(v) => set("farmCapex", v)} suffix="$" step={100000} />
            <NumField label="Packhouse" value={inp.packhouse} onChange={(v) => set("packhouse", v)} suffix="$" step={10000} />
            <NumField label="Ferungwe WC" value={inp.ferungweWC} onChange={(v) => set("ferungweWC", v)} suffix="$" step={10000} />
            <NumField label="Export WC" value={inp.exportWC} onChange={(v) => set("exportWC", v)} suffix="$" step={10000} />
          </Section>
          <Section title="Financing & tax" cols={4}>
            <NumField label="WACC" value={inp.wacc * 100} onChange={(v) => set("wacc", v / 100)} suffix="%" step={0.5} />
            <NumField label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={0.5} />
            <NumField label="Debt share" value={inp.debtShare * 100} onChange={(v) => set("debtShare", v / 100)} suffix="%" step={5} />
            <NumField label="Interest rate" value={inp.interestRate * 100} onChange={(v) => set("interestRate", v / 100)} suffix="%" step={0.5} />
            <NumField label="Target DSCR" value={inp.targetDSCR} onChange={(v) => set("targetDSCR", v)} suffix="x" step={0.05} />
            <NumField label="Terminal growth" value={inp.terminalGrowth * 100} onChange={(v) => set("terminalGrowth", v / 100)} suffix="%" step={0.5} />
          </Section>
        </div>
      )}

      {/* CASH FLOW */}
      {tab === "cashflow" && (
        <div>
          <div className="flex gap-2 mb-4">
            {CASES.map((c) => (
              <button key={c.key} onClick={() => setCk(c.key)} className="rounded-lg border px-3 py-2 text-left" style={{ borderColor: ck === c.key ? "var(--brand)" : "var(--border)", background: ck === c.key ? "color-mix(in srgb, var(--brand) 8%, transparent)" : "transparent" }}>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.label}</div>
                <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{c.sub}</div>
              </button>
            ))}
          </div>
          <ModelResults result={r.results[ck]} />
        </div>
      )}

      {/* VALUE CHAIN (within Overview) */}
      {tab === "overview" && (
        <div className="max-w-xl">
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {r.valueChain.rows.map((row, i) => (
                  <tr key={i} style={row.group === "h" ? { background: "var(--surface-2)" } : undefined}>
                    <td className={`px-4 py-2 ${row.group === "h" ? "text-[11px] uppercase tracking-wider font-semibold" : ""} ${row.group === "s" ? "font-semibold" : ""}`} style={{ borderTop: i ? "1px solid var(--border)" : "none", color: row.group === "h" ? "var(--text-faint)" : "var(--text)" }}>{row.label}</td>
                    <td className={`px-4 py-2 text-right tabular ${row.group === "s" ? "font-semibold" : ""}`} style={{ borderTop: i ? "1px solid var(--border)" : "none", color: row.group === "s" ? "var(--pos)" : "var(--text)" }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Per kg at maturity. The farmgate nets out between the parties, so combined net is the whole-chain profit.</p>
        </div>
      )}

      {/* DEBT */}
      {tab === "debt" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {r.debt.kpis.map((k) => (
              <Card key={k.label} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{k.label}</span>
                <span className="text-lg font-semibold tabular" style={{ color: "var(--text)" }}>{k.value}</span>
              </Card>
            ))}
          </div>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ background: "var(--surface-2)" }}>{r.debt.columns.map((c) => <th key={c} className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider first:text-left" style={{ color: "var(--text-faint)" }}>{c}</th>)}</tr></thead>
                <tbody>
                  {r.debt.rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2 whitespace-nowrap" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{row.label}</td>
                      {row.cells.map((c, ci) => <td key={ci} className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Sculpted repayment on the integrated project: Year-1 interest is capitalised (establishment year), then principal is sized to hold the target {inp.targetDSCR.toFixed(2)}x cover each year.</p>
        </div>
      )}

      {/* SENSITIVITY */}
      {tab === "sensitivity" && (
        <div>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ background: "var(--surface-2)" }}>{r.sensitivity.columns.map((c) => <th key={c} className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider first:text-left" style={{ color: "var(--text-faint)" }}>{c}</th>)}</tr></thead>
                <tbody>
                  {r.sensitivity.rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2 whitespace-nowrap" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{row.label}</td>
                      {row.cells.map((c, ci) => <td key={ci} className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>How the farmgate price splits returns between the two parties. Below ~$6.2/kg BlueDot keeps the larger share; above it the farmer does. Combined NPV is barely affected — it is a transfer.</p>
        </div>
      )}
    </div>
  );
}
