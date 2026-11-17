// Client-side export helpers for XLSX and PDF. Used by DownloadButtons.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  key: string;
  label: string;
}

export type ExportRow = Record<string, string | number>;

export function exportXlsx(
  filename: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  sheetName = "Sheet1",
) {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => r[c.key] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function exportPdf(
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  subtitle?: string,
) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  let startY = 22;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 22);
    doc.setTextColor(0);
    startY = 28;
  }
  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [11, 93, 82], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 246, 247] },
  });
  const stamp = new Date().toLocaleString("en-GB");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Rulethu Holdings · Confidential · generated ${stamp}`, 14, doc.internal.pageSize.getHeight() - 8);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
