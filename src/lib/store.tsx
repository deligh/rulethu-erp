"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cloudEnabled, cloudLoad, cloudSave, cloudSubscribe } from "./cloud";
import { JournalEntry, OPENING_ENTRY } from "./coa";
import { SAMPLE_JOURNALS } from "./finseed";
import type { PeriodType, PeriodReport } from "./finperiods";
import {
  DEALS, LOANS, PURCHASE_ORDERS, REPORTS, ALT_ASSETS, EMPLOYEES,
  Deal, Loan, PurchaseOrder, ResearchReport, AltAsset, Employee,
} from "./seed";
import { TASKS, Task } from "./tasks";
import { Template, AiDraft, SEED_TEMPLATES } from "./ai";
import { ModelInputs, ModelCategory } from "./modelbuilder";

// The current user for this browser session (until real auth is wired).
export const CURRENT_USER = "Delight";

export type LeaveType = "Annual" | "Sick" | "Study" | "Compassionate" | "Unpaid";
export type LeaveStatus = "Pending" | "Approved" | "Declined";

export interface LeaveRequest {
  id: string;
  employee: string;
  type: LeaveType;
  start: string;
  end: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

export type ClaimStatus = "Submitted" | "Pushed to Finance" | "Approved" | "Paid" | "Declined";

export interface TravelClaim {
  id: string;
  employee: string;
  destination: string;
  purpose: string;
  km: number;
  carType: string;
  ratePerKm: number;
  amount: number;
  date: string;
  status: ClaimStatus;
  createdAt: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string; // base64 data URL so anyone can download it
}

export interface ChatMessage {
  id: string;
  channelId: string;
  author: string;
  kind: "message" | "announcement";
  text: string;
  attachment?: Attachment;
  createdAt: string;
}

export interface ChannelInsight {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  private?: boolean;      // if true, only `members` can see/open it
  members?: string[];     // account emails (lowercase) with access
  // Owner-set brief: how documents/outputs for this channel should be created
  // (purpose, style, audience, must-haves). Members add insights → a shared
  // context the AI uses when drafting for this channel.
  context?: string;
  insights?: ChannelInsight[];
}

const SEED_CHANNELS: Channel[] = [
  { id: "general", name: "general", description: "Company-wide chatter", createdBy: "System", createdAt: "2026-09-01T00:00:00Z" },
  { id: "announcements", name: "announcements", description: "Official announcements", createdBy: "System", createdAt: "2026-09-01T00:00:00Z" },
  { id: "research", name: "research", description: "Market intelligence & reports", createdBy: "Research Desk", createdAt: "2026-09-02T00:00:00Z" },
  { id: "deals", name: "deals", description: "Live pipeline discussion", createdBy: "Delight", createdAt: "2026-09-03T00:00:00Z" },
];

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  module?: string;
  audience: string; // employee name or "all"
  createdAt: string;
  read: boolean;
  href?: string;     // click target — navigates the reader to the thing
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  terms: string;
}

const SEED_VENDORS: Vendor[] = [
  { id: "V-01", name: "Bloomberg L.P.", category: "Market data", terms: "Annual" },
  { id: "V-02", name: "Deloitte Advisory", category: "Professional services", terms: "Net 30" },
  { id: "V-03", name: "Dell Technologies", category: "IT hardware", terms: "Net 30" },
  { id: "V-04", name: "Africa Cloud Ltd", category: "Hosting", terms: "Monthly" },
];

export type TBFrequency = "At maturity" | "Annual" | "Semi-annual" | "Quarterly";
export interface TBill {
  id: string;
  client: string;
  reference: string; // e.g. FCTB2162 20230704F
  faceValue: number;
  couponRate: number; // % p.a.
  purchasePrice: number; // amount paid
  issueDate: string;
  maturityDate: string;
  frequency: TBFrequency;
  createdAt: string;
}

export interface CashLine {
  bank: string;
  entity: string;
  currency: string;
  opening: number;
  receipts: number;
  payments: number;
  charges: number;
}
export interface CashReport {
  id: string;
  date: string;
  author: string;
  lines: CashLine[];
  createdAt: string;
}

export interface QuizScore {
  id: string;
  user: string;
  quizId: string;
  date: string; // yyyy-mm-dd
  score: number;
  total: number;
  createdAt: string;
}

export interface Requisition {
  id: string;
  item: string;
  requester: string;
  department: string;
  estAmount: number;
  currency: string;
  status: "Requested" | "Approved" | "Converted" | "Declined";
  createdAt: string;
}

export interface PayrollLine { empId: string; name: string; gross: number; paye: number; pension: number; net: number }
export interface PayrollRun {
  id: string;
  period: string; // e.g. "Sep 2026"
  lines: PayrollLine[];
  totalGross: number;
  totalNet: number;
  status: "Draft" | "Posted";
  createdAt: string;
}

export interface PerfReview {
  id: string;
  employee: string;
  period: string;
  rating: number; // 1..5
  notes: string;
  reviewer: string;
  createdAt: string;
}

export interface AltEvent {
  id: string;
  assetId: string;
  assetName: string;
  type: "Call" | "Distribution" | "Valuation";
  amount: number;
  date: string;
}

