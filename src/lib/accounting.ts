// Accounting engine: a trial balance that, once populated, automatically
// produces the Income Statement and the Balance Sheet.

export type AccountType = "Asset" | "Liability" | "Equity" | "Income" | "Expense";

export interface TBAccount {
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
}

// Signed balance in the account's *normal* direction (positive = normal balance).
export function accountBalance(a: TBAccount): number {
  const net = (a.debit || 0) - (a.credit || 0);
  return a.type === "Asset" || a.type === "Expense" ? net : -net;
}

export interface FinancialStatements {
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;

  // Income statement
  revenue: number;
  expenses: number;
  netProfit: number;
  incomeLines: { name: string; amount: number }[];
  expenseLines: { name: string; amount: number }[];

  // Balance sheet
  totalAssets: number;
  totalLiabilities: number;
  openingEquity: number;
  equityWithProfit: number;
  assetLines: { name: string; amount: number }[];
  liabilityLines: { name: string; amount: number }[];
  equityLines: { name: string; amount: number }[];
  bsBalanced: boolean;
  bsDifference: number;
}

export function buildStatements(accounts: TBAccount[]): FinancialStatements {
  const totalDebit = accounts.reduce((s, a) => s + (a.debit || 0), 0);
  const totalCredit = accounts.reduce((s, a) => s + (a.credit || 0), 0);

  const byType = (t: AccountType) => accounts.filter((a) => a.type === t);
  const lines = (t: AccountType) => byType(t).map((a) => ({ name: a.name, amount: accountBalance(a) }));

  const incomeLines = lines("Income");
  const expenseLines = lines("Expense");
  const assetLines = lines("Asset");
  const liabilityLines = lines("Liability");
  const equityLines = lines("Equity");

  const revenue = incomeLines.reduce((s, l) => s + l.amount, 0);
  const expenses = expenseLines.reduce((s, l) => s + l.amount, 0);
  const netProfit = revenue - expenses;

  const totalAssets = assetLines.reduce((s, l) => s + l.amount, 0);
  const totalLiabilities = liabilityLines.reduce((s, l) => s + l.amount, 0);
  const openingEquity = equityLines.reduce((s, l) => s + l.amount, 0);
  const equityWithProfit = openingEquity + netProfit;

  const bsDifference = totalAssets - (totalLiabilities + equityWithProfit);

  return {
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
    revenue,
    expenses,
    netProfit,
    incomeLines,
    expenseLines,
    totalAssets,
    totalLiabilities,
    openingEquity,
    equityWithProfit,
    assetLines,
    liabilityLines,
    equityLines,
    bsBalanced: Math.abs(bsDifference) < 0.005,
    bsDifference,
  };
}

export const SAMPLE_TB: TBAccount[] = [
  { code: "1000", name: "Bank — Operating USD", type: "Asset", debit: 1_300_000, credit: 0 },
  { code: "1100", name: "Loans receivable (MFI)", type: "Asset", debit: 200_000, credit: 0 },
  { code: "1200", name: "Investments at fair value", type: "Asset", debit: 51_800_000, credit: 0 },
  { code: "2000", name: "Trade payables", type: "Liability", debit: 0, credit: 300_000 },
  { code: "2100", name: "Borrowings", type: "Liability", debit: 0, credit: 12_000_000 },
  { code: "3000", name: "Share capital", type: "Equity", debit: 0, credit: 35_000_000 },
  { code: "3100", name: "Retained earnings (opening)", type: "Equity", debit: 0, credit: 4_000_000 },
  { code: "4000", name: "Interest income", type: "Income", debit: 0, credit: 2_600_000 },
  { code: "4100", name: "Investment gains", type: "Income", debit: 0, credit: 1_900_000 },
  { code: "5000", name: "Operating expenses", type: "Expense", debit: 1_000_000, credit: 0 },
  { code: "5100", name: "Staff costs", type: "Expense", debit: 1_000_000, credit: 0 },
  { code: "5200", name: "Finance costs", type: "Expense", debit: 500_000, credit: 0 },
];
