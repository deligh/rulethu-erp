// Investment Committee memo → professional PDF. A clean, boardroom-ready one/
// two-pager: cover block, recommendation lozenge, thesis, highlights, valuation,
// risks & mitigants, proposed terms and next steps.

import { jsPDF } from "jspdf";

export interface MemoDoc {
  subject: string;        // deal / company name
  sector: string;
  country: string;
  ticket: string;         // formatted, e.g. "$14.0M"
  recommendation: string; // BUY / HOLD / PASS / PROCEED / DECLINE
  thesis: string;
  highlights: string[];
  valuation: string;
  risks: string[];
  mitigants: string[];
  terms: string;
  nextSteps: string[];
  author: string;
  date: string;           // display date
}

const GREEN: [number, number, number] = [11, 110, 79];
const INK: [number, number, number] = [31, 41, 55];
const MUTE: [number, number, number] = [107, 114, 128];

export function icMemoPdf(m: MemoDoc): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const maxW = W - M * 2;
  let y = M;

  const ensure = (need: number) => { if (y + need > doc.internal.pageSize.getHeight() - M) { doc.addPage(); y = M; } };

  // Header band
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GREEN);
  doc.text("RULETHU HOLDINGS", M, y);
  doc.setTextColor(...MUTE); doc.setFont("helvetica", "normal");
  doc.text("INVESTMENT COMMITTEE MEMORANDUM", W - M, y, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...INK);
  doc.text(m.subject, M, y); y += 20;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTE);
  doc.text(`${m.sector}  ·  ${m.country}  ·  Ticket ${m.ticket}`, M, y); y += 14;
  doc.text(`Prepared by ${m.author}  ·  ${m.date}`, M, y); y += 20;

  // Recommendation lozenge
  const rec = (m.recommendation || "").toUpperCase();
  const neg = /PASS|DECLINE|NO/.test(rec);
  doc.setFillColor(...(neg ? [185, 28, 28] : GREEN) as [number, number, number]);
  doc.roundedRect(M, y - 11, 150, 22, 4, 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text(`RECOMMENDATION: ${rec}`, M + 8, y + 4);
  y += 28;

  const heading = (t: string) => {
    ensure(28); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...GREEN);
    doc.text(t.toUpperCase(), M, y); y += 4;
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.6); doc.line(M, y, M + maxW, y); y += 12;
  };
  const para = (t: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(t || "—", maxW);
    for (const ln of lines) { ensure(14); doc.text(ln, M, y); y += 14; }
    y += 6;
  };
  const bullets = (items: string[]) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
    for (const it of (items.length ? items : ["—"])) {
      const lines = doc.splitTextToSize(it, maxW - 14);
      ensure(14);
      doc.setTextColor(...GREEN); doc.text("•", M, y); doc.setTextColor(...INK);
      doc.text(lines[0], M + 12, y); y += 14;
      for (let i = 1; i < lines.length; i++) { ensure(14); doc.text(lines[i], M + 12, y); y += 14; }
    }
    y += 6;
  };

  heading("Investment thesis"); para(m.thesis);
  heading("Key highlights"); bullets(m.highlights);
  heading("Valuation"); para(m.valuation);
  heading("Key risks"); bullets(m.risks);
  heading("Mitigants"); bullets(m.mitigants);
  heading("Proposed terms / structure"); para(m.terms);
  heading("Recommended next steps"); bullets(m.nextSteps);

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
    doc.text("Confidential — prepared for the Rulethu Holdings Investment Committee", M, doc.internal.pageSize.getHeight() - 24);
    doc.text(`Page ${p} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: "right" });
  }
  return doc;
}
