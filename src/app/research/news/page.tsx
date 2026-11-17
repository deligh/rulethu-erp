"use client";

import { useEffect, useRef, useState } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { fetchMarketDigest, isStale } from "@/lib/news";

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
  const triggered = useRef(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const snap = await fetchMarketDigest();
      // A real brief always wins. A demo brief only applies if we have nothing real.
      if (!snap.demo || !market || market.demo) setMarket(snap);
    } finally {
      setBusy(false);
    }
  };

  // Auto-refresh on open if the shared feed is stale (once per mount).
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    if (isStale(market)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep it fresh while the page is open: re-check staleness periodically and
  // when the tab regains focus (approximates a scheduled 2-hourly digest).
  useEffect(() => {
    const tick = () => { if (!busy && isStale(market)) refresh(); };
    const id = setInterval(tick, 20 * 60 * 1000); // every 20 min
    window.addEventListener("focus", tick);
    return () => { clearInterval(id); window.removeEventListener("focus", tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, busy]);

  const postComment = () => {
    const t = comment.trim();
    if (!t) return;
    add("newsComments", { id: genId("NC"), author: me, text: t, createdAt: new Date().toISOString() });
    setComment("");
  };

  const comments = [...newsComments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="page-enter">
      <PageHeader
        title="Daily Market"
        subtitle="Live commodity & market prices with an AI market take through the Rulethu lens — shared across the group and refreshed automatically."
        actions={
          <div className="flex items-center gap-2">
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
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>Desk comments</h3>
        <div className="flex gap-2 mb-4">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
            placeholder="Add your read on today's market…"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button onClick={postComment} className="rounded-md px-4 py-2 text-sm font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Post</button>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No comments yet — be the first to share your view with the desk.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: "var(--brand)" }}>
                  {c.author.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{c.author}</span> · {timeAgo(c.createdAt)}
                  </div>
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>{c.text}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
