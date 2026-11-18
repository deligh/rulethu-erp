// In-house FCFF / DCF company valuation engine — mirrors a professional
// FCFF discounted-cash-flow model: assumptions -> 5-year projection -> terminal
// value -> PV -> equity bridge -> intrinsic value per share -> market verdict,
// with Bear/Base/Bull scenarios and a WACC x terminal-growth sensitivity grid.
// Template-driven: the same structure values any company; inputs can be typed,
// suggested by AI, or read from an uploaded financial model.

export interface FcffInputs {
  company: string;
  currency: string;         // reporting currency, e.g. "USD"
  valuationDate: string;    // e.g. "November 2026"
  baseYearLabel: string;    // e.g. "FY2025"
  // base-year financials
  baseRevenue: number;
  baseEbitMargin: number;   // 0..1
  // per projection-year drivers (length 5)
  revGrowth: number[];      // annual revenue growth
  ebitMargin: number[];     // EBIT margin each year
  // reinvestment drivers (fractions)
  capexPctRev: number;
  daPctRev: number;
  wcPctOfRevGrowth: number; // ΔWC as % of revenue increase
  // rates
  taxRate: number;
  riskFree: number;
  wacc: number;
  terminalWacc: number;
  terminalGrowth: number;
  terminalReinvestRate: number; // RIR, terminal reinvestment as % of NOPAT
  // bridge to equity
  cash: number;
  nonOpAssets: number;
  totalDebt: number;
  shares: number;
  rollForwardYears: number; // valuation date -> pricing date
  illiquidityDiscount: number; // 0..1
  midYear?: boolean;        // mid-year discounting convention (default true)
  // market comparison
  exchangeRate: number;     // reporting -> local (e.g. ZWG/USD); 1 if same
  lastTraded: number;       // local currency
  vwap: number;             // local currency
}

export interface FcffYear {
  label: string; growth: number; revenue: number; margin: number; ebit: number;
  nopat: number; capex: number; da: number; dWc: number; reinvest: number; fcff: number; pv: number;
}

export interface FcffResult {
  years: FcffYear[];
  terminal: { revenue: number; ebit: number; nopat: number; reinvest: number; fcff: number; tv: number; pvTv: number };
  pvOperating: number;
  equityValue: number;        // at balance-sheet date
  equityValuePriced: number;  // rolled forward to pricing date
  perShare: number;           // reporting currency
  perShareLocal: number;      // local currency (after illiquidity discount)
  premiumVsLast: number;
  premiumVsVwap: number;
  verdict: "UNDERVALUED" | "FAIRLY VALUED" | "OVERVALUED";
  bridge: { label: string; value: number }[];
  assumptions: { label: string; value: string }[];
}

const pctS = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const moneyS = (n: number) => `${Math.round(n).toLocaleString("en-US")}`;

