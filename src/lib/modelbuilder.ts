// Model Builder — three ways to spin up a financial model for any sector:
//   1) Ask AI (demo)  → describe it in words, it drafts the assumptions
//   2) Clone historic → start from a model that mimics a past Rulethu deal
//   3) Manual         → category defaults you edit
// All three produce the same ModelInputs, run through one generic engine.

export type ModelCategory =
  | "Solar / Energy" | "Power" | "Mining" | "Manufacturing"
  | "Infrastructure" | "Agriculture" | "Trade" | "Real Estate" | "Lending";

export const CATEGORIES: ModelCategory[] = [
  "Solar / Energy", "Power", "Mining", "Manufacturing",
  "Infrastructure", "Agriculture", "Trade", "Real Estate", "Lending",
];

export interface ModelInputs {
  capex: number;        // upfront, year 0 ($)
  years: number;        // horizon
  revenueY1: number;    // year-1 revenue ($)
  growth: number;       // annual revenue growth (fraction)
  margin: number;       // EBITDA margin (fraction)
  tax: number;          // tax rate (fraction)
  wacc: number;         // discount rate (fraction)
  termGrowth: number;   // terminal growth (fraction)
}

export interface ModelField { key: keyof ModelInputs; label: string; unit: "$" | "%" | "yrs"; step: number }
export const MODEL_FIELDS: ModelField[] = [
  { key: "capex", label: "Upfront capex", unit: "$", step: 1_000_000 },
  { key: "revenueY1", label: "Revenue (Year 1)", unit: "$", step: 1_000_000 },
  { key: "growth", label: "Revenue growth", unit: "%", step: 1 },
  { key: "margin", label: "EBITDA margin", unit: "%", step: 1 },
  { key: "tax", label: "Tax rate", unit: "%", step: 1 },
  { key: "years", label: "Horizon", unit: "yrs", step: 1 },
  { key: "wacc", label: "Discount rate (WACC)", unit: "%", step: 0.5 },
  { key: "termGrowth", label: "Terminal growth", unit: "%", step: 0.5 },
];

const DEFAULTS: Record<ModelCategory, ModelInputs> = {
  "Solar / Energy": { capex: 40_000_000, years: 20, revenueY1: 8_000_000, growth: 0.02, margin: 0.75, tax: 0.2477, wacc: 0.12, termGrowth: 0.02 },
  "Power": { capex: 120_000_000, years: 25, revenueY1: 30_000_000, growth: 0.03, margin: 0.55, tax: 0.2477, wacc: 0.13, termGrowth: 0.025 },
  "Mining": { capex: 80_000_000, years: 12, revenueY1: 60_000_000, growth: 0.02, margin: 0.40, tax: 0.2477, wacc: 0.15, termGrowth: 0.0 },
  "Manufacturing": { capex: 15_000_000, years: 10, revenueY1: 20_000_000, growth: 0.05, margin: 0.25, tax: 0.2477, wacc: 0.14, termGrowth: 0.02 },
  "Infrastructure": { capex: 60_000_000, years: 25, revenueY1: 14_000_000, growth: 0.03, margin: 0.60, tax: 0.2477, wacc: 0.12, termGrowth: 0.02 },
  "Agriculture": { capex: 10_000_000, years: 10, revenueY1: 8_000_000, growth: 0.04, margin: 0.35, tax: 0.2477, wacc: 0.14, termGrowth: 0.02 },
  "Trade": { capex: 3_000_000, years: 7, revenueY1: 25_000_000, growth: 0.06, margin: 0.08, tax: 0.2477, wacc: 0.15, termGrowth: 0.02 },
  "Real Estate": { capex: 25_000_000, years: 15, revenueY1: 5_000_000, growth: 0.03, margin: 0.70, tax: 0.2477, wacc: 0.11, termGrowth: 0.025 },
  "Lending": { capex: 5_000_000, years: 7, revenueY1: 3_000_000, growth: 0.08, margin: 0.50, tax: 0.2477, wacc: 0.16, termGrowth: 0.02 },
};

