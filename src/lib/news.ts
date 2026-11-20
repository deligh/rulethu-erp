// Rulethu AI — market news feed engine.
//
// Produces the shared "Daily Market" digest: live commodity/market prices and
// an AI market take through the Rulethu lens. Uses Claude with WEB SEARCH (via
// the secure proxy) to pull real current numbers; if the AI isn't available it
// returns a clearly-labelled demo snapshot so the page always renders.

import type { MarketSnapshot, MarketPrice, NewsSource, NewsStory } from "./store";

// How stale the shared digest may get before we auto-refresh — the whole brief
// (prices + commentary) regenerates on this cadence. "Refresh now" always forces.
export const REFRESH_HOURS = 3;

const ageHours = (snap: MarketSnapshot) => (Date.now() - new Date(snap.generatedAt).getTime()) / 3_600_000;

/** Display helper — is this brief old / demo (for the badge). */
export function isStale(snap: MarketSnapshot | null): boolean {
  if (!snap) return true;
  if (snap.demo) return true;
  return ageHours(snap) > REFRESH_HOURS;
}

/** Auto-refresh trigger — fires ONLY when there is nothing cached or the cached
 *  brief is genuinely older than the cadence. A cached brief (even a demo) is
 *  shown as-is on login instead of re-fetching every time. */
export function needsRefresh(snap: MarketSnapshot | null): boolean {
  if (!snap) return true;
  return ageHours(snap) > REFRESH_HOURS;
}

// Why the last fetch fell back to demo (precise diagnostic for the page).
let lastDigestReason: string | null = null;
export function lastMarketReason(): string | null {
  return lastDigestReason;
}

const MARKET_SYSTEM =
  "You are Rulethu AI's market desk for Rulethu Holdings, an African investment " +
  "group in Harare, Zimbabwe (interests in mining — gold, platinum/PGMs, lithium " +
  "— power/solar, private equity and ZSE/VFEX equities). Use web search to find " +
  "the LATEST, ACCURATE prices and day moves, then write a tight daily brief for " +
  "the group's investment team, with a Zimbabwe / SADC lens and USD framing.\n" +
  "SOURCING — accuracy matters, cite where each number came from. Gold, Platinum and " +
  "Palladium are supplied to you LIVE from our own feed — use those exact levels. For the " +
  "other commodities (Brent crude, white maize, wheat, urea/fertiliser) and the ZSE All Share, " +
  "a web_search for the current price is sufficient — take the figure from the search results; " +
  "a page fetch is not required. Only state a price you actually found; if you cannot find a " +
  "real current/recent figure for an item, OMIT that price row rather than guessing or marking it 'Not retrieved'.\n" +
  "Return ONLY a single JSON object — no prose, no code fences — EXACTLY:\n" +
  '{"headline": string, "prices": [{"name": string, "value": string, "change": string, ' +
  '"dir": "up"|"down"|"flat", "source": string, "insight": string}], ' +
  '"commentary": string, "watch": [string, ...], ' +
  '"stories": [{"title": string, "category": "Commodities"|"Macro"|"Africa & SADC"|"Equities"|"Energy"|"FX", ' +
  '"summary": string, "detail": string, "impact": "up"|"down"|"watch", "takeaway": string}], ' +
  '"sources": [{"label": string, "url": string}]}\n' +
  "Include a Gold, Platinum and Palladium row (live levels), then add the commodities you " +
  "could actually price today from: Brent Crude ($/bbl), White maize ($/tonne), Wheat ($/tonne), " +
  "Urea/fertiliser ($/tonne), and the ZSE All Share Index. Omit any you could not price. " +
  "`value` is short (e.g. \"$2,655/oz\"). `change` is the day move (e.g. \"+1.2%\"). " +
  "`source` is a short label (e.g. \"Kitco\"). `insight` is ONE short clause on what " +
  "the move means for Rulethu. " +
  "`stories` is the heart of the brief and a LEARNING HUB — write 6 to 8 punchy, current, genuinely interesting items spanning three areas: " +
  "(a) COMMODITIES / metals / energy that matter to Rulethu (2-3); " +
  "(b) MACRO & MARKETS — US rates & dollar, Africa & SADC, Zimbabwe (ZiG/USD, ZSE/VFEX), global equities (1-2); " +
  "(c) TECHNOLOGY & AI — the latest notable global tech/AI developments AND, importantly, AI & technology GAPS and OPPORTUNITIES in Africa " +
  "(fintech, mobile money, data centres, connectivity, AI adoption, startups, policy) (2-3). " +
  "Use varied `category` labels: Commodities, Energy, Macro, Africa & SADC, Equities, Technology, AI. " +
  "Each story: `title` is a sharp headline (<9 words); `summary` is one vivid teaser line; `detail` is 2-3 sentences " +
  "with the actual facts/numbers; `takeaway` is one line on what it means for Rulethu. Make them genuinely interesting and the LATEST you can find. " +
  "`sources` lists the pages you used with real URLs. Keep `commentary` UNDER 90 words (2 short paragraphs) and `watch` to 4 short bullets. Output ONLY the JSON.";

