// Cash Flow Statement — built directly from the General Ledger by classifying
// each cash movement as operating, investing or financing (direct method).

import { JournalEntry, CHART_OF_ACCOUNTS } from "./coa";

const CASH_CODES = new Set(["1000"]); // bank / cash accounts
const typeOf = (code: string) => CHART_OF_ACCOUNTS.find((a) => a.code === code)?.type;

export type CFCategory = "Operating" | "Investing" | "Financing";
export interface CFLine { memo: string; source: string; date: string; amount: number }
export interface CashFlowStatement {
  operating: CFLine[];
  investing: CFLine[];
  financing: CFLine[];
  totalOperating: number;
  totalInvesting: number;
  totalFinancing: number;
  openingCash: number;
  netChange: number;
  closingCash: number;
}

function classify(entry: JournalEntry): CFCategory {
  // Look at the non-cash legs; the largest one decides the category.
  const nonCash = entry.lines
    .filter((l) => !CASH_CODES.has(l.accountCode))
    .map((l) => ({ code: l.accountCode, amt: Math.abs((l.debit || 0) - (l.credit || 0)) }))
    .sort((a, b) => b.amt - a.amt);
  for (const leg of nonCash) {
    const t = typeOf(leg.code);
    if (leg.code === "2100") return "Financing";          // borrowings
    if (t === "Equity") return "Financing";               // capital / dividends
    if (leg.code === "1100" || leg.code === "1200" || leg.code.startsWith("15")) return "Investing"; // loans, investments, fixed assets
    if (t === "Income" || t === "Expense" || t === "Liability" || t === "Asset") return "Operating";
  }
  return "Operating";
}

export function buildCashFlow(entries: JournalEntry[]): CashFlowStatement {
  const operating: CFLine[] = [];
  const investing: CFLine[] = [];
  const financing: CFLine[] = [];
  let openingCash = 0;

  for (const e of entries) {
    const cashDelta = e.lines.reduce((s, l) => s + (CASH_CODES.has(l.accountCode) ? (l.debit || 0) - (l.credit || 0) : 0), 0);
    if (Math.abs(cashDelta) < 0.005) continue;
    if (e.source === "Opening" || e.id === "JE-OPEN") { openingCash += cashDelta; continue; }
    const line: CFLine = { memo: e.memo, source: e.source, date: e.date, amount: cashDelta };
    const cat = classify(e);
    (cat === "Operating" ? operating : cat === "Investing" ? investing : financing).push(line);
  }

  const sum = (a: CFLine[]) => a.reduce((s, l) => s + l.amount, 0);
  const totalOperating = sum(operating);
  const totalInvesting = sum(investing);
  const totalFinancing = sum(financing);
  const netChange = totalOperating + totalInvesting + totalFinancing;

  return {
    operating, investing, financing,
    totalOperating, totalInvesting, totalFinancing,
    openingCash, netChange, closingCash: openingCash + netChange,
  };
}
