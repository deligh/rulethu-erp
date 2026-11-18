// Ask the Lab — plain-English questions -> lab + slider settings -> answer.
//
// Rule: the AI never produces numbers itself. It picks a lab and sets inputs;
// the lab's own formulas compute the result. Live mode uses Claude (via the
// secure Supabase proxy); demo/offline mode uses a keyword + number parser, so
// the Lab always works, even with no key or no internet.

import { askClaude } from "@/lib/aiClient";
import type { Inputs, InputSpec, LabDef, LabResult } from "./types";
import { clampInput } from "./types";
import { POWER_LAB } from "./power";
import { FOOD_LAB, FUEL_LAB, JOBS_LAB, MINING_LAB, PROJECT_LAB, TAX_LAB } from "./sectors";

export const LABS: LabDef[] = [POWER_LAB, FUEL_LAB, FOOD_LAB, MINING_LAB, PROJECT_LAB, TAX_LAB, JOBS_LAB];
export const labById = (id: string) => LABS.find((l) => l.id === id) ?? POWER_LAB;

export type Intent = "scenario" | "solve" | "explain";
export interface AskPlan {
  lab: string;
  set: Inputs;
  intent: Intent;
  reply: string;
  live: boolean;
}

// ---------- offline parser ----------
const NUM = /(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand|m|mn|million|bn|billion|%|percent|mw|gw|kw|usd|\$|c\b|cents)?/gi;

