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

/** Turn a live metal into a MarketPrice row, computing the move vs the previous
 *  stored reading of the same metal (honest "move since the desk last checked",
 *  never presented as an official daily close). */
function toRow(m: LiveMetal, prev: MarketPrice[] | undefined): MarketPrice {
  const was = prev?.find((p) => keyOf(p.name) === keyOf(m.name) && typeof p.raw === "number");
  let change: string | undefined;
  let dir: MarketPrice["dir"] = "flat";
  if (was && typeof was.raw === "number" && was.raw > 0) {
    const pct = ((m.price - was.raw) / was.raw) * 100;
    if (Math.abs(pct) >= 0.05) {
      dir = pct > 0 ? "up" : "down";
      change = `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
    }
  }
  return {
    name: m.name,
    value: fmtUsd(m.price) + m.unit,
    change,
    dir,
    source: "gold-api.com · live",
    insight: "Live spot price — updates on its own, no AI needed.",
    raw: m.price,
    live: true,
    at: m.updatedAt,
  };
}

/** Overlay live metals onto a snapshot's prices: live rows replace any matching
 *  AI rows (by metal) and lead the list; non-metal AI rows (Brent, lithium, ZSE)
 *  follow in their original order. `prevPrices` supplies the baseline for moves. */
export function mergeLiveMetals(
  aiPrices: MarketPrice[],
  metals: LiveMetal[],
  prevPrices: MarketPrice[] | undefined,
): MarketPrice[] {
  if (!metals.length) return aiPrices;
  const liveKeys = new Set(metals.map((m) => keyOf(m.name)));
  const liveRows = metals.map((m) => toRow(m, prevPrices));
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
  return {
    ...base,
    demo: false,
    headline: "Live metals updated — Gold, Platinum & Palladium are current",
    prices,
    commentary:
      "Gold, platinum and palladium above are **live** from gold-api.com, refreshed just now. " +
      "The full AI market brief (Brent, lithium, ZSE and today's stories) couldn't be generated this time — " +
      "press “Refresh now” to retry it — but the headline metals are current regardless.",
    watch: keepWatch,
    stories: keepStories ?? [],
    sources: [{ label: "gold-api.com (live metals)", url: "https://gold-api.com" }],
  };
}
