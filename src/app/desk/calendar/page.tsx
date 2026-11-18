"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useDesk, todayISO, fmtDate, uid, isOverdue, type DeskEvent } from "@/lib/desk/store";
import { Card, Btn, PageHead, Modal, Field, inputCls, inputStyle, Pill } from "@/components/desk/ui";
import BriefModal from "@/components/desk/BriefModal";

const KINDS: DeskEvent["kind"][] = ["Meeting", "Cabinet", "Travel", "Event", "Personal"];
const KIND_COLOR: Record<string, string> = { Meeting: "#0b6e4f", Cabinet: "#6d2e46", Travel: "#1c7293", Event: "#c9a227", Personal: "#8590a2" };

function ics(evs: DeskEvent[]) {
  const z = (d: string, t: string) => d.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
  const body = evs.map((e) => ["BEGIN:VEVENT", `UID:${e.id}@ministers-desk`, `DTSTART:${z(e.date, e.start)}`, `DTEND:${z(e.date, e.end || e.start)}`, `SUMMARY:${e.title.replace(/[,;]/g, " ")}`, e.location ? `LOCATION:${e.location.replace(/[,;]/g, " ")}` : "", "END:VEVENT"].filter(Boolean).join("\r\n")).join("\r\n");
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ministers Desk//EN\r\n${body}\r\nEND:VCALENDAR`], { type: "text/calendar" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ministers-desk.ics"; a.click();
}

