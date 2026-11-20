"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppData } from "@/lib/store";
import { PageHeader, Card, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import { runStress, StressFactors, STRESS_ZERO, STRESS_PRESETS } from "@/lib/boardroom";
import { compact, fmtMoney } from "@/lib/format";

export default function StressTest() {
  const { holdings } = useAppData();
  const [f, setF] = useState<StressFactors>(STRESS_ZERO);

  const r = useMemo(() => runStress(holdings, f), [holdings, f]);
  const touched = f.gold !== 0 || f.lithium !== 0 || f.fx !== 0 || f.rates !== 0;

  const set = (k: keyof StressFactors, v: number) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <PageHeader
        eyebrow="Boardroom"
        title="Scenario Stress-Test"
        subtitle="Shock the macro and watch the portfolio reprice live, holding by holding. Answer “what if?” in the room — no spreadsheet required."
        actions={<Link href="/boardroom" className="rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--surface-2)", color: "var(--text)" }}>← Command Center</Link>}
      />

      {/* Result band */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Base NAV</span>
          <span className="text-2xl font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(r.base)}</span>
        </Card>
        <Card className="flex flex-col gap-1" style={{ borderColor: touched ? (r.delta < 0 ? "var(--neg)" : "var(--pos)") : "var(--border)" }}>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Stressed NAV</span>
          <span className="text-2xl font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(r.stressed)}</span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Impact</span>
          <span className="text-2xl font-semibold tabular" style={{ color: r.delta < 0 ? "var(--neg)" : r.delta > 0 ? "var(--pos)" : "var(--text)" }}>
            {r.delta >= 0 ? "+" : ""}{fmtMoney(r.delta)}
          </span>
          <span className="text-xs" style={{ color: r.delta < 0 ? "var(--neg)" : "var(--pos)" }}>{r.pct >= 0 ? "+" : ""}{(r.pct * 100).toFixed(1)}% of NAV</span>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Controls */}
        <div>
          <SectionTitle hint="drag to shock">Scenario drivers</SectionTitle>
          <Card className="space-y-5">
            <Slider label="Gold price" v={f.gold} min={-0.5} max={0.5} step={0.01} fmt={pct} onChange={(v) => set("gold", v)} />
            <Slider label="Lithium carbonate" v={f.lithium} min={-0.5} max={0.5} step={0.01} fmt={pct} onChange={(v) => set("lithium", v)} />
            <Slider label="ZiG devaluation vs USD" v={f.fx} min={0} max={0.8} step={0.01} fmt={pct} onChange={(v) => set("fx", v)} />
            <Slider label="USD rates" v={f.rates} min={-2} max={4} step={0.25} fmt={(n) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}bps`} onChange={(v) => set("rates", v)} />
            <button onClick={() => setF(STRESS_ZERO)} className="w-full rounded-md px-3 py-2 text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>Reset to base</button>
          </Card>

          <SectionTitle hint="one click">Preset shocks</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {STRESS_PRESETS.map((p) => (
              <button key={p.name} onClick={() => setF(p.factors)} className="rounded-md border px-3 py-2 text-left transition-shadow hover:shadow-md"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{p.name}</div>
                <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{p.detail}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Per-holding impact */}
        <div>
          <SectionTitle hint="repriced live">Impact by holding</SectionTitle>
          <Table head={<><Th>Holding</Th><Th right>Base</Th><Th right>Stressed</Th><Th right>Δ</Th></>}>
            {r.rows.map((row) => (
              <tr key={row.id}>
                <Td>
                  <span className="font-medium">{row.company}</span>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{row.sector}</div>
                </Td>
                <Td right>{compact(row.base, "USD")}</Td>
                <Td right strong>{compact(row.stressed, "USD")}</Td>
                <Td right>
                  <span className="font-semibold tabular" style={{ color: row.delta < 0 ? "var(--neg)" : row.delta > 0 ? "var(--pos)" : "var(--text-muted)" }}>
                    {row.delta >= 0 ? "+" : ""}{(row.pct * 100).toFixed(1)}%
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
            Each holding reprices by its sector&apos;s sensitivity to the drivers (commodity elasticity, FX pass-through and a duration-like rate effect). Assumptions are transparent and conservative — a decision aid, not a guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}

const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;

function Slider({ label, v, min, max, step, fmt, onChange }: {
  label: string; v: number; min: number; max: number; step: number; fmt: (n: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
        <span className="text-sm font-bold tabular" style={{ color: v === 0 ? "var(--text-faint)" : (v < 0 ? "var(--neg)" : "var(--pos)") }}>{fmt(v)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--brand)]" style={{ accentColor: "var(--brand)" }} />
    </div>
  );
}
