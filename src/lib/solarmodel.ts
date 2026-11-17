// Robust solar PV project-finance model — modelled on Rulethu's real Khayah
// Solar workbook (Sources & Uses, degradation, PPA tariff escalation, senior
// debt with DSCR, tax/depreciation, project & equity IRR, LCOE). Annual engine.
//
// `buildSolarWorkbook` exports a REAL .xlsx with live formulas, so clients can
// edit the inputs in Excel and every output recalculates.

import * as XLSX from "xlsx";

export interface SolarInputs {
  // Project & output
  parkMWp: number;            // DC size, MWp
  specificYield: number;      // kWh/kWp/yr (P50)
  degYr1: number;             // first-year degradation (fraction)
  degStable: number;          // stabilised annual degradation (fraction)
  // Revenue
  tariffCOD: number;          // USD/kWh at COD
  tariffEsc: number;          // annual tariff escalation (fraction)
  ppaTermYears: number;
  // Opex (annual, Year 1)
  omPerKwp: number;           // O&M USD/kWp/yr
  insurance: number;          // USD/yr
  mgmtPctRev: number;         // management cost, fraction of revenue
  security: number;           // USD/yr
  ga: number;                 // G&A USD/yr
  opexEsc: number;            // opex escalation (fraction)
  // Capex
  epcPerWp: number;           // EPC + owner's cost, USD/Wp
  developmentCost: number;    // USD
  contingencyPct: number;     // fraction of EPC
  financingCostsPctDebt: number; // IDC + fees, fraction of senior debt
  initialWC: number;          // USD
  // Financing
  gearingPct: number;         // senior debt as fraction of total uses
  seniorTenorYears: number;
  seniorRate: number;         // all-in, fraction
  // Tax & discounting
  taxRate: number;            // fraction
  depreciationYears: number;
  discountRate: number;       // for project NPV, fraction
}

export const KHAYAH_SOLAR: SolarInputs = {
  parkMWp: 10,
  specificYield: 1750,
  degYr1: 0.02,
  degStable: 0.005,
  tariffCOD: 0.095,
  tariffEsc: 0.02,
  ppaTermYears: 20,
  omPerKwp: 12,
  insurance: 60_000,
  mgmtPctRev: 0.015,
  security: 40_000,
  ga: 50_000,
  opexEsc: 0.03,
  epcPerWp: 0.90,
  developmentCost: 716_072,
  contingencyPct: 0.05,
  financingCostsPctDebt: 0.05,
  initialWC: 150_000,
  gearingPct: 0.55,
  seniorTenorYears: 12,
  seniorRate: 0.095,
  taxRate: 0.2477,
  depreciationYears: 10,
  discountRate: 0.10,
};

export interface SolarYear {
  year: number;
  genMWh: number;
  tariff: number;
  revenue: number;
  opex: number;
  ebitda: number;
  interest: number;
  principal: number;
  debtService: number;
  dscr: number | null;
  depreciation: number;
  tax: number;
  projectFCF: number;
  equityCF: number;
  cumProject: number;
  debtBalance: number;
}

export interface SolarResult {
  epc: number; contingency: number; financingCosts: number;
  totalUses: number; seniorDebt: number; equity: number;
  projectIRR: number | null; equityIRR: number | null;
  projectNPV: number;
  minDSCR: number | null; avgDSCR: number | null;
  lcoe: number; ebitdaMarginAvg: number;
  paybackYears: number | null; costPerMWp: number;
  years: SolarYear[];
}

