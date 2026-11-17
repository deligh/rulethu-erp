// Amortization engine for the internal MFI — supports the three schedule types
// microfinance books most commonly need.

export type AmortMethod = "reducing" | "flat" | "interest_only";

export interface LoanTerms {
  principal: number;
  annualRatePct: number; // nominal annual interest rate, e.g. 24 for 24%
  termMonths: number;
  method: AmortMethod;
  startDate: string; // ISO date
}

export interface AmortRow {
  period: number;
  date: string;
  openingBalance: number;
  payment: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

export interface AmortSchedule {
  rows: AmortRow[];
  totalInterest: number;
  totalPayment: number;
  monthlyPayment: number; // representative instalment (level payment for reducing/flat)
  effectiveAnnualCostPct: number; // total interest / principal, annualised over the term
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // guard against month overflow (e.g. Jan 31 -> Mar 3)
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function buildSchedule(t: LoanTerms): AmortSchedule {
  const n = Math.max(1, Math.round(t.termMonths));
  const i = t.annualRatePct / 100 / 12; // monthly rate
  const rows: AmortRow[] = [];

  let payment = 0;
  if (t.method === "reducing") {
    // Standard EMI on a reducing balance.
    payment = i > 0 ? (t.principal * i) / (1 - Math.pow(1 + i, -n)) : t.principal / n;
  } else if (t.method === "flat") {
    // Interest charged on the original principal, spread evenly.
    const totalInterest = t.principal * i * n;
    payment = (t.principal + totalInterest) / n;
  } // interest_only handled per-row below

  let balance = t.principal;
  for (let p = 1; p <= n; p++) {
    const opening = balance;
    let interest = 0;
    let principalPaid = 0;
    let pay = payment;

    if (t.method === "reducing") {
      interest = opening * i;
      principalPaid = payment - interest;
    } else if (t.method === "flat") {
      interest = t.principal * i;
      principalPaid = payment - interest;
    } else {
      // interest only, principal repaid as a bullet at maturity
      interest = opening * i;
      principalPaid = p === n ? opening : 0;
      pay = interest + principalPaid;
    }

    let closing = opening - principalPaid;
    if (p === n) {
      // sweep any rounding drift into the final instalment
      principalPaid += closing;
      pay += closing;
      closing = 0;
    }

    rows.push({
      period: p,
      date: addMonths(t.startDate, p),
      openingBalance: round2(opening),
      payment: round2(pay),
      interest: round2(interest),
      principal: round2(principalPaid),
      closingBalance: round2(Math.max(0, closing)),
    });
    balance = closing;
  }

  const totalInterest = round2(rows.reduce((s, r) => s + r.interest, 0));
  const totalPayment = round2(rows.reduce((s, r) => s + r.payment, 0));
  const years = n / 12;
  const effectiveAnnualCostPct =
    t.principal > 0 && years > 0 ? (totalInterest / t.principal / years) * 100 : 0;

  return {
    rows,
    totalInterest,
    totalPayment,
    monthlyPayment: round2(payment || (rows[0]?.payment ?? 0)),
    effectiveAnnualCostPct: round2(effectiveAnnualCostPct),
  };
}

export function scheduleToCsv(t: LoanTerms, s: AmortSchedule): string {
  const header = "Period,Date,Opening Balance,Payment,Interest,Principal,Closing Balance";
  const lines = s.rows.map(
    (r) =>
      `${r.period},${r.date},${r.openingBalance},${r.payment},${r.interest},${r.principal},${r.closingBalance}`,
  );
  const footer = `,,Totals,${s.totalPayment},${s.totalInterest},${t.principal},0`;
  return [header, ...lines, footer].join("\n");
}
