// Financial-statement exports.
//  - Excel: a workbook with TRACEABLE formulas. The Income Statement and Balance
//    Sheet cells are live formulas that reference the Trial Balance sheets, which
//    in turn reference the per-account debit/credit — so an auditor can click any
//    figure and follow it down to the books.
//  - PDF: a branded statement pack with management commentary.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PeriodReport, keyRatios } from "./finperiods";
import { TBAccount } from "./accounting";

const money = (n: number) => Math.round(n);

/* ---------------- Excel ---------------- */

interface TBSheet { name: string; rowOf: Record<string, number> } // code -> 1-based row of its data

function buildTBSheet(tb: TBAccount[]): { aoa: (string | number)[][]; rowOf: Record<string, number>; totalRow: number } {
  const aoa: (string | number)[][] = [["Code", "Account", "Type", "Debit", "Credit", "Net (Dr-Cr)"]];
  const rowOf: Record<string, number> = {};
  tb.forEach((a) => { rowOf[a.code] = aoa.length + 1; aoa.push([a.code, a.name, a.type, money(a.debit), money(a.credit), 0]); });
  const totalRow = aoa.length + 1;
  aoa.push(["", "TOTALS", "", 0, 0, 0]);
  return { aoa, rowOf, totalRow };
}

const F = (f: string, v: number) => ({ t: "n" as const, f, v });

