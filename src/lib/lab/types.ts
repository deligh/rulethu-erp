// Minister's Desk · Economic Lab — shared types.
// Every lab is a pure function: inputs (sliders) -> result (headline, metrics,
// chart data, working, insights). The UI and the AI both drive labs through the
// same input keys, so the AI can never invent a number: it only sets sliders.

export type Inputs = Record<string, number>;

export interface InputSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  group: string;
  /** Where the default comes from (shown on hover). */
  source?: string;
  help?: string;
  /** Words the plain-English parser matches to this input. */
  aliases?: string[];
  /** Discrete choices (renders a select instead of a slider). */
  options?: { value: number; label: string }[];
}

export type Tone = "good" | "bad" | "neutral" | "warn";

export interface Metric {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}

export interface BarItem {
  label: string;
  value: number;
  highlight?: boolean;
  note?: string;
}

export interface LabResult {
  headline: Metric;
  metrics: Metric[];
  bars?: { title: string; unit: string; items: BarItem[]; format: "usd" | "num" | "pct" | "mw" | "t" };
  working: string[];
  insights: string[];
}

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  set: Inputs;
}

export interface SolveStep {
  label: string;
  detail: string;
}

export interface SolveResult {
  title: string;
  steps: SolveStep[];
  summary: string;
  inputs: Inputs;
}

export interface LabDef {
  id: string;
  name: string;
  short: string;
  question: string;
  keywords: string[];
  inputs: InputSpec[];
  presets: Preset[];
  compute: (i: Inputs) => LabResult;
  solve?: { label: string; run: (i: Inputs) => SolveResult };
}

export function defaults(specs: InputSpec[]): Inputs {
  const o: Inputs = {};
  for (const s of specs) o[s.key] = s.default;
  return o;
}

export function clampInput(spec: InputSpec, v: number): number {
  if (!Number.isFinite(v)) return spec.default;
  const c = Math.min(spec.max, Math.max(spec.min, v));
  return Math.round(c / spec.step) * spec.step;
}

// ---------- formatting ----------
export function usd(n: number, digits = 1): string {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 1e9) return `${s}USD ${(a / 1e9).toFixed(digits)}bn`;
  if (a >= 1e6) return `${s}USD ${(a / 1e6).toFixed(a >= 1e8 ? 0 : digits)}m`;
  if (a >= 1e3) return `${s}USD ${(a / 1e3).toFixed(0)}k`;
  return `${s}USD ${a.toFixed(2)}`;
}
export function num(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
export function mw(n: number): string {
  return `${num(Math.round(n))} MW`;
}
export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}
export function fmtBy(kind: "usd" | "num" | "pct" | "mw" | "t", n: number): string {
  if (kind === "usd") return usd(n);
  if (kind === "pct") return pct(n);
  if (kind === "mw") return mw(n);
  if (kind === "t") return `${num(Math.round(n))} t`;
  return num(n, Math.abs(n) < 10 ? 1 : 0);
}
