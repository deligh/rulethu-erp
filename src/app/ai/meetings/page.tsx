"use client";

import { useEffect, useRef, useState } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { askClaude } from "@/lib/aiClient";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { minutesPdf } from "@/lib/docpdf";
import { uploadFile } from "@/lib/files";

interface Action { owner: string; task: string; due?: string }
interface Minutes { title: string; summary: string; keyPoints: string[]; decisions: string[]; actions: Action[] }

const todayPlus = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const TODAY = new Date().toISOString().slice(0, 10);

// Minimal typing for the browser Web Speech API (Chrome/Edge), used for live,
// on-device transcription — no server, no added API cost.
interface SRAlt { transcript: string }
interface SRResult { 0: SRAlt; isFinal: boolean }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SpeechRec {
  continuous: boolean; interimResults: boolean; lang: string;
  start: () => void; stop: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
function getRecognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// Robustly pull the LAST complete, parseable top-level JSON object from a
// model reply — handles fenced code, preambles, and "Correction: ... here is
// the final JSON" repetitions where several {...} blocks appear.
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const candidates: string[] = [];
  let depth = 0, start = -1;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { candidates.push(t.slice(start, i + 1)); start = -1; } }
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(candidates[i]); if (o && typeof o === "object") return o as Record<string, unknown>; } catch { /* try next */ }
  }
  return null;
}

