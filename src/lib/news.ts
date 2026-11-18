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

const MARKET_SYSTEM =
  "You are Rulethu AI's market desk for Rulethu Holdings, an African investment " +
  "group in Harare, Zimbabwe (interests in mining — gold, platinum/PGMs, lithium " +
  "— power/solar, private equity and ZSE/VFEX equities). Use web search to find " +
  "the LATEST, ACCURATE prices and day moves, then write a tight daily brief for " +
  "the group's investment team, with a Zimbabwe / SADC lens and USD framing.\n" +
  "SOURCING — accuracy matters, cite where each number came from:\n" +
  "• Gold, Silver, Platinum, Palladium → use KITCO (kitco.com, e.g. " +
  "kitco.com/charts/gold) as the primary source.\n" +
  "• Brent Crude → Kitco or oilprice.com.\n" +
  "• Lithium carbonate → Trading Economics or SMM (shanghai metals market).\n" +
  "• ZSE All Share Index → zse.co.zw or african-markets.com; if no live figure, " +
  "give the last confirmed close and set change to \"n/a\".\n" +
  "Prefer these sources; do not state a price you did not actually find — if " +
  "genuinely unavailable, give your best recent estimate and set change \"n/a\".\n" +
  "Return ONLY a single JSON object — no prose, no code fences — EXACTLY:\n" +
  '{"headline": string, "prices": [{"name": string, "value": string, "change": string, ' +
  '"dir": "up"|"down"|"flat", "source": string, "insight": string}], ' +
  '"commentary": string, "watch": [string, ...], ' +
  '"stories": [{"title": string, "category": "Commodities"|"Macro"|"Africa & SADC"|"Equities"|"Energy"|"FX", ' +
  '"summary": string, "detail": string, "impact": "up"|"down"|"watch", "takeaway": string}], ' +
  '"sources": [{"label": string, "url": string}]}\n' +
  "Include these prices in order: Gold (spot, $/oz), Platinum ($/oz), Brent Crude " +
  "($/bbl), Lithium carbonate (per tonne), ZSE All Share Index. " +
  "`value` is short (e.g. \"$2,655/oz\"). `change` is the day move (e.g. \"+1.2%\"). " +
  "`source` is a short label (e.g. \"Kitco\"). `insight` is ONE short clause on what " +
  "the move means for Rulethu. " +
  "`stories` is the heart of the brief — write 6 to 7 punchy, current news items for today: " +
  "at least 3 on COMMODITIES/metals/energy that matter to Rulethu, and the rest on the OTHER side — " +
  "macro (US rates, dollar, inflation), Africa & SADC markets, Zimbabwe (ZiG/USD, ZSE/VFEX), and global equities. " +
  "Each story: `title` is a sharp headline (<9 words); `summary` is one vivid teaser line; `detail` is 2-4 sentences " +
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
        })).filter((p: MarketPrice) => p.name && p.value)
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

/** Build the live digest (or a demo one). Caller stores it to the shared feed. */
export async function fetchMarketDigest(): Promise<MarketSnapshot> {
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

  try {
    const { askClaude } = await import("./aiClient");
    const text = await askClaude({
      system: MARKET_SYSTEM,
      prompt:
        `RIGHT NOW it is ${nowStr} Central Africa Time (UTC+2). TODAY is ${todayStr}. Produce TODAY's Rulethu market brief with the LATEST real prices.\n` +
        "PRICES — use the web_fetch tool to read these exact pages directly (do NOT rely on open web search for prices):\n" +
        "• Gold spot ($/oz): fetch https://goldprice.org/ (or https://www.kitco.com/charts/gold)\n" +
        "• Platinum ($/oz): fetch https://www.kitco.com/charts/platinum\n" +
        "• Brent Crude ($/bbl): fetch https://oilprice.com/\n" +
        "• Lithium carbonate (per tonne): fetch https://tradingeconomics.com/commodity/lithium\n" +
        "• ZSE All Share Index: fetch https://www.zse.co.zw/ (or https://www.african-markets.com/en/stock-markets/zse)\n" +
        "Read the current number from each page. Only if a fetch genuinely returns nothing, use web_search as a fallback for that one item; " +
        "if still unavailable, give your best recent figure and set `change` to 'n/a' — but DO fetch first, do not skip to estimates.\n" +
        "NEWS — then do up to 2 web_search calls for today's market & Africa/SADC headlines to write the `stories`.\n" +
        "Return ONLY the JSON object once you have the prices.",
      webFetch: true,
      fetchMaxUses: 6,
      webSearch: true,
      searchMaxUses: 3,
      maxTokens: 4500,
      timeoutMs: 125_000,
    });
    const parsed = text ? parseDigest(text) : null;
    if (parsed && parsed.prices && parsed.prices.length) {
      return { ...base, ...parsed } as MarketSnapshot;
    }
  } catch {
    /* fall through to demo */
  }
  return demoDigest(base);
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
