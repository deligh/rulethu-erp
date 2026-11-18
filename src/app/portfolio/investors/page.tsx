"use client";

import { useMemo, useState } from "react";
import { useAppData, genId, Investor } from "@/lib/store";
import { PageHeader, Card, Badge, SectionTitle, Table, Th, Td, StatCard } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { BarChart, Donut } from "@/components/Charts";
import { compact, fmtMoney, fmtPct, fmtDate } from "@/lib/format";

const REL_TONE: Record<Investor["relationship"], "live" | "info" | "warn" | "neutral"> = {
  Active: "live", Committed: "info", Prospect: "warn", Exited: "neutral",
};

export default function InvestorsPage() {
  const { investors, add, employees } = useAppData();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<Partial<Investor>>({ type: "Institutional", relationship: "Prospect" });

  const t = useMemo(() => {
    const committed = investors.reduce((s, i) => s + i.committed, 0);
    const called = investors.reduce((s, i) => s + i.called, 0);
    const distributed = investors.reduce((s, i) => s + i.distributed, 0);
    const dry = committed - called;
    const dpi = called ? distributed / called : 0;
    return { committed, called, distributed, dry, dpi };
  }, [investors]);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    investors.forEach((i) => m.set(i.type, (m.get(i.type) ?? 0) + i.committed));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [investors]);

  const topLPs = useMemo(
    () => [...investors].sort((a, b) => b.committed - a.committed).slice(0, 7).map((i) => ({ label: i.name, value: i.committed })),
    [investors]
  );

  const save = () => {
    if (!f.name?.trim()) return;
    add("investors", {
      id: genId("LP"),
      name: f.name.trim(),
      type: (f.type as Investor["type"]) || "Institutional",
      contact: f.contact?.trim() || undefined,
      email: f.email?.trim() || undefined,
      committed: Number(f.committed) || 0,
      called: Number(f.called) || 0,
      distributed: Number(f.distributed) || 0,
      relationship: (f.relationship as Investor["relationship"]) || "Prospect",
      owner: f.owner?.trim() || employees[0]?.name || "",
      lastContact: f.lastContact || new Date().toISOString().slice(0, 10),
      note: f.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }, { title: "Investor added", body: f.name.trim(), module: "portfolio" });
    setF({ type: "Institutional", relationship: "Prospect" });
    setAdding(false);
  };

  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const input = "rounded-md border px-2.5 py-1.5 text-sm w-full";

  return (
    <div>
      <PageHeader
        title="Investors (LP) CRM"
        subtitle="Every limited-partner relationship in one place — commitments, capital called, distributions and who owns the relationship."
        actions={<button onClick={() => setAdding((v) => !v)} className="rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>{adding ? "Close" : "+ Add investor"}</button>}
      />
      <ModuleTabs moduleKey="portfolio" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total commitments" value={compact(t.committed, "USD")} hint={`${investors.length} relationships`} />
        <StatCard label="Capital called" value={compact(t.called, "USD")} hint={fmtPct(t.committed ? t.called / t.committed : 0, 0) + " of commitments"} />
        <StatCard label="Dry powder" value={compact(t.dry, "USD")} hint="uncalled commitments" />
        <StatCard label="DPI" value={`${t.dpi.toFixed(2)}x`} hint="distributed ÷ called" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <SectionTitle hint="commitments by investor type">Commitments mix</SectionTitle>
          <Donut data={byType} format={(n) => compact(n, "USD")} />
        </Card>
        <Card>
          <SectionTitle hint="largest commitments">Top LPs</SectionTitle>
          <BarChart data={topLPs} format={(n) => compact(n, "USD")} />
        </Card>
      </div>

      {adding && (
        <Card className="mb-6">
          <SectionTitle>New investor</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Name<input className={input} style={iStyle} value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Type
              <select className={input} style={iStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Investor["type"] })}>
                {["Institutional", "Family Office", "DFI", "HNWI", "Corporate"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Relationship
              <select className={input} style={iStyle} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value as Investor["relationship"] })}>
                {["Prospect", "Committed", "Active", "Exited"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Primary contact<input className={input} style={iStyle} value={f.contact ?? ""} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Committed (USD)<input type="number" className={input} style={iStyle} value={f.committed ?? ""} onChange={(e) => setF({ ...f, committed: Number(e.target.value) })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Called (USD)<input type="number" className={input} style={iStyle} value={f.called ?? ""} onChange={(e) => setF({ ...f, called: Number(e.target.value) })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Distributed (USD)<input type="number" className={input} style={iStyle} value={f.distributed ?? ""} onChange={(e) => setF({ ...f, distributed: Number(e.target.value) })} /></label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Relationship owner
              <select className={input} style={iStyle} value={f.owner ?? ""} onChange={(e) => setF({ ...f, owner: e.target.value })}>
                <option value="">—</option>
                {employees.map((e) => <option key={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Last contact<input type="date" className={input} style={iStyle} value={f.lastContact ?? ""} onChange={(e) => setF({ ...f, lastContact: e.target.value })} /></label>
          </div>
          <button onClick={save} disabled={!f.name?.trim()} className="mt-3 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Save investor</button>
        </Card>
      )}

      <Table head={<>
        <Th>Investor</Th><Th>Type</Th><Th right>Committed</Th><Th right>Called</Th><Th right>Distributed</Th><Th right>DPI</Th><Th>Owner</Th><Th>Last contact</Th><Th>Status</Th>
      </>}>
        {investors.map((i) => {
          const dpi = i.called ? i.distributed / i.called : 0;
          return (
            <tr key={i.id}>
              <Td strong>{i.name}{i.contact && <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{i.contact}</div>}</Td>
              <Td>{i.type}</Td>
              <Td right strong>{fmtMoney(i.committed)}</Td>
              <Td right>{fmtMoney(i.called)}</Td>
              <Td right>{fmtMoney(i.distributed)}</Td>
              <Td right>{dpi.toFixed(2)}x</Td>
              <Td>{i.owner}</Td>
              <Td>{i.lastContact ? fmtDate(i.lastContact) : "—"}</Td>
              <Td><Badge tone={REL_TONE[i.relationship]}>{i.relationship}</Badge></Td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>DPI = distributions ÷ capital called. Dry powder is the uncalled portion of commitments.</p>
    </div>
  );
}
