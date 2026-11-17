"use client";

import { useMemo, useState } from "react";
import { useAppData, genId, PayrollLine, PayrollRun } from "@/lib/store";
import { PageHeader, Card, StatCard, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";
import { fmtMoney } from "@/lib/format";

const PAYE = 0.25; // simplified flat PAYE
const PENSION = 0.05;

export default function PayrollPage() {
  const { employees, payrollRuns, add, addEntry } = useAppData();
  const [period, setPeriod] = useState(new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }));
  const [posted, setPosted] = useState(false);

  const lines: PayrollLine[] = useMemo(() =>
    employees.filter((e) => e.status === "Active").map((e) => {
      const gross = e.salary ?? 0;
      const paye = gross * PAYE;
      const pension = gross * PENSION;
      return { empId: e.id, name: e.name, gross, paye, pension, net: gross - paye - pension };
    }), [employees]);

  const totalGross = lines.reduce((s, l) => s + l.gross, 0);
  const totalPaye = lines.reduce((s, l) => s + l.paye, 0);
  const totalPension = lines.reduce((s, l) => s + l.pension, 0);
  const totalNet = lines.reduce((s, l) => s + l.net, 0);
  const alreadyRun = payrollRuns.some((r) => r.period === period);

  const run = () => {
    if (alreadyRun) return;
    const rec: PayrollRun = { id: genId("PAY"), period, lines, totalGross, totalNet, status: "Posted", createdAt: new Date().toISOString() };
    add("payrollRuns", rec, { title: "Payroll run posted", body: `${period} — net ${fmtMoney(totalNet)} to ${lines.length} staff`, module: "hr" });
    addEntry(`Payroll — ${period}`, `Payroll ${period}`, [
      { accountCode: "5100", debit: totalGross, credit: 0 },
      { accountCode: "1000", debit: 0, credit: totalNet },
      { accountCode: "2000", debit: 0, credit: totalPaye + totalPension },
    ]);
    setPosted(true);
    setTimeout(() => setPosted(false), 3000);
  };

  const cols = [{ key: "name", label: "Employee" }, { key: "gross", label: "Gross" }, { key: "paye", label: "PAYE" }, { key: "pension", label: "Pension" }, { key: "net", label: "Net" }];
  const rows = lines.map((l) => ({ name: l.name, gross: fmtMoney(l.gross), paye: fmtMoney(l.paye), pension: fmtMoney(l.pension), net: fmtMoney(l.net) }));

  return (
    <div>
      <PageHeader
        title="HR · Payroll"
        subtitle="Monthly payroll run — gross, PAYE and pension computed per employee. Posting files the journal into Finance."
        actions={
          <div className="flex items-center gap-2">
            <DownloadButtons filename={`payroll-${period}`} title={`Payroll — ${period}`} subtitle="Rulethu Holdings" columns={cols} rows={rows} sheetName="Payroll" />
            <input value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm w-28" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }} />
            <button onClick={run} disabled={alreadyRun} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--brand)" }}>{alreadyRun ? "Already run" : "Run & post"}</button>
          </div>
        }
      />
      <ModuleTabs moduleKey="hr" />
      {posted && <div className="mb-4"><Badge tone="pos">Payroll posted to Finance ledger</Badge></div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Gross payroll" value={fmtMoney(totalGross)} hint={`${lines.length} staff`} />
        <StatCard label="PAYE" value={fmtMoney(totalPaye)} hint="25%" />
        <StatCard label="Pension" value={fmtMoney(totalPension)} hint="5%" />
        <StatCard label="Net pay" value={fmtMoney(totalNet)} />
      </div>

      <SectionTitle hint={`${period} run`}>Payslips</SectionTitle>
      <Card className="!p-0 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead><tr style={{ background: "var(--surface-2)" }}>{["Employee", "Gross", "PAYE", "Pension", "Net"].map((h, i) => <th key={h} className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wider ${i ? "text-right" : "text-left"}`} style={{ color: "var(--text-faint)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.empId}>
                <td className="px-4 py-2 font-medium" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{l.name}</td>
                <td className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(l.gross)}</td>
                <td className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--neg)" }}>({fmtMoney(l.paye)})</td>
                <td className="px-4 py-2 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--neg)" }}>({fmtMoney(l.pension)})</td>
                <td className="px-4 py-2 text-right tabular font-semibold" style={{ borderTop: "1px solid var(--border)" }}>{fmtMoney(l.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle>Payroll history</SectionTitle>
      {payrollRuns.length === 0 ? (
        <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No payroll runs posted yet.</span></Card>
      ) : (
        <div className="space-y-2">
          {[...payrollRuns].reverse().map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div><span className="font-medium" style={{ color: "var(--text)" }}>{r.period}</span> <span className="text-xs" style={{ color: "var(--text-faint)" }}>· {r.lines.length} staff · <Badge tone="pos">{r.status}</Badge></span></div>
              <span className="tabular font-medium" style={{ color: "var(--text)" }}>net {fmtMoney(r.totalNet)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
