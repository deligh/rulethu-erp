import React from "react";
import CountUp from "./CountUp";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6 pt-1">
      <div>
        {eyebrow && (
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>{eyebrow}</div>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight leading-tight" style={{ color: "var(--text)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm max-w-2xl" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
  id,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  id?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tag
      id={id}
      className={`rz-card rounded-lg border p-5 ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)", ...style }}
    >
      {children}
    </Tag>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  hint?: string;
}) {
  return (
    <Card className="rz-rise flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className="text-2xl font-semibold tabular leading-tight" style={{ color: "var(--text)" }}><CountUp value={value} /></span>
      <div className="flex items-center gap-2 text-xs">
        {delta && (
          <span className="font-medium" style={{ color: delta.positive ? "var(--pos)" : "var(--neg)" }}>
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
        {hint && <span style={{ color: "var(--text-faint)" }}>{hint}</span>}
      </div>
    </Card>
  );
}

const LOZENGE: Record<string, { bg: string; fg: string }> = {
  live: { bg: "var(--lz-green-bg)", fg: "var(--lz-green-fg)" },
  beta: { bg: "var(--lz-blue-bg)", fg: "var(--lz-blue-fg)" },
  planned: { bg: "var(--lz-neutral-bg)", fg: "var(--lz-neutral-fg)" },
  pos: { bg: "var(--lz-green-bg)", fg: "var(--lz-green-fg)" },
  neg: { bg: "var(--lz-red-bg)", fg: "var(--lz-red-fg)" },
  warn: { bg: "var(--lz-yellow-bg)", fg: "var(--lz-yellow-fg)" },
  info: { bg: "var(--lz-blue-bg)", fg: "var(--lz-blue-fg)" },
  purple: { bg: "var(--lz-purple-bg)", fg: "var(--lz-purple-fg)" },
  neutral: { bg: "var(--lz-neutral-bg)", fg: "var(--lz-neutral-fg)" },
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof LOZENGE;
}) {
  const t = LOZENGE[tone] ?? LOZENGE.neutral;
  return (
    <span
      className="inline-flex items-center rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{children}</h2>
      {hint && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{hint}</span>}
    </div>
  );
}

export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
      <table className="rz-table w-full text-sm">
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider ${right ? "text-right" : "text-left"}`}
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </th>
  );
}

export function Td({ children, right, strong }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return (
    <td
      className={`px-4 py-2.5 ${right ? "text-right tabular" : ""} ${strong ? "font-medium" : ""}`}
      style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}
    >
      {children}
    </td>
  );
}

export function EmptyModuleNote({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{children}</p>
    </Card>
  );
}
