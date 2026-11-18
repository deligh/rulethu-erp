// Zimbabwe Power Lab — an hour-by-hour (24h) supply/demand model.
//
// Method (deliberately simple and auditable):
//  1. Peak demand at the generation side for the target year = 2025 base grown
//     at g%/yr + new industrial load + new household connections.
//  2. A typical Zimbabwe daily load shape (evening peak ~19:00) spreads it
//     across 24 hours. Demand-side levers (solar geysers, efficiency, rooftop
//     solar, mines' own power, time-of-use shifting, loss reduction) cut it.
//  3. Each hour is served in merit order (cheapest first). Spare capacity
//     charges batteries; batteries then cover the worst deficit hours; diesel
//     comes last. Anything left is unserved = load-shedding.
//  4. Energy x cost per kWh gives the annual bill, average cost, forex and the
//     economic cost of load-shedding (unserved kWh x value of lost load).
// All defaults are approximate public figures and every one is a slider.

import type { InputSpec, Inputs, LabDef, LabResult, Preset, SolveResult } from "./types";
import { defaults, mw, num, pct, usd } from "./types";

// Normalised daily demand shape (peak = 1.0 at 18:00–19:00).
export const LOAD_SHAPE = [
  0.62, 0.58, 0.56, 0.56, 0.6, 0.7, 0.82, 0.86, 0.84, 0.82, 0.81, 0.8,
  0.8, 0.79, 0.78, 0.79, 0.84, 0.93, 1.0, 0.98, 0.92, 0.84, 0.74, 0.67,
];
// Solar output per MW installed, by hour (typical Zimbabwe day incl. cloud, ~22% CF).
export const SOLAR_SHAPE = [
  0, 0, 0, 0, 0, 0, 0.04, 0.17, 0.34, 0.49, 0.61, 0.68,
  0.7, 0.68, 0.61, 0.49, 0.34, 0.17, 0.04, 0, 0, 0, 0, 0,
];
// Share of geyser load running each hour (morning + evening heavy).
const GEYSER_SHAPE = [
  0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.9, 1, 1, 0.8, 0.4, 0.4,
  0.4, 0.4, 0.4, 0.4, 0.4, 0.8, 1, 1, 0.9, 0.6, 0.3, 0.2,
];
const BASE_LOSS = 20; // % losses embedded in the 2025 base demand figure
const KARIBA_MW = 1050, HWANGE_MW = 1520, THERMALS_MW = 270;
const BATTERY_HOURS = 4, BATTERY_EFF = 0.88;

// Existing (2025) build — capex is charged only for additions above these.
const EXISTING = { solar: 100, rooftop: 50, battery: 0, newHydro: 0, newCoal: 0, diesel: 0, geysers: 0, efficiency: 0, shift: 0, mineSelfGen: 0, losses: BASE_LOSS, hwangeAvail: 62 };

const G = { demand: "Demand", supply: "Supply (what we have)", build: "New build", levers: "Save & shift (demand levers)", costs: "Cost assumptions" };