export function blankModel(category: ModelCategory): ModelInputs {
  return { ...DEFAULTS[category] };
}

/* ---- Historic models to clone (mimic past Rulethu deals) ---- */
export interface HistoricModel { id: string; name: string; category: ModelCategory; note: string; inputs: ModelInputs }
export const HISTORIC_MODELS: HistoricModel[] = [
  { id: "h-khayah", name: "Khayah Solar — 40MW IPP", category: "Solar / Energy", note: "20-yr PPA solar IPP, high margin, low growth.", inputs: { capex: 42_000_000, years: 20, revenueY1: 8_400_000, growth: 0.015, margin: 0.78, tax: 0.2477, wacc: 0.12, termGrowth: 0.015 } },
  { id: "h-hwange", name: "Thermal Power Expansion", category: "Power", note: "Base-load power, long horizon.", inputs: { capex: 130_000_000, years: 25, revenueY1: 32_000_000, growth: 0.03, margin: 0.52, tax: 0.2477, wacc: 0.13, termGrowth: 0.025 } },
  { id: "h-lithium", name: "Lithium Off-take & Processing", category: "Mining", note: "Resource play, front-loaded cash, no terminal value.", inputs: { capex: 85_000_000, years: 12, revenueY1: 64_000_000, growth: 0.02, margin: 0.42, tax: 0.2477, wacc: 0.155, termGrowth: 0 } },
  { id: "h-bricks", name: "Clay Bricks Plant", category: "Manufacturing", note: "Building-materials plant, steady margins.", inputs: { capex: 14_000_000, years: 10, revenueY1: 19_000_000, growth: 0.05, margin: 0.24, tax: 0.2477, wacc: 0.14, termGrowth: 0.02 } },
  { id: "h-blueberry", name: "BlueDot Blueberry Out-grower", category: "Agriculture", note: "Export horticulture, ramp-up then plateau.", inputs: { capex: 11_000_000, years: 10, revenueY1: 7_500_000, growth: 0.06, margin: 0.38, tax: 0.2477, wacc: 0.14, termGrowth: 0.02 } },
  { id: "h-dryport", name: "Dry-Port Logistics Hub", category: "Infrastructure", note: "Corridor logistics concession.", inputs: { capex: 55_000_000, years: 25, revenueY1: 13_000_000, growth: 0.035, margin: 0.58, tax: 0.2477, wacc: 0.125, termGrowth: 0.02 } },
  { id: "h-trade", name: "Commodity Trade Desk", category: "Trade", note: "Thin-margin, high-turnover trading book.", inputs: { capex: 3_000_000, years: 7, revenueY1: 28_000_000, growth: 0.06, margin: 0.075, tax: 0.2477, wacc: 0.15, termGrowth: 0.02 } },
];

export function cloneHistoric(id: string): { inputs: ModelInputs; category: ModelCategory; name: string } | null {
  const h = HISTORIC_MODELS.find((x) => x.id === id);
  return h ? { inputs: { ...h.inputs }, category: h.category, name: `${h.name} (copy)`, } : null;
}

/* ---- Ask AI (demo): derive a model from a text brief ---- */
const KEYWORDS: [RegExp, ModelCategory][] = [
  [/solar|pv|photovolta/i, "Solar / Energy"],
  [/power|grid|thermal|hydro|turbine|electric/i, "Power"],
  [/min(e|ing)|lithium|gold|ore|platinum|coal|chrome|smelt/i, "Mining"],
  [/brick|cement|plastic|manufactur|factory|plant|processing|aluminium/i, "Manufacturing"],
  [/road|toll|port|rail|water|bridge|infrastructure|logistics/i, "Infrastructure"],
  [/farm|agri|blueberry|maize|poultry|crop|horticultur|cattle/i, "Agriculture"],
  [/trad(e|ing)|commodity|import|export|wholesale/i, "Trade"],
  [/housing|real estate|property|apartment|residential|mall/i, "Real Estate"],
  [/loan|lend|microfinance|credit|mfi/i, "Lending"],
];

