// Speech Builder engine: facts bank (live from the Desk), AI drafting and
// rewrites, talking points, fact check, and promise scanning. Every AI call has
// an offline fallback so the builder always produces something usable.

import { askClaude } from "@/lib/aiClient";
import type { DeskData } from "./store";
import { todayISO, addDays } from "./store";
import { ZW, THRESHOLDS, COUNTRIES } from "./economy";
import { SOLAR_COUNTRIES, wattsPerPerson, potential } from "@/lib/lab/solar";
import { parseDue } from "./ai";

export const OCCASIONS = ["Conference keynote", "Investor roundtable", "Ground-breaking / ribbon cutting", "Statement to Parliament", "Press conference", "Graduation / youth event", "Community meeting", "Bilateral dinner toast"];
export const TONES = ["Inspiring", "Formal", "Warm", "Firm", "Visionary"];
export const LENGTHS = [3, 5, 10, 15, 20];
export const WPM = 130; // comfortable speaking pace
export const GREETINGS: Record<string, string> = {
  None: "",
  Shona: "Mhoroi, vanamai nanababa.",
  Ndebele: "Salibonani, bomama labobaba.",
  "Shona + Ndebele": "Mhoroi. Salibonani. Vanamai nanababa, bomama labobaba.",
};

export interface Fact { id: string; group: string; text: string; source: string; nums: string[] }

const nums = (s: string) => (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => x.replace(/,/g, ""));

/** Facts the speech may use — built live from the Desk so the numbers match everything else. */
export function factsBank(d: DeskData): Fact[] {
  const f: Omit<Fact, "nums">[] = [];
  const pledged = d.deals.reduce((s, x) => s + x.pledged, 0), landed = d.deals.reduce((s, x) => s + x.landed, 0), jobs = d.deals.reduce((s, x) => s + x.jobs, 0);
  f.push({ id: "inv1", group: "Investment", text: `USD ${pledged.toLocaleString()} million of investment is pledged across ${d.deals.length} major projects, promising ${jobs.toLocaleString()} jobs.`, source: "Investment pipeline" });
  f.push({ id: "inv2", group: "Investment", text: `USD ${landed.toLocaleString()} million of that has already landed in Zimbabwe.`, source: "Investment pipeline" });
  for (const x of d.deals.filter((y) => y.stage === "Operational" || y.stage === "Funded").slice(0, 3))
    f.push({ id: `deal-${x.id}`, group: "Investment", text: `The ${x.name} in ${x.province} (${x.stage.toLowerCase()}) represents USD ${x.pledged} million and ${x.jobs.toLocaleString()} jobs.`, source: "Investment pipeline" });

  const done = d.commitments.filter((c) => c.status === "Done").slice(0, 4);
  for (const c of done) f.push({ id: `done-${c.id}`, group: "Delivered", text: `Delivered: ${c.title.replace(/^[a-z]/, (m) => m.toUpperCase())}.`, source: "Commitments tracker" });

  f.push({ id: "eco1", group: "Economy", text: `Zimbabwe's economy is about USD 44 billion, roughly USD ${ZW.gdpPc.toLocaleString()} per person.`, source: "ZIMSTAT rebased GDP (approx.)" });
  f.push({ id: "eco2", group: "Economy", text: `Upper-middle income status starts at about USD ${THRESHOLDS.upper.toLocaleString()} per person — our Vision 2030 destination.`, source: "World Bank thresholds FY2025" });
  f.push({ id: "eco3", group: "Economy", text: `Gold, platinum, tobacco and lithium make up over three-quarters of our exports.`, source: "Export mix ≈2024 (approx.)" });
  f.push({ id: "eco4", group: "Economy", text: `More than 60% of Zimbabweans are under 25 — a young nation ready to work.`, source: "ZIMSTAT census (approx.)" });
  const kr = COUNTRIES.find((c) => c.id === "kr")!;
  f.push({ id: "eco5", group: "World", text: `In 1960, South Korea's income per person was below ours; today it is about USD ${kr.gdpPc.toLocaleString()}, built on investment, skills and exports.`, source: "World Bank series (approx., verify)" });
  const bw = COUNTRIES.find((c) => c.id === "bw")!;
  f.push({ id: "eco6", group: "World", text: `Botswana turned diamonds into an upper-middle-income economy of about USD ${bw.gdpPc.toLocaleString()} per person by saving and investing its mineral wealth.`, source: "World Bank (approx.)" });

  const de = SOLAR_COUNTRIES.find((c) => c.id === "de")!, zw = SOLAR_COUNTRIES[0];
  f.push({ id: "sol1", group: "Energy", text: `A solar panel in Zimbabwe produces about ${(zw.yield / de.yield).toFixed(1)} times as much power as the same panel in Germany.`, source: "Global Solar Atlas-type yields" });
  f.push({ id: "sol2", group: "Energy", text: `Germany has about ${Math.round(wattsPerPerson(de) / wattsPerPerson(zw))} times more solar per person than Zimbabwe — the opportunity is ours to take.`, source: "IRENA/Ember-style estimates (approx.)" });
  const p = potential(0.1);
  f.push({ id: "sol3", group: "Energy", text: `Covering just 0.1% of our land with solar panels could generate about ${p.timesNational.toFixed(1)} times all the electricity Zimbabwe uses today.`, source: "Power Lab estimate" });
  f.push({ id: "pow1", group: "Energy", text: `Peak electricity demand is about 2,100 megawatts, and growing.`, source: "ZESA statements 2025 (approx.)" });
  return f.map((x) => ({ ...x, nums: nums(x.text) }));
}