export const POWER_INPUTS: InputSpec[] = [
  { key: "year", label: "Target year", unit: "", min: 2025, max: 2035, step: 1, default: 2025, group: G.demand, aliases: ["by", "in"] },
  { key: "baseDemand", label: "Peak demand in 2025", unit: "MW", min: 1500, max: 3000, step: 50, default: 2100, group: G.demand, source: "ZESA statements, 2025: peak demand about 1,950–2,200 MW", aliases: ["peak demand", "demand"] },
  { key: "growth", label: "Underlying demand growth", unit: "%/yr", min: 0, max: 15, step: 0.5, default: 6, group: G.demand, help: "World Bank high case implies ~5,177 MW by 2030", aliases: ["growth"] },
  { key: "newIndustry", label: "New mining & processing load", unit: "MW", min: 0, max: 2000, step: 25, default: 0, group: G.demand, help: "Lithium plants, smelters, SEZs. Default rises with the year in presets.", aliases: ["mining load", "smelter", "industry", "industrial"] },
  { key: "newConnections", label: "New homes connected", unit: "thousand", min: 0, max: 1500, step: 25, default: 0, group: G.demand, aliases: ["homes", "households", "connections"] },
  { key: "kwPerHome", label: "Peak load per new home", unit: "kW", min: 0.3, max: 2, step: 0.1, default: 0.8, group: G.demand },

  { key: "karibaWater", label: "Kariba water available", unit: "% of 1,050 MW", min: 10, max: 100, step: 5, default: 40, group: G.supply, source: "ZPC 2025: Kariba ran 250–400 MW on low water", aliases: ["kariba water", "kariba", "water"] },
  { key: "hwangeAvail", label: "Hwange availability", unit: "% of 1,520 MW", min: 30, max: 95, step: 1, default: 62, group: G.supply, source: "ZPC 2025: Hwange about 800–1,000 MW", help: "Raising this = refurbishing old units 1–6", aliases: ["hwange"] },
  { key: "thermalsAvail", label: "Small thermals (Harare, Bulawayo, Munyati)", unit: "% of 270 MW", min: 0, max: 80, step: 5, default: 10, group: G.supply, aliases: ["thermal", "munyati", "harare station", "bulawayo station"] },
  { key: "imports", label: "Imports (HCB, Eskom, ZESCO)", unit: "MW", min: 0, max: 800, step: 25, default: 150, group: G.supply, aliases: ["import", "imports", "eskom", "hcb"] },

  { key: "solar", label: "Utility solar (grid)", unit: "MW", min: 0, max: 10000, step: 50, default: 100, group: G.build, source: "Approx. grid-connected solar IPPs, 2025", aliases: ["solar farm", "solar park", "solar"] },
  { key: "battery", label: "Battery storage (4-hour)", unit: "MW", min: 0, max: 6000, step: 50, default: 0, group: G.build, aliases: ["battery", "batteries", "storage", "bess"] },
  { key: "rooftop", label: "Rooftop solar (homes & firms)", unit: "MW", min: 0, max: 2000, step: 25, default: 50, group: G.build, aliases: ["rooftop", "net metering"] },
  { key: "newHydro", label: "New hydro (e.g. Batoka share)", unit: "MW", min: 0, max: 1500, step: 50, default: 0, group: G.build, help: "Batoka Gorge = 2,400 MW shared with Zambia; earliest ~2032", aliases: ["batoka", "hydro"] },
  { key: "newCoal", label: "New coal plants", unit: "MW", min: 0, max: 2000, step: 50, default: 0, group: G.build, help: "Earliest ~2029 (build time)", aliases: ["coal"] },
  { key: "diesel", label: "Emergency diesel generators", unit: "MW", min: 0, max: 1000, step: 25, default: 0, group: G.build, aliases: ["diesel", "genset", "generator"] },

  { key: "losses", label: "Grid losses (technical + theft)", unit: "%", min: 8, max: 30, step: 1, default: 20, group: G.levers, source: "ZETDC: losses about 20%", help: "Smart prepaid meters, line upgrades", aliases: ["losses", "loss", "theft"] },
  { key: "geysers", label: "Solar geysers replacing electric", unit: "thousand", min: 0, max: 800, step: 25, default: 0, group: G.levers, help: "~1 kW of evening peak each", aliases: ["geyser", "geysers", "water heater"] },
  { key: "efficiency", label: "Efficiency (LEDs, efficient motors)", unit: "% cut", min: 0, max: 20, step: 1, default: 0, group: G.levers, aliases: ["efficiency", "led", "efficient"] },
  { key: "shift", label: "Load moved off the evening peak", unit: "MW", min: 0, max: 500, step: 25, default: 0, group: G.levers, help: "Time-of-use tariffs: irrigation, smelters, pumping to midday", aliases: ["time-of-use", "time of use", "shift", "tou"] },
  { key: "mineSelfGen", label: "Mines' own solar + battery", unit: "MW", min: 0, max: 800, step: 25, default: 0, group: G.levers, aliases: ["mines own", "self-generation", "captive"] },

  { key: "cKariba", label: "Kariba cost", unit: "c/kWh", min: 1, max: 10, step: 0.5, default: 3, group: G.costs, source: "Existing hydro — assumption" },
  { key: "cHwange", label: "Hwange cost", unit: "c/kWh", min: 4, max: 20, step: 0.5, default: 8, group: G.costs, source: "Existing coal — assumption" },
  { key: "cThermal", label: "Small thermals cost", unit: "c/kWh", min: 8, max: 30, step: 0.5, default: 15, group: G.costs },
  { key: "cImport", label: "Import price", unit: "c/kWh", min: 5, max: 25, step: 0.5, default: 12, group: G.costs, source: "Regional bilateral range 8–15c" },
  { key: "cSolar", label: "Utility solar cost", unit: "c/kWh", min: 3, max: 12, step: 0.5, default: 5.5, group: G.costs, source: "Regional tenders 4–7c" },
  { key: "cHydro", label: "New hydro cost", unit: "c/kWh", min: 4, max: 15, step: 0.5, default: 7.5, group: G.costs },
  { key: "cCoal", label: "New coal cost", unit: "c/kWh", min: 6, max: 18, step: 0.5, default: 10.5, group: G.costs },
  { key: "cBattery", label: "Battery cost per kWh delivered", unit: "c/kWh", min: 3, max: 20, step: 0.5, default: 7, group: G.costs, help: "Added on top of the energy used to charge" },
  { key: "cDiesel", label: "Diesel generation cost", unit: "c/kWh", min: 20, max: 60, step: 0.5, default: 37.5, group: G.costs, source: "30–45c, mostly imported fuel" },
  { key: "voll", label: "Cost to the economy of a lost kWh", unit: "USD/kWh", min: 0.1, max: 3, step: 0.05, default: 0.5, group: G.costs, help: "Value of lost load — lost output, generators, spoilt goods. Conservative." },
];

