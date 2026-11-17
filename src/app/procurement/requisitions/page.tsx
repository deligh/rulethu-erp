"use client";

import { useAppData, genId, Requisition } from "@/lib/store";
import { PurchaseOrder } from "@/lib/seed";
import { PageHeader, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";
import { fmtMoney, fmtDate } from "@/lib/format";

const TONE: Record<string, "pos" | "warn" | "neg" | "beta" | "neutral"> = { Requested: "warn", Approved: "beta", Converted: "pos", Declined: "neg" };

export default function RequisitionsPage() {
  const { requisitions, add, patch } = useAppData();

  const addReq = (v: Record<string, string>) => {
    const rq: Requisition = { id: genId("RQ"), item: v.item, requester: v.requester || "Delight", department: v.department, estAmount: parseFloat(v.estAmount) || 0, currency: v.currency || "USD", status: "Requested", createdAt: new Date().toISOString() };
    add("requisitions", rq, { title: "Requisition raised", body: `${rq.item} — ${fmtMoney(rq.estAmount, rq.currency)}`, module: "procurement" });
  };

  const convert = (rq: Requisition) => {
    const po: PurchaseOrder = { id: genId("PO"), vendor: "(assign vendor)", description: rq.item, amount: rq.estAmount, currency: rq.currency, status: "Approved", requester: rq.requester, date: new Date().toISOString().slice(0, 10) };
    add("pos", po, { title: "Requisition converted to PO", body: `${rq.item}`, module: "procurement" });
    patch("requisitions", rq.id, { status: "Converted" });
  };

  return (
    <div>
      <PageHeader
        title="Procurement · Requisitions"
        subtitle="Internal purchase requests — approve, then convert into a purchase order."
        actions={
          <QuickAdd buttonLabel="New requisition" title="Raise a requisition" submitLabel="Raise" onSubmit={addReq} fields={[
            { key: "item", label: "Item / service", required: true },
            { key: "department", label: "Department", type: "select", options: ["Investments", "Research", "Finance", "Operations", "IT", "Executive"], required: true },
            { key: "estAmount", label: "Est. amount", type: "number", required: true, min: 0, step: 100 },
            { key: "currency", label: "Currency", type: "select", options: ["USD", "ZWG", "ZAR"] },
            { key: "requester", label: "Requester", default: "Delight" },
          ]} />
        }
      />
      <ModuleTabs moduleKey="procurement" />
      <SectionTitle hint="requisition → approve → convert to PO">Requisitions</SectionTitle>
      <Table head={<><Th>Ref</Th><Th>Item</Th><Th>Department</Th><Th>Requester</Th><Th right>Est. amount</Th><Th>Status</Th><Th right>Action</Th></>}>
        {requisitions.map((rq) => (
          <tr key={rq.id}>
            <Td strong>{rq.id}<div className="text-xs" style={{ color: "var(--text-faint)" }}>{fmtDate(rq.createdAt.slice(0, 10))}</div></Td>
            <Td>{rq.item}</Td>
            <Td>{rq.department}</Td>
            <Td>{rq.requester}</Td>
            <Td right>{fmtMoney(rq.estAmount, rq.currency)}</Td>
            <Td><Badge tone={TONE[rq.status]}>{rq.status}</Badge></Td>
            <Td right>
              {rq.status === "Requested" && <span className="flex gap-1 justify-end"><button onClick={() => patch("requisitions", rq.id, { status: "Approved" })} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Approve</button><button onClick={() => patch("requisitions", rq.id, { status: "Declined" })} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Decline</button></span>}
              {rq.status === "Approved" && <button onClick={() => convert(rq)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Convert to PO</button>}
              {(rq.status === "Converted" || rq.status === "Declined") && <span className="text-xs" style={{ color: "var(--text-faint)" }}>—</span>}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
