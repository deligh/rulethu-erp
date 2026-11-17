"use client";

import { useMemo, useState } from "react";
import { useAppData, genId, CURRENT_USER, CashLine, CashReport } from "@/lib/store";
import { PageHeader, Card, StatCard, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { fmtMoney, fmtDate } from "@/lib/format";

const BANKS = ["CBZ", "NMB", "Stanbic", "Ecobank"];
const ENTITIES = ["Rulethu", "WA Asset Mgmt", "MFI"];
const CURRENCIES = ["USD", "ZWG", "ZAR"];

const DEFAULT_LINES: CashLine[] = [
  { bank: "CBZ", entity: "Rulethu", currency: "USD", opening: 123_456, receipts: 1_234, payments: 135, charges: 12 },
  { bank: "CBZ", entity: "Rulethu", currency: "ZWG", opening: 123_456, receipts: 0, payments: 0, charges: 0 },
  { bank: "NMB", entity: "Rulethu", currency: "USD", opening: 123_456, receipts: 1_234, payments: 123, charges: 12 },
  { bank: "NMB", entity: "WA Asset Mgmt", currency: "USD", opening: 123_456, receipts: 0, payments: 0, charges: 0 },
];

const closing = (l: CashLine) => l.opening + l.receipts - l.payments - l.charges;

export default function CashReportPage() {
  const { cashReports, add } = useAppData();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<CashLine[]>(DEFAULT_LINES.map((l) => ({ ...l })));
  const [saved, setSaved] = useState(false);

  const setLine = (i: number, patch: Partial<CashLine>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((p) => [...p, { bank: "CBZ", entity: "Rulethu", currency: "USD", opening: 0, receipts: 0, payments: 0, charges: 0 }]);
  const delLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const byCcy = useMemo(() => {
    const m: Record<string, { opening: number; receipts: number; payments: number; charges: number; closing: number }> = {};
    for (const l of lines) {
      const k = l.currency;
      m[k] = m[k] || { opening: 0, receipts: 0, payments: 0, charges: 0, closing: 0 };
      m[k].opening += l.opening; m[k].receipts += l.receipts; m[k].payments += l.payments; m[k].charges += l.charges; m[k].closing += closing(l);
    }
    return m;
  }, [lines]);

  const usd = byCcy["USD"];

  // month-to-date roll-up from saved reports
  const monthKey = date.slice(0, 7);
  const monthReports = cashReports.filter((r) => r.date.slice(0, 7) === monthKey);
  const mtdNet = monthReports.reduce((s, r) => s + r.lines.filter((l) => l.currency === "USD").reduce((x, l) => x + l.receipts - l.payments - l.charges, 0), 0);

  const save = () => {
    const report: CashReport = { id: genId("CR"), date, author: CURRENT_USER, lines: lines.map((l) => ({ ...l })), createdAt: new Date().toISOString() };
    add("cashReports", report, { title: "Daily cash report filed", body: `${fmtDate(date)} — closing USD ${fmtMoney(byCcy["USD"]?.closing ?? 0)}`, module: "finance" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };
  const cell = "w-24 rounded border px-2 py-1 text-right text-sm tabular";

  return (
    <div>
      <PageHeader
        title="Finance · Daily Cash Report"
        subtitle="Consolidate the banks' daily balances into one cash position. Each day feeds the weekly, monthly and annual roll-up."
        actions={
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
            <button onClick={save} className="rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>File report</button>
          </div>
        }
      />
      <ModuleTabs moduleKey="finance" />

      {saved && <div className="mb-4"><Badge tone="pos">Filed — everyone notified & rolled into the month</Badge></div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Closing (USD)" value={fmtMoney(usd?.closing ?? 0)} hint="all banks" />
        <StatCard label="Receipts today (USD)" value={fmtMoney(usd?.receipts ?? 0)} />
        <StatCard label="Payments today (USD)" value={fmtMoney((usd?.payments ?? 0) + (usd?.charges ?? 0))} />
        <StatCard label="Net MTD (USD)" value={fmtMoney(mtdNet)} hint={`${monthReports.length} reports this month`} />
      </div>

      <SectionTitle hint="opening + receipts − payments − charges = closing">Bank balances</SectionTitle>
      <Card className="!p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["Bank", "Entity", "Ccy", "Opening", "Receipts", "Payments", "Charges", "Closing", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <select value={l.bank} onChange={(e) => setLine(i, { bank: e.target.value })} className="rounded border px-2 py-1 text-sm" style={inputStyle}>{BANKS.map((b) => <option key={b}>{b}</option>)}</select>
                  </td>
                  <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <select value={l.entity} onChange={(e) => setLine(i, { entity: e.target.value })} className="rounded border px-2 py-1 text-sm" style={inputStyle}>{ENTITIES.map((b) => <option key={b}>{b}</option>)}</select>
                  </td>
                  <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <select value={l.currency} onChange={(e) => setLine(i, { currency: e.target.value })} className="rounded border px-2 py-1 text-sm" style={inputStyle}>{CURRENCIES.map((b) => <option key={b}>{b}</option>)}</select>
                  </td>
                  <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}><input type="number" value={l.opening} onChange={(e) => setLine(i, { opening: +e.target.value })} className={cell} style={inputStyle} /></td>
                  <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}><input type="number" value={l.receipts} onChange={(e) => setLine(i, { receipts: +e.target.value })} className={cell} style={inputStyle} /></td>
                  <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}><input type="number" value={l.payments} onChange={(e) => setLine(i, { payments: +e.target.value })} className={cell} style={inputStyle} /></td>
                  <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}><input type="number" value={l.charges} onChange={(e) => setLine(i, { charges: +e.target.value })} className={cell} style={inputStyle} /></td>
                  <td className="px-3 py-1.5 text-right tabular font-medium" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{fmtMoney(closing(l), l.currency)}</td>
                  <td className="px-3 py-1.5 text-center" style={{ borderTop: "1px solid var(--border)" }}><button onClick={() => delLine(i)} style={{ color: "var(--text-faint)" }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={addLine} className="text-sm font-medium" style={{ color: "var(--brand)" }}>+ Add bank line</button>
        </div>
      </Card>

      <SectionTitle>Consolidated position</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {Object.entries(byCcy).map(([ccy, t]) => (
          <Card key={ccy}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold" style={{ color: "var(--text)" }}>{ccy}</span>
              <Badge tone="neutral">closing</Badge>
            </div>
            <div className="text-2xl font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(t.closing, ccy)}</div>
            <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>opening {fmtMoney(t.opening, ccy)} · +{fmtMoney(t.receipts, ccy)} −{fmtMoney(t.payments + t.charges, ccy)}</div>
          </Card>
        ))}
      </div>

      <SectionTitle hint="feeds weekly → monthly → annual">Filed reports</SectionTitle>
      {cashReports.length === 0 ? (
        <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No reports filed yet — fill today&apos;s balances and click File report.</span></Card>
      ) : (
        <div className="space-y-2">
          {[...cashReports].reverse().map((r) => {
            const c = r.lines.filter((l) => l.currency === "USD").reduce((s, l) => s + closing(l), 0);
            return (
              <Card key={r.id} className="flex items-center justify-between">
                <div><span className="font-medium" style={{ color: "var(--text)" }}>{fmtDate(r.date)}</span> <span className="text-xs" style={{ color: "var(--text-faint)" }}>· {r.author} · {r.lines.length} lines</span></div>
                <span className="tabular font-medium" style={{ color: "var(--text)" }}>USD {fmtMoney(c)}</span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