export interface SpeechSpec {
  occasion: string; audience: string; minutes: number; tone: string; greeting: string;
  messages: string; story: string; cta: string; venue: string;
}

function systemPrompt(spec: SpeechSpec, facts: Fact[]) {
  const words = spec.minutes * WPM;
  return `You are the speechwriter for Zimbabwe's Minister of Economic Development. Write a speech to be READ ALOUD.
Occasion: ${spec.occasion}. Venue: ${spec.venue || "not specified"}. Audience: ${spec.audience || "general"}. Tone: ${spec.tone}. Length: about ${words} words (${spec.minutes} minutes at ${WPM} words per minute).
Rules:
- Short sentences, spoken rhythm, rule-of-three where natural; plain words. Address the audience directly.
- Use ONLY these facts for numbers (quote them faithfully). If a number is needed but not listed, write [figure]. Never invent statistics.
- Structure with these headings on their own lines: OPENING, WHY WE ARE HERE, OUR PROGRESS, THE OPPORTUNITY, OUR COMMITMENT, CLOSING.
- Mark natural pauses with [pause] (sparingly) and emphasis with *single asterisks* around a few key words.
${spec.greeting ? `- Begin the OPENING with this greeting exactly: "${spec.greeting}" then continue in English.` : ""}
- Protocol: open by acknowledging dignitaries generically ("Your Excellencies, distinguished guests, ladies and gentlemen") unless it's a community meeting.
FACTS YOU MAY USE:
${facts.map((x) => `- ${x.text} (${x.source})`).join("\n") || "- none selected"}`;
}

export async function draftSpeech(spec: SpeechSpec, facts: Fact[]): Promise<{ text: string; live: boolean }> {
  const text = await askClaude({
    system: systemPrompt(spec, facts),
    prompt: `Key messages:\n${spec.messages || "(choose suitable messages for the occasion)"}\n\nStory or example to include: ${spec.story || "(optional — use one from the facts if helpful)"}\n\nCall to action: ${spec.cta || "(choose one)"}\n\nWrite the full speech now.`,
    model: "sonnet", maxTokens: 4000, timeoutMs: 90000,
  });
  if (text) return { text, live: true };
  const pick = (g: string) => facts.filter((x) => x.group === g).map((x) => x.text).join(" ");
  const msgs = spec.messages.split(/\n|;/).map((s) => s.trim()).filter(Boolean);
  return {
    live: false,
    text: [
      `OPENING\n${spec.greeting ? spec.greeting + "\n" : ""}Your Excellencies, distinguished guests, ladies and gentlemen. It is an honour to be with you${spec.venue ? ` here at ${spec.venue}` : ""}.`,
      `WHY WE ARE HERE\nWe are here because Zimbabwe is open for business — and ready to grow. ${msgs[0] ?? ""}`,
      `OUR PROGRESS\n${pick("Investment")} ${pick("Delivered")}`.trim(),
      `THE OPPORTUNITY\n${pick("Energy")} ${pick("Economy")} ${msgs.slice(1).join(" ")}`.trim(),
      `OUR COMMITMENT\nGovernment will keep its word: predictable policy, faster licensing, and partnership with those who invest in our people.`,
      `CLOSING\n${spec.cta || "Let us build this future together."} [pause] Thank you.`,
    ].join("\n\n") + "\n\n[Offline draft — connect live AI for a fully written speech]",
  };
}