export interface Goal {
  id: string;
  owner: string;
  title: string;
  category: "Book" | "Course" | "Skill" | "Certification" | "Other";
  detail: string; // why / what you like about it
  targetDate: string;
  status: "In progress" | "Done";
  completedDate?: string;
  revisedDate?: string; // if pushed out
  revisions: number;
  createdAt: string;
}

export interface TBRateChange {
  id: string;
  tbId: string;
  reference: string;
  date: string;
  oldRate: number;
  newRate: number;
  note: string;
}

export interface PersonalEvent {
  id: string;
  owner: string;
  title: string;
  date: string; // yyyy-mm-dd
  note?: string;
  createdAt: string;
}

export interface SavedModel {
  id: string;
  name: string;
  category: ModelCategory;
  basis: "AI" | "Clone" | "Manual";
  inputs: ModelInputs;
  rationale?: string;
  createdBy: string;
  createdAt: string;
}

export type RequestType = "Procurement" | "Payment" | "Finance posting" | "HR" | "IT" | "Other";
export type RequestStatus = "Open" | "In progress" | "Fulfilled" | "Declined";
export interface InternalRequest {
  id: string;
  fromDept: string;
  fromUser: string;
  toDept: string;
  type: RequestType;
  title: string;
  detail: string;
  amount: number;     // 0 if no financial value
  currency: string;
  status: RequestStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  note?: string;      // fulfilment / decline note
  createdAt: string;
}

// Market news feed — AI-generated digest + live commodity prices (shared).
export interface MarketPrice {
  name: string;        // "Gold", "Platinum", "Brent Crude", "Lithium carbonate"...
  value: string;       // formatted, e.g. "$2,650/oz"
  change?: string;     // e.g. "+1.2%" or "-0.4%"
  dir?: "up" | "down" | "flat";
  source?: string;     // e.g. "Kitco"
  insight?: string;    // one-line AI read on this specific move
  raw?: number;        // raw numeric price (live feed) — for honest change math
  live?: boolean;      // true if from a live market feed (not the AI brief)
  at?: string;         // ISO time the live feed last updated this price
  aiNote?: boolean;    // true when `insight`/`change` were authored by the AI brief
}
export interface NewsSource { label: string; url: string }
export interface NewsStory {
  title: string;
  category: string;          // Commodities | Macro | Africa & SADC | Equities | Energy | FX
  summary: string;           // one-line teaser
  detail: string;            // 2-4 sentences, expanded on click
  impact?: "up" | "down" | "watch";
  takeaway?: string;         // Rulethu read-through
}
export interface MarketSnapshot {
  date: string;              // yyyy-mm-dd of the digest
  generatedAt: string;       // ISO timestamp
  prices: MarketPrice[];
  headline: string;          // one-line market headline
  commentary: string;        // AI market take (markdown-ish, Rulethu lens)
  watch: string[];           // 3-5 "what to watch" bullets
  stories?: NewsStory[];     // expandable news cards (commodities + broader markets)
  sources?: NewsSource[];    // where the prices came from (Kitco etc.)
  demo?: boolean;            // true if produced by the fallback (no live AI)
}
export interface NewsComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  parentId?: string;   // reply-to a specific comment (threading)
  isAI?: boolean;      // true when Rulethu AI answered an @AI tag
}

// Personal workspace (private to each owner) ------------------------------
export type WorkProjectStatus = "Active" | "On hold" | "Done";
export interface WorkspaceProject {
  id: string;
  owner: string;         // user name — only the owner sees it
  title: string;
  description?: string;
  status: WorkProjectStatus;
  createdAt: string;
}
export interface WorkLog {
  id: string;
  owner: string;
  period: "daily" | "weekly";
  date: string;          // yyyy-mm-dd
  text: string;
  createdAt: string;
}
export interface Reminder {
  id: string;
  owner: string;
  text: string;
  dueDate: string;       // yyyy-mm-dd
  done: boolean;
  createdAt: string;
}

// Collaborative whiteboard (shared) ---------------------------------------
export interface BoardNote {
  id: string;
  author: string;
  text: string;
  color: string;         // token/background
  x: number;             // percent 0..100 (responsive)
  y: number;             // percent 0..100
  createdAt: string;
}

// Portfolio & Investor (LP) CRM -------------------------------------------
export interface Holding {
  id: string;
  company: string;        // portfolio company / asset name
  sector: string;
  stage: "Seed" | "Growth" | "Buyout" | "Private Credit" | "Real Assets" | "Listed";
  invested: number;       // cost basis (USD)
  fairValue: number;      // current fair value (USD)
  ownership: number;      // percent 0..100
  entryDate: string;      // yyyy-mm-dd
  status: "Performing" | "Watch" | "Underperforming" | "Exited" | "Written off";
  lead: string;           // deal lead (employee name)
  note?: string;
  createdAt: string;
}
export interface Investor {
  id: string;
  name: string;           // LP / investor name
  type: "Institutional" | "Family Office" | "DFI" | "HNWI" | "Corporate";
  contact?: string;       // primary contact person
  email?: string;
  committed: number;      // capital commitment (USD)
  called: number;         // capital drawn to date
  distributed: number;    // distributions to date
  relationship: "Prospect" | "Committed" | "Active" | "Exited";
  owner: string;          // relationship owner (employee name)
  lastContact?: string;   // yyyy-mm-dd
  note?: string;
  createdAt: string;
}

