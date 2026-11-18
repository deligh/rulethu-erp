// Period engine — rolls the General Ledger (daily postings) into weekly,
// monthly, quarterly and annual financial statements, cumulatively and
// automatically. The GL is the single source of truth; nothing is keyed in
// twice, so the statements cannot drift from the books.

import { JournalEntry } from "./coa";
import { trialBalanceFromEntries } from "./coa";
import { buildStatements, TBAccount } from "./accounting";

export type PeriodType = "weekly" | "monthly" | "quarterly" | "annual";

export interface PeriodDef {
  type: PeriodType;
  label: string;     // e.g. "October 2026", "Week of 06 Oct 2026", "Q3 2026", "FY 2026"
  start: string;     // yyyy-mm-dd inclusive
  end: string;       // yyyy-mm-dd inclusive
  priorLabel?: string;
  priorStart?: string;
  priorEnd?: string;
}

export interface StmtLine { code: string; name: string; amount: number }

export interface PeriodReport {
  def: PeriodDef;
  // Income statement (flow over the period)
  revenue: number; expenses: number; netProfit: number;
  incomeLines: StmtLine[]; expenseLines: StmtLine[];
  // Balance sheet (position as at period end, cumulative)
  totalAssets: number; totalLiabilities: number; totalEquity: number;
  assetLines: StmtLine[]; liabilityLines: StmtLine[]; equityLines: StmtLine[];
  retainedEarnings: number; openingEquity: number;
  // Cash
  cashClose: number; cashOpen: number; cashMovement: number;
  // Comparatives (prior equivalent period)
  prior?: { revenue: number; expenses: number; netProfit: number };
  // Integrity
  flowTrialBalance: TBAccount[];   // movements within the period (feeds the P&L)
  cumTrialBalance: TBAccount[];    // balances as at period end (feeds the Balance Sheet)
  plBalanced: boolean; bsBalanced: boolean; bsDifference: number;
  entryCount: number;
}

export interface Ratio { label: string; value: string; basis: string; explain: string }

/** Key ratios with the actual numbers behind each, so the figures explain themselves. */
export function keyRatios(r: PeriodReport): Ratio[] {
  const m = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const safe = (a: number, b: number) => (b ? a / b : 0);
  return [
    { label: "Net profit margin", value: pct(safe(r.netProfit, r.revenue)), basis: `${m(r.netProfit)} ÷ ${m(r.revenue)}`, explain: "Share of every revenue dollar kept as profit after all expenses." },
    { label: "Expense ratio", value: pct(safe(r.expenses, r.revenue)), basis: `${m(r.expenses)} ÷ ${m(r.revenue)}`, explain: "Portion of revenue consumed by operating and finance costs." },
    { label: "Return on equity (ROE)", value: pct(safe(r.netProfit, r.totalEquity)), basis: `${m(r.netProfit)} ÷ ${m(r.totalEquity)}`, explain: "Profit generated on shareholders' funds for the period." },
    { label: "Return on assets (ROA)", value: pct(safe(r.netProfit, r.totalAssets)), basis: `${m(r.netProfit)} ÷ ${m(r.totalAssets)}`, explain: "Profit generated per dollar of total assets." },
    { label: "Equity ratio (solvency)", value: pct(safe(r.totalEquity, r.totalAssets)), basis: `${m(r.totalEquity)} ÷ ${m(r.totalAssets)}`, explain: "How much of the balance sheet is funded by equity rather than debt." },
    { label: "Debt-to-equity", value: `${safe(r.totalLiabilities, r.totalEquity).toFixed(2)}x`, basis: `${m(r.totalLiabilities)} ÷ ${m(r.totalEquity)}`, explain: "Liabilities carried for each dollar of equity." },
    { label: "Cash to liabilities", value: `${safe(r.cashClose, r.totalLiabilities).toFixed(2)}x`, basis: `${m(r.cashClose)} ÷ ${m(r.totalLiabilities)}`, explain: "Immediate cash cover against what the business owes." },
  ];
}

