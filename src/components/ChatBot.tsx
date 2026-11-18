"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { answerQueryLive, runChecks, scopeSnapshot, AiSnapshot, AiAnswer, NavItem } from "@/lib/ai";
import { canAccessModule } from "@/lib/access";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Parse a loose date phrase → yyyy-mm-dd (defaults to a week out).
function parseEventDate(text: string): string {
  const now = new Date();
  const m1 = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (m1) return m1[1];
  if (/\btomorrow\b/i.test(text)) return iso(new Date(now.getTime() + 86400000));
  if (/\btoday\b/i.test(text)) return iso(now);
  if (/\bnext week\b/i.test(text)) return iso(new Date(now.getTime() + 7 * 86400000));
  const inN = text.match(/\bin (\d+) days?\b/i);
  if (inN) return iso(new Date(now.getTime() + parseInt(inN[1]) * 86400000));
  const md = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i);
  if (md) {
    const mo = MONTHS.indexOf(md[1].toLowerCase());
    let y = now.getFullYear();
    const cand = new Date(y, mo, parseInt(md[2]));
    if (cand < now) { y += 1; }
    return iso(new Date(y, mo, parseInt(md[2])));
  }
  return iso(new Date(now.getTime() + 7 * 86400000));
}

function parseEventTitle(text: string): string {
  const t = text
    .replace(/^\s*(please\s+)?(add|schedule|put|book|remind me( to)?|set a reminder( to)?)\s+/i, "")
    .replace(/\b(to|on|in)?\s*(my )?(calendar|diary|schedule)\b/i, "")
    .replace(/\b(on|by)\b.*$/i, "")
    .replace(/\b(tomorrow|today|next week|in \d+ days?)\b/i, "")
    .trim();
  return t || "New event";
}

interface ChatMsg { id: string; role: "user" | "ai"; text: string; agent?: string; sources?: NavItem[] }

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}

