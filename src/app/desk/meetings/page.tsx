"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDesk, uid, todayISO, fmtDate, type Meeting, type ActionItem } from "@/lib/desk/store";
import { minutesFromTranscript } from "@/lib/desk/ai";
import { minutesPdf, shareOrDownload } from "@/lib/desk/pdf";
import { Card, Btn, PageHead, Field, inputCls, inputStyle, AiTag } from "@/components/desk/ui";
import { useTranscriber } from "@/components/desk/useDictation";

const SAMPLE = `Minister opened the meeting and welcomed the lithium investor delegation. The delegation said their sulphate plant in Masvingo is 60 percent complete and needs 40 megawatts of reliable power by June. The Minister said Government is committed to beneficiation and asked about local jobs. They confirmed 900 jobs at full production. It was agreed that ZESA will prioritise a dedicated line for the plant. ZIDA will issue the outstanding import licence for processing equipment by Friday. The delegation will submit a local supplier development plan in two weeks. Permanent Secretary to prepare a Cabinet note on the power arrangement by next week. The Minister closed by thanking the delegation.`;

function fmtTime(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

function Editor({ m, onChange, onSave, onDelete }: { m: Meeting; onChange: (m: Meeting) => void; onSave: () => void; onDelete?: () => void }) {
  const d = useDesk();
  const [busy, setBusy] = useState(false);
  const [pushed, setPushed] = useState(false);
  const setA = (i: number, a: Partial<ActionItem>) => onChange({ ...m, actions: m.actions.map((x, j) => (j === i ? { ...x, ...a } : x)) });
  const gen = async () => {
    setBusy(true);
    const r = await minutesFromTranscript(m.title, m.attendees, m.transcript);
    onChange({ ...m, summary: r.summary, decisions: r.decisions, actions: r.actions, minutesBy: r.live ? "ai" : "offline" });
    setBusy(false);
  };
  const push = () => {
    for (const a of m.actions) d.upsert("commitments", { id: uid("C"), title: a.text, owner: a.owner, due: a.due, status: "Not started", priority: "Medium", source: `Meeting: ${m.title}`, createdAt: todayISO() });
    setPushed(true);
  };
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h3 className="font-bold" style={{ color: "var(--text)" }}>Transcript</h3>
          <Btn onClick={gen} disabled={busy || !m.transcript.trim()}>{busy ? "Writing minutes…" : m.summary ? "Regenerate minutes" : "✦ Turn into minutes"}</Btn>
        </div>
        <textarea rows={8} value={m.transcript} onChange={(e) => onChange({ ...m, transcript: e.target.value })} placeholder="The live transcript appears here. You can also paste or type notes." className={inputCls + " text-sm leading-relaxed"} style={inputStyle} />
      </Card>

      {(m.summary || m.actions.length > 0) && (
        <Card>
          <div className="flex items-center gap-2 mb-3"><h3 className="font-bold" style={{ color: "var(--text)" }}>Minutes</h3><AiTag live={m.minutesBy === "ai"} /></div>
          <Field label="Summary"><textarea rows={4} value={m.summary} onChange={(e) => onChange({ ...m, summary: e.target.value })} className={inputCls + " text-sm"} style={inputStyle} /></Field>
          <div className="mt-4">
            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Decisions</div>
            {m.decisions.map((x, i) => (
              <div key={i} className="flex gap-2 mb-1.5"><input value={x} onChange={(e) => onChange({ ...m, decisions: m.decisions.map((y, j) => (j === i ? e.target.value : y)) })} className={inputCls + " text-sm"} style={inputStyle} /><button onClick={() => onChange({ ...m, decisions: m.decisions.filter((_, j) => j !== i) })} style={{ color: "var(--text-faint)" }}>×</button></div>
            ))}
            <button onClick={() => onChange({ ...m, decisions: [...m.decisions, ""] })} className="text-xs font-semibold" style={{ color: "var(--brand)" }}>+ Add decision</button>
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Action items</div>
            {m.actions.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1fr_140px_auto] gap-2 mb-2">
                <input value={a.text} onChange={(e) => setA(i, { text: e.target.value })} className={inputCls + " text-sm"} style={inputStyle} />
                <button className="md:hidden" onClick={() => onChange({ ...m, actions: m.actions.filter((_, j) => j !== i) })} style={{ color: "var(--text-faint)" }}>×</button>
                <input value={a.owner} onChange={(e) => setA(i, { owner: e.target.value })} placeholder="Owner" className={inputCls + " text-sm"} style={inputStyle} />
                <input type="date" value={a.due} onChange={(e) => setA(i, { due: e.target.value })} className={inputCls + " text-sm"} style={inputStyle} />
                <button className="hidden md:block" onClick={() => onChange({ ...m, actions: m.actions.filter((_, j) => j !== i) })} style={{ color: "var(--text-faint)" }}>×</button>
              </div>
            ))}
            <button onClick={() => onChange({ ...m, actions: [...m.actions, { text: "", owner: "", due: todayISO() }] })} className="text-xs font-semibold" style={{ color: "var(--brand)" }}>+ Add action</button>
          </div>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <Btn onClick={onSave}>Save meeting</Btn>
        {m.actions.length > 0 && <Btn kind="gold" onClick={push} disabled={pushed}>{pushed ? `✓ ${m.actions.length} actions added to Commitments` : `Add ${m.actions.length} actions to Commitments`}</Btn>}
        {(m.summary || m.transcript) && <Btn kind="ghost" onClick={async () => shareOrDownload(await minutesPdf(m), m.title)}>Share minutes (PDF)</Btn>}
        {onDelete && <Btn kind="danger" onClick={onDelete}>Delete</Btn>}
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const d = useDesk();
  const tr = useTranscriber();
  const [cur, setCur] = useState<Meeting | null>(null);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const blank = (eventId?: string): Meeting => {
    const ev = d.events.find((e) => e.id === eventId);
    return { id: uid("M"), title: ev?.title ?? "Meeting", date: ev?.date ?? todayISO(), attendees: ev?.with ?? "", transcript: "", summary: "", decisions: [], actions: [], minutesBy: "", eventId, createdAt: new Date().toISOString() };
  };

  // Deep link: /desk/meetings?event=E2 → open its minutes or start a new one.
  useEffect(() => {
    if (!d.hydrated) return;
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    const ev = d.events.find((e) => e.id === id);
    const existing = ev?.meetingId ? d.meetings.find((m) => m.id === ev.meetingId) : null;
    setCur(existing ?? blank(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.hydrated]);

  // Keep the live transcript flowing into the open meeting.
  useEffect(() => {
    if (rec && cur) setCur((c) => (c ? { ...c, transcript: tr.finalText } : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr.finalText]);

  const start = async () => {
    if (!cur) return;
    tr.reset(); tr.setFinalText(cur.transcript);
    setSecs(0); setAudioUrl(null); chunks.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      m.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      m.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setAudioUrl(URL.createObjectURL(new Blob(chunks.current, { type: m.mimeType || "audio/webm" }))); };
      m.start(1000); mr.current = m;
    } catch { /* no mic for audio file — transcription may still work */ }
    if (tr.supported) tr.start();
    setRec(true);
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };
  const stop = () => {
    tr.stop();
    if (mr.current?.state === "recording") mr.current.stop();
    if (timer.current) clearInterval(timer.current);
    setRec(false);
    setCur((c) => (c ? { ...c, transcript: (tr.finalText + (tr.interim ? " " + tr.interim : "")).trim() || c.transcript, durationSec: (c.durationSec ?? 0) + secs } : c));
  };

  const save = () => {
    if (!cur) return;
    d.upsert("meetings", cur);
    if (cur.eventId) { const ev = d.events.find((e) => e.id === cur.eventId); if (ev) d.upsert("events", { ...ev, meetingId: cur.id }); }
  };

  if (cur) {
    return (
      <div>
        <button onClick={() => { if (rec) stop(); setCur(null); history.replaceState(null, "", "/desk/meetings/"); }} className="text-sm mb-3" style={{ color: "var(--brand)" }}>← All meetings</button>
        <Card className="mb-4">
          <div className="grid md:grid-cols-[2fr_1fr_1fr] gap-3">
            <Field label="Meeting"><input className={inputCls} style={inputStyle} value={cur.title} onChange={(e) => setCur({ ...cur, title: e.target.value })} /></Field>
            <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={cur.date} onChange={(e) => setCur({ ...cur, date: e.target.value })} /></Field>
            <Field label="Attendees"><input className={inputCls} style={inputStyle} value={cur.attendees} onChange={(e) => setCur({ ...cur, attendees: e.target.value })} /></Field>
          </div>
          <div className="mt-5 flex flex-col md:flex-row items-center gap-4">
            <button onClick={rec ? stop : start} className="h-20 w-20 rounded-full flex items-center justify-center text-white shadow-lg shrink-0 transition" style={{ background: rec ? "#DE2010" : "var(--brand)", boxShadow: rec ? "0 0 0 8px rgba(222,32,16,0.18)" : undefined }} aria-label={rec ? "Stop recording" : "Start recording"}>
              {rec ? <span className="h-6 w-6 rounded-sm bg-white" /> : <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white" strokeWidth="2" fill="none" /></svg>}
            </button>
            <div className="flex-1 min-w-0 text-center md:text-left">
              <div className="text-2xl font-bold tabular-nums" style={{ color: rec ? "#DE2010" : "var(--text)" }}>{rec ? `● ${fmtTime(secs)}` : "Ready to record"}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {tr.supported ? "Live transcription on this device (works best in Chrome or Edge). Place the phone near the speakers." : "This browser can't transcribe live — audio is still recorded; type or paste notes below."}
              </div>
              {tr.error && <div className="text-xs mt-1" style={{ color: "var(--neg)" }}>{tr.error}</div>}
              {rec && tr.interim && <div className="text-sm mt-2 italic truncate" style={{ color: "var(--text-faint)" }}>…{tr.interim}</div>}
            </div>
            <div className="flex flex-col gap-2">
              {audioUrl && <a href={audioUrl} download={`${cur.title.replace(/[^\w]+/g, "-")}.webm`} className="text-xs font-semibold rounded-md border px-3 py-1.5 text-center" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Download audio</a>}
              {!cur.transcript && !rec && <button onClick={() => setCur({ ...cur, transcript: SAMPLE, title: cur.title === "Meeting" ? "Lithium investor delegation" : cur.title })} className="text-xs underline" style={{ color: "var(--text-faint)" }}>Try a sample transcript</button>}
            </div>
          </div>
        </Card>
        <Editor m={cur} onChange={setCur} onSave={save} onDelete={d.meetings.some((x) => x.id === cur.id) ? () => { d.remove("meetings", cur.id); setCur(null); } : undefined} />
      </div>
    );
  }

  return (
    <div>
      <PageHead kicker="Record · transcribe · minute · share" title="Meetings" sub="Press record in any meeting. The Desk transcribes it, writes the minutes, assigns the actions, and gives you a PDF to share." right={<Btn onClick={() => setCur(blank())}>● New recording</Btn>} />
      {d.meetings.length === 0 ? (
        <Card className="text-center py-10">
          <div className="text-4xl mb-2">🎙</div>
          <div className="font-bold" style={{ color: "var(--text)" }}>No meetings recorded yet</div>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>Start a recording, or try it with a sample transcript.</p>
          <Btn onClick={() => setCur(blank())}>● New recording</Btn>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {d.meetings.map((m) => (
            <Card key={m.id} className="cursor-pointer hover:shadow-md transition" onClick={() => setCur(m)}>
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{fmtDate(m.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                  <div className="font-bold truncate" style={{ color: "var(--text)" }}>{m.title}</div>
                </div>
                {m.minutesBy && <AiTag live={m.minutesBy === "ai"} />}
              </div>
              <p className="text-sm mt-2 line-clamp-3" style={{ color: "var(--text-muted)" }}>{m.summary || m.transcript || "No content yet."}</p>
              <div className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>{m.decisions.length} decisions · {m.actions.length} actions</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
