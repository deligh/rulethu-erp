"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { canAccessPath, accessSummary } from "@/lib/access";

export default function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  // LoginGate guarantees a user before children render; this is a safety net.
  if (!user) return <>{children}</>;
  if (canAccessPath(user, pathname)) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-20">
      <div className="max-w-md text-center rounded-xl border p-8" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--lz-yellow-bg)", color: "var(--lz-yellow-fg)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
        </div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Restricted</h2>
        <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
          This area isn’t part of your access. You’re signed in as <b style={{ color: "var(--text)" }}>{user.name}</b> ({user.department}).
        </p>
        <p className="text-xs mb-5" style={{ color: "var(--text-faint)" }}>{accessSummary(user)}</p>
        <div className="flex items-center justify-center gap-2">
          <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Go to dashboard</Link>
          <Link href="/ai" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Ask AI</Link>
        </div>
        <p className="mt-5 text-[11px]" style={{ color: "var(--text-faint)" }}>Need access? Ask an administrator — in the real build this is granted by role.</p>
      </div>
    </div>
  );
}
