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

// Real monthly gold spot ($/oz), Jan 2015 → Oct 2026 (source: user-supplied
// goldprice.org monthly series). The true shape — the 2015-19 base, the 2020
// COVID move, the 2024-26 rally to the ~$5,020 peak (Feb 2026) and the 2026
// correction — so the chart and the fitted drift are grounded in real data.
// The live feed extends this with the current price as each reading arrives.
export const GOLD_HISTORY_SEED: GoldPoint[] = ([
  ["2015-01", 1251], ["2015-02", 1227], ["2015-03", 1179], ["2015-04", 1199], ["2015-05", 1199], ["2015-06", 1182], ["2015-07", 1128], ["2015-08", 1118], ["2015-09", 1125], ["2015-10", 1159], ["2015-11", 1086], ["2015-12", 1076],
  ["2016-01", 1098], ["2016-02", 1200], ["2016-03", 1245], ["2016-04", 1242], ["2016-05", 1261], ["2016-06", 1276], ["2016-07", 1337], ["2016-08", 1340], ["2016-09", 1327], ["2016-10", 1267], ["2016-11", 1238], ["2016-12", 1157],
  ["2017-01", 1192], ["2017-02", 1234], ["2017-03", 1231], ["2017-04", 1267], ["2017-05", 1246], ["2017-06", 1260], ["2017-07", 1237], ["2017-08", 1283], ["2017-09", 1314], ["2017-10", 1280], ["2017-11", 1282], ["2017-12", 1264],
  ["2018-01", 1331], ["2018-02", 1331], ["2018-03", 1325], ["2018-04", 1335], ["2018-05", 1303], ["2018-06", 1282], ["2018-07", 1238], ["2018-08", 1202], ["2018-09", 1198], ["2018-10", 1215], ["2018-11", 1221], ["2018-12", 1250],
  ["2019-01", 1292], ["2019-02", 1320], ["2019-03", 1301], ["2019-04", 1286], ["2019-05", 1284], ["2019-06", 1359], ["2019-07", 1413], ["2019-08", 1500], ["2019-09", 1511], ["2019-10", 1495], ["2019-11", 1471], ["2019-12", 1479],
  ["2020-01", 1561], ["2020-02", 1597], ["2020-03", 1592], ["2020-04", 1683], ["2020-05", 1716], ["2020-06", 1732], ["2020-07", 1847], ["2020-08", 1969], ["2020-09", 1922], ["2020-10", 1900], ["2020-11", 1866], ["2020-12", 1858],
  ["2021-01", 1867], ["2021-02", 1808], ["2021-03", 1718], ["2021-04", 1760], ["2021-05", 1850], ["2021-06", 1835], ["2021-07", 1808], ["2021-08", 1785], ["2021-09", 1775], ["2021-10", 1777], ["2021-11", 1822], ["2021-12", 1790],
  ["2022-01", 1816], ["2022-02", 1856], ["2022-03", 1948], ["2022-04", 1937], ["2022-05", 1849], ["2022-06", 1837], ["2022-07", 1733], ["2022-08", 1765], ["2022-09", 1681], ["2022-10", 1664], ["2022-11", 1725], ["2022-12", 1798],
  ["2023-01", 1898], ["2023-02", 1855], ["2023-03", 1913], ["2023-04", 2000], ["2023-05", 1992], ["2023-06", 1943], ["2023-07", 1951], ["2023-08", 1919], ["2023-09", 1916], ["2023-10", 1916], ["2023-11", 1984], ["2023-12", 2026],
  ["2024-01", 2034], ["2024-02", 2023], ["2024-03", 2158], ["2024-04", 2331], ["2024-05", 2351], ["2024-06", 2326], ["2024-07", 2398], ["2024-08", 2470], ["2024-09", 2571], ["2024-10", 2690], ["2024-11", 2651], ["2024-12", 2648],
  ["2025-01", 2710], ["2025-02", 2895], ["2025-03", 2983], ["2025-04", 3218], ["2025-05", 3309], ["2025-06", 3353], ["2025-07", 3340], ["2025-08", 3368], ["2025-09", 3668], ["2025-10", 4058], ["2025-11", 4087], ["2025-12", 4309],
  ["2026-01", 4753], ["2026-02", 5020], ["2026-03", 4856], ["2026-04", 4721], ["2026-05", 4587], ["2026-06", 4228], ["2026-07", 4073], ["2026-08", 4411], ["2026-09", 4319], ["2026-10", 4105],
] as [string, number][]).map(([m, price]) => ({ t: new Date(m + "-01").toISOString(), price }));

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
  const vol = clamp(Math.sqrt(variance), 0.08, 0.20);
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
