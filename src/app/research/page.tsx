"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/lib/store";
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

function printReport(r: ResearchReport) {
  if (!r.body) return;
  const w = window.open("", "_blank");
  if (!w) {
    alert("Allow pop-ups to open the report.");
    return;
  }
  w.document.write(r.body);
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
      if (r?.body) setTimeout(() => printReport(r), 400);
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
            <Card key={r.id} id={`report-${r.id}`} className="flex flex-wrap items-start justify-between gap-4" style={highlight === r.id ? { outline: "2px solid var(--brand)", outlineOffset: 2 } : undefined}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold" style={{ color: "var(--text)" }}>{r.title}</h3>
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
                {r.body ? (
                  <button onClick={() => printReport(r)} className="rounded-md border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    Open / Print PDF
                  </button>
                ) : null}
              </div>
            </Card>
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