function parseNumbers(q: string) {
  const out: { value: number; unit: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  NUM.lastIndex = 0;
  while ((m = NUM.exec(q))) {
    let v = parseFloat(m[1].replace(/[,\s]/g, ""));
    const u = (m[2] || "").toLowerCase();
    if (u === "gw") v *= 1000;
    out.push({ value: v, unit: u, index: m.index, end: m.index + m[0].length });
  }
  return out;
}

function scaleTo(spec: InputSpec, v: number, unit: string): number {
  const thousandUnit = /thousand/.test(spec.unit);
  const millionUnit = /\bm\b|million|USD m/.test(spec.unit);
  if (thousandUnit) {
    if (unit === "k" || unit === "thousand") return v;
    if (unit === "m" || unit === "mn" || unit === "million") return v * 1000;
    if (v > spec.max) return v / 1000;
  }
  if (millionUnit) {
    if (unit === "bn" || unit === "billion") return v * 1000;
    if (v >= 1e5) return v / 1e6;
  }
  return v;
}

export function pickLab(q: string, current: string): LabDef {
  const s = q.toLowerCase();
  let best = labById(current), bestScore = 0;
  for (const lab of LABS) {
    let score = 0;
    for (const k of lab.keywords) if (s.includes(k)) score += k.length > 4 ? 2 : 1;
    if (score > bestScore) { best = lab; bestScore = score; }
  }
  return best;
}

export function parseDemo(q: string, current: string): AskPlan {
  const lab = pickLab(q, current);
  // Normalise phrases that would otherwise hit the wrong input ("solar geyser" is not "solar").
  const s = q.toLowerCase().replace(/solar (geysers?|water heaters?)/g, "geysers");
  const nums = parseNumbers(s);
  const used = new Set<number>();
  const set: Inputs = {};

  // Year ("by 2030", "in 2032").
  const y = s.match(/\b(20[2-4]\d)\b/);
  const yearSpec = lab.inputs.find((x) => x.key === "year");
  if (y && yearSpec) {
    set.year = clampInput(yearSpec, +y[1]);
    nums.forEach((n, k) => { if (n.value === +y[1]) used.add(k); });
  }

  // Select-type inputs: match an option's first word ("tourism", "mining").
  for (const spec of lab.inputs) {
    if (!spec.options) continue;
    const o = spec.options.find((op) => s.includes(op.label.split(/[ &]/)[0].toLowerCase()));
    if (o) set[spec.key] = o.value;
  }

  // For each input alias found, take the nearest unused number (prefer just before it).
  const hits: { spec: InputSpec; at: number; end: number }[] = [];
  for (const spec of lab.inputs) {
    if (spec.key === "year") continue;
    for (const a of spec.aliases ?? []) {
      const at = s.indexOf(a.toLowerCase());
      if (at >= 0) { hits.push({ spec, at, end: at + a.length }); break; }
    }
  }
  // Pair words with numbers. A number belongs to the word it touches once small
  // connector words are ignored ("1,500 MW of solar", "Brent goes to 110",
  // "revenue 90m and opex 50m"). Closest pairs are assigned first.
  const CONNECT = /\b(of|to|at|is|are|by|the|a|an|about|around|goes|go|rises|falls|up|down|with|only|be|would|will|set|from|mw|gw|kw|usd|percent|million|thousand|m|k|bn)\b|[%$=:,~≈]/g;
  const gapScore = (gap: string) => gap.replace(CONNECT, "").replace(/\s+/g, "").length * 10 + gap.length * 0.1;
  const pairs: { h: number; k: number; d: number }[] = [];
  hits.forEach((h, hi) => nums.forEach((n, k) => {
    if (used.has(k)) return;
    let d = Infinity;
    if (n.end <= h.at) d = gapScore(s.slice(n.end, h.at));
    else if (n.index >= h.end) d = gapScore(s.slice(h.end, n.index)) + 0.5;
    if (d <= 250) pairs.push({ h: hi, k, d });
  }));
  pairs.sort((a, b) => a.d - b.d);
  const doneH = new Set<number>();
  for (const p of pairs) {
    if (doneH.has(p.h) || used.has(p.k)) continue;
    doneH.add(p.h); used.add(p.k);
    const spec = hits[p.h].spec, n = nums[p.k];
    set[spec.key] = clampInput(spec, scaleTo(spec, n.value, n.unit));
  }

  const solve = /cheapest|best way|how (do|can|to|would) (we|i)|close the gap|end load|reduce|cut|solve|plan|recommend|what should/.test(s);
  const intent: Intent = Object.keys(set).length > (set.year ? 1 : 0) ? "scenario" : solve && lab.solve ? "solve" : Object.keys(set).length ? "scenario" : "explain";
  const changed = Object.entries(set).map(([k, v]) => {
    const spec = lab.inputs.find((x) => x.key === k)!;
    return `${spec.label} → ${v.toLocaleString("en-US")} ${spec.unit}`.trim();
  });
  const reply = intent === "solve"
    ? `Running the ${lab.name} optimiser: "${lab.solve!.label}".`
    : changed.length
      ? `Set in the ${lab.name}: ${changed.join("; ")}.`
      : `Opened the ${lab.name} — ${lab.question}`;
  return { lab: lab.id, set, intent, reply, live: false };
}

// ---------- live (Claude) ----------
function catalogue(): string {
  return LABS.map((l) => `LAB ${l.id} — ${l.name}: ${l.question}\n` + l.inputs.map((x) => `  ${x.key} (${x.label}; ${x.unit || "value"}; ${x.min}–${x.max}; default ${x.default}${x.options ? "; options " + x.options.map((o) => `${o.value}=${o.label}`).join(", ") : ""})`).join("\n") + (l.solve ? `\n  solver: ${l.solve.label}` : "")).join("\n\n");
}

const SYSTEM = `You are the analyst inside "Minister's Desk", an economic scenario lab for Zimbabwe's Minister of Economic Development.
You translate the Minister's question into settings for ONE lab. You never calculate results yourself: the lab's formulas do that.
Return ONLY a JSON object, no prose around it:
{"lab": "<lab id>", "set": {"<input key>": <number>, ...}, "intent": "scenario" | "solve" | "explain", "reply": "<one or two plain sentences to the Minister>"}
- "scenario": he describes a what-if → set the inputs he mentioned (convert units to the input's unit, e.g. 500,000 geysers = 500 thousand).
- "solve": he asks for the best/cheapest way, how to fix or reduce something → set any constraints he gave (e.g. year) and the solver runs.
- "explain": a general question → "reply" answers it briefly in plain English (max 120 words), and points to the most relevant lab.
Keep inputs within their ranges. Only use keys that exist in the chosen lab.

LABS AND INPUTS:
`;

export async function askLab(q: string, currentLab: string, current: Inputs): Promise<AskPlan> {
  const demo = parseDemo(q, currentLab);
  const text = await askClaude({
    system: SYSTEM + catalogue(),
    prompt: `Current lab: ${currentLab}. Current inputs: ${JSON.stringify(current)}\n\nMinister's question: ${q}`,
    model: "haiku",
    maxTokens: 1500,
    timeoutMs: 35000,
  });
  if (!text) return demo;
  try {
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const lab = labById(String(json.lab));
    const set: Inputs = {};
    for (const [k, v] of Object.entries(json.set ?? {})) {
      const spec = lab.inputs.find((x) => x.key === k);
      if (spec && typeof v === "number") set[k] = clampInput(spec, v);
    }
    const intent: Intent = json.intent === "solve" && lab.solve ? "solve" : json.intent === "explain" ? "explain" : "scenario";
    return { lab: lab.id, set, intent, reply: String(json.reply ?? demo.reply), live: true };
  } catch {
    return demo;
  }
}

/** A short, Minister-ready briefing written from computed results (live only). */
export async function briefFromResult(q: string, lab: LabDef, inputs: Inputs, r: LabResult): Promise<string | null> {
  const facts = [
    `${r.headline.label}: ${r.headline.value} (${r.headline.sub ?? ""})`,
    ...r.metrics.map((m) => `${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`),
    ...r.insights,
  ].join("\n");
  return askClaude({
    system: `You brief Zimbabwe's Minister of Economic Development. Write in plain, confident English. Use ONLY the numbers given — never invent figures. Format: one bold-free headline sentence, then 3 short bullet points ("- "), then one line starting "Recommendation:". Under 130 words.`,
    prompt: `Question: ${q || lab.question}\nLab: ${lab.name}\nInputs: ${JSON.stringify(inputs)}\nResults:\n${facts}`,
    model: "haiku",
    maxTokens: 1500,
    timeoutMs: 35000,
  });
}

export const SUGGESTIONS = [
  "What if we build 1,500 MW of solar and 800 MW of batteries by 2030?",
  "What's the cheapest way to end load-shedding by 2030?",
  "What happens to the fuel import bill if Brent goes to 110?",
  "Drought with rain at 45% — how much maize do we import?",
  "What is lithium worth if we process 50% locally?",
  "How many jobs does USD 200m in tourism create?",
];
