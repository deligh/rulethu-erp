"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computeEquity, EquityInputs, ZSE_COMPANIES, SAMPLE_EQUITY } from "@/lib/valuation";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

type NumKey = Exclude<keyof EquityInputs, "name" | "ticker" | "currency">;
const m = (v: number) => `$${v.toFixed(1)}m`;
const ps = (v: number) => (isFinite(v) ? `$${v.toFixed(3)}` : "—");
const x = (v: number) => `${v.toFixed(1)}x`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function Field({ label, value, onChange, suffix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="mt-1 flex items-center rounded-md border px-2.5" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
        <input type="number" value={Number.isFinite(value) ? value : 0} step={step} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full bg-transparent py-1.5 text-sm outline-none tabular" />
        {suffix && <span className="pl-1.5 text-[11px] shrink-0" style={{ color: "var(--text-faint)" }}>{suffix}</span>}
      </div>
    </label>
  );
}

export default function EquityValuation() {
  const [inp, setInp] = useState<EquityInputs>(SAMPLE_EQUITY);
  const set = (k: NumKey, v: number) => setInp((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => computeEquity(inp), [inp]);

  const csv = () => {
    const head = ["Year", "Revenue", "EBIT", "NOPAT", "FCFF", "PV"];
    const rows = r.dcfYears.map((y) => [y.year, y.revenue.toFixed(1), y.ebit.toFixed(1), y.nopat.toFixed(1), y.fcff.toFixed(1), y.pv.toFixed(1)]);
    const out = [["Rulethu Equity Valuation", inp.name, inp.ticker], [], ["Target price", r.targetPrice.toFixed(3)], ["Current price", inp.currentPrice.toFixed(3)], ["Upside", pct(r.upside)], ["Rating", r.rating], [], head, ...rows].map((l) => l.join(",")).join("\n");
    const blob = new Blob([out], { type: "text/csv" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `${inp.ticker.replace(/\W+/g, "-")}-valuation.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  };

  // football field scale
  const maxV = Math.max(inp.currentPrice, ...r.methods.map((mt) => mt.high)) * 1.12;
  const sx = (v: number) => 120 + (v / maxV) * 560;
  const ratingTone = r.rating === "Buy" ? "pos" : r.rating === "Sell" ? "neg" : "warn";

  return (
    <div>
      <PageHeader
        title="Equity Valuation"
        subtitle="Full listed-equity valuation — DCF, trading multiples, NAV and dividend discount drawn into a target price and upside versus the current share price. Load financials and flex the assumptions."
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={csv} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Export CSV</button>
            <button onClick={() => setInp(SAMPLE_EQUITY)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Reset</button>
            <Link href="/investments/dcf" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Full DCF</Link>
          </div>
        }
      />
      <ModuleTabs moduleKey="investments" />

      {/* Company selector */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: "var(--text-faint)" }}>Load a company:</span>
        {ZSE_COMPANIES.map((co) => (
          <button key={co.ticker} onClick={() => setInp(co)} className="rounded-full px-3 py-1 text-xs font-medium border" style={{ background: inp.ticker === co.ticker ? "var(--brand)" : "transparent", color: inp.ticker === co.ticker ? "#fff" : "var(--text-muted)", borderColor: "var(--border)" }}>{co.name}</button>
        ))}
        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>— or edit any field below for your own company</span>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        <Summary label="Current price" value={ps(inp.currentPrice)} />
        <Summary label="Market cap" value={m(r.marketCap)} />
        <Summary label="Enterprise value" value={m(r.ev)} />
        <Summary label="Target price" value={ps(r.targetPrice)} strong />
        <Summary label="Upside / (downside)" value={pct(r.upside)} tone={r.upside >= 0 ? "pos" : "neg"} />
        <Card className="rz-rise flex flex-col gap-1 items-start justify-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Rating</span>
          <Badge tone={ratingTone}>{r.rating}</Badge>
        </Card>
      </div>

      {/* Football field */}
      <Card className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Valuation football field (per share)</h3>
        <svg width="100%" viewBox="0 0 720 200" style={{ display: "block" }}>
          {/* axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => { const v = maxV * f; return (<g key={f}><line x1={sx(v)} y1={20} x2={sx(v)} y2={168} stroke="var(--border)" strokeDasharray="2 3" /><text x={sx(v)} y={184} fontSize={9} textAnchor="middle" fill="var(--text-faint)">${v.toFixed(2)}</text></g>); })}
          {/* method bars */}
          {r.methods.map((mt, i) => {
            const y = 32 + i * 34;
            const x1 = sx(Math.max(0, mt.low)); const x2 = sx(Math.max(0, mt.high)); const xb = sx(Math.max(0, mt.perShare));
            return (
              <g key={mt.label}>
                <text x={116} y={y + 10} fontSize={11} textAnchor="end" fill="var(--text-muted)">{mt.label}</text>
                <rect x={x1} y={y} width={Math.max(2, x2 - x1)} height={14} rx={7} fill={mt.tone} opacity={0.35} />
                <rect x={xb - 1.5} y={y - 2} width={3} height={18} rx={1.5} fill={mt.tone} />
              </g>
            );
          })}
          {/* current price line */}
          <line x1={sx(inp.currentPrice)} y1={18} x2={sx(inp.currentPrice)} y2={168} stroke="var(--neg)" strokeWidth={1.5} />
          <text x={sx(inp.currentPrice)} y={14} fontSize={9} textAnchor="middle" fill="var(--neg)">Price {ps(inp.currentPrice)}</text>
          {/* target line */}
          <line x1={sx(r.targetPrice)} y1={18} x2={sx(r.targetPrice)} y2={168} stroke="var(--pos)" strokeWidth={1.5} strokeDasharray="4 3" />
        </svg>
        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Bars show each method's range; the tick is the base case. <span style={{ color: "var(--neg)" }}>Red</span> = current price, <span style={{ color: "var(--pos)" }}>green dashed</span> = blended target.</p>
      </Card>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Inputs */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Market</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Shares out" value={inp.sharesOutM} onChange={(v) => set("sharesOutM", v)} suffix="m" step={1} />
              <Field label="Current price" value={inp.currentPrice} onChange={(v) => set("currentPrice", v)} suffix="$" step={0.01} />
              <Field label="Net debt" value={inp.netDebt} onChange={(v) => set("netDebt", v)} suffix="$m" step={1} />
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Financials — latest FY ($m)</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Revenue" value={inp.revenue} onChange={(v) => set("revenue", v)} suffix="$m" />
              <Field label="EBITDA" value={inp.ebitda} onChange={(v) => set("ebitda", v)} suffix="$m" />
              <Field label="EBIT" value={inp.ebit} onChange={(v) => set("ebit", v)} suffix="$m" />
              <Field label="Net income" value={inp.netIncome} onChange={(v) => set("netIncome", v)} suffix="$m" />
              <Field label="Book equity" value={inp.bookEquity} onChange={(v) => set("bookEquity", v)} suffix="$m" />
              <Field label="D&A" value={inp.da} onChange={(v) => set("da", v)} suffix="$m" />
              <Field label="Capex" value={inp.capex} onChange={(v) => set("capex", v)} suffix="$m" />
              <Field label="ΔNWC" value={inp.nwcChange} onChange={(v) => set("nwcChange", v)} suffix="$m" />
              <Field label="DPS" value={inp.dps} onChange={(v) => set("dps", v)} suffix="$" step={0.001} />
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>DCF assumptions</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Revenue growth" value={inp.revGrowth * 100} onChange={(v) => set("revGrowth", v / 100)} suffix="%" step={0.5} />
              <Field label="EBIT margin" value={inp.ebitMargin * 100} onChange={(v) => set("ebitMargin", v / 100)} suffix="%" step={0.5} />
              <Field label="Forecast years" value={inp.fadeYears} onChange={(v) => set("fadeYears", v)} suffix="yrs" step={1} />
              <Field label="WACC" value={inp.wacc * 100} onChange={(v) => set("wacc", v / 100)} suffix="%" step={0.5} />
              <Field label="Terminal growth" value={inp.terminalGrowth * 100} onChange={(v) => set("terminalGrowth", v / 100)} suffix="%" step={0.25} />
              <Field label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={0.5} />
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Target multiples &amp; dividend</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="EV / EBITDA" value={inp.targetEvEbitda} onChange={(v) => set("targetEvEbitda", v)} suffix="x" step={0.5} />
              <Field label="P / E" value={inp.targetPe} onChange={(v) => set("targetPe", v)} suffix="x" step={0.5} />
              <Field label="EV / Sales" value={inp.targetEvSales} onChange={(v) => set("targetEvSales", v)} suffix="x" step={0.1} />
              <Field label="P / B" value={inp.targetPb} onChange={(v) => set("targetPb", v)} suffix="x" step={0.1} />
              <Field label="Dividend growth" value={inp.ddmGrowth * 100} onChange={(v) => set("ddmGrowth", v / 100)} suffix="%" step={0.5} />
            </div>
          </Card>
        </div>

        {/* Right: multiples + method detail + DCF */}
        <div className="space-y-4">
          <Card>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Current trading multiples</h4>
            <dl className="space-y-1.5 text-sm">
              <Row k="EV / EBITDA" v={x(r.curEvEbitda)} />
              <Row k="P / E" v={x(r.curPe)} />
              <Row k="EV / Sales" v={x(r.curEvSales)} />
              <Row k="P / B" v={x(r.curPb)} />
              <Row k="Dividend yield" v={pct(r.divYield)} />
            </dl>
          </Card>
          <Card>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Value per method (per share)</h4>
            <dl className="space-y-1.5 text-sm">
              <Row k="DCF (FCFF)" v={ps(r.dcfPerShare)} />
              <Row k="EV/EBITDA comp" v={ps(r.relPerShare.evEbitda)} />
              <Row k="P/E comp" v={ps(r.relPerShare.pe)} />
              <Row k="EV/Sales comp" v={ps(r.relPerShare.evSales)} />
              <Row k="P/B comp" v={ps(r.relPerShare.pb)} />
              <Row k="Net asset value" v={ps(r.navPerShare)} />
              {r.ddmPerShare > 0 && <Row k="Dividend discount" v={ps(r.ddmPerShare)} />}
              <div className="flex justify-between py-1.5 mt-1 px-2 rounded-lg" style={{ background: "var(--surface-2)" }}>
                <span className="font-semibold" style={{ color: "var(--text)" }}>Blended target</span>
                <span className="font-semibold tabular" style={{ color: "var(--text)" }}>{ps(r.targetPrice)}</span>
              </div>
            </dl>
          </Card>
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}><h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>DCF projection ($m)</h4></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "var(--surface-2)" }}><tr>{["Yr", "Rev", "EBIT", "FCFF", "PV"].map((h, i) => <th key={h} className={`px-3 py-1.5 text-[11px] uppercase ${i === 0 ? "text-left" : "text-right"}`} style={{ color: "var(--text-faint)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {r.dcfYears.map((y) => (
                    <tr key={y.year}>
                      <td className="px-3 py-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{y.year}</td>
                      <td className="px-3 py-1 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{y.revenue.toFixed(1)}</td>
                      <td className="px-3 py-1 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{y.ebit.toFixed(1)}</td>
                      <td className="px-3 py-1 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{y.fcff.toFixed(1)}</td>
                      <td className="px-3 py-1 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{y.pv.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-[11px] px-1" style={{ color: "var(--text-faint)" }}>Indicative, for research use. Sample ZSE financials are illustrative — load the latest audited figures. With a connected data feed, price &amp; financials can refresh automatically.</p>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "pos" | "neg" }) {
  return (
    <Card className="rz-rise flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className={`tabular ${strong ? "text-xl" : "text-lg"} font-semibold`} style={{ color: tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--text)" }}>{value}</span>
    </Card>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt style={{ color: "var(--text-muted)" }}>{k}</dt><dd className="tabular font-medium" style={{ color: "var(--text)" }}>{v}</dd></div>;
}
