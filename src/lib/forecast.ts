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

// Real monthly gold spot ($/oz), Jun 2004 → Oct 2026 (source: user-supplied
// 15-minute XAU series downsampled to month-end closes, 2004-2026, plus the
// 2026 Feb-Oct tail from the monthly goldprice series). The true 22-year shape
// — the 2000s bull, the 2011 peak (~$1,825), the 2013-15 bear, the 2019-20
// COVID rally, and the 2024-26 surge to the ~$5,020 peak and its correction —
// so the chart and the fitted drift are grounded in real, long-run data.
// The live feed extends this with the current price as each reading arrives.
export const GOLD_HISTORY_SEED: GoldPoint[] = ([
  ["2004-06",393], ["2004-07",390], ["2004-08",409], ["2004-09",418], ["2004-10",428], ["2004-11",450], ["2004-12",437], ["2005-01",422],
  ["2005-02",435], ["2005-03",428], ["2005-04",434], ["2005-05",417], ["2005-06",434], ["2005-07",429], ["2005-08",435], ["2005-09",469],
  ["2005-10",465], ["2005-11",498], ["2005-12",515], ["2006-01",569], ["2006-02",562], ["2006-03",584], ["2006-04",654], ["2006-05",643],
  ["2006-06",615], ["2006-07",636], ["2006-08",625], ["2006-09",598], ["2006-10",606], ["2006-11",647], ["2006-12",636], ["2007-01",653],
  ["2007-02",669], ["2007-03",663], ["2007-04",678], ["2007-05",660], ["2007-06",649], ["2007-07",664], ["2007-08",673], ["2007-09",743],
  ["2007-10",796], ["2007-11",783], ["2007-12",832], ["2008-01",924], ["2008-02",974], ["2008-03",916], ["2008-04",877], ["2008-05",886],
  ["2008-06",925], ["2008-07",913], ["2008-08",831], ["2008-09",871], ["2008-10",724], ["2008-11",816], ["2008-12",867], ["2009-01",926],
  ["2009-02",942], ["2009-03",917], ["2009-04",886], ["2009-05",979], ["2009-06",926], ["2009-07",954], ["2009-08",951], ["2009-09",1007],
  ["2009-10",1045], ["2009-11",1179], ["2009-12",1098], ["2010-01",1081], ["2010-02",1117], ["2010-03",1113], ["2010-04",1179], ["2010-05",1216],
  ["2010-06",1242], ["2010-07",1181], ["2010-08",1247], ["2010-09",1308], ["2010-10",1359], ["2010-11",1386], ["2010-12",1408], ["2011-01",1332],
  ["2011-02",1411], ["2011-03",1432], ["2011-04",1563], ["2011-05",1536], ["2011-06",1500], ["2011-07",1626], ["2011-08",1825], ["2011-09",1624],
  ["2011-10",1714], ["2011-11",1746], ["2011-12",1564], ["2012-01",1738], ["2012-02",1696], ["2012-03",1667], ["2012-04",1664], ["2012-05",1561],
  ["2012-06",1597], ["2012-07",1614], ["2012-08",1691], ["2012-09",1772], ["2012-10",1720], ["2012-11",1714], ["2012-12",1675], ["2013-01",1663],
  ["2013-02",1580], ["2013-03",1596], ["2013-04",1477], ["2013-05",1388], ["2013-06",1235], ["2013-07",1325], ["2013-08",1395], ["2013-09",1329],
  ["2013-10",1323], ["2013-11",1253], ["2013-12",1208], ["2014-01",1244], ["2014-02",1326], ["2014-03",1284], ["2014-04",1291], ["2014-05",1249],
  ["2014-06",1327], ["2014-07",1283], ["2014-08",1287], ["2014-09",1208], ["2014-10",1172], ["2014-11",1166], ["2014-12",1187], ["2015-01",1284],
  ["2015-02",1213], ["2015-03",1184], ["2015-04",1184], ["2015-05",1190], ["2015-06",1172], ["2015-07",1095], ["2015-08",1135], ["2015-09",1114],
  ["2015-10",1142], ["2015-11",1064], ["2015-12",1061], ["2016-01",1118], ["2016-02",1238], ["2016-03",1232], ["2016-04",1294], ["2016-05",1215],
  ["2016-06",1322], ["2016-07",1351], ["2016-08",1309], ["2016-09",1316], ["2016-10",1277], ["2016-11",1173], ["2016-12",1151], ["2017-01",1210],
  ["2017-02",1248], ["2017-03",1249], ["2017-04",1268], ["2017-05",1269], ["2017-06",1241], ["2017-07",1269], ["2017-08",1321], ["2017-09",1279],
  ["2017-10",1271], ["2017-11",1275], ["2017-12",1302], ["2018-01",1345], ["2018-02",1318], ["2018-03",1325], ["2018-04",1315], ["2018-05",1298],
  ["2018-06",1253], ["2018-07",1224], ["2018-08",1201], ["2018-09",1192], ["2018-10",1214], ["2018-11",1222], ["2018-12",1279], ["2019-01",1321],
  ["2019-02",1313], ["2019-03",1292], ["2019-04",1283], ["2019-05",1305], ["2019-06",1410], ["2019-07",1412], ["2019-08",1521], ["2019-09",1472],
  ["2019-10",1512], ["2019-11",1464], ["2019-12",1520], ["2020-01",1589], ["2020-02",1585], ["2020-03",1577], ["2020-04",1686], ["2020-05",1730],
  ["2020-06",1781], ["2020-07",1975], ["2020-08",1968], ["2020-09",1885], ["2020-10",1878], ["2020-11",1778], ["2020-12",1893], ["2021-01",1848],
  ["2021-02",1734], ["2021-03",1708], ["2021-04",1769], ["2021-05",1907], ["2021-06",1770], ["2021-07",1814], ["2021-08",1814], ["2021-09",1757],
  ["2021-10",1783], ["2021-11",1774], ["2021-12",1828], ["2022-01",1797], ["2022-02",1908], ["2022-03",1937], ["2022-04",1896], ["2022-05",1838],
  ["2022-06",1807], ["2022-07",1766], ["2022-08",1711], ["2022-09",1661], ["2022-10",1634], ["2022-11",1768], ["2022-12",1824], ["2023-01",1928],
  ["2023-02",1826], ["2023-03",1969], ["2023-04",1990], ["2023-05",1963], ["2023-06",1919], ["2023-07",1966], ["2023-08",1940], ["2023-09",1849],
  ["2023-10",1984], ["2023-11",2036], ["2023-12",2063], ["2024-01",2039], ["2024-02",2044], ["2024-03",2233], ["2024-04",2286], ["2024-05",2327],
  ["2024-06",2326], ["2024-07",2447], ["2024-08",2503], ["2024-09",2635], ["2024-10",2744], ["2024-11",2650], ["2024-12",2625], ["2025-01",2798],
  ["2025-02",2859], ["2025-03",3124], ["2025-04",3288], ["2025-05",3289], ["2025-06",3303], ["2025-07",3291], ["2025-08",3448], ["2025-09",3643],
  ["2025-10",4002], ["2025-11",4219], ["2025-12",4318], ["2026-01",4889],
  ["2026-02",5020], ["2026-03",4856], ["2026-04",4721], ["2026-05",4587], ["2026-06",4228], ["2026-07",4073], ["2026-08",4411], ["2026-09",4319], ["2026-10",4105],
] as [string, number][]).map(([m, price]) => ({ t: new Date(m + "-01").toISOString(), price }));

// View window (how far back to SHOW) and projection reach per horizon, so each
// tab is visibly different: weekly = zoomed near-term, yearly = full long-run.
const VIEW: Record<Horizon, { histYears: number; projMonths: number; stepDays: number }> = {
  weekly: { histYears: 0.75, projMonths: 6, stepDays: 7 },
  monthly: { histYears: 3, projMonths: 30, stepDays: 30 },
  yearly: { histYears: 25, projMonths: 62, stepDays: 91 }, // full history (2004+) → ~2031, quarterly steps
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
