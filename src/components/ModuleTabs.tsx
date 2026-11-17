"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModuleKey, moduleByKey } from "@/lib/modules";
import { subNav } from "@/lib/submodules";
import { useAuth } from "@/lib/auth";
import { canAccessPath } from "@/lib/access";

// Sub-navigation for a module: tabs to each sub-module.
export default function ModuleTabs({ moduleKey }: { moduleKey: ModuleKey }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const mod = moduleByKey(moduleKey);
  const allSubs = subNav(moduleKey);
  // Hide tabs the signed-in user can't reach (e.g. Research authoring templates
  // are hidden from non-Research staff — they still see Library & Daily Market).
  const subs = mod
    ? allSubs.filter((s) => {
        const href = s.slug === "" ? mod.href : `${mod.href}/${s.slug}`;
        return !user || canAccessPath(user, href);
      })
    : allSubs;
  if (!mod || subs.length === 0) return null;

  return (
    <div className="mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <div className="flex gap-1 min-w-max">
        {subs.map((s) => {
          const href = s.slug === "" ? mod.href : `${mod.href}/${s.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={s.slug || "index"}
              href={href}
              className="relative px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{ color: active ? "var(--brand)" : "var(--text-muted)" }}
            >
              <span className="flex items-center gap-1.5">
                {s.name}
                {s.status !== "live" && (
                  <span
                    className="text-[9px] uppercase rounded px-1 py-0.5"
                    style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
                  >
                    {s.status}
                  </span>
                )}
              </span>
              {active && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5" style={{ background: "var(--brand)" }} />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
