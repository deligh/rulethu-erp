"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppData } from "@/lib/store";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import CountUp from "@/components/CountUp";
import AfricaMap from "@/components/AfricaMap";
import { boardSummary, geoExposure, runStress, STRESS_PRESETS } from "@/lib/boardroom";
import { compact, fmtMoney, fmtDate } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);

export default function Boardroom() {
  const { holdings, deals, investors, loans, tbills, entries, personalEvents, market } = useAppData();

  const s = useMemo(() => boardSummary({
    holdings, deals, investors, loans, tbills, entries,
    personalEvents: personalEvents.map((e) => ({ date: e.date, title: e.title })),
    today: today(),
  }), [holdings, deals, investors, loans, tbills, entries, personalEvents]);

  const geo = useMemo(() => geoExposure(deals, holdings), [deals, holdings]);

  // Live "risk-off" snapshot for the command strip (uses the same engine as the full page).
  const riskOff = useMemo(() => runStress(holdings, STRESS_PRESETS.find((p) => p.name === "Risk-off combo")!.factors), [holdings]);

  const prices = market?.prices?.filter((p) => p.value && p.value !== "—") ?? [];
  const gainers = s.movers.filter((m) => m.gain >= 0).slice(0, 3);
  const laggards = s.movers.filter((m) => m.gain < 0).slice(-3).reverse();

  const sevTone = { critical: "neg", warn: "warn", info: "info" } as const;

  return (
    <div>
      <PageHeader
        eyebrow="Rulethu Holdings · Mission control"
        title="Boardroom Command Center"
        subtitle="One live screen across the whole group — capital, portfolio, pipeline, risk and the market, updating from the same data every module writes to."
        actions={<Badge tone="live">Live</Badge>}
      />

      {/* Market ticker */}
      {prices.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-stretch divide-x overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            {prices.map((p, i) => (
              <div key={i} className="flex-1 min-w-[150px] px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide truncate" style={{ color: "var(--text-faint)" }}>{p.name}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold tabular" style={{ color: "var(--text)" }}>{p.value}</span>
                  {p.change && (
                    <span className="text-xs font-semibold" style={{ color: p.dir === "up" ? "var(--pos)" : p.dir === "down" ? "var(--neg)" : "var(--text-faint)" }}>
                      {p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "•"} {p.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero numbers */}
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <HeroCard label="Portfolio value (NAV)" value={compact(s.aum, "USD")} sub={`${s.moic.toFixed(2)}× MOIC · ${s.unrealized >= 0 ? "+" : ""}${compact(s.unrealized, "USD")} unrealised`} tone={s.unrealized >= 0 ? "pos" : "neg"} big />
        <HeroCard label="Dry powder (undrawn)" value={compact(s.dryPowder, "USD")} sub={`${compact(s.committed, "USD")} committed · ${compact(s.called, "USD")} called`} />
        <HeroCard label="Live pipeline" value={compact(s.pipelineValue, "USD")} sub={`${s.pipelineCount} active deals`} />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <MiniStat label="Cash on hand" value={compact(s.cash, "USD")} hint="operating bank, live from ledger" />
        <MiniStat label="Distributions (DPI)" value={`${s.dpi.toFixed(2)}×`} hint={`${compact(s.distributed, "USD")} returned to LPs`} />
        <MiniStat label="MFI loan book" value={compact(s.loanBook, "USD")} hint={s.parAmount > 0 ? `${compact(s.parAmount, "USD")} at risk` : "no PAR>30"} />
        <MiniStat label="Treasury bills" value={compact(s.treasuryFace, "USD")} hint="face value held" />
      </div>

      {/* Two-column: map + alerts */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] mb-8">
        <div>
          <SectionTitle hint="click a country to drill in">Where the money is — Southern Africa</SectionTitle>
          <AfricaMap nodes={geo} />
        </div>
        <div>
          <SectionTitle hint={`${s.alerts.length} active`}>Smart alerts</SectionTitle>
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {s.alerts.length === 0 && <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing flagged — all clear. 🎉</span></Card>}
            {s.alerts.map((a) => (
              <Link key={a.id} href={a.href}>
                <Card className="flex items-start gap-3 py-3 transition-shadow hover:shadow-md">
                  <span className="mt-0.5"><Badge tone={sevTone[a.severity]}>{a.severity}</Badge></span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{a.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{a.detail}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Movers + Upcoming */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div>
          <SectionTitle hint="by return on cost">Top movers</SectionTitle>
          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--pos)" }}>Leaders</div>
            {gainers.map((m) => <MoverRow key={m.company} m={m} />)}
            {laggards.length > 0 && <>
              <div className="text-[11px] font-semibold uppercase tracking-wide mt-4 mb-2" style={{ color: "var(--neg)" }}>Laggards</div>
              {laggards.map((m) => <MoverRow key={m.company} m={m} />)}
            </>}
          </Card>
        </div>
        <div>
          <SectionTitle hint="IC, maturities & events">On the horizon</SectionTitle>
          <div className="space-y-2">
            {s.upcoming.length === 0 && <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing scheduled.</span></Card>}
            {s.upcoming.map((u, i) => (
              <Link key={i} href={u.href}>
                <Card className="flex items-center justify-between gap-3 py-3 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge tone={u.kind === "IC" ? "purple" : u.kind === "Maturity" ? "info" : "neutral"}>{u.kind}</Badge>
                    <span className="text-sm truncate" style={{ color: "var(--text)" }}>{u.label}</span>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>{fmtDate(u.date)}</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Power tools */}
      <SectionTitle hint="boardroom tools">Go deeper</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <Link href="/boardroom/stress">
          <Card className="h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Scenario Stress-Test →</h3>
              <Badge tone={riskOff.delta < 0 ? "neg" : "pos"}>{riskOff.pct >= 0 ? "+" : ""}{(riskOff.pct * 100).toFixed(1)}%</Badge>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Move gold, lithium, the ZiG and rates and watch the portfolio reprice live. A &quot;risk-off&quot; shock today would take NAV to {compact(riskOff.stressed, "USD")} ({compact(riskOff.delta, "USD")}).
            </p>
          </Card>
        </Link>
        <Link href="/boardroom/memo">
          <Card className="h-full transition-shadow hover:shadow-md">
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>One-click IC Memo →</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Turn any deal or holding into a full Investment Committee memo — thesis, valuation, risks and a clear recommendation — drafted by Rulethu AI and exported to PDF.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function HeroCard({ label, value, sub, tone, big }: { label: string; value: string; sub: string; tone?: "pos" | "neg"; big?: boolean }) {
  return (
    <Card className="rz-rise flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className={`${big ? "text-[34px]" : "text-3xl"} font-semibold tabular leading-none`} style={{ color: "var(--text)" }}><CountUp value={value} /></span>
      <span className="text-xs mt-1" style={{ color: tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--text-muted)" }}>{sub}</span>
    </Card>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className="text-xl font-semibold tabular" style={{ color: "var(--text)" }}><CountUp value={value} /></span>
      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{hint}</span>
    </Card>
  );
}

function MoverRow({ m }: { m: { company: string; gain: number; pct: number } }) {
  const up = m.gain >= 0;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <span className="text-sm truncate min-w-0" style={{ color: "var(--text)" }}>{m.company}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs tabular" style={{ color: "var(--text-muted)" }}>{up ? "+" : ""}{compact(m.gain, "USD")}</span>
        <span className="text-sm font-semibold tabular" style={{ color: up ? "var(--pos)" : "var(--neg)" }}>{up ? "▲" : "▼"} {Math.abs(m.pct * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}
