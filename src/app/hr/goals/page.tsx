"use client";

import { useState } from "react";
import { useAppData, genId, CURRENT_USER, Goal } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader, Card, StatCard, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";
import Avatar from "@/components/Avatar";
import { fmtDate } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);
const isOverdue = (g: Goal) => g.status !== "Done" && g.targetDate < today();
const isDue = (g: Goal) => g.status !== "Done" && g.targetDate <= today();
const daysLeft = (g: Goal) => Math.round((new Date(g.targetDate).getTime() - Date.now()) / 86_400_000);

export default function GoalsPage() {
  const { goals, add, patch } = useAppData();
  const { user } = useAuth();
  const me = user?.name ?? CURRENT_USER;
  const [reviseFor, setReviseFor] = useState<string | null>(null);
  const [reviseDate, setReviseDate] = useState("");

  const mine = goals.filter((g) => g.owner === me);
  const completed = mine.filter((g) => g.status === "Done");
  const overdue = mine.filter(isOverdue);
  const slipped = mine.filter((g) => g.revisions > 0);
  const hitRate = mine.length ? Math.round((completed.length / mine.length) * 100) : 0;

  const addGoal = (v: Record<string, string>) => {
    const g: Goal = { id: genId("G"), owner: me, title: v.title, category: (v.category as Goal["category"]) || "Book", detail: v.detail, targetDate: v.targetDate, status: "In progress", revisions: 0, createdAt: new Date().toISOString() };
    add("goals", g, { title: "Development goal set", body: `${v.title} by ${v.targetDate}`, module: "hr" });
  };
  const finish = (g: Goal) => patch("goals", g.id, { status: "Done", completedDate: today() }, { title: "Goal completed 🎉", body: g.title, module: "hr" });
  const revise = (g: Goal) => {
    if (!reviseDate) return;
    patch("goals", g.id, { targetDate: reviseDate, revisedDate: reviseDate, revisions: g.revisions + 1 }, { title: "Goal date revised", body: `${g.title} → ${reviseDate}`, module: "hr" });
    setReviseFor(null); setReviseDate("");
  };

  return (
    <div>
      <PageHeader
        title="HR · Development"
        subtitle="Set what you're reading or learning and by when. When the date arrives we ask if you finished — and it evaluates how well you keep your commitments."
        actions={
          <QuickAdd buttonLabel="Set a goal" title="Set a development goal" submitLabel="Set goal" onSubmit={addGoal} columns={2} fields={[
            { key: "title", label: "What (book / course / skill)", required: true, placeholder: "e.g. The Intelligent Investor" },
            { key: "category", label: "Type", type: "select", options: ["Book", "Course", "Skill", "Certification", "Other"] },
            { key: "detail", label: "Why it matters to you", placeholder: "what you like / hope to gain" },
            { key: "targetDate", label: "Finish by", type: "date", required: true },
          ]} />
        }
      />
      <ModuleTabs moduleKey="hr" />

      {/* Self evaluation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Goals set" value={String(mine.length)} />
        <StatCard label="Completed" value={String(completed.length)} hint={`${hitRate}% hit-rate`} />
        <StatCard label="Overdue" value={String(overdue.length)} delta={overdue.length ? { value: "behind", positive: false } : undefined} />
        <StatCard label="Pushed out" value={String(slipped.length)} hint="dates revised" />
      </div>

      {mine.length > 0 && (
        <Card className="mb-6" >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Self-evaluation:</span>
            <span className="text-sm" style={{ color: overdue.length === 0 ? "var(--pos)" : "var(--warn)" }}>
              {overdue.length === 0 && completed.length === mine.length ? "On top of everything you set — excellent." : overdue.length > 0 ? `You have ${overdue.length} goal${overdue.length > 1 ? "s" : ""} past their date — set a realistic new date or finish them.` : `${completed.length}/${mine.length} done, the rest still on track.`}
            </span>
          </div>
        </Card>
      )}

      <SectionTitle hint="your commitments">My development goals</SectionTitle>
      <div className="space-y-3 mb-8">
        {mine.length === 0 && <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No goals yet — set what you want to read or learn.</span></Card>}
        {mine.map((g) => {
          const due = isDue(g);
          const over = isOverdue(g);
          return (
            <Card key={g.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{g.title}</span>
                    <Badge tone="neutral">{g.category}</Badge>
                    {g.status === "Done" ? <Badge tone="pos">Done</Badge> : over ? <Badge tone="neg">Overdue</Badge> : <Badge tone="beta">In progress</Badge>}
                    {g.revisions > 0 && <Badge tone="warn">pushed ×{g.revisions}</Badge>}
                  </div>
                  {g.detail && <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{g.detail}</p>}
                  <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                    Target {fmtDate(g.targetDate)}{g.status === "Done" && g.completedDate ? ` · completed ${fmtDate(g.completedDate)}` : g.status !== "Done" ? ` · ${daysLeft(g) >= 0 ? `${daysLeft(g)} days left` : `${-daysLeft(g)} days over`}` : ""}
                  </div>
                </div>
                {g.status !== "Done" && (
                  <div className="shrink-0">
                    {due ? (
                      reviseFor === g.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>New date:</span>
                          <input type="date" value={reviseDate} onChange={(e) => setReviseDate(e.target.value)} className="rounded-md border px-2 py-1 text-xs" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }} />
                          <button onClick={() => revise(g)} className="rounded-md px-2.5 py-1 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Save</button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Finished &ldquo;{g.title}&rdquo;?</div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => finish(g)} className="rounded-md px-3 py-1 text-xs font-medium text-white" style={{ background: "var(--pos)" }}>Yes ✓</button>
                            <button onClick={() => { setReviseFor(g.id); setReviseDate(""); }} className="rounded-md border px-3 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>No, revise</button>
                          </div>
                        </div>
                      )
                    ) : (
                      <button onClick={() => finish(g)} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Mark done</button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <SectionTitle hint="visible to leadership">Team overview</SectionTitle>
      <Table head={<><Th>Person</Th><Th>Goal</Th><Th>Type</Th><Th>Target</Th><Th>Status</Th></>}>
        {goals.map((g) => (
          <tr key={g.id}>
            <Td><div className="flex items-center gap-2"><Avatar name={g.owner} size={22} />{g.owner}</div></Td>
            <Td strong>{g.title}</Td>
            <Td>{g.category}</Td>
            <Td>{fmtDate(g.targetDate)}</Td>
            <Td>{g.status === "Done" ? <Badge tone="pos">Done</Badge> : isOverdue(g) ? <Badge tone="neg">Overdue</Badge> : <Badge tone="beta">In progress</Badge>}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