export default function MeetingNotesPage() {
  const { employees, add, addMessage, channels } = useAppData();
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [min, setMin] = useState<Minutes | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  // --- Live recording / transcription (Web Speech API) ---
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState("");
  const [recErr, setRecErr] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRec | null>(null);
  const recordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(!!getRecognition());
    return () => { recordingRef.current = false; recRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startRec = () => {
    const rec = getRecognition();
    if (!rec) { setSupported(false); return; }
    setRecErr(null);
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-GB";
    rec.onresult = (e) => {
      let finals = "", live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += r[0].transcript + " "; else live += r[0].transcript;
      }
      if (finals) setNotes((prev) => (prev ? prev.replace(/\s*$/, " ") : "") + finals);
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { setRecErr("Microphone blocked. Allow mic access in the browser and try again."); stopRec(); }
      else if (e.error === "no-speech") { /* keep listening */ }
    };
    rec.onend = () => { if (recordingRef.current) { try { rec.start(); } catch { /* restarting */ } } };
    try { rec.start(); } catch { /* already started */ }
    recRef.current = rec; recordingRef.current = true; setRecording(true); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopRec = () => {
    recordingRef.current = false; setRecording(false); setInterim("");
    recRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const saveToLibrary = async () => {
    if (!min) return;
    const body =
      `${min.title}\n${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}` +
      `${user?.name ? ` · prepared by ${user.name}` : ""}\n\n` +
      `SUMMARY\n${min.summary}\n\n` +
      (min.keyPoints.length ? `DISCUSSION\n${min.keyPoints.map((k) => `- ${k}`).join("\n")}\n\n` : "") +
      (min.decisions.length ? `DECISIONS\n${min.decisions.map((d) => `- ${d}`).join("\n")}\n\n` : "") +
      (min.actions.length ? `ACTION ITEMS\n${min.actions.map((a) => `- ${a.owner}: ${a.task}${a.due ? ` (by ${a.due})` : ""}`).join("\n")}\n` : "");
    const fname = `${min.title.replace(/[^\w]+/g, "-").slice(0, 50) || "minutes"}-${TODAY}.txt`;
    const file = new File([body], fname, { type: "text/plain" });
    const { ok, path, error } = await uploadFile(file, "Meeting Minutes");
    if (ok && path) {
      add("knowledge", {
        id: genId("K"), name: fname, path, folder: "Meeting Minutes", type: "text/plain",
        size: file.size, description: `Meeting minutes — ${min.title}`, excerpt: body.slice(0, 6000),
        readable: true, uploadedBy: user?.name ?? "Someone", createdAt: new Date().toISOString(),
      }, { title: "Minutes saved to Library", body: min.title, module: "files" });
      setCreated("Minutes saved to the File Library (Meeting Minutes) — the AI can now read them.");
    } else {
      setCreated(error && /bucket|not found/i.test(error) ? "Set up the File Library first (open File Library to run the one-time setup)." : `Couldn't save: ${error ?? "error"}`);
    }
  };

  const generate = async () => {
    if (!notes.trim()) return;
    setBusy(true); setMin(null); setCreated(null);
    const team = employees.map((e) => `${e.name} (${e.department})`).join(", ");
    const text = await askClaude({
      system:
        "You are Rulethu AI's meeting assistant at an African investment group in Harare. Turn rough meeting notes into clean minutes. " +
        `Today's date is ${TODAY}; any due dates you infer must be in the future relative to today. ` +
        "Respond with a SINGLE JSON object and ABSOLUTELY NOTHING ELSE: no markdown, no code fences, no preamble, no commentary, no 'Correction', and never repeat the JSON. " +
        'Shape exactly: {"title": string, "summary": string, "keyPoints": [string], "decisions": [string], "actions": [{"owner": string, "task": string, "due": "yyyy-mm-dd"}]}. ' +
        "For each action, set owner to the EXACT name (no role or bracket) of the most appropriate person from this team: " + team + ". " +
        "If no clear owner, pick the best fit. Keep it concise and specific.",
      prompt: `MEETING NOTES:\n${notes.trim()}\n\nReturn the minutes JSON now — the JSON object only.`,
      model: "sonnet",
      maxTokens: 2000,
    });
    const o = extractJson(text ?? "");
    if (o) {
      const names = employees.map((e) => e.name);
      const normalizeOwner = (raw: string): string => {
        const bare = raw.replace(/\s*\(.*?\)\s*/g, "").trim();            // strip "(Investments)" etc.
        const hit = names.find((n) => n.toLowerCase() === bare.toLowerCase())
          ?? names.find((n) => bare && (n.toLowerCase().includes(bare.toLowerCase()) || bare.toLowerCase().includes(n.toLowerCase())));
        return hit ?? bare;
      };
      setMin({
        title: String(o.title ?? "Meeting minutes"),
        summary: String(o.summary ?? ""),
        keyPoints: Array.isArray(o.keyPoints) ? o.keyPoints.map(String) : [],
        decisions: Array.isArray(o.decisions) ? o.decisions.map(String) : [],
        actions: Array.isArray(o.actions)
          ? o.actions.map((x: Record<string, unknown>) => ({ owner: normalizeOwner(String(x.owner ?? "")), task: String(x.task ?? ""), due: x.due ? String(x.due) : undefined })).filter((x: Action) => x.task)
          : [],
      });
    } else {
      setMin({ title: "Couldn't read that", summary: "The AI didn't return clean minutes. Try again, or shorten the notes a little.", keyPoints: [], decisions: [], actions: [] });
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
        subtitle="Record a meeting live, or paste rough notes — Rulethu writes the minutes, assigns action items to the right people, and saves everything to one source of truth."
        actions={<Badge tone="live">AI</Badge>}
      />
      <ModuleTabs moduleKey="ai" />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card>
          <SectionTitle hint={recording ? "recording…" : supported ? "record live or paste" : undefined}>1 · Capture the meeting</SectionTitle>

          {/* Recorder */}
          <div className="mb-3 rounded-md border p-3" style={{ borderColor: recording ? "var(--neg)" : "var(--border)", background: "var(--surface-2)" }}>
            {supported ? (
              <div className="flex items-center gap-3 flex-wrap">
                {!recording ? (
                  <button onClick={startRec} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--neg)" }}>
                    <span className="h-2.5 w-2.5 rounded-full bg-white" /> Record meeting
                  </button>
                ) : (
                  <button onClick={stopRec} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--text)" }}>
                    <span className="h-2.5 w-2.5 bg-white" /> Stop
                  </button>
                )}
                {recording && (
                  <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--neg)" }}>
                    <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "var(--neg)" }} />
                    Listening · {mmss(elapsed)}
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {recording ? "Transcribing into the notes below…" : "Live transcription · Chrome/Edge · uses your mic"}
                </span>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Live recording needs Chrome or Edge. You can still paste or type notes below.</p>
            )}
            {interim && <p className="mt-2 text-xs italic" style={{ color: "var(--text-faint)" }}>…{interim}</p>}
            {recErr && <p className="mt-2 text-xs" style={{ color: "var(--neg)" }}>{recErr}</p>}
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={11} placeholder={"Press Record to transcribe the meeting live, or paste/type rough notes here…\n\ne.g. IC met on the Solar IPP. Agreed to proceed to DD. Delight to finalise the valuation model by Friday."} className="w-full rounded-md border px-3 py-2 text-sm" style={iStyle} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button onClick={() => { setNotes(""); setInterim(""); }} disabled={!notes || recording} className="text-xs font-medium disabled:opacity-40" style={{ color: "var(--text-faint)" }}>Clear</button>
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{notes.trim() ? `${notes.trim().split(/\s+/).length} words` : ""}</span>
          </div>
          <button onClick={generate} disabled={busy || !notes.trim() || recording} className="mt-2 w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>
            {busy ? "Writing minutes…" : recording ? "Stop recording to generate" : "✨ Generate minutes & actions"}
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
                <button onClick={() => minutesPdf(min, user?.name)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ Download PDF</button>
                <button onClick={saveToLibrary} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Save to Library</button>
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
