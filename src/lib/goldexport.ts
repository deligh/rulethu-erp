// Gold Outlook → clean Excel workbook. A tidy, boardroom-ready export of the
// stored gold history, the projection (with band), and the model assumptions.

import * as XLSX from "xlsx";
import type { Forecast } from "./forecast";

export function goldExcel(f: Forecast, horizonLabel: string) {
  const wb = XLSX.utils.book_new();
  const today = new Date().toISOString().slice(0, 10);

  // About / assumptions
  const about: (string | number)[][] = [
    ["RULETHU HOLDINGS — GOLD OUTLOOK"],
    [],
    ["Generated", new Date().toLocaleString("en-GB")],
    ["Spot (anchor), $/oz", Math.round(f.anchor)],
    ["As of", f.anchorAt.slice(0, 10)],
    ["Assumed drift (per year)", `${(f.driftAnnual * 100).toFixed(1)}%`],
    ["Volatility (per year)", `${(f.volAnnual * 100).toFixed(0)}%`],
    ["View / horizon", `${horizonLabel} → ${f.endLabel}`],
    ["History readings used", f.basedOn],
    [],
    ["Note", "Model scenario from a real multi-year gold trend plus this platform's live readings."],
    ["", "Not a prediction or investment advice. Verify before acting."],
  ];
  const wsA = XLSX.utils.aoa_to_sheet(about);
  wsA["!cols"] = [{ wch: 26 }, { wch: 46 }];
  XLSX.utils.book_append_sheet(wb, wsA, "About");

  // History
  const hist: (string | number)[][] = [["Date", "Gold ($/oz)"], ...f.history.map((p) => [p.t.slice(0, 10), Math.round(p.price)])];
  const wsH = XLSX.utils.aoa_to_sheet(hist);
  wsH["!cols"] = [{ wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsH, "Gold History");

  // Projection
  const proj: (string | number)[][] = [
    ["Date", "Projection ($/oz)", "Low (−1σ)", "High (+1σ)"],
    ...f.projection.map((p) => [p.t.slice(0, 10), Math.round(p.mid), Math.round(p.lo), Math.round(p.hi)]),
  ];
  const wsP = XLSX.utils.aoa_to_sheet(proj);
  wsP["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsP, "Projection");

  XLSX.writeFile(wb, `Rulethu-Gold-Outlook-${today}.xlsx`);
}
