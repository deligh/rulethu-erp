"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { getSub } from "@/lib/submodules";

function titleize(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/") {
    return (
      <div className="px-5 md:px-8 pt-4 pb-1 max-w-[1440px] w-full mx-auto">
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Rulethu Holdings</span>
      </div>
    );
  }

  const segs = pathname.split("/").filter(Boolean);
  const moduleSeg = segs[0];
  const mod = MODULES.find((m) => m.href === `/${moduleSeg}`);
  const crumbs: { label: string; href: string }[] = [{ label: "Rulethu", href: "/" }];

  if (mod) {
    crumbs.push({ label: mod.name, href: mod.href });
    if (segs[1]) {
      const sub = getSub(mod.key, segs[1]);
      crumbs.push({ label: sub?.name ?? titleize(segs[1]), href: pathname });
    }
  }

  return (
    <nav className="px-5 md:px-8 pt-4 pb-1 max-w-[1440px] w-full mx-auto">
      <ol className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1.5">
              {last ? (
                <span style={{ color: "var(--text-muted)" }}>{c.label}</span>
              ) : (
                <Link href={c.href} className="hover:underline">{c.label}</Link>
              )}
              {!last && <span style={{ color: "var(--text-faint)" }}>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
