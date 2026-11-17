"use client";

import { ExportColumn, ExportRow, exportXlsx, exportPdf } from "@/lib/exporters";

// Reusable XLSX + PDF download buttons for any table of data.
export default function DownloadButtons({
  filename,
  title,
  subtitle,
  columns,
  rows,
  sheetName,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  sheetName?: string;
}) {
  const btn = "rounded-lg border px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1";
  const style = { borderColor: "var(--border)", color: "var(--text-muted)" };
  return (
    <div className="flex items-center gap-2 no-print">
      <button className={btn} style={style} onClick={() => exportXlsx(filename, columns, rows, sheetName)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
        XLSX
      </button>
      <button className={btn} style={style} onClick={() => exportPdf(filename, title, columns, rows, subtitle)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
        PDF
      </button>
    </div>
  );
}
