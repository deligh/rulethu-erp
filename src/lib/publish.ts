// Report publication helper — when a research report is published it should
// reach the group with (1) a real, comprehensive-but-short AI summary of the
// key points, and (2) the report itself attached (openable / printable to PDF).

import type { ResearchReport } from "./seed";
import type { Attachment } from "./store";
import { askClaude } from "./aiClient";

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The content the AI summarises / the attachment carries. */
function reportText(r: ResearchReport): string {
  if (r.body && r.body.trim()) return stripHtml(r.body).slice(0, 7000);
  return `Title: ${r.title}\nType: ${r.type}\nSummary: ${r.summary}\nSectors: ${(r.sectors ?? []).join(", ")}`;
}

/** A comprehensive but short AI summary (overview + key takeaways) for the chat post. */
export async function aiReportSummary(r: ResearchReport): Promise<string> {
  const text = await askClaude({
    system:
      "You are Rulethu AI. Summarise a research report for a group-chat announcement " +
      "at an African investment group in Harare. Write a tight, comprehensive-but-short " +
      "summary: ONE 2-3 sentence overview paragraph, then 3-5 **key takeaways** as bullet " +
      "points capturing the most important, specific points of the report (not generic " +
      "section names). Markdown only, no title. Be concrete; don't pad.",
    prompt: `REPORT CONTENT:\n${reportText(r)}\n\nWrite the summary now.`,
    model: "haiku",
    maxTokens: 600,
  });
  if (text) return text;
  // Fallback (no AI): a sensible non-placeholder summary.
  const items = (r.sectors ?? []).slice(0, 5);
  return `${r.summary}` + (items.length ? `\n\n**Key areas covered:**\n${items.map((s) => `• ${s}`).join("\n")}` : "");
}

/** Full branded HTML for the attachment — the report itself, printable to PDF. */
function brandedHtml(r: ResearchReport, summaryMd: string): string {
  if (r.body && r.body.trim()) return r.body; // already a branded, printable document
  const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = summaryMd.split("\n").map((line) => {
    const l = line.trim();
    if (!l) return "";
    if (/^[-•*]\s+/.test(l)) return `<li>${esc(l.replace(/^[-•*]\s+/, "")).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</li>`;
    return `<p>${esc(l).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`;
  }).join("\n").replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  const date = new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
    *{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Arial,sans-serif;color:#1a2b3c;font-size:13px;line-height:1.55}
    .page{max-width:800px;margin:0 auto;padding:30px 38px}
    .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0b5d52;padding-bottom:10px}
    .brand{font-weight:800;font-size:20px;color:#0b5d52}.brand .dot{color:#c9a227}.brand small{display:block;font-weight:600;font-size:10px;color:#667;letter-spacing:2px}
    .rlabel{text-align:right;font-weight:700;color:#0b5d52;font-size:12px}.rlabel small{display:block;font-weight:500;color:#667}
    h1{font-size:21px;margin:16px 0 2px}.meta{color:#667;font-size:12px;margin-bottom:14px}
    h2{color:#0b5d52;font-size:14px;border-bottom:1px solid #c9a227;padding-bottom:3px;margin:16px 0 4px}
    ul{margin:6px 0 6px 18px}li{margin:3px 0}p{margin:6px 0}
    .foot{margin-top:24px;border-top:2px solid #0b5d52;padding-top:10px;font-size:10.5px;color:#667}
  </style></head><body><div class="page">
    <div class="top"><div class="brand">RULETHU &amp; CO.<span class="dot">.</span><small>RESEARCH</small></div>
    <div class="rlabel">${esc(r.type)}<small>${esc(date)}</small></div></div>
    <h1>${esc(r.title)}</h1><div class="meta">Prepared by ${esc(r.author)} · Rulethu &amp; Co. Research</div>
    <h2>Summary</h2>${bodyHtml}
    <div class="foot"><b>Rulethu &amp; Co. Private Limited</b> — info@rulethu.com · rulethu.com. Informational only; not investment advice.</div>
  </div></body></html>`;
}

function toAttachment(r: ResearchReport, html: string): Attachment {
  const slug = (r.title || "report").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "report";
  let dataUrl = "";
  try {
    dataUrl = "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(html)));
  } catch {
    dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
  }
  return { name: `${slug}.html`, type: "text/html", size: html.length, dataUrl };
}

/** Prepare a report for publishing: a real AI summary + the report as an attachment. */
export async function preparePublication(r: ResearchReport): Promise<{ summary: string; attachment: Attachment }> {
  const summary = await aiReportSummary(r);
  const html = brandedHtml(r, summary);
  return { summary, attachment: toAttachment(r, html) };
}
