"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/store";
import { trialBalanceFromEntries } from "@/lib/coa";
import { buildStatements } from "@/lib/accounting";
import { PageHeader, Card, StatCard, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";
import { fmtMoney } from "@/lib/format";

type Grain = "Monthly" | "Quarterly" | "Annual";
const netUSD = (lines: { currency: string; receipts: number; payments: number; charges: number; opening: number }[]) =>
  lines.filter((l) => l.currency === "USD").reduce((s, l) => s + l.receipts - l.payments - l.charges, 0);
const closeUSD = (lines: { currency: string; opening: number; receipts: number; payments: number; charges: number }[]) =>
  lines.filter((l) => l.currency === "USD").reduce((s, l) => s + l.opening + l.receipts - l.payments - l.charges, 0);

function periodKey(date: string, grain: Grain): string {
  const d = new Date(date);
  if (grain === "Annual") return String(d.getFullYear());
  if (grain === "Quarterly") return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default function ManagementReportsPage() {
  const { cashReports, entries } = useAppData();
  const [grain, setGrain] = useState<Grain>("Monthly");

  const stmt = useMemo(() => buildStatements(trialBalanceFromEntries(entries)), [entries]);

  const roll = useMemo(() => {
    const m: Record<string, { receipts: number; payments: number; net: number; reports: number; lastClose: number }> = {};
    for (const r of [...cashReports].sort((a, b) => a.date.localeCompare(b.date))) {
      const k = periodKey(r.date, grain);
      m[k] = m[k] || { receipts: 0, payments: 0, net: 0, reports: 0, lastClose: 0 };
      m[k].receipts += r.lines.filter((l) => l.currency === "USD").reduce((s, l) => s + l.receipts, 0);
      m[k].payments += r.lines.filter((l) => l.currency === "USD").reduce((s, l) => s + l.payments + l.charges, 0);
      m[k].net += netUSD(r.lines);
      m[k].reports += 1;
      m[k].lastClose = closeUSD(r.lines);
    }
    return Object.entries(m).map(([period, v]) => ({ period, ...v }));
  }, [cashReports, grain]);

  const cols = [{ key: "period", label: "Period" }, { key: "reports", label: "Reports" }, { key: "receipts", label: "Receipts" }, { key: "payments", label: "Payments" }, { key: "net", label: "Net" }, { key: "close", label: "Closing" }];
  const exportRows = roll.map((r) => ({ period: r.period, reports: r.reports, receipts: fmtMoney(r.receipts), payments: fmtMoney(r.payments), net: fmtMoney(r.net), close: fmtMoney(r.lastClose) }));

  return (
    <div>
      <PageHeader
        title="Finance · Management Reports"
        subtitle="Daily cash reports roll up into monthly, quarterly and annual figures; the ledger produces the period P&L and balance sheet."
        actions={<DownloadButtons filename={`cash-rollup-${grain}`} title={`Cash roll-up (${grain})`} subtitle="Rulethu Holdings" columns={cols} rows={exportRows} sheetName="Rollup" />}
      />
      <ModuleTabs moduleKey="finance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue (period)" value={fmtMoney(stmt.revenue)} hint="from ledger" />
        <StatCard label="Net profit" value={fmtMoney(stmt.netProfit)} delta={{ value: stmt.revenue ? `${((stmt.netProfit / stmt.revenue) * 100).toFixed(0)}% margin` : "", positive: stmt.netProfit >= 0 }} />
        <StatCard label="Total assets" value={fmtMoney(stmt.totalAssets)} />
        <StatCard label="Cash reports filed" value={String(cashReports.length)} hint="feeding the roll-up" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
          {(["Monthly", "Quarterly", "Annual"] as Grain[]).map((g) => (
            <button key={g} onClick={() => setGrain(g)} className="rounded-md px-3 py-1 text-xs font-medium" style={{ background: grain === g ? "var(--brand)" : "transparent", color: grain === g ? "#fff" : "var(--text-muted)" }}>{g}</button>
          ))}
        </div>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>cash roll-up granularity</span>
      </div>

      <SectionTitle hint="from filed daily cash reports">Cash roll-up ({grain})</SectionTitle>
      {roll.length === 0 ? (
        <Card className="border-dashed mb-8"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No cash reports filed yet — file some in Daily Cash Report and they roll up here.</span></Card>
      ) : (
        <Card className="!p-0 overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "var(--surface-2)" }}>{["Period", "Reports", "Receipts", "Payments", "Net", "Closing"].map((h, i) => <th key={h} className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wider ${i ? "text-right" : "text-left"}`} style={{ color: "var(--text-faint)" }}>{h}</th>)}</tr></thead>
            <tbody>
              {roll.map((r) => (
                <tr key={r.period}>
                  <td className="px-4 py-2 font-medium" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{r.period}</td>
                  <td className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{r.reports}</td>
                  <td className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--pos)" }}>{fmtMoney(r.receipts)}</td>
                  <td className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--neg)" }}>({fmtMoney(r.payments)})</td>
                  <td className="px-4 py-2 text-right tabular font-medium" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(r.net)}</td>
                  <td className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(r.lastClose)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <SectionTitle hint="from the general ledger">Period P&amp;L</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card><div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Revenue</div><div className="text-xl font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(stmt.revenue)}</div></Card>
        <Card><div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Expenses</div><div className="text-xl font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(stmt.expenses)}</div></Card>
        <Card><div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Net profit</div><div className="text-xl font-semibold tabular" style={{ color: stmt.netProfit >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(stmt.netProfit)}</div><Badge tone={stmt.bsBalanced ? "pos" : "warn"}>BS {stmt.bsBalanced ? "balances" : "check"}</Badge></Card>
      </div>
    </div>
  );
}
