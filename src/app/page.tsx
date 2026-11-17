"use client";

import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { useAppData } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { canAccessModule } from "@/lib/access";
import { PageHeader, Card, StatCard, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import { fmtMoney, compact, fmtDate } from "@/lib/format";

export default function Dashboard() {
  const { deals, reports, alts, loans } = useAppData();
  const { user } = useAuth();

  const pipelineValue = deals.reduce((s, d) => s + d.ticket, 0);
  const altNav = alts.reduce((s, a) => s + a.nav, 0);
  const loanBook = loans.reduce((s, l) => s + l.principal, 0);
  const atRisk = loans.filter((l) => l.status === "PAR>30").reduce((s, l) => s + l.principal, 0);
  const modules = MODULES.filter((m) => m.key !== "dashboard" && (!user || canAccessModule(user, m.key)));
  const latestReports = [...reports].slice(0, 3);
  const recentDeals = [...deals].slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Group Dashboard"
        subtitle="One trusted view across the investments function and supporting operations."
        actions={<Badge tone="live">All systems nominal</Badge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Live pipeline" value={compact(pipelineValue, "USD")} delta={{ value: `${deals.length} deals`, positive: true }} hint="proposed tickets" />
        <StatCard label="Alt. investments NAV" value={compact(altNav, "USD")} delta={{ value: "4.1%", positive: true }} hint="vs. committed" />
        <StatCard label="MFI loan book" value={compact(loanBook, "USD")} hint={`${loans.length} active loans`} />
        <StatCard label="Portfolio at risk" value={compact(atRisk, "USD")} delta={{ value: "PAR>30", positive: false }} hint="flagged" />
      </div>

      <SectionTitle hint="open any module">Modules</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {modules.map((m) => (
          <Link key={m.key} href={m.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface-2)", color: "var(--brand)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={m.icon} />
                  </svg>
                </div>
                <Badge tone={m.status}>{m.status}</Badge>
              </div>
              <h3 className="mt-3 font-semibold" style={{ color: "var(--text)" }}>{m.name}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{m.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <SectionTitle hint="live pipeline">Investment pipeline</SectionTitle>
          <Table head={<><Th>Deal</Th><Th>Stage</Th><Th right>Ticket</Th></>}>
            {recentDeals.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link href="/investments" className="font-medium hover:underline">{d.name}</Link>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{d.sector} · {d.country}</div>
                </Td>
                <Td><Badge tone="beta">{d.stage}</Badge></Td>
                <Td right strong>{fmtMoney(d.ticket)}</Td>
              </tr>
            ))}
          </Table>
        </div>

        <div>
          <SectionTitle hint="published to the group">Latest research</SectionTitle>
          <div className="space-y-3">
            {latestReports.map((r) => (
              <Card key={r.id} className="flex items-start justify-between gap-4">
                <div>
                  <Link href="/research" className="font-medium hover:underline" style={{ color: "var(--text)" }}>{r.title}</Link>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{r.summary}</p>
                  <div className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>{r.author} · {fmtDate(r.date)}</div>
                </div>
                <Badge tone={r.status === "Published" ? "pos" : "warn"}>{r.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
