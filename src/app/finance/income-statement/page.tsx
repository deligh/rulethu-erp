"use client";

import { useMemo } from "react";
import { useAppData } from "@/lib/store";
import { trialBalanceFromEntries } from "@/lib/coa";
import { buildStatements } from "@/lib/accounting";
import { fmtMoney } from "@/lib/format";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";

export default function IncomeStatementPage() {
  const { entries } = useAppData();
  const s = useMemo(() => buildStatements(trialBalanceFromEntries(entries)), [entries]);

  const rows = [
    ...s.incomeLines.map((l) => ({ item: l.name, amount: fmtMoney(l.amount) })),
    { item: "Total revenue", amount: fmtMoney(s.revenue) },
    ...s.expenseLines.map((l) => ({ item: l.name, amount: fmtMoney(-l.amount) })),
    { item: "Total expenses", amount: fmtMoney(-s.expenses) },
    { item: "Net profit", amount: fmtMoney(s.netProfit) },
  ];

  return (
    <div>
      <PageHeader
        title="Finance · Income Statement"
        subtitle="Profit & loss for the period, generated from the General Ledger."
        actions={<DownloadButtons filename="income-statement" title="Income Statement" subtitle="Rulethu Holdings · period to date" columns={[{ key: "item", label: "Item" }, { key: "amount", label: "Amount" }]} rows={rows} sheetName="Income Statement" />}
      />
      <ModuleTabs moduleKey="finance" />

      <div className="max-w-2xl">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>For the period to date</h3>
            <Badge tone="live">auto from ledger</Badge>
          </div>

          <Section title="Revenue">
            {s.incomeLines.map((l) => <Line key={l.name} name={l.name} amount={l.amount} />)}
            <Line name="Total revenue" amount={s.revenue} bold />
          </Section>

          <Section title="Expenses">
            {s.expenseLines.map((l) => <Line key={l.name} name={l.name} amount={-l.amount} />)}
            <Line name="Total expenses" amount={-s.expenses} bold />
          </Section>

          <div className="mt-4 flex justify-between py-2.5 px-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <span className="font-semibold" style={{ color: "var(--text)" }}>Net profit</span>
            <span className="text-lg font-semibold tabular" style={{ color: s.netProfit >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(s.netProfit)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>{title}</div>
      {children}
    </div>
  );
}

function Line({ name, amount, bold }: { name: string; amount: number; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1.5" style={bold ? { borderTop: "1px solid var(--border)" } : undefined}>
      <span className={bold ? "font-semibold" : ""} style={{ color: bold ? "var(--text)" : "var(--text-muted)" }}>{name}</span>
      <span className={`tabular ${bold ? "font-semibold" : ""}`} style={{ color: "var(--text)" }}>{fmtMoney(amount)}</span>
    </div>
  );
}
