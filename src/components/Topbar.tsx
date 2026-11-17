"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_MODULES } from "@/lib/modules";
import NotificationsBell from "@/components/NotificationsBell";
import CreateMenu from "@/components/CreateMenu";
import Avatar from "@/components/Avatar";
import { openAskAI } from "@/components/AskAI";
import { useAuth } from "@/lib/auth";
import { canAccessModule, seesEverything, accessSummary } from "@/lib/access";

export default function Topbar() {
  const pathname = usePathname();
  const { user, logout, isAdmin, changeMyPassword } = useAuth();
  const [menu, setMenu] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");

  const saveMyPw = () => { if (newPw.trim().length >= 4) { changeMyPassword(newPw.trim()); setNewPw(""); setPwOpen(false); setMenu(false); } };

  const navItems = user ? NAV_MODULES.filter((m) => canAccessModule(user, m.key)) : NAV_MODULES;
  const roleLabel = user ? (seesEverything(user) ? (user.accessRole === "admin" ? "Administrator" : "Executive") : user.role) : "";

  return (
    <header
      className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4 backdrop-blur"
      style={{ background: "color-mix(in srgb, var(--surface) 90%, transparent)", borderColor: "var(--border)" }}
    >
      {/* Mobile nav */}
      <select
        className="md:hidden rounded-md border px-2 py-1.5 text-sm"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        value={navItems.find((m) => (m.href === "/" ? pathname === "/" : pathname.startsWith(m.href)))?.href ?? "/"}
        onChange={(e) => { window.location.href = e.target.value; }}
      >
        {navItems.map((m) => (
          <option key={m.key} value={m.href}>{m.name}</option>
        ))}
      </select>

      <div className="hidden sm:block">
        <CreateMenu />
      </div>

      <div className="relative flex-1 max-w-lg">
        <button
          onClick={() => openAskAI()}
          className="group w-full flex items-center gap-2.5 rounded-md border pl-3 pr-2 py-1.5 text-sm text-left"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-faint)" }}
          title="Ask Rulethu AI or search (Ctrl/⌘ K)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
          <span className="flex-1 truncate">Ask Rulethu AI, or search…</span>
          <kbd className="hidden sm:block text-[10px] rounded px-1.5 py-0.5 shrink-0" style={{ background: "var(--surface)", color: "var(--text-faint)", border: "1px solid var(--border)" }}>⌘K</kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link href="/comms" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }} title="Comms" aria-label="Comms">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        </Link>
        <NotificationsBell />
        <div className="relative pl-1">
          <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2" title="Account">
            <Avatar name={user?.name ?? "?"} size={30} />
            <div className="hidden lg:block leading-tight text-left">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{user?.name ?? "Sign in"}</div>
              <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{roleLabel}</div>
            </div>
          </button>
          {menu && user && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
              <div className="absolute right-0 mt-2 w-64 rounded-lg border py-1.5 z-30" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-overlay)" }}>
                <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} size={34} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{user.name}</div>
                      <div className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>{user.email}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5" style={{ background: "var(--lz-blue-bg)", color: "var(--lz-blue-fg)" }}>{user.accessRole}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{user.department}</span>
                  </div>
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>{accessSummary(user)}</p>
                </div>
                <Link href="/calendar" onClick={() => setMenu(false)} className="block px-3 py-2 text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--text)" }}>My calendar</Link>
                <Link href="/hr" onClick={() => setMenu(false)} className="block px-3 py-2 text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--text)" }}>My HR & profile</Link>
                {pwOpen ? (
                  <div className="px-3 py-2">
                    <input type="password" autoFocus value={newPw} onChange={(e) => setNewPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveMyPw(); if (e.key === "Escape") setPwOpen(false); }} placeholder="New password" className="w-full rounded-md border px-2 py-1.5 text-sm mb-1.5" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
                    <button onClick={saveMyPw} className="w-full rounded-md px-2 py-1 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Update password</button>
                  </div>
                ) : (
                  <button onClick={() => { setPwOpen(true); setNewPw(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--text)" }}>Change my password</button>
                )}
                {isAdmin && <Link href="/admin" onClick={() => setMenu(false)} className="block px-3 py-2 text-sm font-medium hover:bg-[var(--surface-2)]" style={{ color: "var(--brand)" }}>⚙ Admin console</Link>}
                <button onClick={() => { setMenu(false); logout(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--neg)" }}>Sign out</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
