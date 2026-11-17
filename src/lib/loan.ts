// Loan amortisation engine — mirrors the Rulethu MFI calculator:
// reducing balance, flat, interest-only, custom-initial, graduated and balloon,
// with payment frequency, grace period and extra (pre)payments.

export type LoanType = "standard" | "flat" | "interest_only" | "custom_initial" | "graduated" | "balloon";

export interface LoanInputs {
  principal: number;
  annualRatePct: number;
  termMonths: number;
  payFreq: number; // payments per year: 12, 4, 2, 1
  startDate: string;
  extraPayment: number;
  type: LoanType;
  initPeriodMonths: number; // grace / graduated / interest-only / custom window
  balloonPct: number; // % of principal as balloon at maturity
  gradStepPct: number; // graduated step
  customInitialPayment: number; // level payment during the custom window
  currency: string;
}

export interface LoanRow {
  n: number; date: string; opening: number; scheduled: number; extra: number;
  totalPay: number; principal: number; interest: number; closing: number; cumInterest: number;
  kind: "normal" | "init" | "balloon";
}

export interface LoanResult {
  rows: LoanRow[];
  totalPaid: number; totalInterest: number; avgPayment: number;
  payoffDate: string; interestRatioPct: number; representativePayment: number;
  periodsPerYear: number;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export function buildLoanSchedule(inp: LoanInputs): LoanResult {
  const fq = inp.payFreq;
  const monthsPer = 12 / fq;
  const r = inp.annualRatePct / 100 / fq;
  const N = Math.max(1, Math.round(inp.termMonths / monthsPer));
  const ex = Math.max(0, inp.extraPayment);
  const rows: LoanRow[] = [];
  let bal = inp.principal;
  let ci = 0;

  const dateFor = (i: number) => addMonths(inp.startDate, Math.round(i * monthsPer));
  const push = (i: number, scheduled: number, extra: number, interest: number, principalPaid: number, kind: LoanRow["kind"]) => {
    const opening = bal;
    const total = scheduled + extra;
    const actPP = principalPaid + extra;
    bal = Math.max(0, bal - actPP);
    ci += interest;
    rows.push({ n: i, date: dateFor(i), opening, scheduled, extra, totalPay: total, principal: actPP, interest, closing: bal, cumInterest: ci, kind });
  };

  const stdBlock = (start: number, end: number, balance: number, kind: LoanRow["kind"] = "normal") => {
    const rem = end - start + 1;
    const pmt = r > 0 ? (balance * r) / (1 - Math.pow(1 + r, -rem)) : balance / rem;
    for (let i = start; i <= end && bal > 0.01; i++) {
      const intr = bal * r;
      const pp = pmt - intr;
      let ep = Math.min(ex, bal - pp); if (ep < 0) ep = 0;
      if (bal - pp - ep < 0.01) { push(i, bal + intr, 0, intr, bal, kind); return; }
      push(i, pmt, ep, intr, pp, kind);
    }
  };

  const initN = Math.min(Math.round((inp.initPeriodMonths || 0) / monthsPer), N);

  if (inp.type === "standard") {
    stdBlock(1, N, inp.principal);
  } else if (inp.type === "flat") {
    const totalInterest = inp.principal * r * N;
    const pmt = (inp.principal + totalInterest) / N;
    const intPer = totalInterest / N;
    for (let i = 1; i <= N && bal > 0.01; i++) {
      const pp = pmt - intPer;
      if (i === N) { push(i, bal + intPer, 0, intPer, bal, "normal"); break; }
      push(i, pmt, 0, intPer, pp, "normal");
    }
  } else if (inp.type === "interest_only") {
    const ip = initN || Math.min(Math.round(6 / monthsPer), N);
    for (let i = 1; i <= ip && bal > 0.01; i++) { const intr = bal * r; push(i, intr, 0, intr, 0, "init"); }
    if (bal > 0.01) stdBlock(ip + 1, N, bal);
  } else if (inp.type === "custom_initial") {
    const ip = initN || Math.min(Math.round(6 / monthsPer), N);
    const cp = inp.customInitialPayment;
    for (let i = 1; i <= ip && bal > 0.01; i++) {
      const intr = bal * r; const pp = cp - intr;
      if (pp < 0) { const opening = bal; bal += Math.abs(pp); ci += intr; rows.push({ n: i, date: dateFor(i), opening, scheduled: cp, extra: 0, totalPay: cp, principal: pp, interest: intr, closing: bal, cumInterest: ci, kind: "init" }); continue; }
      push(i, cp, 0, intr, pp, "init");
    }
    if (bal > 0.01) stdBlock(ip + 1, N, bal);
  } else if (inp.type === "graduated") {
    const ip = initN || Math.min(Math.round(12 / monthsPer), N);
    const sp = inp.gradStepPct / 100;
    const fp = r > 0 ? (inp.principal * r) / (1 - Math.pow(1 + r, -N)) : inp.principal / N;
    const lo = fp * (1 - sp / 2);
    for (let i = 1; i <= ip && bal > 0.01; i++) {
      const intr = bal * r; const pp = lo - intr; const opening = bal;
      if (pp < 0) bal += Math.abs(pp); else bal = Math.max(0, bal - pp);
      ci += intr;
      rows.push({ n: i, date: dateFor(i), opening, scheduled: lo, extra: 0, totalPay: lo, principal: pp, interest: intr, closing: bal, cumInterest: ci, kind: "init" });
    }
    if (bal > 0.01) stdBlock(ip + 1, N, bal);
  } else if (inp.type === "balloon") {
    const bp = inp.balloonPct / 100;
    const ba = inp.principal * bp;
    const ap = inp.principal - ba;
    if (N > 1 && ap > 0) {
      const pmt = (ap * r) / (1 - Math.pow(1 + r, -(N - 1))) + ba * r;
      for (let i = 1; i < N && bal > ba + 0.01; i++) {
        const intr = bal * r; const pp = pmt - intr; let ep = Math.min(ex, bal - pp - ba); if (ep < 0) ep = 0;
        push(i, pmt, ep, intr, pp, "normal");
      }
    }
    const li = bal * r; ci += li;
    rows.push({ n: N, date: dateFor(N), opening: bal, scheduled: bal + li, extra: 0, totalPay: bal + li, principal: bal, interest: li, closing: 0, cumInterest: ci, kind: "balloon" });
    bal = 0;
  }

  if (rows.length && Math.abs(rows[rows.length - 1].closing) < 0.01) rows[rows.length - 1].closing = 0;
  const totalPaid = rows.reduce((s, r2) => s + r2.totalPay, 0);
  const totalInterest = rows.length ? rows[rows.length - 1].cumInterest : 0;
  return {
    rows, totalPaid, totalInterest,
    avgPayment: rows.length ? totalPaid / rows.length : 0,
    payoffDate: rows.length ? rows[rows.length - 1].date : inp.startDate,
    interestRatioPct: totalPaid ? (totalInterest / totalPaid) * 100 : 0,
    representativePayment: rows.find((r2) => r2.kind === "normal")?.totalPay ?? rows[0]?.totalPay ?? 0,
    periodsPerYear: fq,
  };
}

export function loanCsv(res: LoanResult): string {
  const header = "#,Date,Opening,Scheduled,Extra,Total,Principal,Interest,Closing,Cumulative Interest";
  const lines = res.rows.map((r) => [r.n, r.date, r.opening.toFixed(2), r.scheduled.toFixed(2), r.extra.toFixed(2), r.totalPay.toFixed(2), r.principal.toFixed(2), r.interest.toFixed(2), r.closing.toFixed(2), r.cumInterest.toFixed(2)].join(","));
  return [header, ...lines].join("\n");
}
