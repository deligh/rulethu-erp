"use client";

import Link from "next/link";
import { useAppData, genId } from "@/lib/store";
import { Loan } from "@/lib/seed";
import { PageHeader, StatCard, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleProgress from "@/components/ModuleProgress";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";
import { fmtMoney, fmtPct } from "@/lib/format";

const STATUS_TONE: Record<string, "pos" | "warn" | "neg" | "neutral"> = {
  Performing: "pos", Watch: "warn", "PAR>30": "neg", Closed: "neutral",
};

export default function MicrofinancePage() {
  const { loans, add, addEntry } = useAppData();

  const book = loans.reduce((s, l) => s + l.principal, 0);
  const par = loans.filter((l) => l.status === "PAR>30").reduce((s, l) => s + l.principal, 0);
  const avgRate = loans.length ? loans.reduce((s, l) => s + l.ratePct, 0) / loans.length : 0;

  const addLoan = (v: Record<string, string>) => {
    const loan: Loan = {
      id: genId("L"),
      borrower: v.borrower,
      product: v.product,
      principal: parseFloat(v.principal) || 0,
      ratePct: parseFloat(v.ratePct) || 0,
      termMonths: parseInt(v.termMonths) || 12,
      status: "Performing",
      disbursed: new Date().toISOString().slice(0, 10),
    };
    add("loans", loan, { title: "Loan disbursed", body: `${loan.borrower} — ${fmtMoney(loan.principal)}`, module: "microfinance" });
    // Disbursement posts to the Finance ledger automatically.
    addEntry(`MFI disbursement ${loan.id} — ${loan.borrower}`, `Microfinance ${loan.id}`, [
      { accountCode: "1100", debit: loan.principal, credit: 0 },
      { accountCode: "1000", debit: 0, credit: loan.principal },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Microfinance"
        subtitle="Internal MFI loan book — disbursing a loan posts to Finance; model any schedule with the amortization tool."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/microfinance/amortization" className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Amortization tool
            </Link>
            <QuickAdd
              buttonLabel="Disburse loan"
              title="New loan"
              submitLabel="Disburse loan"
              onSubmit={addLoan}
              fields={[
                { key: "borrower", label: "Borrower", required: true },
                { key: "product", label: "Product", type: "select", options: ["SME Working Capital", "Agri Input Loan", "Asset Finance", "Personal"] },
                { key: "principal", label: "Principal (USD)", type: "number", required: true, min: 0, step: 1000 },
                { key: "ratePct", label: "Rate % p.a.", type: "number", required: true, min: 0, step: 0.5, default: 24 },
                { key: "termMonths", label: "Term (months)", type: "number", min: 1, step: 1, default: 12 },
              ]}
            />
          </div>
        }
      />

      <ModuleTabs moduleKey="microfinance" />
      <ModuleProgress module="microfinance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Gross loan book" value={fmtMoney(book)} hint={`${loans.length} active`} />
        <StatCard label="Portfolio at risk" value={fmtMoney(par)} delta={book ? { value: fmtPct(par / book), positive: false } : undefined} hint="PAR>30" />
        <StatCard label="Avg. nominal rate" value={fmtPct(avgRate / 100)} hint="per annum" />
        <StatCard label="Performing" value={loans.length ? fmtPct(loans.filter((l) => l.status === "Performing").length / loans.length) : "—"} hint="by count" />
      </div>

      <SectionTitle hint="click a loan to model its schedule">Loan book</SectionTitle>
      <Table head={<><Th>Loan</Th><Th>Product</Th><Th right>Principal</Th><Th right>Rate</Th><Th right>Term</Th><Th>Status</Th><Th right>Action</Th></>}>
        {loans.map((l) => (
          <tr key={l.id}>
            <Td strong>{l.borrower}<div className="text-xs" style={{ color: "var(--text-faint)" }}>{l.id}</div></Td>
            <Td>{l.product}</Td>
            <Td right>{fmtMoney(l.principal)}</Td>
            <Td right>{fmtPct(l.ratePct / 100)}</Td>
            <Td right>{l.termMonths} mo</Td>
            <Td><Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge></Td>
            <Td right>
              <Link href={`/microfinance/amortization?p=${l.principal}&r=${l.ratePct}&n=${l.termMonths}`} className="text-sm font-medium" style={{ color: "var(--brand)" }}>Schedule →</Link>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
