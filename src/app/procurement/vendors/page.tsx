"use client";

import { useAppData, genId, Vendor } from "@/lib/store";
import { PageHeader, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";
import { fmtMoney } from "@/lib/format";

export default function VendorsPage() {
  const { vendors, pos, add } = useAppData();
  const spendByVendor = (name: string) => pos.filter((p) => p.vendor === name).reduce((s, p) => s + p.amount, 0);

  const addVendor = (v: Record<string, string>) => {
    const vendor: Vendor = { id: genId("V"), name: v.name, category: v.category, terms: v.terms || "Net 30" };
    add("vendors", vendor, { title: "Vendor added", body: v.name, module: "procurement" });
  };

  return (
    <div>
      <PageHeader
        title="Procurement · Vendors"
        subtitle="Approved vendor master with spend to date."
        actions={<QuickAdd buttonLabel="Add vendor" title="Add a vendor" submitLabel="Add vendor" onSubmit={addVendor} fields={[
          { key: "name", label: "Vendor name", required: true },
          { key: "category", label: "Category", required: true, placeholder: "e.g. IT hardware" },
          { key: "terms", label: "Terms", type: "select", options: ["Net 30", "Net 60", "Annual", "Monthly", "On delivery"] },
        ]} />}
      />
      <ModuleTabs moduleKey="procurement" />
      <SectionTitle hint={`${vendors.length} vendors`}>Vendor master</SectionTitle>
      <Table head={<><Th>Vendor</Th><Th>Category</Th><Th>Terms</Th><Th right>Spend to date</Th></>}>
        {vendors.map((v) => (
          <tr key={v.id}>
            <Td strong>{v.name}</Td>
            <Td>{v.category}</Td>
            <Td><Badge tone="neutral">{v.terms}</Badge></Td>
            <Td right>{fmtMoney(spendByVendor(v.name))}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