/* ---------------- date helpers (UTC, string-safe) ---------------- */
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtDay = (s: string) => { const d = parse(s); return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`; };

function dateRange(entries: JournalEntry[]): { min: string; max: string } {
  let min = "9999-12-31", max = "0000-01-01";
  for (const e of entries) { if (e.date < min) min = e.date; if (e.date > max) max = e.date; }
  if (min > max) { min = max = iso(new Date()); }
  return { min, max };
}

// Monday of the ISO week containing s.
function weekStart(s: string): string {
  const d = parse(s);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(s, -dow);
}

/** Enumerate the available periods of a type, newest first, from the ledger's date span. */
export function listPeriods(entries: JournalEntry[], type: PeriodType): PeriodDef[] {
  const { min, max } = dateRange(entries);
  const defs: PeriodDef[] = [];

  if (type === "monthly") {
    const d = parse(`${min.slice(0, 7)}-01`);
    const end = parse(`${max.slice(0, 7)}-01`);
    while (d <= end) {
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      const start = `${y}-${pad(m + 1)}-01`;
      const last = new Date(Date.UTC(y, m + 1, 0));
      const pm = new Date(Date.UTC(y, m - 1, 1));
      defs.push({
        type, label: `${MONTHS[m]} ${y}`, start, end: iso(last),
        priorLabel: `${MONTHS[pm.getUTCMonth()]} ${pm.getUTCFullYear()}`,
        priorStart: `${pm.getUTCFullYear()}-${pad(pm.getUTCMonth() + 1)}-01`,
        priorEnd: iso(new Date(Date.UTC(pm.getUTCFullYear(), pm.getUTCMonth() + 1, 0))),
      });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  } else if (type === "weekly") {
    let ws = weekStart(min);
    const lastWs = weekStart(max);
    while (ws <= lastWs) {
      const end = addDays(ws, 6);
      const pr = addDays(ws, -7);
      defs.push({ type, label: `Week of ${fmtDay(ws)}`, start: ws, end, priorLabel: `Week of ${fmtDay(pr)}`, priorStart: pr, priorEnd: addDays(pr, 6) });
      ws = addDays(ws, 7);
    }
  } else if (type === "quarterly") {
    const startY = Number(min.slice(0, 4)), endY = Number(max.slice(0, 4));
    for (let y = startY; y <= endY; y++) {
      for (let q = 0; q < 4; q++) {
        const sM = q * 3;
        const start = `${y}-${pad(sM + 1)}-01`;
        const end = iso(new Date(Date.UTC(y, sM + 3, 0)));
        if (end < min || start > max) continue;
        const pq = q === 0 ? { y: y - 1, q: 3 } : { y, q: q - 1 };
        defs.push({
          type, label: `Q${q + 1} ${y}`, start, end,
          priorLabel: `Q${pq.q + 1} ${pq.y}`, priorStart: `${pq.y}-${pad(pq.q * 3 + 1)}-01`,
          priorEnd: iso(new Date(Date.UTC(pq.y, pq.q * 3 + 3, 0))),
        });
      }
    }
  } else { // annual
    const startY = Number(min.slice(0, 4)), endY = Number(max.slice(0, 4));
    for (let y = startY; y <= endY; y++) {
      defs.push({ type, label: `FY ${y}`, start: `${y}-01-01`, end: `${y}-12-31`, priorLabel: `FY ${y - 1}`, priorStart: `${y - 1}-01-01`, priorEnd: `${y - 1}-12-31` });
    }
  }
  return defs.reverse(); // newest first
}

/** Compute the full period report from the ledger. */
export function periodStatements(entries: JournalEntry[], def: PeriodDef): PeriodReport {
  const flow = entries.filter((e) => e.date >= def.start && e.date <= def.end);
  const cumulative = entries.filter((e) => e.date <= def.end);
  const cumOpen = entries.filter((e) => e.date < def.start);

  const flowTB = trialBalanceFromEntries(flow);
  const cumTB = trialBalanceFromEntries(cumulative);
  const pl = buildStatements(flowTB);
  const bs = buildStatements(cumTB);

  const withCode = (lines: { name: string; amount: number }[], t: TBAccount["type"]) =>
    lines.map((l) => ({ ...l, code: cumTB.find((a) => a.name === l.name && a.type === t)?.code ?? flowTB.find((a) => a.name === l.name)?.code ?? "" }));
  const withCodeFlow = (lines: { name: string; amount: number }[], t: TBAccount["type"]) =>
    lines.map((l) => ({ ...l, code: flowTB.find((a) => a.name === l.name && a.type === t)?.code ?? "" }));

  // cash = Bank operating (1000) balance
  const bankBal = (tb: TBAccount[]) => { const a = tb.find((x) => x.code === "1000"); return a ? a.debit - a.credit : 0; };
  const cashClose = bankBal(cumTB);
  const cashOpen = bankBal(trialBalanceFromEntries(cumOpen));

  let prior: PeriodReport["prior"];
  if (def.priorStart && def.priorEnd) {
    const pf = entries.filter((e) => e.date >= def.priorStart! && e.date <= def.priorEnd!);
    const ps = buildStatements(trialBalanceFromEntries(pf));
    prior = { revenue: ps.revenue, expenses: ps.expenses, netProfit: ps.netProfit };
  }

  return {
    def,
    revenue: pl.revenue, expenses: pl.expenses, netProfit: pl.netProfit,
    incomeLines: withCodeFlow(pl.incomeLines, "Income"), expenseLines: withCodeFlow(pl.expenseLines, "Expense"),
    totalAssets: bs.totalAssets, totalLiabilities: bs.totalLiabilities, totalEquity: bs.equityWithProfit,
    assetLines: withCode(bs.assetLines, "Asset"), liabilityLines: withCode(bs.liabilityLines, "Liability"), equityLines: withCode(bs.equityLines, "Equity"),
    retainedEarnings: bs.netProfit, openingEquity: bs.openingEquity,
    cashClose, cashOpen, cashMovement: cashClose - cashOpen,
    prior,
    flowTrialBalance: flowTB,
    cumTrialBalance: cumTB,
    plBalanced: pl.balanced, bsBalanced: bs.bsBalanced, bsDifference: bs.bsDifference,
    entryCount: flow.length,
  };
}
