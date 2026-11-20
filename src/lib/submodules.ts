// Sub-modules inside each module: the sub-navigation tabs and the populated
// content behind each one. Index tabs (slug "") link to the module's own page;
// "custom" tabs link to a dedicated hand-built page (valuation, amortization…);
// the rest are rendered generically from the `content` here via the catch-all route.

import { ModuleKey } from "./modules";

export type SubStatus = "live" | "beta" | "planned";

export interface SubStat {
  label: string;
  value: string;
  hint?: string;
}

export interface SubColumn {
  key: string;
  label: string;
  right?: boolean;
}

export interface SubContent {
  subtitle: string;
  stats?: SubStat[];
  columns?: SubColumn[];
  rows?: Record<string, string | number>[];
  note?: string;
}

export interface SubModuleDef {
  slug: string; // "" = the module's index page
  name: string;
  status: SubStatus;
  custom?: boolean; // has its own dedicated page at `${moduleHref}/${slug}`
  content?: SubContent; // rendered by the generic catch-all route
}

export const SUBMODULES: Record<ModuleKey, SubModuleDef[]> = {
  dashboard: [],
  boardroom: [
    { slug: "", name: "Command Center", status: "live" },
    { slug: "stress", name: "Stress-Test", status: "live", custom: true },
    { slug: "memo", name: "IC Memo", status: "live", custom: true },
  ],
  ai: [
    { slug: "", name: "Assistant", status: "live" },
    { slug: "studio", name: "Document Studio", status: "live", custom: true },
    { slug: "research", name: "Deep Research", status: "live", custom: true },
    { slug: "rooms", name: "Deal Rooms", status: "live", custom: true },
    { slug: "meetings", name: "Meeting Notes", status: "live", custom: true },
    { slug: "templates", name: "Templates", status: "live", custom: true },
  ],
  workspace: [],
  board: [],
  files: [],
  portfolio: [
    { slug: "", name: "Holdings", status: "live" },
    { slug: "investors", name: "Investors (LP) CRM", status: "live", custom: true },
  ],
  calendar: [],
  comms: [],
  treasury: [],
  quiz: [],

  programme: [
    { slug: "", name: "Board", status: "live" },
    { slug: "list", name: "List", status: "live", custom: true },
    { slug: "timeline", name: "Timeline", status: "live", custom: true },
    {
      slug: "milestones",
      name: "Milestones",
      status: "beta",
      content: {
        subtitle: "Key dates the board, audit and fund-reporting cycles turn on.",
        stats: [
          { label: "Upcoming (30d)", value: "4" },
          { label: "This quarter", value: "9" },
          { label: "At risk", value: "1", hint: "needs attention" },
        ],
        columns: [
          { key: "milestone", label: "Milestone" },
          { key: "owner", label: "Owner" },
          { key: "due", label: "Due" },
          { key: "status", label: "Status" },
        ],
        rows: [
          { milestone: "IC decision — Solar IPP", owner: "Takudzwa Mhlanga", due: "23 Sep 2026", status: "On track" },
          { milestone: "Q3 board pack", owner: "Finance Team", due: "05 Oct 2026", status: "Not started" },
          { milestone: "Kestrel valuation sign-off", owner: "Delight", due: "22 Sep 2026", status: "On track" },
          { milestone: "Fund quarterly report", owner: "Finance Team", due: "15 Oct 2026", status: "At risk" },
        ],
      },
    },
    {
      slug: "workload",
      name: "Workload",
      status: "beta",
      content: {
        subtitle: "Open assignments per person, to balance the load.",
        columns: [
          { key: "person", label: "Person" },
          { key: "open", label: "Open tasks", right: true },
          { key: "avg", label: "Avg. progress", right: true },
          { key: "next", label: "Next due" },
        ],
        rows: [
          { person: "Delight", open: 2, avg: "40%", next: "22 Sep 2026" },
          { person: "Blessed", open: 2, avg: "40%", next: "19 Sep 2026" },
          { person: "Gamu", open: 1, avg: "35%", next: "02 Oct 2026" },
          { person: "Finance Team", open: 3, avg: "30%", next: "17 Sep 2026" },
          { person: "Takudzwa Mhlanga", open: 1, avg: "0%", next: "23 Sep 2026" },
        ],
      },
    },
  ],

  investments: [
    { slug: "", name: "Pipeline", status: "live" },
    { slug: "valuation", name: "Valuation Workbench", status: "live", custom: true },
    { slug: "fcff", name: "Company Valuation", status: "live", custom: true },
    { slug: "dcf", name: "DCF Valuation", status: "live", custom: true },
    { slug: "models", name: "Financial Models", status: "live", custom: true },
    {
      slug: "memos",
      name: "Investment Memos",
      status: "beta",
      content: {
        subtitle: "Investment memos drafted from deal documents, ready for committee.",
        stats: [
          { label: "In draft", value: "2" },
          { label: "In review", value: "1" },
          { label: "Approved", value: "3" },
        ],
        columns: [
          { key: "deal", label: "Deal" },
          { key: "author", label: "Author" },
          { key: "updated", label: "Updated" },
          { key: "status", label: "Status" },
        ],
        rows: [
          { deal: "Project Kestrel — Insurer", author: "Delight", updated: "15 Sep 2026", status: "Draft" },
          { deal: "Solar IPP — 40MW", author: "Blessed", updated: "14 Sep 2026", status: "In review" },
          { deal: "Dry-Port Logistics Hub", author: "Gamu", updated: "12 Sep 2026", status: "Draft" },
          { deal: "Lithium Off-take", author: "Blessed", updated: "08 Sep 2026", status: "Approved" },
        ],
      },
    },
    {
      slug: "committee",
      name: "Investment Committee",
      status: "beta",
      content: {
        subtitle: "IC agenda and decisions — chaired by the CEO, with an auditable trail.",
        columns: [
          { key: "deal", label: "Deal" },
          { key: "date", label: "IC date" },
          { key: "ticket", label: "Ticket", right: true },
          { key: "decision", label: "Decision" },
        ],
        rows: [
          { deal: "Solar IPP — 40MW", date: "23 Sep 2026", ticket: "$22.0M", decision: "Scheduled" },
          { deal: "Lithium Off-take", date: "05 Aug 2026", ticket: "$30.0M", decision: "Approved" },
          { deal: "Cold-Chain Manufacturing", date: "29 Jul 2026", ticket: "$3.2M", decision: "Revise & resubmit" },
        ],
        note: "Each IC item requires an investment memo, a valuation model and a risk assessment before it is tabled.",
      },
    },
    {
      slug: "diligence",
      name: "Due Diligence",
      status: "beta",
      content: {
        subtitle: "Diligence workstreams and document requests per live deal.",
        columns: [
          { key: "deal", label: "Deal" },
          { key: "stream", label: "Workstream" },
          { key: "owner", label: "Owner" },
          { key: "status", label: "Status" },
        ],
        rows: [
          { deal: "Dry-Port Logistics Hub", stream: "Financial DD", owner: "Deloitte", status: "In progress" },
          { deal: "Dry-Port Logistics Hub", stream: "Legal & title", owner: "External counsel", status: "In progress" },
          { deal: "Dry-Port Logistics Hub", stream: "Technical / engineering", owner: "Gamu", status: "Pending" },
          { deal: "Solar IPP — 40MW", stream: "Environmental & social", owner: "Blessed", status: "Complete" },
        ],
      },
    },
    {
      slug: "monitoring",
      name: "Portfolio Monitoring",
      status: "beta",
      content: {
        subtitle: "Post-investment monitoring — quarterly valuation refresh and covenants.",
        columns: [
          { key: "asset", label: "Asset" },
          { key: "nav", label: "Latest NAV", right: true },
          { key: "refresh", label: "Next refresh" },
          { key: "flag", label: "Flag" },
        ],
        rows: [
          { asset: "Lithium Off-take SPV", nav: "$21.5M", refresh: "30 Sep 2026", flag: "None" },
          { asset: "Harare Logistics Park", nav: "$10.8M", refresh: "30 Sep 2026", flag: "None" },
          { asset: "40MW Solar IPP", nav: "$12.4M", refresh: "30 Sep 2026", flag: "Watch — tariff" },
        ],
      },
    },
  ],

  research: [
    { slug: "", name: "Library", status: "live" },
    { slug: "news", name: "Daily Market", status: "live", custom: true },
    { slug: "daily", name: "Daily Intelligence", status: "live", custom: true },
    { slug: "weekly", name: "Weekly Sector", status: "live", custom: true },
    { slug: "monthly", name: "Monthly", status: "live", custom: true },
    { slug: "new", name: "Quick Note", status: "beta", custom: true },
  ],

  finance: [
    { slug: "", name: "Reconciliation", status: "beta" },
    { slug: "capture", name: "Daily Capture", status: "live", custom: true },
    { slug: "statements", name: "Financial Statements", status: "live", custom: true },
    { slug: "cash-report", name: "Daily Cash Report", status: "live", custom: true },
    { slug: "general-ledger", name: "General Ledger", status: "live", custom: true },
    { slug: "trial-balance", name: "Trial Balance", status: "live", custom: true },
    { slug: "income-statement", name: "Income Statement", status: "live", custom: true },
    { slug: "balance-sheet", name: "Balance Sheet", status: "live", custom: true },
    { slug: "cash-flow", name: "Cash Flow", status: "live", custom: true },
    { slug: "reports", name: "Management Reports", status: "live", custom: true },
    { slug: "chart-of-accounts", name: "Chart of Accounts", status: "live", custom: true },
    { slug: "expense-claims", name: "Expense Claims", status: "live", custom: true },
  ],

  alternatives: [],
  requests: [],

  procurement: [
    { slug: "", name: "Purchase Orders", status: "live" },
    { slug: "requisitions", name: "Requisitions", status: "live", custom: true },
    { slug: "vendors", name: "Vendors", status: "live", custom: true },
    { slug: "goods-receipt", name: "Goods Receipt", status: "live", custom: true },
    { slug: "payments", name: "Payments", status: "live", custom: true },
  ],

  microfinance: [
    { slug: "", name: "Loan Book", status: "live" },
    { slug: "amortization", name: "Amortization", status: "live", custom: true },
    {
      slug: "repayments",
      name: "Repayments",
      status: "beta",
      content: {
        subtitle: "Instalments received and upcoming across the loan book.",
        columns: [
          { key: "loan", label: "Loan" },
          { key: "borrower", label: "Borrower" },
          { key: "due", label: "Next due" },
          { key: "amount", label: "Instalment", right: true },
          { key: "status", label: "Status" },
        ],
        rows: [
          { loan: "L-5521", borrower: "Tanaka Retail", due: "01 Oct 2026", amount: "$2,373", status: "On time" },
          { loan: "L-5518", borrower: "Chipo Agri Co-op", due: "10 Oct 2026", amount: "$4,812", status: "Late" },
          { loan: "L-5510", borrower: "Moyo Transport", due: "15 Sep 2026", amount: "$3,060", status: "Overdue" },
          { loan: "L-5503", borrower: "Sithole Traders", due: "20 Oct 2026", amount: "$2,679", status: "On time" },
        ],
      },
    },
    {
      slug: "par",
      name: "Portfolio at Risk",
      status: "beta",
      content: {
        subtitle: "Ageing of overdue balances (PAR).",
        stats: [
          { label: "PAR>30", value: "$60,000", hint: "1 loan" },
          { label: "PAR ratio", value: "43.2%", hint: "of book" },
          { label: "Provisions", value: "$18,000" },
        ],
        columns: [
          { key: "bucket", label: "Ageing bucket" },
          { key: "count", label: "Loans", right: true },
          { key: "balance", label: "Balance", right: true },
        ],
        rows: [
          { bucket: "Current", count: 2, balance: "$40,000" },
          { bucket: "1–30 days", count: 1, balance: "$40,000" },
          { bucket: "31–90 days", count: 1, balance: "$60,000" },
          { bucket: "90+ days", count: 0, balance: "$0" },
        ],
      },
    },
  ],

  hr: [
    { slug: "", name: "Directory", status: "live" },
    { slug: "org", name: "Org Chart", status: "live", custom: true },
    { slug: "leave", name: "Leave", status: "live", custom: true },
    { slug: "travel", name: "Travel Claims", status: "live", custom: true },
    { slug: "payroll", name: "Payroll", status: "live", custom: true },
    { slug: "goals", name: "Development", status: "live", custom: true },
    { slug: "performance", name: "Performance", status: "live", custom: true },
    { slug: "documents", name: "Documents", status: "live", custom: true },
  ],
};

export function subNav(moduleKey: ModuleKey): SubModuleDef[] {
  return SUBMODULES[moduleKey] ?? [];
}

export function getSub(moduleKey: ModuleKey, slug: string): SubModuleDef | undefined {
  return (SUBMODULES[moduleKey] ?? []).find((s) => s.slug === slug);
}
