"use client";

import { useRef, useState } from "react";
import { useAppData, genId, CURRENT_USER } from "@/lib/store";
import { preparePublication } from "@/lib/publish";
import type { ResearchReport } from "@/lib/seed";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export default function DailyIntelligencePage() {
  const { publishReport } = useAppData();
  const [title, setTitle] = useState(`Daily Market Intelligence — ${todayLabel()}`);
  const [published, setPublished] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [publishing, setPublishing] = useState(false);
  const publish = async () => {
    // Capture the REAL filled report from the template (same output as its PDF).
    let body: string | undefined;
    try {
      const win = iframeRef.current?.contentWindow as unknown as { __getReportHTML?: () => string } | null;
      const html = win?.__getReportHTML?.();
      if (html && html.length > 300) body = html;
    } catch { /* template not ready / cross-origin */ }

    const report: ResearchReport = {
      id: genId("R"),
      title: title.trim() || "Daily Market Intelligence",
      type: "Daily Market Intelligence",
      author: CURRENT_USER,
      date: new Date().toISOString().slice(0, 10),
      status: "Published",
      summary: "Daily market intelligence — local & international markets, produced in the Research desk template.",
      sectors: ["FX", "Equities", "Commodities", "Fixed Income"],
      body,
    };
    setPublishing(true);
    try {
      const extra = await preparePublication(report);
      publishReport(report, extra);
    } catch {
      publishReport(report);
    } finally {
      setPublishing(false);
    }
    setPublished(true);
    setTimeout(() => setPublished(false), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Daily Market Intelligence"
        subtitle="The Research desk template — enter the data, generate the report, download the PDF, then publish it to the whole group."
        actions={<Badge tone="live">Live template</Badge>}
      />
      <ModuleTabs moduleKey="research" />

      {/* ERP publish bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex-1 min-w-[240px]">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Publish title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          />
        </div>
        <button onClick={publish} disabled={publishing} className="rounded-md px-4 py-2 text-sm font-semibold text-white self-end disabled:opacity-60" style={{ background: "var(--brand)" }}>
          {publishing ? "Publishing…" : "Publish to group"}
        </button>
        {published && <Badge tone="pos">Published — everyone notified</Badge>}
        <a href="/reports/daily-market-intelligence/" target="_blank" rel="noopener" className="self-end rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Open full screen ↗
        </a>
      </div>

      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
        Use <strong>Data Entry</strong> to input figures, <strong>Generate Report</strong> to preview, then <strong>⬇ Download PDF</strong> (inside the tool) to save/share the PDF. <strong>Publish to group</strong> posts it to the Research Library and notifies everyone. Automatic data scraping is planned — for now the desk inputs the figures.
      </p>

      {/* Embedded template, exactly as-is */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <iframe
          ref={iframeRef}
          src="/reports/daily-market-intelligence/"
          title="Daily Market Intelligence template"
          className="w-full"
          style={{ height: "calc(100vh - 120px)", minHeight: 900, border: "none", background: "#fff" }}
        />
      </div>
    </div>
  );
}
