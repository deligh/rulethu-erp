"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { useAppData, genId } from "@/lib/store";
import { preparePublication } from "@/lib/publish";
import type { ResearchReport } from "@/lib/seed";

interface Metric {
  label: string;
  value: string;
  change: string;
}

const SECTORS = ["Infrastructure", "Logistics", "Energy", "Trade", "Mining", "Manufacturing", "FX", "Fixed Income"];

const TODAY = new Date().toISOString().slice(0, 10);

export default function ReportComposer() {
  const { publishReport } = useAppData();
  const [publishing, setPublishing] = useState(false);
  const [type, setType] = useState("Daily Market Report");
  const [date, setDate] = useState(TODAY);
  const [author, setAuthor] = useState("Delight");
  const [headline, setHeadline] = useState("Markets steady; mining counters lead as USD/ZWL holds on the interbank");
  const [body, setBody] = useState(
    "Regional equities were firmer, led by mining counters on stronger metal prices. The interbank rate was broadly stable and Brent eased below $74. Corridor freight volumes remain resilient into H2.",
  );
  const [sectors, setSectors] = useState<string[]>(["Mining", "Energy", "FX"]);
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: "USD/ZWL (interbank)", value: "36.20", change: "+0.1%" },
    { label: "ZSE All-Share", value: "412.5", change: "+1.4%" },
    { label: "Brent crude", value: "$73.60", change: "-0.8%" },
    { label: "Gold", value: "$2,610", change: "+0.3%" },
  ]);
  const [published, setPublished] = useState(false);

  const toggleSector = (s: string) =>
    setSectors((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const setMetric = (i: number, key: keyof Metric, v: string) =>
    setMetrics((prev) => prev.map((m, idx) => (idx === i ? { ...m, [key]: v } : m)));

  const title = `${type} — ${new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

  const markdown = useMemo(() => {
    const lines = [
      `# ${title}`,
      ``,
      `**${headline}**`,
      ``,
      `_${author} · ${date} · Rulethu Holdings Research_`,
      ``,
      `## Market snapshot`,
      ``,
      `| Metric | Level | Change |`,
      `| --- | ---: | ---: |`,
      ...metrics.filter((m) => m.label).map((m) => `| ${m.label} | ${m.value} | ${m.change} |`),
      ``,
      `## Commentary`,
      ``,
      body,
      ``,
      `**Sectors covered:** ${sectors.join(", ") || "—"}`,
      ``,
      `---`,
      `_Rulethu Holdings · Confidential · prepared for internal distribution._`,
    ];
    return lines.join("\n");
  }, [title, headline, author, date, metrics, body, sectors]);

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w]+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  return (
    <div>
      <PageHeader
        title="Compose Report"
        subtitle="Fill the template, preview it, then publish to the group or download to share outside the platform."
        actions={
          <Link href="/research" className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            Back to research
          </Link>
        }
      />

      <ModuleTabs moduleKey="research" />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Editor */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Type</span>
                <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                  <option>Daily Market Report</option>
                  <option>Weekly Intelligence</option>
                  <option>Sector Note</option>
                  <option>Flash</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
              </label>
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Author</span>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Headline</span>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
            </label>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Market snapshot</h3>
            <div className="space-y-2">
              {metrics.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_80px] gap-2">
                  <input value={m.label} onChange={(e) => setMetric(i, "label", e.target.value)} placeholder="Metric" className="rounded-lg border px-2 py-1.5 text-sm" style={inputStyle} />
                  <input value={m.value} onChange={(e) => setMetric(i, "value", e.target.value)} placeholder="Level" className="rounded-lg border px-2 py-1.5 text-sm text-right tabular" style={inputStyle} />
                  <input value={m.change} onChange={(e) => setMetric(i, "change", e.target.value)} placeholder="Chg" className="rounded-lg border px-2 py-1.5 text-sm text-right tabular" style={inputStyle} />
                </div>
              ))}
            </div>
            <button onClick={() => setMetrics((p) => [...p, { label: "", value: "", change: "" }])} className="mt-3 text-sm font-medium" style={{ color: "var(--brand)" }}>
              + Add metric
            </button>
          </Card>

          <Card>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Commentary</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
            </label>
            <div className="mt-3">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Sectors covered</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SECTORS.map((s) => {
                  const on = sectors.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSector(s)}
                      className="rounded-full px-3 py-1 text-xs font-medium border"
                      style={{
                        background: on ? "var(--brand)" : "transparent",
                        color: on ? "#fff" : "var(--text-muted)",
                        borderColor: on ? "var(--brand)" : "var(--border)",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-20 space-y-3">
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={async () => {
                const report: ResearchReport = {
                  id: genId("R"),
                  title,
                  type: type as ResearchReport["type"],
                  author,
                  date,
                  status: "Published",
                  summary: headline,
                  sectors,
                };
                setPublishing(true);
                try { publishReport(report, await preparePublication(report)); }
                catch { publishReport(report); }
                finally { setPublishing(false); }
                setPublished(true);
              }}
              disabled={publishing}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--brand)" }}
            >
              {publishing ? "Publishing…" : "Publish to group"}
            </button>
            <button onClick={download} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Download .md
            </button>
            <button onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Print / PDF
            </button>
            {published && <Badge tone="pos">Published (local)</Badge>}
          </div>

          <Card>
            <div className="border-b pb-3 mb-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brand)" }}>Rulethu Holdings · Research</span>
                <Badge tone="beta">{type}</Badge>
              </div>
              <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
              <p className="mt-1 text-sm font-medium" style={{ color: "var(--text)" }}>{headline}</p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>{author} · {date}</p>
            </div>

            <table className="w-full text-sm mb-4">
              <thead>
                <tr>
                  <th className="text-left text-xs uppercase pb-1" style={{ color: "var(--text-faint)" }}>Metric</th>
                  <th className="text-right text-xs uppercase pb-1" style={{ color: "var(--text-faint)" }}>Level</th>
                  <th className="text-right text-xs uppercase pb-1" style={{ color: "var(--text-faint)" }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {metrics.filter((m) => m.label).map((m, i) => {
                  const neg = m.change.trim().startsWith("-");
                  return (
                    <tr key={i}>
                      <td className="py-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>{m.label}</td>
                      <td className="py-1 text-right tabular font-medium" style={{ borderTop: "1px solid var(--border)" }}>{m.value}</td>
                      <td className="py-1 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: neg ? "var(--neg)" : "var(--pos)" }}>{m.change}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{body}</p>

            {sectors.length > 0 && (
              <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
                <span className="font-medium">Sectors:</span> {sectors.join(", ")}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
