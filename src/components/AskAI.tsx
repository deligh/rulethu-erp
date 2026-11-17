"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/store";
import { answerQueryLive, navSearch, runChecks, AiSnapshot, AiAnswer, AI_DEMO_NOTE } from "@/lib/ai";

export const ASK_AI_EVENT = "rulethu:ask-ai";

/** Open the palette from anywhere: window.dispatchEvent(new CustomEvent(ASK_AI_EVENT, { detail: "seed text" })) */
export function openAskAI(seed = "") {
  window.dispatchEvent(new CustomEvent(ASK_AI_EVENT, { detail: seed }));
}

// Render a tiny subset of markdown inline: **bold**.
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} style={{ color: "var(--text)" }}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function AskAI() {
  const data = useAppData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const snap: AiSnapshot = useMemo(() => ({
    deals: data.deals.map((d) => ({ name: d.name, stage: d.stage, ticket: d.ticket, sector: d.sector })),
    loans: data.loans.map((l) => ({ borrower: l.borrower, principal: l.principal, status: l.status })),
    tbills: data.tbills.map((t) => ({ client: t.client, reference: t.reference, maturityDate: t.maturityDate, faceValue: t.faceValue })),
    employees: data.employees.map((e) => ({ name: e.name, role: e.role, department: e.department, status: e.status })),
    tasks: data.tasks.map((t) => ({ title: t.title, status: (t as { status?: string }).status })),
    leave: data.leave.map((l) => ({ employee: l.employee, type: l.type, status: l.status })),
    reports: data.reports.map((r) => ({ title: r.title })),
    ledger: data.entries.reduce((acc, e) => {
      for (const l of e.lines) { acc.debit += l.debit || 0; acc.credit += l.credit || 0; }
      return acc;
    }, { debit: 0, credit: 0 }),
    checks: runChecks({
      entries: data.entries, pos: data.pos, requisitions: data.requisitions, requests: data.requests,
      tbills: data.tbills, loans: data.loans, leave: data.leave, employees: data.employees,
      deals: data.deals, goals: data.goals,
    }),
  }), [data.deals, data.loans, data.tbills, data.employees, data.tasks, data.leave, data.reports, data.entries, data.pos, data.requisitions, data.requests, data.goals]);

  // Open via keyboard + custom event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onEvent = (e: Event) => {
      const seed = (e as CustomEvent).detail as string | undefined;
      setOpen(true);
      if (seed) { setQ(seed); setAnswer(null); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(ASK_AI_EVENT, onEvent as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(ASK_AI_EVENT, onEvent as EventListener);
    };
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  const navMatches = useMemo(() => (q.trim() && !answer ? navSearch(q, 5) : []), [q, answer]);

  const ask = () => {
    if (!q.trim()) return;
    setThinking(true);
    setAnswer(null);
    // tiny delay so it reads like it's "thinking" (demo flourish)
    setTimeout(async () => {
      setAnswer(await answerQueryLive(q, snap));
      setThinking(false);
    }, 320);
  };

  const go = (href: string) => { setOpen(false); router.push(href); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" style={{ background: "color-mix(in srgb, #0b0f17 55%, transparent)" }} onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl rounded-xl border overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-overlay)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}>
            <path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setAnswer(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            placeholder="Ask Rulethu AI, or search for a page…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text)" }}
          />
          <kbd className="hidden sm:block text-[10px] rounded px-1.5 py-0.5" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {/* Live navigation suggestions while typing */}
          {navMatches.length > 0 && (
            <div className="py-1.5">
              <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Go to</div>
              {navMatches.map((it) => (
                <button key={it.href} onClick={() => go(it.href)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-[var(--surface-2)]" style={{ color: "var(--text)" }}>
                  <span className="flex h-6 w-6 items-center justify-center rounded shrink-0" style={{ background: "var(--surface-2)", color: "var(--brand)" }}>→</span>
                  <span className="flex-1">{it.label}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{it.module}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thinking state */}
          {thinking && (
            <div className="px-4 py-6 flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "240ms" }} />
              </span>
              Thinking…
            </div>
          )}

          {/* Answer */}
          {answer && !thinking && (
            <div className="px-4 py-4">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--lz-blue-bg)", color: "var(--lz-blue-fg)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
                {answer.agent}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}><Rich text={answer.text} /></p>
              {answer.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {answer.sources.map((it) => (
                    <button key={it.href} onClick={() => go(it.href)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                      {it.label}
                      <span style={{ color: "var(--text-faint)" }}>↗</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty / idle hint */}
          {!answer && !thinking && navMatches.length === 0 && (
            <div className="px-4 py-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Try asking</div>
              <div className="space-y-1.5">
                {["Where do I raise a purchase order?", "How many deals are in the pipeline?", "Which treasury bill matures next?", "Draft an investment memo"].map((ex) => (
                  <button key={ex} onClick={() => { setQ(ex); setTimeout(ask, 0); }} className="w-full text-left text-sm rounded-md px-3 py-2 hover:bg-[var(--surface-2)]" style={{ color: "var(--text-muted)" }}>
                    “{ex}”
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: ask button + demo note */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <span className="text-[11px] leading-tight" style={{ color: "var(--text-faint)" }}>{AI_DEMO_NOTE}</span>
          <button onClick={ask} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Ask AI ↵</button>
        </div>
      </div>
    </div>
  );
}
