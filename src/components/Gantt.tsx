"use client";

import { Task, personById, STATUS_TONE } from "@/lib/tasks";
import { moduleByKey } from "@/lib/modules";
import { Badge } from "@/components/ui";

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

const BAR_TONE: Record<string, string> = {
  pos: "var(--pos)",
  warn: "var(--warn)",
  neg: "var(--neg)",
  beta: "var(--info)",
  neutral: "var(--text-faint)",
};

export default function Gantt({ tasks, showModule = true }: { tasks: Task[]; showModule?: boolean }) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        No scheduled tasks.
      </p>
    );
  }

  const starts = tasks.map((t) => new Date(t.start).getTime());
  const ends = tasks.map((t) => new Date(t.end).getTime());
  const min = new Date(Math.min(...starts));
  const max = new Date(Math.max(...ends));
  // pad a few days each side
  min.setDate(min.getDate() - 2);
  max.setDate(max.getDate() + 2);
  const totalDays = Math.max(1, daysBetween(min, max));

  // month gridlines
  const months: { label: string; leftPct: number }[] = [];
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cursor <= max) {
    months.push({
      label: cursor.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      leftPct: (daysBetween(min, cursor) / totalDays) * 100,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const now = new Date();
  const todayPct = now >= min && now <= max ? (daysBetween(min, now) / totalDays) * 100 : null;

  const LABEL_W = 260;

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <div style={{ minWidth: 720 }}>
        {/* header */}
        <div className="flex" style={{ background: "var(--surface-2)" }}>
          <div className="shrink-0 px-4 py-2 text-xs uppercase tracking-wide" style={{ width: LABEL_W, color: "var(--text-faint)" }}>
            Task / owner
          </div>
          <div className="relative flex-1 h-8">
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 h-full flex items-center text-[11px] pl-1 border-l"
                style={{ left: `${m.leftPct}%`, color: "var(--text-faint)", borderColor: "var(--border)" }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* rows */}
        <div className="relative">
          {tasks.map((t) => {
            const s = new Date(t.start);
            const e = new Date(t.end);
            const leftPct = (daysBetween(min, s) / totalDays) * 100;
            const widthPct = Math.max(1.5, (Math.max(1, daysBetween(s, e)) / totalDays) * 100);
            const tone = BAR_TONE[STATUS_TONE[t.status]] ?? "var(--info)";
            const person = personById(t.assigneeId);
            const mod = moduleByKey(t.module);
            return (
              <div key={t.id} className="flex items-center border-t" style={{ borderColor: "var(--border)" }}>
                <div className="shrink-0 px-4 py-2.5" style={{ width: LABEL_W }}>
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{t.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold text-white shrink-0"
                      style={{ background: "var(--brand-2)" }}
                    >
                      {person?.initials}
                    </span>
                    <span className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                      {person?.name}{showModule && mod ? ` · ${mod.name}` : ""}
                    </span>
                  </div>
                </div>
                <div className="relative flex-1 h-12">
                  {/* month gridlines */}
                  {months.map((m, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l" style={{ left: `${m.leftPct}%`, borderColor: "var(--border)", opacity: 0.5 }} />
                  ))}
                  {todayPct !== null && (
                    <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${todayPct}%`, borderLeft: "1.5px dashed var(--accent)" }} />
                  )}
                  {/* bar */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md overflow-hidden flex items-center"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: "color-mix(in srgb, " + tone + " 22%, transparent)", border: `1px solid ${tone}` }}
                    title={`${t.title} · ${t.start} → ${t.end} · ${Math.round(t.progress * 100)}%`}
                  >
                    <div className="h-full" style={{ width: `${t.progress * 100}%`, background: tone }} />
                    <span className="absolute right-1.5 text-[10px] font-semibold tabular" style={{ color: "var(--text)" }}>
                      {Math.round(t.progress * 100)}%
                    </span>
                  </div>
                </div>
                <div className="shrink-0 pr-4 pl-2">
                  <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
