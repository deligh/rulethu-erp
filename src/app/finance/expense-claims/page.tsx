"use client";

import { useAppData, ClaimStatus } from "@/lib/store";
import { fmtMoney, fmtDate } from "@/lib/format";
import { PageHeader, Card, StatCard, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";

const TONE: Record<ClaimStatus, "pos" | "warn" | "neg" | "beta" | "neutral"> = {
  Submitted: "neutral",
  "Pushed to Finance": "warn",
  Approved: "beta",
  Paid: "pos",
  Declined: "neg",
};

export default function ExpenseClaimsPage() {
  const { claims, setClaimStatus } = useAppData();

  const pending = claims.filter((c) => c.status === "Pushed to Finance");
  const totalPending = pending.reduce((s, c) => s + c.amount, 0);
  const paid = claims.filter((c) => c.status === "Paid").reduce((s, c) => s + c.amount, 0);

  const rows = claims.map((c) => ({
    id: c.id,
    employee: c.employee,
    destination: c.destination,
    km: c.km,
    car: c.carType,
    amount: fmtMoney(c.amount, "USD", 2),
    status: c.status,
    date: c.date,
  }));
  const cols = [
    { key: "id", label: "Claim" },
    { key: "employee", label: "Employee" },
    { key: "destination", label: "Destination" },
    { key: "km", label: "KM" },
    { key: "car", label: "Vehicle" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
    { key: "date", label: "Date" },
  ];

  return (
    <div>
      <PageHeader
        title="Finance · Expense Claims"
        subtitle="Travel and fuel claims pushed from staff. Approve to post the journal automatically; then mark paid."
        actions={<DownloadButtons filename="expense-claims" title="Expense Claims" subtitle="Rulethu Holdings" columns={cols} rows={rows} sheetName="Claims" />}
      />
      <ModuleTabs moduleKey="finance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Awaiting approval" value={String(pending.length)} hint={fmtMoney(totalPending, "USD", 2)} />
        <StatCard label="Total claims" value={String(claims.length)} />
        <StatCard label="Paid" value={fmtMoney(paid, "USD", 2)} />
        <StatCard label="Posted to ledger" value={String(claims.filter((c) => c.status === "Approved" || c.status === "Paid").length)} hint="auto-journalled" />
      </div>

      <div className="space-y-3">
        {claims.length === 0 && (
          <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No claims yet.</span></Card>
        )}
        {claims.map((c) => (
          <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: "var(--text)" }}>{c.destination}</span>
                <Badge tone={TONE[c.status]}>{c.status}</Badge>
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {c.employee} · {c.purpose}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                {c.id} · {c.km} km · {c.carType} @ ${c.ratePerKm.toFixed(2)}/km · {fmtDate(c.date)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(c.amount, "USD", 2)}</span>
              {c.status === "Pushed to Finance" && (
                <div className="flex gap-2">
                  <button onClick={() => setClaimStatus(c.id, "Approved")} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>
                    Approve & post
                  </button>
                  <button onClick={() => setClaimStatus(c.id, "Declined")} className="rounded-lg border px-3 py-1.5 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    Decline
                  </button>
                </div>
              )}
              {c.status === "Approved" && (
                <button onClick={() => setClaimStatus(c.id, "Paid")} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>
                  Mark paid
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
