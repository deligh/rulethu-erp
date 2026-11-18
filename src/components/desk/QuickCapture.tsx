"use client";

import React, { useState } from "react";
import { useDesk, uid, todayISO, fmtDate } from "@/lib/desk/store";
import { parseCommitment } from "@/lib/desk/ai";
import { Btn, AiTag } from "./ui";
import { useDictation } from "./useDictation";

/** "Tell ZIDA to send the lithium report by Friday" → a dated, owned commitment. */
export default function QuickCapture({ source = "Instruction" }: { source?: string }) {
  const d = useDesk();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ title: string; owner: string; due: string; live: boolean } | null>(null);
  const dict = useDictation((t) => setText((s) => (s ? s + " " : "") + t));

  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const p = await parseCommitment(text);
    d.upsert("commitments", { id: uid("C"), title: p.title, owner: p.owner, due: p.due, priority: p.priority, status: "Not started", source, createdAt: todayISO() });
    setLast(p); setText(""); setBusy(false);
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or speak an instruction… “Tell ZIDA to send the lithium report by Friday”" className="flex-1 min-w-0 rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
        {dict.supported && (
          <button type="button" onClick={dict.listening ? dict.stop : dict.start} title="Dictate" className="rounded-lg border px-3 text-sm shrink-0" style={{ borderColor: dict.listening ? "var(--neg)" : "var(--border)", color: dict.listening ? "var(--neg)" : "var(--text-muted)", background: "var(--surface)" }}>
            {dict.listening ? "■ Stop" : "🎙"}
          </button>
        )}
        <Btn type="submit" disabled={busy || !text.trim()}>{busy ? "Adding…" : "Add"}</Btn>
      </form>
      {last && (
        <div className="mt-2 text-xs flex items-center gap-2 flex-wrap" style={{ color: "var(--text-muted)" }}>
          <AiTag live={last.live} /> Added: <b style={{ color: "var(--text)" }}>{last.title}</b> — {last.owner}, due {fmtDate(last.due, { weekday: "short", day: "numeric", month: "short" })}
        </div>
      )}
    </div>
  );
}
