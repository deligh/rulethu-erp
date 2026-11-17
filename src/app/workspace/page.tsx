"use client";

import { useMemo, useState } from "react";
import { useAppData, genId } from "@/lib/store";
import type { WorkProjectStatus } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { askClaude } from "@/lib/aiClient";
import { ChangePasswordCard } from "@/components/AccountSecurity";

const STATUSES: WorkProjectStatus[] = ["Active", "On hold", "Done"];
const statusTone = (s: WorkProjectStatus) => (s === "Active" ? "pos" : s === "On hold" ? "warn" : "neutral") as "pos" | "warn" | "neutral";

function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}

export default function WorkspacePage() {
  const { workspaceProjects, workLogs, reminders, add, patch, remove } = useAppData();
  const { user } = useAuth();
  const me = user?.name ?? "Delight";
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  // Only this person's items.
  const myProjects = useMemo(() => workspaceProjects.filter((p) => p.owner === me), [workspaceProjects, me]);
  const myLogs = useMemo(() => [...workLogs.filter((l) => l.owner === me)].sort((a, b) => b.date.localeCompare(a.date)), [workLogs, me]);
  const myReminders = useMemo(() => [...reminders.filter((r) => r.owner === me)].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [reminders, me]);

  // --- forms ---
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const addProject = () => {
    if (!pTitle.trim()) return;
    add("workspaceProjects", { id: genId("WP"), owner: me, title: pTitle.trim(), description: pDesc.trim() || undefined, status: "Active", createdAt: new Date().toISOString() });
    setPTitle(""); setPDesc("");
  };

  const [logText, setLogText] = useState("");
  const [logPeriod, setLogPeriod] = useState<"daily" | "weekly">("daily");
  const addLog = () => {
    if (!logText.trim()) return;
    add("workLogs", { id: genId("WL"), owner: me, period: logPeriod, date: new Date().toISOString().slice(0, 10), text: logText.trim(), createdAt: new Date().toISOString() }, { title: logPeriod === "daily" ? "Daily log saved" : "Weekly log saved", body: logText.trim().slice(0, 60), module: "workspace" });
    setLogText("");
  };

  const [rText, setRText] = useState("");
  const [rDue, setRDue] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const addReminder = () => {
    if (!rText.trim()) return;
    add("reminders", { id: genId("RM"), owner: me, text: rText.trim(), dueDate: rDue, done: false, createdAt: new Date().toISOString() }, { title: "Reminder set", body: `${rText.trim()} · ${rDue}`, module: "workspace" });
    setRText("");
  };

  // --- private AI assistant ---
  const [aiQ, setAiQ] = useState("");
  const [aiA, setAiA] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const askMyAI = async () => {
    const q = aiQ.trim();
    if (!q) return;
    setAiBusy(true); setAiA(null);
    const ctx = {
      projects: myProjects.map((p) => ({ title: p.title, description: p.description, status: p.status })),
      logs: myLogs.slice(0, 8).map((l) => ({ period: l.period, date: l.date, text: l.text })),
      reminders: myReminders.filter((r) => !r.done).map((r) => ({ text: r.text, due: r.dueDate })),
    };
    const text = await askClaude({
      system: `You are ${me}'s private work assistant inside the Rulethu Holdings ERP (an African investment group in Harare). You can see ONLY ${me}'s private workspace — their projects, recent log entries and open reminders. Help them plan, prioritise, draft and think. Be concise and practical. Use **bold** for key points. This is private to ${me}.`,
      prompt: `MY WORKSPACE (JSON):\n${JSON.stringify(ctx)}\n\n${me} asks: ${q}`,
      model: "haiku",
      maxTokens: 800,
    });
    setAiA(text ?? "I couldn't reach the AI just now. Your workspace is saved — try again in a moment.");
    setAiBusy(false);
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="page-enter">
      <PageHeader
        title="My Workspace"
        subtitle={`Private to you, ${me}. Your projects, your log of what you're working on, reminders, and an AI assistant that sees only your work.`}
        actions={<Badge tone="purple">Private</Badge>}
      />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Projects */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>My projects</h3>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="New project…" className="flex-1 rounded-md border px-3 py-2 text-sm" style={iStyle} />
              <input value={pDesc} onChange={(e) => setPDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} placeholder="Short note (optional)" className="flex-1 rounded-md border px-3 py-2 text-sm" style={iStyle} />
              <button onClick={addProject} className="rounded-md px-4 py-2 text-sm font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Add</button>
            </div>
            {myProjects.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>No projects yet — add what you&apos;re working on.</p>
            ) : (
              <ul className="space-y-2">
                {myProjects.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{p.title}</span>
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                      </div>
                      {p.description && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.description}</div>}
                    </div>
                    <select value={p.status} onChange={(e) => patch("workspaceProjects", p.id, { status: e.target.value as WorkProjectStatus })} className="rounded-md border px-2 py-1 text-xs" style={iStyle}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => remove("workspaceProjects", p.id)} className="text-xs" style={{ color: "var(--text-faint)" }} title="Delete">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Work log */}
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>What I&apos;m working on</h3>
            <div className="flex gap-2 mb-2">
              <select value={logPeriod} onChange={(e) => setLogPeriod(e.target.value as "daily" | "weekly")} className="rounded-md border px-2 py-2 text-sm" style={iStyle}>
                <option value="daily">Today</option>
                <option value="weekly">This week</option>
              </select>
              <input value={logText} onChange={(e) => setLogText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addLog(); }} placeholder="e.g. Finishing the Kestrel valuation and the IC paper…" className="flex-1 rounded-md border px-3 py-2 text-sm" style={iStyle} />
              <button onClick={addLog} className="rounded-md px-4 py-2 text-sm font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Log</button>
            </div>
            {myLogs.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>No log entries yet.</p>
            ) : (
              <ul className="space-y-2 mt-2">
                {myLogs.slice(0, 10).map((l) => (
                  <li key={l.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2 text-[11px] mb-0.5" style={{ color: "var(--text-faint)" }}>
                      <Badge tone={l.period === "daily" ? "info" : "purple"}>{l.period === "daily" ? "Daily" : "Weekly"}</Badge>
                      <span>{l.date}{l.date === todayIso ? " · today" : ""}</span>
                    </div>
                    <div className="text-sm" style={{ color: "var(--text)" }}>{l.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right column: reminders + AI */}
        <div className="space-y-5">
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>Reminders</h3>
            <div className="flex gap-2 mb-3">
              <input value={rText} onChange={(e) => setRText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addReminder(); }} placeholder="Remind me to…" className="flex-1 rounded-md border px-2.5 py-2 text-sm" style={iStyle} />
            </div>
            <div className="flex gap-2 mb-3">
              <input type="date" value={rDue} onChange={(e) => setRDue(e.target.value)} className="flex-1 rounded-md border px-2.5 py-2 text-sm" style={iStyle} />
              <button onClick={addReminder} className="rounded-md px-4 py-2 text-sm font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Set</button>
            </div>
            {myReminders.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>No reminders.</p>
            ) : (
              <ul className="space-y-1.5">
                {myReminders.map((r) => {
                  const overdue = !r.done && r.dueDate < todayIso;
                  return (
                    <li key={r.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={r.done} onChange={() => patch("reminders", r.id, { done: !r.done })} />
                      <span className="flex-1 text-sm" style={{ color: r.done ? "var(--text-faint)" : "var(--text)", textDecoration: r.done ? "line-through" : "none" }}>{r.text}</span>
                      <span className="text-[11px]" style={{ color: overdue ? "var(--neg)" : "var(--text-faint)" }}>{overdue ? "overdue" : r.dueDate}</span>
                      <button onClick={() => remove("reminders", r.id)} className="text-xs" style={{ color: "var(--text-faint)" }}>✕</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Private AI */}
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>My AI assistant</h3>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-faint)" }}>Private to you — it sees only your projects, log and reminders.</p>
            <div className="flex gap-2 mb-3">
              <input value={aiQ} onChange={(e) => setAiQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askMyAI(); }} placeholder="e.g. What should I prioritise today?" className="flex-1 rounded-md border px-2.5 py-2 text-sm" style={iStyle} />
              <button onClick={askMyAI} disabled={aiBusy} className="rounded-md px-4 py-2 text-sm font-semibold text-white shrink-0 disabled:opacity-50" style={{ background: "var(--brand)" }}>{aiBusy ? "…" : "Ask"}</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["What should I prioritise today?", "Summarise my week", "Draft an update to my manager"].map((s) => (
                <button key={s} onClick={() => { setAiQ(s); }} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>{s}</button>
              ))}
            </div>
            {aiBusy && <div className="text-sm" style={{ color: "var(--text-faint)" }}>Thinking…</div>}
            {aiA && !aiBusy && (
              <div className="rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-line" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-muted)" }}>
                <Bold text={aiA} />
              </div>
            )}
          </div>

          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}
