// Sample data used to make the modules feel live before a database is wired in.
// Replace these with real data-layer queries when the DB is connected.

export interface Deal {
  id: string;
  name: string;
  sector: string;
  country: string;
  stage:
    | "Origination"
    | "Screening"
    | "Analysis"
    | "IC"
    | "Due Diligence"
    | "Approval"
    | "Execution"
    | "Monitoring";
  ticket: number; // proposed ticket size in USD
  owner: string;
  updated: string;
}

export const DEALS: Deal[] = [
  { id: "D-2041", name: "Insurer Acquisition (Project Kestrel)", sector: "Financial Services", country: "Zimbabwe", stage: "Analysis", ticket: 14_000_000, owner: "Delight", updated: "2026-09-15" },
  { id: "D-2038", name: "Solar IPP — 40MW", sector: "Energy", country: "Zambia", stage: "IC", ticket: 22_000_000, owner: "Blessed", updated: "2026-09-14" },
  { id: "D-2036", name: "Dry-Port Logistics Hub", sector: "Infrastructure", country: "Zimbabwe", stage: "Due Diligence", ticket: 9_500_000, owner: "Gamu", updated: "2026-09-12" },
  { id: "D-2033", name: "Grain Trading Facility", sector: "Trade", country: "Malawi", stage: "Screening", ticket: 5_000_000, owner: "Delight", updated: "2026-09-11" },
  { id: "D-2029", name: "Lithium Off-take & Processing", sector: "Mining", country: "Zimbabwe", stage: "Monitoring", ticket: 30_000_000, owner: "Blessed", updated: "2026-09-08" },
  { id: "D-2027", name: "Cold-Chain Manufacturing", sector: "Manufacturing", country: "Zimbabwe", stage: "Origination", ticket: 3_200_000, owner: "Gamu", updated: "2026-09-05" },
];

export interface ResearchReport {
  id: string;
  title: string;
  type:
    | "Daily Market Report"
    | "Daily Market Intelligence"
    | "Weekly Sector Report"
    | "Monthly Report"
    | "Weekly Intelligence"
    | "Sector Note"
    | "Flash";
  author: string;
  date: string;
  status: "Published" | "Draft";
  summary: string;
  sectors: string[];
  /** Full printable HTML body (weekly/monthly reports), so archived reports can be re-opened & printed. */
  body?: string;
}

export const REPORTS: ResearchReport[] = [
  { id: "R-0912", title: "Daily Market Report — 16 Sep 2026", type: "Daily Market Report", author: "Research Desk", date: "2026-09-16", status: "Published", summary: "ZSE firmer on mining counters; USD/ZWL steady on the interbank; Brent eases below $74.", sectors: ["Mining", "Energy", "FX"] },
  { id: "R-0911", title: "Weekly Intelligence — Infrastructure & Logistics", type: "Weekly Intelligence", author: "Gamu", date: "2026-09-14", status: "Published", summary: "Regional corridor volumes up 6% q/q; cement demand resilient into H2.", sectors: ["Infrastructure", "Logistics"] },
  { id: "R-0908", title: "Sector Note — Southern Africa Power", type: "Sector Note", author: "Blessed", date: "2026-09-10", status: "Draft", summary: "IPP pipeline and tariff reform outlook across ZM/ZW/MZ.", sectors: ["Energy"] },
];

export interface Statement {
  id: string;
  account: string;
  bank: string;
  currency: string;
  period: string;
  closingBalance: number;
  reconciled: number; // count matched
  unreconciled: number; // count unmatched
  status: "Reconciled" | "In progress" | "Unreconciled";
}