// Knowledge library — uploaded documents that become part of the shared "one
// source of truth" the AI reads from. Each record points at a file in Supabase
// Storage and carries a description plus an extracted text excerpt (for
// text/CSV/spreadsheet files) so the assistant can cite real content.
export interface KnowledgeDoc {
  id: string;
  name: string;          // display name (original filename)
  path: string;          // storage path within the bucket (includes folder)
  folder: string;        // "" = root, else folder label
  type: string;          // mime type
  size: number;
  description: string;   // what this document is (user-provided)
  excerpt: string;       // extracted text (may be empty for pdf/word)
  readable: boolean;     // true if we extracted text the AI can quote
  uploadedBy: string;
  createdAt: string;
}

// Published financial statements — a frozen snapshot of a period's statements
// plus the management commentary, finalised by Finance before publishing.
export interface FinStatement {
  id: string;
  periodType: PeriodType;
  label: string;
  start: string;
  end: string;
  commentary: string;
  report: PeriodReport;   // frozen figures at publish time
  publishedBy: string;
  publishedAt: string;
}

// Collections that support generic add / patch.
interface Collections {
  knowledge: KnowledgeDoc[];
  finStatements: FinStatement[];
  deals: Deal[];
  loans: Loan[];
  pos: PurchaseOrder[];
  vendors: Vendor[];
  reports: ResearchReport[];
  alts: AltAsset[];
  employees: Employee[];
  tasks: Task[];
  tbills: TBill[];
  cashReports: CashReport[];
  quizScores: QuizScore[];
  requisitions: Requisition[];
  payrollRuns: PayrollRun[];
  reviews: PerfReview[];
  altEvents: AltEvent[];
  tbRates: TBRateChange[];
  goals: Goal[];
  templates: Template[];
  drafts: AiDraft[];
  requests: InternalRequest[];
  savedModels: SavedModel[];
  personalEvents: PersonalEvent[];
  newsComments: NewsComment[];
  workspaceProjects: WorkspaceProject[];
  workLogs: WorkLog[];
  reminders: Reminder[];
  boardNotes: BoardNote[];
  holdings: Holding[];
  investors: Investor[];
}
type CKey = keyof Collections;
type Item<K extends CKey> = Collections[K][number];

interface AppData extends Collections {
  entries: JournalEntry[];
  leave: LeaveRequest[];
  claims: TravelClaim[];
  channels: Channel[];
  messages: ChatMessage[];
  notifications: AppNotification[];
  market: MarketSnapshot | null;   // latest shared market digest
  digestDate: string | null;       // yyyy-mm-dd of the last auto-posted daily digest
}

