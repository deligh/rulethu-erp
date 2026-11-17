"use client";

import { useMemo, useState } from "react";
import { useAppData, genId, TBFrequency, TBill, TBRateChange } from "@/lib/store";
import { computeTB, portfolio } from "@/lib/tbills";
import { PageHeader, StatCard, Badge, SectionTitle, Table, Th, Td, Card } from "@/components/ui";
import { Tabs } from "@/components/model/ModelKit";
import QuickAdd from "@/components/QuickAdd";
import DownloadButtons from "@/components/DownloadButtons";
import { fmtMoney, fmtDate, fmtPct } from "@/lib/format";

type Tab = "portfolio" | "maturity" | "statement" | "rates";
const TAB_ITEMS = [
  { key: "portfolio" as const, label: "Portfolio" },
  { key: "maturity" as const, label: "Maturity Gantt" },
  { key: "statement" as const, label: "Client Statement" },
  { key: "rates" as const, label: "Rate History" },
];

const DAY = 86_400_000;

export default function TreasuryPage() {
  const { tbills, tbRates, add, patch } = useAppData();
  const [tab, setTab] = useState<Tab>("portfolio");
  const [client, setClient] = useState("all");
  const asOf = new Date();

  const clients = Array.from(new Set(tbills.map((t) => t.client)));
  const filtered = client === "all" ? tbills : tbills.filter((t) => t.client === client);
  const pf = useMemo(() => portfolio(filtered, asOf), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = filtered.map((tb) => ({ tb, c: computeTB(tb, asOf) }));

  const addTB = (v: Record<string, string>) => {
    const tb: TBill = { id: genId("TB"), client: v.client || "Rulethu Nominees", reference: v.reference, faceValue: parseFloat(v.faceValue) || 0, couponRate: parseFloat(v.couponRate) || 0, purchasePrice: parseFloat(v.purchasePrice) || 0, issueDate: v.issueDate, maturityDate: v.maturityDate, frequency: (v.frequency as TBFrequency) || "At maturity", createdAt: new Date().toISOString() };
    add("tbills", tb, { title: "Treasury bill added", body: `${tb.reference} — ${fmtMoney(tb.faceValue)}`, module: "treasury" });
  };

  const addRate = (v: Record<string, string>) => {
    const tb = tbills.find((t) => t.id === v.tbId || t.reference === v.tbId);
    if (!tb) return;
    const newRate = parseFloat(v.newRate) || 0;
    const rec: TBRateChange = { id: genId("RC"), tbId: tb.id, reference: tb.reference, date: v.date || new Date().toISOString().slice(0, 10), oldRate: tb.couponRate, newRate, note: v.note || (newRate >= tb.couponRate ? "Step-up" : "Step-down") };
    add("tbRates", rec, { title: "TB rate changed", body: `${tb.reference}: ${tb.couponRate}% → ${newRate}%`, module: "treasury" });
    patch("tbills", tb.id, { couponRate: newRate });
  };

  // maturity timeline bounds
  const active = rows.filter(({ c }) => c.status === "Active");
  const tMin = Math.min(...active.map(({ tb }) => new Date(tb.issueDate).getTime()), asOf.getTime());
  const tMax = Math.max(...active.map(({ tb }) => new Date(tb.maturityDate).getTime()), asOf.getTime() + 30 * DAY);
  const span = Math.max(1, tMax - tMin);
  const pctPos = (t: number) => ((t - tMin) / span) * 100;

  // statement (single client)
  const stmtClient = client === "all" ? clients[0] : client;
  const stmtRows = tbills.filter((t) => t.client === stmtClient).map((tb) => ({ tb, c: computeTB(tb, asOf) }));
  const stmtEarnings = stmtRows.reduce((s, { c }) => s + c.accruedCoupon, 0);

  const printStatement = () => {
    const w = window.open("", "_blank"); if (!w) { alert("Allow pop-ups"); return; }
    const body = stmtRows.map(({ tb, c }) => `<tr><td>${tb.reference}</td><td>${tb.maturityDate}</td><td style="text-align:right">${tb.faceValue.toLocaleString()}</td><td style="text-align:right">${tb.couponRate}%</td><td style="text-align:right">${c.accruedCoupon.toFixed(2)}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Statement — ${stmtClient}</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:760px;margin:32px auto;color:#172b4d}h1{color:#0b5d52}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #e3e6ea;padding:6px 8px;text-align:left}th{color:#667;font-size:11px;text-transform:uppercase}</style></head><body><h1>Rulethu &amp; Co. — Treasury Statement</h1><p><b>Client:</b> ${stmtClient}<br/><b>Statement date:</b> ${new Date().toLocaleDateString("en-GB")}</p><table><thead><tr><th>Reference</th><th>Maturity</th><th style="text-align:right">Face value</th><th style="text-align:right">Coupon</th><th style="text-align:right">Accrued</th></tr></thead><tbody>${body}</tbody></table><p style="margin-top:16px"><b>Net investment earnings (accrued):</b> $${stmtEarnings.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p><p style="font-size:11px;color:#98a2b3">Prepared by Rulethu &amp; Co. Private Limited · Confidential.</p></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <PageHeader
        title="Treasury"
        subtitle="Treasury-bill portfolio by client — coupons, maturities and yields calculated live, with per-client statements and a maturity Gantt."
        actions={
          <QuickAdd buttonLabel="Add TB" title="Add a treasury bill" submitLabel="Add TB" onSubmit={addTB} columns={2} fields={[
            { key: "client", label: "Client account", default: "Rulethu Nominees", required: true },
            { key: "reference", label: "Reference", required: true, placeholder: "FCTB2162 20230704F" },
            { key: "faceValue", label: "Face value", type: "number", required: true, min: 0, step: 10000 },
            { key: "couponRate", label: "Coupon rate %", type: "number", min: 0, step: 0.5 },
            { key: "purchasePrice", label: "Purchase price", type: "number", min: 0, step: 10000 },
            { key: "frequency", label: "Coupon frequency", type: "select", options: ["At maturity", "Annual", "Semi-annual", "Quarterly"] },
            { key: "issueDate", label: "Issue date", type: "date", required: true },
            { key: "maturityDate", label: "Maturity date", type: "date", required: true },
          ]} />
        }
      />
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      <div className="mb-4 flex items-center gap-2">
        <select value={client} onChange={(e) => setClient(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <option value="all">All clients (consolidated)</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{filtered.length} bills · {clients.length} client accounts</span>
      </div>

      {tab === "portfolio" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Portfolio face value" value={fmtMoney(pf.totalFace)} hint={`${pf.active} active`} />
            <StatCard label="Current value" value={fmtMoney(pf.totalValue)} delta={{ value: fmtMoney(pf.totalValue - pf.totalCost), positive: pf.totalValue >= pf.totalCost }} hint="accreted + accrued" />
            <StatCard label="Annual coupon income" value={fmtMoney(pf.annualCouponIncome)} hint={`wtd coupon ${fmtPct(pf.weightedCoupon / 100, 1)}`} />
            <StatCard label="Weighted yield" value={fmtPct(pf.weightedYield, 1)} hint={pf.nextMaturity ? `next: ${fmtDate(pf.nextMaturity.date)}` : undefined} />
          </div>
          <div className="flex items-center justify-between mb-2"><SectionTitle hint="live coupon & accrual">Holdings</SectionTitle><DownloadButtons filename="treasury" title="Treasury Portfolio" columns={[{ key: "ref", label: "Ref" }, { key: "face", label: "Face" }, { key: "val", label: "Value" }]} rows={rows.map(({ tb, c }) => ({ ref: tb.reference, face: fmtMoney(tb.faceValue), val: fmtMoney(c.currentValue) }))} /></div>
          <Table head={<><Th>Reference</Th><Th>Client</Th><Th right>Face</Th><Th right>Coupon</Th><Th right>Cost</Th><Th>Maturity</Th><Th right>Days</Th><Th right>Accrued</Th><Th right>Value</Th><Th>Status</Th></>}>
            {rows.map(({ tb, c }) => (
              <tr key={tb.id}>
                <Td strong>{tb.reference}</Td><Td>{tb.client}</Td><Td right>{fmtMoney(tb.faceValue)}</Td><Td right>{tb.couponRate}%</Td><Td right>{fmtMoney(tb.purchasePrice)}</Td><Td>{fmtDate(tb.maturityDate)}</Td><Td right>{c.status === "Active" ? c.daysToMaturity.toLocaleString() : "—"}</Td><Td right>{fmtMoney(c.accruedCoupon)}</Td><Td right strong>{fmtMoney(c.status === "Active" ? c.currentValue : c.redemptionValue)}</Td><Td><Badge tone={c.status === "Active" ? "pos" : "neutral"}>{c.status}</Badge></Td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {tab === "maturity" && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}><span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Maturity timeline</span> <span className="text-xs" style={{ color: "var(--text-faint)" }}>· dashed line = today</span></div>
          <div className="p-4 space-y-2">
            {active.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No active bills.</p>}
            {active.map(({ tb, c }) => {
              const left = pctPos(new Date(tb.issueDate).getTime());
              const right = pctPos(new Date(tb.maturityDate).getTime());
              return (
                <div key={tb.id} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-xs" style={{ color: "var(--text)" }}>{tb.reference}<div style={{ color: "var(--text-faint)" }}>{tb.client}</div></div>
                  <div className="relative flex-1 h-7 rounded" style={{ background: "var(--surface-2)" }}>
                    <div className="absolute top-0 bottom-0" style={{ left: `${pctPos(asOf.getTime())}%`, borderLeft: "1.5px dashed var(--accent)" }} />
                    <div className="absolute top-1 bottom-1 rounded flex items-center px-2" style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%`, background: "color-mix(in srgb, var(--brand) 22%, transparent)", border: "1px solid var(--brand)" }}>
                      <span className="text-[10px] whitespace-nowrap" style={{ color: "var(--text)" }}>{fmtMoney(tb.faceValue)} · {c.daysToMaturity}d</span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0 text-right text-xs" style={{ color: "var(--text-faint)" }}>{fmtDate(tb.maturityDate)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "statement" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle hint={`client: ${stmtClient}`}>Client statement</SectionTitle>
            <button onClick={printStatement} className="rounded-md border px-3 py-1.5 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Print statement</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <StatCard label="Holdings" value={String(stmtRows.length)} />
            <StatCard label="Face value" value={fmtMoney(stmtRows.reduce((s, { tb }) => s + tb.faceValue, 0))} />
            <StatCard label="Net earnings (accrued)" value={fmtMoney(stmtEarnings)} />
          </div>
          <Table head={<><Th>Reference</Th><Th>Maturity</Th><Th right>Face value</Th><Th right>Coupon</Th><Th>Next coupon</Th><Th right>Accrued</Th></>}>
            {stmtRows.map(({ tb, c }) => (
              <tr key={tb.id}><Td strong>{tb.reference}</Td><Td>{fmtDate(tb.maturityDate)}</Td><Td right>{fmtMoney(tb.faceValue)}</Td><Td right>{tb.couponRate}%</Td><Td>{c.nextCouponDate ? fmtDate(c.nextCouponDate) : "—"}</Td><Td right>{fmtMoney(c.accruedCoupon)}</Td></tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "rates" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle hint="step up / step down">Rate change history</SectionTitle>
            <QuickAdd buttonLabel="Log rate change" title="Change a TB coupon rate" submitLabel="Apply change" onSubmit={addRate} columns={2} fields={[
              { key: "tbId", label: "TB reference", type: "select", options: tbills.map((t) => t.reference), required: true },
              { key: "newRate", label: "New coupon rate %", type: "number", required: true, min: 0, step: 0.25 },
              { key: "date", label: "Effective date", type: "date" },
              { key: "note", label: "Note", placeholder: "reason for step up/down" },
            ]} />
          </div>
          {tbRates.length === 0 ? <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No rate changes logged.</span></Card> : (
            <Table head={<><Th>Date</Th><Th>Reference</Th><Th right>Old rate</Th><Th right>New rate</Th><Th>Change</Th><Th>Note</Th></>}>
              {[...tbRates].reverse().map((rc) => (
                <tr key={rc.id}>
                  <Td strong>{fmtDate(rc.date)}</Td><Td>{rc.reference}</Td><Td right>{rc.oldRate}%</Td><Td right>{rc.newRate}%</Td>
                  <Td><Badge tone={rc.newRate >= rc.oldRate ? "pos" : "neg"}>{rc.newRate >= rc.oldRate ? "▲ step-up" : "▼ step-down"}</Badge></Td><Td>{rc.note}</Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