export const POWER_PRESETS: Preset[] = [
  { id: "today", name: "Today (2025)", blurb: "Where we stand now", set: {} },
  { id: "nothing", name: "2030, do nothing", blurb: "Demand grows, no new build", set: { year: 2030, newIndustry: 500, newConnections: 200 } },
  { id: "fix", name: "Fix & save first", blurb: "Cheapest MW: losses, Hwange, geysers", set: { year: 2030, newIndustry: 500, newConnections: 200, losses: 12, hwangeAvail: 85, geysers: 400, efficiency: 8, shift: 250 } },
  { id: "solar", name: "Solar + storage 2030", blurb: "1,500 MW solar, 800 MW batteries", set: { year: 2030, newIndustry: 500, newConnections: 200, solar: 1500, battery: 800, rooftop: 400 } },
  { id: "big", name: "Big build 2033", blurb: "Batoka + coal + solar", set: { year: 2033, newIndustry: 800, newConnections: 400, newHydro: 1200, newCoal: 600, solar: 1000, battery: 400 } },
];

// Capex per MW (USD m) and indicative jobs per MW (construction job-years).
const CAPEX = { solar: 0.7, battery: 1.0, rooftop: 0.9, newHydro: 3.0, newCoal: 2.5, diesel: 0.6, geyserPerThousand: 0.5, lossPerPoint: 25, efficiencyPerPoint: 15, shiftPerMW: 0.05, mineSelfGen: 1.6, hwangePerPoint: 8 };
const JOBS = { solar: 3, battery: 1, rooftop: 10, newHydro: 8, newCoal: 6, diesel: 0.5, geyserPerThousand: 5, mineSelfGen: 4 };

