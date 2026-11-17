"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { ResearchReport } from "@/lib/seed";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleProgress from "@/components/ModuleProgress";
import ModuleTabs from "@/components/ModuleTabs";
import { fmtDate } from "@/lib/format";

const BUILDERS = [
  { name: "Daily Intelligence", href: "/research/daily", desc: "Local and international markets — the desk template." },
  { name: "Weekly Sector", href: "/research/weekly", desc: "Each sector fills in; consolidates on publish." },
  { name: "Monthly", href: "/research/monthly", desc: "Month-in-review across all sectors." },
];

const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Build a branded one-pager for reports that don't carry a full body. */
function reportFallbackHtml(r: ResearchReport): string {
  const date = new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const sectors = (r.sectors ?? []).map((s) => `<li>${esc(s)}</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
    body{margin:0;font-family:"Segoe UI",Arial,sans-serif;color:#1a2b3c;font-size:13px;line-height:1.6}
    .page{max-width:800px;margin:0 auto;padding:30px 38px}
    .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0b5d52;padding-bottom:10px}
    .brand{font-weight:800;font-size:20px;color:#0b5d52}.brand .dot{color:#c9a227}.brand small{display:block;font-weight:600;font-size:10px;color:#667;letter-spacing:2px}
    .rlabel{text-align:right;font-weight:700;color:#0b5d52;font-size:12px}.rlabel small{display:block;font-weight:500;color:#667}
    h1{font-size:21px;margin:16px 0 2px}.meta{color:#667;font-size:12px;margin-bottom:14px}
    h2{color:#0b5d52;font-size:14px;border-bottom:1px solid #c9a227;padding-bottom:3px;margin:16px 0 4px}
    .foot{margin-top:24px;border-top:2px solid #0b5d52;padding-top:10px;font-size:10.5px;color:#667}
  </style></head><body><div class="page">
    <div class="top"><div class="brand">RULETHU &amp; CO.<span class="dot">.</span><small>RESEARCH</small></div>
    <div class="rlabel">${esc(r.type)}<small>${esc(date)}</small></div></div>
    <h1>${esc(r.title)}</h1><div class="meta">Prepared by ${esc(r.author)} · Rulethu &amp; Co. Research</div>
    <h2>Summary</h2><p>${esc(r.summary)}</p>
    ${sectors ? `<h2>Coverage</h2><ul>${sectors}</ul>` : ""}
    <div class="foot"><b>Rulethu &amp; Co. Private Limited</b> — info@rulethu.com · rulethu.com. Informational only; not investment advice.</div>
  </div></body></html>`;
}

function openReport(r: ResearchReport) {
  const html = r.body && r.body.trim() ? r.body : reportFallbackHtml(r);
  const w = window.open("", "_blank");
  if (!w) { alert("Allow pop-ups to open the report."); return; }
  w.document.write(html);
  w.document.close();
}

export default function ResearchPage() {
  const { reports } = useAppData();
  const published = reports.filter((r) => r.status === "Published");
  const drafts = reports.filter((r) => r.status === "Draft");

  // When opened from a notification (?report=<id>), highlight & scroll to it,
  // and open it if it has a printable body.
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("report");
    if (!id) return;
    setHighlight(id);
    const el = document.getElementById(`report-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const r = reports.find((x) => x.id === id);
      if (r) setTimeout(() => openReport(r), 400);
    }
    const t = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.length]);

  return (
    <div>
      <PageHeader
        title="Research"
        subtitle="Daily, weekly and monthly market intelligence — produced from templates, published to the group, and stored here."
        actions={
          <Link href="/research/daily" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
            <span className="text-base leading-none">+</span> New report
          </Link>
        }
      />

      <ModuleTabs moduleKey="research" />
      <ModuleProgress module="research" />

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {BUILDERS.map((b) => (
          <Link key={b.name} href={b.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="font-semibold" style={{ color: "var(--text)" }}>{b.name}</div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{b.desc}</p>
              <span className="mt-2 inline-block text-sm font-medium" style={{ color: "var(--brand)" }}>Open builder</span>
            </Card>
          </Link>
        ))}
      </div>

      <SectionTitle hint={`${published.length} stored`}>Published library</SectionTitle>
      <div className="space-y-3 mb-8">
        {published.length === 0 ? (
          <Card className="border-dashed">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>No published reports yet — open a builder above.</span>
          </Card>
        ) : (
          published.map((r) => (
            <PublishedCard key={r.id} report={r} highlighted={highlight === r.id} />
          ))
        )}
      </div>

      {drafts.length > 0 ? (
        <div>
          <SectionTitle>Drafts</SectionTitle>
          <div className="space-y-3">
            {drafts.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-4 border-dashed">
                <div>
                  <h3 className="font-medium" style={{ color: "var(--text)" }}>{r.title}</h3>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{r.summary}</p>
                </div>
                <Badge tone="warn">Draft</Badge>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PublishedCard({ report: r, highlighted }: { report: ResearchReport; highlighted: boolean }) {
  const { channels, addMessage } = useAppData();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const groupChannel = channels.find((c) => c.id === "research") ?? channels.find((c) => c.id === "announcements") ?? channels[0];

  const postComment = () => {
    const t = comment.trim();
    if (!t || !groupChannel) return;
    addMessage(groupChannel.id, "message", `💬 Comment on **${r.title}**: ${t}`, undefined, user?.name);
    setComment(""); setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <Card id={`report-${r.id}`} style={highlighted ? { outline: "2px solid var(--brand)", outlineOffset: 2 } : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => openReport(r)} className="font-semibold text-left hover:underline" style={{ color: "var(--brand)" }} title="Open the report">{r.title}</button>
            <Badge tone="beta">{r.type}</Badge>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{r.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.sectors.map((s) => (
              <span key={s} className="text-[11px] rounded px-1.5 py-0.5" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{s}</span>
            ))}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <Badge tone="pos">Published</Badge>
          <div className="text-xs" style={{ color: "var(--text-faint)" }}>{r.author} · {fmtDate(r.date)}</div>
          <button onClick={() => openReport(r)} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--brand)" }}>
            Open report (PDF)
          </button>
        </div>
      </div>
      {/* Comment → posts to the comms group */}
      <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
          placeholder={`Comment on this report — posts to #${groupChannel?.name ?? "research"}…`}
          className="flex-1 rounded-md border px-2.5 py-1.5 text-sm"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <button onClick={postComment} className="rounded-md border px-3 py-1.5 text-xs font-medium shrink-0" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Comment</button>
        {sent && <span className="text-[11px] shrink-0" style={{ color: "var(--pos)" }}>Posted ✓</span>}
      </div>
    </Card>
  );
}
