"use client";

import { useState } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { askClaude } from "@/lib/aiClient";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

interface Action { owner: string; task: string; due?: string }
interface Minutes { title: string; summary: string; keyPoints: string[]; decisions: string[]; actions: Action[] }

const todayPlus = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export default function MeetingNotesPage() {
  const { employees, add, addMessage, channels } = useAppData();
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [min, setMin] = useState<Minutes | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  const generate = async () => {
    if (!notes.trim()) return;
    setBusy(true); setMin(null); setCreated(null);
    const team = employees.map((e) => `${e.name} (${e.department})`).join(", ");
    const text = await askClaude({
      system:
        "You are Rulethu AI's meeting assistant at an African investment group in Harare. Turn rough meeting notes into clean minutes. " +
        "Return ONLY a JSON object (no markdown, no fences): " +
        '{"title": string, "summary": string, "keyPoints": [string], "decisions": [string], "actions": [{"owner": string, "task": string, "due": "yyyy-mm-dd"}]}. ' +
        "Assign each action to the most appropriate person FROM THIS TEAM by their exact name: " + team + ". " +
        "If no clear owner, use the best fit. Keep it concise and specific; infer sensible due dates when none are stated.",
      prompt: `MEETING NOTES:\n${notes.trim()}\n\nProduce the minutes JSON now.`,
      model: "sonnet",
      maxTokens: 2000,
    });
    try {
      let t = (text ?? "").trim();
      const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) t = f[1];
      const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) t = t.slice(a, b + 1);
      const o = JSON.parse(t);
      setMin({
        title: String(o.title ?? "Meeting minutes"),
        summary: String(o.summary ?? ""),
        keyPoints: Array.isArray(o.keyPoints) ? o.keyPoints.map(String) : [],
        decisions: Array.isArray(o.decisions) ? o.decisions.map(String) : [],
        actions: Array.isArray(o.actions) ? o.actions.map((x: Record<string, unknown>) => ({ owner: String(x.owner ?? ""), task: String(x.task ?? ""), due: x.due ? String(x.due) : undefined })).filter((x: Action) => x.task) : [],
      });
    } catch {
      setMin({ title: "Meeting minutes", summary: text ?? "Couldn't parse the minutes — try again.", keyPoints: [], decisions: [], actions: [] });
    }
    setBusy(false);
  };

  const createTasks = () => {
    if (!min) return;
    let n = 0;
    for (const a of min.actions) {
      const emp = employees.find((e) => e.name.toLowerCase() === a.owner.toLowerCase());
      add("tasks", {
        id: genId("T"),
        title: a.task,
        module: "programme",
        assigneeId: emp?.id ?? employees[0]?.id ?? "",
        start: new Date().toISOString().slice(0, 10),
        end: a.due && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : todayPlus(7),
        progress: 0,
        status: "Not started",
        priority: "Medium",
        description: `From meeting: ${min.title}`,
      }, n === 0 ? { title: "Action items created", body: `${min.actions.length} task(s) from "${min.title}"`, module: "programme" } : undefined);
      n++;
    }
    setCreated(`${n} task${n === 1 ? "" : "s"} created and assigned — see Project Management.`);
  };

  const postToComms = () => {
    if (!min) return;
    const ch = channels.find((c) => c.id === "general") ?? channels[0];
    if (!ch) return;
    const text =
      `📝 Minutes — ${min.title}\n\n${min.summary}\n\n` +
      (min.decisions.length ? `Decisions:\n${min.decisions.map((d) => `• ${d}`).join("\n")}\n\n` : "") +
      (min.actions.length ? `Action items:\n${min.actions.map((a) => `• ${a.owner}: ${a.task}${a.due ? ` (by ${a.due})` : ""}`).join("\n")}` : "");
    addMessage(ch.id, "message", text, undefined, user?.name);
    setCreated(`Minutes posted to #${ch.name}.`);
  };

  return (
    <div>
      <PageHeader
        title="Meeting Notes"
        subtitle="Turn rough notes into clean minutes with action items the AI assigns to the right people — then push them to tasks and the group."
        actions={<Badge tone="live">AI</Badge>}
      />
      <ModuleTabs moduleKey="ai" />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card>
          <SectionTitle>1 · Paste your notes</SectionTitle>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={14} placeholder={"Paste rough meeting notes or a transcript here…\n\ne.g. IC met on the Solar IPP. Agreed to proceed to DD. Delight to finalise the valuation model by Friday. Research to pull SADC tariff data. Risk to review the PPA terms."} className="w-full rounded-md border px-3 py-2 text-sm" style={iStyle} />
          <button onClick={generate} disabled={busy || !notes.trim()} className="mt-3 w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>
            {busy ? "Writing minutes…" : "✨ Generate minutes & actions"}
          </button>
        </Card>

        <div>
          <SectionTitle>{min ? "2 · Minutes" : "Minutes"}</SectionTitle>
          {!min && !busy && <Card className="border-dashed"><p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>Your minutes and assigned action items will appear here.</p></Card>}
          {busy && <Card><p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Reading the notes and drafting minutes…</p></Card>}
          {min && (
            <Card className="space-y-4">
              <div>
                <h3 className="font-bold" style={{ color: "var(--text)" }}>{min.title}</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{min.summary}</p>
              </div>
              {min.keyPoints.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Discussion</div>
                  <ul className="space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>{min.keyPoints.map((k, i) => <li key={i}>• {k}</li>)}</ul>
                </div>
              )}
              {min.decisions.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Decisions</div>
                  <ul className="space-y-1 text-sm" style={{ color: "var(--text)" }}>{min.decisions.map((k, i) => <li key={i}>✓ {k}</li>)}</ul>
                </div>
              )}
              {min.actions.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faint)" }}>Action items</div>
                  <ul className="space-y-1.5">
                    {min.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
                        <span className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "var(--brand)" }}>{a.owner.slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0 text-sm">
                          <span style={{ color: "var(--text)" }}>{a.task}</span>
                          <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{a.owner}{a.due ? ` · by ${a.due}` : ""}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {min.actions.length > 0 && <button onClick={createTasks} className="rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Create {min.actions.length} task(s)</button>}
                <button onClick={postToComms} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Post minutes to Comms</button>
                {created && <span className="text-xs self-center" style={{ color: "var(--pos)" }}>{created}</span>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
