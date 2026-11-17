"use client";

import Link from "next/link";
import { useState } from "react";

const ITEMS: { label: string; sub: string; href: string; icon: string }[] = [
  { label: "Log deal", sub: "Investments", href: "/investments", icon: "M3 17l6-6 4 4 8-8" },
  { label: "Assign task", sub: "Programme", href: "/programme", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  { label: "Raise PO", sub: "Procurement", href: "/procurement", icon: "M3 4h2l2.4 12.4a1 1 0 001 .8h9.2a1 1 0 001-.8L21 8H6" },
  { label: "Disburse loan", sub: "Microfinance", href: "/microfinance", icon: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z" },
  { label: "Post journal", sub: "Finance", href: "/finance/general-ledger", icon: "M3 21h18M6 21V10M10 21V6M14 21v-8" },
  { label: "Publish report", sub: "Research", href: "/research/new", icon: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5" },
  { label: "Apply for leave", sub: "HR", href: "/hr/leave", icon: "M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
  { label: "Travel claim", sub: "HR", href: "/hr/travel", icon: "M5 17h14M6 17l1-5h10l1 5M8 12V8a4 4 0 018 0v4" },
  { label: "Announcement", sub: "Comms", href: "/comms", icon: "M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 11-5.8-1.6" },
];

export default function CreateMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white"
        style={{ background: "var(--brand)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Create
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-64 rounded-lg border py-1.5 z-30" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-overlay)" }}>
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Create</div>
            {ITEMS.map((it) => (
              <Link
                key={it.label}
                href={it.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                style={{ color: "var(--text)" }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md shrink-0" style={{ background: "var(--surface-2)", color: "var(--brand)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
                </span>
                <span className="flex-1">{it.label}</span>
                <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{it.sub}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
