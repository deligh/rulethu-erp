// Daily capture — lets a non-accountant record money in / money out in plain
// language. Each capture type maps to the correct double-entry behind the
// scenes, so the General Ledger (and therefore every statement) stays correct
// without anyone having to think in debits and credits.

import { JournalLine } from "./coa";

export type CaptureDir = "in" | "out" | "other";

export interface CaptureType {
  key: string;
  label: string;
  dir: CaptureDir;
  drCode: string;   // account debited
  crCode: string;   // account credited
  hint: string;
}

// Bank — Operating USD is 1000; it is debited when money comes in, credited when it goes out.
export const CAPTURE_TYPES: CaptureType[] = [
  // Money in
  { key: "interest", label: "Interest received", dir: "in", drCode: "1000", crCode: "4000", hint: "Interest earned on treasury bills, deposits or loans." },
  { key: "investment", label: "Investment income / gains", dir: "in", drCode: "1000", crCode: "4100", hint: "Dividends, realised gains or distributions received." },
  { key: "loanrepay", label: "Loan repayment received", dir: "in", drCode: "1000", crCode: "1100", hint: "A borrower repays MFI loan principal." },
  { key: "capital", label: "Capital injected", dir: "in", drCode: "1000", crCode: "3000", hint: "Shareholders put money into the business." },
  { key: "other-in", label: "Other income received", dir: "in", drCode: "1000", crCode: "4000", hint: "Any other cash received as income." },
  // Money out
  { key: "opex", label: "Operating expense paid", dir: "out", drCode: "5000", crCode: "1000", hint: "Rent, utilities, software, office costs, etc." },
  { key: "salary", label: "Salary / payroll paid", dir: "out", drCode: "5100", crCode: "1000", hint: "Staff salaries and wages." },
  { key: "finance", label: "Interest / finance cost paid", dir: "out", drCode: "5200", crCode: "1000", hint: "Interest paid on borrowings." },
  { key: "travel", label: "Travel & fuel paid", dir: "out", drCode: "5300", crCode: "1000", hint: "Travel, fuel and related claims." },
  { key: "supplier", label: "Supplier / bill paid", dir: "out", drCode: "2000", crCode: "1000", hint: "Settle an amount owed to a supplier (trade payable)." },
  { key: "loandisb", label: "Loan disbursed", dir: "out", drCode: "1100", crCode: "1000", hint: "Money lent out to an MFI borrower." },
  // Other (no cash movement today)
  { key: "bill", label: "Record a supplier bill (unpaid)", dir: "other", drCode: "5000", crCode: "2000", hint: "A cost incurred now, to be paid later (creates a payable)." },
  { key: "accrue-int", label: "Accrue interest income (not yet received)", dir: "other", drCode: "1100", crCode: "4000", hint: "Interest earned but not yet collected." },
];

export function captureLines(t: CaptureType, amount: number): JournalLine[] {
  return [
    { accountCode: t.drCode, debit: amount, credit: 0 },
    { accountCode: t.crCode, debit: 0, credit: amount },
  ];
}

export const CAPTURE_SOURCE = "Daily capture";
