// Boardroom engine — the live intelligence layer behind the Command Center,
// the Africa exposure map and the scenario stress-test. Everything here is a
// PURE function over the real platform data (holdings, deals, investors, the
// ledger, loans, treasury), so the boardroom screens show genuine figures that
// move when the underlying data moves — not mock-ups.

import type { Holding, Investor, TBill } from "./store";
import type { Deal, Loan } from "./seed";
import type { JournalEntry } from "./coa";

const live = (h: Holding) => h.status !== "Exited" && h.status !== "Written off";

/** Cash on hand — the live balance of the operating bank account (code 1000)
 *  straight from the general ledger (debits − credits). */
export function cashFromEntries(entries: JournalEntry[]): number {
  let bal = 0;
  for (const e of entries) for (const l of e.lines) {
    if (l.accountCode === "1000") bal += (l.debit || 0) - (l.credit || 0);
  }
  return bal;
}

export interface BoardAlert {
  id: string;
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
}

export interface BoardUpcoming {
  date: string;      // yyyy-mm-dd
  label: string;
  kind: string;      // "IC" | "Maturity" | "Event" | "Drawdown"
  href: string;
}

export interface BoardSummary {
  aum: number;            // portfolio fair value (live holdings)
  invested: number;       // cost basis
  unrealized: number;     // fair value − cost
  moic: number;           // fair value / cost
  pipelineValue: number;
  pipelineCount: number;
  cash: number;
  committed: number;
  called: number;
  distributed: number;
  dryPowder: number;      // committed − called
  dpi: number;            // distributed / called
  loanBook: number;
  parAmount: number;
  treasuryFace: number;
  performingCount: number;
  watchCount: number;
  underCount: number;
  movers: { company: string; gain: number; pct: number }[];
  alerts: BoardAlert[];
  upcoming: BoardUpcoming[];
}

export interface BoardInputs {
  holdings: Holding[];
  deals: Deal[];
  investors: Investor[];
  loans: Loan[];
  tbills: TBill[];
  entries: JournalEntry[];
  personalEvents: { date: string; title: string }[];
  today: string; // yyyy-mm-dd
}

