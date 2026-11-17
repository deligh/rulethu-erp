"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAppData, genId, CURRENT_USER, QuizScore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { studyAnswer, studyChat, STUDY_TOPICS } from "@/lib/quizai";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import Avatar from "@/components/Avatar";

function Bold({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} style={{ color: "var(--text)" }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}

interface Question { q: string; options: string[]; answer: number; explain: string }
interface Quiz { id: string; title: string; theme: string; brief: { h: string; p: string }[]; questions: Question[] }

const QUIZZES: Quiz[] = [
  {
    id: "q-tbills", title: "Treasury Bills & Yields", theme: "Markets",
    brief: [
      { h: "What a treasury bill is", p: "A treasury bill (TB) is a short-to-medium government debt instrument. You pay a price today (often at a discount to face value) and receive the face value at maturity, plus any coupon. The return comes from the discount and/or the coupon." },
      { h: "Coupon vs discount yield", p: "A coupon is periodic interest on the face value. Discount yield is the gain from buying below face, annualised over the tenor. Total yield combines both. A zero-coupon bill earns purely from the discount." },
      { h: "Accrual & maturity", p: "Between purchase and maturity, value accretes toward face and coupon accrues day by day. At maturity the holder redeems the face value (and any coupon due at maturity). Selling early means taking the prevailing market discount." },
    ],
    questions: [
      { q: "A zero-coupon TB earns its return from…", options: ["The coupon", "The discount to face value", "Dividends", "FX gains"], answer: 1, explain: "With no coupon, the return is the gain between the discounted purchase price and face value at maturity." },
      { q: "Accrued coupon on a 5% TB with $1,000,000 face after 6 months is about…", options: ["$5,000", "$25,000", "$50,000", "$100,000"], answer: 1, explain: "Annual coupon = 5% × $1,000,000 = $50,000; half a year ≈ $25,000." },
      { q: "If you sell a TB before maturity you receive…", options: ["Always the face value", "The market price (prevailing discount)", "Nothing", "Double the coupon"], answer: 1, explain: "Early sale is at the market's current discount, which can be above or below your cost." },
      { q: "Longer tenor, all else equal, usually means…", options: ["Lower risk", "More sensitivity to rate changes", "No coupon", "Guaranteed higher price"], answer: 1, explain: "Longer instruments are more sensitive to interest-rate moves (duration)." },
      { q: "Weighted portfolio yield is weighted by…", options: ["Number of bills", "Face value of each bill", "Colour", "Client name"], answer: 1, explain: "Larger holdings influence the portfolio yield more, so we weight by face value." },
    ],
  },
  {
    id: "q-irr", title: "IRR, NPV & DSCR", theme: "Investment analysis",
    brief: [
      { h: "NPV", p: "Net present value discounts all future cash flows to today at the cost of capital (WACC). A positive NPV means the project earns more than the required return and creates value." },
      { h: "IRR", p: "The internal rate of return is the discount rate at which NPV equals zero. If IRR is above WACC, the project clears its hurdle. Equity IRR uses cash flows to shareholders after debt." },
      { h: "DSCR", p: "The debt-service cover ratio is cash available for debt service divided by debt service (interest + principal). Lenders want it comfortably above 1.0x — often a 1.2x–1.4x floor — so there is a buffer to pay the loan." },
    ],
    questions: [
      { q: "A project with NPV > 0 at the WACC…", options: ["Destroys value", "Creates value", "Breaks even exactly", "Has no IRR"], answer: 1, explain: "Positive NPV means returns exceed the required return — value is created." },
      { q: "IRR is the rate at which…", options: ["Revenue = cost", "NPV = 0", "Debt = equity", "Tax = 0"], answer: 1, explain: "IRR is defined as the discount rate that sets NPV to zero." },
      { q: "A DSCR of 1.4x means…", options: ["Cash is 40% short of debt service", "Cash is 1.4× debt service", "The loan is unpaid", "IRR is 40%"], answer: 1, explain: "Cash available is 1.4 times the debt service due — a 40% buffer." },
      { q: "Equity IRR differs from project IRR because it…", options: ["Ignores tax", "Reflects leverage (debt)", "Uses revenue only", "Is always higher"], answer: 1, explain: "Equity IRR is after debt service; leverage can raise or lower it versus the unlevered project IRR." },
      { q: "Raising the discount rate, all else equal, makes NPV…", options: ["Higher", "Lower", "Unchanged", "Negative always"], answer: 1, explain: "Higher discount rates reduce the present value of future cash flows, lowering NPV." },
    ],
  },
  {
    id: "q-cash", title: "Cash & Working Capital", theme: "Finance",
    brief: [
      { h: "The daily cash position", p: "Closing cash = opening + receipts − payments − bank charges, per bank, entity and currency. Consolidating every bank daily gives one trusted group position and catches errors early." },
      { h: "Working capital", p: "Working capital is the cash tied up in operations — receivables and stock, less payables. Growth consumes cash through working capital before profits turn into cash." },
      { h: "Roll-up", p: "Accurate daily reports roll into weekly, monthly, quarterly and annual numbers. If the daily is right, the period reports are right — fewer month-end surprises." },
    ],
    questions: [
      { q: "Closing cash equals…", options: ["Opening + receipts − payments − charges", "Receipts − payments", "Opening only", "Payments − receipts"], answer: 0, explain: "That identity is the core of the daily cash report." },
      { q: "Fast growth typically…", options: ["Releases cash", "Consumes cash via working capital", "Has no cash effect", "Lowers receivables"], answer: 1, explain: "Receivables and stock grow with sales, tying up cash ahead of profit." },
      { q: "Consolidating banks daily mainly helps…", options: ["Marketing", "Catch errors & see the true position early", "Raise prices", "Avoid tax"], answer: 1, explain: "A daily group view surfaces discrepancies before they compound." },
      { q: "If the daily report is accurate, the monthly report is…", options: ["Random", "More reliable", "Unnecessary", "Always zero"], answer: 1, explain: "Correct dailies roll up into correct period reports." },
      { q: "Bank charges in the cash report are…", options: ["A receipt", "A deduction from cash", "Ignored", "Added to opening"], answer: 1, explain: "Charges reduce the closing balance alongside payments." },
    ],
  },
];

function todaysQuiz(): Quiz {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return QUIZZES[day % QUIZZES.length];
}

export default function QuizPage() {
  const { quizScores, add } = useAppData();
  const { user } = useAuth();
  const me = user?.name ?? CURRENT_USER;
  const [studyQ, setStudyQ] = useState("");
  const [studyMsgs, setStudyMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [studyBusy, setStudyBusy] = useState(false);
  // Persist the study chat per person, so it's here when they come back.
  const studyKey = `rulethu-study-chat-${me}`;
  const studyLoaded = useRef(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(studyKey); if (raw) setStudyMsgs(JSON.parse(raw)); } catch { /* ignore */ }
    studyLoaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyKey]);
  useEffect(() => {
    if (!studyLoaded.current) return;
    try { localStorage.setItem(studyKey, JSON.stringify(studyMsgs.slice(-40))); } catch { /* ignore */ }
  }, [studyMsgs, studyKey]);
  const askStudy = async (q: string) => {
    const question = q.trim();
    if (!question || studyBusy) return;
    setStudyQ("");
    const nextMsgs = [...studyMsgs, { role: "user" as const, text: question }];
    setStudyMsgs(nextMsgs);
    setStudyBusy(true);
    try {
      const history = nextMsgs.map((m) => ({ role: m.role === "ai" ? ("assistant" as const) : ("user" as const), content: m.text }));
      const ans = await studyChat(history);
      setStudyMsgs((m) => [...m, { role: "ai", text: ans }]);
    } catch {
      setStudyMsgs((m) => [...m, { role: "ai", text: studyAnswer(question).text }]);
    } finally {
      setStudyBusy(false);
    }
  };
  const quiz = useMemo(todaysQuiz, []);
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = quizScores.find((s) => s.user === me && s.date === today && s.quizId === quiz.id);

  const [phase, setPhase] = useState<"read" | "quiz" | "result">(doneToday ? "result" : "read");
  const [answers, setAnswers] = useState<number[]>(Array(quiz.questions.length).fill(-1));
  const score = doneToday ? doneToday.score : answers.reduce((s, a, i) => s + (a === quiz.questions[i].answer ? 1 : 0), 0);

  const submit = () => {
    const sc = answers.reduce((s, a, i) => s + (a === quiz.questions[i].answer ? 1 : 0), 0);
    const rec: QuizScore = { id: genId("QS"), user: me, quizId: quiz.id, date: today, score: sc, total: quiz.questions.length, createdAt: new Date().toISOString() };
    add("quizScores", rec, { title: "Quiz completed", body: `${me}: ${sc}/${quiz.questions.length} on ${quiz.title}`, module: "quiz" });
    setPhase("result");
  };

  // streak for current user
  const myDates = Array.from(new Set(quizScores.filter((s) => s.user === me).map((s) => s.date))).sort().reverse();
  let streak = 0; { const d = new Date(today); for (;;) { const key = d.toISOString().slice(0, 10); if (myDates.includes(key)) { streak++; d.setDate(d.getDate() - 1); } else break; } }

  // leaderboard
  const board = useMemo(() => {
    const m: Record<string, { correct: number; attempts: number }> = {};
    for (const s of quizScores) { m[s.user] = m[s.user] || { correct: 0, attempts: 0 }; m[s.user].correct += s.score; m[s.user].attempts += 1; }
    return Object.entries(m).map(([user, v]) => ({ user, ...v })).sort((a, b) => b.correct - a.correct);
  }, [quizScores]);

  return (
    <div>
      <PageHeader
        title="Daily Quiz"
        subtitle="Read the brief, then take today's challenge. ~15 minutes a day to sharpen the team and build a learning culture."
        actions={<div className="flex items-center gap-2"><Badge tone="warn">🔥 {streak}-day streak</Badge><Badge tone="beta">{quiz.theme}</Badge></div>}
      />

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div>
          {/* READ */}
          {phase === "read" && (
            <Card>
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>{quiz.title}</h2>
              <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>Read this brief — everything in the quiz comes from here.</p>
              <div className="space-y-4">
                {quiz.brief.map((b) => (
                  <div key={b.h}>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--brand)" }}>{b.h}</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>{b.p}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setPhase("quiz")} className="mt-6 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Start the quiz →</button>
            </Card>
          )}

          {/* QUIZ */}
          {phase === "quiz" && (
            <Card>
              <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text)" }}>{quiz.title}</h2>
              <div className="space-y-5">
                {quiz.questions.map((qq, qi) => (
                  <div key={qi}>
                    <div className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>{qi + 1}. {qq.q}</div>
                    <div className="grid gap-2">
                      {qq.options.map((o, oi) => (
                        <button key={oi} onClick={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))} className="text-left rounded-md border px-3 py-2 text-sm" style={{ borderColor: answers[qi] === oi ? "var(--brand)" : "var(--border)", background: answers[qi] === oi ? "color-mix(in srgb, var(--brand) 8%, transparent)" : "transparent", color: "var(--text)" }}>{o}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={submit} disabled={answers.some((a) => a < 0)} className="mt-6 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--brand)" }}>Submit answers</button>
            </Card>
          )}

          {/* RESULT */}
          {phase === "result" && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold" style={{ background: `conic-gradient(var(--pos) ${(score / quiz.questions.length) * 360}deg, var(--surface-2) 0deg)`, color: "var(--text)" }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--surface)" }}>{score}/{quiz.questions.length}</span>
                </div>
                <div>
                  <div className="font-semibold" style={{ color: "var(--text)" }}>{score === quiz.questions.length ? "Perfect! 🎯" : score >= quiz.questions.length * 0.6 ? "Nice work 👏" : "Keep at it 💪"}</div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>Today&apos;s quiz complete · {quiz.title}</div>
                </div>
              </div>
              <SectionTitle>Answers</SectionTitle>
              <div className="space-y-3">
                {quiz.questions.map((qq, qi) => {
                  const mine = doneToday ? undefined : answers[qi];
                  const correct = qq.answer;
                  return (
                    <div key={qi} className="text-sm">
                      <div className="font-medium" style={{ color: "var(--text)" }}>{qi + 1}. {qq.q}</div>
                      <div className="mt-0.5" style={{ color: "var(--pos)" }}>✓ {qq.options[correct]}{mine !== undefined && mine !== correct && mine >= 0 && <span style={{ color: "var(--neg)" }}> · you chose {qq.options[mine]}</span>}</div>
                      <div className="text-xs" style={{ color: "var(--text-faint)" }}>{qq.explain}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar: streak + leaderboard */}
        <div className="space-y-4">
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Your streak</div>
            <div className="text-3xl font-semibold" style={{ color: "var(--text)" }}>🔥 {streak}</div>
            <div className="text-xs" style={{ color: "var(--text-faint)" }}>{doneToday ? "Done today — see you tomorrow" : "Not done today yet"}</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Leaderboard</div>
            {board.length === 0 ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No attempts yet — be first.</p> : (
              <div className="space-y-2">
                {board.map((b, i) => (
                  <div key={b.user} className="flex items-center gap-2">
                    <span className="text-xs w-4" style={{ color: "var(--text-faint)" }}>{i + 1}</span>
                    <Avatar name={b.user} size={24} />
                    <span className="flex-1 text-sm truncate" style={{ color: "var(--text)" }}>{b.user}</span>
                    <span className="text-sm font-semibold tabular" style={{ color: "var(--text)" }}>{b.correct}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>/{b.attempts}×</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Study & Ask AI — the learning resource */}
      <div className="mt-8">
        <SectionTitle hint="live AI · researches the web · remembers the conversation">Study &amp; Ask AI</SectionTitle>
        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Ask anything — your AI research tutor</h3>
              {studyMsgs.length > 0 && (
                <button onClick={() => setStudyMsgs([])} className="ml-auto text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>Clear chat</button>
              )}
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>A real chat — ask about markets, valuation, Zimbabwe/ZSE, SADC, Rulethu&apos;s sectors, or anything else. It <b>researches the web</b> for current facts and <b>remembers the conversation</b>, so you can keep asking follow-ups.</p>

            {/* Conversation */}
            {studyMsgs.length > 0 && (
              <div className="mb-3 space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                {studyMsgs.map((m, i) => (
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="rounded-2xl rounded-br-sm px-3.5 py-2 text-sm max-w-[85%] text-white" style={{ background: "var(--brand)" }}>{m.text}</div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--surface-2)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
                      </span>
                      <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed max-w-[88%] whitespace-pre-line" style={{ background: "var(--surface-2)", color: "var(--text)" }}><Bold text={m.text} /></div>
                    </div>
                  )
                ))}
                {studyBusy && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    <span className="inline-flex gap-1"><span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)" }} /><span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "120ms" }} /><span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "240ms" }} /></span>
                    Thinking…
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input value={studyQ} onChange={(e) => setStudyQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askStudy(studyQ); }} placeholder={studyMsgs.length ? "Ask a follow-up…" : "e.g. Who are the top asset managers in Zimbabwe? Explain DSCR."} className="flex-1 rounded-md border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
              <button onClick={() => askStudy(studyQ)} disabled={studyBusy} className="rounded-md px-4 py-2 text-sm font-semibold text-white shrink-0 disabled:opacity-60" style={{ background: "var(--brand)" }}>{studyBusy ? "…" : "Send"}</button>
            </div>
            {studyMsgs.length === 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {STUDY_TOPICS.map((t) => (
                  <button key={t.id} onClick={() => askStudy(t.title)} className="rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>{t.title}</button>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Powered by live Claude AI with web research. It can take a few seconds when it looks something up.</p>
          </Card>

          <Card>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Study topics</div>
            <div className="space-y-2.5">
              {STUDY_TOPICS.map((t) => (
                <button key={t.id} onClick={() => askStudy(t.title)} className="w-full text-left rounded-md border px-3 py-2 hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.title}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{t.category} · {t.blurb}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
