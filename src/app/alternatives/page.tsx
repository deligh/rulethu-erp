"use client";

import { useMemo, useState } from "react";
import { useAppData, genId, AltEvent } from "@/lib/store";
import { AltAsset } from "@/lib/seed";
import { PageHeader, StatCard, Badge, SectionTitle, Table, Th, Td, Card } from "@/components/ui";
import ModuleProgress from "@/components/ModuleProgress";
import ModuleTabs from "@/components/ModuleTabs";
import { Tabs } from "@/components/model/ModelKit";
import QuickAdd from "@/components/QuickAdd";
import { fmtMoney, fmtPct, fmtDate } from "@/lib/format";

type Tab = "holdings" | "flows" | "performance";
const TAB_ITEMS = [
  { key: "holdings" as const, label: "Holdings" },
  { key: "flows" as const, label: "Capital Flows" },
  { key: "performance" as const, label: "Performance (J-curve)" },
];

export default function AlternativesPage() {
  const { alts, altEvents, add, patch } = useAppData();
  const [tab, setTab] = useState<Tab>("holdings");

  const committed = alts.reduce((s, a) => s + a.committed, 0);
  const called = alts.reduce((s, a) => s + a.called, 0);
  const nav = alts.reduce((s, a) => s + a.nav, 0);
  const distributed = altEvents.filter((e) => e.type === "Distribution").reduce((s, e) => s + e.amount, 0);
  const moic = called ? nav / called : 0;
  const dpi = called ? distributed / called : 0;
  const tvpi = called ? (nav + distributed) / called : 0;

  const addAsset = (v: Record<string, string>) => {
    const asset: AltAsset = { id: genId("A"), name: v.name, class: v.class as AltAsset["class"], committed: parseFloat(v.committed) || 0, called: parseFloat(v.called) || 0, nav: parseFloat(v.nav) || 0, vintage: parseInt(v.vintage) || new Date().getFullYear() };
    add("alts", asset, { title: "Holding added", body: asset.name, module: "alternatives" });
  };

  const recordEvent = (v: Record<string, string>) => {
    const asset = alts.find((a) => a.name === v.asset);
    if (!asset) return;
    const amount = parseFloat(v.amount) || 0;
    const ev: AltEvent = { id: genId("AE"), assetId: asset.id, assetName: asset.name, type: v.type as AltEvent["type"], amount, date: v.date || new Date().toISOString().slice(0, 10) };
    add("altEvents", ev, { title: `${ev.type} recorded`, body: `${asset.name} — ${fmtMoney(amount)}`, module: "alternatives" });
    if (ev.type === "Call") patch("alts", asset.id, { called: asset.called + amount });
    if (ev.type === "Valuation") patch("alts", asset.id, { nav: amount });
  };

  // J-curve: cumulative net cash flow (-calls + distributions) over time
  const jcurve = useMemo(() => {
    const evs = [...altEvents].filter((e) => e.type !== "Valuation").sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0; return evs.map((e) => { cum += e.type === "Distribution" ? e.amount : -e.amount; return { date: e.date, cum }; });
  }, [altEvents]);
  const jMax = Math.max(1, ...jcurve.map((p) => Math.abs(p.cum)));

  return (
    <div>
      <PageHeader
        title="Alternative Investments"
        subtitle="Private equity, real estate, infrastructure and commodities — commitments, capital calls, distributions, DPI/TVPI and the J-curve."
        actions={
          <QuickAdd buttonLabel="Add holding" title="Add an alternative holding" submitLabel="Add holding" onSubmit={addAsset} fields={[
            { key: "name", label: "Asset name", required: true },
            { key: "class", label: "Class", type: "select", options: ["Private Equity", "Real Estate", "Infrastructure", "Commodities"], required: true },
            { key: "vintage", label: "Vintage", type: "number", min: 2000, step: 1, default: 2026 },
            { key: "committed", label: "Committed (USD)", type: "number", required: true, min: 0, step: 100000 },
            { key: "called", label: "Called (USD)", type: "number", min: 0, step: 100000 },
            { key: "nav", label: "NAV (USD)", type: "number", min: 0, step: 100000 },
          ]} />
        }
      />
      <ModuleTabs moduleKey="alternatives" />
      <ModuleProgress module="alternatives" />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Committed" value={fmtMoney(committed)} hint={`${alts.length} holdings`} />
        <StatCard label="Called" value={fmtMoney(called)} hint={committed ? fmtPct(called / committed) + " drawn" : undefined} />
        <StatCard label="Distributed" value={fmtMoney(distributed)} />
        <StatCard label="NAV" value={fmtMoney(nav)} />
        <StatCard label="DPI" value={`${dpi.toFixed(2)}x`} hint="dist / called" />
        <StatCard label="TVPI" value={`${tvpi.toFixed(2)}x`} delta={{ value: fmtPct(tvpi - 1), positive: tvpi >= 1 }} hint="(NAV+dist)/called" />
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === "holdings" && (
        <Table head={<><Th>Asset</Th><Th>Class</Th><Th right>Vintage</Th><Th right>Committed</Th><Th right>Called</Th><Th right>NAV</Th><Th right>MOIC</Th></>}>
          {alts.map((a) => { const m = a.called ? a.nav / a.called : 0; return (
            <tr key={a.id}>
              <Td strong>{a.name}</Td><Td><Badge tone="neutral">{a.class}</Badge></Td><Td right>{a.vintage}</Td><Td right>{fmtMoney(a.committed)}</Td><Td right>{fmtMoney(a.called)}</Td><Td right strong>{fmtMoney(a.nav)}</Td><Td right><span style={{ color: m >= 1 ? "var(--pos)" : "var(--neg)" }}>{m.toFixed(2)}x</span></Td>
            </tr>
          ); })}
        </Table>
      )}

      {tab === "flows" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle hint="calls, distributions & valuations">Capital flows</SectionTitle>
            <QuickAdd buttonLabel="Record flow" title="Record a capital flow" submitLabel="Record" onSubmit={recordEvent} columns={2} fields={[
              { key: "asset", label: "Asset", type: "select", options: alts.map((a) => a.name), required: true },
              { key: "type", label: "Type", type: "select", options: ["Call", "Distribution", "Valuation"], required: true },
              { key: "amount", label: "Amount (USD)", type: "number", required: true, min: 0, step: 100000 },
              { key: "date", label: "Date", type: "date" },
            ]} />
          </div>
          <Table head={<><Th>Date</Th><Th>Asset</Th><Th>Type</Th><Th right>Amount</Th></>}>
            {[...altEvents].reverse().map((e) => (
              <tr key={e.id}><Td strong>{fmtDate(e.date)}</Td><Td>{e.assetName}</Td><Td><Badge tone={e.type === "Distribution" ? "pos" : e.type === "Call" ? "warn" : "beta"}>{e.type}</Badge></Td><Td right>{fmtMoney(e.amount)}</Td></tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "performance" && (
        <Card>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Cumulative net cash flow (J-curve)</h3>
          {jcurve.length === 0 ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>Record calls and distributions to plot the J-curve.</p> : (
            <svg width="100%" viewBox="0 0 720 200" style={{ display: "block" }}>
              {(() => { const W = 720, H = 200, pad = 24, zeroY = H / 2, half = H / 2 - pad; const bw = (W - pad * 2) / jcurve.length; return (<>
                <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="var(--border)" />
                {jcurve.map((p, i) => { const h = (Math.abs(p.cum) / jMax) * half; const x = pad + i * bw + bw * 0.2; const w = bw * 0.6; const y = p.cum >= 0 ? zeroY - h : zeroY; return (
                  <g key={i}><rect x={x} y={y} width={w} height={h} rx={2} fill={p.cum >= 0 ? "var(--pos)" : "var(--neg)"} /><text x={x + w / 2} y={H - 6} fontSize={8} textAnchor="middle" fill="var(--text-faint)">{p.date.slice(2, 7)}</text></g>
                ); })}
              </>); })()}
            </svg>
          )}
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>Cash calls pull the line negative early; distributions lift it back up over time — the classic private-markets J-curve. DPI {dpi.toFixed(2)}x · TVPI {tvpi.toFixed(2)}x.</p>
        </Card>
      )}
    </div>
  );
}
