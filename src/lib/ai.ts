// Rulethu AI — demo-mode engine.
//
// This powers the Ask-AI palette, the AI hub and the Document Studio WITHOUT
// calling any model, so it costs nothing and works offline for the demo.
// Every function here is deterministic / rule-based. When a Claude API key is
// added (a single server route), `answerQuery` and `draftFromTemplate` are the
// two seams that get swapped for a real model call — the UI never changes.

import { MODULES, ModuleKey } from "./modules";
import { SUBMODULES } from "./submodules";
import { Employee, employeeCompleteness } from "./seed";

export const AI_DEMO_MODE = true;
export const AI_DEMO_NOTE =
  "Demo mode — responses are illustrative and generated on-device. Connect a Claude API key to make this draft and answer for real.";

/* ------------------------------------------------------------------ */
/* Navigation index — every page & tab, so the AI can "take you there" */
/* ------------------------------------------------------------------ */

export interface NavItem {
  label: string;   // what to show ("Treasury · Rate History")
  href: string;
  module: string;  // parent module name
  keywords: string;
}

const SYNONYMS: Partial<Record<ModuleKey, string>> = {
  investments: "deal pipeline valuation dcf memo ic committee diligence origination equity",
  finance: "ledger journal trial balance income statement balance sheet cash accounts books gl",
  treasury: "treasury bills tb coupon maturity yield gilts government securities",
  microfinance: "loan amortization mfi repayment par credit borrower disburse schedule",
  procurement: "purchase order po requisition vendor supplier goods receipt payment source to pay",
  hr: "employee staff people leave payroll org chart performance kyc next of kin passport salary",
  research: "report market intelligence sector daily weekly monthly note publish",
  comms: "chat channel announcement message slack file share",
  programme: "project task board gantt timeline kanban milestone workload assign",
  alternatives: "private equity real estate infrastructure capital call distribution dpi tvpi",
  calendar: "due dates maturities deadlines events schedule month",
  quiz: "learn quiz streak leaderboard culture",
  dashboard: "overview home kpi summary",
};

export const NAV_INDEX: NavItem[] = (() => {
  const items: NavItem[] = [];
  for (const m of MODULES) {
    items.push({
      label: m.name,
      href: m.href,
      module: m.name,
      keywords: `${m.name} ${m.tagline} ${SYNONYMS[m.key] ?? ""}`.toLowerCase(),
    });
    for (const sub of SUBMODULES[m.key] ?? []) {
      if (sub.slug === "") continue; // index tab == the module itself
      items.push({
        label: `${m.name} · ${sub.name}`,
        href: `${m.href}/${sub.slug}`,
        module: m.name,
        keywords: `${m.name} ${sub.name} ${SYNONYMS[m.key] ?? ""}`.toLowerCase(),
      });
    }
  }
  return items;
})();

export function navSearch(query: string, limit = 6): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const scored = NAV_INDEX.map((it) => {
    const hay = `${it.label.toLowerCase()} ${it.keywords}`;
    let score = 0;
    for (const w of words) {
      if (it.label.toLowerCase().includes(w)) score += 3;
      if (hay.includes(w)) score += 1;
    }
    if (it.label.toLowerCase() === q) score += 5;
    return { it, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.it);
}

/* ------------------------------------------------------------------ */
/* Agents — the "built-in agents" shown on the AI hub (AltraSure-style) */
/* ------------------------------------------------------------------ */

export interface AiAgent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;    // 24x24 stroke path
  accent: string;  // css var
  action: { label: string; href?: string; ask?: string };
  status: "live" | "beta";
}

export const AGENTS: AiAgent[] = [
  {
    id: "navigator",
    name: "Navigator",
    tagline: "Find anything, go anywhere",
    description: "Ask where something lives — “where do I log a travel claim?” — and it answers and takes you straight to the right tab.",
    icon: "M12 2l3 7 7 .5-5.5 4.5 2 7L12 17l-6.5 4 2-7L2 9.5 9 9z",
    accent: "var(--brand)",
    action: { label: "Ask the Navigator", ask: "Where do I " },
    status: "live",
  },
  {
    id: "drafter",
    name: "Document Drafter",
    tagline: "Draft from your templates",
    description: "Pick a department template — investment memo, offer letter, credit paper — give a short brief, and it drafts the full document using live platform data.",
    icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6",
    accent: "var(--lz-blue-fg)",
    action: { label: "Open Document Studio", href: "/ai/studio" },
    status: "live",
  },
  {
    id: "research-writer",
    name: "Research Writer",
    tagline: "Notes from a few bullets",
    description: "Turn three bullet points into a formatted daily, weekly-sector or monthly research note in the house style, ready to publish to the group.",
    icon: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
    accent: "var(--lz-purple-fg)",
    action: { label: "Draft a research note", href: "/ai/studio?dept=Research" },
    status: "live",
  },
  {
    id: "analyst",
    name: "Data Analyst",
    tagline: "Answers from live data",
    description: "Ask about the pipeline, loan book, treasury maturities or who’s on leave — it answers from the platform’s current numbers and cites where it looked.",
    icon: "M3 3v18h18M7 15l3-3 3 3 5-6",
    accent: "var(--lz-green-fg)",
    action: { label: "Ask a data question", ask: "How many " },
    status: "live",
  },
  {
    id: "valuation",
    name: "Valuation Assistant",
    tagline: "Explain a DCF or model",
    description: "Walk through a DCF or a sector model’s output in plain English — what drives the value and where the sensitivities bite.",
    icon: "M3 17l6-6 4 4 8-8M21 7v5M21 7h-5",
    accent: "var(--warn)",
    action: { label: "Open DCF", href: "/investments/dcf" },
    status: "beta",
  },
  {
    id: "comparer",
    name: "Document Comparer",
    tagline: "Spot what changed",
    description: "Compare two versions of a document or a term sheet against a template and surface the differences and anything missing, for a person to check.",
    icon: "M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 7h6M9 12h6M9 17h6",
    accent: "var(--lz-blue-fg)",
    action: { label: "Coming next", href: "/ai/studio" },
    status: "beta",
  },
];

