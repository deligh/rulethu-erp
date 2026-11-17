"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_MODULES, AppModule } from "@/lib/modules";
import { useAppData } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { canAccessModule } from "@/lib/access";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

const GROUP_LABELS: Record<string, string> = {
  core: "Workspace",
  operations: "Operations",
  people: "People",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { resetAll } = useAppData();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("rulethu-sidebar-collapsed") === "1");
    } catch { /* ignore */ }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("rulethu-sidebar-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const visibleModules = user ? NAV_MODULES.filter((m) => canAccessModule(user, m.key)) : NAV_MODULES;
  const groups: { key: string; items: AppModule[] }[] = [];
  for (const m of visibleModules) {
    let g = groups.find((x) => x.key === m.group);
    if (!g) { g = { key: m.group, items: [] }; groups.push(g); }
    g.items.push(m);
  }

  return (
    <aside
      className="hidden md:flex md:flex-col shrink-0 h-screen sticky top-0 border-r transition-[width] duration-200"
      style={{ width: collapsed ? 64 : 248, background: "var(--sidebar-bg)", borderColor: "var(--border)" }}
    >
      {/* Brand / project switcher */}
      <div className="flex items-center gap-2.5 px-3 h-14 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-md font-bold text-white shrink-0" style={{ background: "var(--brand)" }}>R</div>
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>Rulethu Holdings</div>
            <div className="text-[11px] truncate" style={{ color: "var(--sidebar-muted)" }}>Investments ERP</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sidebar-muted)" }}>
                {GROUP_LABELS[g.key] ?? g.key}
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map((m) => {
                const active = isActive(pathname, m.href);
                return (
                  <Link
                    key={m.key}
                    href={m.href}
                    title={collapsed ? m.name : undefined}
                    className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : ""}`}
                    style={{
                      background: active ? "var(--sidebar-active-bg)" : "transparent",
                      color: active ? "var(--sidebar-active-fg)" : "var(--sidebar-text)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d={m.icon} />
                    </svg>
                    {!collapsed && <span className="flex-1 truncate">{m.name}</span>}
                    {!collapsed && m.status !== "live" && (
                      <span className="text-[9px] uppercase tracking-wide rounded px-1 py-0.5" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>{m.status}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className={`flex items-center gap-2 mb-2 rounded-md px-2 py-1.5 ${collapsed ? "justify-center" : ""}`} style={{ background: "color-mix(in srgb, var(--warn) 14%, transparent)" }} title="Work in progress — Delight">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: "var(--warn)" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--warn)" }} />
          </span>
          {!collapsed && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>In progress — <span style={{ color: "var(--text)", fontWeight: 600 }}>Delight</span></span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => { if (confirm("Reset all demo data to its starting state?")) resetAll(); }}
            className="w-full mb-2 rounded-md px-3 py-1.5 text-xs font-medium text-left"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            ↺ Reset demo data
          </button>
        )}
        <button
          onClick={toggle}
          className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium"
          style={{ color: "var(--sidebar-muted)" }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
