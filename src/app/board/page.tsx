"use client";

import { useRef, useState, useCallback } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { askClaude, aiLastError } from "@/lib/aiClient";
import { PageHeader, Badge } from "@/components/ui";

const COLORS = [
  "var(--lz-yellow-bg)",
  "var(--lz-blue-bg)",
  "var(--lz-green-bg)",
  "var(--lz-purple-bg)",
  "var(--lz-red-bg)",
];

// One-click thinking frameworks — drop labelled zone notes in a grid.
const FRAMEWORKS: Record<string, { title: string; cells: { text: string; x: number; y: number; color: string }[] }> = {
  swot: {
    title: "SWOT",
    cells: [
      { text: "STRENGTHS\n• ", x: 8, y: 8, color: "var(--lz-green-bg)" },
      { text: "WEAKNESSES\n• ", x: 52, y: 8, color: "var(--lz-red-bg)" },
      { text: "OPPORTUNITIES\n• ", x: 8, y: 52, color: "var(--lz-blue-bg)" },
      { text: "THREATS\n• ", x: 52, y: 52, color: "var(--lz-yellow-bg)" },
    ],
  },
  matrix: {
    title: "Impact / Effort",
    cells: [
      { text: "QUICK WINS\nhigh impact · low effort\n• ", x: 8, y: 8, color: "var(--lz-green-bg)" },
      { text: "BIG BETS\nhigh impact · high effort\n• ", x: 52, y: 8, color: "var(--lz-blue-bg)" },
      { text: "FILL-INS\nlow impact · low effort\n• ", x: 8, y: 52, color: "var(--lz-yellow-bg)" },
      { text: "MONEY PITS\nlow impact · high effort\n• ", x: 52, y: 52, color: "var(--lz-red-bg)" },
    ],
  },
  thesis: {
    title: "Deal thesis",
    cells: [
      { text: "THESIS\n• ", x: 6, y: 8, color: "var(--lz-blue-bg)" },
      { text: "MARKET\n• ", x: 38, y: 8, color: "var(--lz-green-bg)" },
      { text: "RISKS\n• ", x: 70, y: 8, color: "var(--lz-red-bg)" },
      { text: "RETURNS\n• ", x: 20, y: 52, color: "var(--lz-purple-bg)" },
      { text: "NEXT STEPS\n• ", x: 56, y: 52, color: "var(--lz-yellow-bg)" },
    ],
  },
};

