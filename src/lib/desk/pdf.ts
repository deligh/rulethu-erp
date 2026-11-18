// Minister's Desk — shareable PDFs (minutes, briefs, drafts, scorecard).
// On phones, shareOrDownload() opens the native Share sheet (WhatsApp, email…);
// elsewhere it downloads the file.

import type { Commitment, Meeting } from "./store";
import { fmtDate, isOverdue } from "./store";

type RGB = [number, number, number];
const GREEN: RGB = [11, 110, 79], GOLD: RGB = [201, 162, 39], RED: RGB = [200, 16, 46], INK: RGB = [23, 43, 77], MUTED: RGB = [98, 111, 134];

async function newDoc(title: string, kicker: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 22, "F");
  ([GREEN, GOLD, RED, [20, 20, 20]] as RGB[]).forEach((c, k) => { doc.setFillColor(...c); doc.rect((W / 4) * k, 22, W / 4, 1.5, "F"); });
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("MINISTER'S DESK", 14, 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(kicker, 14, 16.5);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  const tl = doc.splitTextToSize(title, W - 28); doc.text(tl, 14, 33);
  return { doc, autoTable, W, H: doc.internal.pageSize.getHeight(), y: 33 + tl.length * 6.5 + 2 };
}

function writer(doc: import("jspdf").jsPDF, W: number, H: number, start: number) {
  let y = start;
  const ensure = (h: number) => { if (y + h > H - 16) { doc.addPage(); y = 20; } };
  return {
    get y() { return y; }, set y(v: number) { y = v; },
    head(t: string) { ensure(12); y += 3; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...GREEN); doc.text(t, 14, y); y += 6; },
    para(t: string, size = 10) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...INK);
      for (const block of t.split(/\n/)) {
        const lines = doc.splitTextToSize(block || " ", W - 28);
        for (const l of lines) { ensure(5); doc.text(l, 14, y); y += size * 0.47; }
        y += 1.2;
      }
    },
    bullets(items: string[]) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
      for (const it of items) { const lines = doc.splitTextToSize(it, W - 34); ensure(lines.length * 4.8); doc.text("•", 16, y); doc.text(lines, 20, y); y += lines.length * 4.8 + 1; }
    },
  };
}

function footer(doc: import("jspdf").jsPDF, W: number, H: number, note: string) {
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(note, 14, H - 8); doc.text(`${p}/${n}`, W - 20, H - 8); }
}

export async function minutesPdf(m: Meeting): Promise<{ blob: Blob; name: string }> {
  const { doc, autoTable, W, H, y } = await newDoc(m.title, `Minutes of meeting · ${fmtDate(m.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`);
  const w = writer(doc, W, H, y);
  doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
  w.para(`Attendees: ${m.attendees || "—"}${m.durationSec ? `   ·   Duration: ${Math.round(m.durationSec / 60)} min` : ""}`, 9.5);
  w.head("Summary"); w.para(m.summary || "—");
  if (m.decisions.length) { w.head("Decisions"); w.bullets(m.decisions); }
  if (m.actions.length) {
    w.head("Action items");
    autoTable(doc, { startY: w.y, head: [["#", "Action", "Owner", "Due"]], body: m.actions.map((a, k) => [String(k + 1), a.text, a.owner, fmtDate(a.due, { day: "numeric", month: "short", year: "numeric" })]), theme: "grid", styles: { fontSize: 9, cellPadding: 2, textColor: INK }, headStyles: { fillColor: GREEN, textColor: 255 }, columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 42 }, 3: { cellWidth: 26 } }, margin: { left: 14, right: 14 } });
    // @ts-expect-error added by autotable
    w.y = doc.lastAutoTable.finalY + 6;
  }
  if (m.transcript.trim()) { doc.addPage(); w.y = 20; w.head("Appendix: transcript"); w.para(m.transcript, 8.5); }
  footer(doc, W, H, `Minister's Desk · ${m.minutesBy === "ai" ? "Minutes drafted by AI from the transcript — check before circulating" : "Minutes"} · Confidential`);
  return { blob: doc.output("blob"), name: `Minutes-${m.date}-${m.title.replace(/[^\w]+/g, "-").slice(0, 40)}.pdf` };
}

export async function textPdf(title: string, kicker: string, body: string, note = "Minister's Desk · Confidential"): Promise<{ blob: Blob; name: string }> {
  const { doc, W, H, y } = await newDoc(title, kicker);
  const w = writer(doc, W, H, y);
  for (const block of body.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    if (lines[0] && lines[0] === lines[0].toUpperCase() && /[A-Z]/.test(lines[0]) && lines[0].length < 60) { w.head(lines[0]); w.para(lines.slice(1).join("\n")); }
    else w.para(block);
  }
  footer(doc, W, H, note);
  return { blob: doc.output("blob"), name: `${title.replace(/[^\w]+/g, "-").slice(0, 50)}.pdf` };
}

export async function scorecardPdf(cs: Commitment[]): Promise<{ blob: Blob; name: string }> {
  const { doc, autoTable, W, H, y } = await newDoc("Commitments scorecard", `As at ${fmtDate(new Date().toISOString().slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}`);
  const done = cs.filter((c) => c.status === "Done").length, od = cs.filter((c) => isOverdue(c)).length;
  doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(`${cs.length} commitments · ${done} done · ${od} overdue · ${cs.length - done - od} on track`, 14, y);
  autoTable(doc, {
    startY: y + 5, head: [["Commitment", "Owner", "Due", "Status"]],
    body: [...cs].sort((a, b) => a.due.localeCompare(b.due)).map((c) => [c.title, c.owner, fmtDate(c.due), isOverdue(c) ? "OVERDUE" : c.status]),
    theme: "grid", styles: { fontSize: 8.5, cellPadding: 1.8, textColor: INK }, headStyles: { fillColor: GREEN, textColor: 255 }, margin: { left: 14, right: 14 },
    didParseCell: (h) => { if (h.section === "body" && h.column.index === 3 && h.cell.raw === "OVERDUE") { h.cell.styles.textColor = RED; h.cell.styles.fontStyle = "bold"; } },
  });
  footer(doc, W, H, "Minister's Desk · Confidential");
  return { blob: doc.output("blob"), name: "Commitments-scorecard.pdf" };
}

export async function shareOrDownload(f: { blob: Blob; name: string }, title: string) {
  const file = new File([f.blob], f.name, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await nav.share({ files: [file], title }); return "shared"; } catch { /* cancelled → fall through to download */ }
  }
  const url = URL.createObjectURL(f.blob);
  const a = document.createElement("a"); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