export type SourceKey = "solar" | "kariba" | "newHydro" | "hwange" | "newCoal" | "imports" | "thermals" | "battery" | "diesel";
export const SOURCE_META: Record<SourceKey, { label: string; color: string }> = {
  solar: { label: "Solar", color: "#e3a008" },
  kariba: { label: "Kariba hydro", color: "#1c7293" },
  newHydro: { label: "New hydro", color: "#4fa3c7" },
  hwange: { label: "Hwange coal", color: "#5b6573" },
  newCoal: { label: "New coal", color: "#8a929e" },
  imports: { label: "Imports", color: "#6d2e46" },
  thermals: { label: "Small thermals", color: "#a17e12" },
  battery: { label: "Batteries", color: "#0b6e4f" },
  diesel: { label: "Diesel", color: "#b85042" },
};
export const MERIT: SourceKey[] = ["solar", "kariba", "newHydro", "hwange", "newCoal", "imports", "thermals"];

export interface PowerOut {
  hours: { h: number; demand: number; served: Record<SourceKey, number>; unserved: number; charge: number }[];
  peakDemand: number;
  peakHour: number;
  worstHour: number;
  gapMW: number;
  unservedMWh: number;
  demandMWh: number;
  shedHours: number;
  firmMW: number;
  energyTWh: number;
  annualCost: number;
  avgCost: number; // c/kWh
  forex: number; // USD/yr
  econCost: number; // USD/yr
  capex: number; // USD
  jobs: number;
  wastedSolarMWh: number;
  bySource: Record<SourceKey, number>; // MWh/day
}

