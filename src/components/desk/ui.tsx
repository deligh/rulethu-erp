"use client";

import React from "react";

export function Card({ children, className = "", style, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-xl border p-4 md:p-5 ${className}`} style={{ background: "var(--surface)", borderColor: "var(--border)", ...style }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, kind = "primary", disabled, className = "", type = "button", title }: { children: React.ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger" | "gold"; disabled?: boolean; className?: string; type?: "button" | "submit"; title?: string }) {
  const style: React.CSSProperties =
    kind === "primary" ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" }
      : kind === "gold" ? { background: "var(--accent)", color: "#1f1600", borderColor: "var(--accent)" }
        : kind === "danger" ? { background: "transparent", color: "var(--neg)", borderColor: "var(--border)" }
          : { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" };
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 hover:opacity-90 ${className}`} style={style}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputCls = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2";
export const inputStyle: React.CSSProperties = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6" style={{ background: "rgba(9,30,66,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} max-h-[92dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5`} style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>{title}</h3>
          <button onClick={onClose} className="text-xl leading-none px-2" style={{ color: "var(--text-faint)" }} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const PILL: Record<string, [string, string]> = {
  "Not started": ["var(--lz-neutral-bg)", "var(--lz-neutral-fg)"],
  "In progress": ["var(--lz-blue-bg)", "var(--lz-blue-fg)"],
  Done: ["var(--lz-green-bg)", "var(--lz-green-fg)"],
  Blocked: ["var(--lz-yellow-bg)", "var(--lz-yellow-fg)"],
  Overdue: ["var(--lz-red-bg)", "var(--lz-red-fg)"],
  High: ["var(--lz-red-bg)", "var(--lz-red-fg)"],
  Medium: ["var(--lz-yellow-bg)", "var(--lz-yellow-fg)"],
  Low: ["var(--lz-neutral-bg)", "var(--lz-neutral-fg)"],
  positive: ["var(--lz-green-bg)", "var(--lz-green-fg)"],
  neutral: ["var(--lz-neutral-bg)", "var(--lz-neutral-fg)"],
  critical: ["var(--lz-red-bg)", "var(--lz-red-fg)"],
};
export function Pill({ v }: { v: string }) {
  const [bg, fg] = PILL[v] ?? PILL["Not started"];
  return <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ background: bg, color: fg }}>{v}</span>;
}

export function PageHead({ kicker, title, sub, right }: { kicker: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{kicker}</div>
        <h1 className="text-2xl md:text-3xl font-bold mt-0.5" style={{ color: "var(--text)" }}>{title}</h1>
        {sub && <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      {right && <div className="flex gap-2 flex-wrap">{right}</div>}
    </div>
  );
}

/** Renders AI text: keeps line breaks, turns **bold** into bold, strips stray # headings. */
export function RichText({ text }: { text: string }) {
  const clean = text.replace(/^#{1,6}\s*/gm, "");
  return (
    <>
      {clean.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}

export function AiTag({ live }: { live: boolean }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: live ? "var(--lz-green-bg)" : "var(--lz-yellow-bg)", color: live ? "var(--lz-green-fg)" : "var(--lz-yellow-fg)" }}>
      {live ? "AI" : "Offline"}
    </span>
  );
}
