"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/store";
import { buildCashFlow, CFLine } from "@/lib/cashflow";
import { fmtMoney } from "@/lib/format";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";

export default function CashFlowPage() {
  const { entries } = useAppData();
  const cf = useMemo(() => buildCashFlow(entries), [entries]);

  const Section = ({ title, lines, total }: { title: string; lines: CFLine[]; total: number }) => (
    <div>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "var(--surface-2)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</span>
        <span className="text-sm font-semibold tabular" style={{ color: total >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(total)}</span>
      </div>
      {lines.length === 0 && <div className="px-4 py-2 text-sm" style={{ color: "var(--text-faint)" }}>No cash movements in this category.</div>}
      {lines.map((l, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <div className="text-sm truncate" style={{ color: "var(--text)" }}>{l.memo}</div>
            <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{l.date} · {l.source}</div>
          </div>
          <span className="text-sm tabular shrink-0 ml-3" style={{ color: l.amount >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(l.amount)}</span>
        </div>
      ))}
    </div>
  );

  const exportRows = [
    ...cf.operating.map((l) => ({ section: "Operating", memo: l.memo, amount: l.amount })),
    ...cf.investing.map((l) => ({ section: "Investing", memo: l.memo, amount: l.amount })),
    ...cf.financing.map((l) => ({ section: "Financing", memo: l.memo, amount: l.amount })),
  ];

  return (
    <div>
      <PageHeader
        title="Finance · Cash Flow Statement"
        subtitle="Direct-method cash flow, classified straight from the General Ledger into operating, investing and financing activities."
        actions={
          <div className="flex items-center gap-2">
            <DownloadButtons filename="cash-flow" title="Cash Flow Statement" subtitle="Rulethu Holdings" columns={[{ key: "section", label: "Activity" }, { key: "memo", label: "Item" }, { key: "amount", label: "Amount" }]} rows={exportRows} sheetName="Cash Flow" />
            <Link href="/finance/trial-balance" className="rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Trial Balance →</Link>
          </div>
        }
      />
      <ModuleTabs moduleKey="finance" />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <Card className="!p-0 overflow-hidden">
          <Section title="Operating activities" lines={cf.operating} total={cf.totalOperating} />
          <Section title="Investing activities" lines={cf.investing} total={cf.totalInvesting} />
          <Section title="Financing activities" lines={cf.financing} total={cf.totalFinancing} />
          <div className="px-4 py-3 border-t-2" style={{ borderColor: "var(--border)" }}>
            <Reconcile k="Opening cash" v={cf.openingCash} />
            <Reconcile k="Net increase / (decrease) in cash" v={cf.netChange} strong />
            <div className="flex items-center justify-between py-2 mt-1 px-2 rounded-lg" style={{ background: "var(--surface-2)" }}>
              <span className="font-semibold" style={{ color: "var(--text)" }}>Closing cash</span>
              <span className="font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(cf.closingCash)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Cash by activity</h3>
            <div className="space-y-2.5">
              {[{ l: "Operating", v: cf.totalOperating, c: "var(--pos)" }, { l: "Investing", v: cf.totalInvesting, c: "var(--info)" }, { l: "Financing", v: cf.totalFinancing, c: "var(--accent)" }].map((b) => {
                const max = Math.max(1, Math.abs(cf.totalOperating), Math.abs(cf.totalInvesting), Math.abs(cf.totalFinancing));
                return (
                  <div key={b.l}>
                    <div className="flex justify-between text-sm mb-1"><span style={{ color: "var(--text-muted)" }}>{b.l}</span><span className="tabular font-medium" style={{ color: b.v >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(b.v)}</span></div>
                    <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}><div className="h-2 rounded-full rz-bar" style={{ width: `${(Math.abs(b.v) / max) * 100}%`, background: b.c }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <Badge tone={Math.abs(cf.netChange) >= 0 ? "info" : "neutral"}>Direct method</Badge>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Every cash entry in the ledger is classified by its counter-account: income/expense & working capital → operating; investments, loans & assets → investing; borrowings & equity → financing. Post a journal and this restates instantly.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Reconcile({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={strong ? "font-medium" : ""} style={{ color: strong ? "var(--text)" : "var(--text-muted)" }}>{k}</span>
      <span className="tabular" style={{ color: v >= 0 ? "var(--text)" : "var(--neg)", fontWeight: strong ? 600 : 400 }}>{fmtMoney(v)}</span>
    </div>
  );
}
