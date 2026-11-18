"use client";

import { useState } from "react";
import { useAppData, genId } from "@/lib/store";
import {
  PEOPLE, personById, TASK_STATUSES, STATUS_LABEL, STATUS_TONE, PRIORITIES, PRIORITY_TONE,
  Task, TaskStatus, Priority,
} from "@/lib/tasks";
import { MODULES, ModuleKey, moduleByKey } from "@/lib/modules";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";
import TaskDrawer from "@/components/TaskDrawer";
import Avatar from "@/components/Avatar";
import { fmtDate } from "@/lib/format";
import { tasksPdf } from "@/lib/docpdf";

type GroupBy = "status" | "assignee" | "priority";
const WORK_MODULES = MODULES.filter((m) => !["dashboard", "comms", "programme"].includes(m.key));

export default function ProjectBoardPage() {
  const { tasks, add, patch } = useAppData();
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [fAssignee, setFAssignee] = useState("all");
  const [fModule, setFModule] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const filtered = tasks.filter(
    (t) => (fAssignee === "all" || t.assigneeId === fAssignee) && (fModule === "all" || t.module === fModule),
  );

  const columns: { key: string; label: string }[] =
    groupBy === "status" ? TASK_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s] }))
      : groupBy === "priority" ? PRIORITIES.map((p) => ({ key: p, label: p }))
        : PEOPLE.map((p) => ({ key: p.id, label: p.name }));

  const valueOf = (t: Task): string => (groupBy === "status" ? t.status : groupBy === "priority" ? t.priority : t.assigneeId);

  const applyDrop = (colKey: string) => {
    if (!dragId) return;
    const t = tasks.find((x) => x.id === dragId);
    if (t) {
      if (groupBy === "status") patch("tasks", t.id, { status: colKey as TaskStatus, progress: colKey === "Done" ? 1 : t.progress });
      else if (groupBy === "priority") patch("tasks", t.id, { priority: colKey as Priority });
      else patch("tasks", t.id, { assigneeId: colKey });
    }
    setDragId(null);
    setDragOver(null);
  };

  const today = new Date().toISOString().slice(0, 10);
  const exportPdf = () => {
    const done = filtered.filter((t) => t.status === "Done").length;
    const overdue = filtered.filter((t) => t.status !== "Done" && t.end < today).length;
    const who = fAssignee === "all" ? "All assignees" : personById(fAssignee)?.name ?? "";
    const scope = fModule === "all" ? "All projects" : moduleByKey(fModule as ModuleKey)?.name ?? fModule;
    const rows = [...filtered]
      .sort((a, b) => a.end.localeCompare(b.end))
      .map((t) => [
        t.title,
        moduleByKey(t.module)?.name ?? t.module,
        personById(t.assigneeId)?.name ?? t.assigneeId,
        STATUS_LABEL[t.status],
        t.priority,
        `${Math.round((t.progress ?? 0) * 100)}%`,
        fmtDate(t.end),
      ]);
    tasksPdf({
      title: "Project Management snapshot",
      subtitle: `${who} · ${scope}`,
      stats: [
        { label: "Tasks", value: String(filtered.length) },
        { label: "Done", value: String(done) },
        { label: "Open", value: String(filtered.length - done) },
        { label: "Overdue", value: String(overdue) },
      ],
      columns: [
        { header: "Task", width: 80 }, { header: "Project", width: 40 }, { header: "Assignee", width: 36 },
        { header: "Status", width: 26 }, { header: "Priority", width: 22 }, { header: "Progress", width: 20 }, { header: "Due" },
      ],
      rows,
      filename: `rulethu-project-snapshot-${today}`,
    });
  };

  const addTask = (v: Record<string, string>) => {
    const mod = WORK_MODULES.find((m) => m.name === v.module);
    const person = PEOPLE.find((p) => p.name === v.assignee);
    const status = (v.status as TaskStatus) || "Not started";
    const task: Task = {
      id: genId("T"),
      title: v.title,
      module: (mod?.key ?? "investments") as ModuleKey,
      assigneeId: person?.id ?? PEOPLE[0].id,
      start: today,
      end: v.due || today,
      progress: status === "Done" ? 1 : 0,
      status,
      priority: (v.priority as Priority) || "Medium",
    };
    add("tasks", task, { title: "Task created", body: `${task.title} → ${person?.name ?? ""}`, module: "programme" });
  };

  return (
    <div>
      <PageHeader
        title="Project Management"
        subtitle="Plan and track work across the whole group — Kanban board, task list, timeline and workload."
        actions={
          <>
          <button onClick={exportPdf} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ Download PDF</button>
          <QuickAdd
            buttonLabel="New task"
            title="Create a task"
            submitLabel="Create"
            onSubmit={addTask}
            fields={[
              { key: "title", label: "Task", required: true, placeholder: "e.g. Draft IC memo" },
              { key: "module", label: "Project / module", type: "select", options: WORK_MODULES.map((m) => m.name), required: true },
              { key: "assignee", label: "Assignee", type: "select", options: PEOPLE.map((p) => p.name), required: true },
              { key: "priority", label: "Priority", type: "select", options: [...PRIORITIES] },
              { key: "status", label: "Status", type: "select", options: TASK_STATUSES.map((s) => s) },
              { key: "due", label: "Due date", type: "date" },
            ]}
          />
          </>
        }
      />

      <ModuleTabs moduleKey="programme" />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
          {(["status", "assignee", "priority"] as GroupBy[]).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)} className="rounded-md px-2.5 py-1 text-xs font-medium capitalize"
              style={{ background: groupBy === g ? "var(--brand)" : "transparent", color: groupBy === g ? "#fff" : "var(--text-muted)" }}>
              {g}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Group by</span>
        <div className="ml-auto flex items-center gap-2">
          <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className="rounded-md border px-2 py-1.5 text-xs" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <option value="all">All assignees</option>
            {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={fModule} onChange={(e) => setFModule(e.target.value)} className="rounded-md border px-2 py-1.5 text-xs" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <option value="all">All projects</option>
            {WORK_MODULES.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {columns.map((col) => {
            const items = filtered.filter((t) => valueOf(t) === col.key);
            const isOver = dragOver === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver((o) => (o === col.key ? null : o))}
                onDrop={() => applyDrop(col.key)}
                className="w-72 shrink-0 rounded-lg p-2"
                style={{ background: isOver ? "color-mix(in srgb, var(--brand) 8%, var(--surface-2))" : "var(--surface-2)", outline: isOver ? "2px dashed var(--brand)" : "none" }}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    {groupBy === "status" && <span className="h-2 w-2 rounded-full" style={{ background: `var(--${STATUS_TONE[col.key as TaskStatus] === "pos" ? "pos" : STATUS_TONE[col.key as TaskStatus] === "neg" ? "neg" : STATUS_TONE[col.key as TaskStatus] === "warn" ? "warn" : STATUS_TONE[col.key as TaskStatus] === "beta" ? "info" : "text-faint"})` }} />}
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{col.label}</span>
                  </div>
                  <span className="text-xs rounded px-1.5" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>{items.length}</span>
                </div>

                <div className="space-y-2 min-h-[40px]">
                  {items.map((t) => {
                    const person = personById(t.assigneeId);
                    const mod = moduleByKey(t.module);
                    const checks = t.checklist ?? [];
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onClick={() => setOpenId(t.id)}
                        className="rounded-lg border p-3 cursor-pointer transition-shadow hover:shadow-md"
                        style={{ background: "var(--surface)", borderColor: "var(--border)", opacity: dragId === t.id ? 0.5 : 1 }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                          {mod && <span className="text-[10px] rounded px-1.5 py-0.5" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>{mod.name}</span>}
                        </div>
                        <div className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>{t.title}</div>
                        <div className="h-1.5 rounded-full mb-2" style={{ background: "var(--surface-2)" }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.round(t.progress * 100)}%`, background: "var(--brand)" }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                            <span>{fmtDate(t.end)}</span>
                            {checks.length > 0 && <span>✓ {checks.filter((c) => c.done).length}/{checks.length}</span>}
                            {(t.comments?.length ?? 0) > 0 && <span>💬 {t.comments!.length}</span>}
                          </div>
                          {person && <Avatar name={person.name} size={22} />}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <div className="rounded-lg border border-dashed p-3 text-[11px] text-center" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
