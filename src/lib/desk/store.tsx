"use client";

// Minister's Desk — data store.
// One React context + localStorage (key below). Device-local by design for the
// demo: nothing is sent to Rulethu's servers. Real deployment moves this to a
// Zimbabwe-hosted database (see spec: data sovereignty).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const DESK_KEY = "mdesk-data-v1";

export type CStatus = "Not started" | "In progress" | "Done" | "Blocked";
export type Priority = "High" | "Medium" | "Low";
export interface Commitment {
  id: string;
  title: string;
  owner: string;
  due: string; // yyyy-mm-dd
  status: CStatus;
  priority: Priority;
  source: string; // "Cabinet", "Speech", "Meeting: …", "Investor"
  project?: string; // project id
  notes?: string;
  createdAt: string;
  doneAt?: string;
}
export interface Project {
  id: string;
  name: string;
  sector: string;
  lead: string;
  start: string;
  end: string;
  budget?: number; // USD m
  description?: string;
}
export interface DeskEvent {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:MM
  end: string;
  location?: string;
  kind: "Meeting" | "Cabinet" | "Travel" | "Event" | "Personal";
  with?: string; // counterpart(s)
  notes?: string;
  meetingId?: string; // recorded minutes
}
export interface ActionItem { text: string; owner: string; due: string }
export interface Meeting {
  id: string;
  title: string;
  date: string;
  attendees: string;
  transcript: string;
  summary: string;
  decisions: string[];
  actions: ActionItem[];
  minutesBy: "ai" | "offline" | "";
  eventId?: string;
  durationSec?: number;
  createdAt: string;
}
export type Stage = "Lead" | "MOU signed" | "Licensed" | "Funded" | "Operational";
export const STAGES: Stage[] = ["Lead", "MOU signed", "Licensed", "Funded", "Operational"];
export interface Deal {
  id: string;
  name: string;
  investor: string;
  country: string;
  sector: string;
  province: string;
  pledged: number; // USD m
  landed: number; // USD m
  jobs: number;
  stage: Stage;
  stageSince: string;
  blocker?: string;
}
export interface Draft { id: string; kind: string; title: string; body: string; createdAt: string }
export interface Pulse { label: string; value: string; change?: string; dir?: "up" | "down" | "flat"; note?: string }
export interface PulseSnap { at: string; items: Pulse[]; headline: string; news: { title: string; take: string; tone: "positive" | "neutral" | "critical" }[]; live: boolean }
export interface ChatMsg { role: "user" | "assistant"; content: string }

export interface DeskData {
  ownerName: string;
  commitments: Commitment[];
  projects: Project[];
  events: DeskEvent[];
  meetings: Meeting[];
  deals: Deal[];
  drafts: Draft[];
  pulse: PulseSnap | null;
  chat: ChatMsg[];
}

