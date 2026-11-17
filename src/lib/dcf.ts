// Full company DCF valuation — WACC via CAPM, unlevered FCF build,
// terminal value (perpetuity + exit multiple), EV → equity → per share, sensitivity.

import { compact } from "./format";
import { ModelResult, KpiOut } from "./finmodels";

const money = (v: number) => compact(v, "USD");
const pct = (v: number, d = 1) => (isFinite(v) ? `${(v * 100).toFixed(d)}%` : "—");
const per = (v: number) => (isFinite(v) ? `$${v.toFixed(2)}` : "—");

export interface DCFInputs {
  revenue0: number;
  years: number;
  growthStart: number; // yr1 revenue growth
  ebitMargin: number;
  taxRate: number;
  daPct: number; // D&A % of revenue
  capexPct: number; // capex % of revenue
  nwcPct: number; // ΔNWC % of revenue change
  riskFree: number;
  erp: number; // equity risk premium
  beta: number;
  costOfDebt: number; // pre-tax
  debtWeight: number; // target debt / (debt+equity)
  terminalGrowth: number;
  exitMultiple: number; // EV/EBITDA
  useExitMultiple: boolean;
  netDebt: number;
  shares: number;
}

export interface DCFResult extends ModelResult {
  wacc: number; costOfEquity: number;
  sumPvFcf: number; tvPerp: number; tvExit: number; pvTV: number;
  ev: number; equity: number; perShare: number; ebitdaTerminal: number;
  sensitivity: { waccs: number[]; growths: number[]; grid: number[][] };
}

function core(i: DCFInputs) {
  const costOfEquity = i.riskFree + i.beta * i.erp;
  const wacc = costOfEquity * (1 - i.debtWeight) + i.costOfDebt * (1 - i.taxRate) * i.debtWeight;
  const N = Math.max(1, Math.round(i.years));
  const rows: { rev: number; ebit: number; tax: number; da: number; capex: number; dnwc: number; ufcf: number; df: number; pv: number }[] = [];
  let prevRev = i.revenue0;
  for (let y = 1; y <= N; y++) {
    const g = N > 1 ? i.growthStart + (i.terminalGrowth - i.growthStart) * ((y - 1) / (N - 1)) : i.growthStart;
    const rev = prevRev * (1 + g);
    const ebit = rev * i.ebitMargin;
    const tax = Math.max(0, ebit * i.taxRate);
    const da = rev * i.daPct;
    const capex = rev * i.capexPct;
    const dnwc = (rev - prevRev) * i.nwcPct;
    const ufcf = ebit - tax + da - capex - dnwc;
    const df = 1 / Math.pow(1 + wacc, y);
    rows.push({ rev, ebit, tax, da, capex, dnwc, ufcf, df, pv: ufcf * df });
    prevRev = rev;
  }
  const last = rows[N - 1];
  const ebitdaTerminal = last.ebit + last.da;
  const tvPerp = wacc > i.terminalGrowth ? (last.ufcf * (1 + i.terminalGrowth)) / (wacc - i.terminalGrowth) : 0;
  const tvExit = ebitdaTerminal * i.exitMultiple;
  const tv = i.useExitMultiple ? tvExit : tvPerp;
  const pvTV = tv / Math.pow(1 + wacc, N);
  const sumPvFcf = rows.reduce((s, r) => s + r.pv, 0);
  const ev = sumPvFcf + pvTV;
  const equity = ev - i.netDebt;
  const perShare = i.shares > 0 ? equity / i.shares : NaN;
  return { costOfEquity, wacc, rows, ebitdaTerminal, tvPerp, tvExit, pvTV, sumPvFcf, ev, equity, perShare, N };
}

