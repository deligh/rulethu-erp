"use client";

import { useState } from "react";
import { useAppData, genId, CURRENT_USER } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { ResearchReport } from "@/lib/seed";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

function monthLabel(): string {
  return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function MonthlyReportPage() {
  const { publishReport } = useAppData();
  const { user } = useAuth();
  const [title, setTitle] = useState(`Rulethu Monthly Economic Brief — ${monthLabel()}`);
  const [published, setPublished] = useState(false);

  const publish = () => {
    const report: ResearchReport = {
      id: genId("R"),
      title: title.trim() || "Rulethu Monthly Economic Brief",
      type: "Monthly Report",
      author: user?.name ?? CURRENT_USER,
      date: new Date().toISOString().slice(0, 10),
      status: "Published",
      summary: "Monthly economic brief — macro, FX, rates, equities, commodities and the Rulethu house view, from the RMR template.",
      sectors: ["Macro", "FX", "Rates", "Equities", "Commodities"],
    };
    publishReport(report);
    setPublished(true);
    setTimeout(() => setPublished(false), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Monthly Economic Brief"
        subtitle="The Rulethu Monthly Report (RMR) template — enter the month's figures, generate the brief, download the PDF, then publish it to the whole group."
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
        <button onClick={publish} className="rounded-md px-4 py-2 text-sm font-semibold text-white self-end" style={{ background: "var(--brand)" }}>
          Publish to group
        </button>
        {published && <Badge tone="pos">Published — everyone notified</Badge>}
        <a href="/reports/rulethu-monthly-brief/" target="_blank" rel="noopener" className="self-end rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Open full screen ↗
        </a>
      </div>

      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
        Enter the month&apos;s figures inside the template, generate the brief, then use its <strong>⬇ Download PDF</strong> to save/share. <strong>Publish to group</strong> posts it to the Research Library and notifies everyone.
      </p>

      {/* Embedded RMR template, exactly as-is */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <iframe
          src="/reports/rulethu-monthly-brief/"
          title="Rulethu Monthly Economic Brief template"
          className="w-full"
          style={{ height: "calc(100vh - 120px)", minHeight: 900, border: "none", background: "#fff" }}
        />
      </div>
    </div>
  );
}
