"use client";

import Link from "next/link";
import { ModuleKey } from "@/lib/modules";
import { moduleProgress, tasksForModule, personById, STATUS_TONE } from "@/lib/tasks";
import { useAppData } from "@/lib/store";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";

// Compact "summary of progress" strip shown at the top of each module page.
export default function ModuleProgress({ module }: { module: ModuleKey }) {
  const { tasks } = useAppData();
  const p = moduleProgress(tasks, module);
  const list = tasksForModule(tasks, module);
  if (p.total === 0) return null;
  const pct = Math.round(p.avgProgress * 100);
  const next = [...list]
    .filter((t) => t.status !== "Done")
    .sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime())[0];

  return (
    <div
      className="mb-6 rounded-xl border p-4 flex flex-wrap items-center gap-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3 min-w-[180px]">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
          Progress
        </span>
        <span className="text-lg font-semibold tabular" style={{ color: "var(--text)" }}>{pct}%</span>
      </div>

      <div className="flex-1 min-w-[160px]">
        <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
          <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--brand)" }} />
        </div>
        <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          {p.done}/{p.total} tasks done
          {p.overdue > 0 && <span style={{ color: "var(--neg)" }}> · {p.overdue} overdue</span>}
        </div>
      </div>

      {next && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Next:</span>
          <span className="text-sm" style={{ color: "var(--text)" }}>{next.title}</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            ({personById(next.assigneeId)?.initials} · {fmtDate(next.end)})
          </span>
          <Badge tone={STATUS_TONE[next.status]}>{next.status}</Badge>
        </div>
      )}

      <Link href="/programme" className="text-sm font-medium shrink-0" style={{ color: "var(--brand)" }}>
        View Gantt →
      </Link>
    </div>
  );
}