// Deterministic seed (same on server + first client render → no hydration mismatch).
const SEED: AppData = {
  entries: [OPENING_ENTRY, ...SAMPLE_JOURNALS],
  leave: [
    { id: "LV-1001", employee: "Gamu", type: "Annual", start: "2026-09-15", end: "2026-09-19", days: 5, reason: "Family time", status: "Approved", createdAt: "2026-09-08T09:00:00Z" },
    { id: "LV-1002", employee: "Blessed", type: "Study", start: "2026-10-02", end: "2026-10-03", days: 2, reason: "CFA exam", status: "Pending", createdAt: "2026-09-12T09:00:00Z" },
  ],
  claims: [
    { id: "TC-2001", employee: "Delight", destination: "Bulawayo site visit", purpose: "Dry-Port diligence", km: 880, carType: "Double cab (diesel)", ratePerKm: 0.45, amount: 396, date: "2026-09-10", status: "Approved", createdAt: "2026-09-10T09:00:00Z" },
  ],
  channels: [...SEED_CHANNELS],
  messages: [
    { id: "MSG-1", channelId: "announcements", author: "Takudzwa Mhlanga", kind: "announcement", text: "Welcome to the Rulethu platform. IC for the Solar IPP is confirmed for 23 Sep.", createdAt: "2026-09-14T08:00:00Z" },
    { id: "MSG-2", channelId: "research", author: "Research Desk", kind: "message", text: "Daily market report is up — mining counters leading.", createdAt: "2026-09-16T07:30:00Z" },
    { id: "MSG-3", channelId: "general", author: "Gamu", kind: "message", text: "Morning all — corridor freight data looks strong this week.", createdAt: "2026-09-16T08:10:00Z" },
    { id: "MSG-4", channelId: "deals", author: "Delight", kind: "message", text: "Project Kestrel valuation is at 60% — will share the model in this channel today.", createdAt: "2026-09-16T09:00:00Z" },
  ],
  notifications: [
    { id: "N-1", title: "IC scheduled", body: "Solar IPP — 23 Sep 2026", module: "investments", audience: "all", createdAt: "2026-09-14T08:00:00Z", read: false },
  ],
  deals: [...DEALS],
  loans: [...LOANS],
  pos: [...PURCHASE_ORDERS],
  vendors: [...SEED_VENDORS],
  reports: [...REPORTS],
  alts: [...ALT_ASSETS],
  employees: [...EMPLOYEES],
  tasks: [...TASKS],
  tbills: [
    { id: "TB-2162", client: "Rulethu Nominees", reference: "FCTB2162 20230704F", faceValue: 1_000_000, couponRate: 5, purchasePrice: 700_000, issueDate: "2023-07-04", maturityDate: "2029-06-04", frequency: "At maturity", createdAt: "2023-07-04T00:00:00Z" },
    { id: "TB-1460", client: "Rulethu Nominees", reference: "FCTB1460 20230630D", faceValue: 500_000, couponRate: 5, purchasePrice: 350_000, issueDate: "2023-06-30", maturityDate: "2027-06-27", frequency: "At maturity", createdAt: "2023-06-30T00:00:00Z" },
    { id: "TB-5507", client: "WA Asset Management", reference: "FCTB5507 20220811AU", faceValue: 750_000, couponRate: 0, purchasePrice: 148_286, issueDate: "2022-08-11", maturityDate: "2037-08-11", frequency: "At maturity", createdAt: "2022-08-11T00:00:00Z" },
  ],
  cashReports: [],
  quizScores: [],
  requisitions: [
    { id: "RQ-118", item: "DD support — Project Kestrel", requester: "Delight", department: "Investments", estAmount: 35000, currency: "USD", status: "Requested", createdAt: "2026-09-08T09:00:00Z" },
    { id: "RQ-117", item: "Analyst workstations x4", requester: "Simba Katsande", department: "IT", estAmount: 8400, currency: "USD", status: "Approved", createdAt: "2026-09-09T09:00:00Z" },
  ],
  payrollRuns: [],
  reviews: [
    { id: "PR-1", employee: "Blessed", period: "H1 2026", rating: 4, notes: "Strong IC memos; grow modelling depth.", reviewer: "Rutendo Chikweya", createdAt: "2026-07-01T09:00:00Z" },
  ],
  altEvents: [
    { id: "AE-1", assetId: "A-12", assetName: "Kestrel Insurance Holdco", type: "Call", amount: 6_000_000, date: "2026-03-01" },
    { id: "AE-2", assetId: "A-07", assetName: "40MW Solar IPP", type: "Call", amount: 12_000_000, date: "2025-06-01" },
    { id: "AE-3", assetId: "A-09", assetName: "Harare Logistics Park", type: "Distribution", amount: 900_000, date: "2026-06-30" },
    { id: "AE-4", assetId: "A-03", assetName: "Lithium Off-take SPV", type: "Distribution", amount: 1_500_000, date: "2026-08-15" },
  ],
  tbRates: [
    { id: "RC-1", tbId: "TB-2162", reference: "FCTB2162 20230704F", date: "2024-07-04", oldRate: 5, newRate: 5.5, note: "Annual step-up per schedule" },
  ],
  goals: [
    { id: "G-1", owner: "Delight", title: "The Intelligent Investor", category: "Book", detail: "Value-investing fundamentals for sharper IC memos.", targetDate: "2026-09-30", status: "In progress", revisions: 0, createdAt: "2026-09-01T00:00:00Z" },
    { id: "G-2", owner: "Blessed", title: "CFA Level II — Equity", category: "Course", detail: "Deepen valuation & modelling.", targetDate: "2026-10-15", status: "In progress", revisions: 0, createdAt: "2026-08-20T00:00:00Z" },
  ],
  templates: [...SEED_TEMPLATES],
  drafts: [],
  requests: [
    { id: "IR-3001", fromDept: "Investments", fromUser: "Delight", toDept: "Procurement", type: "Procurement", title: "4 analyst workstations", detail: "High-spec laptops for the modelling team — Dell or equivalent.", amount: 8400, currency: "USD", status: "Open", createdAt: "2026-09-17T09:00:00Z" },
    { id: "IR-3002", fromDept: "Procurement", fromUser: "Procurement", toDept: "Finance", type: "Payment", title: "Settle Bloomberg annual invoice", detail: "Terminal subscription renewal — due end of month.", amount: 24000, currency: "USD", status: "Open", createdAt: "2026-09-18T09:00:00Z" },
    { id: "IR-3003", fromDept: "Research", fromUser: "Head of Research", toDept: "IT", type: "IT", title: "Data-room access for 2 analysts", detail: "Provision VDR logins for the Dry-Port diligence.", amount: 0, currency: "USD", status: "Fulfilled", resolvedBy: "IT & Systems Lead", resolvedAt: "2026-09-16T12:00:00Z", createdAt: "2026-09-15T09:00:00Z" },
  ],
  savedModels: [],
  personalEvents: [
    { id: "PE-1", owner: "Delight", title: "Kestrel valuation review with CIO", date: "2026-09-22", createdAt: "2026-09-16T00:00:00Z" },
    { id: "PE-2", owner: "Delight", title: "Submit CFA study plan", date: "2026-09-30", createdAt: "2026-09-16T00:00:00Z" },
  ],
  newsComments: [],
  workspaceProjects: [
    { id: "WP-1", owner: "Delight", title: "Project Kestrel — valuation", description: "Finish the insurer DCF and comps; prep IC memo.", status: "Active", createdAt: "2026-11-10T00:00:00Z" },
  ],
  workLogs: [
    { id: "WL-1", owner: "Delight", period: "weekly", date: "2026-11-17", text: "Refining the Kestrel model; drafting the solar IPP IC paper; reviewing lithium off-take terms.", createdAt: "2026-11-17T00:00:00Z" },
  ],
  reminders: [
    { id: "RM-1", owner: "Delight", text: "Send Kestrel model to CIO", dueDate: "2026-11-20", done: false, createdAt: "2026-11-17T00:00:00Z" },
  ],
  boardNotes: [
    { id: "BN-1", author: "Delight", text: "Solar IPP — confirm 20yr PPA tariff", color: "var(--lz-yellow-bg)", x: 12, y: 18, createdAt: "2026-11-16T00:00:00Z" },
    { id: "BN-2", author: "Research Desk", text: "Lithium price risk → stress off-take economics", color: "var(--lz-blue-bg)", x: 44, y: 32, createdAt: "2026-11-16T00:00:00Z" },
    { id: "BN-3", author: "Gamu", text: "Dry-Port: corridor volumes +6% q/q", color: "var(--lz-green-bg)", x: 70, y: 22, createdAt: "2026-11-16T00:00:00Z" },
  ],
  knowledge: [],
  finStatements: [],
  holdings: [
    { id: "H-1", company: "Lithium Off-take SPV", sector: "Mining & Resources", stage: "Private Credit", invested: 30_000_000, fairValue: 21_500_000, ownership: 100, entryDate: "2025-08-05", status: "Watch", lead: "Blessed", note: "Lithium price soft; off-take economics under review.", createdAt: "2025-08-05T00:00:00Z" },
    { id: "H-2", company: "Harare Logistics Park", sector: "Real Estate", stage: "Real Assets", invested: 9_200_000, fairValue: 10_800_000, ownership: 65, entryDate: "2024-11-12", status: "Performing", lead: "Gamu", note: "Occupancy 94%; USD leases.", createdAt: "2024-11-12T00:00:00Z" },
    { id: "H-3", company: "40MW Solar IPP", sector: "Energy & Infrastructure", stage: "Growth", invested: 12_000_000, fairValue: 12_400_000, ownership: 40, entryDate: "2026-02-20", status: "Watch", lead: "Blessed", note: "Tariff negotiation pending IC.", createdAt: "2026-02-20T00:00:00Z" },
    { id: "H-4", company: "Cold-Chain Manufacturing", sector: "Manufacturing", stage: "Buyout", invested: 3_200_000, fairValue: 4_100_000, ownership: 55, entryDate: "2024-03-18", status: "Performing", lead: "Delight", note: "EBITDA +18% YoY.", createdAt: "2024-03-18T00:00:00Z" },
    { id: "H-5", company: "Tanaka Retail Group", sector: "Consumer & Retail", stage: "Growth", invested: 5_500_000, fairValue: 7_900_000, ownership: 30, entryDate: "2023-09-01", status: "Performing", lead: "Gamu", note: "Store rollout ahead of plan.", createdAt: "2023-09-01T00:00:00Z" },
    { id: "H-6", company: "AgriFin Microbank", sector: "Financial Services", stage: "Growth", invested: 2_800_000, fairValue: 2_600_000, ownership: 25, entryDate: "2025-05-10", status: "Underperforming", lead: "Delight", note: "PAR elevated; turnaround plan in place.", createdAt: "2025-05-10T00:00:00Z" },
  ],
  investors: [
    { id: "LP-1", name: "Southern Africa Pension Fund", type: "Institutional", contact: "T. Ncube", email: "", committed: 40_000_000, called: 28_000_000, distributed: 9_000_000, relationship: "Active", owner: "Takudzwa Mhlanga", lastContact: "2026-10-28", note: "Re-up discussion for Fund III in Q1.", createdAt: "2024-01-15T00:00:00Z" },
    { id: "LP-2", name: "Pan-African DFI", type: "DFI", contact: "M. Dlamini", email: "", committed: 35_000_000, called: 22_000_000, distributed: 4_500_000, relationship: "Active", owner: "Takudzwa Mhlanga", lastContact: "2026-11-02", note: "ESG reporting pack due quarterly.", createdAt: "2024-02-01T00:00:00Z" },
    { id: "LP-3", name: "Moyo Family Office", type: "Family Office", contact: "R. Moyo", email: "", committed: 12_000_000, called: 8_000_000, distributed: 3_200_000, relationship: "Active", owner: "Delight", lastContact: "2026-10-15", note: "Prefers real-asset co-invest.", createdAt: "2024-06-10T00:00:00Z" },
    { id: "LP-4", name: "Gulf Sovereign Co-invest", type: "Institutional", contact: "A. Rahman", email: "", committed: 25_000_000, called: 0, distributed: 0, relationship: "Committed", owner: "Takudzwa Mhlanga", lastContact: "2026-11-05", note: "Signed; first drawdown scheduled Dec.", createdAt: "2026-09-20T00:00:00Z" },
    { id: "LP-5", name: "Harare HNWI Syndicate", type: "HNWI", contact: "Various", email: "", committed: 6_000_000, called: 4_200_000, distributed: 1_800_000, relationship: "Active", owner: "Gamu", lastContact: "2026-09-30", note: "12 individuals via nominee.", createdAt: "2024-04-04T00:00:00Z" },
    { id: "LP-6", name: "East Africa Insurance Co.", type: "Institutional", contact: "P. Otieno", email: "", committed: 20_000_000, called: 0, distributed: 0, relationship: "Prospect", owner: "Delight", lastContact: "2026-10-20", note: "Reviewing PPM; IC meets their board Jan.", createdAt: "2026-08-12T00:00:00Z" },
  ],
  market: null,
  digestDate: null,
};

