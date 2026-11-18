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
- Use ONLY these facts, plus the Minister's own key messages and call to action (approved policy content), for numbers and factual claims (quote them faithfully). If a number is needed but not listed, write [figure]. Never invent statistics, people, quotations or events; any story must be clearly illustrative ("Imagine a young engineer…") unless the Minister supplied it.
- Structure with these headings on their own lines: OPENING, WHY WE ARE HERE, OUR PROGRESS, THE OPPORTUNITY, OUR COMMITMENT, CLOSING.
- Mark natural pauses with [pause] (sparingly) and emphasis with *single asterisks* around a few key words.
${spec.greeting ? `- Begin the OPENING with this greeting exactly: "${spec.greeting}" then continue in English.` : ""}
- Protocol: open by acknowledging dignitaries generically ("Your Excellencies, distinguished guests, ladies and gentlemen") unless it's a community meeting.
FACTS YOU MAY USE:
${facts.map((x) => `- ${x.text} (${x.source})`).join("\n") || "- none selected"}`;
}

export async function draftSpeech(spec: SpeechSpec, facts: Fact[], angle?: string): Promise<{ text: string; live: boolean }> {
  const text = await askClaude({
    system: systemPrompt(spec, facts) + (angle ? `\nCREATIVE ANGLE FOR THIS VERSION: ${angle}` : ""),
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

function parseJson<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)) as T; } catch { return null; }
}

// ======================= BEST SPEECH: 3 drafts → judge → polish =======================
export const ANGLES = [
  { id: "vision", name: "Visionary", brief: "Paint a vivid picture of Zimbabwe in 2030; big, hopeful imagery; a memorable repeated refrain; emotional but credible." },
  { id: "evidence", name: "Evidence-led", brief: "Lead with the strongest facts and concrete delivery; crisp, confident, businesslike; every claim anchored in the facts; persuade sceptical investors." },
  { id: "story", name: "Story-led", brief: "Open and close with a short human story that carries the message (no invented statistics); warm, personal, and relatable." },
];
export const CRITERIA = [
  { key: "clarity", label: "Clarity" },
  { key: "memorability", label: "Memorability" },
  { key: "structure", label: "Structure & flow" },
  { key: "audience", label: "Fit for audience" },
  { key: "accuracy", label: "Factual discipline" },
  { key: "delivery", label: "Easy to deliver" },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];
export interface Candidate { angle: string; name: string; text: string; scores: Record<CriterionKey, number>; total: number; strength: string; weakness: string }
export interface BestResult { final: string; candidates: Candidate[]; winner: number; why: string; improvements: string[]; live: boolean }

export async function bestSpeech(spec: SpeechSpec, facts: Fact[], onStep: (s: string) => void): Promise<BestResult> {
  onStep("Writing three competing versions…");
  const drafts = await Promise.all(ANGLES.map((a) => draftSpeech(spec, facts, a.brief)));
  if (!drafts.some((d) => d.live)) {
    return { final: drafts[0].text, candidates: [], winner: 0, why: "Offline mode — connect live AI to compare versions.", improvements: [], live: false };
  }
  onStep("The judge is scoring each version…");
  const judge = parseJson<{ scores: (Record<CriterionKey, number> & { strength: string; weakness: string })[]; winner: number; why: string; improvements: string[] }>(await askClaude({
    system: `You are a panel of three expert speech coaches judging drafts for Zimbabwe's Minister of Economic Development. Occasion: ${spec.occasion}; audience: ${spec.audience}; target ${spec.minutes} minutes (${spec.minutes * WPM} words).
