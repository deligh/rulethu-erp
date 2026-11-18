"use client";

import { usePathname } from "next/navigation";

/**
 * Standalone routes (e.g. /lab — Minister's Desk) render full-screen and public,
 * outside the ERP login, sidebar and company data. Everything else gets the shell.
 */
export const STANDALONE_PREFIXES = ["/lab", "/desk"];

export default function ShellSwitch({ standalone, children }: { standalone: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const isStandalone = STANDALONE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  return <>{isStandalone ? standalone : children}</>;
}