export const REWRITES: { id: string; label: string; instruction: string }[] = [
  { id: "shorter", label: "Make it shorter", instruction: "Cut it by about 30% while keeping every key message and the facts." },
  { id: "inspire", label: "More inspiring", instruction: "Make it more inspiring and memorable: stronger imagery, one repeated refrain, a rousing close." },
  { id: "simple", label: "Simpler words", instruction: "Use simpler, shorter words and sentences, suitable for a general audience and easy to translate live." },
  { id: "story", label: "Add a story", instruction: "Add one short, human story (a farmer, a young engineer, a factory worker) that illustrates the main message. Do not invent statistics." },
  { id: "close", label: "Stronger close", instruction: "Rewrite only the CLOSING to be powerful and quotable, ending with a clear call to action; keep the rest unchanged." },
  { id: "formal", label: "More formal", instruction: "Make the register more formal and diplomatic, suitable for Parliament or heads of state." },
];

export async function rewriteSpeech(text: string, instruction: string, facts: Fact[]): Promise<{ text: string; live: boolean }> {
  const out = await askClaude({
    system: `You edit speeches for Zimbabwe's Minister of Economic Development. Keep the same headings, [pause] marks and spoken style. Use only these facts for numbers; never invent statistics:\n${facts.map((x) => `- ${x.text}`).join("\n")}`,
    prompt: `Instruction: ${instruction}\n\nSpeech:\n${text}\n\nReturn the full revised speech only.`,
    model: "sonnet", maxTokens: 4000, timeoutMs: 90000,
  });
  return out ? { text: out, live: true } : { text, live: false };
}

export async function talkingPoints(text: string): Promise<{ text: string; live: boolean }> {
  const out = await askClaude({
    system: "Turn this speech into a one-page talking-points card for the Minister: a 1-line purpose, 5-7 short bullets (each under 15 words, with the key number if any), and 3 likely questions with one-line answers. Plain text, '- ' bullets, headings PURPOSE, POINTS, LIKELY QUESTIONS.",
    prompt: text, model: "haiku", maxTokens: 1500, timeoutMs: 30000,
  });
  if (out) return { text: out, live: true };
  const sents = text.replace(/\[pause\]|\*/g, "").split(/(?<=[.!?])\s+/).filter((s) => s.length > 40 && /\d|will|must|we/.test(s)).slice(0, 7);
  return { live: false, text: `POINTS\n${sents.map((s) => `- ${s.trim()}`).join("\n")}` };
}

/** Every number in the speech, checked against the facts bank. */
export function factCheck(text: string, facts: Fact[], trusted = "") {
  const bank = new Set([...facts.flatMap((f) => f.nums), ...nums(trusted)]); // facts bank + the Minister's own brief
  const found = new Map<string, { n: string; ok: boolean; context: string }>();
  const re = /\d[\d,]*(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = m[0].replace(/,/g, "");
    if (/^(19|20)\d\d$/.test(n) && +n > 1950) continue; // years
    if (+n <= 3 && !text.slice(m.index, m.index + 12).match(/%|times|billion|million/)) continue; // "one", list numbers
    const ctx = text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 40).replace(/\s+/g, " ").trim();
    if (!found.has(n + ctx)) found.set(n + ctx, { n: m[0], ok: bank.has(n), context: ctx });
  }
  const placeholders = (text.match(/\[figure\]/gi) ?? []).length;
  return { items: [...found.values()], placeholders };
}

export interface Promise_ { title: string; owner: string; due: string }
export async function scanPromises(text: string): Promise<{ items: Promise_[]; live: boolean }> {
  const out = await askClaude({
    system: `Extract every concrete promise or commitment the Minister makes in this speech (things Government will do). Today is ${todayISO()}. Return ONLY JSON: {"items": [{"title": "<imperative, max 12 words>", "owner": "<responsible body, or Minister's Office>", "due": "YYYY-MM-DD"}]}. If no date is stated use 90 days from today. Ignore vague aspirations.`,
    prompt: text, model: "haiku", maxTokens: 1500, timeoutMs: 30000,
  });
  if (out) {
    try { const j = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)); if (Array.isArray(j.items)) return { items: j.items, live: true }; } catch { /* fall through */ }
  }
  const items = text.replace(/\*/g, "").split(/(?<=[.!?])\s+/).filter((s) => /\b(we will|government will|i will|we shall|we commit)\b/i.test(s)).slice(0, 10)
    .map((s) => ({ title: s.replace(/^.*?\b(will|shall|commit to)\b\s*/i, "").replace(/[.!]$/, "").slice(0, 90).replace(/^./, (c) => c.toUpperCase()), owner: "Minister's Office", due: parseDue(s) ?? addDays(todayISO(), 90) }));
  return { items, live: false };
}

export function wordCount(t: string) {
  return t.replace(/\[pause\]/gi, "").split(/\s+/).filter((w) => /\w/.test(w) && !/^[A-Z ']{4,}$/.test(w)).length;
}
