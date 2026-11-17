"use client";

import { useAppData, genId } from "@/lib/store";
import { PurchaseOrder } from "@/lib/seed";
import { PageHeader, StatCard, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleProgress from "@/components/ModuleProgress";
import ModuleTabs from "@/components/ModuleTabs";
import AIChecks from "@/components/AIChecks";
import QuickAdd from "@/components/QuickAdd";
import DownloadButtons from "@/components/DownloadButtons";
import { fmtMoney } from "@/lib/format";

const STATUSES: PurchaseOrder["status"][] = ["Requisition", "Pending Approval", "Approved", "Ordered", "Received", "Paid"];
const TONE: Record<string, "pos" | "warn" | "neg" | "beta" | "neutral"> = {
  Requisition: "neutral", "Pending Approval": "warn", Approved: "beta", Ordered: "beta", Received: "warn", Paid: "pos",
};

export default function ProcurementPage() {
  const { pos, vendors, add, patch, addEntry } = useAppData();
  const today = new Date().toISOString().slice(0, 10);

  const pending = pos.filter((p) => p.status === "Pending Approval");
  const totalOpen = pos.filter((p) => p.status !== "Paid").reduce((s, p) => s + p.amount, 0);
  const paid = pos.filter((p) => p.status === "Paid").reduce((s, p) => s + p.amount, 0);

  const changeStatus = (po: PurchaseOrder, status: PurchaseOrder["status"]) => {
    const patchObj: Partial<PurchaseOrder> = { status };
    if (status === "Received") patchObj.receivedDate = today;
    patch("pos", po.id, patchObj, { title: `PO ${status}`, body: `${po.vendor} — ${fmtMoney(po.amount, po.currency)}`, module: "procurement" });
    if (status === "Paid" && po.status !== "Paid") {
      addEntry(`Vendor payment — ${po.vendor} (${po.id})`, `Procurement ${po.id}`, [
        { accountCode: "5000", debit: po.amount, credit: 0 },
        { accountCode: "1000", debit: 0, credit: po.amount },
      ]);
    }
  };

  const addPO = (v: Record<string, string>) => {
    const po: PurchaseOrder = {
      id: genId("PO"), vendor: v.vendor, description: v.description,
      amount: parseFloat(v.amount) || 0, currency: v.currency || "USD",
      status: "Requisition", requester: v.requester || "Delight", date: today,
    };
    add("pos", po, { title: "New requisition raised", body: `${po.vendor} — ${fmtMoney(po.amount, po.currency)}`, module: "procurement" });
  };

  const exportCols = [{ key: "id", label: "PO" }, { key: "vendor", label: "Vendor" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount" }, { key: "status", label: "Status" }];
  const exportRows = pos.map((p) => ({ id: p.id, vendor: p.vendor, description: p.description, amount: fmtMoney(p.amount, p.currency), status: p.status }));

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="Source to pay — requisition, approval, order, goods-receipt and payment. A paid PO posts straight to Finance."
        actions={
          <div className="flex items-center gap-2">
            <DownloadButtons filename="purchase-orders" title="Purchase Orders" subtitle="Rulethu Holdings" columns={exportCols} rows={exportRows} sheetName="POs" />
            <QuickAdd
              buttonLabel="New PO"
              title="Raise a purchase order"
              submitLabel="Raise PO"
              onSubmit={addPO}
              fields={[
                { key: "vendor", label: "Vendor", type: "select", options: vendors.map((v) => v.name), required: true },
                { key: "description", label: "Description", required: true, placeholder: "What is being bought" },
                { key: "amount", label: "Amount", type: "number", required: true, min: 0, step: 100 },
                { key: "currency", label: "Currency", type: "select", options: ["USD", "ZWG", "ZAR"] },
                { key: "requester", label: "Requester", default: "Delight" },
              ]}
            />
          </div>
        }
      />

      <ModuleTabs moduleKey="procurement" />
      <ModuleProgress module="procurement" />
      <AIChecks moduleKey="procurement" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Open commitments" value={fmtMoney(totalOpen)} hint="not yet paid" />
        <StatCard label="Awaiting approval" value={String(pending.length)} delta={pending.length ? { value: "action needed", positive: false } : undefined} />
        <StatCard label="Paid" value={fmtMoney(paid)} hint="posted to Finance" />
        <StatCard label="Active vendors" value={String(vendors.length)} />
      </div>

      <SectionTitle hint="move each PO through the lifecycle inline">Purchase orders</SectionTitle>
      <Table head={<><Th>PO</Th><Th>Vendor</Th><Th>Description</Th><Th right>Amount</Th><Th>Status</Th></>}>
        {pos.map((p) => (
          <tr key={p.id}>
            <Td strong>{p.id}<div className="text-xs" style={{ color: "var(--text-faint)" }}>{p.requester}</div></Td>
            <Td>{p.vendor}</Td>
            <Td>{p.description}{p.receivedDate && <div className="text-xs" style={{ color: "var(--text-faint)" }}>received {p.receivedDate}</div>}</Td>
            <Td right>{fmtMoney(p.amount, p.currency)}</Td>
            <Td>
              <div className="flex items-center gap-2">
                <Badge tone={TONE[p.status]}>{p.status}</Badge>
                <select value={p.status} onChange={(e) => changeStatus(p, e.target.value as PurchaseOrder["status"])} className="rounded-lg border px-2 py-1 text-xs" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
