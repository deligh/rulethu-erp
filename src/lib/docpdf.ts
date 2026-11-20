// Branded PDF documents (minutes, project snapshots) — jsPDF + autotable.
// Produces a shareable, printable A4 PDF with the Rulethu green/gold identity.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const GREEN: [number, number, number] = [11, 110, 79];
const GOLD: [number, number, number] = [201, 162, 39];
const INK: [number, number, number] = [23, 43, 77];
const MUTED: [number, number, number] = [98, 111, 134];

function header(doc: jsPDF, title: string, kicker: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 22, W, 1.4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("RULETHU HOLDINGS", 14, 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(kicker, 14, 16);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(title, 14, 34, { maxWidth: W - 28 });
}

function footer(doc: jsPDF) {
  const stamp = new Date().toLocaleString("en-GB");
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Rulethu Holdings · Confidential · generated ${stamp}`, 14, H - 8);
    doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - 14, H - 8, { align: "right" });
  }
}

const bullets = (doc: jsPDF, items: string[], y: number): number => {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
  for (const it of items) {
    const lines = doc.splitTextToSize(it, W - 34) as string[];
    if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
    doc.setTextColor(...GREEN); doc.text("•", 16, y);
    doc.setTextColor(...INK); doc.text(lines, 21, y);
    y += lines.length * 5 + 2;
  }
  return y;
};

const section = (doc: jsPDF, label: string, y: number): number => {
  if (y > doc.internal.pageSize.getHeight() - 24) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), 14, y);
  return y + 5;
};

export interface MinutesDoc {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actions: { owner: string; task: string; due?: string }[];
}

export function minutesPdf(m: MinutesDoc, author?: string) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const W = doc.internal.pageSize.getWidth();
  header(doc, m.title || "Meeting minutes", "Meeting minutes");
  let y = 42;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  doc.text(`${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}${author ? ` · prepared by ${author}` : ""}`, 14, y);
  y += 8;

  if (m.summary) {
    y = section(doc, "Summary", y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(m.summary, W - 28) as string[];
    doc.text(lines, 14, y); y += lines.length * 5 + 4;
  }
  if (m.keyPoints.length) { y = section(doc, "Discussion", y); y = bullets(doc, m.keyPoints, y) + 2; }
  if (m.decisions.length) { y = section(doc, "Decisions", y); y = bullets(doc, m.decisions.map((d) => d), y) + 2; }

  if (m.actions.length) {
    y = section(doc, "Action items", y);
    autoTable(doc, {
      startY: y,
      head: [["#", "Owner", "Action", "Due"]],
      body: m.actions.map((a, i) => [String(i + 1), a.owner, a.task, a.due ?? "—"]),
      styles: { fontSize: 9, cellPadding: 2.5, textColor: INK },
      headStyles: { fillColor: GREEN, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 246, 247] },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 34 }, 3: { cellWidth: 26 } },
      margin: { left: 14, right: 14 },
    });
  }
  footer(doc);
  doc.save(`${(m.title || "minutes").replace(/[^\w]+/g, "-").slice(0, 50)}.pdf`);
}

export interface SnapshotMeta { label: string; value: string }

/** Project / task snapshot PDF — summary stats + a task table. */
export function tasksPdf(opts: {
  title: string;
  subtitle?: string;
  stats: SnapshotMeta[];
  columns: { header: string; width?: number }[];
  rows: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({ format: "a4", unit: "mm", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  header(doc, opts.title, opts.subtitle ?? "Project snapshot");
  let y = 42;

  // stat chips
  if (opts.stats.length) {
    const chipW = (W - 28 - (opts.stats.length - 1) * 4) / opts.stats.length;
    opts.stats.forEach((s, i) => {
      const x = 14 + i * (chipW + 4);
      doc.setFillColor(244, 246, 247); doc.roundedRect(x, y, chipW, 16, 2, 2, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...GREEN);
      doc.text(s.value, x + 4, y + 7);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(s.label.toUpperCase(), x + 4, y + 12);
    });
    y += 22;
  }

  autoTable(doc, {
    startY: y,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => r.map(String)),
    styles: { fontSize: 8.5, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: 255 },
    alternateRowStyles: { fillColor: [244, 246, 247] },
    columnStyles: Object.fromEntries(opts.columns.map((c, i) => [i, c.width ? { cellWidth: c.width } : {}])),
    margin: { left: 14, right: 14 },
  });
  footer(doc);
  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}

export interface ResearchDoc {
  title: string;
  scope: string;              // e.g. "Company · Zimbabwe"
  executiveSummary: string;
  keyFindings: string[];
  sections: { heading: string; body: string }[];
  risks: string[];
  outlook: string;
  sources: { label: string; url: string }[];
  author?: string;
}

/** Deep-research report → branded A4 PDF. */
export function researchPdf(r: ResearchDoc) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const W = doc.internal.pageSize.getWidth();
  header(doc, r.title || "Research report", "Deep Research · Rulethu AI");
  let y = 42;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  doc.text(`${r.scope ? r.scope + "  ·  " : ""}${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}${r.author ? `  ·  ${r.author}` : ""}`, 14, y);
  y += 8;

  const para = (label: string, text: string) => {
    if (!text) return;
    y = section(doc, label, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(text, W - 28) as string[];
    if (y + lines.length * 5 > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
    doc.text(lines, 14, y); y += lines.length * 5 + 4;
  };

  para("Executive summary", r.executiveSummary);
  if (r.keyFindings.length) { y = section(doc, "Key findings", y); y = bullets(doc, r.keyFindings, y) + 2; }
  for (const s of r.sections) para(s.heading, s.body);
  if (r.risks.length) { y = section(doc, "Risks & watch-items", y); y = bullets(doc, r.risks, y) + 2; }
  para("Outlook", r.outlook);
  if (r.sources.length) {
    y = section(doc, "Sources", y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    for (const s of r.sources) {
      if (y > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); y = 20; }
      const line = doc.splitTextToSize(`• ${s.label} — ${s.url}`, W - 28) as string[];
      doc.text(line, 14, y); y += line.length * 4.5 + 1;
    }
  }
  footer(doc);
  doc.save(`${(r.title || "research").replace(/[^\w]+/g, "-").slice(0, 50)}.pdf`);
}
