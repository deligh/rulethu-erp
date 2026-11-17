"use client";

import Link from "next/link";
import { useAppData, genId } from "@/lib/store";
import { Deal } from "@/lib/seed";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleProgress from "@/components/ModuleProgress";
import ModuleTabs from "@/components/ModuleTabs";
import QuickAdd from "@/components/QuickAdd";
import { fmtMoney, fmtDate } from "@/lib/format";

const STAGES: Deal["stage"][] = [
  "Origination", "Screening", "Analysis", "IC", "Due Diligence", "Approval", "Execution", "Monitoring",
];
const SECTORS = ["Infrastructure", "Energy", "Trade", "Mining", "Manufacturing", "Logistics", "Financial Services"];

export default function InvestmentsPage() {
  const { deals, add, patch } = useAppData();

  const today = new Date().toISOString().slice(0, 10);
  const addDeal = (v: Record<string, string>) => {
    const deal: Deal = {
      id: genId("D"),
      name: v.name,
      sector: v.sector,
      country: v.country || "Zimbabwe",
      stage: (v.stage as Deal["stage"]) || "Origination",
      ticket: parseFloat(v.ticket) || 0,
      owner: v.owner || "Delight",
      updated: today,
    };
    add("deals", deal, { title: "New deal logged", body: `${deal.name} — ${fmtMoney(deal.ticket)}`, module: "investments" });
  };

  const moveStage = (d: Deal, stage: Deal["stage"]) =>
    patch("deals", d.id, { stage, updated: today }, { title: "Deal stage updated", body: `${d.name} → ${stage}`, module: "investments" });

  return (
    <div>
      <PageHeader
        title="Investments"
        subtitle="Deal pipeline from origination to monitoring, mirroring the firm's end-to-end investment process."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/investments/valuation" className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Valuation workbench
            </Link>
            <QuickAdd
              buttonLabel="Log deal"
              title="Log a new opportunity"
              submitLabel="Add to pipeline"
              onSubmit={addDeal}
              fields={[
                { key: "name", label: "Deal name", required: true, placeholder: "e.g. Solar IPP — 40MW" },
                { key: "sector", label: "Sector", type: "select", options: SECTORS, required: true },
                { key: "country", label: "Country", default: "Zimbabwe" },
                { key: "ticket", label: "Ticket (USD)", type: "number", required: true, min: 0, step: 100000 },
                { key: "stage", label: "Stage", type: "select", options: STAGES },
                { key: "owner", label: "Owner", type: "select", options: ["Delight", "Blessed", "Gamu"] },
              ]}
            />
          </div>
        }
      />

      <ModuleTabs moduleKey="investments" />
      <ModuleProgress module="investments" />

      <SectionTitle hint="move a deal with the dropdown on its card">Pipeline</SectionTitle>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const list = deals.filter((d) => d.stage === stage);
            return (
              <div key={stage} className="w-64 shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{stage}</span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>No deals</div>
                  )}
                  {list.map((d) => (
                    <Card key={d.id} className="!p-3">
                      <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{d.name}</div>
                      <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>{d.sector} · {d.country}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold tabular">{fmtMoney(d.ticket)}</span>
                        <Badge tone="neutral">{d.owner}</Badge>
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>Updated {fmtDate(d.updated)}</div>
                      <select
                        value={d.stage}
                        onChange={(e) => moveStage(d, e.target.value as Deal["stage"])}
                        className="mt-2 w-full rounded-lg border px-2 py-1 text-xs"
                        style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                      >
                        {STAGES.map((s) => <option key={s} value={s}>Move to: {s}</option>)}
                      </select>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