export function computeDCF(i: DCFInputs): DCFResult {
  const c = core(i);
  const cols = ["", ...c.rows.map((_, k) => `Y${k + 1}`)];
  const line = (label: string, vals: number[], strong = false, paren = false) => ({ label, cells: ["", ...vals.map((v) => (paren && v !== 0 ? "(" + money(v) + ")" : money(v)))], strong });

  const kpis: KpiOut[] = [
    { label: "Enterprise value", value: money(c.ev), tone: "pos" },
    { label: "Equity value", value: money(c.equity), tone: c.equity >= 0 ? "pos" : "neg" },
    { label: "Value / share", value: per(c.perShare), tone: "pos" },
    { label: "WACC", value: pct(c.wacc), hint: `Ke ${pct(c.costOfEquity, 0)}` },
    { label: "Implied EV/EBITDA", value: c.ebitdaTerminal ? (c.ev / c.ebitdaTerminal).toFixed(1) + "x" : "—" },
    { label: "PV of terminal", value: c.ev ? pct(c.pvTV / c.ev, 0) + " of EV" : "—" },
  ];
  const rows = [
    line("Revenue", c.rows.map((r) => r.rev), true),
    line("EBIT", c.rows.map((r) => r.ebit)),
    line("Less: tax", c.rows.map((r) => r.tax), false, true),
    line("Add: D&A", c.rows.map((r) => r.da)),
    line("Less: capex", c.rows.map((r) => r.capex), false, true),
    line("Less: ΔNWC", c.rows.map((r) => r.dnwc), false, true),
    line("Unlevered FCF", c.rows.map((r) => r.ufcf), true),
    { label: "Discount factor", cells: ["", ...c.rows.map((r) => r.df.toFixed(3))] },
    line("PV of FCF", c.rows.map((r) => r.pv), true),
  ];

  // sensitivity: WACC × terminal growth → value per share
  const waccs = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => c.wacc + d);
  const growths = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => i.terminalGrowth + d);
  const grid = waccs.map((w) =>
    growths.map((g) => {
      // recompute equity/share with overridden wacc & growth
      const ii = { ...i };
      const rows2: number[] = [];
      let prevRev = ii.revenue0; let lastUfcf = 0, lastEbitda = 0;
      for (let y = 1; y <= c.N; y++) {
        const gr = c.N > 1 ? ii.growthStart + (g - ii.growthStart) * ((y - 1) / (c.N - 1)) : ii.growthStart;
        const rev = prevRev * (1 + gr);
        const ebit = rev * ii.ebitMargin; const tax = Math.max(0, ebit * ii.taxRate);
        const da = rev * ii.daPct; const capex = rev * ii.capexPct; const dnwc = (rev - prevRev) * ii.nwcPct;
        const ufcf = ebit - tax + da - capex - dnwc;
        rows2.push(ufcf / Math.pow(1 + w, y)); lastUfcf = ufcf; lastEbitda = ebit + da; prevRev = rev;
      }
      const tv = ii.useExitMultiple ? lastEbitda * ii.exitMultiple : (w > g ? (lastUfcf * (1 + g)) / (w - g) : 0);
      const ev = rows2.reduce((s, x) => s + x, 0) + tv / Math.pow(1 + w, c.N);
      const eq = ev - ii.netDebt;
      return ii.shares > 0 ? eq / ii.shares : NaN;
    }),
  );

  return {
    kpis, columns: cols, rows, bars: c.rows.map((r, k) => ({ label: `Y${k + 1}`, value: r.ufcf })),
    wacc: c.wacc, costOfEquity: c.costOfEquity, sumPvFcf: c.sumPvFcf, tvPerp: c.tvPerp, tvExit: c.tvExit,
    pvTV: c.pvTV, ev: c.ev, equity: c.equity, perShare: c.perShare, ebitdaTerminal: c.ebitdaTerminal,
    sensitivity: { waccs, growths, grid },
  };
}

export const DCF_SAMPLE: DCFInputs = {
  revenue0: 20_000_000, years: 5, growthStart: 0.15, ebitMargin: 0.22, taxRate: 0.25,
  daPct: 0.05, capexPct: 0.06, nwcPct: 0.10,
  riskFree: 0.05, erp: 0.065, beta: 1.1, costOfDebt: 0.14, debtWeight: 0.35,
  terminalGrowth: 0.03, exitMultiple: 7, useExitMultiple: false, netDebt: 8_000_000, shares: 10_000_000,
};
