"use client";

import { useMemo, useState } from "react";
import { useAppData, genId, Holding } from "@/lib/store";
import { PageHeader, Card, Badge, SectionTitle, Table, Th, Td, StatCard } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { BarChart, Donut } from "@/components/Charts";
import { compact, fmtMoney, fmtPct, fmtDate } from "@/lib/format";

const STATUS_TONE: Record<Holding["status"], "live" | "warn" | "neg" | "neutral"> = {
  Performing: "live", Watch: "warn", Underperforming: "neg", Exited: "neutral", "Written off": "neg",
};

export default function HoldingsPage() {
  const { holdings, add, employees } = useAppData();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<Partial<Holding>>({ stage: "Growth", status: "Performing", ownership: 100 });

  const totals = useMemo(() => {
    const live = holdings.filter((h) => h.status !== "Exited" && h.status !== "Written off");
    const invested = live.reduce((s, h) => s + h.invested, 0);
    const nav = live.reduce((s, h) => s + h.fairValue, 0);
    const moic = invested ? nav / invested : 0;
    return { invested, nav, moic, count: live.length, gain: nav - invested };
  }, [holdings]);

  const bySector = useMemo(() => {
    const m = new Map<string, number>();
    holdings.filter((h) => h.status !== "Exited" && h.status !== "Written off").forEach((h) => m.set(h.sector, (m.get(h.sector) ?? 0) + h.fairValue));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const valueVsCost = useMemo(
    () => holdings.filter((h) => h.status !== "Exited" && h.status !== "Written off").map((h) => ({ label: h.company, value: h.fairValue })).sort((a, b) => b.value - a.value),
    [holdings]
  );

  const save = () => {
    if (!f.company?.trim()) return;
    add("holdings", {
      id: genId("H"),
      company: f.company.trim(),
      sector: f.sector?.trim() || "Other",
      stage: (f.stage as Holding["stage"]) || "Growth",
      invested: Number(f.invested) || 0,
      fairValue: Number(f.fairValue) || Number(f.invested) || 0,
      ownership: Number(f.ownership) || 0,
      entryDate: f.entryDate || new Date().toISOString().slice(0, 10),
      status: (f.status as Holding["status"]) || "Performing",
      lead: f.lead?.trim() || employees[0]?.name || "",
      note: f.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }, { title: "Holding added", body: f.company.trim(), module: "portfolio" });
    setF({ stage: "Growth", status: "Performing", ownership: 100 });
    setAdding(false);
  };

  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const input = "rounded-md border px-2.5 py-1.5 text-sm w-full";

  return (
    <div>
      <PageHeader
        title="Portfolio & Investors"
        subtitle="Every holding at a glance — cost, fair value, ownership and performance — with NAV rolled up live."
        actions={<button onClick={() => setAdding((v) => !v)} className="rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>{adding ? "Close" : "+ Add holding"}</button>}
      />
      <ModuleTabs moduleKey="portfolio" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Portfolio NAV" value={compact(totals.nav, "USD")} delta={{ value: fmtPct(totals.invested ? totals.gain / totals.invested : 0, 0), positive: totals.gain >= 0 }} hint="fair value" />
        <StatCard label="Invested (cost)" value={compact(totals.invested, "USD")} hint={`${totals.count} active holdings`} />
        <StatCard label="Gross MOIC" value={`${totals.moic.toFixed(2)}x`} hint="value ÷ cost" />
        <StatCard label="Unrealised gain" value={compact(totals.gain, "USD")} delta={{ value: fmtPct(totals.invested ? totals.gain / totals.invested : 0, 0), positive: totals.gain >= 0 }} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <SectionTitle hint="active holdings, fair value">NAV by sector</SectionTitle>
          <Donut data={bySector} format={(n) => compact(n, "USD")} />
        </Card>
        <Card>
          <SectionTitle hint="fair value by company">Holdings</SectionTitle>
          <BarChart data={valueVsCost} format={(n) => compact(n, "USD")} />
        </Card>
      </div>

      {adding && (
        <Card className="mb-6">
          <SectionTitle>New holding</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Company<input className={input} style={iStyle} value={f.company ?? ""} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Sector<input className={input} style={iStyle} value={f.sector ?? ""} onChange={(e) => setF({ ...f, sector: e.target.value })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Stage
              <select className={input} style={iStyle} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Holding["stage"] })}>
                {["Seed", "Growth", "Buyout", "Private Credit", "Real Assets", "Listed"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Invested (USD)<input type="number" className={input} style={iStyle} value={f.invested ?? ""} onChange={(e) => setF({ ...f, invested: Number(e.target.value) })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Fair value (USD)<input type="number" className={input} style={iStyle} value={f.fairValue ?? ""} onChange={(e) => setF({ ...f, fairValue: Number(e.target.value) })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Ownership %<input type="number" className={input} style={iStyle} value={f.ownership ?? ""} onChange={(e) => setF({ ...f, ownership: Number(e.target.value) })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Deal lead
              <select className={input} style={iStyle} value={f.lead ?? ""} onChange={(e) => setF({ ...f, lead: e.target.value })}>
                <option value="">—</option>
                {employees.map((e) => <option key={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Status
              <select className={input} style={iStyle} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Holding["status"] })}>
                {["Performing", "Watch", "Underperforming", "Exited", "Written off"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Entry date<input type="date" className={input} style={iStyle} value={f.entryDate ?? ""} onChange={(e) => setF({ ...f, entryDate: e.target.value })} /></label>
          </div>
          <button onClick={save} disabled={!f.company?.trim()} className="mt-3 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Save holding</button>
        </Card>
      )}

      <Table head={<>
        <Th>Company</Th><Th>Sector</Th><Th>Stage</Th><Th right>Invested</Th><Th right>Fair value</Th><Th right>MOIC</Th><Th right>Own %</Th><Th>Lead</Th><Th>Status</Th>
      </>}>
        {holdings.map((h) => {
          const moic = h.invested ? h.fairValue / h.invested : 0;
          return (
            <tr key={h.id}>
              <Td strong>{h.company}<div className="text-[11px]" style={{ color: "var(--text-faint)" }}>since {fmtDate(h.entryDate)}</div></Td>
              <Td>{h.sector}</Td>
              <Td>{h.stage}</Td>
              <Td right>{fmtMoney(h.invested)}</Td>
              <Td right strong>{fmtMoney(h.fairValue)}</Td>
              <Td right><span style={{ color: moic >= 1 ? "var(--pos)" : "var(--neg)" }}>{moic.toFixed(2)}x</span></Td>
              <Td right>{h.ownership}%</Td>
              <Td>{h.lead}</Td>
              <Td><Badge tone={STATUS_TONE[h.status]}>{h.status}</Badge></Td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>MOIC = fair value ÷ invested cost. NAV and MOIC recalculate as valuations are updated.</p>
    </div>
  );
}
