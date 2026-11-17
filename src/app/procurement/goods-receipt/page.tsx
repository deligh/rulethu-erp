"use client";

import { useAppData } from "@/lib/store";
import { PurchaseOrder } from "@/lib/seed";
import { PageHeader, Badge, SectionTitle, Table, Th, Td, Card } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { fmtMoney } from "@/lib/format";

export default function GoodsReceiptPage() {
  const { pos, patch } = useAppData();
  const today = new Date().toISOString().slice(0, 10);
  const awaiting = pos.filter((p) => p.status === "Approved" || p.status === "Ordered");
  const received = pos.filter((p) => p.status === "Received" || p.status === "Paid");

  const receive = (p: PurchaseOrder) => patch("pos", p.id, { status: "Received", receivedDate: today }, { title: "Goods received", body: `${p.vendor} — ${p.description}`, module: "procurement" });

  return (
    <div>
      <PageHeader title="Procurement · Goods Receipt" subtitle="Confirm delivery of ordered items. Receipting a PO moves it to payment." />
      <ModuleTabs moduleKey="procurement" />

      <SectionTitle hint="approved / ordered POs">Awaiting receipt</SectionTitle>
      {awaiting.length === 0 ? (
        <Card className="border-dashed mb-8"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing awaiting receipt.</span></Card>
      ) : (
        <div className="mb-8">
          <Table head={<><Th>PO</Th><Th>Vendor</Th><Th>Description</Th><Th right>Amount</Th><Th>Status</Th><Th right>Action</Th></>}>
            {awaiting.map((p) => (
              <tr key={p.id}>
                <Td strong>{p.id}</Td><Td>{p.vendor}</Td><Td>{p.description}</Td><Td right>{fmtMoney(p.amount, p.currency)}</Td>
                <Td><Badge tone="beta">{p.status}</Badge></Td>
                <Td right><button onClick={() => receive(p)} className="rounded px-3 py-1.5 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Receive (GRN)</button></Td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <SectionTitle>Received</SectionTitle>
      {received.length === 0 ? <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No goods received yet.</span></Card> : (
        <Table head={<><Th>PO</Th><Th>Vendor</Th><Th>Description</Th><Th>Received</Th><Th right>Amount</Th><Th>Status</Th></>}>
          {received.map((p) => (
            <tr key={p.id}>
              <Td strong>{p.id}</Td><Td>{p.vendor}</Td><Td>{p.description}</Td><Td>{p.receivedDate ?? "—"}</Td><Td right>{fmtMoney(p.amount, p.currency)}</Td>
              <Td><Badge tone={p.status === "Paid" ? "pos" : "warn"}>{p.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
