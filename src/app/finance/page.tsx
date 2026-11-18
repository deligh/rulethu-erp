import { STATEMENTS } from "@/lib/seed";
import Link from "next/link";
import { PageHeader, Card, StatCard, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleProgress from "@/components/ModuleProgress";
import ModuleTabs from "@/components/ModuleTabs";
import { fmtMoney } from "@/lib/format";

const TONE: Record<string, "pos" | "warn" | "neg"> = {
  Reconciled: "pos",
  "In progress": "warn",
  Unreconciled: "neg",
};

export default function FinancePage() {
  const totalUnmatched = STATEMENTS.reduce((s, x) => s + x.unreconciled, 0);
  const usdBalance = STATEMENTS.filter((s) => s.currency === "USD").reduce((s, x) => s + x.closingBalance, 0);
  const reconciledPct =
    STATEMENTS.reduce((s, x) => s + x.reconciled, 0) /
    STATEMENTS.reduce((s, x) => s + x.reconciled + x.unreconciled, 0);

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Statements, ledgers and bank reconciliation for the finance team — the books that other modules post into."
        actions={
          <Link href="/finance/trial-balance" className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>
            Trial Balance → Statements
          </Link>
        }
      />

      <ModuleTabs moduleKey="finance" />

      {/* Primary workflow — capture daily, statements build themselves */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Link href="/finance/capture" className="rz-card rounded-lg border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="text-2xl mb-1">💵</div>
          <h3 className="font-semibold" style={{ color: "var(--text)" }}>Daily Capture</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Record money in / out in plain language — the system does the double-entry. No accountant needed.</p>
        </Link>
        <Link href="/finance/statements" className="rz-card rounded-lg border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="text-2xl mb-1">📊</div>
          <h3 className="font-semibold" style={{ color: "var(--text)" }}>Financial Statements</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Weekly, monthly and annual P&amp;L, balance sheet, cash flow and ratios — always balanced, export to Excel &amp; PDF.</p>
        </Link>
        <Link href="/finance/general-ledger" className="rz-card rounded-lg border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="text-2xl mb-1">📒</div>
          <h3 className="font-semibold" style={{ color: "var(--text)" }}>General Ledger</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Every posting in one place — the single source of truth the statements are built from.</p>
        </Link>
      </div>

      <ModuleProgress module="finance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Cash (USD accounts)" value={fmtMoney(usdBalance)} hint="closing balances" />
        <StatCard label="Statements loaded" value={String(STATEMENTS.length)} hint="Aug 2026" />
        <StatCard label="Auto-reconciled" value={`${Math.round(reconciledPct * 100)}%`} delta={{ value: "matched", positive: true }} />
        <StatCard label="Exceptions" value={String(totalUnmatched)} delta={{ value: "to review", positive: false }} />
      </div>

      <SectionTitle hint="upload a bank statement to match against the ledger">Accounts & reconciliation</SectionTitle>
      <Table
        head={
          <>
            <Th>Account</Th>
            <Th>Bank</Th>
            <Th>Period</Th>
            <Th right>Closing balance</Th>
            <Th right>Matched</Th>
            <Th right>Exceptions</Th>
            <Th>Status</Th>
          </>
        }
      >
        {STATEMENTS.map((s) => (
          <tr key={s.id}>
            <Td strong>{s.account}</Td>
            <Td>{s.bank}</Td>
            <Td>{s.period}</Td>
            <Td right>{fmtMoney(s.closingBalance, s.currency)}</Td>
            <Td right>{s.reconciled}</Td>
            <Td right>
              {s.unreconciled > 0 ? <span style={{ color: "var(--neg)" }}>{s.unreconciled}</span> : "0"}
            </Td>
            <Td><Badge tone={TONE[s.status]}>{s.status}</Badge></Td>
          </tr>
        ))}
      </Table>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Statement intake</h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Drop bank statements (PDF/CSV/MT940). The system parses lines and auto-matches to the ledger, flagging
            only the exceptions for a human to clear.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Links from other modules</h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Procurement POs, Microfinance disbursements and HR payroll runs post journals straight into these
            ledgers — no re-keying.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Management reporting</h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Trial balance, P&amp;L and balance sheet generated from the same ledger the board and auditors rely on.
          </p>
        </Card>
      </div>
    </div>
  );
}
