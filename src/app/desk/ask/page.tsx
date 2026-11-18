"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDesk } from "@/lib/desk/store";
import { askDesk } from "@/lib/desk/ai";
import { Card, Btn, PageHead, RichText } from "@/components/desk/ui";
import { useDictation } from "@/components/desk/useDictation";

const STARTERS = [
  "What's overdue and who owns it?",
  "What's on my schedule this week?",
  "Which investment projects are stuck, and why?",
  "Prepare me for this afternoon's meetings in three bullets",
  "What did we agree in the last meeting?",
];

export default function AskPage() {
  const d = useDesk();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const dict = useDictation((t) => setQ((s) => (s ? s + " " : "") + t));
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [d.chat.length, busy]);

  const send = async (text: string) => {
    const m = text.trim();
    if (!m || busy) return;
    const hist = [...d.chat, { role: "user" as const, content: m }];
    d.set("chat", hist); setQ(""); setBusy(true);
    const r = await askDesk(hist, d);
    d.set("chat", [...hist, { role: "assistant", content: r.text + (r.live ? "" : "\n\n(offline mode)") }]);
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] md:h-[calc(100dvh-6rem)]">
      <PageHead kicker="Your chief of staff" title="Ask the Desk" sub="Answers from your calendar, commitments, meetings and pipeline. For numbers and scenarios, use the Economy Builder or Economic Lab." right={d.chat.length ? <Btn kind="ghost" onClick={() => d.set("chat", [])}>Clear</Btn> : undefined} />
      <Card className="flex-1 overflow-y-auto !p-4 space-y-3">
        {d.chat.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Try:</p>
            {STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="block text-left text-sm rounded-lg border px-3 py-2 w-full hover:shadow-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{s}</button>)}
            <p className="text-xs pt-2" style={{ color: "var(--text-faint)" }}>Economic questions? <Link href="/desk/economy" style={{ color: "var(--brand)" }}>Economy Builder</Link> · <Link href="/lab" style={{ color: "var(--brand)" }}>Economic Lab</Link></p>
          </div>
        )}
        {d.chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line leading-relaxed" style={m.role === "user" ? { background: "var(--brand)", color: "#fff" } : { background: "var(--surface-2, #f4f5f7)", color: "var(--text)" }}><RichText text={m.content} /></div>
          </div>
        ))}
        {busy && <div className="text-sm" style={{ color: "var(--text-faint)" }}>Thinking…</div>}
        <div ref={end} />
      </Card>
      <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="flex gap-2 mt-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about your work…" className="flex-1 min-w-0 rounded-xl border px-4 py-3 text-sm outline-none" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
        {dict.supported && <button type="button" onClick={dict.listening ? dict.stop : dict.start} className="rounded-xl border px-3" style={{ borderColor: dict.listening ? "var(--neg)" : "var(--border)", color: dict.listening ? "var(--neg)" : "var(--text-muted)", background: "var(--surface)" }}>{dict.listening ? "■" : "🎙"}</button>}
        <Btn type="submit" disabled={busy || !q.trim()}>Send</Btn>
      </form>
    </div>
  );
}
