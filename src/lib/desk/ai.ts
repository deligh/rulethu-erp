// Minister's Desk — AI helpers. Every function tries live Claude (secure proxy)
// and falls back to a deterministic offline version, so the Desk always works.

import { askClaude, type AiMsg } from "@/lib/aiClient";
import type { ActionItem, ChatMsg, Commitment, DeskData, DeskEvent, Priority, PulseSnap } from "./store";
import { addDays, todayISO, isOverdue, fmtDate } from "./store";

function json<T>(text: string | null): T | null {
  if (!text) return null;
  try { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as T; } catch { return null; }
}

// ---------- dates in plain English ----------
const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseDue(text: string, base = todayISO()): string | null {
  const s = text.toLowerCase();
  if (/\btoday\b|\bby close of business\b|\bcob\b/.test(s)) return base;
  if (/\btomorrow\b/.test(s)) return addDays(base, 1);
  if (/\bnext week\b/.test(s)) return addDays(base, 7);
  if (/\bend of (the )?month\b/.test(s)) { const d = new Date(base + "T12:00:00"); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10); }
  const inN = s.match(/\bin (\d+) (day|week|month)s?\b/);
  if (inN) return addDays(base, +inN[1] * (inN[2] === "week" ? 7 : inN[2] === "month" ? 30 : 1));
  const dow = DOW.findIndex((d) => new RegExp(`\\b${d}\\b`).test(s));
  if (dow >= 0) { const cur = new Date(base + "T12:00:00").getDay(); let n = (dow - cur + 7) % 7; if (n === 0) n = 7; return addDays(base, n); }
  const dm = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/) || s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/);
  if (dm) {
    const day = +(isNaN(+dm[1]) ? dm[2] : dm[1]);
    const mon = MON.indexOf((isNaN(+dm[1]) ? dm[1] : dm[2]).slice(0, 3));
    const y = new Date(base).getFullYear();
    let d = new Date(y, mon, day, 12);
    if (d.toISOString().slice(0, 10) < base) d = new Date(y + 1, mon, day, 12);
    return d.toISOString().slice(0, 10);
  }
  const iso = s.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso ? iso[1] : null;
}

// ---------- quick-capture a commitment ----------
export interface ParsedCommitment { title: string; owner: string; due: string; priority: Priority }
export function parseCommitmentOffline(text: string): ParsedCommitment {
  const t = text.trim().replace(/\s+/g, " ");
  let owner = "Minister's Office", title = t;
  const tell = t.match(/^(?:tell|ask|instruct|remind|get)\s+(.+?)\s+to\s+(.+)$/i);
  const xto = t.match(/^([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})\s+(?:to|must|should|will)\s+(.+)$/);
  if (tell) { owner = tell[1]; title = tell[2]; } else if (xto) { owner = xto[1]; title = xto[2]; }
  const due = parseDue(t) ?? addDays(todayISO(), 7);
  title = title.replace(/\s+(by|before|on|within)\s+(today|tomorrow|next week|end of (the )?month|in \d+ \w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(st|nd|rd|th)? \w+|\w+ \d{1,2})\.?$/i, "");
  title = title.charAt(0).toUpperCase() + title.slice(1);
  const priority: Priority = /urgent|asap|immediately|critical|cabinet|president/i.test(t) ? "High" : /when possible|low priority/i.test(t) ? "Low" : "Medium";
  return { title, owner, due, priority };
}
export async function parseCommitment(text: string): Promise<ParsedCommitment & { live: boolean }> {
  const off = parseCommitmentOffline(text);
  const r = json<ParsedCommitment>(await askClaude({
    system: `Turn a Minister's spoken instruction into a task. Today is ${todayISO()} (${DOW[new Date().getDay()]}). Return ONLY JSON: {"title": "<imperative, max 12 words>", "owner": "<person or body responsible>", "due": "YYYY-MM-DD", "priority": "High"|"Medium"|"Low"}. If no date is given, use 7 days from today. If no owner, use "Minister's Office".`,
    prompt: text, model: "haiku", maxTokens: 1000, timeoutMs: 20000,
  }));
  if (r && r.title && /^\d{4}-\d{2}-\d{2}$/.test(r.due)) return { ...off, ...r, live: true };
  return { ...off, live: false };
}