export function financialsXlsx(r: PeriodReport, commentary: string) {
  const wb = XLSX.utils.book_new();
  const A = XLSX.utils.encode_cell;

  // --- Trial balance sheets (period + cumulative) ---
  const mkTB = (tb: TBAccount[], sheetName: string): TBSheet => {
    const { aoa, rowOf, totalRow } = buildTBSheet(tb);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Net column F = Debit - Credit (per row), with computed value
    tb.forEach((a) => { const row = rowOf[a.code]; ws[A({ c: 5, r: row - 1 })] = F(`D${row}-E${row}`, money(a.debit - a.credit)); });
    // Totals
    const dSum = money(tb.reduce((s, a) => s + a.debit, 0)), cSum = money(tb.reduce((s, a) => s + a.credit, 0));
    ws[A({ c: 3, r: totalRow - 1 })] = F(`SUM(D2:D${totalRow - 1})`, dSum);
    ws[A({ c: 4, r: totalRow - 1 })] = F(`SUM(E2:E${totalRow - 1})`, cSum);
    ws["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return { name: sheetName, rowOf };
  };
  const tbP = mkTB(r.flowTrialBalance, "TB (Period)");
  const tbC = mkTB(r.cumTrialBalance, "TB (Cumulative)");

  const ref = (sheet: TBSheet, code: string, negate: boolean) => {
    const row = sheet.rowOf[code];
    if (!row) return null;
    return `${negate ? "-" : ""}'${sheet.name}'!F${row}`;
  };

  // --- Income Statement (references TB (Period)) ---
  {
    const aoa: (string | number)[][] = [
      [`Rulethu Holdings — Income Statement`], [r.def.label], [`${r.def.start} to ${r.def.end}`], [],
      ["Revenue", ""],
    ];
    const incomeRows: number[] = [];
    r.incomeLines.forEach((l) => { aoa.push([`  ${l.name}`, money(l.amount)]); incomeRows.push(aoa.length); });
    aoa.push(["Total revenue", 0]); const revRow = aoa.length;
    aoa.push([]);
    aoa.push(["Expenses", ""]);
    const expRows: number[] = [];
    r.expenseLines.forEach((l) => { aoa.push([`  ${l.name}`, money(l.amount)]); expRows.push(aoa.length); });
    aoa.push(["Total expenses", 0]); const expRow = aoa.length;
    aoa.push([]);
    aoa.push(["Net profit / (loss)", 0]); const npRow = aoa.length;

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // income line cells reference TB(Period) Net, negated (income is credit-normal)
    r.incomeLines.forEach((l, i) => { const f = ref(tbP, l.code, true); if (f) ws[A({ c: 1, r: incomeRows[i] - 1 })] = F(f, money(l.amount)); });
    r.expenseLines.forEach((l, i) => { const f = ref(tbP, l.code, false); if (f) ws[A({ c: 1, r: expRows[i] - 1 })] = F(f, money(l.amount)); });
    if (incomeRows.length) ws[A({ c: 1, r: revRow - 1 })] = F(`SUM(B${incomeRows[0]}:B${incomeRows[incomeRows.length - 1]})`, money(r.revenue));
    if (expRows.length) ws[A({ c: 1, r: expRow - 1 })] = F(`SUM(B${expRows[0]}:B${expRows[expRows.length - 1]})`, money(r.expenses));
    ws[A({ c: 1, r: npRow - 1 })] = F(`B${revRow}-B${expRow}`, money(r.netProfit));
    ws["!cols"] = [{ wch: 34 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Income Statement");
  }

  // --- Balance Sheet (references TB (Cumulative)) ---
  {
    const aoa: (string | number)[][] = [
      [`Rulethu Holdings — Balance Sheet`], [`As at ${r.def.end}`], [],
      ["Assets", ""],
    ];
    const assetRows: number[] = [];
    r.assetLines.forEach((l) => { aoa.push([`  ${l.name}`, money(l.amount)]); assetRows.push(aoa.length); });
    aoa.push(["Total assets", 0]); const taRow = aoa.length;
    aoa.push([]);
    aoa.push(["Liabilities", ""]);
    const liabRows: number[] = [];
    r.liabilityLines.forEach((l) => { aoa.push([`  ${l.name}`, money(l.amount)]); liabRows.push(aoa.length); });
    aoa.push(["Total liabilities", 0]); const tlRow = aoa.length;
    aoa.push([]);
    aoa.push(["Equity", ""]);
    const eqRows: number[] = [];
    r.equityLines.forEach((l) => { aoa.push([`  ${l.name}`, money(l.amount)]); eqRows.push(aoa.length); });
    aoa.push([`  Retained earnings — period`, money(r.retainedEarnings)]); const reRow = aoa.length;
    aoa.push(["Total equity", 0]); const teRow = aoa.length;
    aoa.push([]);
    aoa.push(["Liabilities + Equity", 0]); const leRow = aoa.length;
    aoa.push(["Check (Assets - L - E)", 0]); const chkRow = aoa.length;

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    r.assetLines.forEach((l, i) => { const f = ref(tbC, l.code, false); if (f) ws[A({ c: 1, r: assetRows[i] - 1 })] = F(f, money(l.amount)); });
    r.liabilityLines.forEach((l, i) => { const f = ref(tbC, l.code, true); if (f) ws[A({ c: 1, r: liabRows[i] - 1 })] = F(f, money(l.amount)); });
    r.equityLines.forEach((l, i) => { const f = ref(tbC, l.code, true); if (f) ws[A({ c: 1, r: eqRows[i] - 1 })] = F(f, money(l.amount)); });
    if (assetRows.length) ws[A({ c: 1, r: taRow - 1 })] = F(`SUM(B${assetRows[0]}:B${assetRows[assetRows.length - 1]})`, money(r.totalAssets));
    if (liabRows.length) ws[A({ c: 1, r: tlRow - 1 })] = F(`SUM(B${liabRows[0]}:B${liabRows[liabRows.length - 1]})`, money(r.totalLiabilities));
    const eqFirst = eqRows[0] ?? reRow;
    ws[A({ c: 1, r: teRow - 1 })] = F(`SUM(B${eqFirst}:B${reRow})`, money(r.totalEquity));
    ws[A({ c: 1, r: leRow - 1 })] = F(`B${tlRow}+B${teRow}`, money(r.totalLiabilities + r.totalEquity));
    ws[A({ c: 1, r: chkRow - 1 })] = F(`B${taRow}-B${leRow}`, money(r.bsDifference));
    ws["!cols"] = [{ wch: 34 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
  }

  // --- Key ratios sheet ---
  {
    const rows = keyRatios(r).map((k) => [k.label, k.value, k.basis, k.explain]);
    const ws = XLSX.utils.aoa_to_sheet([["Key ratio", "Value", "How it is calculated", "What it means"], ...rows]);
    ws["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 34 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, "Key Ratios");
  }

  // --- Commentary sheet ---
  {
    const lines = (commentary || "No commentary.").split("\n").map((l) => [l]);
    const ws = XLSX.utils.aoa_to_sheet([["Management commentary"], [`${r.def.label}`], [], ...lines]);
    ws["!cols"] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, ws, "Commentary");
  }

  XLSX.writeFile(wb, `rulethu-financials-${r.def.label.replace(/[^\w]+/g, "-")}.xlsx`);
}

/* ---------------- PDF ---------------- */
const GREEN: [number, number, number] = [11, 110, 79];
const GOLD: [number, number, number] = [201, 162, 39];
const INK: [number, number, number] = [23, 43, 77];
const MUTED: [number, number, number] = [98, 111, 134];
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const finalY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export function financialsPdf(r: PeriodReport, commentary: string, preparedBy?: string) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const W = doc.internal.pageSize.getWidth();
  const nf = (n: number) => usd(n);

  // ---- Cover / letterhead ----
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 26, W, 1.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("RULETHU HOLDINGS", 14, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text("Financial Statements", 14, 19);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text(r.def.label, 14, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
  doc.text(`For the period ${r.def.start} to ${r.def.end}`, 14, 47);
  doc.text("Basis of preparation: accruals basis, historical cost, in USD, drawn directly from the General Ledger.", 14, 52.5);
  doc.text(`Prepared by: ${preparedBy ?? "Finance"}   ·   Status: ${r.plBalanced && r.bsBalanced ? "Balanced and ready" : "Under review"}`, 14, 58);

  const RED: [number, number, number] = [185, 18, 60];
  const bc = r.plBalanced && r.bsBalanced ? GREEN : RED;
  doc.setTextColor(bc[0], bc[1], bc[2]);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text(r.plBalanced && r.bsBalanced ? "Integrity checks passed — debits = credits and Assets = Liabilities + Equity." : "Review — statements are out of balance.", 14, 64);

  // ---- Income Statement ----
  autoTable(doc, {
    startY: 70,
    head: [["A/C", "Income Statement", r.def.label, r.prior ? "Prior" : ""]],
    body: [
      ...r.incomeLines.map((l) => [l.code, l.name, nf(l.amount), ""]),
      ["", "Total revenue", nf(r.revenue), r.prior ? nf(r.prior.revenue) : ""],
      ...r.expenseLines.map((l) => [l.code, l.name, `(${nf(l.amount)})`, ""]),
      ["", "Total expenses", `(${nf(r.expenses)})`, r.prior ? `(${nf(r.prior.expenses)})` : ""],
      ["", "Net profit / (loss)", nf(r.netProfit), r.prior ? nf(r.prior.netProfit) : ""],
    ],
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 0: { cellWidth: 14, textColor: MUTED }, 2: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (d) => { const raw = d.row.raw as (string | number)[]; if (d.section === "body" && /^Total|^Net profit/.test(String(raw[1]))) d.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14 },
  });

  // ---- Balance Sheet ----
  autoTable(doc, {
    startY: finalY(doc) + 6,
    head: [["A/C", `Balance Sheet — as at ${r.def.end}`, ""]],
    body: [
      ...r.assetLines.map((l) => [l.code, l.name, nf(l.amount)]),
      ["", "Total assets", nf(r.totalAssets)],
      ...r.liabilityLines.map((l) => [l.code, l.name, nf(l.amount)]),
      ["", "Total liabilities", nf(r.totalLiabilities)],
      ...r.equityLines.map((l) => [l.code, l.name, nf(l.amount)]),
      ["", "Retained earnings — period", nf(r.retainedEarnings)],
      ["", "Total equity", nf(r.totalEquity)],
      ["", "Liabilities + Equity", nf(r.totalLiabilities + r.totalEquity)],
    ],
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 0: { cellWidth: 14, textColor: MUTED }, 2: { halign: "right" } },
    didParseCell: (d) => { const raw = d.row.raw as (string | number)[]; if (d.section === "body" && /^Total|^Liabilities \+/.test(String(raw[1]))) d.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14 },
  });

  // ---- Cash Flow summary (reconciled to the bank balance) ----
  const adj = r.cashMovement - r.netProfit;
  autoTable(doc, {
    startY: finalY(doc) + 6,
    head: [["Cash Flow summary", ""]],
    body: [
      ["Opening cash at bank", nf(r.cashOpen)],
      ["Net profit for the period", nf(r.netProfit)],
      ["Adjustments & other movements (working capital, investing, financing)", nf(adj)],
      ["Net change in cash", nf(r.cashMovement)],
      ["Closing cash at bank", nf(r.cashClose)],
    ],
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (d) => { const raw = d.row.raw as (string | number)[]; if (d.section === "body" && /^Net change|^Closing cash/.test(String(raw[0]))) d.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14 },
  });

  // ---- Key Ratios (with the maths shown) ----
  autoTable(doc, {
    startY: finalY(doc) + 6,
    head: [["Key ratio", "Value", "How it is calculated", "What it means"]],
    body: keyRatios(r).map((k) => [k.label, k.value, k.basis, k.explain]),
    styles: { fontSize: 8, cellPadding: 1.8, textColor: INK, valign: "middle" },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 0: { cellWidth: 34, fontStyle: "bold" }, 1: { cellWidth: 18, halign: "right" }, 2: { cellWidth: 40 }, 3: { cellWidth: "auto" } },
    margin: { left: 14, right: 14 },
  });

  // ---- Notes & analysis (AI explains the calculations and interprets them) ----
  if (commentary && commentary.trim()) {
    doc.addPage();
    doc.setFillColor(...GREEN); doc.rect(0, 0, W, 10, "F");
    let y = 20;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text("Notes & analysis", 14, y); y += 2;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(14, y, W - 14, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
    for (const para of commentary.trim().split(/\n{2,}/)) {
      const lines = doc.splitTextToSize(para.trim(), W - 28) as string[];
      for (const ln of lines) { if (y > 284) { doc.addPage(); y = 20; } doc.text(ln, 14, y); y += 5; }
      y += 2.5;
    }
  }

  const stamp = new Date().toLocaleString("en-GB");
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(`Rulethu Holdings · Confidential · generated ${stamp}`, 14, doc.internal.pageSize.getHeight() - 8); doc.text(`Page ${i} of ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" }); }
  doc.save(`rulethu-financials-${r.def.label.replace(/[^\w]+/g, "-")}.pdf`);
}
