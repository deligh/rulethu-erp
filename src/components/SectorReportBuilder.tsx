"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData, genId, CURRENT_USER } from "@/lib/store";
import type { ResearchReport } from "@/lib/seed";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { askClaude } from "@/lib/aiClient";
import { preparePublication } from "@/lib/publish";

type Sentiment = "Positive" | "Neutral" | "Negative";
interface SectorInput {
  name: string;
  sentiment: Sentiment;
  highlight: string;
  commentary: string;
  metricLabel: string;
  metricValue: string;
}

const SENT_COLOR: Record<Sentiment, string> = {
  Positive: "#16a34a",
  Neutral: "#b38600",
  Negative: "#dc2626",
};

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build the full branded, printable report document (used for preview, print and archive). */
function buildReportHtml(opts: {
  period: "Weekly" | "Monthly";
  reportType: string;
  title: string;
  dateLabel: string;
  author: string;
  summary: string;
  sectors: SectorInput[];
}): string {
  const filled = opts.sectors.filter((s) => s.highlight.trim() || s.commentary.trim());
  const sectionsHtml = filled
    .map(
      (s) => `
      <section class="sec">
        <div class="sec-head">
          <h2>${esc(s.name)}</h2>
          <span class="tag" style="color:${SENT_COLOR[s.sentiment]};border-color:${SENT_COLOR[s.sentiment]}">${s.sentiment}</span>
          ${s.metricValue.trim() ? `<span class="metric"><b>${esc(s.metricValue)}</b> <span class="ml">${esc(s.metricLabel)}</span></span>` : ""}
        </div>
        ${s.highlight.trim() ? `<p class="hl">${esc(s.highlight)}</p>` : ""}
        ${s.commentary.trim() ? `<p class="cm">${esc(s.commentary).replace(/\n/g, "<br/>")}</p>` : `<p class="cm muted">—</p>`}
      </section>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a2b3c;background:#fff;font-size:13px;line-height:1.5}
  .page{max-width:820px;margin:0 auto;padding:28px 34px}
  .top{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid #0b5d52;padding-bottom:10px}
  .brand{font-weight:800;font-size:20px;letter-spacing:.5px;color:#0b5d52}
  .brand small{display:block;font-weight:600;font-size:11px;color:#667;letter-spacing:2px}
  .rlabel{text-align:right;font-weight:700;color:#0b5d52}
  .rlabel small{display:block;font-weight:500;color:#667}
  h1{font-size:22px;margin:16px 0 2px}
  .meta{color:#667;font-size:12px;margin-bottom:16px}
  .exec{background:#f3f7f6;border-left:4px solid #0b5d52;padding:12px 14px;border-radius:0 6px 6px 0;margin-bottom:18px}
  .exec h3{margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#0b5d52}
  .sec{padding:12px 0;border-top:1px solid #e5eae8}
  .sec-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
  .sec-head h2{font-size:15px;margin:0;color:#0b5d52}
  .tag{font-size:10px;font-weight:700;text-transform:uppercase;border:1px solid;border-radius:3px;padding:1px 6px}
  .metric{margin-left:auto;font-size:12px;color:#1a2b3c}
  .metric .ml{color:#667;font-weight:400}
  .hl{font-weight:600;margin:4px 0}
  .cm{margin:4px 0;color:#33475b}
  .muted{color:#98a2b3}
  .foot{margin-top:22px;border-top:2px solid #0b5d52;padding-top:10px;font-size:11px;color:#667}
  .foot b{color:#0b5d52}
  .disc{margin-top:8px;font-size:9.5px;color:#98a2b3;line-height:1.4}
  @media print{.page{padding:16px 20px}}
</style></head>
<body><div class="page">
  <div class="top">
    <div class="brand">RULETHU &amp; CO.<small>PRIVATE LIMITED</small></div>
    <div class="rlabel">| RESEARCH<small>${esc(opts.reportType)}</small></div>
  </div>
  <h1>${esc(opts.title)}</h1>
  <div class="meta">${esc(opts.dateLabel)} · Prepared by ${esc(opts.author)} · Rulethu &amp; Co. Research</div>
  ${opts.summary.trim() ? `<div class="exec"><h3>Executive Summary</h3><p style="margin:0">${esc(opts.summary).replace(/\n/g, "<br/>")}</p></div>` : ""}
  ${sectionsHtml || '<p class="muted">No sectors completed yet.</p>'}
  <div class="foot">
    <b>Rulethu &amp; Co. Private Limited</b> — an investment holding and development company focused on infrastructure, trade, primary industry and financial services.<br/>
    info@rulethu.com &nbsp;|&nbsp; +263 8677010018 &nbsp;|&nbsp; rulethu.com
    <div class="disc">DISCLAIMER: This document has been prepared by Rulethu &amp; Co. Private Limited solely for informational purposes. The views expressed are those of Rulethu at the time of publication and are subject to change without notice. This material does not constitute investment advice. Readers should consult qualified professionals before making investment decisions.</div>
  </div>
</div></body></html>`;
}

const DEFAULT_SECTORS = ["Infrastructure", "Energy", "Logistics", "Trade", "Mining", "Manufacturing", "Financial Services"];

export default function SectorReportBuilder({ period }: { period: "Weekly" | "Monthly" }) {
  const { reports, deals, market, publishReport } = useAppData();
  const reportType = period === "Weekly" ? "Weekly Sector Report" : "Monthly Report";

  const today = new Date();
  const defaultTitle =
    period === "Weekly"
      ? `Weekly Sector Report — week ending ${today.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`
      : `Monthly Report — ${today.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;

  const [title, setTitle] = useState(defaultTitle);
  const [dateStr, setDateStr] = useState(today.toISOString().slice(0, 10));
  const [author, setAuthor] = useState(CURRENT_USER);
  const [summary, setSummary] = useState("");
  const [sectors, setSectors] = useState<SectorInput[]>(
    DEFAULT_SECTORS.map((name) => ({ name, sentiment: "Neutral", highlight: "", commentary: "", metricLabel: "", metricValue: "" })),
  );
  const [published, setPublished] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  type Verdict = "ready" | "review" | "insufficient";
  const [screening, setScreening] = useState<{ verdict: Verdict; notes: string[] } | null>(null);
  const [recommendation, setRecommendation] = useState<string>("");
  const autoRan = useRef(false);

  const setSector = (i: number, patch: Partial<SectorInput>) =>
    setSectors((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  // Daily reports in this period's window — the raw material the AI consolidates.
  const windowDays = period === "Weekly" ? 8 : 32;
  const sinceIso = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const sourceDailies = useMemo(
    () => reports
      .filter((r) => r.date >= sinceIso && /Daily|Flash|Intelligence/.test(r.type))
      .map((r) => ({ date: r.date, title: r.title, summary: r.summary, sectors: r.sectors })),
    [reports, sinceIso],
  );

  /** AI consolidates the period's dailies (+ market & pipeline context) into a
   *  proposed draft. It PRE-FILLS the form; the researcher then verifies/edits
   *  and clicks Publish. Nothing is published automatically. */
  const draftWithAI = async () => {
    setAiBusy(true); setAiMsg(null);
    const ctx = {
      period,
      dailyReports: sourceDailies,
      marketCommentary: market && !market.demo ? { headline: market.headline, prices: market.prices.map((p) => `${p.name} ${p.value} ${p.change ?? ""}`), commentary: market.commentary } : null,
      pipelineSectors: Array.from(new Set(deals.map((d) => d.sector))),
      sectors: DEFAULT_SECTORS,
    };
    const system =
      "You are Rulethu & Co.'s research desk. Consolidate the period's daily market " +
      "reports (and the market & pipeline context) into a concise, institutional " +
      `${period} Sector Report for an African investment group in Harare, Zimbabwe. ` +
      "For EACH sector in the provided list, give: a one-line highlight, a 2-3 " +
      "sentence commentary, a sentiment (Positive|Neutral|Negative), and a key " +
      "metric (value + short label) where sensible. Also write a 2-3 sentence " +
      "executive summary. Base it on the dailies; don't invent specific figures " +
      "you weren't given.\n" +
      "THEN SCREEN YOUR OWN OUTPUT as a diligence check before handing it to the lead researcher: " +
      "verify each sector's highlight/commentary is actually supported by the supplied dailies and market context; " +
      "flag any figure or claim you could not substantiate; note sectors with thin or no source coverage this period; " +
      "and check for internal contradictions. Then give the lead researcher a clear recommendation. " +
      "Set `verdict` to 'ready' (clean, publish-ready), 'review' (publishable after the noted edits) or " +
      "'insufficient' (too few dailies to consolidate reliably). `notes`: 0–5 concise screening flags. " +
      "`recommendation`: 1–2 sentences telling the lead what to do (publish as-is, edit X first, or gather more dailies).\n" +
      "Return ONLY JSON — no prose, no code fences — EXACTLY:\n" +
      '{"summary": string, "sectors": [{"name": string, "sentiment": "Positive"|"Neutral"|"Negative", "highlight": string, "commentary": string, "metricValue": string, "metricLabel": string}], ' +
      '"screening": {"verdict": "ready"|"review"|"insufficient", "notes": [string]}, "recommendation": string}\n' +
      "Use the exact sector names provided, in that order.";
    const text = await askClaude({
      system,
      prompt: `CONTEXT (JSON):\n${JSON.stringify(ctx)}\n\nProduce the ${period} Sector Report JSON now — consolidate, screen, and recommend.`,
      model: "sonnet",
      maxTokens: 3500,
    });
    if (text) {
      try {
        let t = text.trim();
        const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) t = fence[1].trim();
        const a = t.indexOf("{"); const b = t.lastIndexOf("}");
        if (a >= 0 && b > a) t = t.slice(a, b + 1);
        const obj = JSON.parse(t);
        if (obj.summary) setSummary(String(obj.summary));
        if (Array.isArray(obj.sectors)) {
          const byName = new Map<string, Record<string, unknown>>();
          for (const s of obj.sectors) if (s?.name) byName.set(String(s.name).toLowerCase(), s);
          setSectors((prev) => prev.map((s) => {
            const m = byName.get(s.name.toLowerCase());
            if (!m) return s;
            const sent = m.sentiment;
            return {
              ...s,
              sentiment: sent === "Positive" || sent === "Negative" ? sent : "Neutral",
              highlight: m.highlight != null ? String(m.highlight) : s.highlight,
              commentary: m.commentary != null ? String(m.commentary) : s.commentary,
              metricValue: m.metricValue != null ? String(m.metricValue) : s.metricValue,
              metricLabel: m.metricLabel != null ? String(m.metricLabel) : s.metricLabel,
            };
          }));
        }
        const sc = obj.screening as Record<string, unknown> | undefined;
        if (sc) {
          const v = sc.verdict;
          setScreening({
            verdict: v === "ready" || v === "insufficient" ? v : "review",
            notes: Array.isArray(sc.notes) ? sc.notes.map(String).filter(Boolean).slice(0, 6) : [],
          });
        }
        if (obj.recommendation != null) setRecommendation(String(obj.recommendation));
        setAiDrafted(true);
        setAiMsg(`Draft ready — consolidated from ${sourceDailies.length} daily report${sourceDailies.length === 1 ? "" : "s"}${ctx.marketCommentary ? " + live market" : ""}. Review the desk's recommendation below, edit if needed, then Publish.`);
      } catch {
        setAiMsg("The AI draft came back malformed — try again, or fill the sectors manually.");
      }
    } else {
      setAiMsg("Couldn't reach the AI just now. You can still fill the report manually, or try again.");
    }
    setAiBusy(false);
  };

  // Minimise manual work: auto-draft once on open when there are dailies to roll
  // up and nothing has been drafted yet. Publishing always stays a human action.
  useEffect(() => {
    if (autoRan.current) return;
    if (sourceDailies.length > 0 && !aiDrafted && !aiBusy) { autoRan.current = true; draftWithAI(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceDailies.length]);

  const dateLabel = useMemo(() => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }, [dateStr]);

  const filledCount = sectors.filter((s) => s.highlight.trim() || s.commentary.trim()).length;

  const html = useMemo(
    () => buildReportHtml({ period, reportType, title, dateLabel, author, summary, sectors }),
    [period, reportType, title, dateLabel, author, summary, sectors],
  );

  const download = () => {
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups to download the PDF."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const [publishing, setPublishing] = useState(false);
  const publish = async () => {
    if (filledCount === 0) { alert("Complete at least one sector before publishing."); return; }
    const report: ResearchReport = {
      id: genId("R"),
      title: title.trim() || reportType,
      type: period === "Weekly" ? "Weekly Sector Report" : "Monthly Report",
      author,
      date: dateStr,
      status: "Published",
      summary: summary.trim() || `${reportType} consolidating ${filledCount} sector${filledCount > 1 ? "s" : ""}.`,
      sectors: sectors.filter((s) => s.highlight.trim() || s.commentary.trim()).map((s) => s.name),
      body: html,
    };
    setPublishing(true);
    try { publishReport(report, await preparePublication(report)); }
    catch { publishReport(report); }
    finally { setPublishing(false); }
    setPublished(true);
    setTimeout(() => setPublished(false), 3000);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  return (
    <div>
      <PageHeader
        title={`${period} Sector Report`}
        subtitle={`Each desk fills in its sector. On publish it consolidates into one ${period.toLowerCase()} report, notifies everyone, and is stored in the Library — downloadable as PDF.`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={draftWithAI} disabled={aiBusy} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--accent)", color: "#1a1205" }}>
              {aiBusy ? "Consolidating…" : "✨ Draft with AI"}
            </button>
            <button onClick={download} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>⬇ Download PDF</button>
            <button onClick={publish} disabled={publishing} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand)" }}>{publishing ? "Publishing…" : "Publish to group"}</button>
          </div>
        }
      />
      <ModuleTabs moduleKey="research" />

      {/* AI consolidation banner */}
      <div className="mb-4 rounded-lg border p-3 flex flex-wrap items-center gap-3" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          <b style={{ color: "var(--text)" }}>AI consolidation:</b> let Rulethu AI read this {period === "Weekly" ? "week" : "month"}&apos;s <b>{sourceDailies.length}</b> daily report{sourceDailies.length === 1 ? "" : "s"} and draft the {period.toLowerCase()} report for you to review.
        </span>
        <button onClick={draftWithAI} disabled={aiBusy} className="ml-auto rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand)" }}>
          {aiBusy ? "Consolidating…" : aiDrafted ? "Re-draft" : "Draft with AI"}
        </button>
      </div>
      {aiMsg && (
        <div className="mb-4">
          <Badge tone={aiDrafted ? "info" : "warn"}>{aiMsg}</Badge>
        </div>
      )}

      {/* Lead researcher review — the AI's self-screening + recommendation */}
      {(recommendation || screening) && (() => {
        const v = screening?.verdict ?? "review";
        const vc = v === "ready" ? "var(--pos)" : v === "insufficient" ? "var(--neg)" : "var(--warn)";
        const vlabel = v === "ready" ? "READY TO PUBLISH" : v === "insufficient" ? "INSUFFICIENT SOURCES" : "REVIEW SUGGESTED";
        return (
          <div className="mb-4 rounded-lg border p-4" style={{ background: "var(--surface)", borderColor: vc, boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: vc }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: vc }}>{vlabel}</span>
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>· AI screening for the lead researcher</span>
            </div>
            {recommendation && <p className="text-sm" style={{ color: "var(--text)" }}>{recommendation}</p>}
            {screening && screening.notes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {screening.notes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
                    <span style={{ color: vc }}>•</span><span>{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>The desk screened its own draft against this period&apos;s dailies. Edit anything below, then Publish — nothing is published automatically.</p>
          </div>
        );
      })()}

      {published && <div className="mb-4"><Badge tone="pos">Published — consolidated report stored & everyone notified</Badge></div>}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Inputs */}
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Report title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
              </label>
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{period === "Weekly" ? "Week ending" : "Month of"}</span>
                <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
              </label>
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Compiled by</span>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Executive summary</span>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Group-level overview for the period…" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
            </label>
          </Card>

          {sectors.map((s, i) => (
            <Card key={s.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold" style={{ color: "var(--text)" }}>{s.name}</h3>
                <select value={s.sentiment} onChange={(e) => setSector(i, { sentiment: e.target.value as Sentiment })} className="rounded-md border px-2 py-1 text-xs" style={inputStyle}>
                  <option>Positive</option><option>Neutral</option><option>Negative</option>
                </select>
              </div>
              <input value={s.highlight} onChange={(e) => setSector(i, { highlight: e.target.value })} placeholder="Headline / key highlight" className="w-full rounded-md border px-3 py-2 text-sm font-medium" style={inputStyle} />
              <textarea value={s.commentary} onChange={(e) => setSector(i, { commentary: e.target.value })} rows={2} placeholder="Commentary…" className="w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
              <div className="grid grid-cols-2 gap-2">
                <input value={s.metricValue} onChange={(e) => setSector(i, { metricValue: e.target.value })} placeholder="Key metric (e.g. +6% q/q)" className="rounded-md border px-3 py-2 text-sm" style={inputStyle} />
                <input value={s.metricLabel} onChange={(e) => setSector(i, { metricLabel: e.target.value })} placeholder="Metric label (e.g. corridor volumes)" className="rounded-md border px-3 py-2 text-sm" style={inputStyle} />
              </div>
            </Card>
          ))}
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Consolidated preview</span>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>{filledCount}/{sectors.length} sectors filled</span>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
            <iframe title="Report preview" srcDoc={html} className="w-full bg-white" style={{ height: "calc(100vh - 200px)", minHeight: 640, border: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