// ---------- meeting minutes from a transcript ----------
export interface Minutes { summary: string; decisions: string[]; actions: ActionItem[]; live: boolean }
export function minutesOffline(transcript: string): Minutes {
  const sentences = transcript.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
  const decisions = sentences.filter((s) => /\b(agreed|decided|resolved|approved|we will go with|consensus)\b/i.test(s)).slice(0, 8);
  const actions: ActionItem[] = sentences
    .filter((s) => /\b(will|to send|to submit|to prepare|action|follow up|by (monday|tuesday|wednesday|thursday|friday|next week|tomorrow|end of))\b/i.test(s) && !decisions.includes(s))
    .slice(0, 10)
    .map((s) => { const p = parseCommitmentOffline(s); const who = s.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|to)\b/); return { text: p.title, owner: who ? who[1] : p.owner, due: p.due }; });
  const summary = sentences.slice(0, 3).join(" ") || "No transcript captured.";
  return { summary, decisions, actions, live: false };
}
export async function minutesFromTranscript(title: string, attendees: string, transcript: string): Promise<Minutes> {
  if (!transcript.trim()) return { summary: "", decisions: [], actions: [], live: false };
  const r = json<Omit<Minutes, "live">>(await askClaude({
    system: `You are the private secretary to Zimbabwe's Minister of Economic Development. Write formal meeting minutes from a raw (possibly messy, speech-to-text) transcript. Today is ${todayISO()}.
Return ONLY JSON: {"summary": "<4-6 sentence summary in plain formal English>", "decisions": ["<decision>", ...], "actions": [{"text": "<action, imperative>", "owner": "<who>", "due": "YYYY-MM-DD"}, ...]}
Do not invent facts that are not in the transcript. If an owner or date isn't stated, use "TBC" and a date 7 days from today.`,
    prompt: `Meeting: ${title}\nAttendees: ${attendees || "not recorded"}\n\nTranscript:\n${transcript.slice(0, 24000)}`,
    model: "sonnet", maxTokens: 3000, timeoutMs: 60000,
  }));
  if (r && typeof r.summary === "string") return { summary: r.summary, decisions: r.decisions ?? [], actions: (r.actions ?? []).map((a) => ({ text: a.text, owner: a.owner || "TBC", due: /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : addDays(todayISO(), 7) })), live: true };
  return minutesOffline(transcript);
}

