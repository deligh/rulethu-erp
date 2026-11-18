// Central registry of ERP modules — drives navigation and the dashboard grid.

export type ModuleKey =
  | "dashboard"
  | "ai"
  | "workspace"
  | "board"
  | "calendar"
  | "programme"
  | "comms"
  | "investments"
  | "portfolio"
  | "research"
  | "finance"
  | "alternatives"
  | "procurement"
  | "microfinance"
  | "treasury"
  | "requests"
  | "quiz"
  | "hr";

export interface AppModule {
  key: ModuleKey;
  name: string;
  href: string;
  tagline: string;
  description: string;
  /** inline SVG path data for a simple 24x24 line icon */
  icon: string;
  status: "live" | "beta" | "planned";
  group: "core" | "operations" | "people";
}

// Simple stroke icons (24x24, drawn with currentColor).
const ICONS = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  trending: "M3 17l6-6 4 4 8-8M21 7v5M21 7h-5",
  research: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
  finance: "M3 21h18M6 21V10M10 21V6M14 21v-8M18 21V4",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  cart: "M3 4h2l2.4 12.4a1 1 0 001 .8h9.2a1 1 0 001-.8L21 8H6M9 21a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z",
  coins: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  people: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  gantt: "M3 5h10M3 10h14M3 15h7M3 20h11M3 4v17",
  chat: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  treasury: "M3 10l9-6 9 6M5 9v10h14V9M9 19v-6h6v6M2 21h20",
  quiz: "M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2zM9 21h6M10 17v4M14 17v4",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  spark: "M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z",
  exchange: "M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4",
  briefcase: "M3 7h18v13H3zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18",
  board: "M4 4h16v12H4zM8 20h8M12 16v4M8 8h3M8 11h6",
  portfolio: "M3 3v18h18M7 15l3-4 3 3 5-7M18 10h2M18 10v2",
};

export const MODULES: AppModule[] = [
  {
    key: "dashboard",
    name: "Dashboard",
    href: "/",
    tagline: "Group overview",
    description: "Live view across every function — pipeline, portfolio, reporting and approvals.",
    icon: ICONS.grid,
    status: "live",
    group: "core",
  },
  {
    key: "ai",
    name: "Rulethu AI",
    href: "/ai",
    tagline: "Ask · draft · navigate",
    description:
      "Built-in AI agents — ask anything and jump straight to the right place, and draft documents from your own department templates using live platform data.",
    icon: ICONS.spark,
    status: "live",
    group: "core",
  },
  {
    key: "workspace",
    name: "My Workspace",
    href: "/workspace",
    tagline: "Your private space",
    description:
      "Your own private space — personal projects, a daily/weekly log of what you're working on, reminders, and a private AI assistant that sees only your work.",
    icon: ICONS.briefcase,
    status: "live",
    group: "core",
  },
  {
    key: "board",
    name: "Whiteboard",
    href: "/board",
    tagline: "Shared canvas",
    description:
      "A live collaborative whiteboard — drop sticky notes, brainstorm and map ideas together, shared across the group in real time.",
    icon: ICONS.board,
    status: "live",
    group: "core",
  },
  {
    key: "calendar",
    name: "Calendar",
    href: "/calendar",
    tagline: "Everything due",
    description:
      "One group calendar of every due date — TB maturities & coupons, task deadlines, leave, vendor payments, goals and payroll.",
    icon: ICONS.calendar,
    status: "live",
    group: "core",
  },
  {
    key: "programme",
    name: "Project Management",
    href: "/programme",
    tagline: "Boards, tasks & Gantt",
    description:
      "A Jira/ClickUp-style workspace — Kanban board, task list, timeline and workload across the whole group.",
    icon: ICONS.gantt,
    status: "live",
    group: "core",
  },
  {
    key: "comms",
    name: "Comms",
    href: "/comms",
    tagline: "Group chat & announcements",
    description:
      "A group conversation everyone sees — post messages and announcements, stored for the whole team.",
    icon: ICONS.chat,
    status: "live",
    group: "core",
  },
  {
    key: "investments",
    name: "Investments",
    href: "/investments",
    tagline: "Intake → decision",
    description:
      "Deal pipeline, valuation workbench (NAV, multiples, DCF), investment memos and IC decisions.",
    icon: ICONS.trending,
    status: "live",
    group: "core",
  },
  {
    key: "portfolio",
    name: "Portfolio & Investors",
    href: "/portfolio",
    tagline: "Holdings & LP relationships",
    description:
      "Live portfolio of holdings — cost, fair value, ownership and performance — plus an investor (LP) CRM tracking commitments, capital called, distributions and relationships.",
    icon: ICONS.portfolio,
    status: "live",
    group: "core",
  },
  {
    key: "research",
    name: "Research",
    href: "/research",
    tagline: "Market intelligence",
    description:
      "Daily and weekly market reports, sector coverage, publish once and share across the group.",
    icon: ICONS.research,
    status: "live",
    group: "core",
  },
  {
    key: "finance",
    name: "Finance",
    href: "/finance",
    tagline: "Books & reconciliation",
    description:
      "Statements, ledgers, bank reconciliation and management reporting for the finance team.",
    icon: ICONS.finance,
    status: "beta",
    group: "operations",
  },
  {
    key: "alternatives",
    name: "Alternative Investments",
    href: "/alternatives",
    tagline: "Private & real assets",
    description:
      "Private equity, real estate, infrastructure and commodity exposures with capital-call tracking.",
    icon: ICONS.layers,
    status: "beta",
    group: "operations",
  },
  {
    key: "procurement",
    name: "Procurement",
    href: "/procurement",
    tagline: "Source → pay",
    description:
      "Requisitions, vendors, purchase orders and approvals that link straight through to Finance.",
    icon: ICONS.cart,
    status: "beta",
    group: "operations",
  },
  {
    key: "requests",
    name: "Requests",
    href: "/requests",
    tagline: "Cross-department asks",
    description:
      "Internal requests between departments — Finance asks Procurement to source, Procurement asks Finance to pay, and more. Fulfilled requests post straight to the Finance ledger.",
    icon: ICONS.exchange,
    status: "live",
    group: "operations",
  },
  {
    key: "treasury",
    name: "Treasury",
    href: "/treasury",
    tagline: "Treasury bills & clients",
    description:
      "Treasury-bill portfolio by client — coupons, maturities and yields calculated live, with a maturity schedule and consolidated view.",
    icon: ICONS.treasury,
    status: "live",
    group: "operations",
  },
  {
    key: "microfinance",
    name: "Microfinance",
    href: "/microfinance",
    tagline: "Internal MFI",
    description:
      "Loan book, amortization schedules (reducing balance, flat, EMI) and portfolio-at-risk.",
    icon: ICONS.coins,
    status: "live",
    group: "operations",
  },
  {
    key: "quiz",
    name: "Daily Quiz",
    href: "/quiz",
    tagline: "Learn & compete",
    description:
      "A 15-minute daily challenge — read the brief, take the quiz, build a streak. Sharpens the team and builds culture.",
    icon: ICONS.quiz,
    status: "live",
    group: "people",
  },
  {
    key: "hr",
    name: "Human Resources",
    href: "/hr",
    tagline: "People & payroll",
    description:
      "Employee records, leave, and payroll runs that post journals to Finance.",
    icon: ICONS.people,
    status: "beta",
    group: "people",
  },
];

export const NAV_MODULES = MODULES; // all appear in the sidebar

export function moduleByKey(key: ModuleKey): AppModule | undefined {
  return MODULES.find((m) => m.key === key);
}