export default function ChatBot() {
  const data = useAppData();
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([{
    id: "welcome", role: "ai", agent: "Rulethu AI",
    text: `Hi${user ? ` ${user.name}` : ""} 👋 I’m Rulethu — ask me where something is, how we’re doing, or to draft a document. Try the suggestions below.`,
  }]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const snap: AiSnapshot = useMemo(() => {
    const empName = new Map(data.employees.map((e) => [e.id, e.name]));
    return {
    deals: data.deals.map((d) => ({ name: d.name, stage: d.stage, ticket: d.ticket, sector: d.sector })),
    loans: data.loans.map((l) => ({ borrower: l.borrower, principal: l.principal, status: l.status })),
    tbills: data.tbills.map((t) => ({ client: t.client, reference: t.reference, maturityDate: t.maturityDate, faceValue: t.faceValue })),
    employees: data.employees.map((e) => ({ name: e.name, role: e.role, department: e.department, status: e.status })),
    tasks: data.tasks.map((t) => ({ title: t.title, status: t.status, assignee: empName.get(t.assigneeId) ?? t.assigneeId, priority: t.priority, module: t.module })),
    leave: data.leave.map((l) => ({ employee: l.employee, type: l.type, status: l.status })),
    reports: data.reports.map((r) => ({ title: r.title })),
    ledger: data.entries.reduce((a, e) => { for (const l of e.lines) { a.debit += l.debit || 0; a.credit += l.credit || 0; } return a; }, { debit: 0, credit: 0 }),
    checks: runChecks({ entries: data.entries, pos: data.pos, requisitions: data.requisitions, requests: data.requests, tbills: data.tbills, loans: data.loans, leave: data.leave, employees: data.employees, deals: data.deals, goals: data.goals }),
    knowledge: data.knowledge.map((k) => ({ name: k.name, folder: k.folder, description: k.description, excerpt: k.excerpt, readable: k.readable })),
    };
  }, [data]);

  // Scope what the AI can see to the signed-in user's access — no leakages.
  const scopedSnap = useMemo(() => {
    if (!user) return scopeSnapshot(snap, { deals: false, ledger: false, book: false });
    return scopeSnapshot(snap, {
      deals: canAccessModule(user, "investments"),
      ledger: canAccessModule(user, "finance"),
      book: canAccessModule(user, "finance") || canAccessModule(user, "treasury") || canAccessModule(user, "microfinance"),
    });
  }, [snap, user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, thinking, open]);

  const myUpcoming = () => {
    const todayIso = iso(new Date());
    const mine: { date: string; label: string }[] = [];
    for (const e of data.personalEvents) if (e.owner === user?.name && e.date >= todayIso) mine.push({ date: e.date, label: e.title });
    for (const l of data.leave) if (l.employee === user?.name && l.status !== "Declined" && l.start >= todayIso) mine.push({ date: l.start, label: `Leave (${l.type})` });
    for (const g of data.goals) if (g.owner === user?.name && g.status !== "Done" && g.targetDate >= todayIso) mine.push({ date: g.targetDate, label: `Finish “${g.title}”` });
    return mine.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  };

  const send = (q: string) => {
    const text = q.trim();
    if (!text) return;
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "user", text }]);
    setInput("");
    setThinking(true);

    const lower = text.toLowerCase();
    const addIntent = (/(add|schedule|put|book|set)/.test(lower) && /(calendar|diary|reminder|schedule)/.test(lower)) || /^remind me/.test(lower);
    const myCalIntent = /(my calendar|my day|my schedule|my diary|my events|what('?s| is) (on|coming up) for me|what do i have)/.test(lower);

    setTimeout(async () => {
      let a: AiAnswer;
      if (addIntent && user) {
        const title = parseEventTitle(text);
        const date = parseEventDate(text);
        data.add("personalEvents", { id: genId("PE"), owner: user.name, title, date, createdAt: new Date().toISOString() }, { title: "Added to your calendar", body: `${title} · ${date}`, module: "calendar" });
        a = { agent: "Rulethu AI", text: `Done — I’ve added **${title}** to your calendar for **${date}**. ✓`, sources: [{ label: "Open my calendar", href: "/calendar", module: "Calendar", keywords: "" }] };
      } else if (myCalIntent && user) {
        const up = myUpcoming();
        a = up.length
          ? { agent: "Rulethu AI", text: `Here’s what’s coming up for you, ${user.name}:\n\n${up.map((e) => `• **${e.date}** — ${e.label}`).join("\n")}`, sources: [{ label: "Open my calendar", href: "/calendar", module: "Calendar", keywords: "" }] }
          : { agent: "Rulethu AI", text: `You’ve nothing on your personal calendar yet. Tell me “add … to my calendar” and I’ll schedule it, or add one on the Calendar.`, sources: [{ label: "Open my calendar", href: "/calendar", module: "Calendar", keywords: "" }] };
      } else {
        const history = msgs.filter((m) => m.id !== "welcome").map((m) => ({ role: m.role === "ai" ? ("assistant" as const) : ("user" as const), content: m.text }));
        a = await answerQueryLive(text, scopedSnap, history);
      }
      setMsgs((m) => [...m, { id: `a${Date.now()}`, role: "ai", text: a.text, agent: a.agent, sources: a.sources }]);
      setThinking(false);
    }, 360);
  };

  const go = (href: string) => { setOpen(false); router.push(href); };
  const SUGGESTIONS = ["What needs attention?", "What's on my calendar?", "Add board pack review to my calendar on Friday", "Do the financials balance?"];

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full pl-3 pr-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]"
        style={{ background: "var(--brand)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
        title="Talk to Rulethu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /><path d="M8 9h8M8 13h5" /></svg>
        <span className="hidden sm:inline">Talk to Rulethu</span>
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[min(92vw,380px)] rounded-xl border flex flex-col overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-overlay)", height: "min(70vh, 560px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 60%, #0b0f17))" }}>
            <div className="flex items-center gap-2 text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Talk to Rulethu</div>
                <div className="text-[10px] opacity-85">AI assistant · knows your live data</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-lg leading-none">✕</button>
          </div>

          {/* Thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: "var(--surface-2)" }}>
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  {m.role === "ai" && m.agent && <div className="text-[10px] font-semibold mb-0.5 ml-1" style={{ color: "var(--brand)" }}>{m.agent}</div>}
                  <div className="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap" style={m.role === "user" ? { background: "var(--brand)", color: "#fff", borderBottomRightRadius: 4 } : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 4 }}>
                    <Rich text={m.text} />
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.sources.map((s) => (
                        <button key={s.href} onClick={() => go(s.href)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
                          {s.label} <span style={{ color: "var(--text-faint)" }}>↗</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "120ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "240ms" }} />
                  </span>
                </div>
              </div>
            )}
            {msgs.length <= 1 && !thinking && (
              <div className="pt-1 space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="block w-full text-left rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}>{s}</button>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t p-2.5 flex items-center gap-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Message Rulethu…" className="flex-1 rounded-full border px-3.5 py-2 text-sm outline-none" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
            <button onClick={() => send(input)} className="flex h-9 w-9 items-center justify-center rounded-full text-white shrink-0" style={{ background: "var(--brand)" }} title="Send">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
