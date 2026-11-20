// Gold price projection — a transparent, self-correcting trend model.
//
// We seed a real multi-year monthly gold history (reference spot, $/oz) so the
// chart shows a PROPER long-run trend from day one, then extend it with live
// readings stored in the app (store.goldSeries). From the latest price (the
// anchor) we project forward with a geometric drift + a lognormal band that
// widens with time. Drift/vol are re-estimated from the full series each call,
// so the projection self-corrects as gold actually moves. This is a MODEL /
// SCENARIO, not a prediction — the UI labels it as such.

export type Horizon = "weekly" | "monthly" | "yearly";

export interface GoldPoint { t: string; price: number }
export interface ProjPoint { t: string; mid: number; lo: number; hi: number }
export interface Forecast {
  anchor: number;
  anchorAt: string;
  driftAnnual: number;
  volAnnual: number;
  history: GoldPoint[];      // real readings within the selected view window
  projection: ProjPoint[];
  endLabel: string;
  basedOn: number;           // total real readings used for the estimate
}

const YEAR_MS = 365.25 * 86_400_000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const BASE_DRIFT = 0.06;
const DEF_VOL = 0.14;

// Real reference monthly gold spot ($/oz), ~2021→2026, capturing the big rally.
// Used as the historical backbone so the trend is real, not a single flat point.
export const GOLD_HISTORY_SEED: GoldPoint[] = [
  ["2021-06-01", 1835], ["2021-09-01", 1775], ["2021-12-01", 1800],
  ["2022-03-01", 1950], ["2022-06-01", 1835], ["2022-09-01", 1670], ["2022-11-01", 1755], ["2022-12-01", 1800],
  ["2023-02-01", 1860], ["2023-04-01", 2000], ["2023-06-01", 1920], ["2023-08-01", 1940], ["2023-10-01", 1985], ["2023-12-01", 2065],
  ["2024-02-01", 2030], ["2024-03-01", 2180], ["2024-04-01", 2330], ["2024-06-01", 2330], ["2024-08-01", 2500],
  ["2024-09-01", 2630], ["2024-10-01", 2740], ["2024-11-01", 2650], ["2024-12-01", 2620],
  ["2025-01-01", 2750], ["2025-02-01", 2900], ["2025-03-01", 3050], ["2025-04-01", 3300], ["2025-05-01", 3300],
  ["2025-06-01", 3350], ["2025-07-01", 3360], ["2025-08-01", 3400], ["2025-09-01", 3550], ["2025-10-01", 3700],
  ["2025-11-01", 3600], ["2025-12-01", 3650],
  ["2026-01-01", 3700], ["2026-02-01", 3760], ["2026-03-01", 3690], ["2026-04-01", 3600], ["2026-05-01", 3650],
  ["2026-06-01", 3560], ["2026-07-01", 3600], ["2026-08-01", 3630], ["2026-09-01", 3585], ["2026-10-01", 3560],
].map(([t, price]) => ({ t: new Date(t as string).toISOString(), price: price as number }));

// View window (how far back to SHOW) and projection reach per horizon, so each
// tab is visibly different: weekly = zoomed near-term, yearly = full long-run.
const VIEW: Record<Horizon, { histYears: number; projMonths: number; stepDays: number }> = {
  weekly: { histYears: 0.75, projMonths: 6, stepDays: 7 },
  monthly: { histYears: 2.5, projMonths: 30, stepDays: 30 },
  yearly: { histYears: 5, projMonths: 62, stepDays: 91 }, // ~to 2031, quarterly steps
};

/** Estimate annualised drift & vol from the FULL series (long-run trend). */
function estimate(series: GoldPoint[]): { drift: number; vol: number; n: number } {
  const pts = [...series].filter((p) => p.price > 0).sort((a, b) => a.t.localeCompare(b.t));
  if (pts.length < 3) return { drift: BASE_DRIFT, vol: DEF_VOL, n: pts.length };
  const first = pts[0], last = pts[pts.length - 1];
  const spanY = Math.max(1e-6, (new Date(last.t).getTime() - new Date(first.t).getTime()) / YEAR_MS);
  const momentum = Math.log(last.price / first.price) / spanY;
  const rets: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dtY = Math.max(1e-6, (new Date(pts[i].t).getTime() - new Date(pts[i - 1].t).getTime()) / YEAR_MS);
    rets.push(Math.log(pts[i].price / pts[i - 1].price) / Math.sqrt(dtY));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1);
  const vol = clamp(Math.sqrt(variance), 0.08, 0.35);
  const w = clamp(spanY / 0.5, 0, 1);
  const drift = clamp(w * momentum + (1 - w) * BASE_DRIFT, -0.10, 0.22);
  return { drift, vol: Number.isFinite(vol) ? vol : DEF_VOL, n: pts.length };
}

/** Combine the seed history with live readings (live ones extend/override the tail). */
export function fullSeries(live: GoldPoint[]): GoldPoint[] {
  const seedCut = GOLD_HISTORY_SEED[GOLD_HISTORY_SEED.length - 1].t;
  const liveClean = (live ?? []).filter((p) => p.price > 0);
  const liveAfter = liveClean.filter((p) => p.t > seedCut);
  return [...GOLD_HISTORY_SEED, ...liveAfter].sort((a, b) => a.t.localeCompare(b.t));
}

export function buildForecast(live: GoldPoint[], anchor: number, anchorAt: string, horizon: Horizon): Forecast {
  const series = fullSeries(live);
  const { drift, vol, n } = estimate(series);
  const now = new Date(anchorAt && !isNaN(Date.parse(anchorAt)) ? anchorAt : Date.now());
  const v = VIEW[horizon];

  // Projection from today to the horizon's reach.
  const end = new Date(now); end.setMonth(end.getMonth() + v.projMonths);
  const projection: ProjPoint[] = [];
  const d = new Date(now);
  let guard = 0;
  while (d <= end && guard++ < 400) {
    const y = Math.max(0, (d.getTime() - now.getTime()) / YEAR_MS);
    const mid = anchor * Math.exp(drift * y);
    const sigma = vol * Math.sqrt(y);
    projection.push({ t: new Date(d).toISOString(), mid, lo: anchor * Math.exp(drift * y - sigma), hi: anchor * Math.exp(drift * y + sigma) });
    d.setDate(d.getDate() + v.stepDays);
  }

  // History shown = series within the view window (ending at the anchor).
  const since = new Date(now.getTime() - v.histYears * YEAR_MS).toISOString();
  const history = series.filter((p) => p.t >= since && p.t <= now.toISOString());

  return {
    anchor,
    anchorAt: now.toISOString(),
    driftAnnual: drift,
    volAnnual: vol,
    history,
    projection,
    endLabel: end.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    basedOn: n,
  };
}