export function computeFcff(i: FcffInputs): FcffResult {
  const N = i.revGrowth.length;
  const mid = i.midYear === false ? 0 : 0.5; // mid-year convention by default
  const years: FcffYear[] = [];
  let rev = i.baseRevenue;
  let pvOperating = 0;

  for (let y = 1; y <= N; y++) {
    const prevRev = rev;
    const growth = i.revGrowth[y - 1];
    rev = prevRev * (1 + growth);
    const margin = i.ebitMargin[y - 1];
    const ebit = rev * margin;
    const nopat = ebit * (1 - i.taxRate);
    const capex = i.capexPctRev * rev;
    const da = i.daPctRev * rev;
    const dWc = i.wcPctOfRevGrowth * (rev - prevRev);
    const reinvest = capex + dWc - da;
    const fcff = nopat - reinvest;
    const pv = fcff / Math.pow(1 + i.wacc, y - mid);
    pvOperating += pv;
    years.push({ label: `Year ${y}`, growth, revenue: rev, margin, ebit, nopat, capex, da, dWc, reinvest, fcff, pv });
  }

  // Terminal value (stable growth)
  const tRev = rev * (1 + i.terminalGrowth);
  const tMargin = i.ebitMargin[N - 1];
  const tEbit = tRev * tMargin;
  const tNopat = tEbit * (1 - i.taxRate);
  const tReinvest = tNopat * i.terminalReinvestRate;
  const tFcff = tNopat - tReinvest;
  const tv = i.terminalWacc > i.terminalGrowth ? tFcff / (i.terminalWacc - i.terminalGrowth) : 0;
  const pvTv = tv / Math.pow(1 + i.wacc, N - mid);
  pvOperating += pvTv;

  const equityValue = pvOperating + i.cash + i.nonOpAssets - i.totalDebt;
  const equityValuePriced = equityValue * Math.pow(1 + i.wacc, i.rollForwardYears);
  const perShareGross = i.shares > 0 ? equityValuePriced / i.shares : 0;
  const perShare = perShareGross * (1 - i.illiquidityDiscount);
  const perShareLocal = perShare * i.exchangeRate;
  const premiumVsLast = i.lastTraded > 0 ? perShareLocal / i.lastTraded - 1 : 0;
  const premiumVsVwap = i.vwap > 0 ? perShareLocal / i.vwap - 1 : 0;
  const ref = i.vwap > 0 ? i.vwap : i.lastTraded;
  const prem = ref > 0 ? perShareLocal / ref - 1 : 0;
  const verdict: FcffResult["verdict"] = prem > 0.15 ? "UNDERVALUED" : prem < -0.15 ? "OVERVALUED" : "FAIRLY VALUED";

  const bridge = [
    { label: "PV of operating assets", value: pvOperating },
    { label: "+ Cash & equivalents", value: i.cash },
    { label: "+ Non-operating assets", value: i.nonOpAssets },
    { label: "− Total debt (borrowings + leases)", value: -i.totalDebt },
    { label: "PV of equity (balance-sheet date)", value: equityValue },
    { label: "Equity value at pricing date", value: equityValuePriced },
  ];

  const assumptions = [
    { label: "Company", value: i.company },
    { label: "Valuation date", value: i.valuationDate },
    { label: "Base period", value: i.baseYearLabel },
    { label: "Currency", value: i.currency },
    { label: "Base revenue", value: moneyS(i.baseRevenue) },
    { label: "Base EBIT margin", value: pctS(i.baseEbitMargin) },
    { label: "Risk-free rate", value: pctS(i.riskFree) },
    { label: "WACC", value: pctS(i.wacc) },
    { label: "Terminal WACC", value: pctS(i.terminalWacc) },
    { label: "Terminal growth", value: pctS(i.terminalGrowth) },
    { label: "Marginal tax rate", value: pctS(i.taxRate, 0) },
    { label: "Capex % of revenue", value: pctS(i.capexPctRev) },
    { label: "D&A % of revenue", value: pctS(i.daPctRev) },
    { label: "ΔWC % of revenue growth", value: pctS(i.wcPctOfRevGrowth) },
    { label: "Terminal reinvestment (RIR)", value: pctS(i.terminalReinvestRate, 0) },
    { label: "Cash & equivalents", value: moneyS(i.cash) },
    { label: "Non-operating assets", value: moneyS(i.nonOpAssets) },
    { label: "Total debt", value: moneyS(i.totalDebt) },
    { label: "Shares outstanding", value: moneyS(i.shares) },
    { label: "Roll-forward (years)", value: i.rollForwardYears.toFixed(3) },
    { label: "Illiquidity discount", value: pctS(i.illiquidityDiscount, 0) },
  ];

  return {
    years,
    terminal: { revenue: tRev, ebit: tEbit, nopat: tNopat, reinvest: tReinvest, fcff: tFcff, tv, pvTv },
    pvOperating, equityValue, equityValuePriced, perShare, perShareLocal,
    premiumVsLast, premiumVsVwap, verdict, bridge, assumptions,
  };
}

/* ---------------- scenarios ---------------- */
export type ScenarioKey = "bear" | "base" | "bull";
export function scenarioInputs(base: FcffInputs, key: ScenarioKey): FcffInputs {
  if (key === "base") return base;
  const gMul = key === "bear" ? 0.5 : 1.5;
  const mDelta = key === "bear" ? -0.015 : 0.01;
  return {
    ...base,
    revGrowth: base.revGrowth.map((g) => Math.max(0, g * gMul)),
    ebitMargin: base.ebitMargin.map((m) => Math.max(0, m + mDelta)),
  };
}

export function scenarioTable(base: FcffInputs): { key: ScenarioKey; label: string; perShareLocal: number; verdict: string }[] {
  return (["bear", "base", "bull"] as ScenarioKey[]).map((k) => {
    const r = computeFcff(scenarioInputs(base, k));
    return { key: k, label: k === "bear" ? "Bear" : k === "base" ? "Base" : "Bull", perShareLocal: r.perShareLocal, verdict: r.verdict };
  });
}

/* ---------------- sensitivity: WACC x terminal growth ---------------- */
export interface Sensitivity { waccs: number[]; growths: number[]; grid: number[][] } // perShareLocal
export function fcffSensitivity(base: FcffInputs): Sensitivity {
  const waccs = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => base.wacc + d);
  const growths = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => base.terminalGrowth + d);
  const grid = waccs.map((w) =>
    growths.map((g) => computeFcff({ ...base, wacc: w, terminalWacc: w, terminalGrowth: g }).perShareLocal)
  );
  return { waccs, growths, grid };
}

/* ---------------- sample (Proplastics-style) ---------------- */
export const FCFF_SAMPLE: FcffInputs = {
  company: "Proplastics Limited",
  currency: "USD",
  valuationDate: "November 2026",
  baseYearLabel: "FY2025",
  baseRevenue: 22_782_000,
  baseEbitMargin: 0.10,
  revGrowth: [0.143, 0.06, 0.05, 0.04, 0.035],
  ebitMargin: [0.091, 0.093, 0.095, 0.096, 0.097],
  capexPctRev: 0.053,
  daPctRev: 0.053,
  wcPctOfRevGrowth: 0.18,
  taxRate: 0.29,
  riskFree: 0.05,
  wacc: 0.168,
  terminalWacc: 0.168,
  terminalGrowth: 0.03,
  terminalReinvestRate: 0.20,
  cash: 545_348,
  nonOpAssets: 32_748,
  totalDebt: 1_274_240,
  shares: 259_866_270,
  rollForwardYears: 0.334,
  illiquidityDiscount: 0,
  exchangeRate: 26.571,
  lastTraded: 1.15,
  vwap: 1.21,
};