export const STATEMENTS: Statement[] = [
  { id: "ST-088", account: "Operating — USD", bank: "CBZ Bank", currency: "USD", period: "Aug 2026", closingBalance: 1_284_500, reconciled: 142, unreconciled: 0, status: "Reconciled" },
  { id: "ST-087", account: "Investment — USD", bank: "Stanbic", currency: "USD", period: "Aug 2026", closingBalance: 6_910_200, reconciled: 58, unreconciled: 3, status: "In progress" },
  { id: "ST-086", account: "Payroll — ZWL", bank: "CBZ Bank", currency: "ZWL", period: "Aug 2026", closingBalance: 44_200_000, reconciled: 96, unreconciled: 1, status: "In progress" },
  { id: "ST-085", account: "Escrow — USD", bank: "Ecobank", currency: "USD", period: "Aug 2026", closingBalance: 2_000_000, reconciled: 4, unreconciled: 0, status: "Reconciled" },
];

export interface Loan {
  id: string;
  borrower: string;
  product: string;
  principal: number;
  ratePct: number;
  termMonths: number;
  status: "Performing" | "Watch" | "PAR>30" | "Closed";
  disbursed: string;
}

export const LOANS: Loan[] = [
  { id: "L-5521", borrower: "Tanaka Retail (Pvt)", product: "SME Working Capital", principal: 25_000, ratePct: 24, termMonths: 12, status: "Performing", disbursed: "2026-03-01" },
  { id: "L-5518", borrower: "Chipo Agri Co-op", product: "Agri Input Loan", principal: 40_000, ratePct: 18, termMonths: 9, status: "Watch", disbursed: "2026-02-10" },
  { id: "L-5510", borrower: "Moyo Transport", product: "Asset Finance", principal: 60_000, ratePct: 21, termMonths: 24, status: "PAR>30", disbursed: "2025-11-15" },
  { id: "L-5503", borrower: "Sithole Traders", product: "SME Working Capital", principal: 15_000, ratePct: 24, termMonths: 6, status: "Performing", disbursed: "2026-05-20" },
];

export interface PurchaseOrder {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  status: "Requisition" | "Pending Approval" | "Approved" | "Ordered" | "Received" | "Paid";
  requester: string;
  date: string;
  receivedDate?: string;
}

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: "PO-3312", vendor: "Bloomberg L.P.", description: "Terminal subscription renewal", amount: 24_000, currency: "USD", status: "Approved", requester: "Research Desk", date: "2026-09-10" },
  { id: "PO-3309", vendor: "Dell Technologies", description: "Analyst workstations x4", amount: 8_400, currency: "USD", status: "Pending Approval", requester: "Group IT", date: "2026-09-09" },
  { id: "PO-3305", vendor: "Deloitte Advisory", description: "DD support — Project Kestrel", amount: 35_000, currency: "USD", status: "Requisition", requester: "Delight", date: "2026-09-08" },
  { id: "PO-3298", vendor: "Africa Cloud Ltd", description: "Regional hosting (Jhb region)", amount: 1_200, currency: "USD", status: "Paid", requester: "Group IT", date: "2026-09-01" },
];

export interface AltAsset {
  id: string;
  name: string;
  class: "Private Equity" | "Real Estate" | "Infrastructure" | "Commodities";
  committed: number;
  called: number;
  nav: number;
  vintage: number;
}

export const ALT_ASSETS: AltAsset[] = [
  { id: "A-12", name: "Kestrel Insurance Holdco", class: "Private Equity", committed: 14_000_000, called: 6_000_000, nav: 7_100_000, vintage: 2026 },
  { id: "A-09", name: "Harare Logistics Park", class: "Real Estate", committed: 9_500_000, called: 9_500_000, nav: 10_800_000, vintage: 2024 },
  { id: "A-07", name: "40MW Solar IPP", class: "Infrastructure", committed: 22_000_000, called: 12_000_000, nav: 12_400_000, vintage: 2025 },
  { id: "A-03", name: "Lithium Off-take SPV", class: "Commodities", committed: 30_000_000, called: 18_000_000, nav: 21_500_000, vintage: 2025 },
];

