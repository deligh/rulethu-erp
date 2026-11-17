// Comprehensive BlueDot Blueberry model — the venture under three structures:
// Ferungwe (outgrower), BlueDot (exporter) and the two Combined. Faithful to the
// spreadsheet: farmgate price drives the split, terminal value, sculpted debt.

import { npv, irr, paybackYears, ModelResult } from "./finmodels";
import { compact } from "./format";

const money = (v: number) => compact(v, "USD");
const pct = (v: number, d = 1) => (isFinite(v) ? `${(v * 100).toFixed(d)}%` : "—");
const num = (v: number, d = 0) => (isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—");

export interface BlueberryInputs {
  hectares: number; plantsPerHa: number;
  yields: number[]; packOut: number[]; // length 5
  farmgate: number; offtakeStart: number; offtakeDecline: number;
  fertilizer: number; chemicals: number; agronomy: number; water: number; electricity: number; fieldLabourPerPlant: number;
  picking: number; clearing: number;
  packaging: number; freight: number; packhouseLabour: number;
  farmCapex: number; packhouse: number; ferungweWC: number; exportWC: number;
  ferungweDep: number; bluedotDep: number;
  taxRate: number; wacc: number; terminalGrowth: number;
  debtShare: number; interestRate: number; targetDSCR: number;
}

export const BLUEBERRY_SAMPLE: BlueberryInputs = {
  hectares: 20, plantsPerHa: 9100,
  yields: [1, 3, 4, 5.4, 5.4], packOut: [0.85, 0.88, 0.90, 1.0, 1.0],
  farmgate: 5, offtakeStart: 13.414, offtakeDecline: 0.03,
  fertilizer: 0.84, chemicals: 0.672, agronomy: 1.286, water: 0.01, electricity: 0.1, fieldLabourPerPlant: 0.787,
  picking: 0.095, clearing: 0.098,
  packaging: 0.33, freight: 2.48, packhouseLabour: 31_860,
  farmCapex: 4_688_723, packhouse: 520_000, ferungweWC: 453_466, exportWC: 1_735_778,
  ferungweDep: 328_695, bluedotDep: 11_000,
  taxRate: 0.2575, wacc: 0.135, terminalGrowth: 0,
  debtShare: 0.8, interestRate: 0.16, targetDSCR: 1.4,
};

export type CaseKey = "combined" | "bluedot" | "ferungwe";

interface CaseCalc {
  vol: number[]; rev: number[]; opex: number[]; ebitda: number[]; dep: number[]; tax: number[]; opFcf: number[];
  invest0: number; fcf: number[]; npv: number; irr: number; payback: number; matureNetPerKg: number; matureEbitda: number;
}

function buildResult(c: CaseCalc, label: string): ModelResult {
  const cols = ["Year 0", "Y1", "Y2", "Y3", "Y4", "Y5"];
  const cum: number[] = []; let run = 0; for (const f of c.fcf) { run += f; cum.push(run); }
  const kpis = [
    { label: "NPV @ WACC", value: money(c.npv), tone: (c.npv >= 0 ? "pos" : "neg") as "pos" | "neg" },
    { label: "IRR", value: pct(c.irr), tone: "pos" as const },
    { label: "Payback", value: isFinite(c.payback) ? `${c.payback.toFixed(1)} yrs` : "—" },
    { label: "Investment", value: money(c.invest0) },
    { label: "EBITDA @ maturity", value: money(c.matureEbitda) },
    { label: "Net margin / kg", value: `$${c.matureNetPerKg.toFixed(2)}` },
  ];
  const rows = [
    { label: "Volume (kg)", cells: ["—", ...c.vol.map((v) => num(v))] },
    { label: "Revenue", cells: ["—", ...c.rev.map(money)] },
    { label: "Operating cost", cells: ["—", ...c.opex.map((v) => "(" + money(v) + ")")] },
    { label: "EBITDA", cells: ["—", ...c.ebitda.map(money)], strong: true },
    { label: "Depreciation", cells: ["—", ...c.dep.map((v) => "(" + money(v) + ")")] },
    { label: "Tax", cells: ["—", ...c.tax.map((v) => "(" + money(v) + ")")] },
    { label: "Free cash flow", cells: c.fcf.map(money), strong: true },
    { label: "Cumulative", cells: cum.map(money) },
  ];
  return { kpis, columns: cols, rows, bars: c.fcf.map((v, i) => ({ label: `Y${i}`, value: v })), note: `${label} · terminal value = mature FCF capitalised at WACC` };
}

function computeCases(i: BlueberryInputs) {
  const plants = i.hectares * i.plantsPerHa;
  const vol = i.yields.map((y, idx) => plants * y * i.packOut[idx]);
  const growingInputsAnnual = plants * (i.fertilizer + i.chemicals + i.agronomy + i.water + i.electricity);
  const fieldLabourAnnual = plants * i.fieldLabourPerPlant;
  const g = i.terminalGrowth, w = i.wacc;
  const capFactor = w > g ? (1 + g) / (w - g) : 0;

  // ---- Ferungwe (outgrower) ----
  const fRev = vol.map((v) => v * i.farmgate);
  const fOpex = vol.map((v) => growingInputsAnnual + fieldLabourAnnual + v * i.picking + v * i.clearing);
  const fEbitda = fRev.map((r, k) => r - fOpex[k]);
  const fDep = vol.map(() => i.ferungweDep);
  const fTax = fEbitda.map((e, k) => Math.max(0, (e - fDep[k]) * i.taxRate));
  const fOp = fEbitda.map((e, k) => e - fTax[k]);
  const fInvest = i.farmCapex + i.ferungweWC;
  const fTV = fOp[4] * capFactor;
  const fFcf = [-fInvest, fOp[0], fOp[1], fOp[2], fOp[3], fOp[4] + fTV];
  const fer: CaseCalc = {
    vol, rev: fRev, opex: fOpex, ebitda: fEbitda, dep: fDep, tax: fTax, opFcf: fOp,
    invest0: fInvest, fcf: fFcf, npv: npv(w, fFcf), irr: irr(fFcf), payback: paybackYears(fFcf),
    matureNetPerKg: (fOp[4]) / vol[4], matureEbitda: fEbitda[4],
  };

  // ---- BlueDot (exporter) ----
  const offtake = vol.map((_, k) => i.offtakeStart * Math.pow(1 - i.offtakeDecline, k));
  const bRev = vol.map((v, k) => v * offtake[k]);
  const bOpex = vol.map((v) => v * i.farmgate + v * i.packaging + v * i.freight + i.packhouseLabour);
  const bEbitda = bRev.map((r, k) => r - bOpex[k]);
  const bDep = vol.map(() => i.bluedotDep);
  const bTax = bEbitda.map((e, k) => Math.max(0, (e - bDep[k]) * i.taxRate));
  const bOp = bEbitda.map((e, k) => e - bTax[k]);
  const bInvest = i.packhouse + i.exportWC;
  const bTV = bOp[4] * capFactor;
  const bFcf = [-bInvest, bOp[0], bOp[1], bOp[2], bOp[3], bOp[4] + bTV];
  const bd: CaseCalc = {
    vol, rev: bRev, opex: bOpex, ebitda: bEbitda, dep: bDep, tax: bTax, opFcf: bOp,
    invest0: bInvest, fcf: bFcf, npv: npv(w, bFcf), irr: irr(bFcf), payback: paybackYears(bFcf),
    matureNetPerKg: bOp[4] / vol[4], matureEbitda: bEbitda[4],
  };

  // ---- Combined (integrated) — farmgate nets out ----
  const cInvest = i.farmCapex + i.packhouse + i.ferungweWC + i.exportWC;
  const cRev = bRev.slice(); // sells to market at offtake
  const cOpex = vol.map((v, k) => (fOpex[k]) + (bOpex[k] - v * i.farmgate)); // remove internal purchase
  const cEbitda = cRev.map((r, k) => r - cOpex[k]);
  const cDep = vol.map(() => i.ferungweDep + i.bluedotDep);
  const cTax = cEbitda.map((e, k) => Math.max(0, (e - cDep[k]) * i.taxRate));
  const cOp = cEbitda.map((e, k) => e - cTax[k]);
  const cTV = cOp[4] * capFactor;
  const cFcf = [-cInvest, cOp[0], cOp[1], cOp[2], cOp[3], cOp[4] + cTV];
  const comb: CaseCalc = {
    vol, rev: cRev, opex: cOpex, ebitda: cEbitda, dep: cDep, tax: cTax, opFcf: cOp,
    invest0: cInvest, fcf: cFcf, npv: npv(w, cFcf), irr: irr(cFcf), payback: paybackYears(cFcf),
    matureNetPerKg: cOp[4] / vol[4], matureEbitda: cEbitda[4],
  };

  return { fer, bd, comb, plants, vol, offtake, growingInputsAnnual, fieldLabourAnnual };
}

export interface BlueberryResult {
  results: Record<CaseKey, ModelResult>;
  summary: { rows: { label: string; f: string; b: string; c: string }[] };
  valueChain: { rows: { label: string; value: string; group?: string }[] };
  debt: { rows: { label: string; cells: string[] }[]; columns: string[]; kpis: { label: string; value: string }[] };
  sensitivity: { columns: string[]; rows: { label: string; cells: string[] }[] };
  wacc: number;
}

export function computeBlueberry(i: BlueberryInputs): BlueberryResult {
  const m = computeCases(i);

  const results: Record<CaseKey, ModelResult> = {
    combined: buildResult(m.comb, "Combined (integrated)"),
    bluedot: buildResult(m.bd, "BlueDot (exporter)"),
    ferungwe: buildResult(m.fer, "Ferungwe (outgrower)"),
  };

  const summary = {
    rows: [
      { label: "Sells at ($/kg)", f: "$" + i.farmgate.toFixed(2), b: "$" + i.offtakeStart.toFixed(2), c: "$" + i.offtakeStart.toFixed(2) },
      { label: "Investment", f: money(m.fer.invest0), b: money(m.bd.invest0), c: money(m.comb.invest0) },
      { label: "NPV @ WACC", f: money(m.fer.npv), b: money(m.bd.npv), c: money(m.comb.npv) },
      { label: "IRR", f: pct(m.fer.irr), b: pct(m.bd.irr), c: pct(m.comb.irr) },
      { label: "Payback", f: isFinite(m.fer.payback) ? m.fer.payback.toFixed(1) + " yrs" : "—", b: isFinite(m.bd.payback) ? m.bd.payback.toFixed(1) + " yrs" : "—", c: isFinite(m.comb.payback) ? m.comb.payback.toFixed(1) + " yrs" : "—" },
      { label: "Net margin / kg", f: "$" + m.fer.matureNetPerKg.toFixed(2), b: "$" + m.bd.matureNetPerKg.toFixed(2), c: "$" + m.comb.matureNetPerKg.toFixed(2) },
      { label: "EBITDA @ maturity", f: money(m.fer.matureEbitda), b: money(m.bd.matureEbitda), c: money(m.comb.matureEbitda) },
      { label: "Revenue @ maturity", f: money(m.fer.rev[4]), b: money(m.bd.rev[4]), c: money(m.comb.rev[4]) },
    ],
  };

  // Value chain — per kg at maturity (year 5)
  const v = m.vol[4];
  const perkg = (x: number) => "$" + (x / v).toFixed(3);
  const valueChain = {
    rows: [
      { label: "FERUNGWE (outgrower)", value: "$/kg", group: "h" },
      { label: "Farmgate price received", value: "$" + i.farmgate.toFixed(2) },
      { label: "Growing inputs + labour", value: "(" + perkg(m.growingInputsAnnual + m.fieldLabourAnnual) + ")" },
      { label: "Picking + clearing", value: "(" + "$" + (i.picking + i.clearing).toFixed(3) + ")" },
      { label: "Depreciation", value: "(" + perkg(i.ferungweDep) + ")" },
      { label: "Grower net per kg", value: "$" + m.fer.matureNetPerKg.toFixed(2), group: "s" },
      { label: "BLUEDOT (exporter)", value: "$/kg", group: "h" },
      { label: "Offtake price received", value: "$" + m.offtake[4].toFixed(2) },
      { label: "Purchase from Ferungwe", value: "(" + "$" + i.farmgate.toFixed(2) + ")" },
      { label: "Packaging + freight", value: "(" + "$" + (i.packaging + i.freight).toFixed(3) + ")" },
      { label: "Packhouse labour + dep", value: "(" + perkg(i.packhouseLabour + i.bluedotDep) + ")" },
      { label: "BlueDot net per kg", value: "$" + m.bd.matureNetPerKg.toFixed(2), group: "s" },
      { label: "COMBINED (whole chain)", value: "$/kg", group: "h" },
      { label: "Whole-chain net per kg", value: "$" + m.comb.matureNetPerKg.toFixed(2), group: "s" },
    ],
  };

  // Debt schedule (sculpted to target DSCR on the integrated project)
  const loan = m.comb.invest0 * i.debtShare;
  const cols = ["Year 0", "Y1", "Y2", "Y3", "Y4", "Y5"];
  const open: number[] = [], intCharged: number[] = [], principal: number[] = [], service: number[] = [], dscr: number[] = [], close: number[] = [];
  let bal = loan;
  const cfads = [0, ...m.comb.opFcf]; // Y1..Y5 operating cash (index 1..5)
  for (let y = 1; y <= 5; y++) {
    open[y] = bal;
    const interest = bal * i.interestRate;
    let princ = 0, svc = 0, cap = 0;
    if (y === 1) { cap = interest; bal += cap; } // grace: interest capitalised
    else {
      svc = Math.min(cfads[y] / i.targetDSCR, bal + interest);
      princ = Math.max(0, svc - interest);
      princ = Math.min(princ, bal);
      svc = interest + princ;
      bal -= princ;
    }
    intCharged[y] = interest; principal[y] = princ; service[y] = y === 1 ? 0 : svc;
    dscr[y] = service[y] > 0 ? cfads[y] / service[y] : NaN;
    close[y] = bal;
  }
  const debt = {
    columns: cols,
    kpis: [
      { label: "Loan amount", value: money(loan) },
      { label: "Interest rate", value: pct(i.interestRate, 0) },
      { label: "Target DSCR", value: i.targetDSCR.toFixed(2) + "x" },
      { label: "Cleared by", value: close[5] < 1 ? "Year 5" : "—" },
    ],
    rows: [
      { label: "Opening balance", cells: ["—", ...[1, 2, 3, 4, 5].map((y) => money(open[y]))] },
      { label: "Interest charged", cells: ["—", ...[1, 2, 3, 4, 5].map((y) => money(intCharged[y]))] },
      { label: "Principal repaid", cells: ["—", ...[1, 2, 3, 4, 5].map((y) => money(principal[y]))] },
      { label: "Cash debt service", cells: ["—", ...[1, 2, 3, 4, 5].map((y) => money(service[y]))] },
      { label: "CFADS", cells: ["—", ...[1, 2, 3, 4, 5].map((y) => money(cfads[y]))] },
      { label: "DSCR", cells: ["—", ...[1, 2, 3, 4, 5].map((y) => (isFinite(dscr[y]) ? dscr[y].toFixed(2) + "x" : "—"))] },
      { label: "Closing balance", cells: ["—", ...[1, 2, 3, 4, 5].map((y) => money(close[y]))] },
    ],
  };

  // Farmgate sensitivity ($4–$9)
  const prices = [4, 5, 6, 7, 8, 9];
  const ferIRR: string[] = [], ferNPV: string[] = [], bdIRR: string[] = [], bdNPV: string[] = [], combNPV: string[] = [], growerKg: string[] = [];
  for (const p of prices) {
    const mm = computeCases({ ...i, farmgate: p });
    ferIRR.push(pct(mm.fer.irr, 0)); ferNPV.push(money(mm.fer.npv));
    bdIRR.push(pct(mm.bd.irr, 0)); bdNPV.push(money(mm.bd.npv));
    combNPV.push(money(mm.comb.npv)); growerKg.push("$" + mm.fer.matureNetPerKg.toFixed(2));
  }
  const sensitivity = {
    columns: ["Farmgate $/kg", ...prices.map((p) => "$" + p)],
    rows: [
      { label: "Ferungwe IRR", cells: ferIRR },
      { label: "Ferungwe NPV", cells: ferNPV },
      { label: "Grower net/kg", cells: growerKg },
      { label: "BlueDot IRR", cells: bdIRR },
      { label: "BlueDot NPV", cells: bdNPV },
      { label: "Combined NPV", cells: combNPV },
    ],
  };

  return { results, summary, valueChain, debt, sensitivity, wacc: i.wacc };
}
