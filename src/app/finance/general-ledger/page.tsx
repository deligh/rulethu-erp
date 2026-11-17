"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/store";
import { CHART_OF_ACCOUNTS, accountName } from "@/lib/coa";
import { fmtMoney, fmtDate } from "@/lib/format";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";

interface DraftLine {
  accountCode: string;
  debit: string;
  credit: string;
}

const EMPTY_LINE: DraftLine = { accountCode: CHART_OF_ACCOUNTS[0].code, debit: "", credit: "" };

export default function GeneralLedgerPage() {
  const { entries, addEntry } = useAppData();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { ...EMPTY_LINE },
    { ...EMPTY_LINE },
  ]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const postings = useMemo(() => {
    const rows: { date: string; memo: string; account: string; debit: number; credit: number; source: string }[] = [];
    for (const e of entries) {
      for (const l of e.lines) {
        rows.push({ date: e.date, memo: e.memo, account: accountName(l.accountCode), debit: l.debit, credit: l.credit, source: e.source });
      }
    }
    return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [entries]);

  const setLine = (i: number, field: keyof DraftLine, v: string) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: v } : l)));

  const post = () => {
    if (!totals.balanced) return;
    addEntry(
      memo || "Manual journal",
      "Manual",
      lines
        .filter((l) => (parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0)
        .map((l) => ({ accountCode: l.accountCode, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 })),
      date,
    );
    setMemo("");
    setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  const exportRows = postings.map((p) => ({
    date: p.date,
    memo: p.memo,
    account: p.account,
    debit: p.debit || "",
    credit: p.credit || "",
    source: p.source,
  }));
  const exportCols = [
    { key: "date", label: "Date" },
    { key: "memo", label: "Memo" },
    { key: "account", label: "Account" },
    { key: "debit", label: "Debit" },
    { key: "credit", label: "Credit" },
    { key: "source", label: "Source" },
  ];

  return (
    <div>
      <PageHeader
        title="Finance · General Ledger"
        subtitle="Post journal entries here — the Trial Balance and financial statements update automatically."
        actions={
          <div className="flex items-center gap-2">
            <DownloadButtons filename="general-ledger" title="General Ledger" subtitle="Rulethu Holdings" columns={exportCols} rows={exportRows} sheetName="Ledger" />
            <Link href="/finance/trial-balance" className="rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>
              View Trial Balance →
            </Link>
          </div>
        }
      />

      <ModuleTabs moduleKey="finance" />

      {/* New entry */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: "var(--text)" }}>New journal entry</h3>
          <Badge tone={totals.balanced ? "pos" : "neutral"}>
            Dr {fmtMoney(totals.debit)} · Cr {fmtMoney(totals.credit)}
          </Badge>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
          </label>
          <label className="block">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Memo</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
          </label>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_120px_32px] gap-2 items-center">
              <select value={l.accountCode} onChange={(e) => setLine(i, "accountCode", e.target.value)} className="rounded-lg border px-2 py-2 text-sm" style={inputStyle}>
                {CHART_OF_ACCOUNTS.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
              <input type="number" placeholder="Debit" value={l.debit} onChange={(e) => setLine(i, "debit", e.target.value)} className="rounded-lg border px-2 py-2 text-sm text-right tabular" style={inputStyle} />
              <input type="number" placeholder="Credit" value={l.credit} onChange={(e) => setLine(i, "credit", e.target.value)} className="rounded-lg border px-2 py-2 text-sm text-right tabular" style={inputStyle} />
              <button
                onClick={() => setLines((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev))}
                className="text-sm"
                style={{ color: "var(--text-faint)" }}
                aria-label="Remove line"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setLines((p) => [...p, { ...EMPTY_LINE }])} className="text-sm font-medium" style={{ color: "var(--brand)" }}>
            + Add line
          </button>
          <button
            onClick={post}
            disabled={!totals.balanced}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "var(--brand)" }}
          >
            Post entry
          </button>
        </div>
        {!totals.balanced && (
          <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
            Enter a balanced entry (total debits must equal total credits) to post.
          </p>
        )}
      </Card>

      {/* Ledger */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--surface-2)" }}>
            <tr>
              {["Date", "Memo", "Account", "Debit", "Credit", "Source"].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-xs uppercase tracking-wide ${i >= 3 && i <= 4 ? "text-right" : "text-left"}`} style={{ color: "var(--text-faint)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {postings.map((p, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}>{fmtDate(p.date)}</td>
                <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{p.memo}</td>
                <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{p.account}</td>
                <td className="px-4 py-2.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{p.debit ? fmtMoney(p.debit) : ""}</td>
                <td className="px-4 py-2.5 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{p.credit ? fmtMoney(p.credit) : ""}</td>
                <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}>
                  <span className="text-xs">{p.source}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
