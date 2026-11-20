// Live commodity prices — free, no-key, browser-callable feed.
//
// The AI market desk (news.ts) relies on web_fetch of Kitco / oilprice / ZSE,
// which those sites routinely block — so the headline metals used to freeze on
// the last brief. This module pulls the metals that matter most to Rulethu
// (gold + PGMs) straight from gold-api.com: a free, no-API-key, CORS-open feed
// (`Access-Control-Allow-Origin: *`) that returns live spot prices timestamped
// to the second. It costs nothing to call and does not touch the AI quota, so
// the prices now update on their own even when the AI brief can't reach a page.
//
// No free, key-less, CORS-open feed exists for Brent, lithium carbonate or the
// ZSE All Share — those stay with the AI brief (best-effort, clearly sourced).

import type { MarketPrice, MarketSnapshot } from "./store";

const GOLD_API = "https://api.gold-api.com/price/";

// Metals we pull live, in display order. Symbols are gold-api.com's.
const LIVE_METALS: { symbol: string; name: string; unit: string }[] = [
  { symbol: "XAU", name: "Gold (spot, $/oz)", unit: "/oz" },
  { symbol: "XPT", name: "Platinum ($/oz)", unit: "/oz" },
  { symbol: "XPD", name: "Palladium ($/oz)", unit: "/oz" },
];

export interface LiveMetal {
  symbol: string;
  name: string;
  unit: string;
  price: number;
  updatedAt: string; // ISO from the feed
}

function fmtUsd(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Fetch one metal's live spot price. Returns null on any failure (never throws). */
async function fetchOne(m: { symbol: string; name: string; unit: string }): Promise<LiveMetal | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(GOLD_API + m.symbol, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    const price = typeof j?.price === "number" ? j.price : NaN;
    if (!Number.isFinite(price) || price <= 0) return null;
    return { symbol: m.symbol, name: m.name, unit: m.unit, price, updatedAt: String(j.updatedAt ?? new Date().toISOString()) };
  } catch {
    return null;
  }
}

/** Fetch all live metals in parallel. Returns only the ones that succeeded. */
export async function fetchLiveMetals(): Promise<LiveMetal[]> {
  const out = await Promise.all(LIVE_METALS.map(fetchOne));
  return out.filter((x): x is LiveMetal => x != null);
}

// Match a stored price row to a live metal by the leading word (gold/platinum/palladium).
function keyOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, " ").trim().split(" ")[0];
}

// A one-line, Rulethu-flavoured plain-language note for a given % move, used only
// as a quiet fallback when no AI read is available yet (never techy "no AI" text).
function fallbackNote(name: string, dir: MarketPrice["dir"]): string | undefined {
  if (dir === "flat") return undefined;
  const k = keyOf(name);
  const up = dir === "up";
  if (k === "gold") return up ? "Firmer gold lifts our bullion-linked positions." : "Softer gold trims margins on marginal ounces.";
  if (k === "platinum" || k === "palladium") return up ? "Stronger PGMs help the platinum/palladium basket." : "Weaker PGMs pressure basket pricing.";
  return undefined;
}

