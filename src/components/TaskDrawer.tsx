"use client";

import { useAppData, genId, CURRENT_USER } from "@/lib/store";
import { PEOPLE, TASK_STATUSES, STATUS_LABEL, PRIORITIES, PRIORITY_TONE, STATUS_TONE, ChecklistItem, TaskComment } from "@/lib/tasks";
import { moduleByKey } from "@/lib/modules";
import { Badge } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { useState } from "react";

export default function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { tasks, patch } = useAppData();
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const t = tasks.find((x) => x.id === taskId);
  if (!taskId || !t) return null;

  const mod = moduleByKey(t.module);
  const checklist = t.checklist ?? [];
  const comments = t.comments ?? [];
  const doneCount = checklist.filter((c) => c.done).length;

  const up = (p: Partial<typeof t>) => patch("tasks", t.id, p);

  const addItem = () => {
    if (!newItem.trim()) return;
    up({ checklist: [...checklist, { id: genId("c"), text: newItem.trim(), done: false }] });
    setNewItem("");
  };
  const toggleItem = (id: string) =>
    up({ checklist: checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  const delItem = (id: string) => up({ checklist: checklist.filter((c) => c.id !== id) });
  const addComment = () => {
    if (!newComment.trim()) return;
    const c: TaskComment = { id: genId("m"), author: CURRENT_USER, text: newComment.trim(), at: new Date().toISOString() };
    up({ comments: [...comments, c] });
    setNewComment("");
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };
  const propSelect = "w-full rounded-md border px-2 py-1.5 text-sm";

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(9,30,66,0.35)" }} onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[520px] overflow-y-auto shadow-2xl" style={{ background: "var(--surface)" }}>
        <div className="sticky top-0 flex items-center justify-between border-b px-5 py-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>{t.id}</span>
            {mod && <Badge tone="neutral">{mod.name}</Badge>}
          </div>
          <button onClick={onClose} className="text-lg" style={{ color: "var(--text-faint)" }} aria-label="Close">✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <input
            value={t.title}
            onChange={(e) => up({ title: e.target.value })}
            className="w-full text-lg font-semibold bg-transparent outline-none"
            style={{ color: "var(--text)" }}
          />

          {/* Properties */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Status</span>
              <select value={t.status} onChange={(e) => up({ status: e.target.value as typeof t.status, progress: e.target.value === "Done" ? 1 : t.progress })} className={`${propSelect} mt-1`} style={inputStyle}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Priority</span>
              <select value={t.priority} onChange={(e) => up({ priority: e.target.value as typeof t.priority })} className={`${propSelect} mt-1`} style={inputStyle}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Assignee</span>
              <select value={t.assigneeId} onChange={(e) => up({ assigneeId: e.target.value })} className={`${propSelect} mt-1`} style={inputStyle}>
                {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Progress ({Math.round(t.progress * 100)}%)</span>
              <input type="range" min={0} max={100} value={Math.round(t.progress * 100)} onChange={(e) => up({ progress: Number(e.target.value) / 100 })} className="mt-3 w-full" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Start</span>
              <input type="date" value={t.start} onChange={(e) => up({ start: e.target.value })} className={`${propSelect} mt-1`} style={inputStyle} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Due</span>
              <input type="date" value={t.end} onChange={(e) => up({ end: e.target.value })} className={`${propSelect} mt-1`} style={inputStyle} />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
            <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
          </div>

          {/* Description */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Description</span>
            <textarea
              value={t.description ?? ""}
              onChange={(e) => up({ description: e.target.value })}
              rows={3}
              placeholder="Add a description…"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Checklist</span>
              {checklist.length > 0 && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{doneCount}/{checklist.length}</span>}
            </div>
            {checklist.length > 0 && (
              <div className="h-1.5 rounded-full mb-2" style={{ background: "var(--surface-2)" }}>
                <div className="h-1.5 rounded-full" style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%`, background: "var(--pos)" }} />
              </div>
            )}
            <div className="space-y-1">
              {checklist.map((c: ChecklistItem) => (
                <div key={c.id} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={c.done} onChange={() => toggleItem(c.id)} />
                  <span className="flex-1 text-sm" style={{ color: c.done ? "var(--text-faint)" : "var(--text)", textDecoration: c.done ? "line-through" : "none" }}>{c.text}</span>
                  <button onClick={() => delItem(c.id)} className="opacity-0 group-hover:opacity-100 text-xs" style={{ color: "var(--text-faint)" }}>✕</button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} placeholder="Add a sub-task…" className="flex-1 rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
              <button onClick={addItem} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Add</button>
            </div>
          </div>

          {/* Comments */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Comments</span>
            <div className="mt-2 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar name={c.author} size={26} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.author}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{new Date(c.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Avatar name={CURRENT_USER} size={26} />
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} placeholder="Write a comment…" className="flex-1 rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
              <button onClick={addComment} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Send</button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
