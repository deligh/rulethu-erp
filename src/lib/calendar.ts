// Aggregates due-dates from across the ERP into one calendar feed.

import { TBill } from "./store";
import { computeTB } from "./tbills";
import { Task } from "./tasks";
import { Goal, LeaveRequest, PersonalEvent } from "./store";
import { PurchaseOrder } from "./seed";

export type EventType = "TB maturity" | "Coupon" | "Task" | "Leave" | "Goal" | "Payment" | "Payroll" | "Personal";
export interface CalEvent {
  id: string;
  date: string; // yyyy-mm-dd
  title: string;
  type: EventType;
  tone: "pos" | "neg" | "warn" | "beta" | "neutral";
  href: string;
  owner?: string; // whom it pertains to, for the "mine" filter
}

export const EVENT_TONE: Record<EventType, CalEvent["tone"]> = {
  "TB maturity": "neg",
  Coupon: "beta",
  Task: "warn",
  Leave: "neutral",
  Goal: "beta",
  Payment: "warn",
  Payroll: "pos",
  Personal: "pos",
};

interface Sources {
  tbills: TBill[];
  tasks: Task[];
  leave: LeaveRequest[];
  pos: PurchaseOrder[];
  goals: Goal[];
  personalEvents?: PersonalEvent[];
}

export function buildCalendarEvents(s: Sources): CalEvent[] {
  const out: CalEvent[] = [];
  const asOf = new Date();

  for (const tb of s.tbills) {
    out.push({ id: `${tb.id}-mat`, date: tb.maturityDate, title: `TB matures — ${tb.reference} (${tb.client})`, type: "TB maturity", tone: EVENT_TONE["TB maturity"], href: "/treasury" });
    const c = computeTB(tb, asOf);
    if (c.nextCouponDate && tb.couponRate > 0) out.push({ id: `${tb.id}-cpn`, date: c.nextCouponDate, title: `Coupon due — ${tb.reference}`, type: "Coupon", tone: EVENT_TONE.Coupon, href: "/treasury" });
  }
  for (const t of s.tasks) {
    if (t.status !== "Done") out.push({ id: `${t.id}-due`, date: t.end, title: `Task due — ${t.title}`, type: "Task", tone: EVENT_TONE.Task, href: "/programme/list" });
  }
  for (const l of s.leave) {
    if (l.status !== "Declined") {
      out.push({ id: `${l.id}-s`, date: l.start, title: `${l.employee} leave starts (${l.type})`, type: "Leave", tone: EVENT_TONE.Leave, href: "/hr/leave", owner: l.employee });
      out.push({ id: `${l.id}-e`, date: l.end, title: `${l.employee} leave ends`, type: "Leave", tone: EVENT_TONE.Leave, href: "/hr/leave", owner: l.employee });
    }
  }
  for (const p of s.pos) {
    if (p.status === "Received") out.push({ id: `${p.id}-pay`, date: p.receivedDate ?? p.date, title: `Pay vendor — ${p.vendor}`, type: "Payment", tone: EVENT_TONE.Payment, href: "/procurement/payments" });
  }
  for (const g of s.goals) {
    if (g.status !== "Done") out.push({ id: `${g.id}-goal`, date: g.targetDate, title: `${g.owner}: finish "${g.title}"`, type: "Goal", tone: EVENT_TONE.Goal, href: "/hr/goals", owner: g.owner });
  }
  for (const ev of s.personalEvents ?? []) {
    out.push({ id: ev.id, date: ev.date, title: ev.title, type: "Personal", tone: EVENT_TONE.Personal, href: "/calendar", owner: ev.owner });
  }
  // recurring payroll — last day of this and next 2 months
  const now = new Date();
  for (let k = 0; k < 3; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() + k + 1, 0);
    out.push({ id: `pay-${d.getFullYear()}-${d.getMonth()}`, date: d.toISOString().slice(0, 10), title: "Monthly payroll run", type: "Payroll", tone: EVENT_TONE.Payroll, href: "/hr/payroll" });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}
