// Investment-model exports — turn any ModelResult into a shareable, in-house
// deliverable: an Excel workbook (assumptions + full projection + metrics) and
// a branded PDF with an AI investment interpretation.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ModelResult } from "./finmodels";

const GREEN: [number, number, number] = [11, 110, 79];
const GOLD: [number, number, number] = [201, 162, 39];
const INK: [number, number, number] = [23, 43, 77];
const MUTED: [number, number, number] = [98, 111, 134];

const slug = (s: string) => s.replace(/[^\w]+/g, "-").slice(0, 50);

export function modelXlsx(name: string, sector: string, result: ModelResult) {
  const wb = XLSX.utils.book_new();

  // Assumptions
  const a = XLSX.utils.aoa_to_sheet([["Assumption", "Value"], ...(result.assumptions ?? []).map((x) => [x.label, x.value])]);
  a["!cols"] = [{ wch: 28 }, { wch: 22 }]; XLSX.utils.book_append_sheet(wb, a, "Assumptions");

  // Metrics
  const m = XLSX.utils.aoa_to_sheet([["Metric", "Value", "Note"], ...result.kpis.map((k) => [k.label, k.value, k.hint ?? ""])]);
  m["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 28 }]; XLSX.utils.book_append_sheet(wb, m, "Key metrics");

  // Projection
  const header = ["Line", ...result.columns];
  const body = result.rows.map((r) => [r.label, ...r.cells]);
  const p = XLSX.utils.aoa_to_sheet([header, ...body]);
  p["!cols"] = [{ wch: 22 }, ...result.columns.map(() => ({ wch: 13 }))];
  XLSX.utils.book_append_sheet(wb, p, "Projection");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Model"], [name], [sector], ["Rulethu Holdings — in-house model"]]), "About");
  XLSX.writeFile(wb, `rulethu-model-${slug(name)}.xlsx`);
}

export function modelPdf(name: string, sector: string, result: ModelResult, aiText: string, preparedBy?: string) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const W = doc.internal.pageSize.getWidth();
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // cover
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 26, W, 1.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("RULETHU HOLDINGS", 14, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text("Investment Model", 14, 19);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(name, 14, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
  doc.text(`${sector}   ·   in-house model${preparedBy ? `   ·   prepared by ${preparedBy}` : ""}`, 14, 46);

  // headline metrics
  autoTable(doc, {
    startY: 52,
    head: [["Key metric", "Value", "Note"]],
    body: result.kpis.map((k) => [k.label, k.value, k.hint ?? ""]),
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 }, 1: { cellWidth: 30, halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  // assumptions (two-up)
  const asm = result.assumptions ?? [];
  const half = Math.ceil(asm.length / 2);
  autoTable(doc, {
    startY: finalY() + 6,
    head: [["Assumption", "Value", "Assumption", "Value"]],
    body: Array.from({ length: half }, (_, k) => [
      asm[k]?.label ?? "", asm[k]?.value ?? "", asm[k + half]?.label ?? "", asm[k + half]?.value ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.6, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  // projection (transposed to key lines so it fits portrait)
  const pick = (lbl: string) => result.rows.find((r) => r.label.startsWith(lbl))?.cells ?? [];
  const rev = pick("Revenue"), ebd = pick("EBITDA"), ni = pick("Net income"), cf = pick("CFADS"), dscr = pick("DSCR"), pfcf = pick("Project FCF"), efcf = pick("Equity FCF");
  const projBody = result.columns.map((c, idx) => [c, rev[idx] ?? "", ebd[idx] ?? "", ni[idx] ?? "", cf[idx] ?? "", dscr[idx] ?? "", pfcf[idx] ?? "", efcf[idx] ?? ""]);
  doc.addPage();
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text("Projection", 14, 18);
  autoTable(doc, {
    startY: 22,
    head: [["Year", "Revenue", "EBITDA", "Net income", "CFADS", "DSCR", "Project FCF", "Equity FCF"]],
    body: projBody,
    styles: { fontSize: 7.5, cellPadding: 1.3, textColor: INK, halign: "right" },
    headStyles: { fillColor: GREEN, textColor: 255, halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  // AI interpretation
  if (aiText && aiText.trim()) {
    let y = finalY() + 10;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text("Investment interpretation", 14, y); y += 2;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(14, y, W - 14, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
    for (const para of aiText.trim().split(/\n{2,}/)) {
      const lines = doc.splitTextToSize(para.trim(), W - 28) as string[];
      for (const ln of lines) { if (y > 284) { doc.addPage(); y = 20; } doc.text(ln, 14, y); y += 5; }
      y += 2.5;
    }
  }

  const stamp = new Date().toLocaleString("en-GB");
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(`Rulethu Holdings · Confidential · model is indicative, not advice · ${stamp}`, 14, doc.internal.pageSize.getHeight() - 8); doc.text(`Page ${i} of ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" }); }
  doc.save(`rulethu-model-${slug(name)}.pdf`);
}
