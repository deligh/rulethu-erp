// People, tasks and the data behind the Project Management module.
// Anyone — including the bosses — can be an assignee.

import { ModuleKey } from "./modules";

export interface Person {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export const PEOPLE: Person[] = [
  { id: "u-ceo", name: "Takudzwa Mhlanga", role: "Chief Executive Officer", initials: "TM" },
  { id: "u-del", name: "Delight", role: "Investment Associate", initials: "DL" },
  { id: "u-ble", name: "Blessed", role: "Investment Associate", initials: "BL" },
  { id: "u-gam", name: "Gamu", role: "Investment Associate", initials: "GA" },
  { id: "u-res", name: "Research Desk", role: "Head of Research", initials: "RD" },
  { id: "u-fin", name: "Finance Team", role: "Finance", initials: "FT" },
];

export type TaskStatus = "Not started" | "In progress" | "Blocked" | "Review" | "Done";
export const TASK_STATUSES: TaskStatus[] = ["Not started", "In progress", "Blocked", "Review", "Done"];
export const STATUS_LABEL: Record<TaskStatus, string> = {
  "Not started": "To Do",
  "In progress": "In Progress",
  Blocked: "Blocked",
  Review: "In Review",
  Done: "Done",
};

export type Priority = "Low" | "Medium" | "High" | "Urgent";
export const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];
export const PRIORITY_TONE: Record<Priority, "neutral" | "info" | "warn" | "neg"> = {
  Low: "neutral",
  Medium: "info",
  High: "warn",
  Urgent: "neg",
};

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}
export interface TaskComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

export interface Task {
  id: string;
  title: string;
  module: ModuleKey;
  assigneeId: string;
  start: string; // ISO date
  end: string; // ISO date
  progress: number; // 0..1
  status: TaskStatus;
  priority: Priority;
  description?: string;
  checklist?: ChecklistItem[];
  comments?: TaskComment[];
}

export const TASKS: Task[] = [
  {
    id: "T-01", title: "Project Kestrel — valuation model", module: "investments", assigneeId: "u-del",
    start: "2026-09-08", end: "2026-09-22", progress: 0.6, status: "In progress", priority: "High",
    description: "Full valuation of the insurer (NAV, multiples, DCF). Pull financials from the data room and run the workbench.",
    checklist: [
      { id: "c1", text: "Load target financials", done: true },
      { id: "c2", text: "Build DCF assumptions", done: true },
      { id: "c3", text: "Peer multiples comparison", done: false },
      { id: "c4", text: "Draft recommendation", done: false },
    ],
    comments: [
      { id: "m1", author: "Blessed", text: "Use 17.5% WACC as the base case.", at: "2026-09-12T09:00:00Z" },
      { id: "m2", author: "Delight", text: "Agreed — scenario tab added.", at: "2026-09-13T10:30:00Z" },
    ],
  },
  { id: "T-02", title: "Solar IPP — IC memo pack", module: "investments", assigneeId: "u-ble", start: "2026-09-12", end: "2026-09-19", progress: 0.8, status: "Review", priority: "High" },
  { id: "T-03", title: "Dry-Port — due diligence", module: "investments", assigneeId: "u-gam", start: "2026-09-10", end: "2026-10-02", progress: 0.35, status: "In progress", priority: "Medium" },
  { id: "T-04", title: "Daily market report automation", module: "research", assigneeId: "u-res", start: "2026-09-01", end: "2026-09-30", progress: 0.5, status: "In progress", priority: "Medium" },
  { id: "T-05", title: "Weekly infrastructure note", module: "research", assigneeId: "u-gam", start: "2026-09-14", end: "2026-09-18", progress: 1.0, status: "Done", priority: "Low" },
  { id: "T-06", title: "August bank reconciliation", module: "finance", assigneeId: "u-fin", start: "2026-09-05", end: "2026-09-17", progress: 0.9, status: "In progress", priority: "High" },
  { id: "T-07", title: "Q3 board reporting pack", module: "finance", assigneeId: "u-fin", start: "2026-09-20", end: "2026-10-05", progress: 0.0, status: "Not started", priority: "Urgent" },
  { id: "T-08", title: "MFI portfolio-at-risk review", module: "microfinance", assigneeId: "u-del", start: "2026-09-15", end: "2026-09-25", progress: 0.2, status: "In progress", priority: "Medium" },
  { id: "T-09", title: "Bloomberg renewal — approval", module: "procurement", assigneeId: "u-ceo", start: "2026-09-10", end: "2026-09-16", progress: 1.0, status: "Done", priority: "Low" },
  { id: "T-10", title: "Alt. portfolio NAV refresh", module: "alternatives", assigneeId: "u-ble", start: "2026-09-22", end: "2026-10-08", progress: 0.0, status: "Not started", priority: "Medium" },
  { id: "T-11", title: "September payroll run", module: "hr", assigneeId: "u-fin", start: "2026-09-25", end: "2026-09-30", progress: 0.0, status: "Not started", priority: "High" },
  { id: "T-12", title: "IC sign-off — Solar IPP", module: "investments", assigneeId: "u-ceo", start: "2026-09-19", end: "2026-09-23", progress: 0.0, status: "Not started", priority: "Urgent" },
];

export function personById(id: string): Person | undefined {
  return PEOPLE.find((p) => p.id === id);
}

export const STATUS_TONE: Record<TaskStatus, "pos" | "warn" | "neg" | "beta" | "neutral"> = {
  "Not started": "neutral",
  "In progress": "beta",
  Blocked: "neg",
  Review: "warn",
  Done: "pos",
};

export interface ModuleProgress {
  module: ModuleKey;
  total: number;
  done: number;
  avgProgress: number;
  overdue: number;
}

export function moduleProgress(tasks: Task[], module: ModuleKey, asOf = new Date()): ModuleProgress {
  const list = tasks.filter((t) => t.module === module);
  const total = list.length;
  const done = list.filter((t) => t.status === "Done").length;
  const avgProgress = total ? list.reduce((s, t) => s + t.progress, 0) / total : 0;
  const overdue = list.filter((t) => t.progress < 1 && new Date(t.end) < asOf).length;
  return { module, total, done, avgProgress, overdue };
}

export function tasksForModule(tasks: Task[], module: ModuleKey): Task[] {
  return tasks.filter((t) => t.module === module);
}
