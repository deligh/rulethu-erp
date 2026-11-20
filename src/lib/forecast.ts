// Gold price projection — a transparent, self-correcting trend model.
//
// We store a running series of live gold readings (store.goldSeries). From the
// latest real price (the anchor) we project forward with a geometric drift and a
// lognormal confidence band that widens with time. Drift and volatility are
// re-estimated from the stored series on every call, so the projection self-
// corrects as gold actually moves. This is a MODEL/SCENARIO, not a prediction —
// the UI must label it as such.

export type Horizon = "weekly" | "monthly" | "yearly";

export interface GoldPoint { t: string; price: number }       // a stored reading
export interface ProjPoint { t: string; mid: number; lo: number; hi: number }
export interface Forecast {
  anchor: number;              // latest real price (projection origin)
  anchorAt: string;            // ISO of the anchor
  driftAnnual: number;         // annualised drift used (fraction, e.g. 0.06)
  volAnnual: number;           // annualised volatility used (fraction)
  history: GoldPoint[];        // real readings (may be sparse / a single point)
  projection: ProjPoint[];     // from today to the cut date, at the chosen step
  endLabel: string;            // e.g. "Dec 2031"
  basedOn: number;             // number of real readings the estimate used
}

const YEAR_MS = 365.25 * 86_400_000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const BASE_DRIFT = 0.05;   // modest long-run assumption when we lack history
const DEF_VOL = 0.14;      // sensible default annualised gold vol
const CUT_YEAR = 2031;     // projection cut date (≈5 years out)

/** Estimate annualised drift & volatility from the stored series. Blends measured
 *  momentum with the base assumption, weighted by how much history we actually have. */
function estimate(series: GoldPoint[]): { drift: number; vol: number; n: number } {
  const pts = [...series].filter((p) => p.price > 0).sort((a, b) => a.t.localeCompare(b.t));
  if (pts.length < 3) return { drift: BASE_DRIFT, vol: DEF_VOL, n: pts.length };

  const first = pts[0], last = pts[pts.length - 1];
  const spanYears = Math.max(1e-6, (new Date(last.t).getTime() - new Date(first.t).getTime()) / YEAR_MS);
  const momentum = Math.log(last.price / first.price) / spanYears; // annualised

  // Per-step annualised log returns → volatility.
  const rets: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dtY = Math.max(1e-6, (new Date(pts[i].t).getTime() - new Date(pts[i - 1].t).getTime()) / YEAR_MS);
    rets.push(Math.log(pts[i].price / pts[i - 1].price) / Math.sqrt(dtY));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1);
  const vol = clamp(Math.sqrt(variance), 0.08, 0.35);

  // Weight measured momentum in as the series lengthens (full weight by ~6 months).
  const w = clamp(spanYears / 0.5, 0, 1);
  const drift = clamp(w * momentum + (1 - w) * BASE_DRIFT, -0.12, 0.20);
  return { drift, vol: Number.isFinite(vol) ? vol : DEF_VOL, n: pts.length };
}

function stepDates(from: Date, horizon: Horizon): Date[] {
  const end = new Date(CUT_YEAR, 11, 31);
  const out: Date[] = [];
  const d = new Date(from);
  let guard = 0;
  while (d <= end && guard++ < 600) {
    out.push(new Date(d));
    if (horizon === "weekly") d.setDate(d.getDate() + 7);
    else if (horizon === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  if (out[out.length - 1]?.getTime() !== end.getTime()) out.push(end);
  return out;
}

/** Build the projection from the stored series and the current anchor price. */
export function buildForecast(series: GoldPoint[], anchor: number, anchorAt: string, horizon: Horizon): Forecast {
  const { drift, vol, n } = estimate(series);
  const now = new Date(anchorAt && !isNaN(Date.parse(anchorAt)) ? anchorAt : Date.now());
  const projection: ProjPoint[] = stepDates(now, horizon).map((d) => {
    const y = Math.max(0, (d.getTime() - now.getTime()) / YEAR_MS);
    const mid = anchor * Math.exp(drift * y);
    const sigma = vol * Math.sqrt(y);
    return { t: d.toISOString(), mid, lo: anchor * Math.exp(drift * y - sigma), hi: anchor * Math.exp(drift * y + sigma) };
  });
  const history = [...series].filter((p) => p.price > 0).sort((a, b) => a.t.localeCompare(b.t)).slice(-60);
  return {
    anchor,
    anchorAt: now.toISOString(),
    driftAnnual: drift,
    volAnnual: vol,
    history,
    projection,
    endLabel: new Date(CUT_YEAR, 11, 31).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    basedOn: n,
  };
}