const dirOfPct = (pct: number): MarketPrice["dir"] => (pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat");

// Move since the desk last read this metal (honest, not an official daily close).
function tickMove(m: LiveMetal, prev: MarketPrice[] | undefined): { change?: string; dir: MarketPrice["dir"] } {
  const was = prev?.find((p) => keyOf(p.name) === keyOf(m.name) && typeof p.raw === "number");
  if (was && typeof was.raw === "number" && was.raw > 0) {
    const pct = ((m.price - was.raw) / was.raw) * 100;
    if (Math.abs(pct) >= 0.05) return { change: `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`, dir: pct > 0 ? "up" : "down" };
  }
  return { dir: "flat" };
}

/** Turn a live metal into a MarketPrice row.
 *  - fromAi=true: `ai` is a fresh AI-brief row; take its real day-change + insight
 *    (marked aiNote) so the tile shows the AI's read on the live level.
 *  - fromAi=false (cheap refresh): carry a prior AI-authored read ONLY if the prior
 *    row was itself aiNote; otherwise show the tick-move + a short plain note. This
 *    stops any stale/generic text being copied forward forever. */
function toRow(m: LiveMetal, prev: MarketPrice[] | undefined, ai: MarketPrice | undefined, fromAi: boolean): MarketPrice {
  let change: string | undefined;
  let dir: MarketPrice["dir"] = "flat";
  let insight: string | undefined;
  let aiNote = false;

  const aiChange = ai?.change?.trim();
  const hasAiChange = !!aiChange && !/n\/?a|—|^-$/i.test(aiChange);
  const takeAi = fromAi ? !!ai : !!ai?.aiNote; // only carry a genuine AI read

  if (takeAi && ai) {
    if (hasAiChange) {
      change = aiChange;
      const n = parseFloat(aiChange!.replace(/[^0-9.+-]/g, ""));
      dir = ai.dir ?? (Number.isFinite(n) ? dirOfPct(n) : "flat");
    } else {
      ({ change, dir } = tickMove(m, prev));
    }
    insight = ai.insight?.trim() || fallbackNote(m.name, dir);
    aiNote = !!ai.insight?.trim();
  } else {
    ({ change, dir } = tickMove(m, prev));
    insight = fallbackNote(m.name, dir);
    aiNote = false;
  }

  return { name: m.name, value: fmtUsd(m.price) + m.unit, change, dir, source: "gold-api.com", insight, raw: m.price, live: true, at: m.updatedAt, aiNote };
}

/** Overlay live metals onto a snapshot's prices: live rows replace any matching
 *  AI rows (by metal) and lead the list; non-metal AI rows (Brent, lithium, ZSE)
 *  follow in their original order. `fromAi` is true only for a fresh AI brief. */
export function mergeLiveMetals(
  aiPrices: MarketPrice[],
  metals: LiveMetal[],
  prevPrices: MarketPrice[] | undefined,
  fromAi = false,
): MarketPrice[] {
  if (!metals.length) return aiPrices;
  const liveKeys = new Set(metals.map((m) => keyOf(m.name)));
  const liveRows = metals.map((m) => toRow(m, prevPrices, aiPrices.find((p) => keyOf(p.name) === keyOf(m.name)), fromAi));
  const rest = aiPrices.filter((p) => !liveKeys.has(keyOf(p.name)));
  return [...liveRows, ...rest];
}

/** Build a prices-only snapshot from live metals alone — used when the AI brief
 *  is unavailable, so the headline metals still refresh and the snapshot counts
 *  as real (not demo) and is kept rather than discarded. */
export function metalsOnlySnapshot(
  base: MarketSnapshot,
  metals: LiveMetal[],
  prev: MarketSnapshot | null,
): MarketSnapshot {
  const prices = mergeLiveMetals([], metals, prev?.prices);
  // Preserve the last real commentary / stories for the non-metal items so the
  // page isn't blanked — but make clear the metals are the live part.
  const keepStories = prev && !prev.demo ? prev.stories : [];
  const keepWatch = prev && !prev.demo && prev.watch?.length
    ? prev.watch
    : ["US rate path and the gold bid", "PGM demand and the platinum/palladium basket", "Lithium carbonate spot for off-take economics", "ZiG/USD and ZSE liquidity"];
  // A clean, factual line from the real live levels — no self-referential plumbing.
  const byKey = (k: string) => metals.find((m) => keyOf(m.name) === k);
  const g = byKey("gold"), p = byKey("platinum"), pd = byKey("palladium");
  const lead = [
    g ? `Gold is trading around ${fmtUsd(g.price)}/oz` : "",
    p ? `platinum near ${fmtUsd(p.price)}/oz` : "",
    pd ? `palladium near ${fmtUsd(pd.price)}/oz` : "",
  ].filter(Boolean).join(", ");
  return {
    ...base,
    demo: false,
    headline: g ? `Gold around ${fmtUsd(g.price)}/oz — live metals updated` : "Live metals updated",
    prices,
    commentary:
      (lead ? lead + ". " : "") +
      "These live spot levels drive Rulethu's mining earnings, export receipts and the pricing of our gold and PGM positions, and feed through to ZiG/USD liquidity. " +
      "Brent, lithium and the ZSE refresh with the next full brief.",
    watch: keepWatch,
    stories: keepStories ?? [],
    sources: [{ label: "gold-api.com (live metals)", url: "https://gold-api.com" }],
  };
}
