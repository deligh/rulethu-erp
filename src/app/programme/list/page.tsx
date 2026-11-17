"use client";

import { useState } from "react";
import { useAppData } from "@/lib/store";
import { PEOPLE, TASK_STATUSES, STATUS_LABEL, PRIORITIES, TaskStatus, Priority } from "@/lib/tasks";
import { moduleByKey, MODULES } from "@/lib/modules";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import TaskDrawer from "@/components/TaskDrawer";
import Avatar from "@/components/Avatar";
import { fmtDate } from "@/lib/format";

const WORK_MODULES = MODULES.filter((m) => !["dashboard", "comms", "programme"].includes(m.key));

export default function TaskListPage() {
  const { tasks, patch } = useAppData();
  const [openId, setOpenId] = useState<string | null>(null);
  const [fModule, setFModule] = useState("all");
  const [fAssignee, setFAssignee] = useState("all");

  const rows = tasks
    .filter((t) => (fModule === "all" || t.module === fModule) && (fAssignee === "all" || t.assigneeId === fAssignee))
    .sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime());

  const sel = "rounded-md border px-2 py-1 text-xs";
  const selStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  return (
    <div>
      <PageHeader title="Project Management" subtitle="Every task in one editable list — change status, priority, assignee and dates inline." />
      <ModuleTabs moduleKey="programme" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={fModule} onChange={(e) => setFModule(e.target.value)} className="rounded-md border px-2 py-1.5 text-xs" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <option value="all">All projects</option>
          {WORK_MODULES.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
        </select>
        <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className="rounded-md border px-2 py-1.5 text-xs" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <option value="all">All assignees</option>
          {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{rows.length} tasks</span>
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
        <table className="rz-table w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {["Task", "Project", "Assignee", "Priority", "Status", "Due", "Progress"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const mod = moduleByKey(t.module);
              return (
                <tr key={t.id}>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => setOpenId(t.id)} className="font-medium text-left hover:underline" style={{ color: "var(--text)" }}>{t.title}</button>
                    <div className="text-[11px] font-mono" style={{ color: "var(--text-faint)" }}>{t.id}</div>
                  </td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>{mod?.name}</td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={PEOPLE.find((p) => p.id === t.assigneeId)?.name ?? "?"} size={22} />
                      <select value={t.assigneeId} onChange={(e) => patch("tasks", t.id, { assigneeId: e.target.value })} className={sel} style={selStyle}>
                        {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <select value={t.priority} onChange={(e) => patch("tasks", t.id, { priority: e.target.value as Priority })} className={sel} style={selStyle}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <select
                      value={t.status}
                      onChange={(e) => patch("tasks", t.id, { status: e.target.value as TaskStatus, progress: e.target.value === "Done" ? 1 : t.progress })}
                      className={sel}
                      style={selStyle}
                    >
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>{fmtDate(t.end)}</td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2 w-28">
                      <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--surface-2)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.round(t.progress * 100)}%`, background: "var(--brand)" }} />
                      </div>
                      <span className="text-[11px] tabular" style={{ color: "var(--text-faint)" }}>{Math.round(t.progress * 100)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