/* ------------------------------------------------------------------ */
/* Live-data snapshot the answer engine reads from                    */
/* ------------------------------------------------------------------ */

// Role/department scoping for the AI context, so the assistant never reveals
// data a user couldn't open in the UI (keeps the chatbot consistent with the
// role-scoped dashboard and module access — "no leakages").
export interface AiScope { deals: boolean; ledger: boolean; book: boolean }

export function scopeSnapshot(snap: AiSnapshot, scope: AiScope): AiSnapshot {
  return {
    ...snap,
    deals: scope.deals ? snap.deals : [],
    loans: scope.book ? snap.loans : [],
    tbills: scope.book ? snap.tbills : [],
    ledger: scope.ledger ? snap.ledger : { debit: 0, credit: 0 },
    checks: scope.ledger || scope.deals ? snap.checks : [],
    // employees, tasks, leave, reports and knowledge stay — they are group-shared.
  };
}

export interface AiSnapshot {
  deals: { name: string; stage: string; ticket: number; sector: string }[];
  loans: { borrower: string; principal: number; status: string }[];
  tbills: { client: string; reference: string; maturityDate: string; faceValue: number }[];
  employees: { name: string; role: string; department: string; status: string }[];
  tasks: { title: string; status?: string; assignee?: string; priority?: string; module?: string }[];
  leave: { employee: string; type: string; status: string }[];
  reports: { title: string }[];
  ledger: { debit: number; credit: number };
  checks?: Finding[];
  knowledge?: { name: string; folder: string; description: string; excerpt?: string; readable: boolean }[];
}

export interface LedgerCheck {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
  diff: number;   // debit - credit
  hint: string;
}

/** Check a trial balance and suggest the likely cause of any imbalance. */
export function ledgerCheck(totalDebit: number, totalCredit: number): LedgerCheck {
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const abs = Math.abs(diff);
  if (abs < 0.005) {
    return { balanced: true, totalDebit, totalCredit, diff: 0, hint: "Total debits equal total credits — the books are in balance." };
  }
  const m = (n: number) => money(n);
  const causes: string[] = [];
  if (abs >= 9 && Math.abs(abs % 9) < 0.005) {
    causes.push(`the gap is divisible by 9, which almost always means a **transposition** (two digits swapped — e.g. 540 keyed as 450)`);
  }
  causes.push(`a **one-sided or missing entry of ${m(abs)}** — or a single posting of ${m(abs / 2)} entered on the wrong side (debit instead of credit), which opens a ${m(abs)} gap`);
  const side = diff > 0 ? "debits exceed credits" : "credits exceed debits";
  return {
    balanced: false,
    totalDebit, totalCredit, diff,
    hint: `${side} by ${m(abs)}. Likely cause: ${causes.join("; ")}. Scan the ledger for an entry of ${m(abs)} or ${m(abs / 2)}.`,
  };
}

export interface AiAnswer {
  text: string;
  sources: NavItem[];
  agent: string;
}