export function boardSummary(x: BoardInputs): BoardSummary {
  const liveH = x.holdings.filter(live);
  const invested = liveH.reduce((s, h) => s + h.invested, 0);
  const aum = liveH.reduce((s, h) => s + h.fairValue, 0);
  const unrealized = aum - invested;
  const moic = invested ? aum / invested : 0;

  const pipelineValue = x.deals.reduce((s, d) => s + d.ticket, 0);
  const committed = x.investors.reduce((s, i) => s + i.committed, 0);
  const called = x.investors.reduce((s, i) => s + i.called, 0);
  const distributed = x.investors.reduce((s, i) => s + i.distributed, 0);
  const loanBook = x.loans.reduce((s, l) => s + l.principal, 0);
  const parAmount = x.loans.filter((l) => l.status === "PAR>30").reduce((s, l) => s + l.principal, 0);
  const treasuryFace = x.tbills.reduce((s, t) => s + t.faceValue, 0);

  const movers = liveH
    .map((h) => ({ company: h.company, gain: h.fairValue - h.invested, pct: h.invested ? h.fairValue / h.invested - 1 : 0 }))
    .sort((a, b) => b.pct - a.pct);

  // ---- Alerts (all computed from real positions) ----
  const alerts: BoardAlert[] = [];
  for (const h of liveH) {
    if (h.status === "Underperforming")
      alerts.push({ id: `al-${h.id}`, severity: "critical", title: `${h.company} underperforming`, detail: h.note || "Flagged for turnaround review.", href: "/portfolio" });
  }
  for (const h of liveH) {
    if (h.fairValue < h.invested && h.status !== "Underperforming")
      alerts.push({ id: `ml-${h.id}`, severity: "warn", title: `${h.company} below cost`, detail: `Fair value ${pctStr(h.fairValue / h.invested - 1)} vs cost — mark under review.`, href: "/portfolio" });
  }
  for (const l of x.loans) {
    if (l.status === "PAR>30")
      alerts.push({ id: `par-${l.id}`, severity: "warn", title: `Loan at risk — ${l.borrower}`, detail: `$${l.principal.toLocaleString()} principal classified PAR>30.`, href: "/microfinance" });
  }
  for (const h of liveH) {
    if (h.status === "Watch")
      alerts.push({ id: `wa-${h.id}`, severity: "info", title: `${h.company} on watch`, detail: h.note || "Monitor closely.", href: "/portfolio" });
  }
  for (const i of x.investors) {
    const undrawn = i.committed - i.called;
    if (i.relationship === "Committed" && undrawn > 0)
      alerts.push({ id: `dd-${i.id}`, severity: "info", title: `Drawdown available — ${i.name}`, detail: `$${undrawn.toLocaleString()} committed and undrawn.`, href: "/portfolio/investors" });
  }
  const sev = { critical: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => sev[a.severity] - sev[b.severity]);

  // ---- Upcoming (real dated items) ----
  const upcoming: BoardUpcoming[] = [];
  for (const d of x.deals) {
    if (d.stage === "IC") upcoming.push({ date: d.updated, label: `IC — ${d.name}`, kind: "IC", href: "/investments" });
  }
  for (const t of x.tbills) {
    if (t.maturityDate >= x.today) upcoming.push({ date: t.maturityDate, label: `TB matures — ${t.reference}`, kind: "Maturity", href: "/treasury" });
  }
  for (const e of x.personalEvents) {
    if (e.date >= x.today) upcoming.push({ date: e.title ? e.date : e.date, label: e.title, kind: "Event", href: "/calendar" });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  return {
    aum, invested, unrealized, moic,
    pipelineValue, pipelineCount: x.deals.length,
    cash: cashFromEntries(x.entries),
    committed, called, distributed,
    dryPowder: committed - called,
    dpi: called ? distributed / called : 0,
    loanBook, parAmount, treasuryFace,
    performingCount: liveH.filter((h) => h.status === "Performing").length,
    watchCount: liveH.filter((h) => h.status === "Watch").length,
    underCount: liveH.filter((h) => h.status === "Underperforming").length,
    movers,
    alerts,
    upcoming: upcoming.slice(0, 8),
  };
}

function pctStr(f: number): string { return `${f >= 0 ? "+" : ""}${(f * 100).toFixed(1)}%`; }

// ===================== Geographic exposure (Africa map) =====================

export interface GeoNode {
  country: string;
  x: number; y: number;          // position in a 0..100 viewBox
  dealValue: number;
  holdingValue: number;
  total: number;
  items: { name: string; value: number; kind: "deal" | "holding" }[];
}

// Approximate positions for a stylised Southern/Central Africa panel (0..100).
const COUNTRY_POS: Record<string, { x: number; y: number }> = {
  Zimbabwe: { x: 57, y: 60 },
  Zambia: { x: 48, y: 46 },
  Malawi: { x: 66, y: 44 },
  Mozambique: { x: 72, y: 60 },
  "South Africa": { x: 50, y: 82 },
  Botswana: { x: 42, y: 70 },
  Namibia: { x: 32, y: 74 },
  Tanzania: { x: 66, y: 30 },
  DRC: { x: 42, y: 30 },
  Angola: { x: 30, y: 48 },
};

/** HQ marker (Harare). */
export const GEO_HQ = { country: "Zimbabwe", x: COUNTRY_POS.Zimbabwe.x, y: COUNTRY_POS.Zimbabwe.y };

/** Build exposure nodes by country: deals plot to their country, portfolio
 *  holdings are domiciled in Zimbabwe (the group's home market). */
export function geoExposure(deals: Deal[], holdings: Holding[]): GeoNode[] {
  const map = new Map<string, GeoNode>();
  const get = (country: string): GeoNode | null => {
    const pos = COUNTRY_POS[country];
    if (!pos) return null;
    let n = map.get(country);
    if (!n) { n = { country, x: pos.x, y: pos.y, dealValue: 0, holdingValue: 0, total: 0, items: [] }; map.set(country, n); }
    return n;
  };
  for (const d of deals) {
    const n = get(d.country);
    if (n) { n.dealValue += d.ticket; n.total += d.ticket; n.items.push({ name: d.name, value: d.ticket, kind: "deal" }); }
  }
  for (const h of holdings.filter(live)) {
    const n = get("Zimbabwe");
    if (n) { n.holdingValue += h.fairValue; n.total += h.fairValue; n.items.push({ name: h.company, value: h.fairValue, kind: "holding" }); }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// ===================== Scenario stress-test =====================

export interface StressFactors {
  gold: number;      // fractional move in the gold price, e.g. -0.20 = −20%
  lithium: number;   // fractional move in lithium carbonate
  fx: number;        // ZiG devaluation vs USD, e.g. 0.30 = 30% weaker
  rates: number;     // change in USD rates in percentage points, e.g. 2 = +200bps
}

export const STRESS_ZERO: StressFactors = { gold: 0, lithium: 0, fx: 0, rates: 0 };

// Sector sensitivities. gold/lithium/fx are elasticities to a fractional move;
// rates is the value change per +1 percentage point (duration-like). Negative
// = value falls when the factor rises.
interface Sens { gold: number; lithium: number; fx: number; rates: number }
const SECTOR_SENS: { match: string; s: Sens }[] = [
  { match: "mining",        s: { gold: 0.35, lithium: 0.55, fx: -0.05, rates: -0.03 } },
  { match: "resources",     s: { gold: 0.35, lithium: 0.55, fx: -0.05, rates: -0.03 } },
  { match: "energy",        s: { gold: 0.00, lithium: 0.05, fx: -0.05, rates: -0.06 } },
  { match: "infrastructure",s: { gold: 0.00, lithium: 0.00, fx: -0.05, rates: -0.06 } },
  { match: "real estate",   s: { gold: 0.00, lithium: 0.00, fx: -0.10, rates: -0.05 } },
  { match: "manufacturing", s: { gold: 0.00, lithium: 0.05, fx: -0.15, rates: -0.03 } },
  { match: "consumer",      s: { gold: 0.00, lithium: 0.00, fx: -0.20, rates: -0.02 } },
  { match: "retail",        s: { gold: 0.00, lithium: 0.00, fx: -0.20, rates: -0.02 } },
  { match: "financial",     s: { gold: 0.05, lithium: 0.00, fx: -0.25, rates: 0.01 } },
];
const DEFAULT_SENS: Sens = { gold: 0.02, lithium: 0.02, fx: -0.10, rates: -0.03 };

export function sectorSens(sector: string): Sens {
  const low = (sector || "").toLowerCase();
  for (const r of SECTOR_SENS) if (low.includes(r.match)) return r.s;
  return DEFAULT_SENS;
}

/** Stressed fair value of a single holding under the factor set. */
export function stressHolding(h: Holding, f: StressFactors): number {
  const s = sectorSens(h.sector);
  const mult = 1 + s.gold * f.gold + s.lithium * f.lithium + s.fx * f.fx + s.rates * f.rates;
  return h.fairValue * Math.max(0.1, mult);
}

export interface StressRow {
  id: string; company: string; sector: string;
  base: number; stressed: number; delta: number; pct: number;
}
export interface StressResult {
  base: number; stressed: number; delta: number; pct: number;
  rows: StressRow[];
}

export function runStress(holdings: Holding[], f: StressFactors): StressResult {
  const rows: StressRow[] = holdings.filter(live).map((h) => {
    const stressed = stressHolding(h, f);
    return { id: h.id, company: h.company, sector: h.sector, base: h.fairValue, stressed, delta: stressed - h.fairValue, pct: h.fairValue ? stressed / h.fairValue - 1 : 0 };
  }).sort((a, b) => a.delta - b.delta);
  const base = rows.reduce((s, r) => s + r.base, 0);
  const stressed = rows.reduce((s, r) => s + r.stressed, 0);
  return { base, stressed, delta: stressed - base, pct: base ? stressed / base - 1 : 0, rows };
}

// Named scenarios (one-click presets on the stress page).
export const STRESS_PRESETS: { name: string; detail: string; factors: StressFactors }[] = [
  { name: "Gold −20%", detail: "A sharp pullback in bullion", factors: { gold: -0.2, lithium: 0, fx: 0, rates: 0 } },
  { name: "Lithium −30%", detail: "Battery-metal glut deepens", factors: { gold: 0, lithium: -0.3, fx: 0, rates: 0 } },
  { name: "ZiG −40%", detail: "Local-currency devaluation", factors: { gold: 0, lithium: 0, fx: 0.4, rates: 0 } },
  { name: "Rates +200bps", detail: "Global tightening resumes", factors: { gold: 0, lithium: 0, fx: 0, rates: 2 } },
  { name: "Risk-off combo", detail: "Metals down, ZiG weaker, rates up", factors: { gold: -0.15, lithium: -0.2, fx: 0.25, rates: 1.5 } },
  { name: "Commodity rally", detail: "Gold & lithium bid, stable FX", factors: { gold: 0.2, lithium: 0.25, fx: 0, rates: -0.5 } },
];
