// Financial model engines — shared math (NPV, IRR, PMT, payback) and one
// compute function per model type. Each returns a render-ready ModelResult.

import { compact } from "./format";

/* ----------------------------- shared math ----------------------------- */

export function npv(rate: number, cfs: number[]): number {
  return cfs.reduce((s, c, i) => s + c / Math.pow(1 + rate, i), 0);
}

export function irr(cfs: number[]): number {
  const f = (r: number) => cfs.reduce((s, c, i) => s + c / Math.pow(1 + r, i), 0);
  let lo = -0.99, hi = 10, flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) return NaN;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

export function pmt(rate: number, nper: number, pv: number): number {
  if (nper <= 0) return 0;
  if (rate === 0) return pv / nper;
  return (pv * rate) / (1 - Math.pow(1 + rate, -nper));
}

export function paybackYears(cfs: number[]): number {
  let cum = 0;
  for (let i = 0; i < cfs.length; i++) {
    const prev = cum; cum += cfs[i];
    if (cum >= 0 && cfs[i] > 0) return i - 1 + (-prev) / cfs[i];
  }
  return NaN;
}

const pct = (v: number, d = 1) => (isFinite(v) ? `${(v * 100).toFixed(d)}%` : "—");
const money = (v: number) => compact(v, "USD");
const num = (v: number, d = 1) => (isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—");

/* ----------------------------- result shape ---------------------------- */

export interface KpiOut { label: string; value: string; hint?: string; tone?: "pos" | "neg" | "neutral" }
export interface RowOut { label: string; cells: string[]; strong?: boolean; section?: boolean }
export interface ModelResult {
  kpis: KpiOut[];
  columns: string[];
  rows: RowOut[];
  bars: { label: string; value: number }[];
  note?: string;
}

/* ===================== 1. PROJECT FINANCE (solar / plant) ============== */

export interface ProjectFinanceInputs {
  energy: boolean; // true = solar (adds LCOE, degradation); false = plant
  unit: string; // "MWh" or "tons" / "bricks"
  capex: number;
  operatingYears: number;
  annualOutput: number; // units/yr at full run
  utilizationPct: number; // 0..1
  degradationPct: number; // annual, solar
  pricePerUnit: number;
  priceEscalationPct: number;
  variableCostPerUnit: number;
  fixedOpex: number;
  opexEscalationPct: number;
  depreciationYears: number;
  debtPct: number;
  interestRate: number;
  debtTenorYears: number;
  taxRate: number;
  discountRate: number;
  terminalGrowthPct: number;
}

export function computeProjectFinance(i: ProjectFinanceInputs): ModelResult {
  const N = Math.max(1, Math.round(i.operatingYears));
  const debt = i.capex * i.debtPct;
  const equity = i.capex - debt;
  const inst = pmt(i.interestRate, i.debtTenorYears, debt);

  const cols = ["Year 0"];
  const outputR: number[] = [0], revR: number[] = [0], opexR: number[] = [0], ebitdaR: number[] = [0];
  const depR: number[] = [0], intR: number[] = [0], taxR: number[] = [0], niR: number[] = [0];
  const dsR: number[] = [0], dscrR: number[] = [NaN], pfcf: number[] = [-i.capex], efcf: number[] = [-equity];
  let bal = debt;
  let pvOutput = 0, pvCost = 0;

  for (let y = 1; y <= N; y++) {
    cols.push(`Y${y}`);
    const output = i.annualOutput * i.utilizationPct * Math.pow(1 - i.degradationPct, y - 1);
    const price = i.pricePerUnit * Math.pow(1 + i.priceEscalationPct, y - 1);
    const revenue = output * price;
    const varCost = i.variableCostPerUnit * output;
    const fixed = i.fixedOpex * Math.pow(1 + i.opexEscalationPct, y - 1);
    const opex = varCost + fixed;
    const ebitda = revenue - opex;
    const dep = y <= i.depreciationYears ? i.capex / i.depreciationYears : 0;
    const interest = y <= i.debtTenorYears ? bal * i.interestRate : 0;
    const principal = y <= i.debtTenorYears ? inst - interest : 0;
    bal = Math.max(0, bal - principal);
    const ebit = ebitda - dep;
    const taxable = ebit - interest;
    const tax = Math.max(0, taxable * i.taxRate);
    const ni = taxable - tax;
    const cfads = ebitda - tax;
    const debtService = interest + principal;
    const dscr = debtService > 0 ? cfads / debtService : NaN;
    outputR.push(output); revR.push(revenue); opexR.push(opex); ebitdaR.push(ebitda);
    depR.push(dep); intR.push(interest); taxR.push(tax); niR.push(ni);
    dsR.push(debtService); dscrR.push(dscr);
    pfcf.push(ebitda - tax);
    efcf.push(ebitda - tax - debtService);
    const df = Math.pow(1 + i.discountRate, y);
    pvOutput += output / df;
    pvCost += (opex + tax) / df;
  }
  // terminal value on last-year unlevered FCF
  const g = i.terminalGrowthPct;
  const tv = i.discountRate > g ? (pfcf[N] * (1 + g)) / (i.discountRate - g) : 0;
  const pfcfT = [...pfcf]; pfcfT[N] += tv;
  const efcfT = [...efcf]; efcfT[N] += tv;

  const projIRR = irr(pfcfT);
  const eqIRR = irr(efcfT);
  const projNPV = npv(i.discountRate, pfcfT);
  const pb = paybackYears(pfcf);
  const dscrVals = dscrR.filter((d) => isFinite(d));
  const minDSCR = dscrVals.length ? Math.min(...dscrVals) : NaN;
  const lcoe = pvOutput > 0 ? (i.capex + pvCost) / pvOutput : NaN;
  const y1margin = revR[1] ? ebitdaR[1] / revR[1] : NaN;

  const kpis: KpiOut[] = [
    { label: "Project IRR", value: pct(projIRR), tone: projIRR >= i.discountRate ? "pos" : "neg", hint: `vs WACC ${pct(i.discountRate, 0)}` },
    { label: "Equity IRR", value: pct(eqIRR), tone: "pos" },
    { label: "Project NPV", value: money(projNPV), tone: projNPV >= 0 ? "pos" : "neg" },
    { label: "Payback", value: isFinite(pb) ? `${pb.toFixed(1)} yrs` : "—" },
    { label: "Min DSCR", value: isFinite(minDSCR) ? `${minDSCR.toFixed(2)}x` : "—", tone: minDSCR >= 1.2 ? "pos" : "neg" },
    i.energy
      ? { label: "LCOE", value: isFinite(lcoe) ? `$${(i.unit === "MWh" ? lcoe / 1000 : lcoe).toFixed(3)}/${i.unit === "MWh" ? "kWh" : i.unit}` : "—" }
      : { label: "EBITDA margin", value: pct(y1margin, 0) },
  ];

  const rows: RowOut[] = [
    { label: `Output (${i.unit})`, cells: outputR.map((v, idx) => (idx === 0 ? "—" : num(v, 0))) },
    { label: "Revenue", cells: revR.map((v, idx) => (idx === 0 ? "—" : money(v))) },
    { label: "Operating cost", cells: opexR.map((v, idx) => (idx === 0 ? "—" : "(" + money(v) + ")")) },
    { label: "EBITDA", cells: ebitdaR.map((v, idx) => (idx === 0 ? "—" : money(v))), strong: true },
    { label: "Depreciation", cells: depR.map((v, idx) => (idx === 0 ? "—" : "(" + money(v) + ")")) },
    { label: "Interest", cells: intR.map((v, idx) => (idx === 0 ? "—" : "(" + money(v) + ")")) },
    { label: "Tax", cells: taxR.map((v, idx) => (idx === 0 ? "—" : "(" + money(v) + ")")) },
    { label: "Net income", cells: niR.map((v, idx) => (idx === 0 ? "—" : money(v))), strong: true },
    { label: "Debt service", cells: dsR.map((v, idx) => (idx === 0 ? "—" : money(v))) },
    { label: "DSCR", cells: dscrR.map((v) => (isFinite(v) ? v.toFixed(2) + "x" : "—")) },
    { label: "Project FCF", cells: pfcf.map((v) => money(v)), strong: true },
    { label: "Equity FCF", cells: efcf.map((v) => money(v)) },
  ];

  return { kpis, columns: cols, rows, bars: pfcf.map((v, idx) => ({ label: `Y${idx}`, value: v })) };
}

/* ===================== 2. AGRI-OUTGROWER (blueberry) ================== */

export interface AgriInputs {
  hectares: number;
  plantsPerHa: number;
  yieldRamp: number[]; // kg/plant per year
  packOut: number;
  exportPrice: number;
  localPrice: number;
  exportShare: number;
  establishmentPerPlant: number;
  growingInfraPerHa: number;
  packhouse: number;
  runningPerPlant: number;
  runningPerKg: number;
  fixedAnnual: number;
  depLifeYears: number;
  wcPctOfRevenue: number;
  ke: number;
  kd: number;
  debtShare: number;
  taxRate: number;
  terminalGrowthPct: number;
}

export function computeAgri(i: AgriInputs): ModelResult {
  const plants = i.hectares * i.plantsPerHa;
  const capex = plants * i.establishmentPerPlant + i.hectares * i.growingInfraPerHa + i.packhouse;
  const wacc = i.ke * (1 - i.debtShare) + i.kd * (1 - i.taxRate) * i.debtShare;
  const dep = capex / i.depLifeYears;
  const N = i.yieldRamp.length;

  const cols = ["Year 0"];
  const volR: number[] = [0], revR: number[] = [0], opexR: number[] = [0], ebitdaR: number[] = [0];
  const taxR: number[] = [0], fcf: number[] = [-capex], cum: number[] = [];
  let prevWC = 0;
  // initial WC at year 0
  const fcf0WC = 0;
  fcf[0] = -capex - fcf0WC;

  let ebitdaLast = 0, volLast = 0, revLast = 0;
  for (let y = 1; y <= N; y++) {
    cols.push(`Y${y}`);
    const vol = plants * i.yieldRamp[y - 1] * i.packOut;
    const revenue = vol * (i.exportShare * i.exportPrice + (1 - i.exportShare) * i.localPrice);
    const opex = plants * i.runningPerPlant + vol * i.runningPerKg + i.fixedAnnual;
    const ebitda = revenue - opex;
    const ebit = ebitda - dep;
    const tax = Math.max(0, ebit * i.taxRate);
    const nopat = ebit - tax;
    const wc = i.wcPctOfRevenue * revenue;
    const dWC = wc - prevWC; prevWC = wc;
    const cf = nopat + dep - dWC;
    volR.push(vol); revR.push(revenue); opexR.push(opex); ebitdaR.push(ebitda); taxR.push(tax);
    fcf.push(cf);
    ebitdaLast = ebitda; volLast = vol; revLast = revenue;
  }
  const g = i.terminalGrowthPct;
  const tv = wacc > g ? (fcf[N] * (1 + g)) / (wacc - g) : 0;
  const fcfT = [...fcf]; fcfT[N] += tv;
  let run = 0; for (const c of fcf) { run += c; cum.push(run); }

  const projNPV = npv(wacc, fcfT);
  const projIRR = irr(fcfT);
  const pb = paybackYears(fcf);
  const ev = npv(wacc, fcf.map((v, idx) => (idx === 0 ? 0 : v))) + tv / Math.pow(1 + wacc, N);
  const netDebt = capex * i.debtShare;
  const equityVal = ev - netDebt;
  const perKgRev = volLast ? revLast / volLast : NaN;
  const perKgEbitda = volLast ? ebitdaLast / volLast : NaN;

  const kpis: KpiOut[] = [
    { label: "NPV @ WACC", value: money(projNPV), tone: projNPV >= 0 ? "pos" : "neg", hint: `WACC ${pct(wacc, 0)}` },
    { label: "IRR", value: pct(projIRR), tone: projIRR >= wacc ? "pos" : "neg" },
    { label: "Payback", value: isFinite(pb) ? `${pb.toFixed(1)} yrs` : "—" },
    { label: "Enterprise value", value: money(ev) },
    { label: "Equity value", value: money(equityVal) },
    { label: "EBITDA / kg", value: isFinite(perKgEbitda) ? `$${perKgEbitda.toFixed(2)}` : "—", hint: `rev $${isFinite(perKgRev) ? perKgRev.toFixed(2) : "—"}/kg` },
  ];
  const rows: RowOut[] = [
    { label: "Volume (kg)", cells: volR.map((v, idx) => (idx === 0 ? "—" : num(v, 0))) },
    { label: "Revenue", cells: revR.map((v, idx) => (idx === 0 ? "—" : money(v))) },
    { label: "Operating cost", cells: opexR.map((v, idx) => (idx === 0 ? "—" : "(" + money(v) + ")")) },
    { label: "EBITDA", cells: ebitdaR.map((v, idx) => (idx === 0 ? "—" : money(v))), strong: true },
    { label: "Tax", cells: taxR.map((v, idx) => (idx === 0 ? "—" : "(" + money(v) + ")")) },
    { label: "Free cash flow", cells: fcf.map((v) => money(v)), strong: true },
    { label: "Cumulative", cells: cum.map((v) => money(v)) },
  ];
  return { kpis, columns: cols, rows, bars: fcf.map((v, idx) => ({ label: `Y${idx}`, value: v })), note: `Capex ${money(capex)} · ${num(plants, 0)} plants over ${i.hectares} ha` };
}

/* ===================== 3. LENDING / MICROFINANCE ====================== */

export interface LendingInputs {
  openingBook: number;
  bookGrowthPct: number;
  portfolioYield: number;
  fundingShare: number;
  costOfFunds: number;
  opexRatio: number; // of interest income
  lossRate: number; // provisions, % of book
  taxRate: number;
  years: number;
  equity: number;
  ke: number;
  kd: number;
  debtShare: number;
  terminalGrowthPct: number;
  exitEbitdaMultiple: number;
  netDebt: number;
}

export function computeLending(i: LendingInputs): ModelResult {
  const N = Math.max(1, Math.round(i.years));
  const wacc = i.ke * (1 - i.debtShare) + i.kd * (1 - i.taxRate) * i.debtShare;
  const cols: string[] = [];
  const bookR: number[] = [], iiR: number[] = [], fcR: number[] = [], provR: number[] = [], opexR: number[] = [], pbtR: number[] = [], taxR: number[] = [], niR: number[] = [], ebitdaR: number[] = [];
  let openBook = i.openingBook;
  for (let y = 1; y <= N; y++) {
    cols.push(`Y${y}`);
    const closeBook = openBook * (1 + i.bookGrowthPct);
    const avgBook = (openBook + closeBook) / 2;
    const ii = avgBook * i.portfolioYield;
    const fc = avgBook * i.fundingShare * i.costOfFunds;
    const prov = closeBook * i.lossRate;
    const opex = ii * i.opexRatio;
    const pbt = ii - fc - prov - opex;
    const tax = Math.max(0, pbt * i.taxRate);
    const ni = pbt - tax;
    const ebitda = ii - fc - opex; // pre-provision operating profit
    bookR.push(closeBook); iiR.push(ii); fcR.push(fc); provR.push(prov); opexR.push(opex); pbtR.push(pbt); taxR.push(tax); niR.push(ni); ebitdaR.push(ebitda);
    openBook = closeBook;
  }
  const g = i.terminalGrowthPct;
  const tvPerp = wacc > g ? (niR[N - 1] * (1 + g)) / (wacc - g) : 0;
  const tvMult = ebitdaR[N - 1] * i.exitEbitdaMultiple;
  const pvNi = niR.reduce((s, ni, idx) => s + ni / Math.pow(1 + wacc, idx + 1), 0);
  const evPerp = pvNi + tvPerp / Math.pow(1 + wacc, N);
  const evMult = pvNi + tvMult / Math.pow(1 + wacc, N);
  const equityPerp = evPerp - i.netDebt;
  const roe = i.equity ? niR[0] / i.equity : NaN;

  const kpis: KpiOut[] = [
    { label: "NPV (5-yr NI)", value: money(pvNi), tone: "pos", hint: `WACC ${pct(wacc, 0)}` },
    { label: "EV (perpetuity)", value: money(evPerp) },
    { label: "EV (EBITDA mult.)", value: money(evMult), hint: `${i.exitEbitdaMultiple.toFixed(1)}x exit` },
    { label: "Equity value", value: money(equityPerp), tone: "pos" },
    { label: "ROE (Yr 1)", value: pct(roe, 0), tone: roe >= 0.2 ? "pos" : "neutral" },
    { label: "Loan book (Yr " + N + ")", value: money(bookR[N - 1]) },
  ];
  const rows: RowOut[] = [
    { label: "Loan book (close)", cells: bookR.map((v) => money(v)), strong: true },
    { label: "Interest income", cells: iiR.map((v) => money(v)) },
    { label: "Funding cost", cells: fcR.map((v) => "(" + money(v) + ")") },
    { label: "Provisions", cells: provR.map((v) => "(" + money(v) + ")") },
    { label: "Operating cost", cells: opexR.map((v) => "(" + money(v) + ")") },
    { label: "PBT", cells: pbtR.map((v) => money(v)), strong: true },
    { label: "Tax", cells: taxR.map((v) => "(" + money(v) + ")") },
    { label: "Net income", cells: niR.map((v) => money(v)), strong: true },
  ];
  return { kpis, columns: cols, rows, bars: niR.map((v, idx) => ({ label: `Y${idx + 1}`, value: v })) };
}

/* ===================== 4. OPERATING COMPANY (multi-line) ============== */

export interface OpcoLine {
  name: string;
  year1Revenue: number;
  growthPct: number;
  netMarginPct: number;
  startYear: number;
  initialInvestment: number;
}
export interface OpcoInputs {
  lines: OpcoLine[];
  years: number;
  taxRate: number;
  discountRate: number;
  terminalGrowthPct: number;
}

export function computeOpco(i: OpcoInputs): ModelResult {
  const N = Math.max(1, Math.round(i.years));
  const cols = ["Year 0"];
  for (let y = 1; y <= N; y++) cols.push(`Y${y}`);

  const totRev: number[] = new Array(N + 1).fill(0);
  const totNi: number[] = new Array(N + 1).fill(0);
  const fcf: number[] = new Array(N + 1).fill(0);
  const lineRows: RowOut[] = [];

  for (const ln of i.lines) {
    const rev: number[] = [0];
    for (let y = 1; y <= N; y++) {
      const active = y >= ln.startYear;
      const r = active ? ln.year1Revenue * Math.pow(1 + ln.growthPct, y - ln.startYear) : 0;
      rev.push(r);
      totRev[y] += r;
      totNi[y] += r * ln.netMarginPct;
      // investment hits the year before the line starts
      if (y === ln.startYear) fcf[Math.max(0, y - 1)] -= ln.initialInvestment;
    }
    lineRows.push({ label: ln.name, cells: rev.map((v, idx) => (idx === 0 ? "—" : money(v))) });
  }
  for (let y = 0; y <= N; y++) fcf[y] += totNi[y];

  const g = i.terminalGrowthPct;
  const tv = i.discountRate > g ? (fcf[N] * (1 + g)) / (i.discountRate - g) : 0;
  const fcfT = [...fcf]; fcfT[N] += tv;
  const projIRR = irr(fcfT);
  const projNPV = npv(i.discountRate, fcfT);
  const pb = paybackYears(fcf);
  const lastMargin = totRev[N] ? totNi[N] / totRev[N] : NaN;

  const kpis: KpiOut[] = [
    { label: "Project IRR", value: pct(projIRR), tone: projIRR >= i.discountRate ? "pos" : "neg" },
    { label: "NPV", value: money(projNPV), tone: projNPV >= 0 ? "pos" : "neg", hint: `disc ${pct(i.discountRate, 0)}` },
    { label: "Payback", value: isFinite(pb) ? `${pb.toFixed(1)} yrs` : "—" },
    { label: `Revenue (Yr ${N})`, value: money(totRev[N]) },
    { label: `Net margin (Yr ${N})`, value: pct(lastMargin, 0) },
    { label: "Revenue lines", value: String(i.lines.length) },
  ];
  const rows: RowOut[] = [
    { label: "REVENUE BY LINE", cells: cols.map(() => ""), section: true },
    ...lineRows,
    { label: "Total revenue", cells: totRev.map((v, idx) => (idx === 0 ? "—" : money(v))), strong: true },
    { label: "Net income", cells: totNi.map((v, idx) => (idx === 0 ? "—" : money(v))), strong: true },
    { label: "Project cash flow", cells: fcf.map((v) => money(v)), strong: true },
  ];
  return { kpis, columns: cols, rows, bars: fcf.map((v, idx) => ({ label: `Y${idx}`, value: v })) };
}

/* ============================ SENSITIVITY ============================= */

export interface SensitivityOut { columns: string[]; rows: { label: string; cells: string[] }[] }

export function pfSensitivity(i: ProjectFinanceInputs): SensitivityOut {
  const scen = [0.8, 0.9, 1.0, 1.1, 1.2];
  const runs = scen.map((s) => computeProjectFinance({ ...i, pricePerUnit: i.pricePerUnit * s }));
  return {
    columns: ["-20%", "-10%", "Base", "+10%", "+20%"],
    rows: [
      { label: "Project IRR", cells: runs.map((r) => r.kpis[0].value) },
      { label: "Equity IRR", cells: runs.map((r) => r.kpis[1].value) },
      { label: "Project NPV", cells: runs.map((r) => r.kpis[2].value) },
      { label: "Min DSCR", cells: runs.map((r) => r.kpis[4].value) },
    ],
  };
}

export function lendingSensitivity(i: LendingInputs): SensitivityOut {
  const deltas = [-0.1, -0.05, 0, 0.05, 0.1];
  const runs = deltas.map((d) => computeLending({ ...i, portfolioYield: i.portfolioYield + d }));
  return {
    columns: deltas.map((d) => `${((i.portfolioYield + d) * 100).toFixed(0)}%`),
    rows: [
      { label: "Equity value", cells: runs.map((r) => r.kpis[3].value) },
      { label: "EV (perpetuity)", cells: runs.map((r) => r.kpis[1].value) },
      { label: "ROE (Yr 1)", cells: runs.map((r) => r.kpis[4].value) },
    ],
  };
}

export function opcoSensitivity(i: OpcoInputs): SensitivityOut {
  const deltas = [-0.2, -0.1, 0, 0.1, 0.2];
  const runs = deltas.map((d) => computeOpco({ ...i, lines: i.lines.map((l) => ({ ...l, growthPct: l.growthPct + d })) }));
  return {
    columns: deltas.map((d) => (d === 0 ? "Base" : `${d > 0 ? "+" : ""}${(d * 100).toFixed(0)}pt`)),
    rows: [
      { label: "Project IRR", cells: runs.map((r) => r.kpis[0].value) },
      { label: "NPV", cells: runs.map((r) => r.kpis[1].value) },
      { label: "Revenue (final yr)", cells: runs.map((r) => r.kpis[3].value) },
    ],
  };
}
