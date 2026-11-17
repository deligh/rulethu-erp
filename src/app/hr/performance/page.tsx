"use client";

import { useAppData, genId, PerfReview } from "@/lib/store";
import { PageHeader, Card, StatCard, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";
import Avatar from "@/components/Avatar";
import { fmtDate } from "@/lib/format";

function Stars({ n }: { n: number }) {
  return <span style={{ color: "var(--accent)" }}>{"★".repeat(n)}<span style={{ color: "var(--border)" }}>{"★".repeat(5 - n)}</span></span>;
}

export default function PerformancePage() {
  const { reviews, employees, add } = useAppData();
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const addReview = (v: Record<string, string>) => {
    const rec: PerfReview = { id: genId("PR"), employee: v.employee, period: v.period, rating: Math.max(1, Math.min(5, parseInt(v.rating) || 3)), notes: v.notes, reviewer: v.reviewer || "Line manager", createdAt: new Date().toISOString() };
    add("reviews", rec, { title: "Performance review filed", body: `${v.employee} — ${rec.rating}/5`, module: "hr" });
  };

  return (
    <div>
      <PageHeader
        title="HR · Performance"
        subtitle="Review cycles and ratings across the team."
        actions={
          <QuickAdd
            buttonLabel="New review"
            title="File a performance review"
            submitLabel="File review"
            onSubmit={addReview}
            columns={2}
            fields={[
              { key: "employee", label: "Employee", type: "select", options: employees.map((e) => e.name), required: true },
              { key: "period", label: "Period", default: "H2 2026", required: true },
              { key: "rating", label: "Rating (1–5)", type: "number", min: 1, step: 1, default: 4 },
              { key: "reviewer", label: "Reviewer", default: "Line manager" },
              { key: "notes", label: "Notes", placeholder: "Strengths, development areas…" },
            ]}
          />
        }
      />
      <ModuleTabs moduleKey="hr" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Reviews" value={String(reviews.length)} />
        <StatCard label="Avg rating" value={avg ? avg.toFixed(1) + " / 5" : "—"} />
        <StatCard label="Top rated" value={String(reviews.filter((r) => r.rating >= 4).length)} hint="4★ and above" />
        <StatCard label="Need support" value={String(reviews.filter((r) => r.rating <= 2).length)} hint="2★ and below" />
      </div>

      <SectionTitle>Reviews</SectionTitle>
      {reviews.length === 0 ? (
        <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No reviews filed yet.</span></Card>
      ) : (
        <div className="space-y-3">
          {[...reviews].reverse().map((r) => (
            <Card key={r.id} className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Avatar name={r.employee} size={34} />
                <div>
                  <div className="flex items-center gap-2"><span className="font-semibold" style={{ color: "var(--text)" }}>{r.employee}</span><Badge tone="neutral">{r.period}</Badge></div>
                  {r.notes && <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{r.notes}</p>}
                  <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>Reviewed by {r.reviewer} · {fmtDate(r.createdAt.slice(0, 10))}</div>
                </div>
              </div>
              <div className="text-right"><Stars n={r.rating} /><div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{r.rating}/5</div></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
