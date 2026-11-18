"use client";

import React, { useMemo, useState } from "react";
import { useDesk, isOverdue, fmtDate, todayISO, uid, addDays, type Commitment, type CStatus, type Priority, type Project } from "@/lib/desk/store";
import { scorecardPdf, shareOrDownload } from "@/lib/desk/pdf";
import { Card, Btn, Pill, PageHead, Modal, Field, inputCls, inputStyle } from "@/components/desk/ui";
import QuickCapture from "@/components/desk/QuickCapture";

const STATUSES: CStatus[] = ["Not started", "In progress", "Blocked", "Done"];

function CommitmentForm({ c, projects, onSave, onDelete }: { c: Commitment; projects: Project[]; onSave: (c: Commitment) => void; onDelete?: () => void }) {
  const [f, setF] = useState(c);
  const u = <K extends keyof Commitment>(k: K, v: Commitment[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="space-y-3">
      <Field label="Commitment"><input className={inputCls} style={inputStyle} value={f.title} onChange={(e) => u("title", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner"><input className={inputCls} style={inputStyle} value={f.owner} onChange={(e) => u("owner", e.target.value)} /></Field>
        <Field label="Due"><input type="date" className={inputCls} style={inputStyle} value={f.due} onChange={(e) => u("due", e.target.value)} /></Field>
        <Field label="Status"><select className={inputCls} style={inputStyle} value={f.status} onChange={(e) => u("status", e.target.value as CStatus)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select className={inputCls} style={inputStyle} value={f.priority} onChange={(e) => u("priority", e.target.value as Priority)}>{["High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Source"><input className={inputCls} style={inputStyle} value={f.source} onChange={(e) => u("source", e.target.value)} placeholder="Cabinet, Speech, Investor…" /></Field>
        <Field label="Project"><select className={inputCls} style={inputStyle} value={f.project ?? ""} onChange={(e) => u("project", e.target.value || undefined)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <Field label="Notes / evidence"><textarea rows={3} className={inputCls} style={inputStyle} value={f.notes ?? ""} onChange={(e) => u("notes", e.target.value)} /></Field>
      <div className="flex justify-between gap-2">
        {onDelete ? <Btn kind="danger" onClick={onDelete}>Delete</Btn> : <span />}
        <Btn onClick={() => onSave({ ...f, doneAt: f.status === "Done" ? f.doneAt ?? todayISO() : undefined })}>Save</Btn>
      </div>
    </div>
  );
}

export default function CommitmentsPage() {
  const d = useDesk();
  const [tab, setTab] = useState<"list" | "board" | "projects" | "score">("list");
  const [filter, setFilter] = useState<"open" | "overdue" | "all" | "done">("open");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Commitment | null>(null);
  const [projEdit, setProjEdit] = useState<Project | null>(null);

  const list = useMemo(() => {
    let x = d.commitments;
    if (filter === "open") x = x.filter((c) => c.status !== "Done");
    if (filter === "overdue") x = x.filter((c) => isOverdue(c));
    if (filter === "done") x = x.filter((c) => c.status === "Done");
    if (q) x = x.filter((c) => (c.title + c.owner + c.source).toLowerCase().includes(q.toLowerCase()));
    return [...x].sort((a, b) => (isOverdue(b) ? 1 : 0) - (isOverdue(a) ? 1 : 0) || a.due.localeCompare(b.due));
  }, [d.commitments, filter, q]);

  const total = d.commitments.length, done = d.commitments.filter((c) => c.status === "Done").length, od = d.commitments.filter((c) => isOverdue(c)).length;
  const onTime = d.commitments.filter((c) => c.status === "Done" && c.doneAt && c.doneAt <= c.due).length;
  const byOwner = useMemo(() => {
    const m = new Map<string, { total: number; done: number; overdue: number }>();
    for (const c of d.commitments) { const r = m.get(c.owner) ?? { total: 0, done: 0, overdue: 0 }; r.total++; if (c.status === "Done") r.done++; if (isOverdue(c)) r.overdue++; m.set(c.owner, r); }
    return [...m.entries()].sort((a, b) => b[1].overdue - a[1].overdue || b[1].total - a[1].total);
  }, [d.commitments]);

  const newC = (): Commitment => ({ id: uid("C"), title: "", owner: "", due: addDays(todayISO(), 7), status: "Not started", priority: "Medium", source: "Instruction", createdAt: todayISO() });

  return (
    <div>
      <PageHead kicker="Delivery" title="Commitments & projects" sub="Every directive, pledge and promise, with an owner and a deadline." right={<>
        <Btn kind="ghost" onClick={async () => shareOrDownload(await scorecardPdf(d.commitments), "Scorecard")}>Scorecard PDF</Btn>
        <Btn onClick={() => setEdit(newC())}>+ New</Btn>
      </>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[["Open", total - done, "var(--text)"], ["Overdue", od, od ? "var(--neg)" : "var(--text)"], ["Done", done, "var(--pos)"], ["Delivered on time", done ? `${Math.round((onTime / done) * 100)}%` : "—", "var(--text)"]].map(([l, v, c]) => (
          <Card key={l as string} className="!p-3.5"><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{l}</div><div className="text-2xl font-bold" style={{ color: c as string }}>{v}</div></Card>
        ))}
      </div>

      <Card className="mb-5"><QuickCapture /></Card>

      <div className="flex gap-1 border-b mb-4 overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {([["list", "List"], ["board", "Board"], ["projects", "Projects"], ["score", "Scorecard"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-3 py-2 text-sm border-b-2 whitespace-nowrap" style={{ borderColor: tab === k ? "var(--brand)" : "transparent", color: tab === k ? "var(--brand)" : "var(--text-muted)", fontWeight: tab === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>

      {tab === "list" && (
        <>
          <div className="flex gap-2 mb-3 flex-wrap">
            {(["open", "overdue", "all", "done"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="text-xs rounded-full border px-3 py-1 capitalize" style={{ borderColor: filter === f ? "var(--brand)" : "var(--border)", color: filter === f ? "var(--brand)" : "var(--text-muted)", background: "var(--surface)" }}>{f}</button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="ml-auto rounded-full border px-3 py-1 text-xs" style={inputStyle} />
          </div>
          <div className="space-y-2">
            {list.map((c) => (
              <Card key={c.id} className="!p-3 cursor-pointer hover:shadow-sm" onClick={() => setEdit(c)}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={c.status === "Done"} onClick={(e) => e.stopPropagation()} onChange={(e) => d.upsert("commitments", { ...c, status: e.target.checked ? "Done" : "In progress", doneAt: e.target.checked ? todayISO() : undefined })} className="mt-1 h-4 w-4" style={{ accentColor: "var(--brand)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "var(--text)", textDecoration: c.status === "Done" ? "line-through" : "none", opacity: c.status === "Done" ? 0.6 : 1 }}>{c.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{c.owner} · {c.source}{c.project ? ` · ${d.projects.find((p) => p.id === c.project)?.name ?? ""}` : ""}{c.notes ? ` · ${c.notes}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <Pill v={isOverdue(c) ? "Overdue" : c.status} />
                    <div className="text-xs tabular-nums" style={{ color: isOverdue(c) ? "var(--neg)" : "var(--text-muted)" }}>{fmtDate(c.due)}</div>
                  </div>
                </div>
              </Card>
            ))}
            {list.length === 0 && <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>Nothing here.</p>}
          </div>
        </>
      )}

      {tab === "board" && (
        <div className="grid gap-3 md:grid-cols-4">
          {STATUSES.map((s) => (
            <div key={s} className="rounded-xl p-2.5 min-h-[200px]" style={{ background: "var(--surface-2, #f4f5f7)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("text"); const c = d.commitments.find((x) => x.id === id); if (c) d.upsert("commitments", { ...c, status: s, doneAt: s === "Done" ? todayISO() : undefined }); }}>
              <div className="text-xs font-bold uppercase tracking-wide px-1 mb-2 flex justify-between" style={{ color: "var(--text-muted)" }}><span>{s}</span><span>{d.commitments.filter((c) => c.status === s).length}</span></div>
              <div className="space-y-2">
                {d.commitments.filter((c) => c.status === s).map((c) => (
                  <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text", c.id)} onClick={() => setEdit(c)} className="rounded-lg border p-2.5 cursor-grab text-sm" style={{ background: "var(--surface)", borderColor: isOverdue(c) ? "var(--neg)" : "var(--border)" }}>
                    <div className="font-medium" style={{ color: "var(--text)" }}>{c.title}</div>
                    <div className="text-[11px] mt-1 flex justify-between" style={{ color: "var(--text-faint)" }}><span>{c.owner}</span><span style={{ color: isOverdue(c) ? "var(--neg)" : undefined }}>{fmtDate(c.due)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "projects" && (
        <div className="space-y-3">
          <div className="flex justify-end"><Btn kind="ghost" onClick={() => setProjEdit({ id: uid("P"), name: "", sector: "", lead: "", start: todayISO(), end: addDays(todayISO(), 180) })}>+ New project</Btn></div>
          {d.projects.map((p) => {
            const cs = d.commitments.filter((c) => c.project === p.id);
            const pd = cs.filter((c) => c.status === "Done").length;
            const span = Math.max(1, (new Date(p.end).getTime() - new Date(p.start).getTime()) / 864e5);
            const elapsed = Math.min(100, Math.max(0, ((Date.now() - new Date(p.start).getTime()) / 864e5 / span) * 100));
            const prog = cs.length ? (pd / cs.length) * 100 : 0;
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs" style={{ color: "var(--accent)" }}>{p.sector}</div>
                    <div className="font-bold cursor-pointer" style={{ color: "var(--text)" }} onClick={() => setProjEdit(p)}>{p.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.lead} · {fmtDate(p.start, { month: "short", year: "numeric" })} → {fmtDate(p.end, { month: "short", year: "numeric" })}</div>
                    {p.description && <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{p.description}</p>}
                  </div>
                  <div className="text-right"><div className="text-2xl font-bold" style={{ color: prog + 10 < elapsed ? "var(--neg)" : "var(--pos)" }}>{Math.round(prog)}%</div><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>delivered · {Math.round(elapsed)}% of time used</div></div>
                </div>
                <div className="mt-3 h-2.5 rounded-full relative overflow-hidden" style={{ background: "var(--surface-2, #eee)" }}>
                  <div className="h-full rounded-full" style={{ width: `${prog}%`, background: "var(--brand)" }} />
                  <div className="absolute top-0 h-full w-0.5" style={{ left: `${elapsed}%`, background: "var(--neg)" }} title="Today" />
                </div>
                <div className="mt-3 space-y-1">
                  {cs.map((c) => <div key={c.id} className="text-xs flex justify-between gap-2" style={{ color: "var(--text-muted)" }}><span>{c.status === "Done" ? "✓" : "○"} {c.title}</span><Pill v={isOverdue(c) ? "Overdue" : c.status} /></div>)}
                  {cs.length === 0 && <div className="text-xs" style={{ color: "var(--text-faint)" }}>No commitments linked yet.</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "score" && (
        <Card>
          <h3 className="font-bold mb-3" style={{ color: "var(--text)" }}>Delivery by owner</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ color: "var(--text-faint)" }}><th className="text-left py-2 font-medium">Owner</th><th className="text-right font-medium">Total</th><th className="text-right font-medium">Done</th><th className="text-right font-medium">Overdue</th><th className="text-left pl-4 font-medium w-1/3">Delivery</th></tr></thead>
              <tbody>
                {byOwner.map(([o, r]) => (
                  <tr key={o} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2" style={{ color: "var(--text)" }}>{o}</td><td className="text-right">{r.total}</td><td className="text-right" style={{ color: "var(--pos)" }}>{r.done}</td><td className="text-right font-bold" style={{ color: r.overdue ? "var(--neg)" : "var(--text-faint)" }}>{r.overdue}</td>
                    <td className="pl-4"><div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2, #eee)" }}><div className="h-full" style={{ width: `${(r.done / r.total) * 100}%`, background: "var(--brand)" }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit && d.commitments.some((c) => c.id === edit.id) ? "Edit commitment" : "New commitment"}>
        {edit && <CommitmentForm c={edit} projects={d.projects} onSave={(c) => { if (c.title.trim()) d.upsert("commitments", c); setEdit(null); }} onDelete={d.commitments.some((c) => c.id === edit.id) ? () => { d.remove("commitments", edit.id); setEdit(null); } : undefined} />}
      </Modal>
      <Modal open={!!projEdit} onClose={() => setProjEdit(null)} title="Project">
        {projEdit && (() => {
          const p = projEdit; const u = (k: keyof Project, v: string) => setProjEdit({ ...p, [k]: v });
          return (
            <div className="space-y-3">
              <Field label="Name"><input className={inputCls} style={inputStyle} value={p.name} onChange={(e) => u("name", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sector"><input className={inputCls} style={inputStyle} value={p.sector} onChange={(e) => u("sector", e.target.value)} /></Field>
                <Field label="Lead"><input className={inputCls} style={inputStyle} value={p.lead} onChange={(e) => u("lead", e.target.value)} /></Field>
                <Field label="Start"><input type="date" className={inputCls} style={inputStyle} value={p.start} onChange={(e) => u("start", e.target.value)} /></Field>
                <Field label="End"><input type="date" className={inputCls} style={inputStyle} value={p.end} onChange={(e) => u("end", e.target.value)} /></Field>
              </div>
              <Field label="Description"><textarea rows={3} className={inputCls} style={inputStyle} value={p.description ?? ""} onChange={(e) => u("description", e.target.value)} /></Field>
              <div className="flex justify-between">{d.projects.some((x) => x.id === p.id) ? <Btn kind="danger" onClick={() => { d.remove("projects", p.id); setProjEdit(null); }}>Delete</Btn> : <span />}<Btn onClick={() => { if (p.name.trim()) d.upsert("projects", p); setProjEdit(null); }}>Save</Btn></div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
