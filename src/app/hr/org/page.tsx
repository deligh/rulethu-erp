"use client";

import { useAppData } from "@/lib/store";
import { Employee } from "@/lib/seed";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import Avatar from "@/components/Avatar";

function OrgNode({ emp, all }: { emp: Employee; all: Employee[] }) {
  const reports = all.filter((e) => e.managerId === emp.id);
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-lg border px-4 py-3 text-center min-w-[170px]" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex justify-center mb-1"><Avatar name={emp.name} size={34} /></div>
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{emp.name}</div>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{emp.role}</div>
        <div className="mt-1"><Badge tone="neutral">{emp.department}</Badge></div>
      </div>
      {reports.length > 0 && (
        <>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <div className="flex gap-6 items-start pt-0 relative">
            {reports.map((r) => (
              <div key={r.id} className="flex flex-col items-center">
                <OrgNode emp={r} all={all} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { employees } = useAppData();
  const roots = employees.filter((e) => !e.managerId || !employees.some((m) => m.id === e.managerId));
  const depts = Array.from(new Set(employees.map((e) => e.department)));

  return (
    <div>
      <PageHeader title="HR · Org Chart" subtitle="The reporting structure across the group, built from each person's manager." actions={<Badge tone="live">{employees.length} people · {depts.length} departments</Badge>} />
      <ModuleTabs moduleKey="hr" />
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-10 min-w-max justify-center pt-2">
          {roots.map((r) => <OrgNode key={r.id} emp={r} all={employees} />)}
        </div>
      </div>
    </div>
  );
}