/** Parse the model's JSON, tolerating stray fences/text around it. */
function parseDigest(text: string): Partial<MarketSnapshot> | null {
  try {
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    const obj = JSON.parse(t);
    const prices: MarketPrice[] = Array.isArray(obj.prices)
      ? obj.prices.map((p: Record<string, unknown>) => ({
          name: String(p.name ?? ""),
          value: String(p.value ?? ""),
          change: p.change != null ? String(p.change) : undefined,
          dir: p.dir === "up" || p.dir === "down" ? p.dir : "flat",
          source: p.source != null ? String(p.source) : undefined,
          insight: p.insight != null ? String(p.insight) : undefined,
        })).filter((p: MarketPrice) => p.name && p.value && !/^(—|-|n\/?a|not retrieved|unavailable|tbd)\.?$/i.test(p.value.trim()))
      : [];
    const sources: NewsSource[] = Array.isArray(obj.sources)
      ? obj.sources
          .map((s: Record<string, unknown>) => ({ label: String(s.label ?? ""), url: String(s.url ?? "") }))
          .filter((s: NewsSource) => s.label && s.url)
          .slice(0, 8)
      : [];
    const stories: NewsStory[] = Array.isArray(obj.stories)
      ? obj.stories.map((s: Record<string, unknown>) => ({
          title: String(s.title ?? ""),
          category: String(s.category ?? "Markets"),
          summary: String(s.summary ?? ""),
          detail: String(s.detail ?? ""),
          impact: s.impact === "up" || s.impact === "down" ? s.impact : "watch",
          takeaway: s.takeaway != null ? String(s.takeaway) : undefined,
        })).filter((s: NewsStory) => s.title && s.detail).slice(0, 8)
      : [];
    return {
      headline: String(obj.headline ?? "Market update"),
      prices,
      commentary: String(obj.commentary ?? ""),
      watch: Array.isArray(obj.watch) ? obj.watch.map((w: unknown) => String(w)).slice(0, 6) : [],
      stories,
      sources,
    };
  } catch {
    return null;
  }
}

/** Build the live digest (or a demo one). Caller stores it to the shared feed.
 *  `prev` is the previously-stored snapshot — used to compute honest price moves
 *  for the live metals and to preserve commentary if the AI brief is unavailable. */