const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}k` : `$${n}`;

/** The demo "model". Rule-based intents over the live snapshot + nav index. */
export function answerQuery(query: string, snap: AiSnapshot): AiAnswer {
  const q = query.trim().toLowerCase();
  const sources = navSearch(query);

  if (!q) {
    return {
      agent: "Navigator",
      text: "Ask me anything — where to find a page, or a question about the pipeline, loan book, treasury, research or people. Try “where do I raise a purchase order?” or “how many deals are in the pipeline?”",
      sources: [],
    };
  }

  const has = (...k: string[]) => k.some((w) => q.includes(w));

  // --- Navigation intent ("where / how do I / take me to / open") ---
  if (has("where", "how do i", "how do you", "take me", "navigate", "find the", "open the", "go to", "which tab")) {
    if (sources.length) {
      const top = sources[0];
      return {
        agent: "Navigator",
        text: `That lives under **${top.label}**. I can take you straight there — use the link below. ${sources.length > 1 ? "A couple of related places are listed too." : ""}`,
        sources,
      };
    }
  }

  // --- Cross-module checks / "what needs attention" ---
  if (has("attention", "needs attention", "any issue", "issues", "anomal", "anything wrong", "what's wrong", "whats wrong", "suggest", "flag", "review everything", "what should i", "anything i should", "to do", "to-do", "problems", "checks")) {
    const checks = snap.checks ?? [];
    if (checks.length === 0) {
      return { agent: "Data Analyst", text: "I ran a full scan across every module — Finance, Procurement, Requests, Treasury, Microfinance, HR and Investments — and nothing needs attention right now. ✓", sources: [] };
    }
    const crit = checks.filter((c) => c.severity === "critical").length;
    const warn = checks.filter((c) => c.severity === "warn").length;
    const top = checks.slice(0, 5);
    return {
      agent: "Data Analyst",
      text: `I scanned every module and found **${checks.length} thing${checks.length > 1 ? "s" : ""}** to look at${crit ? ` (${crit} critical)` : warn ? ` (${warn} to action)` : ""}:\n\n${top.map((c) => `• **${c.title}** — ${c.detail}`).join("\n")}${checks.length > top.length ? `\n\n…and ${checks.length - top.length} more on the AI hub.` : ""}`,
      sources: top.map((c) => ({ label: `${c.moduleName} — ${c.title}`, href: c.href, module: c.moduleName, keywords: "" })).slice(0, 4),
    };
  }

  // --- Pipeline / deals ---
  if (has("deal", "pipeline", "ticket", "ic ", "committee", "origination")) {
    const total = snap.deals.reduce((s, d) => s + d.ticket, 0);
    const top = [...snap.deals].sort((a, b) => b.ticket - a.ticket).slice(0, 3);
    return {
      agent: "Data Analyst",
      text: `There are **${snap.deals.length} deals** in the live pipeline worth **${money(total)}** in proposed tickets. The largest are ${top
        .map((d) => `${d.name} (${money(d.ticket)}, ${d.stage})`)
        .join(", ")}. Open the pipeline to drill in or start a memo.`,
      sources: navSearch("investments pipeline"),
    };
  }

  // --- Loan book / overdue / PAR ---
  if (has("loan", "overdue", "par", "arrears", "borrower", "repayment", "microfinance", "mfi")) {
    const atRisk = snap.loans.filter((l) => l.status === "PAR>30");
    const book = snap.loans.reduce((s, l) => s + l.principal, 0);
    const riskTxt = atRisk.length
      ? `**${atRisk.length}** ${atRisk.length === 1 ? "loan is" : "loans are"} flagged PAR>30 (${atRisk.map((l) => l.borrower).join(", ")}).`
      : "Nothing is currently flagged PAR>30.";
    return {
      agent: "Data Analyst",
      text: `The MFI book stands at **${money(book)}** across ${snap.loans.length} loans. ${riskTxt} You can model a repayment schedule in the Amortization tab.`,
      sources: navSearch("microfinance amortization"),
    };
  }

  // --- Treasury / TBills / maturities ---
  if (has("treasury", "tbill", "t-bill", "bill", "coupon", "maturity", "matures", "yield")) {
    const next = [...snap.tbills].sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))[0];
    const face = snap.tbills.reduce((s, t) => s + t.faceValue, 0);
    return {
      agent: "Data Analyst",
      text: `The treasury book holds **${snap.tbills.length} bills** with **${money(face)}** face value. ${
        next ? `The next to mature is ${next.reference} (${next.client}) on ${next.maturityDate}.` : ""
      } See the maturity Gantt and per-client statements in Treasury.`,
      sources: navSearch("treasury maturity"),
    };
  }

  // --- Financial health / does it balance / errors ---
  if (has("balance", "trial balance", "reconcile", "out of balance", "imbalance", "doesn't balance", "does not balance", "dont balance", "books balance", "financials correct")) {
    const chk = ledgerCheck(snap.ledger.debit, snap.ledger.credit);
    return {
      agent: "Data Analyst",
      text: chk.balanced
        ? `The books **balance** ✓ — total debits (${money(chk.totalDebit)}) equal total credits (${money(chk.totalCredit)}) across the ledger. Open the Trial Balance for the full breakdown.`
        : `⚠️ The trial balance is **out of balance** — ${chk.hint} Open the Trial Balance and General Ledger to track it down.`,
      sources: navSearch("finance trial balance"),
    };
  }

  // --- People / leave / HR ---
  if (has("leave", "who is on", "employee", "staff", "payroll", "org chart", "headcount", "people")) {
    const onLeave = snap.employees.filter((e) => e.status === "On Leave").map((e) => e.name);
    const pending = snap.leave.filter((l) => l.status === "Pending");
    return {
      agent: "Data Analyst",
      text: `Headcount is **${snap.employees.length}**. ${
        onLeave.length ? `Currently on leave: ${onLeave.join(", ")}. ` : "Nobody is marked on leave right now. "
      }${pending.length ? `There ${pending.length === 1 ? "is" : "are"} ${pending.length} leave request(s) awaiting approval.` : ""} Manage it all under HR.`,
      sources: navSearch("hr leave"),
    };
  }

  // --- Build a model → Model Builder ---
  if (has("build a model", "build model", "new model", "create a model", "model for", "financial model", "dcf for", "value a ", "valuation model")) {
    return {
      agent: "Valuation Assistant",
      text: `I can build that. Open the **Model Builder** — describe the opportunity and I’ll draft the assumptions, or clone a historic model that mimics a past Rulethu deal, or enter the inputs yourself. It values live (NPV, IRR, payback) and you can save it.`,
      sources: [{ label: "Investments · Model Builder", href: "/investments/models/builder", module: "Investments", keywords: "" }, { label: "DCF Valuation", href: "/investments/dcf", module: "Investments", keywords: "" }],
    };
  }

  // --- Draft / write intent → Document Studio ---
  if (has("draft", "write", "memo", "letter", "report", "note", "paper", "generate", "template", "document")) {
    return {
      agent: "Document Drafter",
      text: `I can draft that for you. Open the **Document Studio**, choose the matching department template (investment memo, research note, offer letter, credit paper, board summary…), give a one-line brief, and I’ll produce a full draft using the platform’s live data — ready to edit and download.`,
      sources: [{ label: "AI · Document Studio", href: "/ai/studio", module: "Rulethu AI", keywords: "" }, ...navSearch(query).slice(0, 2)],
    };
  }

  // --- Research ---
  if (has("research", "market", "sector", "intelligence", "daily", "weekly", "monthly")) {
    return {
      agent: "Research Writer",
      text: `There ${snap.reports.length === 1 ? "is" : "are"} **${snap.reports.length}** research ${
        snap.reports.length === 1 ? "note" : "notes"
      } in the library. I can turn a few bullet points into a formatted daily, weekly-sector or monthly note — start one in the Document Studio, or browse what’s published in Research.`,
      sources: navSearch("research"),
    };
  }

  // --- Fallback: lead with navigation if we matched anything ---
  if (sources.length) {
    return {
      agent: "Navigator",
      text: `Here’s what I found for “${query.trim()}”. The most relevant place is **${sources[0].label}** — open it below. If you meant to draft something instead, the Document Studio can help.`,
      sources,
    };
  }

  return {
    agent: "Navigator",
    text: `I couldn’t pin that to a specific page in demo mode. Once a Claude API key is connected I’ll answer this fully from your live data and documents. In the meantime, try a module name (e.g. “treasury”, “payroll”, “pipeline”) or open the Document Studio to draft something.`,
    sources: navSearch("dashboard"),
  };
}

/* ------------------------------------------------------------------ */
/* Live AI answer — tries Claude with the platform snapshot as context */
/* ------------------------------------------------------------------ */

const ASSISTANT_SYSTEM =
  "You are Rulethu AI, the built-in assistant inside Rulethu Holdings' in-house " +
  "ERP/CRM. Rulethu is an African investment group in Harare, Zimbabwe (private " +
  "equity, solar/IPP, mining, microfinance, treasury bills, ZSE/VFEX equities). " +
  "You help staff across Investments, Finance, Treasury, Microfinance, " +
  "Procurement, HR, Research, Programme and Comms. You are given a LIVE SNAPSHOT " +
  "of the platform's current data as JSON — answer from it with real numbers " +
  "when the question is about the group's own pipeline, loan book, treasury, " +
  "people, tasks or checks.\n" +
  "Answer thoroughly and precisely — give a complete, well-reasoned response " +
  "(several sentences to a few short paragraphs), not a one-liner. Lead with the " +
  "direct answer, then the supporting detail and, where useful, a next step. Use " +
  "**bold** for key figures and short bullet lists where they help. Be specific " +
  "to Rulethu and the Zimbabwe/SADC context. If asked where something lives, name " +
  "the module and the path. Never invent data that isn't in the snapshot — if a " +
  "number isn't there, say what's needed to get it, rather than guessing.\n" +
  "WORKLOAD & TASK ALLOCATION: the snapshot includes `team` — each person's " +
  "department, role, current open-task count and what they're working on, and whether " +
  "they're on leave. Use it to answer workload questions precisely (who is busiest, " +
  "capacity per person, the split across the team). When asked who should do a piece of " +
  "work or who to assign a task to, give a clear RANKED shortlist (1, 2, 3) with a " +
  "one-line reason each — weigh (a) department/role fit, (b) current open-task load " +
  "(prefer people with spare capacity), and (c) availability (skip or flag anyone on " +
  "leave). Be decisive and practical, like a good chief of staff.\n" +
  "KNOWLEDGE LIBRARY: the snapshot may include `knowledge` — documents staff have uploaded to the " +
  "File Library, each with a folder, a description and (for text/CSV/spreadsheet files) an extracted " +
  "text excerpt. Treat this as the group's own source of truth: when a question relates to an uploaded " +
  "document, use its excerpt and cite it by name and folder (e.g. \"per the Q3 Board Pack in Finance\"). " +
  "If a relevant document is listed but has no excerpt (e.g. a PDF or Word file), tell the user it's in " +
  "the library and summarise from its description, noting you can't read its full text yet. Combine this " +
  "with your general knowledge to give the most complete, reliable answer.";

function compactSnapshot(snap: AiSnapshot): string {
  // Per-person workload (for staffing / allocation questions).
  const load: Record<string, { open: number; done: number; openTitles: string[] }> = {};
  for (const t of snap.tasks) {
    const who = t.assignee || "Unassigned";
    (load[who] ??= { open: 0, done: 0, openTitles: [] });
    if ((t.status || "").toLowerCase() === "done") load[who].done += 1;
    else { load[who].open += 1; if (load[who].openTitles.length < 4) load[who].openTitles.push(t.title); }
  }
  const people = snap.employees.map((e) => ({
    name: e.name, dept: e.department, role: e.role,
    onLeave: e.status === "On Leave",
    openTasks: load[e.name]?.open ?? 0,
    doneTasks: load[e.name]?.done ?? 0,
    working: load[e.name]?.openTitles ?? [],
  }));
  // Keep it small (cost) — summaries, not full rows.
  const sum = {
    deals: snap.deals.map((d) => ({ name: d.name, stage: d.stage, ticket: d.ticket, sector: d.sector })),
    loans: { count: snap.loans.length, atRisk: snap.loans.filter((l) => l.status === "PAR>30").map((l) => l.borrower), book: snap.loans.reduce((s, l) => s + l.principal, 0) },
    tbills: { count: snap.tbills.length, face: snap.tbills.reduce((s, t) => s + t.faceValue, 0), next: [...snap.tbills].sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))[0] ?? null },
    team: people,
    workloadNote: "openTasks = tasks assigned and not done; prefer people with fewer open tasks and skip/flag anyone onLeave when recommending assignments.",
    leavePending: snap.leave.filter((l) => l.status === "Pending").length,
    reports: snap.reports.length,
    ledger: snap.ledger,
    taskTotal: snap.tasks.length,
    checks: (snap.checks ?? []).slice(0, 8).map((c) => ({ module: c.moduleName, sev: c.severity, title: c.title, detail: c.detail })),
    knowledge: (snap.knowledge ?? []).slice(0, 25).map((k) => ({
      doc: k.name, folder: k.folder || "root", about: k.description,
      // keep excerpts bounded so a big library doesn't blow up cost
      content: k.readable && k.excerpt ? k.excerpt.slice(0, 1500) : undefined,
    })),
  };
  return JSON.stringify(sum);
}

/**
 * Live assistant answer. Calls Claude (cheap Haiku) through the secure proxy
 * with the live snapshot as context; falls back to the deterministic
 * `answerQuery` if the proxy isn't available. UI shape is identical.
 */
export async function answerQueryLive(query: string, snap: AiSnapshot, history?: { role: "user" | "assistant"; content: string }[]): Promise<AiAnswer> {
  const q = query.trim();
  if (!q) return answerQuery(q, snap);
  try {
    const { askClaude } = await import("./aiClient");
    const current = `LIVE SNAPSHOT (JSON):\n${compactSnapshot(snap)}\n\nQuestion: ${q}`;
    const messages = history && history.length
      ? [...history.slice(-8), { role: "user" as const, content: current }]
      : [{ role: "user" as const, content: current }];
    const text = await askClaude({
      system: ASSISTANT_SYSTEM + " You are in a continuing conversation — remember what was said and answer follow-ups naturally.",
      messages,
      model: "sonnet",
      maxTokens: 1800,
    });
    if (text) {
      // Keep the deterministic engine's deep-link sources for navigation.
      const base = answerQuery(q, snap);
      return { text, sources: base.sources.length ? base.sources : navSearch(q), agent: "Rulethu AI" };
    }
  } catch {
    /* fall through to demo */
  }
  return answerQuery(q, snap);
}

/* ------------------------------------------------------------------ */
/* Cross-module AI checks — scans every area and suggests actions      */
/* ------------------------------------------------------------------ */

export type Severity = "critical" | "warn" | "info";
export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };

export interface Finding {
  id: string;
  module: ModuleKey;
  moduleName: string;
  severity: Severity;
  title: string;
  detail: string;   // includes the suggested action
  href: string;
}

export interface CheckInput {
  entries: { lines: { debit: number; credit: number }[] }[];
  pos: { id: string; status: string; vendor: string; amount: number }[];
  requisitions: { id: string; status: string; item: string }[];
  requests: { id: string; status: string; title: string; toDept: string }[];
  tbills: { reference: string; maturityDate: string; client: string }[];
  loans: { borrower: string; status: string; principal: number }[];
  leave: { employee: string; status: string }[];
  employees: Employee[];
  deals: { name: string; stage: string }[];
  goals: { owner: string; title: string; targetDate: string; status: string }[];
}

const nameOf = (key: ModuleKey) => MODULES.find((m) => m.key === key)?.name ?? key;
const daysUntil = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** Scan every module for things that need attention, each with a suggestion. */
export function runChecks(inp: CheckInput): Finding[] {
  const f: Finding[] = [];
  const add = (module: ModuleKey, severity: Severity, title: string, detail: string, href: string) =>
    f.push({ id: `${module}-${f.length}`, module, moduleName: nameOf(module), severity, title, detail, href });

  // Finance — does the trial balance balance?
  let debit = 0, credit = 0;
  for (const e of inp.entries) for (const l of e.lines) { debit += l.debit || 0; credit += l.credit || 0; }
  const bal = ledgerCheck(debit, credit);
  if (!bal.balanced) add("finance", "critical", "Trial balance is out of balance", `${bal.hint} Open the General Ledger to correct it.`, "/finance/trial-balance");

  // Procurement — approvals & unpaid receipts
  const pendingPO = inp.pos.filter((p) => p.status === "Pending Approval");
  if (pendingPO.length) add("procurement", "warn", `${pendingPO.length} purchase order${pendingPO.length > 1 ? "s" : ""} awaiting approval`, `Totalling ${money(pendingPO.reduce((s, p) => s + p.amount, 0))}. Review and approve so ordering isn't held up.`, "/procurement");
  const unpaidPO = inp.pos.filter((p) => p.status === "Received");
  if (unpaidPO.length) add("procurement", "info", `${unpaidPO.length} received order${unpaidPO.length > 1 ? "s" : ""} not yet paid`, `Goods received but payment is outstanding — settle to post the expense to Finance.`, "/procurement/payments");
  const openReq = inp.requisitions.filter((r) => r.status === "Requested");
  if (openReq.length) add("procurement", "info", `${openReq.length} requisition${openReq.length > 1 ? "s" : ""} awaiting approval`, `Approve or decline so they can convert to purchase orders.`, "/procurement/requisitions");

  // Internal requests — waiting on a department
  const openRq = inp.requests.filter((r) => r.status === "Open" || r.status === "In progress");
  if (openRq.length) add("requests", "warn", `${openRq.length} internal request${openRq.length > 1 ? "s" : ""} waiting`, `Cross-department asks still open (e.g. ${openRq.slice(0, 2).map((r) => r.title).join("; ")}). Fulfil or decline them.`, "/requests");

  // Treasury — upcoming maturities
  const maturing = inp.tbills.map((t) => ({ t, d: daysUntil(t.maturityDate) })).filter((x) => x.d >= 0 && x.d <= 60).sort((a, b) => a.d - b.d);
  if (maturing.length) {
    const soon = maturing[0];
    add("treasury", soon.d <= 14 ? "warn" : "info", `${maturing.length} treasury bill${maturing.length > 1 ? "s" : ""} maturing within 60 days`, `Next: ${soon.t.reference} (${soon.t.client}) in ${soon.d} day${soon.d === 1 ? "" : "s"}. Plan the rollover or drawdown.`, "/treasury");
  }

  // Microfinance — portfolio at risk
  const par = inp.loans.filter((l) => l.status === "PAR>30");
  if (par.length) add("microfinance", "warn", `${par.length} loan${par.length > 1 ? "s" : ""} at risk (PAR>30)`, `${par.map((l) => l.borrower).join(", ")} — ${money(par.reduce((s, l) => s + l.principal, 0))} overdue. Start collections / provisioning.`, "/microfinance");

  // HR — pending leave & incomplete records
  const pendLeave = inp.leave.filter((l) => l.status === "Pending");
  if (pendLeave.length) add("hr", "info", `${pendLeave.length} leave request${pendLeave.length > 1 ? "s" : ""} pending`, `Awaiting a manager’s decision (${pendLeave.map((l) => l.employee).join(", ")}).`, "/hr/leave");
  const incomplete = inp.employees.filter((e) => employeeCompleteness(e) < 0.6);
  if (incomplete.length) add("hr", "info", `${incomplete.length} employee record${incomplete.length > 1 ? "s" : ""} incomplete`, `Missing KYC / next-of-kin / banking details. Ask staff to complete their profiles.`, "/hr");

  // Investments — deals at decision point
  const atIC = inp.deals.filter((d) => d.stage === "IC");
  if (atIC.length) add("investments", "info", `${atIC.length} deal${atIC.length > 1 ? "s" : ""} at Investment Committee`, `${atIC.map((d) => d.name).join(", ")} — ensure the memo, model and risk note are ready to table.`, "/investments");

  // Development goals — overdue
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueGoals = inp.goals.filter((g) => g.status === "In progress" && g.targetDate < todayIso);
  if (overdueGoals.length) add("hr", "info", `${overdueGoals.length} development goal${overdueGoals.length > 1 ? "s" : ""} overdue`, `Past their target date (e.g. ${overdueGoals.slice(0, 2).map((g) => `${g.owner}: ${g.title}`).join("; ")}). Check in or revise the date.`, "/hr/goals");

  return f.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/* ------------------------------------------------------------------ */
