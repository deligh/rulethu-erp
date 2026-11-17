"use client";

import Link from "next/link";
import { useAppData, genId } from "@/lib/store";
import { Employee, employeeCompleteness } from "@/lib/seed";
import { PageHeader, StatCard, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleProgress from "@/components/ModuleProgress";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";

export default function HrPage() {
  const { employees, leave, claims, add } = useAppData();
  const active = employees.filter((e) => e.status === "Active").length;
  const departments = new Set(employees.map((e) => e.department)).size;
  const pendingLeave = leave.filter((l) => l.status === "Pending").length;
  const pendingClaims = claims.filter((c) => c.status === "Pushed to Finance").length;
  const avgComplete = employees.length ? Math.round((employees.reduce((s, e) => s + employeeCompleteness(e), 0) / employees.length) * 100) : 0;

  const addEmployee = (v: Record<string, string>) => {
    const emp: Employee = {
      id: genId("E"),
      name: v.name,
      role: v.role,
      department: v.department,
      location: v.location || "Harare",
      status: "Active",
    };
    add("employees", emp, { title: "Employee added", body: `${emp.name} — ${emp.role}`, module: "hr" });
  };

  return (
    <div>
      <PageHeader
        title="Human Resources"
        subtitle="Employee records, leave and travel claims — leave and payroll flow through to Finance."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/hr/leave" className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Leave</Link>
            <Link href="/hr/travel" className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Travel</Link>
            <QuickAdd
              buttonLabel="Add employee"
              title="Add an employee"
              submitLabel="Add employee"
              onSubmit={addEmployee}
              fields={[
                { key: "name", label: "Full name", required: true },
                { key: "role", label: "Role", required: true },
                { key: "department", label: "Department", type: "select", options: ["Executive", "Investments", "Research", "Finance", "Operations", "IT"], required: true },
                { key: "location", label: "Location", default: "Harare" },
              ]}
            />
          </div>
        }
      />

      <ModuleTabs moduleKey="hr" />
      <ModuleProgress module="hr" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Headcount" value={String(employees.length)} hint={`${departments} departments`} />
        <StatCard label="Active" value={String(active)} />
        <StatCard label="Leave pending" value={String(pendingLeave)} hint={`${pendingClaims} claims to pay`} />
        <StatCard label="Avg profile complete" value={`${avgComplete}%`} hint="records filled in" />
      </div>

      <SectionTitle hint="click a name to open the full record">Employees</SectionTitle>
      <Table head={<><Th>Name</Th><Th>Role</Th><Th>Department</Th><Th>Manager</Th><Th>Profile</Th><Th>Docs</Th><Th>Status</Th></>}>
        {employees.map((e) => {
          const pct = Math.round(employeeCompleteness(e) * 100);
          return (
          <tr key={e.id}>
            <Td strong>
              <Link href={`/hr/employee/${e.id}`} className="hover:underline" style={{ color: "var(--brand)" }}>{e.name}</Link>
              <div className="text-xs" style={{ color: "var(--text-faint)" }}>{e.email ?? e.id}</div>
            </Td>
            <Td>{e.role}</Td>
            <Td>{e.department}</Td>
            <Td>{employees.find((m) => m.id === e.managerId)?.name ?? "—"}</Td>
            <Td>
              <div className="flex items-center gap-2 w-28">
                <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? "var(--pos)" : pct >= 50 ? "var(--warn)" : "var(--neg)" }} />
                </div>
                <span className="text-[11px] tabular" style={{ color: "var(--text-faint)" }}>{pct}%</span>
              </div>
            </Td>
            <Td>{e.documents?.length ? <Badge tone="beta">{e.documents.length}</Badge> : <span style={{ color: "var(--text-faint)" }}>—</span>}</Td>
            <Td><Badge tone={e.status === "Active" ? "pos" : "warn"}>{e.status}</Badge></Td>
          </tr>
          );
        })}
      </Table>
    </div>
  );
}
