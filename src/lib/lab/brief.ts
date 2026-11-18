// One-page PDF brief for any lab scenario — ready for Cabinet or a press briefing.

import type { Inputs, LabDef, LabResult } from "./types";

const GREEN: [number, number, number] = [11, 110, 79];
const GOLD: [number, number, number] = [201, 162, 39];
const RED: [number, number, number] = [200, 16, 46];
const INK: [number, number, number] = [23, 43, 77];
const MUTED: [number, number, number] = [98, 111, 134];

export async function downloadBrief(lab: LabDef, inputs: Inputs, r: LabResult, opts: { question?: string; aiBrief?: string | null; scenario?: string }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Header with flag-colour stripe
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 24, "F");
  const stripe = [GREEN, GOLD, RED, [20, 20, 20] as [number, number, number]];
  stripe.forEach((c, k) => { doc.setFillColor(...c); doc.rect((W / 4) * k, 24, W / 4, 1.6, "F"); });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("MINISTER'S DESK", 14, 11);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Economic Lab · ${lab.name} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, 14, 18);

  let y = 36;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  const title = opts.scenario ? `${lab.name}: ${opts.scenario}` : lab.name;
  doc.text(title, 14, y, { maxWidth: W - 28 }); y += 7;
  doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...MUTED);
  const q = doc.splitTextToSize(opts.question || lab.question, W - 28);
  doc.text(q, 14, y); y += q.length * 5 + 3;

  // Headline box
  doc.setFillColor(244, 248, 246); doc.roundedRect(14, y, W - 28, 25, 2, 2, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(r.headline.label, 19, y + 6);
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...(r.headline.tone === "bad" ? RED : GREEN)); doc.text(r.headline.value, 19, y + 14);
  if (r.headline.sub) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(r.headline.sub, 19, y + 20.5, { maxWidth: W - 38 }); }
  y += 31;

  autoTable(doc, {
    startY: y,
    head: [["Measure", "Value", "Note"]],
    body: r.metrics.map((m) => [m.label, m.value, m.sub ?? ""]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: 255 },
    margin: { left: 14, right: 14 },
  });
  // @ts-expect-error lastAutoTable is added by the plugin
  y = doc.lastAutoTable.finalY + 7;

  const section = (head: string, lines: string[], bullet = true) => {
    if (y > H - 40) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...GREEN); doc.text(head, 14, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
    for (const l of lines) {
      const t = doc.splitTextToSize((bullet ? "•  " : "") + l, W - 30);
      if (y + t.length * 4.6 > H - 16) { doc.addPage(); y = 20; }
      doc.text(t, 16, y); y += t.length * 4.6 + 1.2;
    }
    y += 3;
  };

  if (opts.aiBrief) section("Analyst brief", opts.aiBrief.split("\n").map((s) => s.replace(/^[-•]\s*/, "")).filter(Boolean), false);
  section("Key insights", r.insights);
  const changed = lab.inputs.filter((s) => inputs[s.key] !== s.default).map((s) => `${s.label}: ${s.options ? s.options.find((o) => o.value === inputs[s.key])?.label : inputs[s.key].toLocaleString("en-US")} ${s.options ? "" : s.unit} (default ${s.options ? s.options.find((o) => o.value === s.default)?.label : s.default.toLocaleString("en-US")})`);
  section("Assumptions changed from default", changed.length ? changed : ["None — all defaults."]);
  section("How it is calculated", r.working);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("Minister's Desk · figures are model estimates from approximate public data; verify before official use.", 14, H - 8);
    doc.text(`${p}/${pages}`, W - 20, H - 8);
  }
  doc.save(`Ministers-Desk-${lab.short}-brief.pdf`);
}
