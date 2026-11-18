// Deterministic sample daily postings so the Financial Statements engine has
// real day-by-day movement to roll up into weekly / monthly / annual statements.
// No randomness or Date.now() — identical on server and client (no hydration drift).
// Every entry is balanced (debits = credits) and sourced "Auto" so it can be
// detected / regenerated idempotently.

import { JournalEntry } from "./coa";

interface MonthPlan {
  y: number; m: string; maxDay: number;
  interest: number;   // interest income accrued (5th)
  gain: number;       // investment valuation gain (+) or loss (-) (12th)
  opex: number[];     // operating expenses on the 3rd, 10th, 17th, 24th
  staff: number;      // payroll (25th)
  finance: number;    // finance cost (28th)
  payable: number;    // trade-payable settlement (18th)
  loanInt: number;    // MFI interest received (8th)
}

// Aug–Nov 2026. November is truncated at the 18th (today).
const PLAN: MonthPlan[] = [
  { y: 2026, m: "08", maxDay: 31, interest: 180_000, gain: 120_000, opex: [22_000, 24_000, 26_000, 23_000], staff: 140_000, finance: 42_000, payable: 30_000, loanInt: 9_000 },
  { y: 2026, m: "09", maxDay: 30, interest: 190_000, gain: -40_000, opex: [23_000, 25_000, 24_000, 27_000], staff: 142_000, finance: 42_000, payable: 25_000, loanInt: 9_500 },
  { y: 2026, m: "10", maxDay: 31, interest: 200_000, gain: 160_000, opex: [24_000, 26_000, 25_000, 28_000], staff: 145_000, finance: 43_000, payable: 28_000, loanInt: 10_000 },
  { y: 2026, m: "11", maxDay: 18, interest: 210_000, gain: 90_000, opex: [25_000, 27_000, 26_000, 0], staff: 0, finance: 0, payable: 0, loanInt: 10_500 },
];

const d2 = (n: number) => String(n).padStart(2, "0");

export function buildSampleJournals(): JournalEntry[] {
  const out: JournalEntry[] = [];
  const push = (y: number, m: string, day: number, memo: string, source: string, lines: { accountCode: string; debit: number; credit: number }[]) => {
    out.push({ id: `JE-A-${m}${d2(day)}-${out.length}`, date: `${y}-${m}-${d2(day)}`, memo, source: `Auto · ${source}`, lines });
  };

  for (const p of PLAN) {
    const on = (day: number) => day <= p.maxDay;
    // Interest income accrued to bank (5th)
    if (on(5) && p.interest) push(p.y, p.m, 5, "Interest income accrued", "Interest", [{ accountCode: "1000", debit: p.interest, credit: 0 }, { accountCode: "4000", debit: 0, credit: p.interest }]);
    // MFI loan interest received (8th)
    if (on(8) && p.loanInt) push(p.y, p.m, 8, "MFI loan interest received", "Lending", [{ accountCode: "1000", debit: p.loanInt, credit: 0 }, { accountCode: "4000", debit: 0, credit: p.loanInt }]);
    // Investment valuation gain/loss (12th)
    if (on(12) && p.gain) {
      if (p.gain >= 0) push(p.y, p.m, 12, "Investment valuation gain", "Valuation", [{ accountCode: "1200", debit: p.gain, credit: 0 }, { accountCode: "4100", debit: 0, credit: p.gain }]);
      else push(p.y, p.m, 12, "Investment valuation loss", "Valuation", [{ accountCode: "4100", debit: -p.gain, credit: 0 }, { accountCode: "1200", debit: 0, credit: -p.gain }]);
    }
    // Operating expenses (3rd, 10th, 17th, 24th)
    const opexDays = [3, 10, 17, 24];
    opexDays.forEach((day, i) => {
      const amt = p.opex[i];
      if (on(day) && amt) push(p.y, p.m, day, "Operating expenses", "Opex", [{ accountCode: "5000", debit: amt, credit: 0 }, { accountCode: "1000", debit: 0, credit: amt }]);
    });
    // Trade-payable settlement (18th)
    if (on(18) && p.payable) push(p.y, p.m, 18, "Trade payables settled", "Payables", [{ accountCode: "2000", debit: p.payable, credit: 0 }, { accountCode: "1000", debit: 0, credit: p.payable }]);
    // Payroll / staff costs (25th)
    if (on(25) && p.staff) push(p.y, p.m, 25, "Monthly payroll", "Payroll", [{ accountCode: "5100", debit: p.staff, credit: 0 }, { accountCode: "1000", debit: 0, credit: p.staff }]);
    // Finance cost on borrowings (28th)
    if (on(28) && p.finance) push(p.y, p.m, 28, "Finance cost on borrowings", "Finance", [{ accountCode: "5200", debit: p.finance, credit: 0 }, { accountCode: "1000", debit: 0, credit: p.finance }]);
  }
  return out;
}

export const SAMPLE_JOURNALS: JournalEntry[] = buildSampleJournals();