Score each draft 0-10 on: clarity, memorability, structure, audience, accuracy (uses only the allowed facts and the Minister's approved brief, no invented numbers, people or events), delivery (easy to say aloud, good rhythm, right length).
Allowed facts:\n${facts.map((f) => `- ${f.text}`).join("\n")}
Minister's approved brief (key messages and call to action — NOT unsupported claims):\n${spec.messages}\nCall to action: ${spec.cta}${spec.story ? `\nStory supplied by the Minister: ${spec.story}` : ""}
Return ONLY JSON: {"scores":[{"clarity":n,"memorability":n,"structure":n,"audience":n,"accuracy":n,"delivery":n,"strength":"<one line>","weakness":"<one line>"}, ...in draft order], "winner": <0-based index>, "why": "<two sentences>", "improvements": ["<specific improvement to make to the winner, borrowing the best lines from the others>", ...up to 5]}`,
    prompt: drafts.map((d, i) => `=== DRAFT ${i} (${ANGLES[i].name}) ===\n${d.text}`).join("\n\n"),
    model: "sonnet", maxTokens: 3000, timeoutMs: 90000,
  }));
  const scores = judge?.scores ?? drafts.map(() => ({ clarity: 7, memorability: 7, structure: 7, audience: 7, accuracy: 7, delivery: 7, strength: "", weakness: "" }));
  const candidates: Candidate[] = drafts.map((d, i) => {
    const s = scores[i] ?? scores[0];
    const sc = Object.fromEntries(CRITERIA.map((c) => [c.key, Math.max(0, Math.min(10, Number(s[c.key]) || 0))])) as Record<CriterionKey, number>;
    return { angle: ANGLES[i].id, name: ANGLES[i].name, text: d.text, scores: sc, total: Object.values(sc).reduce((a, b) => a + b, 0), strength: s.strength ?? "", weakness: s.weakness ?? "" };
  });
  const winner = judge && Number.isInteger(judge.winner) && candidates[judge.winner] ? judge.winner : candidates.reduce((bi, c, i, arr) => (c.total > arr[bi].total ? i : bi), 0);
  onStep("Polishing the winner with the best lines from the others…");
  const polished = await askClaude({
    system: systemPrompt(spec, facts) + `\nYou are polishing the winning draft into the final speech. Keep its angle and structure. Apply these improvements, borrowing the strongest lines from the other drafts where they fit:\n${(judge?.improvements ?? []).map((x) => `- ${x}`).join("\n")}\nReturn the full final speech only.`,
    prompt: `WINNING DRAFT (${candidates[winner].name}):\n${candidates[winner].text}\n\nOTHER DRAFTS (for borrowing lines):\n${candidates.filter((_, i) => i !== winner).map((c) => `--- ${c.name} ---\n${c.text}`).join("\n\n")}`,
    model: "sonnet", maxTokens: 4000, timeoutMs: 90000,
  });
  return { final: polished ?? candidates[winner].text, candidates, winner, why: judge?.why ?? "", improvements: judge?.improvements ?? [], live: true };
}

// ======================= VALIDATION =======================
export type Level = "pass" | "warn" | "fail";
export interface Check { id: string; label: string; level: Level; detail: string }
export interface Claim { claim: string; status: "supported" | "general" | "unsupported" | "risky"; note: string; fix?: string; source?: string }
export interface Validation {
  score: number; verdict: string; checks: Check[]; claims: Claim[]; risks: string[];
  coverage: { message: string; covered: boolean }[]; numbers: ReturnType<typeof factCheck>;
  longSentences: string[]; aiLive: boolean; web: boolean;
}

export function sentences(t: string) {
  return t.replace(/\[pause\]/gi, " ").replace(/\*/g, "").split(/\n+/).filter((l) => !/^[A-Z][A-Z '&]{3,}$/.test(l.trim())).join(" ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 2);
}

export async function validateSpeech(text: string, spec: SpeechSpec, facts: Fact[], web: boolean): Promise<Validation> {
  const checks: Check[] = [];
  const msgs = spec.messages.split(/\n|;/).map((s) => s.trim()).filter(Boolean);
  // 1. Numbers
  const numbers = factCheck(text, facts, `${spec.messages} ${spec.story} ${spec.cta}`);
  const bad = numbers.items.filter((x) => !x.ok).length;
  checks.push({ id: "nums", label: "Every number traced to a fact", level: bad || numbers.placeholders ? (bad > 1 ? "fail" : "warn") : "pass", detail: bad || numbers.placeholders ? `${bad} number(s) not in the facts bank${numbers.placeholders ? `, ${numbers.placeholders} [figure] placeholder(s) to fill` : ""}.` : `${numbers.items.length} numbers checked — all match the facts bank or your brief.` });
  // 2. Timing
  const w = wordCount(text), mins = w / WPM, dev = Math.abs(mins - spec.minutes) / spec.minutes;
  checks.push({ id: "time", label: "Fits the time slot", level: dev <= 0.15 ? "pass" : dev <= 0.3 ? "warn" : "fail", detail: `≈ ${mins.toFixed(1)} min (${w} words) for a ${spec.minutes}-minute slot.` });
  // 3. Readability
  const ss = sentences(text);
  const avg = ss.length ? ss.reduce((a, s) => a + s.split(/\s+/).length, 0) / ss.length : 0;
  const longSentences = ss.filter((s) => s.split(/\s+/).length > 28);
  checks.push({ id: "read", label: "Easy to say aloud", level: avg <= 18 && longSentences.length <= 1 ? "pass" : avg <= 22 ? "warn" : "fail", detail: `Average ${avg.toFixed(0)} words per sentence; ${longSentences.length} very long sentence(s).` });
  // 4. Protocol + CTA + greeting
  const lower = text.toLowerCase();
  const protocol = /excellenc|distinguished|ladies and gentlemen|honourable|fellow/.test(lower) || spec.occasion === "Community meeting";
  checks.push({ id: "protocol", label: "Protocol and acknowledgements", level: protocol ? "pass" : "warn", detail: protocol ? "Opening acknowledges the audience correctly." : "Add the customary acknowledgement of dignitaries." });
  if (spec.greeting) checks.push({ id: "greet", label: "Local-language greeting", level: text.includes(spec.greeting.split(".")[0]) ? "pass" : "warn", detail: text.includes(spec.greeting.split(".")[0]) ? "Greeting included." : "The chosen greeting is missing." });
  const ctaWords = spec.cta.toLowerCase().split(/\W+/).filter((x) => x.length > 4);
  const closing = lower.slice(Math.floor(lower.length * 0.7));
  const ctaOk = !spec.cta || ctaWords.filter((x) => closing.includes(x)).length >= Math.min(2, ctaWords.length);
  checks.push({ id: "cta", label: "Clear call to action at the end", level: ctaOk ? "pass" : "warn", detail: ctaOk ? "The close carries your call to action." : "Your call to action isn't clearly in the closing." });

  // 5. AI: claims, key-message coverage, risks (optionally verified on the web)
  const sys = `You are the fact-checker and communications risk adviser for Zimbabwe's Minister of Economic Development. Check a speech before delivery. Be concise.
Return ONLY compact JSON (no markdown): {"claims":[{"claim":"<max 12 words>","status":"supported"|"general"|"unsupported"|"risky","note":"<max 15 words>","fix":"<safer wording, only if not supported>","source":"<url, only if verified on the web>"}], "coverage":[{"message":"<key message>","covered":true|false}], "risks":["<max 25 words>"]}
- "supported" = matches the facts bank OR the Minister's own brief/key messages/call to action below (his policy commitments are approved content). "general" = widely accepted, low risk. "unsupported" = specific factual claim not backed by either. "risky" = likely wrong, exaggerated or sensitive.
- List the specific factual claims (numbers, comparisons, history, achievements), max 12. ${web ? "Use web search to verify the most important claims that are NOT in the facts bank (max 3 searches) and give the source URL." : "Do not use outside sources beyond common knowledge."}
- Risks: only MATERIAL risks (could be misquoted, overpromises, diplomatically sensitive, factually shaky). Max 4. No style suggestions. Empty list if none.
FACTS BANK:\n${facts.map((f) => `- ${f.text} (${f.source})`).join("\n")}
MINISTER'S BRIEF / KEY MESSAGES (approved):\n${msgs.map((m) => `- ${m}`).join("\n")}\nStory: ${spec.story || "-"}\nCall to action: ${spec.cta || "-"}`;
  type AiCheck = { claims: Claim[]; coverage: { message: string; covered: boolean }[]; risks: string[] };
  let ai = parseJson<AiCheck>(await askClaude({ system: sys, prompt: text, model: "sonnet", maxTokens: 4096, webSearch: web, searchMaxUses: web ? 3 : undefined, timeoutMs: web ? 115000 : 75000 }));
  if (!ai || !Array.isArray(ai.claims)) ai = parseJson<AiCheck>(await askClaude({ system: sys, prompt: text, model: "haiku", maxTokens: 4096, timeoutMs: 45000 }));
  if (ai && !Array.isArray(ai.claims)) ai = null;
  const claims = ai?.claims ?? [];
  const coverage = ai?.coverage?.length ? ai.coverage : msgs.map((m) => ({ message: m, covered: m.toLowerCase().split(/\W+/).filter((x) => x.length > 4).some((x) => lower.includes(x)) }));
  const risks = ai?.risks ?? [];
  const unsup = claims.filter((c) => c.status === "unsupported" || c.status === "risky").length;
  if (ai) checks.push({ id: "claims", label: "Factual claims", level: unsup === 0 ? "pass" : unsup <= 1 ? "warn" : "fail", detail: unsup === 0 ? `${claims.length} claims checked — all supported or safe.` : `${unsup} of ${claims.length} claims need attention.` });
  const missed = coverage.filter((c) => !c.covered).length;
  checks.push({ id: "cover", label: "All key messages delivered", level: missed === 0 ? "pass" : "warn", detail: missed === 0 ? `All ${coverage.length} key messages are in the speech.` : `${missed} key message(s) missing.` });
  if (ai) checks.push({ id: "risk", label: "Communications risk", level: risks.length === 0 ? "pass" : "warn", detail: risks.length === 0 ? "No risky or misquotable phrases found." : `${risks.length} phrase(s) worth a second look (advisory).` });
  else checks.push({ id: "claims", label: "Factual claims & risk", level: "warn", detail: "AI claim check unavailable right now — press Re-check." });

  const pts = { pass: 1, warn: 0.5, fail: 0 } as const;
  const score = Math.round((checks.reduce((a, c) => a + pts[c.level], 0) / checks.length) * 100);
  const fails = checks.filter((c) => c.level === "fail").length;
  const verdict = !ai ? "Basic checks done — claims not yet verified" : fails === 0 && score >= 85 ? "Ready to deliver" : fails === 0 ? "Nearly ready — review the warnings" : "Needs fixes before delivery";
  return { score, verdict, checks, claims, risks, coverage, numbers, longSentences, aiLive: !!ai, web };
}

export async function fixIssues(text: string, v: Validation, spec: SpeechSpec, facts: Fact[]): Promise<{ text: string; live: boolean }> {
  const issues = [
    ...v.checks.filter((c) => c.level !== "pass").map((c) => `${c.label}: ${c.detail}`),
    ...v.claims.filter((c) => c.status === "unsupported" || c.status === "risky").map((c) => `Claim "${c.claim}" is ${c.status}: ${c.note}${c.fix ? ` Suggested: ${c.fix}` : ""}`),
    ...v.coverage.filter((c) => !c.covered).map((c) => `Missing key message: ${c.message}`),
    ...v.risks.map((r) => `Risk: ${r}`),
    ...v.numbers.items.filter((n) => !n.ok).map((n) => `Unverified number ${n.n} in "…${n.context}…" — remove it or use a fact from the bank`),
    ...v.longSentences.map((s) => `Split this long sentence: "${s.slice(0, 120)}…"`),
  ];
  if (!issues.length) return { text, live: true };
  return rewriteSpeech(text, `Fix ALL of these issues while keeping the speech's voice, structure and length close to ${spec.minutes} minutes (${spec.minutes * WPM} words):\n${issues.map((x) => `- ${x}`).join("\n")}`, facts);
}
