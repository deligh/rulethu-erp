"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { buildCalendarEvents, EVENT_TONE, EventType, CalEvent } from "@/lib/calendar";
import { PageHeader, Card, StatCard, Badge, SectionTitle } from "@/components/ui";
import { fmtDate } from "@/lib/format";

const TONE_BG: Record<CalEvent["tone"], string> = {
  pos: "var(--lz-green-bg)", neg: "var(--lz-red-bg)", warn: "var(--lz-yellow-bg)", beta: "var(--lz-blue-bg)", neutral: "var(--lz-neutral-bg)",
};
const TONE_FG: Record<CalEvent["tone"], string> = {
  pos: "var(--lz-green-fg)", neg: "var(--lz-red-fg)", warn: "var(--lz-yellow-fg)", beta: "var(--lz-blue-fg)", neutral: "var(--lz-neutral-fg)",
};
const TYPES: EventType[] = ["Personal", "TB maturity", "Coupon", "Task", "Leave", "Payment", "Goal", "Payroll"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function CalendarPage() {
  const { tbills, tasks, leave, pos, goals, personalEvents, add } = useAppData();
  const { user } = useAuth();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [active, setActive] = useState<Set<EventType>>(new Set(TYPES));
  const [selected, setSelected] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState(iso(now));

  const allEvents = useMemo(() => buildCalendarEvents({ tbills, tasks, leave, pos, goals, personalEvents }), [tbills, tasks, leave, pos, goals, personalEvents]);
  const events = allEvents
    .filter((e) => active.has(e.type))
    .filter((e) => !mineOnly || (user && e.owner === user.name));

  const addEvent = () => {
    if (!evTitle.trim() || !user) return;
    add("personalEvents", { id: genId("PE"), owner: user.name, title: evTitle.trim(), date: evDate, createdAt: new Date().toISOString() }, { title: "Added to your calendar", body: `${evTitle.trim()} · ${evDate}`, module: "calendar" });
    setEvTitle("");
  };

  const byDate = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of events) (m[e.date] = m[e.date] || []).push(e);
    return m;
  }, [events]);

  const todayIso = iso(now);
  const firstWeekday = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(cursor.y, cursor.m, d)));
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const toggle = (t: EventType) => setActive((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const monthCount = events.filter((e) => e.date.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`)).length;
  const next7 = events.filter((e) => e.date >= todayIso && e.date <= iso(new Date(now.getTime() + 7 * 86400000))).length;
  const agenda = events.filter((e) => e.date >= todayIso).slice(0, 12);

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Everything due across the group in one place — maturities, coupons, tasks, leave, payments, goals and payroll."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} className="rounded-md border px-2.5 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>←</button>
            <button onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Today</button>
            <button onClick={() => move(1)} className="rounded-md border px-2.5 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>→</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="This month" value={String(monthCount)} hint="events" />
        <StatCard label="Next 7 days" value={String(next7)} />
        <StatCard label="Upcoming TB maturities" value={String(allEvents.filter((e) => e.type === "TB maturity" && e.date >= todayIso).length)} />
        <StatCard label="Tasks due" value={String(allEvents.filter((e) => e.type === "Task" && e.date >= todayIso).length)} />
      </div>

      {/* Add to my calendar */}
      <Card className="mb-4 !p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Add to my calendar</label>
            <input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addEvent(); }} placeholder="e.g. Board pack due, client call…" className="w-full rounded-md border px-2.5 py-1.5 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
          <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className="rounded-md border px-2.5 py-1.5 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
          <button onClick={addEvent} disabled={!evTitle.trim()} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Add</button>
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>Your personal events show only to you. Tip: ask the <b>Talk to Rulethu</b> chatbot “add … to my calendar” and it does it for you.</p>
      </Card>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setMineOnly((m) => !m)} className="rounded-full px-2.5 py-1 text-xs font-semibold border" style={{ background: mineOnly ? "var(--brand)" : "transparent", color: mineOnly ? "#fff" : "var(--text-muted)", borderColor: "var(--border)" }}>
          {mineOnly ? "✓ " : ""}Mine only
        </button>
        <span className="w-px h-5" style={{ background: "var(--border)" }} />
        {TYPES.map((t) => (
          <button key={t} onClick={() => toggle(t)} className="rounded-full px-2.5 py-1 text-xs font-medium border" style={{ background: active.has(t) ? TONE_BG[EVENT_TONE[t]] : "transparent", color: active.has(t) ? TONE_FG[EVENT_TONE[t]] : "var(--text-faint)", borderColor: "var(--border)" }}>{t}</button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <span className="font-semibold" style={{ color: "var(--text)" }}>{monthLabel}</span>
          </div>
          <div className="grid grid-cols-7">
            {DOW.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] font-semibold uppercase text-center" style={{ color: "var(--text-faint)", background: "var(--surface-2)" }}>{d}</div>)}
            {cells.map((date, i) => {
              const evs = date ? (byDate[date] ?? []) : [];
              const isToday = date === todayIso;
              const isSel = date === selected;
              return (
                <div
                  key={i}
                  onClick={() => date && setSelected(date)}
                  className={`min-h-[92px] p-1.5 border-t border-r ${date ? "cursor-pointer" : ""}`}
                  style={{ borderColor: "var(--border)", outline: isSel ? "2px solid var(--brand)" : "none", outlineOffset: "-2px", background: date ? (isToday ? "color-mix(in srgb, var(--brand) 6%, var(--surface))" : "var(--surface)") : "var(--surface-2)" }}
                >
                  {date && (
                    <>
                      <div className="text-[11px] mb-1 flex justify-end">
                        <span className={isToday ? "flex h-5 w-5 items-center justify-center rounded-full text-white" : ""} style={isToday ? { background: "var(--brand)" } : { color: "var(--text-faint)" }}>{Number(date.slice(-2))}</span>
                      </div>
                      <div className="space-y-0.5">
                        {evs.slice(0, 3).map((e) => (
                          <Link key={e.id} href={e.href} onClick={(ev) => ev.stopPropagation()} title={e.title} className="block truncate rounded px-1 py-0.5 text-[10px]" style={{ background: TONE_BG[e.tone], color: TONE_FG[e.tone] }}>{e.title}</Link>
                        ))}
                        {evs.length > 3 && <div className="text-[10px] px-1" style={{ color: "var(--text-faint)" }}>+{evs.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div>
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle hint={`${(byDate[selected] ?? []).length} events`}>{fmtDate(selected)}</SectionTitle>
                <button onClick={() => setSelected(null)} className="text-xs font-medium" style={{ color: "var(--brand)" }}>Show agenda</button>
              </div>
              <div className="space-y-2">
                {(byDate[selected] ?? []).length === 0 && <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing due on this day.</span></Card>}
                {(byDate[selected] ?? []).map((e) => (
                  <Link key={e.id} href={e.href}>
                    <Card className="flex items-center gap-3 hover:shadow-md transition-shadow !p-3">
                      <span className="h-8 w-1 rounded-full shrink-0" style={{ background: TONE_FG[e.tone] }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm" style={{ color: "var(--text)" }}>{e.title}</div>
                        <div className="mt-0.5"><Badge tone={e.tone}>{e.type}</Badge></div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <SectionTitle hint="from today · click a day for its events">Agenda</SectionTitle>
              <div className="space-y-2">
                {agenda.length === 0 && <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing coming up.</span></Card>}
                {agenda.map((e) => (
                  <Link key={e.id} href={e.href}>
                    <Card className="flex items-start gap-3 hover:shadow-md transition-shadow !p-3">
                      <div className="text-center shrink-0 w-10">
                        <div className="text-[10px] uppercase" style={{ color: "var(--text-faint)" }}>{new Date(e.date).toLocaleDateString("en-GB", { month: "short" })}</div>
                        <div className="text-lg font-semibold leading-none" style={{ color: "var(--text)" }}>{Number(e.date.slice(-2))}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm" style={{ color: "var(--text)" }}>{e.title}</div>
                        <div className="mt-0.5"><Badge tone={e.tone}>{e.type}</Badge> <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{fmtDate(e.date)}</span></div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