export default function CalendarPage() {
  const d = useDesk();
  const t = todayISO();
  const [cursor, setCursor] = useState(() => { const x = new Date(); return new Date(x.getFullYear(), x.getMonth(), 1); });
  const [day, setDay] = useState(t);
  const [edit, setEdit] = useState<DeskEvent | null>(null);
  const [brief, setBrief] = useState<DeskEvent | null>(null);

  const cells = useMemo(() => {
    const first = new Date(cursor); const startDow = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(first); start.setDate(1 - startDow);
    return Array.from({ length: 42 }, (_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); x.setHours(12); return x.toISOString().slice(0, 10); });
  }, [cursor]);
  const byDate = useMemo(() => { const m = new Map<string, DeskEvent[]>(); for (const e of d.events) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date)!.push(e); } for (const v of m.values()) v.sort((a, b) => a.start.localeCompare(b.start)); return m; }, [d.events]);
  const dueByDate = useMemo(() => { const m = new Map<string, number>(); for (const c of d.commitments) if (c.status !== "Done") m.set(c.due, (m.get(c.due) ?? 0) + 1); return m; }, [d.commitments]);
  const dayEvents = byDate.get(day) ?? [];
  const dayDue = d.commitments.filter((c) => c.due === day && c.status !== "Done");
  const month = cursor.getMonth();

  return (
    <div>
      <PageHead kicker="Schedule" title="Calendar" right={<>
        <Btn kind="ghost" onClick={() => ics(d.events.filter((e) => e.date >= t))}>Add to phone calendar (.ics)</Btn>
        <Btn onClick={() => setEdit({ id: uid("E"), title: "", date: day, start: "09:00", end: "10:00", kind: "Meeting" })}>+ New engagement</Btn>
      </>} />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), month - 1, 1))} className="px-3 py-1 rounded-md border text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}>‹</button>
            <div className="font-bold" style={{ color: "var(--text)" }}>{cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), month + 1, 1))} className="px-3 py-1 rounded-md border text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}>›</button>
          </div>
          <div className="grid grid-cols-7 text-[11px] text-center mb-1" style={{ color: "var(--text-faint)" }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => <div key={x}>{x}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c) => {
              const evs = byDate.get(c) ?? [];
              const inMonth = new Date(c).getMonth() === month;
              const sel = c === day, isT = c === t;
              return (
                <button key={c} onClick={() => setDay(c)} className="rounded-lg p-1 md:p-1.5 min-h-[52px] md:min-h-[78px] text-left align-top border transition" style={{ borderColor: sel ? "var(--brand)" : "transparent", background: sel ? "var(--sidebar-active-bg)" : inMonth ? "var(--surface-2, #f7f8f9)" : "transparent", opacity: inMonth ? 1 : 0.45 }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold inline-flex items-center justify-center rounded-full h-5 w-5" style={{ background: isT ? "var(--brand)" : "transparent", color: isT ? "#fff" : "var(--text)" }}>{new Date(c).getDate()}</span>
                    {(dueByDate.get(c) ?? 0) > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: c < t ? "var(--neg)" : "var(--accent)" }} title="Commitment due" />}
                  </div>
                  <div className="hidden md:block space-y-0.5 mt-1">
                    {evs.slice(0, 2).map((e) => <div key={e.id} className="text-[10px] truncate rounded px-1 text-white" style={{ background: KIND_COLOR[e.kind] }}>{e.start} {e.title}</div>)}
                    {evs.length > 2 && <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>+{evs.length - 2} more</div>}
                  </div>
                  <div className="md:hidden flex gap-0.5 mt-1">{evs.slice(0, 3).map((e) => <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[e.kind] }} />)}</div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold mb-3" style={{ color: "var(--text)" }}>{fmtDate(day, { weekday: "long", day: "numeric", month: "long" })}</h2>
          <div className="space-y-2.5">
            {dayEvents.map((e) => (
              <div key={e.id} className="rounded-lg p-3 border-l-4" style={{ background: "var(--surface-2, #f4f5f7)", borderColor: KIND_COLOR[e.kind] }}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold cursor-pointer" style={{ color: "var(--text)" }} onClick={() => setEdit(e)}>{e.title}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{e.start}–{e.end}{e.location ? ` · ${e.location}` : ""}</div>
                    {e.with && <div className="text-xs" style={{ color: "var(--text-faint)" }}>With {e.with}</div>}
                  </div>
                  <span className="text-[10px] font-bold uppercase" style={{ color: KIND_COLOR[e.kind] }}>{e.kind}</span>
                </div>
                {(e.kind === "Meeting" || e.kind === "Cabinet") && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setBrief(e)} className="text-xs font-semibold rounded-md px-2 py-1" style={{ background: "var(--brand)", color: "#fff" }}>Brief me</button>
                    <Link href={`/desk/meetings?event=${e.id}`} className="text-xs font-semibold rounded-md px-2 py-1 border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{e.meetingId ? "View minutes" : "● Record"}</Link>
                  </div>
                )}
              </div>
            ))}
            {dayEvents.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No engagements.</p>}
          </div>
          {dayDue.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Commitments due</div>
              {dayDue.map((c) => <div key={c.id} className="text-sm flex gap-2 items-center py-1"><Pill v={isOverdue(c) ? "Overdue" : c.status} /><span style={{ color: "var(--text)" }}>{c.title}</span></div>)}
            </div>
          )}
        </Card>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit && d.events.some((e) => e.id === edit.id) ? "Edit engagement" : "New engagement"}>
        {edit && (() => {
          const e = edit; const u = <K extends keyof DeskEvent>(k: K, v: DeskEvent[K]) => setEdit({ ...e, [k]: v });
          return (
            <div className="space-y-3">
              <Field label="Title"><input className={inputCls} style={inputStyle} value={e.title} onChange={(x) => u("title", x.target.value)} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={e.date} onChange={(x) => u("date", x.target.value)} /></Field>
                <Field label="Start"><input type="time" className={inputCls} style={inputStyle} value={e.start} onChange={(x) => u("start", x.target.value)} /></Field>
                <Field label="End"><input type="time" className={inputCls} style={inputStyle} value={e.end} onChange={(x) => u("end", x.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type"><select className={inputCls} style={inputStyle} value={e.kind} onChange={(x) => u("kind", x.target.value as DeskEvent["kind"])}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></Field>
                <Field label="Location"><input className={inputCls} style={inputStyle} value={e.location ?? ""} onChange={(x) => u("location", x.target.value)} /></Field>
              </div>
              <Field label="With (counterpart)"><input className={inputCls} style={inputStyle} value={e.with ?? ""} onChange={(x) => u("with", x.target.value)} placeholder="e.g. EU Ambassador, ZESA management" /></Field>
              <Field label="Notes"><textarea rows={2} className={inputCls} style={inputStyle} value={e.notes ?? ""} onChange={(x) => u("notes", x.target.value)} /></Field>
              <div className="flex justify-between">{d.events.some((x) => x.id === e.id) ? <Btn kind="danger" onClick={() => { d.remove("events", e.id); setEdit(null); }}>Delete</Btn> : <span />}<Btn onClick={() => { if (e.title.trim()) d.upsert("events", e); setDay(e.date); setEdit(null); }}>Save</Btn></div>
            </div>
          );
        })()}
      </Modal>
      <BriefModal ev={brief} onClose={() => setBrief(null)} />
    </div>
  );
}