export default function BoardPage() {
  const { boardNotes, add, patch, remove } = useAppData();
  const { user } = useAuth();
  const me = user?.name ?? "Delight";
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [topic, setTopic] = useState("");
  const [aiBusy, setAiBusy] = useState<"" | "ideas" | "sum">("");
  const [summary, setSummary] = useState<string | null>(null);

  const brainstorm = async () => {
    const t = topic.trim(); if (!t || aiBusy) return;
    setAiBusy("ideas");
    const text = await askClaude({
      system:
        "You are Rulethu AI facilitating a whiteboard brainstorm for an African investment group in Harare (gold & PGM mining, lithium, solar/PPAs, private equity, microfinance, ZSE/VFEX). " +
        "Generate sharp, specific, varied sticky-note ideas for the topic — practical and Rulethu-relevant. " +
        "Return ONLY a JSON array of 6 to 8 short strings, each under 14 words, no prose or code fences.",
      prompt: `TOPIC: ${t}\n\nReturn the JSON array of sticky-note ideas now.`,
      model: "sonnet",
      maxTokens: 700,
    });
    let ideas: string[] = [];
    try { const s = text?.trim() ?? ""; const a = s.indexOf("["), b = s.lastIndexOf("]"); if (a >= 0 && b > a) ideas = (JSON.parse(s.slice(a, b + 1)) as unknown[]).map(String).filter(Boolean); } catch { /* fallback below */ }
    if (!ideas.length && text) ideas = text.split(/\n+/).map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter((l) => l.length > 2).slice(0, 8);
    if (!ideas.length) { setAiBusy(""); setSummary(`Couldn't brainstorm just now (${aiLastError() ?? "no response"}). Try again.`); return; }
    ideas.slice(0, 8).forEach((idea, i) => {
      add("boardNotes", { id: genId("BN"), author: "Rulethu AI", text: idea, color: COLORS[i % COLORS.length], x: 8 + (i % 4) * 22, y: 14 + Math.floor(i / 4) * 32, createdAt: new Date().toISOString() });
    });
    setAiBusy(""); setTopic("");
  };

  const summarizeBoard = async () => {
    if (!boardNotes.length || aiBusy) return;
    setAiBusy("sum"); setSummary(null);
    const notesTxt = boardNotes.map((n) => `- ${n.text.replace(/\n/g, " ")}`).join("\n");
    const text = await askClaude({
      system:
        "You are Rulethu AI. Turn a whiteboard of sticky notes into a crisp output for an investment team at an African investment group in Harare. " +
        "Plain text, no markdown asterisks, with these short labelled sections: Themes: (2-4 bullets grouping the ideas); So what: (1-2 lines); Action items: (2-4 bullets, each 'Owner — action'). No preamble.",
      prompt: `WHITEBOARD NOTES:\n${notesTxt}\n\nWrite it now:`,
      model: "sonnet",
      maxTokens: 800,
    });
    setSummary(text || `Couldn't summarize just now (${aiLastError() ?? "no response"}).`);
    setAiBusy("");
  };

  const addFramework = (k: string) => {
    const f = FRAMEWORKS[k]; if (!f) return;
    f.cells.forEach((c) => add("boardNotes", { id: genId("BN"), author: f.title, text: c.text, color: c.color, x: c.x, y: c.y, createdAt: new Date().toISOString() }));
  };

  // Keep the board readable — snap every note into a clean, non-overlapping grid.
  const tidy = () => {
    const n = boardNotes.length; if (!n) return;
    const cols = n <= 3 ? n : n <= 8 ? 4 : n <= 15 ? 5 : 6;
    const rows = Math.ceil(n / cols);
    const stepX = cols > 1 ? 86 / (cols - 1) : 0;
    const stepY = rows > 1 ? Math.min(24, 80 / (rows - 1)) : 0;
    boardNotes.forEach((note, i) => {
      patch("boardNotes", note.id, { x: cols > 1 ? 3 + (i % cols) * stepX : 40, y: 5 + Math.floor(i / cols) * stepY });
    });
  };

  const clearBoard = () => {
    if (!boardNotes.length) return;
    if (confirm(`Clear all ${boardNotes.length} notes from the board? This can't be undone.`)) boardNotes.forEach((n) => remove("boardNotes", n.id));
  };

  const addNote = () => {
    add("boardNotes", {
      id: genId("BN"),
      author: me,
      text: "New note",
      color,
      x: 20 + Math.random() * 30,
      y: 20 + Math.random() * 30,
      createdAt: new Date().toISOString(),
    });
  };

  const pointFromEvent = useCallback((clientX: number, clientY: number) => {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(92, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(90, ((clientY - r.top) / r.height) * 100)),
    };
  }, []);

  const onDown = (e: React.PointerEvent, id: string, nx: number, ny: number) => {
    const p = pointFromEvent(e.clientX, e.clientY);
    setDrag({ id, dx: p.x - nx, dy: p.y - ny });
    setLive({ id, x: nx, y: ny });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointFromEvent(e.clientX, e.clientY);
    setLive({ id: drag.id, x: p.x - drag.dx, y: p.y - drag.dy });
  };
  const onUp = () => {
    if (drag && live) patch("boardNotes", drag.id, { x: live.x, y: live.y });
    setDrag(null); setLive(null);
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Whiteboard"
        subtitle="A live shared canvas — drop sticky notes, brainstorm and map ideas with the group. Drag to move; everyone sees updates."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--pos)" }} /> Live · shared with the group
            </span>
            <Badge tone="live">{boardNotes.length} notes</Badge>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className="h-5 w-5 rounded-full border-2" style={{ background: c, borderColor: color === c ? "var(--brand)" : "transparent" }} aria-label="colour" />
              ))}
            </div>
            <button onClick={tidy} disabled={boardNotes.length < 2} className="rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text)" }} title="Auto-arrange into a clean grid">⊞ Tidy</button>
            <button onClick={clearBoard} disabled={!boardNotes.length} className="rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--neg)" }}>Clear</button>
            <button onClick={addNote} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>+ Note</button>
          </div>
        }
      />

      {/* AI tools */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2.5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <span className="text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shrink-0" style={{ color: "var(--brand)" }}><span style={{ color: "var(--accent)" }}>✦</span> AI tools</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") brainstorm(); }} placeholder="Brainstorm a topic… e.g. ways to de-risk the Solar IPP" className="flex-1 min-w-[200px] rounded-md border px-2.5 py-1.5 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
        <button onClick={brainstorm} disabled={aiBusy === "ideas" || !topic.trim()} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 shrink-0" style={{ background: "var(--brand)" }}>{aiBusy === "ideas" ? "Thinking…" : "✨ Brainstorm"}</button>
        <select onChange={(e) => { if (e.target.value) { addFramework(e.target.value); e.target.value = ""; } }} defaultValue="" className="rounded-md border px-2 py-1.5 text-sm shrink-0" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}>
          <option value="">+ Framework…</option>
          <option value="swot">SWOT</option>
          <option value="matrix">Impact / Effort</option>
          <option value="thesis">Deal thesis</option>
        </select>
        <button onClick={summarizeBoard} disabled={aiBusy === "sum" || !boardNotes.length} className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50 shrink-0" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{aiBusy === "sum" ? "Summarizing…" : "📋 Summarize board"}</button>
      </div>

      <div
        ref={boardRef}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="relative rounded-xl border overflow-hidden"
        style={{
          height: "calc(100vh - 220px)",
          minHeight: 460,
          borderColor: "var(--border)",
          background:
            "radial-gradient(circle, var(--border) 1px, transparent 1px) 0 0 / 22px 22px, var(--surface)",
          touchAction: "none",
        }}
      >
        {boardNotes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "var(--text-faint)" }}>
            Empty board — click <span className="mx-1 font-semibold" style={{ color: "var(--brand)" }}>+ Note</span> to add the first sticky.
          </div>
        )}
        {boardNotes.map((n) => {
          const pos = live && live.id === n.id ? live : n;
          const dragging = drag?.id === n.id;
          return (
            <div
              key={n.id}
              className="absolute w-44 rounded-lg p-2.5 shadow-md select-none"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                background: n.color,
                border: "1px solid var(--border)",
                cursor: dragging ? "grabbing" : "grab",
                zIndex: dragging ? 20 : 1,
                boxShadow: dragging ? "0 10px 24px rgba(0,0,0,0.18)" : "var(--shadow-card)",
              }}
            >
              <div
                onPointerDown={(e) => onDown(e, n.id, pos.x, pos.y)}
                className="flex items-center justify-between mb-1 cursor-grab"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{n.author}</span>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove("boardNotes", n.id)} className="text-xs leading-none" style={{ color: "var(--text-faint)" }} aria-label="delete">✕</button>
              </div>
              <textarea
                value={n.text}
                onChange={(e) => patch("boardNotes", n.id, { text: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                rows={3}
                className="w-full resize-none bg-transparent text-sm outline-none"
                style={{ color: "var(--text)" }}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
        Drag a note by its top bar. Edit text inline. Pick a colour before adding. The board is shared with everyone and syncs across devices.
      </p>

      {summary !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setSummary(null)}>
          <div className="w-full max-w-2xl rounded-xl border my-4 p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold inline-flex items-center gap-2" style={{ color: "var(--text)" }}><span style={{ color: "var(--accent)" }}>✦</span> Board summary</h2>
              <button onClick={() => setSummary(null)} className="rounded-md border px-2.5 py-1 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>✕ Close</button>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text)" }}>{summary}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(summary); }} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Copy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