// ---------- meeting brief ----------
export async function meetingBrief(ev: DeskEvent, d: DeskData, research: boolean): Promise<{ text: string; live: boolean }> {
  const counterpart = ev.with || ev.title;
  const related = d.commitments.filter((c) => c.status !== "Done" && (c.title + c.owner + c.source).toLowerCase().split(/\W+/).some((w) => w.length > 4 && counterpart.toLowerCase().includes(w))).slice(0, 5);
  const past = d.meetings.filter((m) => (m.title + m.attendees).toLowerCase().includes(counterpart.toLowerCase().split(" ")[0])).slice(0, 3);
  const deals = d.deals.filter((x) => counterpart.toLowerCase().includes(x.country.toLowerCase().split("/")[0]) || counterpart.toLowerCase().includes(x.investor.toLowerCase().split(" ")[0]));
  const ctx = [
    related.length ? `Open commitments possibly related:\n${related.map((c) => `- ${c.title} (${c.owner}, due ${c.due}, ${c.status})`).join("\n")}` : "",
    past.length ? `Previous meetings:\n${past.map((m) => `- ${m.date} ${m.title}: ${m.summary.slice(0, 300)}`).join("\n")}` : "",
    deals.length ? `Investment pipeline items:\n${deals.map((x) => `- ${x.name}: ${x.stage}, pledged USD ${x.pledged}m, landed USD ${x.landed}m${x.blocker ? `, blocker: ${x.blocker}` : ""}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const text = await askClaude({
    system: `You prepare one-page meeting briefs for Zimbabwe's Minister of Economic Development. Plain English, short. Sections with these exact headings on their own lines: WHO THEY ARE, WHAT WE WANT, HISTORY & CONTEXT, TALKING POINTS (3 numbered), WATCH OUT FOR, THE ASK. Under 300 words. Only state facts you are confident of; mark anything uncertain "(verify)".`,
    prompt: `Meeting: ${ev.title}\nWith: ${counterpart}\nWhen: ${ev.date} ${ev.start}\nWhere: ${ev.location ?? ""}\nNotes: ${ev.notes ?? ""}\n\nFrom the Minister's Desk:\n${ctx || "No prior records."}`,
    model: "sonnet", maxTokens: 3000, webSearch: research, searchMaxUses: research ? 3 : undefined, timeoutMs: research ? 110000 : 45000,
  });
  if (text) return { text, live: true };
  return {
    live: false,
    text: [
      `WHO THEY ARE\n${counterpart}. (Connect live AI for a researched profile.)`,
      `WHAT WE WANT\nAgree concrete next steps with owners and dates.`,
      `HISTORY & CONTEXT\n${ctx || "No previous meetings or commitments on record."}`,
      `TALKING POINTS\n1. Zimbabwe's investment offer: SEZ incentives, 30-day licensing.\n2. Progress on items above.\n3. What support they need from Government.`,
      `WATCH OUT FOR\nRequests for guarantees or exemptions beyond policy.`,
      `THE ASK\nA dated commitment for the next milestone.`,
    ].join("\n\n"),
  };
}

// ---------- drafter ----------
export const DRAFT_KINDS = ["Speech", "Press statement", "Cabinet memo", "Letter", "Talking points", "Social media post"];
export async function draftDocument(kind: string, brief: string, d: DeskData): Promise<{ text: string; live: boolean }> {
  const facts = [
    `Open commitments: ${d.commitments.filter((c) => c.status !== "Done").length}; overdue: ${d.commitments.filter((c) => isOverdue(c)).length}.`,
    `Pipeline: pledged USD ${d.deals.reduce((s, x) => s + x.pledged, 0)}m, landed USD ${d.deals.reduce((s, x) => s + x.landed, 0)}m, jobs ${d.deals.reduce((s, x) => s + x.jobs, 0)}.`,
  ].join(" ");
  const text = await askClaude({
    system: `You draft for Zimbabwe's Minister of Economic Development. Write a ${kind}. Formal, warm, confident, plain English; Zimbabwean context. Do not invent statistics: use only numbers in the brief or the Desk facts, and write [figure] where a number is needed but not given. Start directly with the text (a title line first).`,
    prompt: `Brief: ${brief}\n\nDesk facts you may use: ${facts}`,
    model: "sonnet", maxTokens: 3500, timeoutMs: 60000,
  });
  if (text) return { text, live: true };
  return { live: false, text: `${kind.toUpperCase()}\n\n[Offline draft — connect live AI for a full draft]\n\nSubject: ${brief}\n\nKey messages:\n1. Government's commitment to an investor-friendly, stable economy.\n2. Progress to date: ${facts}\n3. Next steps and call to action.\n\n[Closing]` };
}

// ---------- Ask the Desk ----------
export function deskSnapshot(d: DeskData): string {
  const t = todayISO();
  const ev = d.events.filter((e) => e.date >= t && e.date <= addDays(t, 7)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const open = d.commitments.filter((c) => c.status !== "Done");
  return [
    `Today: ${t}.`,
    `Next 7 days of calendar:\n${ev.map((e) => `- ${e.date} ${e.start}-${e.end} ${e.title}${e.with ? ` (with ${e.with})` : ""}${e.location ? ` @ ${e.location}` : ""}`).join("\n") || "- nothing"}`,
    `Open commitments (${open.length}):\n${open.map((c) => `- [${isOverdue(c) ? "OVERDUE" : c.status}] ${c.title} — ${c.owner}, due ${c.due}, ${c.priority}`).join("\n")}`,
    `Projects: ${d.projects.map((p) => p.name).join("; ")}`,
    `Investment pipeline:\n${d.deals.map((x) => `- ${x.name} (${x.investor}, ${x.country}): ${x.stage}, pledged ${x.pledged}m, landed ${x.landed}m, ${x.jobs} jobs${x.blocker ? `, blocker: ${x.blocker}` : ""}`).join("\n")}`,
    `Recent meetings:\n${d.meetings.slice(0, 5).map((m) => `- ${m.date} ${m.title}: ${m.summary.slice(0, 200)}`).join("\n") || "- none recorded"}`,
  ].join("\n\n");
}
export async function askDesk(history: ChatMsg[], d: DeskData): Promise<{ text: string; live: boolean }> {
  const msgs: AiMsg[] = history.slice(-12).map((m) => ({ role: m.role, content: m.content }));
  const text = await askClaude({
    system: `You are the chief of staff AI inside "Minister's Desk" for Zimbabwe's Minister of Economic Development. Answer briefly and precisely from the Desk data below; for economic what-if calculations, say which Economic Lab to open (Power, Fuel, Food, Mining, Projects, Incentives, Jobs) at /lab. Never invent figures. Plain text, short bullets where useful.\n\nDESK DATA:\n${deskSnapshot(d)}`,
    messages: msgs, model: "haiku", maxTokens: 1500, timeoutMs: 30000,
  });
  if (text) return { text, live: true };
  const q = (history.at(-1)?.content ?? "").toLowerCase();
  const t = todayISO();
  if (/overdue|late|behind/.test(q)) { const o = d.commitments.filter((c) => isOverdue(c)); return { live: false, text: o.length ? `Overdue (${o.length}):\n${o.map((c) => `• ${c.title} — ${c.owner}, due ${fmtDate(c.due)}`).join("\n")}` : "Nothing is overdue." }; }
  if (/today|schedule|calendar|meeting/.test(q)) { const e = d.events.filter((x) => x.date === t); return { live: false, text: e.length ? `Today:\n${e.map((x) => `• ${x.start} ${x.title}${x.location ? ` — ${x.location}` : ""}`).join("\n")}` : "Nothing on the calendar today." }; }
  if (/invest|pipeline|pledge|deal/.test(q)) { const p = d.deals.reduce((s, x) => s + x.pledged, 0), l = d.deals.reduce((s, x) => s + x.landed, 0); return { live: false, text: `Pipeline: USD ${p}m pledged, USD ${l}m landed (${Math.round((l / p) * 100)}%). Stuck: ${d.deals.filter((x) => x.blocker).map((x) => `${x.name} (${x.blocker})`).join("; ") || "none"}.` }; }
  if (/power|solar|fuel|maize|lithium|npv|jobs|tax/.test(q)) return { live: false, text: "That's a calculation — open the Economic Lab (Lab in the menu) and ask it there; it runs the numbers with sliders and shows its working." };
  return { live: false, text: "Offline mode: I can list today's schedule, overdue commitments or the investment pipeline. Connect live AI for full answers." };
}

// ---------- Economy pulse (live web search) ----------
export async function fetchPulse(): Promise<PulseSnap> {
  const text = await askClaude({
    system: `You produce the 6:30am economy pulse for Zimbabwe's Minister of Economic Development. Use web search for the LATEST figures. Return ONLY JSON:
{"headline": "<one sentence: the most important economic development today>", "items": [{"label": "...", "value": "...", "change": "<e.g. +0.4% or n/a>", "dir": "up"|"down"|"flat", "note": "<source, date>"}], "news": [{"title": "<headline>", "take": "<one line: why it matters to the Minister>", "tone": "positive"|"neutral"|"critical"}]}
Items, in order: ZiG official rate (per USD), ZiG inflation (latest month), Diesel pump price (ZERA), Gold (USD/oz), Platinum (USD/oz), Lithium carbonate (USD/t). 3-5 news items about Zimbabwe's economy, investment, mining or energy from the last few days.`,
    prompt: "Produce today's pulse now. Do at most 3 web searches, then return only the JSON.",
    webSearch: true, searchMaxUses: 3, maxTokens: 3500, timeoutMs: 115000,
  });
  const r = json<Omit<PulseSnap, "at" | "live">>(text);
  if (r && Array.isArray(r.items) && r.items.length) return { ...r, news: r.news ?? [], at: new Date().toISOString(), live: true };
  return {
    at: new Date().toISOString(), live: false,
    headline: "Sample pulse — tap Refresh with live AI connected for today's real figures.",
    items: [
      { label: "ZiG official rate", value: "≈ 26.5 / USD", change: "n/a", dir: "flat", note: "sample" },
      { label: "ZiG inflation (m/m)", value: "≈ 0.5%", change: "n/a", dir: "flat", note: "sample" },
      { label: "Diesel pump price", value: "≈ USD 1.50/L", change: "n/a", dir: "flat", note: "sample" },
      { label: "Gold", value: "≈ USD 3,800/oz", change: "n/a", dir: "up", note: "sample" },
      { label: "Platinum", value: "≈ USD 1,500/oz", change: "n/a", dir: "flat", note: "sample" },
      { label: "Lithium carbonate", value: "≈ USD 11,000/t", change: "n/a", dir: "flat", note: "sample" },
    ],
    news: [],
  };
}

export function overdueSummary(cs: Commitment[]) {
  return cs.filter((c) => isOverdue(c)).sort((a, b) => a.due.localeCompare(b.due));
}
