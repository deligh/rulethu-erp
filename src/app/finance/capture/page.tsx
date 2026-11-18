"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/store";
import { PageHeader, Card, Badge, SectionTitle, StatCard, Table, Th, Td } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { CAPTURE_TYPES, captureLines, CAPTURE_SOURCE, CaptureDir } from "@/lib/fincapture";
import { accountName } from "@/lib/coa";
import { fmtMoney, fmtDate } from "@/lib/format";

const TODAY = new Date().toISOString().slice(0, 10);
const DIRS: { key: CaptureDir; label: string }[] = [
  { key: "in", label: "💵 Money in" }, { key: "out", label: "🧾 Money out" }, { key: "other", label: "⚙ Other" },
];

export default function CapturePage() {
  const { entries, addEntry, removeEntry } = useAppData();
  const [dir, setDir] = useState<CaptureDir>("in");
  const [typeKey, setTypeKey] = useState("interest");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY);
  const [party, setParty] = useState("");
  const [desc, setDesc] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const types = CAPTURE_TYPES.filter((t) => t.dir === dir);
  const type = CAPTURE_TYPES.find((t) => t.key === typeKey) ?? types[0];
  const amt = Number(amount) || 0;

  const pickDir = (d: CaptureDir) => { setDir(d); const first = CAPTURE_TYPES.find((t) => t.dir === d); if (first) setTypeKey(first.key); };

  const captures = useMemo(() => entries.filter((e) => e.source?.startsWith(CAPTURE_SOURCE)), [entries]);
  const amountOf = (lines: { debit: number; credit: number }[]) => Math.max(...lines.map((l) => Math.max(l.debit, l.credit)), 0);
  const dirOf = (source: string): CaptureDir => (source.endsWith("in") ? "in" : source.endsWith("out") ? "out" : "other");

  const today = useMemo(() => {
    let moneyIn = 0, moneyOut = 0;
    for (const e of captures) if (e.date === TODAY) {
      const a = amountOf(e.lines), d = dirOf(e.source);
      if (d === "in") moneyIn += a; else if (d === "out") moneyOut += a;
    }
    return { moneyIn, moneyOut, net: moneyIn - moneyOut };
  }, [captures]);

  const save = () => {
    if (!type || amt <= 0) return;
    const memo = `${type.label}${party.trim() ? ` — ${party.trim()}` : ""}${desc.trim() ? `: ${desc.trim()}` : ""}`;
    addEntry(memo, `${CAPTURE_SOURCE} · ${type.dir}`, captureLines(type, amt), date);
    setSaved(`Recorded ${fmtMoney(amt)} — ${type.label}. The ledger and statements are updated.`);
    setAmount(""); setParty(""); setDesc("");
  };

  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const input = "w-full rounded-md border px-3 py-2 text-sm";

  return (
    <div>
      <PageHeader
        title="Daily Capture"
        subtitle="Record money in and money out in plain language — the system does the double-entry for you, so the books and every statement stay correct without an accountant."
        actions={<Badge tone="live">Auto double-entry</Badge>}
      />
      <ModuleTabs moduleKey="finance" />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Money in today" value={fmtMoney(today.moneyIn)} hint={TODAY} />
        <StatCard label="Money out today" value={fmtMoney(today.moneyOut)} hint={TODAY} />
        <StatCard label="Net today" value={fmtMoney(today.net)} delta={{ value: today.net >= 0 ? "positive" : "negative", positive: today.net >= 0 }} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Capture form */}
        <Card>
          <SectionTitle>Record a transaction</SectionTitle>
          <div className="flex gap-1 rounded-lg border p-0.5 my-3" style={{ borderColor: "var(--border)" }}>
            {DIRS.map((d) => (
              <button key={d.key} onClick={() => pickDir(d.key)} className="flex-1 rounded-md px-2 py-2 text-sm font-medium"
                style={{ background: dir === d.key ? "var(--brand)" : "transparent", color: dir === d.key ? "#fff" : "var(--text-muted)" }}>{d.label}</button>
            ))}
          </div>

          <label className="text-xs" style={{ color: "var(--text-muted)" }}>What happened?
            <select value={typeKey} onChange={(e) => setTypeKey(e.target.value)} className={`${input} mt-1`} style={iStyle}>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          {type && <p className="text-xs mt-1 mb-3" style={{ color: "var(--text-faint)" }}>{type.hint}</p>}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Amount (USD)
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${input} mt-1`} style={iStyle} />
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} style={iStyle} />
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Who / counterparty (optional)
              <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="e.g. Tanaka Retail" className={`${input} mt-1`} style={iStyle} />
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Note (optional)
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. September rent" className={`${input} mt-1`} style={iStyle} />
            </label>
          </div>

          {/* live double-entry preview */}
          {type && amt > 0 && (
            <div className="mt-3 rounded-md border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="font-semibold mb-1" style={{ color: "var(--text)" }}>The system will record (double-entry):</div>
              <div style={{ color: "var(--text-muted)" }}>Debit <strong>{type.drCode} {accountName(type.drCode)}</strong> {fmtMoney(amt)}</div>
              <div style={{ color: "var(--text-muted)" }}>Credit <strong>{type.crCode} {accountName(type.crCode)}</strong> {fmtMoney(amt)}</div>
              <div className="mt-1" style={{ color: "var(--pos)" }}>Balanced ✓</div>
            </div>
          )}

          <button onClick={save} disabled={!type || amt <= 0} className="mt-3 w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Record transaction</button>
          {saved && <p className="mt-2 text-xs" style={{ color: "var(--pos)" }}>{saved}</p>}
        </Card>

        {/* Recent captures */}
        <Card>
          <SectionTitle hint="posts straight into the General Ledger">Recent entries</SectionTitle>
          {captures.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>No daily captures yet. Record your first transaction on the left.</p>
          ) : (
            <Table head={<><Th>Date</Th><Th>What</Th><Th right>Amount</Th><Th right>{""}</Th></>}>
              {[...captures].reverse().slice(0, 14).map((e) => {
                const d = dirOf(e.source);
                return (
                  <tr key={e.id}>
                    <Td>{fmtDate(e.date)}</Td>
                    <Td><span className="text-xs">{e.memo}</span></Td>
                    <Td right><span style={{ color: d === "in" ? "var(--pos)" : d === "out" ? "var(--neg)" : "var(--text)" }}>{d === "out" ? "-" : d === "in" ? "+" : ""}{fmtMoney(amountOf(e.lines))}</span></Td>
                    <Td right><button onClick={() => removeEntry(e.id)} className="text-xs" style={{ color: "var(--neg)" }} title="Undo this entry">✕</button></Td>
                  </tr>
                );
              })}
            </Table>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>Every entry here flows into the Trial Balance and the weekly / monthly / annual Financial Statements automatically.</p>
        </Card>
      </div>
    </div>
  );
}