export interface EmpDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  category: string; // Passport, National ID, Contract, CV, Other
  uploadedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  location: string;
  status: "Active" | "On Leave";
  managerId?: string;
  salary?: number; // gross monthly USD
  startDate?: string;
  email?: string;
  // personal
  phone?: string;
  address?: string;
  city?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  nationalId?: string;
  passportNo?: string;
  contractType?: string;
  // next of kin
  nokName?: string;
  nokRelationship?: string;
  nokPhone?: string;
  // banking
  bankName?: string;
  bankAccount?: string;
  // documents
  documents?: EmpDoc[];
}

export const EMPLOYEES: Employee[] = [
  { id: "E-001", name: "Takudzwa Mhlanga", role: "Chief Executive Officer", department: "Executive", location: "Harare", status: "Active", salary: 12000, startDate: "2019-01-10", email: "taku@rulethu.com" },
  { id: "E-002", name: "Chengetai Katsumbe", role: "Chief Investment Officer", department: "Investments", location: "Harare", status: "Active", managerId: "E-001", salary: 8500, startDate: "2020-03-01", email: "chenge@rulethu.com" },
  { id: "E-004", name: "Simba Katsande", role: "Chief Operating Officer", department: "Executive", location: "Harare", status: "Active", managerId: "E-001", salary: 8000, startDate: "2020-06-01", email: "simba@rulethu.com" },
  { id: "E-003", name: "Nozithelo", role: "Risk & Compliance", department: "Risk & Compliance", location: "Harare", status: "Active", managerId: "E-001", salary: 6500, startDate: "2021-05-01", email: "nozithelo@rulethu.com" },
  { id: "E-014", name: "Delight", role: "Investment Associate", department: "Investments", location: "Harare", status: "Active", managerId: "E-002", salary: 4500, startDate: "2022-08-01", email: "delight@rulethu.com" },
  { id: "E-015", name: "Blessed", role: "Investment Associate", department: "Investments", location: "Harare", status: "Active", managerId: "E-002", salary: 4500, startDate: "2022-06-15", email: "blessed@rulethu.com" },
  { id: "E-016", name: "Gamu", role: "Investment Associate", department: "Investments", location: "Harare", status: "On Leave", managerId: "E-002", salary: 4500, startDate: "2023-01-09", email: "gamuchirai@rulethu.com" },
  { id: "E-017", name: "Takudzwa Mugwisi", role: "Investment Analyst", department: "Investments", location: "Harare", status: "Active", managerId: "E-002", salary: 3500, startDate: "2024-03-04", email: "takudzwa.mugwisi@rulethu.com" },
  { id: "E-022", name: "Placement", role: "Head of Research", department: "Research", location: "Harare", status: "Active", managerId: "E-001" },
  { id: "E-030", name: "Placement", role: "Finance Manager", department: "Finance", location: "Harare", status: "Active", managerId: "E-001" },
  { id: "E-031", name: "Placement", role: "Accountant", department: "Finance", location: "Harare", status: "Active", managerId: "E-030" },
  { id: "E-040", name: "Placement", role: "HR & Admin Officer", department: "Operations", location: "Harare", status: "Active", managerId: "E-001" },
  { id: "E-041", name: "Placement", role: "IT & Systems Lead", department: "IT", location: "Harare", status: "Active", managerId: "E-001" },
];

// Fields that count toward a complete HR record.
const COMPLETENESS_FIELDS: (keyof Employee)[] = [
  "email", "phone", "address", "city", "dob", "gender", "maritalStatus", "nationalId",
  "passportNo", "startDate", "contractType", "salary", "bankName", "bankAccount",
  "nokName", "nokRelationship", "nokPhone",
];

export function employeeCompleteness(e: Employee): number {
  let filled = 0;
  for (const f of COMPLETENESS_FIELDS) {
    const v = e[f];
    if (v !== undefined && v !== null && String(v).trim() !== "") filled++;
  }
  if ((e.documents?.length ?? 0) > 0) filled++;
  return filled / (COMPLETENESS_FIELDS.length + 1);
}