function detectCategory(text: string): ModelCategory {
  for (const [re, cat] of KEYWORDS) if (re.test(text)) return cat;
  return "Manufacturing";
}

// crude $ amount parser ("$20m", "20 million", "USD 5m")
function parseMoney(text: string): number | null {
  const m = text.match(/(?:\$|usd\s*)?\s*([\d.,]+)\s*(m|million|bn|billion|k)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (isNaN(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit.startsWith("b")) return n * 1_000_000_000;
  if (unit === "m" || unit === "million") return n * 1_000_000;
  if (unit === "k") return n * 1_000;
  return n > 10000 ? n : n * 1_000_000; // bare number: assume $m
}

export function buildFromPrompt(prompt: string): { inputs: ModelInputs; category: ModelCategory; name: string; rationale: string } {
  const category = detectCategory(prompt);
  const inputs = blankModel(category);
  const notes: string[] = [`Detected sector: **${category}**.`];

  // MW scaling (energy/power)
  const mw = prompt.match(/([\d.]+)\s*mw/i);
  if (mw) {
    const n = parseFloat(mw[1]);
    inputs.capex = Math.round(n * 1_000_000); // ~$1.0M/MW
    inputs.revenueY1 = Math.round(n * 210_000);
    notes.push(`Sized from **${n}MW**: ~${fmtM(inputs.capex)} capex and ${fmtM(inputs.revenueY1)} Year-1 revenue.`);
  } else {
    // explicit capex / ticket
    const amt = parseMoney(prompt);
    if (amt) { inputs.capex = Math.round(amt); inputs.revenueY1 = Math.round(amt * (DEFAULTS[category].revenueY1 / DEFAULTS[category].capex)); notes.push(`Anchored to a **${fmtM(amt)}** ticket; revenue scaled to the sector norm.`); }
  }
  // PPA / long-term contract → lower growth, longer horizon
  if (/ppa|concession|off-?take|20[- ]year|long[- ]term/i.test(prompt)) { inputs.growth = Math.min(inputs.growth, 0.02); notes.push("Long-term contract detected — growth held conservative."); }

  const name = `${category.split(" ")[0]} model — ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
  notes.push("These are starting assumptions — tune any of them on the right and the valuation updates live.");
  return { inputs, category, name, rationale: notes.join(" ") };
}

function fmtM(n: number) { return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`; }

/* ---- Generic valuation engine ---- */
export interface ModelYear { year: number; revenue: number; ebitda: number; fcf: number; cumulative: number }
export interface ModelResult {
  npv: number; irr: number | null; paybackYears: number | null;
  terminalValue: number; projection: ModelYear[];
}

function npv(rate: number, cf: number[]): number {
  return cf.reduce((s, c, i) => s + c / Math.pow(1 + rate, i), 0);
}
function irr(cf: number[]): number | null {
  let lo = -0.9, hi = 1.0;
  const f = (r: number) => npv(r, cf);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (Math.abs(v) < 1) return mid;
    if (f(lo) * v < 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

const fmtUSD = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`);

// Demo "AI review" of a model — plain-English observations + suggestions.
// With the Claude API connected this becomes a full narrative + risk review.
export function reviewModel(inp: ModelInputs, r: ModelResult): string[] {
  const notes: string[] = [];
  const hurdle = inp.wacc * 100;
  if (r.npv >= 0) notes.push(`**Value-accretive:** NPV is ${fmtUSD(r.npv)} at a ${hurdle.toFixed(0)}% discount rate — it clears its cost of capital.`);
  else notes.push(`**Below hurdle:** NPV is ${fmtUSD(r.npv)} at ${hurdle.toFixed(0)}% — as modelled it doesn't cover the cost of capital. Try lower capex, a higher EBITDA margin, or a longer horizon.`);
  if (r.irr != null) {
    const irr = r.irr * 100;
    notes.push(irr >= hurdle
      ? `**IRR ${irr.toFixed(1)}%** beats the ${hurdle.toFixed(0)}% hurdle by ${(irr - hurdle).toFixed(1)} pts.`
      : `**IRR ${irr.toFixed(1)}%** is below the ${hurdle.toFixed(0)}% hurdle — the return doesn't yet justify the risk.`);
  }
  if (r.paybackYears) notes.push(r.paybackYears > inp.years * 0.6
    ? `**Payback in year ${r.paybackYears}** — long for a ${inp.years}-year horizon; front-loading revenue or trimming capex would help.`
    : `**Payback in year ${r.paybackYears}** — healthy relative to the ${inp.years}-year horizon.`);
  if (inp.margin > 0.6) notes.push(`EBITDA margin of ${(inp.margin * 100).toFixed(0)}% is high — sanity-check it against sector comparables.`);
  if (inp.growth > 0.15) notes.push(`Revenue growth of ${(inp.growth * 100).toFixed(0)}% is aggressive — consider a fade to a terminal rate.`);
  const tv = r.terminalValue / Math.max(1, Math.abs(r.npv) + r.terminalValue);
  if (tv > 0.65) notes.push(`Terminal value drives most of the valuation — results are sensitive to the terminal growth and discount rate; stress them.`);
  return notes;
}

// Route a brief to a fuller, dedicated model where one exists.
export function suggestComplexModel(prompt: string): { label: string; href: string } | null {
  const p = prompt.toLowerCase();
  if (/solar|\bpv\b|ipp|photovolta/.test(p)) return { label: "Open the full Solar IPP project-finance model", href: "/investments/models/solar" };
  if (/valuation|\bdcf\b|equity|listed|zse|share price|proplastics|masimba/.test(p)) return { label: "Open the full Equity Valuation (DCF + comps)", href: "/investments/valuation" };
  if (/loan|lend|microfinance|\bmfi\b|credit book/.test(p)) return { label: "Open the Lending / MFI model", href: "/investments/models/lending" };
  if (/blueberry|agri|farm|horticultur|out-?grower/.test(p)) return { label: "Open the Agri (blueberry) model", href: "/investments/models/agri" };
  if (/power|thermal|hydro|grid/.test(p)) return { label: "Open the Power plant model", href: "/investments/models/plant?preset=power" };
  if (/mine|mining|lithium|gold|ore/.test(p)) return { label: "Open the Mining model", href: "/investments/models/plant?preset=mining" };
  return null;
}

export function computeModel(inp: ModelInputs): ModelResult {
  const cf: number[] = [-inp.capex];
  const projection: ModelYear[] = [];
  let cumulative = -inp.capex;
  let lastFcf = 0;
  const yrs = Math.max(1, Math.round(inp.years));
  for (let y = 1; y <= yrs; y++) {
    const revenue = inp.revenueY1 * Math.pow(1 + inp.growth, y - 1);
    const ebitda = revenue * inp.margin;
    const fcf = ebitda * (1 - inp.tax);
    lastFcf = fcf;
    cumulative += fcf;
    projection.push({ year: y, revenue, ebitda, fcf, cumulative });
    cf.push(fcf);
  }
  // terminal value on the last year
  let terminalValue = 0;
  if (inp.wacc > inp.termGrowth) terminalValue = (lastFcf * (1 + inp.termGrowth)) / (inp.wacc - inp.termGrowth);
  cf[cf.length - 1] += terminalValue;

  // payback (undiscounted, including TV? use operating cumulative without TV)
  let paybackYears: number | null = null;
  let run = -inp.capex;
  for (const p of projection) { run += p.fcf; if (run >= 0) { paybackYears = p.year; break; } }

  return { npv: npv(inp.wacc, cf), irr: irr(cf), paybackYears, terminalValue, projection };
}
