// Professional FCFF valuation export — a follow-able Excel workbook with LIVE
// formulas: the projection, terminal value, PV and equity bridge are all
// formulas that reference the assumptions block, so an analyst can change an
// assumption in Excel and the valuation recalculates, exactly like a hand-built
// model. Plus Scenarios and a WACC x growth Sensitivity grid.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FcffInputs, FcffResult, scenarioTable, fcffSensitivity } from "./fcff";

const col = (n: number) => String.fromCharCode(64 + n); // 2->B
const F = (f: string, v: number) => ({ t: "n" as const, f, v });
const slug = (s: string) => s.replace(/[^\w]+/g, "-").slice(0, 40);

export interface RelativePack {
  peers: { name: string; evEbitda: number; pe: number }[];
  evMultMid: number; peMultMid: number;
  subjEbitda: number; subjNi: number; netDebt: number; fx: number;
  rows: { label: string; low: number; mid: number; high: number }[]; // local currency
  blended: number; price: number;
}

export function fcffXlsx(i: FcffInputs, r: FcffResult, rel?: RelativePack) {
  const wb = XLSX.utils.book_new();
  const A = XLSX.utils.encode_cell;
  const put = (ws: XLSX.WorkSheet, c: number, rrow: number, val: unknown) => { ws[A({ c: c - 1, r: rrow - 1 })] = typeof val === "object" ? val : { t: typeof val === "number" ? "n" : "s", v: val }; };

  // ---------- Valuation sheet (formula-driven) ----------
  const ws: XLSX.WorkSheet = {};
  // title
  put(ws, 1, 1, `${i.company} — FCFF DCF Valuation`);
  put(ws, 1, 2, `Valuation date: ${i.valuationDate}   |   Base: ${i.baseYearLabel}   |   Currency: ${i.currency}`);

  // assumptions block (rows 4-15), column A label, B value — referenced by projection
  const AR = { wacc: 4, tg: 5, tax: 6, capex: 7, da: 8, wc: 9, rir: 10, baseRev: 11, mid: 12, cash: 13, nonop: 14, debt: 15, shares: 16, roll: 17, fx: 18, illiq: 19 };
  const asm: [number, string, number][] = [
    [AR.wacc, "WACC", i.wacc], [AR.tg, "Terminal growth", i.terminalGrowth], [AR.tax, "Marginal tax rate", i.taxRate],
    [AR.capex, "Capex % of revenue", i.capexPctRev], [AR.da, "D&A % of revenue", i.daPctRev], [AR.wc, "ΔWC % of Δrevenue", i.wcPctOfRevGrowth],
    [AR.rir, "Terminal reinvestment (RIR)", i.terminalReinvestRate], [AR.baseRev, "Base revenue", i.baseRevenue], [AR.mid, "Mid-year factor", i.midYear === false ? 0 : 0.5],
    [AR.cash, "Cash & equivalents", i.cash], [AR.nonop, "Non-operating assets", i.nonOpAssets], [AR.debt, "Total debt", i.totalDebt],
    [AR.shares, "Shares outstanding", i.shares], [AR.roll, "Roll-forward (years)", i.rollForwardYears], [AR.fx, "Exchange rate (local/rep)", i.exchangeRate], [AR.illiq, "Illiquidity discount", i.illiquidityDiscount],
  ];
  put(ws, 1, 3, "KEY ASSUMPTIONS (edit these — the valuation recalculates)");
  for (const [row, label, val] of asm) { put(ws, 1, row, label); put(ws, 2, row, val); }

  // projection: columns B(base)=2, C..G = Y1..Y5 (3..7), H = terminal (8)
  const PR = { period: 22, growth: 23, rev: 24, margin: 25, ebit: 26, nopat: 27, reinv: 28, fcff: 29, tv: 30, pv: 31 };
  put(ws, 1, 21, "PROJECTION");
  put(ws, 1, PR.period, "Period"); put(ws, 1, PR.growth, "Revenue growth"); put(ws, 1, PR.rev, "Revenue");
  put(ws, 1, PR.margin, "EBIT margin"); put(ws, 1, PR.ebit, "EBIT"); put(ws, 1, PR.nopat, "NOPAT");
  put(ws, 1, PR.reinv, "− Reinvestment"); put(ws, 1, PR.fcff, "FCFF"); put(ws, 1, PR.tv, "Terminal value"); put(ws, 1, PR.pv, "PV of FCFF");
  // headers
  put(ws, 2, PR.period, "Base"); for (let y = 1; y <= 5; y++) put(ws, 2 + y, PR.period, y); put(ws, 8, PR.period, "Terminal");
  // base column
  put(ws, 2, PR.rev, F(`B${AR.baseRev}`, i.baseRevenue));
  put(ws, 2, PR.margin, i.baseEbitMargin);
  // year columns
  for (let y = 1; y <= 5; y++) {
    const c = 2 + y; const cl = col(c); const pcl = col(c - 1);
    put(ws, c, PR.growth, r.years[y - 1].growth);
    put(ws, c, PR.rev, F(`${pcl}${PR.rev}*(1+${cl}${PR.growth})`, r.years[y - 1].revenue));
    put(ws, c, PR.margin, r.years[y - 1].margin);
    put(ws, c, PR.ebit, F(`${cl}${PR.rev}*${cl}${PR.margin}`, r.years[y - 1].ebit));
    put(ws, c, PR.nopat, F(`${cl}${PR.ebit}*(1-$B$${AR.tax})`, r.years[y - 1].nopat));
    put(ws, c, PR.reinv, F(`$B$${AR.capex}*${cl}${PR.rev}+$B$${AR.wc}*(${cl}${PR.rev}-${pcl}${PR.rev})-$B$${AR.da}*${cl}${PR.rev}`, r.years[y - 1].reinvest));
    put(ws, c, PR.fcff, F(`${cl}${PR.nopat}-${cl}${PR.reinv}`, r.years[y - 1].fcff));
    put(ws, c, PR.pv, F(`${cl}${PR.fcff}/(1+$B$${AR.wacc})^(${cl}${PR.period}-$B$${AR.mid})`, r.years[y - 1].pv));
  }
  // terminal column H=8
  put(ws, 8, PR.growth, F(`$B$${AR.tg}`, i.terminalGrowth));
  put(ws, 8, PR.rev, F(`G${PR.rev}*(1+$B$${AR.tg})`, r.terminal.revenue));
  put(ws, 8, PR.margin, F(`G${PR.margin}`, i.ebitMargin[4]));
  put(ws, 8, PR.ebit, F(`H${PR.rev}*H${PR.margin}`, r.terminal.ebit));
  put(ws, 8, PR.nopat, F(`H${PR.ebit}*(1-$B$${AR.tax})`, r.terminal.nopat));
  put(ws, 8, PR.reinv, F(`H${PR.nopat}*$B$${AR.rir}`, r.terminal.reinvest));
  put(ws, 8, PR.fcff, F(`H${PR.nopat}-H${PR.reinv}`, r.terminal.fcff));
  put(ws, 8, PR.tv, F(`H${PR.fcff}/($B$${AR.wacc}-$B$${AR.tg})`, r.terminal.tv));
  put(ws, 8, PR.pv, F(`H${PR.tv}/(1+$B$${AR.wacc})^(5-$B$${AR.mid})`, r.terminal.pvTv));

  // bridge
  const BR = { pvop: 34, cash: 35, nonop: 36, debt: 37, eq: 38, priced: 39, ps: 40, psl: 41 };
  put(ws, 1, 33, "VALUATION BRIDGE");
  put(ws, 1, BR.pvop, "PV of operating assets"); put(ws, 2, BR.pvop, F(`SUM(C${PR.pv}:H${PR.pv})`, r.pvOperating));
  put(ws, 1, BR.cash, "+ Cash & equivalents"); put(ws, 2, BR.cash, F(`B${AR.cash}`, i.cash));
  put(ws, 1, BR.nonop, "+ Non-operating assets"); put(ws, 2, BR.nonop, F(`B${AR.nonop}`, i.nonOpAssets));
  put(ws, 1, BR.debt, "− Total debt"); put(ws, 2, BR.debt, F(`-B${AR.debt}`, -i.totalDebt));
  put(ws, 1, BR.eq, "PV of equity (B/S date)"); put(ws, 2, BR.eq, F(`B${BR.pvop}+B${BR.cash}+B${BR.nonop}+B${BR.debt}`, r.equityValue));
  put(ws, 1, BR.priced, "Equity value at pricing date"); put(ws, 2, BR.priced, F(`B${BR.eq}*(1+$B$${AR.wacc})^$B$${AR.roll}`, r.equityValuePriced));
  put(ws, 1, BR.ps, `Intrinsic value / share (${i.currency})`); put(ws, 2, BR.ps, F(`B${BR.priced}/$B$${AR.shares}*(1-$B$${AR.illiq})`, r.perShare));
  put(ws, 1, BR.psl, "Intrinsic value / share (local)"); put(ws, 2, BR.psl, F(`B${BR.ps}*$B$${AR.fx}`, r.perShareLocal));

  // market comparison
  put(ws, 1, 43, "MARKET COMPARISON");
  put(ws, 1, 44, "Last traded (local)"); put(ws, 2, 44, i.lastTraded);
  put(ws, 1, 45, "Premium / (discount) vs last"); put(ws, 2, 45, F(`B${BR.psl}/B44-1`, r.premiumVsLast));
  put(ws, 1, 46, "30-day VWAP (local)"); put(ws, 2, 46, i.vwap);
  put(ws, 1, 47, "Premium / (discount) vs VWAP"); put(ws, 2, 47, F(`B${BR.psl}/B46-1`, r.premiumVsVwap));
  put(ws, 1, 48, "Verdict"); put(ws, 2, 48, r.verdict);

  ws["!ref"] = `A1:H48`;
  ws["!cols"] = [{ wch: 34 }, { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, ws, "Valuation (FCFF)");

  // ---------- Scenarios ----------
  const scn = scenarioTable(i);
  const s = XLSX.utils.aoa_to_sheet([["Scenario", `Value/share (${i.currency ? "local" : ""})`, "Verdict"], ...scn.map((x) => [x.label, Number(x.perShareLocal.toFixed(3)), x.verdict])]);
  s["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 16 }]; XLSX.utils.book_append_sheet(wb, s, "Scenarios");

  // ---------- Sensitivity (WACC x terminal growth) ----------
  const sens = fcffSensitivity(i);
  const head = ["WACC \\ g", ...sens.growths.map((g) => `${(g * 100).toFixed(1)}%`)];
  const body = sens.waccs.map((w, wi) => [`${(w * 100).toFixed(1)}%`, ...sens.grid[wi].map((v) => Number(v.toFixed(3)))]);
  const se = XLSX.utils.aoa_to_sheet([["Sensitivity — intrinsic value / share (local)"], head, ...body]);
  se["!cols"] = [{ wch: 12 }, ...sens.growths.map(() => ({ wch: 11 }))]; XLSX.utils.book_append_sheet(wb, se, "Sensitivity");

  // ---------- Relative valuation (comps) ----------
  if (rel) {
    const aoa: (string | number)[][] = [
      ["RELATIVE VALUATION — comparable companies"],
      ["Peer", "EV/EBITDA", "P/E"],
      ...rel.peers.map((p) => [p.name, p.evEbitda, p.pe]),
      ["Median", rel.evMultMid, rel.peMultMid],
      [],
      ["Subject EBITDA", rel.subjEbitda], ["Subject net income", rel.subjNi], ["Net debt", rel.netDebt], ["Shares", i.shares], ["FX (local/USD)", rel.fx],
      [],
      ["Football field — value / share (local)", "Low", "Mid", "High"],
      ...rel.rows.map((x) => [x.label, Number(x.low.toFixed(3)), Number(x.mid.toFixed(3)), Number(x.high.toFixed(3))]),
      ["Blended (avg of midpoints)", "", Number(rel.blended.toFixed(3)), ""],
      ["Current price (VWAP)", "", Number(rel.price.toFixed(3)), ""],
    ];
    const cs = XLSX.utils.aoa_to_sheet(aoa);
    cs["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, cs, "Relative valuation");
  }

  XLSX.writeFile(wb, `rulethu-valuation-${slug(i.company)}.xlsx`);
}

/* ---------------- PDF ---------------- */
const GREEN: [number, number, number] = [11, 110, 79];
const GOLD: [number, number, number] = [201, 162, 39];
const INK: [number, number, number] = [23, 43, 77];
const MUTED: [number, number, number] = [98, 111, 134];
const m0 = (n: number) => Math.round(n).toLocaleString("en-US");

export function fcffPdf(i: FcffInputs, r: FcffResult, notes: string, preparedBy?: string, rel?: RelativePack) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const W = doc.internal.pageSize.getWidth();
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 26, W, 1.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("RULETHU HOLDINGS", 14, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text("Equity Valuation — FCFF DCF", 14, 19);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(i.company, 14, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
  doc.text(`Valuation date ${i.valuationDate}   ·   Base ${i.baseYearLabel}   ·   ${i.currency}${preparedBy ? `   ·   ${preparedBy}` : ""}`, 14, 46);

  const vColor: [number, number, number] = r.verdict === "UNDERVALUED" ? GREEN : r.verdict === "OVERVALUED" ? [185, 18, 60] : [127, 95, 1];
  doc.setTextColor(vColor[0], vColor[1], vColor[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(`${r.verdict}   ·   Intrinsic ${i.currency} ${r.perShare.toFixed(3)} / share (${m0(i.exchangeRate)}× = ${r.perShareLocal.toFixed(3)} local)`, 14, 54);

  autoTable(doc, {
    startY: 60,
    head: [["Period", "Revenue", "EBIT", "NOPAT", "Reinvest", "FCFF", "PV"]],
    body: [
      ...r.years.map((y) => [y.label, m0(y.revenue), m0(y.ebit), m0(y.nopat), `(${m0(y.reinvest)})`, m0(y.fcff), m0(y.pv)]),
      ["Terminal", m0(r.terminal.revenue), m0(r.terminal.ebit), m0(r.terminal.nopat), `(${m0(r.terminal.reinvest)})`, m0(r.terminal.fcff), m0(r.terminal.pvTv)],
    ],
    styles: { fontSize: 8, cellPadding: 1.6, textColor: INK, halign: "right" },
    headStyles: { fillColor: GREEN, textColor: 255 }, columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });
  autoTable(doc, {
    startY: finalY() + 5,
    head: [["Valuation bridge", i.currency]],
    body: r.bridge.map((b) => [b.label, m0(b.value)]),
    styles: { fontSize: 8.5, cellPadding: 1.6, textColor: INK }, headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 1: { halign: "right" } }, margin: { left: 14, right: 14 },
  });

  // assumptions two-up
  const asm = r.assumptions; const half = Math.ceil(asm.length / 2);
  autoTable(doc, {
    startY: finalY() + 5,
    head: [["Assumption", "Value", "Assumption", "Value"]],
    body: Array.from({ length: half }, (_, k) => [asm[k]?.label ?? "", asm[k]?.value ?? "", asm[k + half]?.label ?? "", asm[k + half]?.value ?? ""]),
    styles: { fontSize: 7.5, cellPadding: 1.4, textColor: INK }, headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } }, margin: { left: 14, right: 14 },
  });

  // Relative valuation + football field
  if (rel) {
    autoTable(doc, {
      startY: finalY() + 5,
      head: [["Method (value/share, local)", "Low", "Mid", "High"]],
      body: [
        ...rel.rows.map((x) => [x.label, x.low.toFixed(2), x.mid.toFixed(2), x.high.toFixed(2)]),
        ["Blended (avg of midpoints)", "", rel.blended.toFixed(2), ""],
        ["Current price (VWAP)", "", rel.price.toFixed(2), ""],
      ],
      styles: { fontSize: 8.5, cellPadding: 1.6, textColor: INK }, headStyles: { fillColor: GREEN, textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right", fontStyle: "bold" }, 3: { halign: "right" } },
      didParseCell: (d) => { const raw = d.row.raw as (string | number)[]; if (d.section === "body" && /^Blended/.test(String(raw[0]))) d.cell.styles.fontStyle = "bold"; },
      margin: { left: 14, right: 14 },
    });
    autoTable(doc, {
      startY: finalY() + 4,
      head: [["Comparable", "EV/EBITDA", "P/E"]],
      body: [...rel.peers.map((p) => [p.name, `${p.evEbitda.toFixed(1)}x`, `${p.pe.toFixed(1)}x`]), ["Median", `${rel.evMultMid.toFixed(1)}x`, `${rel.peMultMid.toFixed(1)}x`]],
      styles: { fontSize: 8, cellPadding: 1.4, textColor: INK }, headStyles: { fillColor: GREEN, textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } }, margin: { left: 14, right: 14 },
    });
  }

  if (notes && notes.trim()) {
    doc.addPage(); let y = 20;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text("Valuation note", 14, y); y += 2;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(14, y, W - 14, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
    for (const para of notes.trim().split(/\n{2,}/)) {
      for (const ln of doc.splitTextToSize(para.trim(), W - 28) as string[]) { if (y > 284) { doc.addPage(); y = 20; } doc.text(ln, 14, y); y += 5; }
      y += 2.5;
    }
  }
  const stamp = new Date().toLocaleString("en-GB"); const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(`Rulethu Holdings · Confidential · indicative valuation, not advice · ${stamp}`, 14, doc.internal.pageSize.getHeight() - 8); doc.text(`Page ${p} of ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" }); }
  doc.save(`rulethu-valuation-${slug(i.company)}.pdf`);
}
