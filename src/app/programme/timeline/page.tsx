"use client";

import { useAppData } from "@/lib/store";
import { PEOPLE, moduleProgress, STATUS_TONE, STATUS_LABEL } from "@/lib/tasks";
import { MODULES } from "@/lib/modules";
import Gantt from "@/components/Gantt";
import ModuleTabs from "@/components/ModuleTabs";
import { PageHeader, Card, SectionTitle, Badge } from "@/components/ui";
import { fmtDate, fmtPct } from "@/lib/format";

function ProgressRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full text-xs font-semibold shrink-0"
      style={{ color: "var(--text)", background: `conic-gradient(var(--brand) ${pct * 3.6}deg, var(--surface-2) 0deg)` }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full tabular" style={{ background: "var(--surface)" }}>{pct}%</span>
    </div>
  );
}

export default function TimelinePage() {
  const { tasks } = useAppData();
  const workModules = MODULES.filter((m) => m.key !== "dashboard").map((m) => ({ module: m, progress: moduleProgress(tasks, m.key) })).filter((x) => x.progress.total > 0);
  const sorted = [...tasks].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <div>
      <PageHeader title="Project Management" subtitle="Timeline and workload — the Gantt across every project, plus who is carrying what." />
      <ModuleTabs moduleKey="programme" />

      <SectionTitle hint="progress on each project">Project progress</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {workModules.map(({ module, progress }) => (
          <Card key={module.key} className="flex items-center gap-4">
            <ProgressRing value={progress.avgProgress} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold" style={{ color: "var(--text)" }}>{module.name}</div>
              <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                {progress.done}/{progress.total} done
                {progress.overdue > 0 && <span style={{ color: "var(--neg)" }}> · {progress.overdue} overdue</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle hint="dashed line = today">Gantt timeline</SectionTitle>
      <div className="mb-8"><Gantt tasks={sorted} /></div>

      <SectionTitle hint="bosses included">Workload by person</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        {PEOPLE.map((p) => {
          const mine = tasks.filter((t) => t.assigneeId === p.id);
          if (mine.length === 0) return null;
          const avg = mine.reduce((s, t) => s + t.progress, 0) / mine.length;
          return (
            <Card key={p.id}>
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: "var(--brand-2)" }}>{p.initials}</span>
                <div className="flex-1">
                  <div className="font-semibold" style={{ color: "var(--text)" }}>{p.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{p.role}</div>
                </div>
                <span className="text-sm font-medium tabular" style={{ color: "var(--text-muted)" }}>{fmtPct(avg, 0)}</span>
              </div>
              <div className="space-y-2">
                {mine.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate" style={{ color: "var(--text)" }}>{t.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{fmtDate(t.end)}</span>
                      <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
