"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/store";
import { trialBalanceFromEntries } from "@/lib/coa";
import { buildStatements } from "@/lib/accounting";
import { fmtMoney } from "@/lib/format";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";
import AICheck from "@/components/AICheck";

export default function TrialBalancePage() {
  const { entries } = useAppData();
  const tb = useMemo(() => trialBalanceFromEntries(entries), [entries]);
  const s = useMemo(() => buildStatements(tb), [tb]);

  const exportCols = [
    { key: "code", label: "Code" },
    { key: "name", label: "Account" },
    { key: "type", label: "Type" },
    { key: "debit", label: "Debit" },
    { key: "credit", label: "Credit" },
  ];
  const exportRows = tb.map((a) => ({
    code: a.code,
    name: a.name,
    type: a.type,
    debit: a.debit || "",
    credit: a.credit || "",
  }));

  return (
    <div>
      <PageHeader
        title="Finance · Trial Balance"
        subtitle="Aggregated automatically from the General Ledger. Post entries there and this updates itself."
        actions={
          <div className="flex items-center gap-2">
            <DownloadButtons filename="trial-balance" title="Trial Balance" subtitle="Rulethu Holdings · Aug–Sep 2026" columns={exportCols} rows={exportRows} sheetName="Trial Balance" />
            <Link href="/finance/general-ledger" className="rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>
              General Ledger →
            </Link>
          </div>
        }
      />

      <ModuleTabs moduleKey="finance" />

      <AICheck totalDebit={s.totalDebit} totalCredit={s.totalCredit} />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>Trial balance</h3>
            <Badge tone={s.balanced ? "pos" : "neg"}>{s.balanced ? "Balanced" : "Out of balance"}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--surface-2)" }}>
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: "var(--text-faint)" }}>Code</th>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: "var(--text-faint)" }}>Account</th>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: "var(--text-faint)" }}>Type</th>
                  <th className="px-3 py-2 text-right text-xs uppercase" style={{ color: "var(--text-faint)" }}>Debit</th>
                  <th className="px-3 py-2 text-right text-xs uppercase" style={{ color: "var(--text-faint)" }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {tb.map((a) => (
                  <tr key={a.code}>
                    <td className="px-3 py-2" style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}>{a.code}</td>
                    <td className="px-3 py-2" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{a.name}</td>
                    <td className="px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}><span className="text-xs" style={{ color: "var(--text-faint)" }}>{a.type}</span></td>
                    <td className="px-3 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{a.debit ? fmtMoney(a.debit) : ""}</td>
                    <td className="px-3 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{a.credit ? fmtMoney(a.credit) : ""}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--surface-2)" }}>
                  <td className="px-3 py-2 font-semibold" colSpan={3} style={{ borderTop: "2px solid var(--border)", color: "var(--text)" }}>Totals</td>
                  <td className="px-3 py-2 text-right tabular font-semibold" style={{ borderTop: "2px solid var(--border)" }}>{fmtMoney(s.totalDebit)}</td>
                  <td className="px-3 py-2 text-right tabular font-semibold" style={{ borderTop: "2px solid var(--border)" }}>{fmtMoney(s.totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <h3 className="font-semibold mb-2" style={{ color: "var(--text)" }}>At a glance</h3>
            <div className="space-y-1.5 text-sm">
              <Row k="Revenue" v={fmtMoney(s.revenue)} />
              <Row k="Expenses" v={fmtMoney(s.expenses)} />
              <div className="flex justify-between py-1.5 mt-1 px-2 rounded-lg" style={{ background: "var(--surface-2)" }}>
                <span className="font-semibold" style={{ color: "var(--text)" }}>Net profit</span>
                <span className="font-semibold tabular" style={{ color: s.netProfit >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(s.netProfit)}</span>
              </div>
              <Row k="Total assets" v={fmtMoney(s.totalAssets)} />
              <Row k="Liabilities + Equity" v={fmtMoney(s.totalLiabilities + s.equityWithProfit)} />
            </div>
            <div className="mt-4 flex gap-2">
              <Link href="/finance/income-statement" className="flex-1 text-center rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Income Statement</Link>
              <Link href="/finance/balance-sheet" className="flex-1 text-center rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Balance Sheet</Link>
            </div>
          </Card>
          <p className="text-[11px] px-1" style={{ color: "var(--text-faint)" }}>
            Every account here is the net of all General Ledger postings. Add a journal entry and the figures move
            instantly. Data is stored in your browser until the database is connected.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span className="tabular font-medium" style={{ color: "var(--text)" }}>{v}</span>
    </div>
  );
}