// ---------- dates ----------
export const todayISO = () => new Date().toISOString().slice(0, 10);
export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Seed relative to today so the demo always looks current.
function seed(): DeskData {
  const t = todayISO();
  return {
    ownerName: "Minister",
    projects: [
      { id: "P1", name: "Lithium beneficiation programme", sector: "Mining", lead: "Ministry of Mines / ZIDA", start: addDays(t, -60), end: addDays(t, 300), budget: 0, description: "Move from raw spodumene exports to local sulphate/carbonate processing." },
      { id: "P2", name: "Energy security 2030", sector: "Energy", lead: "Ministry of Energy / ZESA", start: addDays(t, -30), end: addDays(t, 1200), description: "End load-shedding: losses, Hwange refurbishment, solar + storage, solar geysers." },
      { id: "P3", name: "SEZ investor fast-track", sector: "Investment", lead: "ZIDA", start: addDays(t, -10), end: addDays(t, 180), description: "One-stop licensing within 30 days for SEZ investors." },
    ],
    commitments: [
      { id: "C1", title: "ZIDA to submit lithium processing report", owner: "ZIDA CEO", due: addDays(t, -3), status: "In progress", priority: "High", source: "Cabinet", project: "P1", createdAt: addDays(t, -20) },
      { id: "C2", title: "Present energy security options to Cabinet", owner: "Permanent Secretary", due: addDays(t, 4), status: "In progress", priority: "High", source: "Cabinet", project: "P2", createdAt: addDays(t, -14) },
      { id: "C3", title: "Respond to EU business delegation on investment protection", owner: "Director, Investment Promotion", due: addDays(t, 2), status: "Not started", priority: "Medium", source: "Investor", createdAt: addDays(t, -6) },
      { id: "C4", title: "Publish SEZ 30-day licensing charter", owner: "ZIDA", due: addDays(t, 12), status: "Not started", priority: "Medium", source: "Speech", project: "P3", createdAt: addDays(t, -9) },
      { id: "C5", title: "Site visit: Bikita lithium plant", owner: "Minister's Office", due: addDays(t, 9), status: "Not started", priority: "Low", source: "Meeting", project: "P1", createdAt: addDays(t, -4) },
      { id: "C6", title: "Solar geyser incentive proposal to Treasury", owner: "Energy Advisor", due: addDays(t, -1), status: "Blocked", priority: "High", source: "Meeting", project: "P2", notes: "Waiting on Treasury costing", createdAt: addDays(t, -12) },
      { id: "C7", title: "Launch provincial investment roadshow (Bulawayo)", owner: "Director, Investment Promotion", due: addDays(t, -8), status: "Done", priority: "Medium", source: "Speech", createdAt: addDays(t, -30), doneAt: addDays(t, -9) },
    ],
    events: [
      { id: "E1", title: "Cabinet", date: t, start: "09:00", end: "12:00", location: "Munhumutapa Building", kind: "Cabinet" },
      { id: "E2", title: "Meeting: Chinese lithium investors", date: t, start: "14:00", end: "15:00", location: "Ministry boardroom", kind: "Meeting", with: "Sinomine / Zhejiang Huayou delegation" },
      { id: "E3", title: "Courtesy call: EU Ambassador", date: t, start: "16:00", end: "16:45", location: "Ministry", kind: "Meeting", with: "EU Ambassador to Zimbabwe" },
      { id: "E4", title: "ZESA briefing on Hwange units", date: addDays(t, 1), start: "10:00", end: "11:00", location: "ZESA House", kind: "Meeting", with: "ZESA / ZPC management" },
      { id: "E5", title: "Investment conference keynote", date: addDays(t, 3), start: "09:30", end: "10:30", location: "HICC", kind: "Event" },
      { id: "E6", title: "Travel: Bulawayo", date: addDays(t, 6), start: "07:00", end: "18:00", kind: "Travel" },
    ],
    meetings: [],
    deals: [
      { id: "D1", name: "Lithium sulphate plant", investor: "Chinese consortium", country: "China", sector: "Mining", province: "Masvingo", pledged: 300, landed: 120, jobs: 900, stage: "Funded", stageSince: addDays(t, -40) },
      { id: "D2", name: "500 MW solar IPP", investor: "Gulf energy developer", country: "UAE", sector: "Energy", province: "Matabeleland North", pledged: 450, landed: 0, jobs: 600, stage: "MOU signed", stageSince: addDays(t, -130), blocker: "Power purchase agreement & forex guarantees" },
      { id: "D3", name: "Fertiliser plant", investor: "Regional agri group", country: "South Africa", sector: "Agriculture", province: "Mashonaland West", pledged: 220, landed: 15, jobs: 700, stage: "Licensed", stageSince: addDays(t, -60) },
      { id: "D4", name: "Pharmaceutical park", investor: "Indian pharma group", country: "India", sector: "Manufacturing", province: "Harare", pledged: 80, landed: 80, jobs: 450, stage: "Operational", stageSince: addDays(t, -200) },
      { id: "D5", name: "Tourism resort, Victoria Falls", investor: "European hospitality group", country: "Germany", sector: "Tourism", province: "Matabeleland North", pledged: 60, landed: 0, jobs: 400, stage: "Lead", stageSince: addDays(t, -20) },
      { id: "D6", name: "Platinum refinery", investor: "Joint venture", country: "Zimbabwe/Russia", sector: "Mining", province: "Midlands", pledged: 500, landed: 90, jobs: 1200, stage: "Licensed", stageSince: addDays(t, -150), blocker: "Power supply (100 MW) not yet secured" },
    ],
    drafts: [],
    pulse: null,
    chat: [],
  };
}

interface Ctx extends DeskData {
  hydrated: boolean;
  set: <K extends keyof DeskData>(k: K, v: DeskData[K] | ((prev: DeskData[K]) => DeskData[K])) => void;
  upsert: <K extends "commitments" | "projects" | "events" | "meetings" | "deals" | "drafts">(k: K, item: DeskData[K][number]) => void;
  remove: (k: "commitments" | "projects" | "events" | "meetings" | "deals" | "drafts", id: string) => void;
  resetDemo: () => void;
  exportJSON: () => string;
  importJSON: (s: string) => boolean;
}

const DeskCtx = createContext<Ctx | null>(null);

export function DeskProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DeskData>(() => seed());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DESK_KEY);
      if (raw) setData({ ...seed(), ...JSON.parse(raw) });
    } catch { /* storage unavailable — keep seed */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(DESK_KEY, JSON.stringify(data)); } catch { /* quota/private mode */ }
  }, [data, hydrated]);

  const set: Ctx["set"] = useCallback((k, v) => {
    setData((d) => ({ ...d, [k]: typeof v === "function" ? (v as (p: unknown) => unknown)(d[k]) : v }));
  }, []);
  const upsert: Ctx["upsert"] = useCallback((k, item) => {
    setData((d) => {
      const list = d[k] as { id: string }[];
      const i = list.findIndex((x) => x.id === (item as { id: string }).id);
      const next = i >= 0 ? list.map((x, j) => (j === i ? item : x)) : [item, ...list];
      return { ...d, [k]: next };
    });
  }, []);
  const remove: Ctx["remove"] = useCallback((k, id) => {
    setData((d) => ({ ...d, [k]: (d[k] as { id: string }[]).filter((x) => x.id !== id) }));
  }, []);
  const resetDemo = useCallback(() => setData(seed()), []);
  const exportJSON = useCallback(() => JSON.stringify(data, null, 2), [data]);
  const importJSON = useCallback((s: string) => {
    try { const p = JSON.parse(s); if (!p || !Array.isArray(p.commitments)) return false; setData({ ...seed(), ...p }); return true; } catch { return false; }
  }, []);

  const value = useMemo(() => ({ ...data, hydrated, set, upsert, remove, resetDemo, exportJSON, importJSON }), [data, hydrated, set, upsert, remove, resetDemo, exportJSON, importJSON]);
  return <DeskCtx.Provider value={value}>{children}</DeskCtx.Provider>;
}

export function useDesk() {
  const c = useContext(DeskCtx);
  if (!c) throw new Error("useDesk outside DeskProvider");
  return c;
}

// ---------- helpers ----------
export function isOverdue(c: Commitment, t = todayISO()) {
  return c.status !== "Done" && c.due < t;
}
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", opts);
}
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}
