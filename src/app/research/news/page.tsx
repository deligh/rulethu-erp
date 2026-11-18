"use client";

import { useEffect, useRef, useState } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { fetchMarketDigest, needsRefresh } from "@/lib/news";
import { aiLastError } from "@/lib/aiClient";

function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.round(hrs / 24)} day(s) ago`;
}

export default function DailyMarketPage() {
  const { market, setMarket, newsComments, add } = useAppData();
  const { user } = useAuth();
  const me = user?.name ?? "Rulethu";
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [diag, setDiag] = useState<string | null>(null);
  const triggered = useRef(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const snap = await fetchMarketDigest();
      // A real brief always wins. A demo brief only applies if we have nothing real.
      if (!snap.demo || !market || market.demo) setMarket(snap);
      setDiag(snap.demo ? (aiLastError() ?? "The live market desk returned no data.") : null);
    } finally {
      setBusy(false);
    }
  };

  // On open: show the cached brief immediately. Only fetch if there is NOTHING
  // cached, or the cached brief is genuinely older than the 3-hour cadence — so
  // signing in never triggers a reload when a recent brief already exists.
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    if (needsRefresh(market)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the page stays open, refresh on the cadence (and on focus) only when
  // the brief has actually aged past REFRESH_HOURS — never just because it's demo.
  useEffect(() => {
    const tick = () => { if (!busy && needsRefresh(market)) refresh(); };
    const id = setInterval(tick, 30 * 60 * 1000); // re-check every 30 min
    window.addEventListener("focus", tick);
    return () => { clearInterval(id); window.removeEventListener("focus", tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, busy]);

  const [openStory, setOpenStory] = useState<number | null>(null);

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null); // id of the comment the AI is answering

  // Build an AI answer to an @AI-tagged comment, using today's brief + thread.
  const aiAnswer = async (question: string, parentId: string, threadText: string) => {
    setAiBusy(parentId);
    try {
      const { askClaude } = await import("@/lib/aiClient");
      const brief = market
        ? `TODAY'S MARKET BRIEF:\nHeadline: ${market.headline}\nPrices: ${market.prices.map((p) => `${p.name} ${p.value} ${p.change ?? ""}`).join("; ")}\nCommentary: ${market.commentary}\nWatch: ${market.watch.join("; ")}`
        : "No market brief is loaded.";
      const nowStr = new Date().toLocaleString("en-GB", { timeZone: "Africa/Harare", weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const text = await askClaude({
        system: `You are Rulethu AI on the market desk at an African investment group in Harare. RIGHT NOW it is ${nowStr} Central Africa Time (UTC+2) — treat this as the current date and time, do not say you cannot tell the time. A colleague tagged you on the daily market brief. Answer their question clearly and expand/explain, always linking the market moves to the Zimbabwe / SADC and Rulethu context (gold & PGM mining, lithium, solar/PPAs, ZSE/VFEX, ZiG/USD). Be concrete and practical, 1-3 short paragraphs. Plain text — no markdown asterisks.`,
        prompt: `${brief}\n\nThread so far: ${threadText}\n\nColleague's question: ${question}\n\nAnswer:`,
        model: "haiku",
        maxTokens: 1000,
      });
      add("newsComments", { id: genId("NC"), author: "Rulethu AI", text: text || "I couldn't answer just now — try again in a moment.", createdAt: new Date().toISOString(), parentId, isAI: true });
    } finally {
      setAiBusy(null);
    }
  };

  const AI_TAG = /@(ai|rulethu)\b/i;
  const post = (raw: string, parentId?: string) => {
    const t = raw.trim();
    if (!t) return;
    const id = genId("NC");
    add("newsComments", { id, author: me, text: t, createdAt: new Date().toISOString(), parentId });
    // If they tagged @AI, have the desk assistant reply in-thread.
    if (AI_TAG.test(t)) {
      const q = t.replace(AI_TAG, "").trim() || t;
      aiAnswer(q, id, t);
    }
    if (parentId) { setReplyText(""); setReplyTo(null); } else setComment("");
  };

  const topLevel = newsComments.filter((c) => !c.parentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const repliesOf = (pid: string) => newsComments.filter((c) => c.parentId === pid).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const Avatar = ({ c }: { c: { author: string; isAI?: boolean } }) => (
    <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: c.isAI ? "var(--accent)" : "var(--brand)", color: c.isAI ? "#1a1205" : "#fff" }}>
      {c.isAI ? "✦" : c.author.slice(0, 1).toUpperCase()}
    </div>
  );

  return (
    <div className="page-enter">
      <PageHeader
        title="Daily Market"
        subtitle="Live commodity prices and a daily AI briefing — commodities and the wider market — through the Rulethu lens. Cached and shared across the group; it refreshes on a 3-hour cadence, not on every login."
        actions={
          <div className="flex items-center gap-2">
            {busy && market && <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}><span className="inline-block h-3 w-3 rounded-full border-2 animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />updating</span>}
            {market?.demo && <Badge tone="warn">Demo data</Badge>}
            {market && !market.demo && <Badge tone="live">AI · web search</Badge>}
            <button onClick={refresh} disabled={busy} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>
              {busy ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        }
      />
      <ModuleTabs moduleKey="research" />

      {/* Price tiles — labelled skeleton while scanning markets */}
      {busy && !market && (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
            Scanning global markets with live web search… this takes ~30 seconds.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {["Gold (spot)", "Platinum", "Brent Crude", "Lithium carbonate", "ZSE All Share"].map((name, i) => (
              <div key={i} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-faint)" }}>{name}</div>
                <div className="mt-2 h-5 w-20 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
                <div className="mt-2 h-3 w-12 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
              </div>
            ))}
          </div>
        </>
      )}
      {market && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {market.prices.map((p, i) => {
            const col = p.dir === "up" ? "var(--pos)" : p.dir === "down" ? "var(--neg)" : "var(--text-muted)";
            const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "▬";
            return (
              <div key={i} className="rz-card rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)", animationDelay: `${i * 60}ms` }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-faint)" }} title={p.name}>{p.name}</div>
                <div className="mt-1 text-lg font-bold" style={{ color: "var(--text)" }}>{p.value}</div>
                {p.change && <div className="mt-0.5 text-xs font-semibold" style={{ color: col }}>{arrow} {p.change}</div>}
                {p.insight && <div className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{p.insight}</div>}
                {p.source && <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>via {p.source}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Today's briefing — expandable story cards (commodities + wider market) */}
      {market && market.stories && market.stories.length > 0 && (
        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Today&apos;s briefing</h2>
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>tap a card to read more</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {market.stories.map((s, i) => {
              const open = openStory === i;
              const impactCol = s.impact === "up" ? "var(--pos)" : s.impact === "down" ? "var(--neg)" : "var(--warn)";
              const impactLabel = s.impact === "up" ? "▲ Positive" : s.impact === "down" ? "▼ Watch risk" : "● Watch";
              return (
                <button
                  key={i}
                  onClick={() => setOpenStory(open ? null : i)}
                  className="rz-card text-left rounded-xl border p-4 flex flex-col"
                  style={{ background: "var(--surface)", borderColor: open ? "var(--brand)" : "var(--border)", boxShadow: "var(--shadow-card)", animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: "var(--surface-2)", color: "var(--brand)" }}>{s.category}</span>
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: impactCol }}>{impactLabel}</span>
                  </div>
                  <h3 className="text-sm font-bold leading-snug" style={{ color: "var(--text)" }}>{s.title}</h3>
                  <p className="mt-1 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>{s.summary}</p>
                  {open && (
                    <div className="mt-2 pt-2 border-t text-xs leading-relaxed" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      <p>{s.detail}</p>
                      {s.takeaway && <p className="mt-2 flex gap-1.5"><span style={{ color: "var(--accent)" }}>✦</span><span style={{ color: "var(--text)" }}><b>Rulethu read:</b> {s.takeaway}</span></p>}
                    </div>
                  )}
                  <span className="mt-2 text-[11px] font-medium" style={{ color: "var(--brand)" }}>{open ? "Show less ▲" : "Read more ▾"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI market take */}
      {market && (
        <div className="rounded-xl border p-5 mb-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-base font-bold" style={{ color: "var(--text)" }}><Bold text={market.headline} /></h2>
            <span className="shrink-0 text-[11px]" style={{ color: "var(--text-faint)" }}>as of {timeAgo(market.generatedAt)}</span>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-muted)" }}>
            <Bold text={market.commentary} />
          </div>
          {market.watch.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faint)" }}>What to watch</div>
              <ul className="space-y-1">
                {market.watch.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    <span style={{ color: "var(--brand)" }}>•</span><span><Bold text={w} /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {market.sources && market.sources.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Sources</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {market.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline" style={{ color: "var(--brand)" }}>{s.label} ↗</a>
                ))}
              </div>
            </div>
          )}
          {market.demo && diag && (
            <div className="mt-3 rounded-md border px-3 py-2 text-[11px]" style={{ borderColor: "var(--neg)", background: "color-mix(in srgb, var(--neg) 8%, transparent)", color: "var(--neg)" }}>
              <b>Why no live data:</b> {diag}
            </div>
          )}
          <div className="mt-4 text-[11px]" style={{ color: "var(--text-faint)" }}>
            {market.demo
              ? "Demo brief — once the live AI market desk runs, this refreshes with real current prices."
              : "Generated by Rulethu AI with live web search (Kitco & reputable sources). Prices are indicative; verify before trading."}
          </div>
        </div>
      )}

      {!market && !busy && (
        <div className="rounded-xl border p-8 text-center mb-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>No market brief yet.</p>
          <button onClick={refresh} className="rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Generate the market brief</button>
        </div>
      )}

      {/* Desk comments / blog */}
      <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Desk comments</h3>
        <p className="text-[11px] mb-3" style={{ color: "var(--text-faint)" }}>Tip: tag <b style={{ color: "var(--brand)" }}>@AI</b> in a comment to ask the desk assistant to expand or explain — it answers in the thread.</p>
        <div className="flex gap-2 mb-5">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") post(comment); }}
            placeholder="Add your read… or ask @AI to explain the trends"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button onClick={() => post(comment)} className="rounded-md px-4 py-2 text-sm font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Post</button>
        </div>
        {topLevel.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No comments yet — share your view, or tag @AI to explain today&apos;s market.</p>
        ) : (
          <ul className="space-y-4">
            {topLevel.map((c) => (
              <li key={c.id}>
                <div className="flex gap-3">
                  <Avatar c={c} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                      <span className="font-semibold" style={{ color: c.isAI ? "var(--brand)" : "var(--text)" }}>{c.author}</span>{c.isAI && <span className="ml-1 rounded px-1 text-[9px] font-bold uppercase" style={{ background: "var(--lz-green-bg)", color: "var(--lz-green-fg)" }}>AI</span>} · {timeAgo(c.createdAt)}
                    </div>
                    <div className="text-sm whitespace-pre-line" style={{ color: "var(--text)" }}>{c.text}</div>
                    <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }} className="mt-1 text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>Reply</button>
                  </div>
                </div>

                {/* Replies */}
                {(repliesOf(c.id).length > 0 || aiBusy === c.id || replyTo === c.id) && (
                  <ul className="mt-2 ml-11 space-y-3 border-l pl-4" style={{ borderColor: "var(--border)" }}>
                    {repliesOf(c.id).map((r) => (
                      <li key={r.id} className="flex gap-2.5">
                        <Avatar c={r} />
                        <div className="min-w-0">
                          <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                            <span className="font-semibold" style={{ color: r.isAI ? "var(--brand)" : "var(--text)" }}>{r.author}</span>{r.isAI && <span className="ml-1 rounded px-1 text-[9px] font-bold uppercase" style={{ background: "var(--lz-green-bg)", color: "var(--lz-green-fg)" }}>AI</span>} · {timeAgo(r.createdAt)}
                          </div>
                          <div className="text-sm whitespace-pre-line" style={{ color: "var(--text-muted)" }}>{r.text}</div>
                        </div>
                      </li>
                    ))}
                    {aiBusy === c.id && <li className="text-xs" style={{ color: "var(--text-faint)" }}>✦ Rulethu AI is thinking…</li>}
                    {replyTo === c.id && (
                      <li className="flex gap-2">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") post(replyText, c.id); }}
                          autoFocus
                          placeholder="Reply… (tag @AI to ask the assistant)"
                          className="flex-1 rounded-md border px-2.5 py-1.5 text-sm"
                          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                        />
                        <button onClick={() => post(replyText, c.id)} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Reply</button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