function npv(rate: number, cf: number[]): number {
  return cf.reduce((s, c, i) => s + c / Math.pow(1 + rate, i), 0);
}
function irr(cf: number[]): number | null {
  let lo = -0.9, hi = 2.0;
  const f = (r: number) => npv(r, cf);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; const v = f(m); if (Math.abs(v) < 1) return m; if (f(lo) * v < 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
function pmt(rate: number, n: number, pv: number): number {
  if (rate === 0) return pv / n;
  return (pv * rate) / (1 - Math.pow(1 + rate, -n));
}

export function computeSolar(inp: SolarInputs): SolarResult {
  const kwp = inp.parkMWp * 1000;
  const epc = inp.epcPerWp * inp.parkMWp * 1_000_000;
  const contingency = inp.contingencyPct * epc;
  const preFinance = epc + contingency + inp.developmentCost + inp.initialWC;
  // solve senior debt / financing jointly (financing cost depends on debt)
  const seniorDebt0 = inp.gearingPct * preFinance;
  const financingCosts = inp.financingCostsPctDebt * seniorDebt0;
  const totalUses = preFinance + financingCosts;
  const seniorDebt = inp.gearingPct * totalUses;
  const equity = totalUses - seniorDebt;

  const annualDebtService = pmt(inp.seniorRate, inp.seniorTenorYears, seniorDebt);
  const depreciable = epc + contingency;
  const annualDep = depreciable / inp.depreciationYears;

  const years: SolarYear[] = [];
  let degFactor = 1;
  let debtBalance = seniorDebt;
  let cumProject = -totalUses;
  const projCF: number[] = [-totalUses];
  const eqCF: number[] = [-equity];
  const genPV: number[] = []; const costPV: number[] = [];

  for (let y = 1; y <= inp.ppaTermYears; y++) {
    if (y === 2) degFactor *= (1 - inp.degYr1);
    else if (y > 2) degFactor *= (1 - inp.degStable);
    const genMWh = (kwp * inp.specificYield * degFactor) / 1000;
    const tariff = inp.tariffCOD * Math.pow(1 + inp.tariffEsc, y - 1);
    const revenue = genMWh * 1000 * tariff;
    const esc = Math.pow(1 + inp.opexEsc, y - 1);
    const opex = inp.omPerKwp * kwp * esc + inp.insurance * esc + inp.security * esc + inp.ga * esc + inp.mgmtPctRev * revenue;
    const ebitda = revenue - opex;

    let interest = 0, principal = 0, debtService = 0, dscr: number | null = null;
    if (y <= inp.seniorTenorYears && debtBalance > 1) {
      interest = debtBalance * inp.seniorRate;
      debtService = annualDebtService;
      principal = Math.min(debtService - interest, debtBalance);
      debtBalance -= principal;
      dscr = debtService > 0 ? (ebitda) / debtService : null;
    }
    const depreciation = y <= inp.depreciationYears ? annualDep : 0;
    const taxable = Math.max(0, ebitda - depreciation - interest);
    const tax = taxable * inp.taxRate;
    const projectFCF = ebitda - tax;
    const equityCF = ebitda - tax - debtService;
    cumProject += projectFCF;

    years.push({ year: y, genMWh, tariff, revenue, opex, ebitda, interest, principal, debtService, dscr, depreciation, tax, projectFCF, equityCF, cumProject, debtBalance });
    projCF.push(projectFCF); eqCF.push(equityCF);
    const disc = Math.pow(1 + inp.discountRate, y);
    genPV.push((genMWh * 1000) / disc);
    costPV.push((opex + (y <= inp.seniorTenorYears ? 0 : 0)) / disc); // opex PV; capex handled separately
  }

  const projectIRR = irr(projCF);
  const equityIRR = irr(eqCF);
  const projectNPV = npv(inp.discountRate, projCF);
  const dscrs = years.map((y) => y.dscr).filter((d): d is number => d != null && isFinite(d));
  const minDSCR = dscrs.length ? Math.min(...dscrs) : null;
  const avgDSCR = dscrs.length ? dscrs.reduce((a, b) => a + b, 0) / dscrs.length : null;
  const ebitdaMarginAvg = years.reduce((s, y) => s + (y.revenue ? y.ebitda / y.revenue : 0), 0) / years.length;
  // LCOE = (capex + PV opex) / PV generation
  const lcoe = (totalUses + costPV.reduce((a, b) => a + b, 0)) / genPV.reduce((a, b) => a + b, 0);

  let paybackYears: number | null = null;
  for (const y of years) if (y.cumProject >= 0) { paybackYears = y.year; break; }

  return {
    epc, contingency, financingCosts, totalUses, seniorDebt, equity,
    projectIRR, equityIRR, projectNPV, minDSCR, avgDSCR, lcoe, ebitdaMarginAvg,
    paybackYears, costPerMWp: totalUses / inp.parkMWp, years,
  };
}

/* ------------------------------------------------------------------ */
/* Excel export WITH LIVE FORMULAS                                    */
/* ------------------------------------------------------------------ */

const C = (col: number, row: number) => XLSX.utils.encode_cell({ c: col, r: row });

// numbered input rows live on the Inputs sheet in column C; we track addresses.
export function buildSolarWorkbook(inp: SolarInputs): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  /* ----- Inputs sheet (col B label, col C value) ----- */
  const inputRows: [string, number, string][] = [
    ["Park size (DC)", inp.parkMWp, "MWp"],
    ["Specific yield (P50)", inp.specificYield, "kWh/kWp/yr"],
    ["Year-1 degradation", inp.degYr1, "frac"],
    ["Stabilised degradation", inp.degStable, "frac"],
    ["Tariff at COD", inp.tariffCOD, "USD/kWh"],
    ["Tariff escalation", inp.tariffEsc, "frac"],
    ["PPA term", inp.ppaTermYears, "years"],
    ["O&M", inp.omPerKwp, "USD/kWp/yr"],
    ["Insurance", inp.insurance, "USD/yr"],
    ["Management (% rev)", inp.mgmtPctRev, "frac"],
    ["Security", inp.security, "USD/yr"],
    ["G&A", inp.ga, "USD/yr"],
    ["Opex escalation", inp.opexEsc, "frac"],
    ["EPC + owner's cost", inp.epcPerWp, "USD/Wp"],
    ["Development cost", inp.developmentCost, "USD"],
    ["Contingency (% EPC)", inp.contingencyPct, "frac"],
    ["Financing costs (% debt)", inp.financingCostsPctDebt, "frac"],
    ["Initial working capital", inp.initialWC, "USD"],
    ["Gearing (senior debt)", inp.gearingPct, "frac"],
    ["Senior tenor", inp.seniorTenorYears, "years"],
    ["Senior all-in rate", inp.seniorRate, "frac"],
    ["Tax rate", inp.taxRate, "frac"],
    ["Depreciation period", inp.depreciationYears, "years"],
    ["Discount rate", inp.discountRate, "frac"],
  ];
  // address map by label key order
  const addr: Record<string, string> = {};
  const keys = ["parkMWp","specificYield","degYr1","degStable","tariffCOD","tariffEsc","ppaTermYears","omPerKwp","insurance","mgmtPctRev","security","ga","opexEsc","epcPerWp","developmentCost","contingencyPct","financingCostsPctDebt","initialWC","gearingPct","seniorTenorYears","seniorRate","taxRate","depreciationYears","discountRate"];
  const ws: XLSX.WorkSheet = {};
  ws[C(1, 0)] = { t: "s", v: "KHAYAH-STYLE SOLAR MODEL — INPUTS" };
  ws[C(1, 1)] = { t: "s", v: "Edit the values in column C — every output recalculates." };
  inputRows.forEach((r, i) => {
    const row = i + 3;
    ws[C(1, row)] = { t: "s", v: r[0] };
    ws[C(2, row)] = { t: "n", v: r[1] };
    ws[C(3, row)] = { t: "s", v: r[2] };
    addr[keys[i]] = `Inputs!$C$${row + 1}`;
  });
  ws["!ref"] = `A1:D${inputRows.length + 4}`;
  ws["!cols"] = [{ wch: 2 }, { wch: 30 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "Inputs");

  /* ----- Sources & Uses (formulas) ----- */
  const su: XLSX.WorkSheet = {};
  const suRows: [string, string][] = [
    ["EPC + owner's cost", `=${addr.epcPerWp}*${addr.parkMWp}*1000000`],
    ["Contingency", `=${addr.contingencyPct}*B3`],
    ["Development cost", `=${addr.developmentCost}`],
    ["Initial working capital", `=${addr.initialWC}`],
    ["Financing costs", `=${addr.financingCostsPctDebt}*${addr.gearingPct}*(B3+B4+B5+B6)`],
    ["Total uses of funds", `=B3+B4+B5+B6+B7`],
    ["", ""],
    ["Senior debt", `=${addr.gearingPct}*B8`],
    ["Equity (SHL + pref + ordinary)", `=B8-B10`],
    ["Total sources", `=B10+B11`],
    ["", ""],
    ["Cost per MWp", `=B8/${addr.parkMWp}`],
  ];
  su[C(1, 0)] = { t: "s", v: "SOURCES & USES" };
  suRows.forEach((r, i) => {
    const row = i + 2;
    if (r[0]) su[C(0, row)] = { t: "s", v: r[0] };
    if (r[1]) su[C(1, row)] = { t: "n", f: r[1].slice(1) };
  });
  su["!ref"] = `A1:B${suRows.length + 3}`;
  su["!cols"] = [{ wch: 32 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, su, "SourcesUses");

  /* ----- Model (year-by-year, formulas referencing Inputs) ----- */
  const term = inp.ppaTermYears;
  const m: XLSX.WorkSheet = {};
  const LBL = [
    "Year", "Degradation factor", "Generation (MWh)", "Tariff (USD/kWh)", "Revenue",
    "Opex", "EBITDA", "Opening debt", "Interest", "Debt service", "Principal",
    "Closing debt", "DSCR", "Depreciation", "Tax", "Project FCF", "Equity CF",
  ];
  LBL.forEach((l, r) => (m[C(0, r)] = { t: "s", v: l }));
  // debt service constant (PMT) — put helper in col of year 1 header area via a name cell
  // We'll compute PMT inline each year using the senior debt & rate.
  for (let y = 1; y <= term; y++) {
    const col = y; // column index (B=1 for year1)
    const prev = col - 1;
    const cc = (r: number) => C(col, r);
    const pc = (r: number) => C(prev, r);
    // Year
    m[cc(0)] = { t: "n", v: y };
    // Degradation factor
    if (y === 1) m[cc(1)] = { t: "n", f: `1` };
    else if (y === 2) m[cc(1)] = { t: "n", f: `${pc(1)}*(1-${addr.degYr1})` };
    else m[cc(1)] = { t: "n", f: `${pc(1)}*(1-${addr.degStable})` };
    // Generation MWh = parkMWp*1000*yield*deg/1000
    m[cc(2)] = { t: "n", f: `${addr.parkMWp}*1000*${addr.specificYield}*${cc(1)}/1000` };
    // Tariff
    m[cc(3)] = { t: "n", f: `${addr.tariffCOD}*(1+${addr.tariffEsc})^(${y}-1)` };
    // Revenue
    m[cc(4)] = { t: "n", f: `${cc(2)}*1000*${cc(3)}` };
    // Opex
    m[cc(5)] = { t: "n", f: `(${addr.omPerKwp}*${addr.parkMWp}*1000+${addr.insurance}+${addr.security}+${addr.ga})*(1+${addr.opexEsc})^(${y}-1)+${addr.mgmtPctRev}*${cc(4)}` };
    // EBITDA
    m[cc(6)] = { t: "n", f: `${cc(4)}-${cc(5)}` };
    // Opening debt
    if (y === 1) m[cc(7)] = { t: "n", f: `SourcesUses!$B$10` };
    else m[cc(7)] = { t: "n", f: `${pc(11)}` };
    // Interest
    m[cc(8)] = { t: "n", f: `IF(${y}<=${addr.seniorTenorYears},${cc(7)}*${addr.seniorRate},0)` };
    // Debt service (PMT on senior debt)
    m[cc(9)] = { t: "n", f: `IF(${y}<=${addr.seniorTenorYears},SourcesUses!$B$10*${addr.seniorRate}/(1-(1+${addr.seniorRate})^(-${addr.seniorTenorYears})),0)` };
    // Principal
    m[cc(10)] = { t: "n", f: `MIN(${cc(9)}-${cc(8)},${cc(7)})` };
    // Closing debt
    m[cc(11)] = { t: "n", f: `${cc(7)}-${cc(10)}` };
    // DSCR
    m[cc(12)] = { t: "n", f: `IF(${cc(9)}>0,${cc(6)}/${cc(9)},"")` };
    // Depreciation
    m[cc(13)] = { t: "n", f: `IF(${y}<=${addr.depreciationYears},(SourcesUses!$B$3+SourcesUses!$B$4)/${addr.depreciationYears},0)` };
    // Tax
    m[cc(14)] = { t: "n", f: `MAX(0,${cc(6)}-${cc(13)}-${cc(8)})*${addr.taxRate}` };
    // Project FCF
    m[cc(15)] = { t: "n", f: `${cc(6)}-${cc(14)}` };
    // Equity CF
    m[cc(16)] = { t: "n", f: `${cc(6)}-${cc(14)}-${cc(9)}` };
  }
  m["!ref"] = `A1:${XLSX.utils.encode_col(term)}17`;
  m["!cols"] = [{ wch: 20 }, ...Array(term).fill({ wch: 12 })];
  XLSX.utils.book_append_sheet(wb, m, "Model");

  /* ----- CashFlow sheet (contiguous ranges for IRR/NPV) ----- */
  const colL = (i: number) => XLSX.utils.encode_col(i);
  const cf: XLSX.WorkSheet = {};
  cf[C(0, 0)] = { t: "s", v: "CASH FLOWS" };
  cf[C(0, 1)] = { t: "s", v: "Year" };
  cf[C(0, 2)] = { t: "s", v: "Project cash flow" };
  cf[C(0, 3)] = { t: "s", v: "Equity cash flow" };
  cf[C(1, 1)] = { t: "n", v: 0 };
  cf[C(1, 2)] = { t: "n", f: `-SourcesUses!$B$8` };
  cf[C(1, 3)] = { t: "n", f: `-SourcesUses!$B$11` };
  for (let y = 1; y <= term; y++) {
    const col = y + 1; // B=year0 at col1, so year y at col y+1
    cf[C(col, 1)] = { t: "n", v: y };
    cf[C(col, 2)] = { t: "n", f: `Model!${colL(y)}16` };
    cf[C(col, 3)] = { t: "n", f: `Model!${colL(y)}17` };
  }
  cf["!ref"] = `A1:${colL(term + 1)}4`;
  XLSX.utils.book_append_sheet(wb, cf, "CashFlow");

  /* ----- Summary (KPIs via IRR/NPV formulas) ----- */
  const firstCol = colL(1);
  const lastCol = colL(term);
  const lastCF = colL(term + 1);
  const projCFrange = `CashFlow!B3:${lastCF}3`;
  const projOpsRange = `CashFlow!C3:${lastCF}3`;
  const eqCFrange = `CashFlow!B4:${lastCF}4`;
  const dscrRange = `Model!${firstCol}13:${lastCol}13`;
  const sm: XLSX.WorkSheet = {};
  sm[C(1, 0)] = { t: "s", v: "SUMMARY — KEY ANALYSIS" };
  const kpis: [string, string][] = [
    ["Total uses of funds", `=SourcesUses!$B$8`],
    ["Senior debt", `=SourcesUses!$B$10`],
    ["Equity", `=SourcesUses!$B$11`],
    ["Cost per MWp", `=SourcesUses!$B$8/${addr.parkMWp}`],
    ["Project IRR", `=IRR(${projCFrange})`],
    ["Equity IRR", `=IRR(${eqCFrange})`],
    ["Project NPV (@ discount rate)", `=CashFlow!B3+NPV(${addr.discountRate},${projOpsRange})`],
    ["Minimum DSCR", `=MIN(${dscrRange})`],
    ["Average DSCR", `=AVERAGE(${dscrRange})`],
    ["Tariff at COD", `=${addr.tariffCOD}`],
  ];
  kpis.forEach((k, i) => {
    const row = i + 2;
    sm[C(1, row)] = { t: "s", v: k[0] };
    sm[C(2, row)] = { t: "n", f: k[1].slice(1) };
  });
  sm["!ref"] = `A1:D${kpis.length + 3}`;
  sm["!cols"] = [{ wch: 2 }, { wch: 32 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, sm, "Summary");

  wb.Workbook = { CalcPr: { fullCalcOnLoad: true } } as unknown as XLSX.WBProps;
  return wb;
}

export function downloadSolarWorkbook(inp: SolarInputs, filename = "Rulethu-Solar-Model.xlsx") {
  const wb = buildSolarWorkbook(inp);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