export async function fetchMarketDigest(prev?: MarketSnapshot | null): Promise<MarketSnapshot> {
  const now = new Date();
  const base: MarketSnapshot = {
    date: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    prices: [],
    headline: "",
    commentary: "",
    watch: [],
  };

  const nowStr = now.toLocaleString("en-GB", { timeZone: "Africa/Harare", weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const todayStr = now.toLocaleDateString("en-GB", { timeZone: "Africa/Harare", day: "2-digit", month: "long", year: "numeric" });

  // Live metals (gold/PGMs) — free, no-key, no AI quota. Fetched FIRST so we can
  // feed the real current levels into the brief: the AI then comments on these
  // actual numbers and their moves, rather than guessing its own prices.
  const { fetchLiveMetals, mergeLiveMetals, metalsOnlySnapshot } = await import("./prices");
  const metals = await fetchLiveMetals();
  const liveLine = metals.length
    ? metals.map((m) => `${m.name} ≈ $${Math.round(m.price)}`).join(", ")
    : "";

  try {
    const { askClaude } = await import("./aiClient");
    const text = await askClaude({
      system: MARKET_SYSTEM,
      prompt:
        `RIGHT NOW it is ${nowStr} Central Africa Time (UTC+2). TODAY is ${todayStr}. Produce TODAY's Rulethu market brief.\n` +
        (liveLine
          ? `LIVE PRICES FROM OUR OWN DATA (current spot, treat as authoritative — do NOT re-fetch or restate a different level): ${liveLine}.\n` +
            "For Gold, Platinum and Palladium, use EXACTLY these levels in your `value`, and ADD for each: the day's % change in `change` " +
            "(web_search the day move if you need it) and a one-line Rulethu `insight` on what THAT move means for us. " +
            "Your `headline`, `commentary`, `watch` items and `stories` must be grounded in these actual levels and their recent movements — comment on what is really happening to our metals.\n"
          : "") +
        "OTHER PRICES — add these using web_search (a page fetch is NOT required — take the current number straight from the search results). " +
        "ONLY include a row when you find a real current or very recent figure. If you cannot price an item, simply OMIT that row entirely — " +
        "NEVER output a 'Not retrieved', '—' or 'n/a'-value placeholder row:\n" +
        "• Brent Crude ($/bbl) — search \"Brent crude price today\" (it is widely quoted; do not mark it unavailable).\n" +
        "• White maize ($/tonne) — Zimbabwe's staple; search the current SAFEX white maize or regional maize price.\n" +
        "• Wheat ($/tonne) — search the current wheat price.\n" +
        "• Urea / fertiliser ($/tonne) — search the current urea fertiliser price.\n" +
        "• ZSE All Share Index — search the latest value/close from zse.co.zw or african-markets.com; set `change` to the day move, or 'n/a' only if just a prior close is available.\n" +
        "Give each real row a short `change`, a `source`, and a one-line Rulethu `insight`. Aim for 5–7 REAL price rows total " +
        "(the three live metals plus whatever of the above you can actually price today). Order: Gold, Platinum, Palladium, then the rest.\n" +
        "NEWS — then do up to 3 web_search calls for today's headlines to write the `stories` (markets AND technology/AI, including AI & tech in Africa).\n" +
        "Return ONLY the JSON object.",
      webFetch: true,
      fetchMaxUses: 3,
      webSearch: true,
      searchMaxUses: 6,
      maxTokens: 7500,
      timeoutMs: 125_000,
    });
    if (!text) {
      const { aiLastError } = await import("./aiClient");
      lastDigestReason = aiLastError() ?? "No response from the market desk.";
    } else {
      const parsed = parseDigest(text);
      if (parsed && parsed.prices && parsed.prices.length) {
        lastDigestReason = null;
        const snap = { ...base, ...parsed } as MarketSnapshot;
        snap.editionId = snap.generatedAt; // stable id for this full edition (history)
        snap.prices = mergeLiveMetals(snap.prices, metals, prev?.prices, true);
        if (metals.length) snap.sources = [{ label: "gold-api.com (live metals)", url: "https://gold-api.com" }, ...(snap.sources ?? [])];
        return snap;
      }
      lastDigestReason = parsed
        ? `The AI replied but found no prices (reply ${text.length} chars). The web tools may have returned nothing today.`
        : `The AI reply could not be read as a brief (likely truncated; ${text.length} chars). Try Refresh again.`;
    }
    // AI brief failed — but if the live metals came through, still return a REAL
    // snapshot (kept, not discarded) so the headline prices refresh regardless.
    if (metals.length) {
      return metalsOnlySnapshot(base, metals, prev ?? null);
    }
  } catch (e) {
    lastDigestReason = `Market desk error: ${String((e as Error)?.message ?? e)}`;
    if (metals.length) return metalsOnlySnapshot(base, metals, prev ?? null);
  }
  return demoDigest(base);
}

/** Lightweight, AI-free refresh of just the live metals, merged onto an existing
 *  snapshot. Cheap enough to call on open/focus/interval; never returns demo. */
export async function refreshLiveMetals(prev: MarketSnapshot | null): Promise<MarketSnapshot | null> {
  const { fetchLiveMetals, mergeLiveMetals, metalsOnlySnapshot } = await import("./prices");
  const metals = await fetchLiveMetals();
  if (!metals.length) return null;
  const now = new Date();
  const base: MarketSnapshot = { date: now.toISOString().slice(0, 10), generatedAt: now.toISOString(), prices: [], headline: "", commentary: "", watch: [] };
  // A FULL AI brief (has stories) keeps its headline/commentary — only the metal
  // prices tick. A thin/metals-only brief is rebuilt so its wording reflects the
  // current live levels instead of carrying stale text forward.
  if (prev && !prev.demo && prev.stories && prev.stories.length > 0) {
    return { ...prev, generatedAt: now.toISOString(), prices: mergeLiveMetals(prev.prices, metals, prev.prices) };
  }
  return metalsOnlySnapshot(base, metals, prev ?? null);
}

/** Clearly-labelled fallback so the feed always shows something sensible. */
function demoDigest(base: MarketSnapshot): MarketSnapshot {
  return {
    ...base,
    demo: true,
    headline: "Live prices unavailable right now — these are NOT real figures",
    prices: [
      { name: "Gold (spot)", value: "—", dir: "flat", insight: "live fetch unavailable — press Refresh" },
      { name: "Platinum", value: "—", dir: "flat", insight: "live fetch unavailable" },
      { name: "Brent Crude", value: "—", dir: "flat", insight: "live fetch unavailable" },
      { name: "Lithium carbonate", value: "—", dir: "flat", insight: "live fetch unavailable" },
      { name: "ZSE All Share", value: "—", dir: "flat", insight: "live fetch unavailable" },
    ],
    commentary:
      "The live market desk could not retrieve prices just now, so no figures are shown — " +
      "nothing here is a real quote. This usually means the AI function needs redeploying " +
      "(to enable direct price fetching) or the web tools hit a limit. Press \"Refresh now\" to try again. " +
      "The themes below are standing watch-items, not today's confirmed data.",
    watch: [
      "US rate path and the gold bid",
      "PGM demand and platinum basket pricing",
      "Lithium carbonate spot for off-take economics",
      "ZiG/USD and ZSE liquidity",
    ],
    // No stories in offline mode — we don't present undated items as today's news.
    stories: [],
  };
}