export function runPower(i: Inputs): PowerOut {
  const yrs = Math.max(0, i.year - 2025);
  const lossFactor = (1 - BASE_LOSS / 100) / (1 - i.losses / 100);
  const peakGen = (i.baseDemand * Math.pow(1 + i.growth / 100, yrs) + i.newIndustry + i.newConnections * i.kwPerHome) * lossFactor;

  // Hourly demand at generation side, after demand-side levers.
  const demand = LOAD_SHAPE.map((s, h) => {
    let d = peakGen * s * (1 - i.efficiency / 100);
    d -= i.geysers * 1.0 * GEYSER_SHAPE[h] * lossFactor;
    d -= i.rooftop * SOLAR_SHAPE[h];
    d -= i.mineSelfGen;
    if (h >= 17 && h <= 21) d -= i.shift;
    if (h >= 9 && h <= 14) d += (i.shift * 5) / 6;
    return Math.max(0, d);
  });

  const avail: Record<SourceKey, (h: number) => number> = {
    solar: (h) => i.solar * SOLAR_SHAPE[h],
    kariba: () => KARIBA_MW * (i.karibaWater / 100),
    newHydro: () => (i.year >= 2032 ? i.newHydro * 0.85 : 0),
    hwange: () => HWANGE_MW * (i.hwangeAvail / 100),
    newCoal: () => (i.year >= 2029 ? i.newCoal * 0.85 : 0),
    imports: () => i.imports,
    thermals: () => THERMALS_MW * (i.thermalsAvail / 100),
    battery: () => 0,
    diesel: () => i.diesel,
  };

  // Pass 1: merit-order dispatch without storage/diesel.
  const hours = demand.map((d, h) => {
    const served = { solar: 0, kariba: 0, newHydro: 0, hwange: 0, newCoal: 0, imports: 0, thermals: 0, battery: 0, diesel: 0 } as Record<SourceKey, number>;
    let need = d, spare = 0;
    for (const k of MERIT) {
      const a = avail[k](h);
      const take = Math.min(a, need);
      served[k] = take;
      need -= take;
      spare += a - take;
    }
    return { h, demand: d, served, unserved: need, spare, charge: 0 };
  });

  // Pass 2: batteries charge from spare capacity, discharge into worst deficits.
  const capMWh = i.battery * BATTERY_HOURS;
  if (i.battery > 0) {
    let canCharge = 0;
    for (const x of hours) canCharge += Math.min(x.spare, i.battery);
    let stored = Math.min(capMWh, canCharge * BATTERY_EFF);
    // record charging (proportional to spare)
    const chargeNeeded = stored / BATTERY_EFF;
    if (canCharge > 0) for (const x of hours) x.charge = (Math.min(x.spare, i.battery) / canCharge) * chargeNeeded;
    const order = [...hours].sort((a, b) => b.unserved - a.unserved);
    for (const x of order) {
      if (stored <= 0 || x.unserved <= 0) break;
      const out = Math.min(x.unserved, i.battery, stored);
      x.served.battery = out;
      x.unserved -= out;
      stored -= out;
    }
  }
  // Pass 3: diesel last.
  for (const x of hours) {
    const dsl = Math.min(x.unserved, i.diesel);
    x.served.diesel = dsl;
    x.unserved -= dsl;
  }

  const bySource = { solar: 0, kariba: 0, newHydro: 0, hwange: 0, newCoal: 0, imports: 0, thermals: 0, battery: 0, diesel: 0 } as Record<SourceKey, number>;
  let unservedMWh = 0, demandMWh = 0, wastedSolarMWh = 0, chargeMWh = 0;
  for (const x of hours) {
    for (const k of Object.keys(bySource) as SourceKey[]) bySource[k] += x.served[k];
    unservedMWh += x.unserved;
    demandMWh += x.demand;
    chargeMWh += x.charge;
    const solarSpare = i.solar * SOLAR_SHAPE[x.h] - x.served.solar;
    wastedSolarMWh += Math.max(0, solarSpare - x.charge);
  }
  const peakDemand = Math.max(...demand);
  const peakHour = demand.indexOf(peakDemand);
  const worst = hours.reduce((a, b) => (b.unserved > a.unserved ? b : a), hours[0]);

  // Costs (c/kWh -> USD per MWh = c * 10).
  const c: Record<SourceKey, number> = { solar: i.cSolar, kariba: i.cKariba, newHydro: i.cHydro, hwange: i.cHwange, newCoal: i.cCoal, imports: i.cImport, thermals: i.cThermal, battery: i.cBattery, diesel: i.cDiesel };
  let dailyCost = 0;
  for (const k of Object.keys(bySource) as SourceKey[]) dailyCost += bySource[k] * c[k] * 10;
  // Charging energy comes from spare plant (priced at Hwange's cost).
  dailyCost += chargeMWh * i.cHwange * 10;
  const servedMWh = demandMWh - unservedMWh;
  const annualCost = dailyCost * 365;
  const avgCost = servedMWh > 0 ? dailyCost / servedMWh / 10 : 0;
  const forex = (bySource.imports * i.cImport * 10 + bySource.diesel * i.cDiesel * 10 * 0.75) * 365;
  const econCost = unservedMWh * 1000 * i.voll * 365;

  const add = (k: keyof typeof EXISTING) => Math.max(0, i[k] - EXISTING[k]);
  const capex = 1e6 * (
    add("solar") * CAPEX.solar + add("battery") * CAPEX.battery + add("rooftop") * CAPEX.rooftop +
    add("newHydro") * CAPEX.newHydro + add("newCoal") * CAPEX.newCoal + add("diesel") * CAPEX.diesel +
    add("geysers") * CAPEX.geyserPerThousand + Math.max(0, EXISTING.losses - i.losses) * CAPEX.lossPerPoint +
    add("efficiency") * CAPEX.efficiencyPerPoint + add("shift") * CAPEX.shiftPerMW + add("mineSelfGen") * CAPEX.mineSelfGen +
    add("hwangeAvail") * CAPEX.hwangePerPoint
  );
  const jobs = add("solar") * JOBS.solar + add("battery") * JOBS.battery + add("rooftop") * JOBS.rooftop + add("newHydro") * JOBS.newHydro +
    add("newCoal") * JOBS.newCoal + add("diesel") * JOBS.diesel + add("geysers") * JOBS.geyserPerThousand + add("mineSelfGen") * JOBS.mineSelfGen;

  const firmMW = KARIBA_MW * i.karibaWater / 100 + HWANGE_MW * i.hwangeAvail / 100 + THERMALS_MW * i.thermalsAvail / 100 + i.imports +
    (i.year >= 2032 ? i.newHydro * 0.85 : 0) + (i.year >= 2029 ? i.newCoal * 0.85 : 0);

  return {
    hours: hours.map((x) => ({ h: x.h, demand: x.demand, served: x.served, unserved: x.unserved, charge: x.charge })),
    peakDemand, peakHour, worstHour: worst.h, gapMW: worst.unserved, unservedMWh, demandMWh,
    shedHours: demandMWh > 0 ? (unservedMWh / demandMWh) * 24 : 0,
    firmMW, energyTWh: (servedMWh * 365) / 1e6, annualCost, avgCost, forex, econCost, capex, jobs, wastedSolarMWh, bySource,
  };
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function powerInsights(i: Inputs, o: PowerOut): string[] {
  const out: string[] = [];
  if (o.gapMW > 1) {
    const solarAtWorst = i.solar * SOLAR_SHAPE[o.worstHour];
    out.push(`The binding problem is ${hh(o.worstHour)}: we are ${mw(o.gapMW)} short at that hour. Solar delivers only ${mw(solarAtWorst)} then, so more solar alone will not fix that hour — it needs storage or firm power.`);
  } else {
    out.push(`Supply covers demand in every hour of a typical day in ${i.year}. No load-shedding in this scenario.`);
  }
  if (i.battery > 0 && o.bySource.battery < i.battery * BATTERY_HOURS * 0.5) {
    out.push(`The ${mw(i.battery)} of batteries deliver only ${num(o.bySource.battery)} MWh a day (of ${num(i.battery * BATTERY_HOURS)} possible): there is almost no spare power during the day to charge them. Batteries only help once solar or other supply exceeds daytime demand — pair them with more solar.`);
  }
  if (o.wastedSolarMWh > 200) {
    out.push(`About ${num(o.wastedSolarMWh)} MWh of midday solar is wasted each day. Adding ${mw(Math.min(o.wastedSolarMWh / 4, 3000))} of 4-hour batteries would move it into the evening peak.`);
  }
  if (i.losses > 14) {
    const freed = o.peakDemand * (1 - (1 - i.losses / 100) / (1 - (i.losses - 5) / 100));
    out.push(`Cutting grid losses from ${i.losses}% to ${i.losses - 5}% frees about ${mw(freed)} at peak for roughly ${usd(5 * CAPEX.lossPerPoint * 1e6)}: about ${usd((5 * CAPEX.lossPerPoint * 1e6) / Math.max(1, freed))} per MW, versus ${usd(CAPEX.newCoal * 1e6 / 0.85)} per firm MW of new coal.`);
  }
  if (i.geysers < 300) {
    out.push(`Every 100,000 solar geysers frees about 100 MW of evening peak for about ${usd(100 * CAPEX.geyserPerThousand * 1e6)} — one of the cheapest megawatts available.`);
  }
  if (i.hwangeAvail < 80) {
    out.push(`Restoring Hwange from ${i.hwangeAvail}% to 85% availability adds ${mw(HWANGE_MW * (85 - i.hwangeAvail) / 100)} of firm power without a new plant.`);
  }
  if (o.unservedMWh > 0) {
    out.push(`Load-shedding costs the economy about ${usd(o.econCost)} a year (at USD ${i.voll.toFixed(2)} per lost kWh) — compare with the ${usd(o.capex)} of new investment in this scenario.`);
  }
  if (o.forex > 0) out.push(`Imports and diesel fuel cost about ${usd(o.forex)} a year in foreign currency.`);
  return out;
}

export function computePower(i: Inputs): LabResult {
  const o = runPower(i);
  const ok = o.gapMW <= 1;
  return {
    headline: ok
      ? { label: `Power balance, ${i.year}`, value: "No load-shedding", sub: `Peak ${mw(o.peakDemand)} fully covered`, tone: "good" }
      : { label: `Shortfall at the worst hour (${hh(o.worstHour)}), ${i.year}`, value: mw(o.gapMW), sub: `≈ ${o.shedHours.toFixed(1)} hours of load-shedding per customer per day`, tone: "bad" },
    metrics: [
      { label: "Peak demand", value: mw(o.peakDemand), sub: `at ${hh(o.peakHour)}, after savings` },
      { label: "Firm supply", value: mw(o.firmMW), sub: "hydro, coal, thermals, imports" },
      { label: "Average cost of power", value: `${o.avgCost.toFixed(1)} c/kWh`, sub: `${usd(o.annualCost)} a year`, tone: o.avgCost > 12 ? "warn" : "neutral" },
      { label: "New investment needed", value: usd(o.capex), sub: `≈ ${num(Math.round(o.jobs))} construction job-years` },
      { label: "Cost of load-shedding to economy", value: usd(o.econCost), sub: "per year", tone: o.econCost > 0 ? "bad" : "good" },
      { label: "Forex on imports + diesel", value: usd(o.forex), sub: "per year", tone: o.forex > 3e8 ? "warn" : "neutral" },
    ],
    working: [
      `Peak demand ${i.year} = ${num(i.baseDemand)} × (1 + ${i.growth}%)^${i.year - 2025} + ${num(i.newIndustry)} MW industry + ${num(i.newConnections)}k homes × ${i.kwPerHome} kW, adjusted for losses (${BASE_LOSS}% → ${i.losses}%).`,
      `Spread over 24 hours with a typical Zimbabwe load shape (peak at 18:00–19:00), then reduced by geysers, efficiency, rooftop solar, mines' own power and load shifting.`,
      `Each hour served cheapest-first: solar → Kariba → new hydro → Hwange → new coal → imports → small thermals; batteries (${BATTERY_HOURS}h, ${Math.round(BATTERY_EFF * 100)}% efficient) charge from spare capacity and cover the worst hours; diesel last.`,
      `Unserved energy ${num(o.unservedMWh)} MWh/day ÷ demand ${num(o.demandMWh)} MWh/day × 24 = ${o.shedHours.toFixed(1)} hours of load-shedding per customer per day.`,
      `Energy formula: MWh = MW × hours × capacity factor. 1,000 MW of solar ≈ ${num(SOLAR_SHAPE.reduce((a, b) => a + b, 0) * 1000)} MWh/day (≈ ${num(SOLAR_SHAPE.reduce((a, b) => a + b, 0) * 1000 / 24)} MW round-the-clock).`,
      `Economic cost = unserved kWh × USD ${i.voll}/kWh × 365. Capex counts only additions above the 2025 system.`,
    ],
    insights: powerInsights(i, o),
  };
}

// ---------- Auto-solve: close the gap at least cost ----------
interface Lever { key: string; label: string; step: number; max: (i: Inputs) => number; dir: 1 | -1; pair?: { key: string; step: number; max: number } }
const LEVERS: Lever[] = [
  { key: "losses", label: "Cut grid losses (smart meters)", step: 1, max: () => 12, dir: -1 },
  { key: "hwangeAvail", label: "Refurbish Hwange units", step: 2, max: () => 88, dir: 1 },
  { key: "geysers", label: "Solar geysers", step: 25, max: () => 400, dir: 1 },
  { key: "efficiency", label: "Efficiency programme", step: 1, max: () => 8, dir: 1 },
  { key: "shift", label: "Time-of-use load shifting", step: 25, max: () => 350, dir: 1 },
  { key: "battery", label: "Battery storage", step: 50, max: () => 3000, dir: 1 },
  { key: "solar", label: "Solar farms paired with batteries", step: 200, max: () => 5000, dir: 1, pair: { key: "battery", step: 100, max: 3000 } },
  { key: "solar", label: "Utility solar", step: 100, max: () => 5000, dir: 1 },
  { key: "rooftop", label: "Rooftop solar", step: 50, max: () => 1500, dir: 1 },
  { key: "mineSelfGen", label: "Mines' own solar + battery", step: 25, max: () => 300, dir: 1 },
  { key: "imports", label: "More imports", step: 25, max: () => 400, dir: 1 },
  { key: "newCoal", label: "New coal plant", step: 100, max: (i) => (i.year >= 2029 ? 2000 : 0), dir: 1 },
  { key: "newHydro", label: "New hydro (Batoka)", step: 100, max: (i) => (i.year >= 2032 ? 1200 : 0), dir: 1 },
];

export function solvePower(start: Inputs): SolveResult {
  let cur = { ...start };
  let o = runPower(cur);
  const added: Record<string, number> = {};
  // Cost of a step = extra capex + 5 years of any EXTRA running cost. Savings in
  // running cost are not counted as a bonus, so cheap-looking demand cuts can't
  // score as "free" — every lever has to pay its way in capex.
  for (let iter = 0; iter < 400 && o.unservedMWh > 1; iter++) {
    let best: { keys: string[]; next: Inputs; out: PowerOut; score: number } | null = null;
    for (const L of LEVERS) {
      const v = cur[L.key];
      const lim = L.max(cur);
      const nv = v + L.dir * L.step;
      if ((L.dir === 1 && nv > lim) || (L.dir === -1 && nv < lim)) continue;
      const next = { ...cur, [L.key]: nv };
      if (L.pair) {
        const pv = cur[L.pair.key] + L.pair.step;
        if (pv > L.pair.max) continue;
        next[L.pair.key] = pv;
      }
      const out = runPower(next);
      const gain = o.unservedMWh - out.unservedMWh;
      if (gain <= 0.5) continue;
      const cost = Math.max(1e5, out.capex - o.capex + 5 * Math.max(0, out.annualCost - o.annualCost));
      const score = gain / cost;
      if (!best || score > best.score) best = { keys: L.pair ? [L.key, L.pair.key] : [L.key], next, out, score };
    }
    if (!best) break;
    for (const k of best.keys) added[k] = 1;
    cur = best.next;
    o = best.out;
  }
  const base = runPower(start);
  const seen = new Set<string>();
  const steps = LEVERS.flatMap((L) => (L.pair ? [L.key, L.pair.key] : [L.key]))
    .filter((k) => added[k] && cur[k] !== start[k] && !seen.has(k) && seen.add(k))
    .map((k) => {
      const spec = POWER_INPUTS.find((s) => s.key === k)!;
      const L = LEVERS.find((x) => x.key === k);
      return { label: L?.label ?? spec.label, detail: `${spec.label}: ${num(start[k])} → ${num(cur[k])} ${spec.unit}` };
    });
  const closed = o.unservedMWh <= 1;
  return {
    title: closed ? `Cheapest plan to end load-shedding by ${cur.year}` : `Best plan found — gap not fully closed by ${cur.year}`,
    steps,
    summary: closed
      ? `Closes a ${mw(base.gapMW)} shortfall. New investment ${usd(o.capex)}; average cost of power ${o.avgCost.toFixed(1)} c/kWh; saves the economy ${usd(base.econCost)} a year in lost output.`
      : `Shortfall cut from ${mw(base.gapMW)} to ${mw(o.gapMW)}. Remaining options are limited by build dates (coal from 2029, Batoka from 2032) — try a later target year.`,
    inputs: cur,
  };
}

export const POWER_LAB: LabDef = {
  id: "power",
  name: "Power Lab",
  short: "Power",
  question: "How much power does Zimbabwe need, and what is the cheapest way to get it?",
  keywords: ["power", "electric", "mw", "megawatt", "kwh", "solar", "zesa", "load", "shedding", "kariba", "hwange", "battery", "geyser", "energy", "coal", "batoka", "grid", "tariff"],
  inputs: POWER_INPUTS,
  presets: POWER_PRESETS,
  compute: computePower,
  solve: { label: "Find the cheapest plan to end load-shedding", run: solvePower },
};

export const POWER_DEFAULTS = defaults(POWER_INPUTS);
export { hh, pct };
