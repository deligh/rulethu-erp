"use client";

import { useAppData } from "@/lib/store";
import { PurchaseOrder } from "@/lib/seed";
import { PageHeader, StatCard, Badge, SectionTitle, Table, Th, Td, Card } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { fmtMoney } from "@/lib/format";

export default function PaymentsPage() {
  const { pos, patch, addEntry } = useAppData();
  const due = pos.filter((p) => p.status === "Received");
  const paid = pos.filter((p) => p.status === "Paid");
  const totalDue = due.reduce((s, p) => s + p.amount, 0);
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0);

  const pay = (p: PurchaseOrder) => {
    patch("pos", p.id, { status: "Paid" }, { title: "Vendor paid", body: `${p.vendor} — ${fmtMoney(p.amount, p.currency)}`, module: "finance" });
    addEntry(`Vendor payment — ${p.vendor} (${p.id})`, `Procurement ${p.id}`, [
      { accountCode: "5000", debit: p.amount, credit: 0 },
      { accountCode: "1000", debit: 0, credit: p.amount },
    ]);
  };

  return (
    <div>
      <PageHeader title="Procurement · Payments" subtitle="Pay received purchase orders. Each payment posts the journal into Finance automatically." />
      <ModuleTabs moduleKey="procurement" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Due for payment" value={fmtMoney(totalDue)} hint={`${due.length} POs received`} />
        <StatCard label="Paid to date" value={fmtMoney(totalPaid)} hint={`${paid.length} POs`} />
        <StatCard label="Vendors paid" value={String(new Set(paid.map((p) => p.vendor)).size)} />
      </div>

      <SectionTitle hint="received & awaiting payment">Payment run</SectionTitle>
      {due.length === 0 ? <Card className="border-dashed mb-8"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing due for payment.</span></Card> : (
        <div className="mb-8">
          <Table head={<><Th>PO</Th><Th>Vendor</Th><Th>Description</Th><Th>Received</Th><Th right>Amount</Th><Th right>Action</Th></>}>
            {due.map((p) => (
              <tr key={p.id}>
                <Td strong>{p.id}</Td><Td>{p.vendor}</Td><Td>{p.description}</Td><Td>{p.receivedDate ?? "—"}</Td><Td right>{fmtMoney(p.amount, p.currency)}</Td>
                <Td right><button onClick={() => pay(p)} className="rounded px-3 py-1.5 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Pay & post</button></Td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <SectionTitle>Paid</SectionTitle>
      {paid.length === 0 ? <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No payments yet.</span></Card> : (
        <Table head={<><Th>PO</Th><Th>Vendor</Th><Th>Description</Th><Th right>Amount</Th><Th>Status</Th></>}>
          {paid.map((p) => (
            <tr key={p.id}><Td strong>{p.id}</Td><Td>{p.vendor}</Td><Td>{p.description}</Td><Td right>{fmtMoney(p.amount, p.currency)}</Td><Td><Badge tone="pos">Paid</Badge></Td></tr>
          ))}
        </Table>
      )}
    </div>
  );
}