/* Exec digest — "what's been done", arranged into sections           */
/* ------------------------------------------------------------------ */

export interface DigestSection { title: string; items: string[] }

export interface DigestInput {
  entries: { lines: { debit: number; credit: number }[] }[];
  pos: { status: string; vendor: string; amount: number }[];
  requests: { status: string; title: string; fromDept: string; toDept: string }[];
  reports: { title: string; status: string }[];
  leave: { employee: string; type: string; status: string }[];
  deals: { name: string; stage: string; ticket: number }[];
  tasks: { title: string; status?: string }[];
  tbills: { reference: string; client: string; maturityDate: string; faceValue: number }[];
  loans: { principal: number; status: string }[];
  checks: Finding[];
}

/** Assemble an exec-ready "what's been done / where we stand" digest. */
export function buildDigest(inp: DigestInput): { heading: string; sections: DigestSection[] } {
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  // Finance
  let debit = 0, credit = 0;
  for (const e of inp.entries) for (const l of e.lines) { debit += l.debit || 0; credit += l.credit || 0; }
  const balanced = Math.abs(debit - credit) < 0.005;

  const done: string[] = [];
  const fulfilled = inp.requests.filter((r) => r.status === "Fulfilled").length;
  const paidPO = inp.pos.filter((p) => p.status === "Paid").length;
  const published = inp.reports.filter((r) => r.status === "Published").length;
  const approvedLeave = inp.leave.filter((l) => l.status === "Approved").length;
  const doneTasks = inp.tasks.filter((t) => (t.status ?? "").toLowerCase() === "done").length;
  if (inp.entries.length) done.push(`${inp.entries.length} journal entries posted — books ${balanced ? "balanced ✓" : "need review ⚠️"}`);
  if (paidPO) done.push(`${paidPO} purchase order${paidPO > 1 ? "s" : ""} paid and posted to Finance`);
  if (fulfilled) done.push(`${fulfilled} cross-department request${fulfilled > 1 ? "s" : ""} fulfilled`);
  if (published) done.push(`${published} research report${published > 1 ? "s" : ""} published to the group`);
  if (doneTasks) done.push(`${doneTasks} project task${doneTasks > 1 ? "s" : ""} completed`);
  if (approvedLeave) done.push(`${approvedLeave} leave request${approvedLeave > 1 ? "s" : ""} approved`);
  if (done.length === 0) done.push("Activity is quiet — nothing completed in this period yet.");

  // Investments
  const pipeline = inp.deals.reduce((s, d) => s + d.ticket, 0);
  const stageCounts = inp.deals.reduce<Record<string, number>>((m, d) => { m[d.stage] = (m[d.stage] || 0) + 1; return m; }, {});
  const invest: string[] = [
    `${inp.deals.length} live deals worth ${money(pipeline)} in proposed tickets`,
    ...Object.entries(stageCounts).map(([s, n]) => `${n} at ${s}`),
  ];

  // Finance & treasury
  const nextTB = [...inp.tbills].sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))[0];
  const book = inp.loans.reduce((s, l) => s + l.principal, 0);
  const finance: string[] = [
    `Trial balance ${balanced ? "in balance" : "OUT of balance — needs attention"}`,
    `Treasury: ${inp.tbills.length} bills, ${money(inp.tbills.reduce((s, t) => s + t.faceValue, 0))} face value${nextTB ? `; next maturity ${nextTB.reference} on ${nextTB.maturityDate}` : ""}`,
    `MFI loan book at ${money(book)}`,
  ];

  // Needs attention (from the cross-module checks)
  const attention = inp.checks.slice(0, 5).map((c) => `${c.title} — ${c.detail}`);

  const sections: DigestSection[] = [
    { title: "✅ Done recently", items: done },
    { title: "📈 Investments & pipeline", items: invest },
    { title: "💰 Finance & treasury", items: finance },
  ];
  if (attention.length) sections.push({ title: "⚠️ Needs attention", items: attention });

  return { heading: `Group activity digest — ${today}`, sections };
}

