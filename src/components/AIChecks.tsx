"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppData } from "@/lib/store";
import { runChecks, Finding, Severity } from "@/lib/ai";
import { ModuleKey } from "@/lib/modules";
import { Card } from "@/components/ui";

const TONE: Record<Severity, { bg: string; fg: string; label: string }> = {
  critical: { bg: "var(--lz-red-bg)", fg: "var(--lz-red-fg)", label: "Critical" },
  warn: { bg: "var(--lz-yellow-bg)", fg: "var(--lz-yellow-fg)", label: "Action" },
  info: { bg: "var(--lz-blue-bg)", fg: "var(--lz-blue-fg)", label: "Info" },
};

function Row({ f, showModule }: { f: Finding; showModule?: boolean }) {
  const t = TONE[f.severity];
  return (
    <Link href={f.href} className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-[var(--surface-2)]">
      <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ background: t.fg }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{f.title}</span>
          <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5" style={{ background: t.bg, color: t.fg }}>{t.label}</span>
          {showModule && <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>{f.moduleName}</span>}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{f.detail}</p>
      </div>
      <span className="text-xs shrink-0 mt-0.5" style={{ color: "var(--text-faint)" }}>↗</span>
    </Link>
  );
}

export default function AIChecks({ moduleKey }: { moduleKey?: ModuleKey }) {
  const d = useAppData();
  const all = useMemo(() => runChecks({
    entries: d.entries, pos: d.pos, requisitions: d.requisitions, requests: d.requests,
    tbills: d.tbills, loans: d.loans, leave: d.leave, employees: d.employees,
    deals: d.deals, goals: d.goals,
  }), [d.entries, d.pos, d.requisitions, d.requests, d.tbills, d.loans, d.leave, d.employees, d.deals, d.goals]);

  const findings = moduleKey ? all.filter((f) => f.module === moduleKey) : all;

  // Compact, module-scoped banner (used on module pages).
  if (moduleKey) {
    if (findings.length === 0) {
      return (
        <div className="mb-5 rounded-lg border px-3.5 py-2.5 flex items-center gap-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--lz-green-bg)", color: "var(--lz-green-fg)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <span className="font-medium">AI check — nothing needs attention here right now.</span>
        </div>
      );
    }
    return (
      <div className="mb-5 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 px-3.5 py-2 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>AI checks · {findings.length}</span>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {findings.map((f) => <Row key={f.id} f={f} />)}
        </div>
      </div>
    );
  }

  // Full group-wide panel (used on the AI hub).
  const crit = all.filter((f) => f.severity === "critical").length;
  const warn = all.filter((f) => f.severity === "warn").length;
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
          <span className="font-semibold" style={{ color: "var(--text)" }}>Checks &amp; suggestions</span>
        </div>
        <div className="flex items-center gap-1.5">
          {crit > 0 && <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5" style={{ background: "var(--lz-red-bg)", color: "var(--lz-red-fg)" }}>{crit} critical</span>}
          {warn > 0 && <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5" style={{ background: "var(--lz-yellow-bg)", color: "var(--lz-yellow-fg)" }}>{warn} action</span>}
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{all.length} total</span>
        </div>
      </div>
      {all.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Nothing needs attention across any module. ✓
        </div>
      ) : (
        <div className="divide-y max-h-[420px] overflow-y-auto" style={{ borderColor: "var(--border)" }}>
          {all.map((f) => <Row key={f.id} f={f} showModule />)}
        </div>
      )}
      <div className="px-4 py-2 border-t text-[11px]" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-faint)" }}>
        Rulethu AI scans Finance, Procurement, Requests, Treasury, Microfinance, HR and Investments. With a connected key it also explains and drafts the fix.
      </div>
    </Card>
  );
}
