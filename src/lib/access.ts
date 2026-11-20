// Role- & department-based access control (demo layer).
//
// NOTE: this shapes what each person sees and can reach in the browser. It is
// a convincing demo of the access model, NOT enforced security — anything
// client-side can be bypassed. When the backend + database land, the same
// rules move server-side and become truly enforced. The config below is the
// single source of truth either way.

import { MODULES, ModuleKey } from "./modules";

export type AccessRole = "admin" | "exec" | "approver" | "member";

export interface SessionUser {
  id: string;
  name: string;
  role: string;         // job title
  department: string;
  email: string;
  accessRole: AccessRole;
}

// Modules every employee can reach, whatever their department.
export const SHARED_MODULES: ModuleKey[] = [
  "dashboard", "workspace", "board", "files", "calendar", "comms", "quiz", "ai", "research", "programme", "hr", "requests",
];

// Department-restricted modules → which departments may open them.
export const MODULE_DEPARTMENTS: Partial<Record<ModuleKey, string[]>> = {
  boardroom: ["Investments", "Finance"],
  finance: ["Finance"],
  treasury: ["Investments", "Finance"],
  investments: ["Investments"],
  portfolio: ["Investments"],
  alternatives: ["Investments"],
  microfinance: ["Finance", "Investments"],
  procurement: ["Finance", "Operations"],
};

// Sensitive sub-pages inside otherwise-shared modules (e.g. HR self-service is
// open, but payroll / documents / performance are HR & exec only).
export const RESTRICTED_PATHS: { prefix: string; departments: string[] }[] = [
  { prefix: "/hr/payroll", departments: ["Operations"] },
  { prefix: "/hr/documents", departments: ["Operations"] },
  { prefix: "/hr/performance", departments: ["Operations"] },
  // Research authoring templates (data entry) — only the Research desk may fill
  // and publish these. Once published, reports show in the Library for everyone.
  // The Library (/research) and Daily Market (/research/news) stay open to all.
  { prefix: "/research/daily", departments: ["Research"] },
  { prefix: "/research/weekly", departments: ["Research"] },
  { prefix: "/research/monthly", departments: ["Research"] },
  { prefix: "/research/new", departments: ["Research"] },
];

export function seesEverything(user: SessionUser): boolean {
  return user.accessRole === "admin" || user.accessRole === "exec";
}

export function canApprove(user: SessionUser): boolean {
  return seesEverything(user) || user.accessRole === "approver";
}

export function canAccessModule(user: SessionUser, key: ModuleKey): boolean {
  if (seesEverything(user)) return true;
  if (SHARED_MODULES.includes(key)) return true;
  const depts = MODULE_DEPARTMENTS[key];
  return !!depts && depts.includes(user.department);
}

// Longest-prefix match of a pathname to its owning module.
export function moduleKeyForPath(pathname: string): ModuleKey {
  if (pathname === "/") return "dashboard";
  const sorted = [...MODULES].filter((m) => m.href !== "/").sort((a, b) => b.href.length - a.href.length);
  for (const m of sorted) {
    if (pathname === m.href || pathname.startsWith(m.href + "/")) return m.key;
  }
  return "dashboard";
}

export function canAccessPath(user: SessionUser, pathname: string): boolean {
  if (seesEverything(user)) return true;
  // sensitive sub-pages first
  for (const r of RESTRICTED_PATHS) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + "/")) {
      return r.departments.includes(user.department);
    }
  }
  return canAccessModule(user, moduleKeyForPath(pathname));
}

// Human-readable summary of what a user can reach — shown on the login screen
// and the access-denied card.
export function accessSummary(user: SessionUser): string {
  if (seesEverything(user)) return "Full access — every module.";
  const extra = (Object.keys(MODULE_DEPARTMENTS) as ModuleKey[])
    .filter((k) => MODULE_DEPARTMENTS[k]!.includes(user.department))
    .map((k) => MODULES.find((m) => m.key === k)?.name ?? k);
  return extra.length
    ? `Shared workspace + ${extra.join(", ")}.`
    : "Shared workspace (dashboard, calendar, comms, AI, research, projects, HR self-service).";
}