/* ------------------------------------------------------------------ */
/* Templates + Document Studio draft generator                        */
/* ------------------------------------------------------------------ */

export type Department =
  | "Investments" | "Research" | "Finance" | "Human Resources"
  | "Procurement" | "Microfinance" | "Treasury" | "Executive";

export const DEPARTMENTS: Department[] = [
  "Investments", "Research", "Finance", "Human Resources",
  "Procurement", "Microfinance", "Treasury", "Executive",
];

export interface Template {
  id: string;
  name: string;
  department: Department;
  description: string;
  sections: string[];          // the headings the draft is built around
  uploaded?: boolean;          // true if a user uploaded it
  attachmentName?: string;     // original file name if uploaded
  createdBy: string;
  createdAt: string;
}

export interface AiDraft {
  id: string;
  title: string;
  templateId: string;
  templateName: string;
  department: Department;
  brief: string;
  content: string;             // the generated markdown-ish document
  author: string;
  createdAt: string;
}

export const SEED_TEMPLATES: Template[] = [
  {
    id: "tpl-memo", name: "Investment Memo", department: "Investments",
    description: "Full IC memo — thesis, market, financials, valuation, risks and recommendation.",
    sections: ["Executive Summary", "Investment Thesis", "Market & Opportunity", "Financials & Valuation", "Key Risks & Mitigants", "Recommendation"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "tpl-dealnote", name: "Deal Note", department: "Investments",
    description: "Short origination note to table a new opportunity to the team.",
    sections: ["Opportunity", "Sponsor & Structure", "Indicative Returns", "Next Steps"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "tpl-daily", name: "Daily Market Note", department: "Research",
    description: "Daily market intelligence in the house style, ready to publish to the group.",
    sections: ["Market Snapshot", "Movers & Drivers", "What to Watch", "Rulethu View"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "tpl-sector", name: "Weekly Sector Report", department: "Research",
    description: "Weekly deep-dive on one sector — fundamentals, catalysts and positioning.",
    sections: ["Summary", "Sector Fundamentals", "Catalysts", "Risks", "Positioning"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "tpl-offer", name: "Offer Letter", department: "Human Resources",
    description: "Employment offer letter from the employee record and role.",
    sections: ["Offer", "Role & Reporting", "Remuneration", "Terms", "Acceptance"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "tpl-credit", name: "Credit Paper", department: "Microfinance",
    description: "Loan credit assessment for the committee — borrower, affordability, security, recommendation.",
    sections: ["Facility Requested", "Borrower Profile", "Affordability & Repayment", "Security", "Credit Risks", "Recommendation"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "tpl-po", name: "Procurement Justification", department: "Procurement",
    description: "Business case to support a requisition / purchase order approval.",
    sections: ["Requirement", "Options Considered", "Recommended Supplier", "Cost & Budget", "Approval"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "tpl-board", name: "Board Pack Summary", department: "Executive",
    description: "One-page executive summary pulling the month’s highlights across the group.",
    sections: ["Highlights", "Investments & Pipeline", "Finance & Treasury", "People & Operations", "Decisions Required"],
    createdBy: "System", createdAt: "2026-09-01T00:00:00Z",
  },
];

/** Produce a demo draft. Deterministic, uses the brief + a little live data. */
export function draftFromTemplate(tpl: Template, brief: string, snap: AiSnapshot): string {
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const b = brief.trim() || "(no brief provided — using house defaults)";
  const topDeal = [...snap.deals].sort((a, b2) => b2.ticket - a.ticket)[0];
  const book = snap.loans.reduce((s, l) => s + l.principal, 0);
  const tbFace = snap.tbills.reduce((s, t) => s + t.faceValue, 0);

  const lines: string[] = [];
  lines.push(`# ${tpl.name}`);
  lines.push(`**Rulethu Holdings** · ${tpl.department} · ${today}`);
  lines.push(`**Brief:** ${b}`);
  lines.push("");

  for (const section of tpl.sections) {
    lines.push(`## ${section}`);
    lines.push(sectionBody(section, tpl, b, { today, topDeal, book, tbFace, snap }));
    lines.push("");
  }

  lines.push("---");
  lines.push(`_Drafted by Rulethu AI — ${AI_DEMO_NOTE}_`);
  return lines.join("\n");
}

/**
 * Live draft. Calls Claude (Sonnet — better prose for documents) through the
 * secure proxy, instructed to follow the template's sections and use the live
 * data. Falls back to the deterministic `draftFromTemplate` if unavailable.
 */
export async function draftFromTemplateLive(tpl: Template, brief: string, snap: AiSnapshot): Promise<string> {
  try {
    const { askClaude } = await import("./aiClient");
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const ctx = {
      deals: snap.deals.slice(0, 6),
      loanBook: snap.loans.reduce((s, l) => s + l.principal, 0),
      tbillFace: snap.tbills.reduce((s, t) => s + t.faceValue, 0),
      headcount: snap.employees.length,
    };
    const system =
      "You are Rulethu AI, drafting a complete, polished business document for " +
      "Rulethu Holdings — an African investment group in Harare, Zimbabwe. Write " +
      "in an institutional house style suitable for an investment committee or " +
      "board: confident, precise, well-structured prose with real substance in " +
      "every section (not one-liners). Output clean Markdown; follow EXACTLY the " +
      "section headings given as `## Heading`, and write 1-3 substantive " +
      "paragraphs (and bullet lists where appropriate) under each.\n" +
      "CRITICAL RULES:\n" +
      "• NEVER output placeholders, blanks or dummy values — no \"[insert X]\", " +
      "no \"TBD\", no \"XXX\", no \"Lorem ipsum\", no square-bracket fill-ins.\n" +
      "• Use the author's brief and the live data provided as the ground truth, " +
      "and be specific to it. Where a figure is given, use it exactly.\n" +
      "• Where a specific number is genuinely not provided, write a concrete, " +
      "sensible professional statement or a clearly-labelled assumption (e.g. " +
      "\"assuming a 20-year PPA at $0.08/kWh\") rather than a blank or bracket.\n" +
      "• Be thorough — this is a finished document the user can send, not an outline.";
    const prompt =
      `Document type: ${tpl.name} (${tpl.department})\n` +
      `Date: ${today}\n` +
      `Brief from the author: ${brief.trim() || "(none provided — use sensible, specific house defaults for this document type)"}\n\n` +
      `Required sections (use these exact headings, in order):\n${tpl.sections.map((s) => `- ${s}`).join("\n")}\n\n` +
      `Live platform data you may reference:\n${JSON.stringify(ctx)}\n\n` +
      `Write the COMPLETE, furnished document now, starting with a level-1 title line "# ${tpl.name}". No placeholders.`;
    const text = await askClaude({ system, prompt, model: "sonnet", maxTokens: 4096 });
    if (text) return text;
  } catch {
    /* fall through to demo */
  }
  return draftFromTemplate(tpl, brief, snap);
}

function sectionBody(
  section: string,
  tpl: Template,
  brief: string,
  ctx: { today: string; topDeal?: { name: string; sector: string; ticket: number; stage: string }; book: number; tbFace: number; snap: AiSnapshot },
): string {
  const s = section.toLowerCase();
  const deal = ctx.topDeal;

  if (s.includes("summary") || s.includes("highlight") || s.includes("offer") || s.includes("opportunity") || s.includes("requirement") || s.includes("facility") || s.includes("snapshot")) {
    return `${brief} This ${tpl.name.toLowerCase()} sets out the position for review. ${
      deal ? `In context, the group’s lead pipeline opportunity is ${deal.name} (${deal.sector}, ${money(deal.ticket)}), currently at the ${deal.stage} stage.` : ""
    } The recommendation and supporting detail follow.`;
  }
  if (s.includes("thesis") || s.includes("fundamental") || s.includes("profile") || s.includes("role")) {
    return `The core rationale rests on three pillars: (1) a clear, defensible driver aligned to the brief above; (2) a structure that protects Rulethu’s downside while preserving upside; and (3) a credible path to realisation within the group’s mandate. Supporting evidence is drawn from the live platform data and the attached working.`;
  }
  if (s.includes("market") || s.includes("opportunity") || s.includes("catalyst")) {
    return `The addressable opportunity is sized against current conditions. Near-term catalysts are identified and quantified where possible, with a clear statement of the assumptions behind each. Competitive dynamics and the regulatory backdrop are summarised for the committee.`;
  }
  if (s.includes("financ") || s.includes("valuation") || s.includes("return") || s.includes("affordab") || s.includes("cost") || s.includes("remuneration") || s.includes("budget")) {
    return `Indicative figures are presented with the base-case assumptions stated explicitly. Returns are shown on an IRR, MOIC and payback basis, with a sensitivity view on the two variables that move the outcome most. ${
      ctx.tbFace ? `For reference, treasury holdings total ${money(ctx.tbFace)} face value and the MFI book stands at ${money(ctx.book)}.` : ""
    } Full workings sit in the linked model.`;
  }
  if (s.includes("risk")) {
    return `Key risks are tabulated with an owner and a mitigant for each: execution, counterparty, market/price, liquidity, and regulatory. Residual risk after mitigation is assessed as acceptable within the group’s risk appetite, subject to the conditions noted in the recommendation.`;
  }
  if (s.includes("security")) {
    return `Proposed security and covenants are listed, with coverage ratios and the enforcement path. Any gaps are flagged for the committee’s attention.`;
  }
  if (s.includes("recommend") || s.includes("decision") || s.includes("approval") || s.includes("acceptance") || s.includes("next step") || s.includes("view")) {
    return `**Recommendation:** proceed to the next stage, subject to the conditions above. Required decision: approval to [proceed / disburse / sign], with the authority and timeline as set out. Prepared for sign-off on ${ctx.today}.`;
  }
  if (s.includes("supplier") || s.includes("option") || s.includes("structure") || s.includes("sponsor") || s.includes("positioning") || s.includes("mover") || s.includes("watch") || s.includes("term")) {
    return `Options were assessed against cost, quality, delivery and risk. The recommended route is set out with the rationale, alongside the alternatives considered and why they were not selected.`;
  }
  return `${brief} Detail for “${section}” is drafted here from the template structure and the platform’s live data.`;
}
