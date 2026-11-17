"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { buildLoanSchedule, loanCsv, LoanInputs, LoanType } from "@/lib/loan";
import { fmtMoney } from "@/lib/format";
import { PageHeader, Card, StatCard, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

const TYPES: { key: LoanType; label: string }[] = [
  { key: "standard", label: "Reducing balance (EMI)" },
  { key: "flat", label: "Flat rate" },
  { key: "interest_only", label: "Interest-only + amortise" },
  { key: "custom_initial", label: "Custom initial period" },
  { key: "graduated", label: "Graduated (step-up)" },
  { key: "balloon", label: "Balloon" },
];
const FREQS = [{ v: 12, l: "Monthly" }, { v: 4, l: "Quarterly" }, { v: 2, l: "Semi-annual" }, { v: 1, l: "Annual" }];

function BalanceChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 720, H = 160, pad = 24;
  const max = Math.max(...data, 1);
  const x = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - v / max) * (H - pad * 2);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(data.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <path d={area} fill="color-mix(in srgb, var(--brand) 12%, transparent)" />
      <path d={path} fill="none" stroke="var(--brand)" strokeWidth={2} />
    </svg>
  );
}

function AmortInner() {
  const params = useSearchParams();
  const [inp, setInp] = useState<LoanInputs>({
    principal: 25000, annualRatePct: 24, termMonths: 12, payFreq: 12,
    startDate: new Date().toISOString().slice(0, 10), extraPayment: 0, type: "standard",
    initPeriodMonths: 6, balloonPct: 30, gradStepPct: 20, customInitialPayment: 2000, currency: "USD",
  });

  useEffect(() => {
    const p = params.get("p"), r = params.get("r"), n = params.get("n");
    if (p || r || n) setInp((prev) => ({ ...prev, principal: p ? Number(p) : prev.principal, annualRatePct: r ? Number(r) : prev.annualRatePct, termMonths: n ? Number(n) : prev.termMonths }));
  }, [params]);

  const set = <K extends keyof LoanInputs>(k: K, v: LoanInputs[K]) => setInp((prev) => ({ ...prev, [k]: v }));
  const res = useMemo(() => buildLoanSchedule(inp), [inp]);

  const download = () => {
    const blob = new Blob([loanCsv(res)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `amortisation_${inp.type}_${inp.principal}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };
  const showInit = inp.type === "interest_only" || inp.type === "custom_initial" || inp.type === "graduated";

  return (
    <div>
      <PageHeader
        title="Amortisation Calculator"
        subtitle="The MFI loan calculator — reducing balance, flat, interest-only, custom, graduated and balloon, with frequency, grace and extra payments."
        actions={<Link href="/microfinance" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Back to loan book</Link>}
      />
      <ModuleTabs moduleKey="microfinance" />

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Loan amount</span><input type="number" value={inp.principal} step={1000} onChange={(e) => set("principal", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Annual rate %</span><input type="number" value={inp.annualRatePct} step={0.5} onChange={(e) => set("annualRatePct", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Term (months)</span><input type="number" value={inp.termMonths} step={1} onChange={(e) => set("termMonths", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Frequency</span><select value={inp.payFreq} onChange={(e) => set("payFreq", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle}>{FREQS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}</select></label>
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Start date</span><input type="date" value={inp.startDate} onChange={(e) => set("startDate", e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} /></label>
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Extra payment</span><input type="number" value={inp.extraPayment} step={100} onChange={(e) => set("extraPayment", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>
          </div>
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Amortisation type</span><select value={inp.type} onChange={(e) => set("type", e.target.value as LoanType)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle}>{TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            {showInit && <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Initial period (months)</span><input type="number" value={inp.initPeriodMonths} step={1} onChange={(e) => set("initPeriodMonths", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>}
            {inp.type === "custom_initial" && <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Initial payment</span><input type="number" value={inp.customInitialPayment} step={100} onChange={(e) => set("customInitialPayment", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>}
            {inp.type === "graduated" && <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Step-up %</span><input type="number" value={inp.gradStepPct} step={5} onChange={(e) => set("gradStepPct", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>}
            {inp.type === "balloon" && <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Balloon %</span><input type="number" value={inp.balloonPct} step={5} onChange={(e) => set("balloonPct", +e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm tabular" style={inputStyle} /></label>}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Avg. payment" value={fmtMoney(res.avgPayment, inp.currency, 2)} hint="per period" />
            <StatCard label="Total repaid" value={fmtMoney(res.totalPaid, inp.currency, 0)} hint={`${res.rows.length} payments`} />
            <StatCard label="Total interest" value={fmtMoney(res.totalInterest, inp.currency, 0)} hint={inp.principal ? `${((res.totalInterest / inp.principal) * 100).toFixed(0)}% of principal` : undefined} />
            <StatCard label="Interest ratio" value={`${res.interestRatioPct.toFixed(1)}%`} hint="of payments" />
            <StatCard label="Payoff date" value={res.payoffDate} />
          </div>

          <Card>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Outstanding balance</h3>
            <BalanceChart data={[inp.principal, ...res.rows.map((r) => r.closing)]} />
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2"><h3 className="font-semibold" style={{ color: "var(--text)" }}>Schedule</h3><Badge tone="neutral">{res.rows.length} periods</Badge></div>
              <button onClick={download} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Export CSV</button>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
                  <tr>{["#", "Date", "Opening", "Scheduled", "Extra", "Total", "Principal", "Interest", "Closing", "Cum. int"].map((h, i) => <th key={h} className={`px-3 py-2 text-[11px] uppercase ${i <= 1 ? "text-left" : "text-right"}`} style={{ color: "var(--text-faint)" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {res.rows.map((r) => (
                    <tr key={r.n} style={r.kind === "balloon" ? { background: "color-mix(in srgb, var(--warn) 12%, transparent)" } : r.kind === "init" ? { background: "var(--surface-2)" } : undefined}>
                      <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}>{r.n}</td>
                      <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>{r.date}</td>
                      <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(r.opening, inp.currency, 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(r.scheduled, inp.currency, 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: r.extra ? "var(--pos)" : "var(--text-faint)" }}>{r.extra ? fmtMoney(r.extra, inp.currency, 0) : "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular font-medium" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(r.totalPay, inp.currency, 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--pos)" }}>{fmtMoney(r.principal, inp.currency, 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--neg)" }}>{fmtMoney(r.interest, inp.currency, 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(r.closing, inp.currency, 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}>{fmtMoney(r.cumInterest, inp.currency, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AmortizationPage() {
  return <Suspense fallback={<div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>}><AmortInner /></Suspense>;
}
