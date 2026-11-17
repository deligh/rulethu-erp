// Chart of accounts + double-entry ledger types. The General Ledger is the
// source of truth; the Trial Balance is aggregated from it automatically.

import { AccountType, TBAccount, SAMPLE_TB } from "./accounting";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
}

export const CHART_OF_ACCOUNTS: Account[] = [
  ...SAMPLE_TB.map((a) => ({ code: a.code, name: a.name, type: a.type })),
  { code: "2200", name: "Staff claims payable", type: "Liability" },
  { code: "5300", name: "Travel & fuel expense", type: "Expense" },
];

export function accountName(code: string): string {
  return CHART_OF_ACCOUNTS.find((a) => a.code === code)?.name ?? code;
}

export interface JournalLine {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  memo: string;
  source: string; // e.g. "Opening", "Manual", "Travel claim TC-…"
  lines: JournalLine[];
}

// Opening balances, expressed as the first journal entry so the ledger is the
// single source the trial balance sums from.
export const OPENING_ENTRY: JournalEntry = {
  id: "JE-OPEN",
  date: "2026-08-01",
  memo: "Opening balances",
  source: "Opening",
  lines: SAMPLE_TB.map((a) => ({ accountCode: a.code, debit: a.debit, credit: a.credit })),
};

export function entryTotals(e: JournalEntry): { debit: number; credit: number; balanced: boolean } {
  const debit = e.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const credit = e.lines.reduce((s, l) => s + (l.credit || 0), 0);
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 };
}

// Aggregate all journal lines into a trial balance (one net debit/credit per account).
export function trialBalanceFromEntries(entries: JournalEntry[]): TBAccount[] {
  return CHART_OF_ACCOUNTS.map((acc) => {
    let debit = 0;
    let credit = 0;
    for (const e of entries) {
      for (const l of e.lines) {
        if (l.accountCode === acc.code) {
          debit += l.debit || 0;
          credit += l.credit || 0;
        }
      }
    }
    const net = debit - credit;
    return {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
    };
  }).filter((a) => a.debit !== 0 || a.credit !== 0);
}