interface Ctx extends AppData {
  hydrated: boolean;
  // finance / workflow-specific
  addEntry: (memo: string, source: string, lines: JournalEntry["lines"], date?: string) => void;
  importJournals: (rows: JournalEntry[]) => void;
  removeEntry: (id: string) => void;
  addLeave: (r: Omit<LeaveRequest, "id" | "status" | "createdAt">) => void;
  setLeaveStatus: (id: string, status: LeaveStatus) => void;
  addClaim: (c: Omit<TravelClaim, "id" | "status" | "createdAt">) => void;
  setClaimStatus: (id: string, status: ClaimStatus) => void;
  addMessage: (channelId: string, kind: ChatMessage["kind"], text: string, attachment?: Attachment, author?: string) => void;
  addChannel: (name: string, opts?: { description?: string; isPrivate?: boolean; members?: string[]; createdBy?: string }) => string;
  addChannelMember: (channelId: string, email: string) => void;
  setChannelContext: (channelId: string, context: string) => void;
  addChannelInsight: (channelId: string, text: string, author?: string) => void;
  markAllRead: () => void;
  markNoteRead: (id: string) => void;
  notify: (title: string, body?: string, module?: string, audience?: string) => void;
  raiseRequest: (r: Omit<InternalRequest, "id" | "status" | "createdAt">) => void;
  fulfilRequest: (id: string, resolvedBy: string, note?: string) => void;
  setRequestStatus: (id: string, status: RequestStatus, resolvedBy?: string, note?: string) => void;
  // research
  publishReport: (report: ResearchReport, opts?: { summary?: string; attachment?: Attachment }) => void;
  // market news feed
  setMarket: (snap: MarketSnapshot) => void;
  setDigestDate: (date: string) => void;
  // generic collection ops
  add: <K extends CKey>(key: K, item: Item<K>, note?: { title: string; body?: string; module?: string }) => void;
  patch: <K extends CKey>(key: K, id: string, p: Partial<Item<K>>, note?: { title: string; body?: string; module?: string }) => void;
  remove: <K extends CKey>(key: K, id: string) => void;
  resetAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
const KEY = "rulethu-erp-data-v8";

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}
const uid = genId;

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const dataRef = useRef(data);
  const suppressSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    // 1) local cache first — instant render
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const parsed = { ...SEED, ...JSON.parse(raw) }; setData(parsed); dataRef.current = parsed; }
    } catch { /* ignore */ }
    setHydrated(true);

    // 2) cloud (authoritative, shared) if configured
    if (!cloudEnabled) return;
    let unsub = () => {};
    (async () => {
      const row = await cloudLoad();
      if (row && row.data) { suppressSave.current = true; setData({ ...SEED, ...(row.data as AppData) }); }
      else { await cloudSave({ data: dataRef.current }); }
      unsub = cloudSubscribe((r) => { if (r.data) { suppressSave.current = true; setData({ ...SEED, ...(r.data as AppData) }); } });
    })();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
    if (!cloudEnabled) return;
    if (suppressSave.current) { suppressSave.current = false; return; } // don't echo a remote change back
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { cloudSave({ data }); }, 700);
  }, [data, hydrated]);

  const mkNote = (title: string, body?: string, module?: string, audience = "all"): AppNotification => ({
    id: uid("N"), title, body, module, audience, createdAt: new Date().toISOString(), read: false,
  });

  const notify: Ctx["notify"] = useCallback((title, body, module, audience = "all") => {
    setData((d) => ({ ...d, notifications: [mkNote(title, body, module, audience), ...d.notifications] }));
  }, []);

  const setMarket: Ctx["setMarket"] = useCallback((snap) => {
    setData((d) => ({ ...d, market: snap }));
  }, []);

  const setDigestDate: Ctx["setDigestDate"] = useCallback((date) => {
    setData((d) => ({ ...d, digestDate: date }));
  }, []);

  const add: Ctx["add"] = useCallback((key, item, note) => {
    setData((d) => ({
      ...d,
      [key]: [item, ...(d[key] as Item<typeof key>[])] as AppData[typeof key],
      notifications: note ? [mkNote(note.title, note.body, note.module), ...d.notifications] : d.notifications,
    }));
  }, []);

  const patch: Ctx["patch"] = useCallback((key, id, p, note) => {
    setData((d) => ({
      ...d,
      [key]: (d[key] as Array<{ id: string }>).map((x) => (x.id === id ? { ...x, ...p } : x)) as AppData[typeof key],
      notifications: note ? [mkNote(note.title, note.body, note.module), ...d.notifications] : d.notifications,
    }));
  }, []);

  const remove: Ctx["remove"] = useCallback((key, id) => {
    setData((d) => ({
      ...d,
      [key]: (d[key] as Array<{ id: string }>).filter((x) => x.id !== id) as AppData[typeof key],
    }));
  }, []);

  const addEntry: Ctx["addEntry"] = useCallback((memo, source, lines, date) => {
    setData((d) => ({
      ...d,
      entries: [...d.entries, { id: uid("JE"), date: date ?? new Date().toISOString().slice(0, 10), memo, source, lines }],
      notifications: [mkNote("Journal posted", memo, "finance"), ...d.notifications],
    }));
  }, []);

  // Append many journals at once (e.g. sample/imported postings) with a single notification.
  const importJournals: Ctx["importJournals"] = useCallback((rows) => {
    setData((d) => ({
      ...d,
      entries: [...d.entries, ...rows],
      notifications: [mkNote("Postings imported", `${rows.length} journal entries added to the ledger`, "finance"), ...d.notifications],
    }));
  }, []);

  const removeEntry: Ctx["removeEntry"] = useCallback((id) => {
    setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id || e.id === "JE-OPEN") }));
  }, []);

  const addLeave: Ctx["addLeave"] = useCallback((r) => {
    setData((d) => ({
      ...d,
      leave: [{ ...r, id: uid("LV"), status: "Pending", createdAt: new Date().toISOString() }, ...d.leave],
      notifications: [mkNote("Leave request submitted", `${r.employee}: ${r.type}, ${r.days} day(s)`, "hr"), ...d.notifications],
    }));
  }, []);

  const setLeaveStatus: Ctx["setLeaveStatus"] = useCallback((id, status) => {
    setData((d) => {
      const req = d.leave.find((l) => l.id === id);
      return {
        ...d,
        leave: d.leave.map((l) => (l.id === id ? { ...l, status } : l)),
        notifications: [mkNote(`Leave ${status.toLowerCase()}`, req ? `${req.employee}: ${req.type}` : undefined, "hr", req?.employee ?? "all"), ...d.notifications],
      };
    });
  }, []);

  const addClaim: Ctx["addClaim"] = useCallback((c) => {
    setData((d) => ({
      ...d,
      claims: [{ ...c, id: uid("TC"), status: "Pushed to Finance", createdAt: new Date().toISOString() }, ...d.claims],
      notifications: [mkNote("Travel claim pushed to Finance", `${c.employee}: ${c.destination} — $${c.amount.toFixed(2)}`, "finance"), ...d.notifications],
    }));
  }, []);

  const setClaimStatus: Ctx["setClaimStatus"] = useCallback((id, status) => {
    setData((d) => {
      const claim = d.claims.find((c) => c.id === id);
      let entries = d.entries;
      if (claim && status === "Approved") {
        entries = [
          ...d.entries,
          {
            id: uid("JE"),
            date: new Date().toISOString().slice(0, 10),
            memo: `Travel claim ${claim.id} — ${claim.employee}`,
            source: `Travel claim ${claim.id}`,
            lines: [
              { accountCode: "5300", debit: claim.amount, credit: 0 },
              { accountCode: "2200", debit: 0, credit: claim.amount },
            ],
          },
        ];
      }
      return {
        ...d,
        claims: d.claims.map((c) => (c.id === id ? { ...c, status } : c)),
        entries,
        notifications: [mkNote(`Claim ${status.toLowerCase()}`, claim ? `${claim.destination} — $${claim.amount.toFixed(2)}` : undefined, "finance", claim?.employee ?? "all"), ...d.notifications],
      };
    });
  }, []);

  const addMessage: Ctx["addMessage"] = useCallback((channelId, kind, text, attachment, author = CURRENT_USER) => {
    setData((d) => {
      const ch = d.channels.find((c) => c.id === channelId);
      const label = ch ? `#${ch.name}` : "";
      return {
        ...d,
        messages: [...d.messages, { id: uid("MSG"), channelId, author, kind, text, attachment, createdAt: new Date().toISOString() }],
        notifications:
          kind === "announcement"
            ? [mkNote("New announcement", `${label}: ${text.slice(0, 70)}`, "comms"), ...d.notifications]
            : attachment
              ? [mkNote("File shared", `${author} shared ${attachment.name} in ${label}`, "comms"), ...d.notifications]
              : d.notifications,
      };
    });
  }, []);

  const addChannel: Ctx["addChannel"] = useCallback((name, opts) => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "channel";
    const id = uid("ch");
    const members = opts?.isPrivate
      ? Array.from(new Set((opts.members ?? []).map((e) => e.toLowerCase())))
      : undefined;
    setData((d) => ({
      ...d,
      channels: [...d.channels, { id, name: clean, description: opts?.description, createdBy: opts?.createdBy ?? CURRENT_USER, createdAt: new Date().toISOString(), private: opts?.isPrivate || undefined, members }],
      notifications: [mkNote(opts?.isPrivate ? "Private channel created" : "New channel created", `#${clean}`, "comms", opts?.isPrivate ? (opts.createdBy ?? CURRENT_USER) : "all"), ...d.notifications],
    }));
    return id;
  }, []);

  const addChannelMember: Ctx["addChannelMember"] = useCallback((channelId, email) => {
    const e = email.trim().toLowerCase();
    setData((d) => ({
      ...d,
      channels: d.channels.map((c) => (c.id === channelId ? { ...c, members: Array.from(new Set([...(c.members ?? []), e])) } : c)),
      notifications: [mkNote("Added to a channel", `You were added to a private channel`, "comms", e), ...d.notifications],
    }));
  }, []);

  // Publish a research report → one place that (1) stores it, (2) notifies
  // everyone with a CLICKABLE link to open it, and (3) posts a concise summary
  // to the group comms channel so the whole team sees the update, on point.
  const publishReport: Ctx["publishReport"] = useCallback((report, opts) => {
    setData((d) => {
      const summaryBlock = opts?.summary?.trim()
        || report.summary?.trim()
        || `${report.type} for ${report.date}.`;
      const msgText =
        `📊 ${report.title} — just published to the group.\n\n` +
        summaryBlock +
        `\n\nFull report attached — open it to read or save as PDF, or find it in Research → Library.`;
      const groupChannel = d.channels.some((c) => c.id === "announcements") ? "announcements" : (d.channels[0]?.id ?? "general");
      const msg: ChatMessage = {
        id: uid("MSG"), channelId: groupChannel, author: report.author,
        kind: "message", text: msgText, attachment: opts?.attachment, createdAt: new Date().toISOString(),
      };
      const note: AppNotification = {
        id: uid("N"), title: `${report.type} published`, body: report.title,
        module: "research", audience: "all", createdAt: new Date().toISOString(),
        read: false, href: `/research?report=${report.id}`,
      };
      return {
        ...d,
        reports: [report, ...d.reports],
        messages: [...d.messages, msg],
        notifications: [note, ...d.notifications],
      };
    });
  }, []);

  const setChannelContext: Ctx["setChannelContext"] = useCallback((channelId, context) => {
    setData((d) => ({
      ...d,
      channels: d.channels.map((c) => (c.id === channelId ? { ...c, context } : c)),
    }));
  }, []);

  const addChannelInsight: Ctx["addChannelInsight"] = useCallback((channelId, text, author = CURRENT_USER) => {
    const insight: ChannelInsight = { id: uid("INS"), author, text, createdAt: new Date().toISOString() };
    setData((d) => ({
      ...d,
      channels: d.channels.map((c) => (c.id === channelId ? { ...c, insights: [...(c.insights ?? []), insight] } : c)),
    }));
  }, []);

  const markAllRead: Ctx["markAllRead"] = useCallback(() => {
    setData((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
  }, []);

  const markNoteRead: Ctx["markNoteRead"] = useCallback((id) => {
    setData((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  }, []);

  const raiseRequest: Ctx["raiseRequest"] = useCallback((r) => {
    setData((d) => ({
      ...d,
      requests: [{ ...r, id: uid("IR"), status: "Open", createdAt: new Date().toISOString() }, ...d.requests],
      notifications: [mkNote("New request", `${r.fromDept} → ${r.toDept}: ${r.title}`, "requests"), ...d.notifications],
    }));
  }, []);

  const setRequestStatus: Ctx["setRequestStatus"] = useCallback((id, status, resolvedBy, note) => {
    setData((d) => {
      const req = d.requests.find((r) => r.id === id);
      return {
        ...d,
        requests: d.requests.map((r) => (r.id === id ? { ...r, status, resolvedBy: resolvedBy ?? r.resolvedBy, resolvedAt: new Date().toISOString(), note: note ?? r.note } : r)),
        notifications: [mkNote(`Request ${status.toLowerCase()}`, req ? `${req.title}` : undefined, "requests", req?.fromUser ?? "all"), ...d.notifications],
      };
    });
  }, []);

  // Fulfil a request: mark Fulfilled and, if it carries a value, post it to the
  // Finance ledger (Dr operating expense, Cr trade payables).
  const fulfilRequest: Ctx["fulfilRequest"] = useCallback((id, resolvedBy, note) => {
    setData((d) => {
      const req = d.requests.find((r) => r.id === id);
      let entries = d.entries;
      if (req && req.amount > 0) {
        entries = [
          ...d.entries,
          {
            id: uid("JE"),
            date: new Date().toISOString().slice(0, 10),
            memo: `Internal request ${req.id} — ${req.title} (${req.fromDept}→${req.toDept})`,
            source: `Request ${req.id}`,
            lines: [
              { accountCode: "5000", debit: req.amount, credit: 0 },
              { accountCode: "2200", debit: 0, credit: req.amount },
            ],
          },
        ];
      }
      return {
        ...d,
        requests: d.requests.map((r) => (r.id === id ? { ...r, status: "Fulfilled" as RequestStatus, resolvedBy, resolvedAt: new Date().toISOString(), note: note ?? r.note } : r)),
        entries,
        notifications: [
          mkNote("Request fulfilled", req ? `${req.title}${req.amount > 0 ? ` — posted $${req.amount.toLocaleString()} to Finance` : ""}` : undefined, "requests", req?.fromUser ?? "all"),
          ...d.notifications,
        ],
      };
    });
  }, []);

  const resetAll: Ctx["resetAll"] = useCallback(() => setData(SEED), []);

  const value: Ctx = {
    ...data,
    hydrated,
    addEntry, importJournals, removeEntry, addLeave, setLeaveStatus, addClaim, setClaimStatus, addMessage, addChannel, addChannelMember, markAllRead, markNoteRead, notify, add, patch, remove, resetAll,
    raiseRequest, fulfilRequest, setRequestStatus, setMarket, setDigestDate, setChannelContext, addChannelInsight, publishReport,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppData(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
