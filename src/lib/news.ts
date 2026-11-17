// Rulethu AI — market news feed engine.
//
// Produces the shared "Daily Market" digest: live commodity/market prices and
// an AI market take through the Rulethu lens. Uses Claude with WEB SEARCH (via
// the secure proxy) to pull real current numbers; if the AI isn't available it
// returns a clearly-labelled demo snapshot so the page always renders.

import type { MarketSnapshot, MarketPrice, NewsSource } from "./store";

// How stale the shared digest may get before we auto-refresh on a page visit.
export const REFRESH_HOURS = 2;

export function isStale(snap: MarketSnapshot | null): boolean {
  if (!snap) return true;
  if (snap.demo) return true; // never let a demo snapshot stick — fetch real
  const age = Date.now() - new Date(snap.generatedAt).getTime();
  return age > REFRESH_HOURS * 3_600_000;
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
  '"commentary": string, "watch": [string, ...], "sources": [{"label": string, "url": string}]}\n' +
  "Include these prices in order: Gold (spot, $/oz), Platinum ($/oz), Brent Crude " +
  "($/bbl), Lithium carbonate (per tonne), ZSE All Share Index. " +
  "`value` is short (e.g. \"$2,655/oz\"). `change` is the day move (e.g. \"+1.2%\"). " +
  "`source` is a short label (e.g. \"Kitco\"). `insight` is ONE short clause on what " +
  "the move means for Rulethu (e.g. \"supports gold miner USD margins\"). " +
  "`sources` lists the pages you used with real URLs. Keep `commentary` UNDER 110 " +
  "words (2 short paragraphs) and `watch` to 4 short bullets. Output ONLY the JSON.";

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
    return {
      headline: String(obj.headline ?? "Market update"),
      prices,
      commentary: String(obj.commentary ?? ""),
      watch: Array.isArray(obj.watch) ? obj.watch.map((w: unknown) => String(w)).slice(0, 6) : [],
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

  try {
    const { askClaude } = await import("./aiClient");
    const text = await askClaude({
      system: MARKET_SYSTEM,
      prompt:
        "Produce today's Rulethu market brief now. Be efficient: do AT MOST 3 web " +
        "searches total — e.g. one for 'kitco gold platinum price', one for 'brent " +
        "crude price today', one for 'lithium carbonate price ZSE all share today'. " +
        "Capture all five prices (estimate with change 'n/a' only if truly " +
        "unavailable), then return ONLY the JSON object. Do not keep searching.",
      webSearch: true,
      searchMaxUses: 4,
      maxTokens: 3500,
      timeoutMs: 115_000,
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
    headline: "Market brief (demo) — connect live search for real-time prices",
    prices: [
      { name: "Gold (spot)", value: "$2,650/oz", change: "+0.6%", dir: "up" },
      { name: "Platinum", value: "$980/oz", change: "-0.3%", dir: "down" },
      { name: "Brent Crude", value: "$74/bbl", change: "+0.4%", dir: "up" },
      { name: "Lithium carbonate", value: "$10,800/t", change: "-1.1%", dir: "down" },
      { name: "ZSE All Share", value: "285.4", change: "+0.9%", dir: "up" },
    ],
    commentary:
      "This is an on-device demo of the market desk. Precious metals remain the " +
      "key read-through for Rulethu's gold and PGM exposure, while lithium softness " +
      "continues to pressure battery-metal economics. Once the live AI market desk " +
      "is running, this brief refreshes with real current prices and a fresh take.",
    watch: [
      "US rate path and the gold bid",
      "PGM demand and platinum basket pricing",
      "Lithium carbonate spot for off-take economics",
      "ZiG/USD and ZSE liquidity",
    ],
  };
}
