"use client";

import { useMemo } from "react";
import { useAppData } from "@/lib/store";
import { trialBalanceFromEntries } from "@/lib/coa";
import { buildStatements } from "@/lib/accounting";
import { fmtMoney } from "@/lib/format";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";

export default function BalanceSheetPage() {
  const { entries } = useAppData();
  const s = useMemo(() => buildStatements(trialBalanceFromEntries(entries)), [entries]);

  const rows = [
    ...s.assetLines.map((l) => ({ item: l.name, amount: fmtMoney(l.amount) })),
    { item: "Total assets", amount: fmtMoney(s.totalAssets) },
    ...s.liabilityLines.map((l) => ({ item: l.name, amount: fmtMoney(l.amount) })),
    { item: "Total liabilities", amount: fmtMoney(s.totalLiabilities) },
    ...s.equityLines.map((l) => ({ item: l.name, amount: fmtMoney(l.amount) })),
    { item: "Retained profit for the period", amount: fmtMoney(s.netProfit) },
    { item: "Total equity", amount: fmtMoney(s.equityWithProfit) },
  ];

  return (
    <div>
      <PageHeader
        title="Finance · Balance Sheet"
        subtitle="Statement of financial position, generated from the General Ledger."
        actions={<DownloadButtons filename="balance-sheet" title="Balance Sheet" subtitle="Rulethu Holdings · as at period end" columns={[{ key: "item", label: "Item" }, { key: "amount", label: "Amount" }]} rows={rows} sheetName="Balance Sheet" />}
      />
      <ModuleTabs moduleKey="finance" />

      <div className="max-w-2xl">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>As at period end</h3>
            <Badge tone={s.bsBalanced ? "pos" : "neg"}>{s.bsBalanced ? "Balances" : "Out of balance"}</Badge>
          </div>

          <Section title="Assets">
            {s.assetLines.map((l) => <Line key={l.name} name={l.name} amount={l.amount} />)}
            <Line name="Total assets" amount={s.totalAssets} bold />
          </Section>

          <Section title="Liabilities">
            {s.liabilityLines.map((l) => <Line key={l.name} name={l.name} amount={l.amount} />)}
            <Line name="Total liabilities" amount={s.totalLiabilities} bold />
          </Section>

          <Section title="Equity">
            {s.equityLines.map((l) => <Line key={l.name} name={l.name} amount={l.amount} />)}
            <Line name="Retained profit for the period" amount={s.netProfit} />
            <Line name="Total equity" amount={s.equityWithProfit} bold />
          </Section>

          <div className="mt-4 flex justify-between py-2.5 px-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <span className="font-semibold" style={{ color: "var(--text)" }}>Liabilities + Equity</span>
            <span className="text-lg font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(s.totalLiabilities + s.equityWithProfit)}</span>
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
