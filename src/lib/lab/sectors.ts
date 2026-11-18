// Economic Lab — sector calculators beyond power. Same contract as the Power
// Lab: sliders in, headline + metrics + bars + working + insights out.
// Defaults are approximate public figures; every one is editable.

import type { Inputs, LabDef, LabResult, SolveResult } from "./types";
import { num, pct, usd, mw } from "./types";

// ---------------- FUEL & IMPORT BILL ----------------
function landed(i: Inputs) {
  return (i.brent / 159) * 1.25 + i.premium; // USD per litre landed in Zimbabwe
}
function fuelCompute(i: Inputs): LabResult {
  const L = landed(i);
  const diesel = i.dieselML * (1 - i.dieselSub / 100);
  const petrol = i.petrolML * (1 - i.blend / 100);
  const bill = (diesel + petrol) * 1e6 * L;
  const ethanolCost = i.petrolML * (i.blend / 100) * 1e6 * i.ethanolCost;
  const base = { ...i, brent: 75 };
  const baseL = landed(base);
  const pumpDiesel = L + i.taxes + i.margin;
  const pumpBase = baseL + i.taxes + i.margin;
  const transport = ((pumpDiesel - pumpBase) / pumpBase) * 35; // fuel ≈ 35% of trucking cost
  const per10 = (diesel + petrol) * 1e6 * (10 / 159) * 1.25;
  const fullBill = (i.dieselML + i.petrolML) * 1e6 * L;
  const saved = fullBill - bill;
  return {
    headline: { label: "Annual fuel import bill", value: usd(bill), sub: `Brent at USD ${i.brent}/bbl → landed USD ${L.toFixed(2)}/litre`, tone: bill > 1.6e9 ? "bad" : "neutral" },
    metrics: [
      { label: "Diesel pump price", value: `USD ${pumpDiesel.toFixed(2)}/L`, sub: `taxes USD ${i.taxes.toFixed(2)} + margins USD ${i.margin.toFixed(2)}` },
      { label: "Transport cost change vs Brent 75", value: pct(transport), sub: "fuel ≈ 35% of trucking cost", tone: transport > 3 ? "bad" : transport < -3 ? "good" : "neutral" },
      { label: "Each +USD 10/bbl adds", value: usd(per10), sub: "to the import bill per year", tone: "warn" },
      { label: "Forex saved by blending + substitution", value: usd(saved), sub: `ethanol spend kept local ${usd(ethanolCost)}`, tone: saved > 0 ? "good" : "neutral" },
    ],
    bars: {
      title: "Import bill at different oil prices", unit: "USD/yr", format: "usd",
      items: [50, 65, 75, 90, 110, 130].map((b) => ({ label: `Brent USD ${b}`, value: (diesel + petrol) * 1e6 * ((b / 159) * 1.25 + i.premium), highlight: Math.abs(b - i.brent) < 8 })),
    },
    working: [
      `Landed cost = Brent ÷ 159 litres per barrel × 1.25 refining margin + USD ${i.premium.toFixed(2)} freight & handling = USD ${L.toFixed(2)}/L.`,
      `Volumes imported = diesel ${num(i.dieselML)} ML × (1 − ${i.dieselSub}% replaced by solar/electric) + petrol ${num(i.petrolML)} ML × (1 − ${i.blend}% ethanol).`,
      `Bill = volumes × landed cost. Pump price = landed + taxes + margins.`,
    ],
    insights: [
      `Oil price is the swing factor: every USD 10/bbl moves the bill by ${usd(per10)} a year.`,
      i.blend < 15 ? `Raising ethanol blending to E20 would save about ${usd(i.petrolML * 1e6 * ((20 - i.blend) / 100) * L)} in forex a year and support sugar-cane growers.` : `Blending at E${i.blend} already keeps ${usd(i.petrolML * 1e6 * (i.blend / 100) * L)} of forex at home.`,
      `Replacing 20% of diesel used in generators, irrigation pumps and mines with solar saves about ${usd(i.dieselML * 0.2 * 1e6 * L)} a year — and links directly to the Power Lab.`,
    ],
  };
}
function fuelSolve(i: Inputs): SolveResult {
  const target = 0.8 * (i.dieselML + i.petrolML) * 1e6 * landed({ ...i, dieselSub: 0, blend: 0 });
  const cur: Inputs = { ...i, blend: Math.max(i.blend, 20) };
  while (cur.dieselSub < 40) {
    const L = landed(cur);
    const bill = (cur.dieselML * (1 - cur.dieselSub / 100) + cur.petrolML * (1 - cur.blend / 100)) * 1e6 * L;
    if (bill <= target) break;
    cur.dieselSub += 1;
  }
  return {
    title: "Cut the fuel import bill by 20%",
    steps: [
      { label: "Ethanol blending to E20", detail: `Blend ${i.blend}% → ${cur.blend}% (local sugar-cane ethanol)` },
      { label: "Replace diesel with solar/electric", detail: `Gensets, irrigation pumps, mine fleets: ${i.dieselSub}% → ${cur.dieselSub}% of diesel volume` },
    ],
    summary: `Saves about ${usd(target / 0.8 * 0.2)} of forex a year at Brent USD ${i.brent}.`,
    inputs: cur,
  };
}
export const FUEL_LAB: LabDef = {
  id: "fuel", name: "Fuel & Import Bill", short: "Fuel",
  question: "What does an oil price change cost the country, and how do we cut the fuel import bill?",
  keywords: ["fuel", "diesel", "petrol", "oil", "brent", "barrel", "ethanol", "pump price", "import bill"],
  inputs: [
    { key: "brent", label: "Brent crude price", unit: "USD/bbl", min: 40, max: 150, step: 1, default: 75, group: "Market", aliases: ["brent", "oil", "barrel", "crude"] },
    { key: "premium", label: "Freight, handling & landing", unit: "USD/L", min: 0.05, max: 0.5, step: 0.01, default: 0.18, group: "Market", source: "Beira–Feruka pipeline + road; assumption" },
    { key: "dieselML", label: "Diesel consumption", unit: "million L/yr", min: 500, max: 2500, step: 25, default: 1100, group: "Volumes", source: "Approx. national consumption" },
    { key: "petrolML", label: "Petrol consumption", unit: "million L/yr", min: 300, max: 1500, step: 25, default: 650, group: "Volumes" },
    { key: "taxes", label: "Fuel taxes & levies", unit: "USD/L", min: 0, max: 1, step: 0.01, default: 0.5, group: "Pump price" },
    { key: "margin", label: "Dealer & oil company margins", unit: "USD/L", min: 0, max: 0.4, step: 0.01, default: 0.12, group: "Pump price" },
    { key: "blend", label: "Ethanol blend in petrol", unit: "%", min: 0, max: 25, step: 1, default: 5, group: "Policy levers", aliases: ["ethanol", "blend", "e20", "e10"] },
    { key: "ethanolCost", label: "Local ethanol cost", unit: "USD/L", min: 0.3, max: 1.2, step: 0.05, default: 0.7, group: "Policy levers" },
    { key: "dieselSub", label: "Diesel replaced by solar / electric", unit: "%", min: 0, max: 50, step: 1, default: 0, group: "Policy levers", aliases: ["replace diesel", "substitut", "electric vehicles", "ev"] },
  ],
  presets: [
    { id: "base", name: "Brent USD 75", blurb: "Base case", set: {} },
    { id: "shock", name: "Oil shock USD 110", blurb: "Middle East disruption", set: { brent: 110 } },
    { id: "green", name: "E20 + 20% solar", blurb: "Local fuels", set: { blend: 20, dieselSub: 20 } },
  ],
  compute: fuelCompute,
  solve: { label: "Find how to cut the import bill by 20%", run: fuelSolve },
};

// ---------------- FOOD SECURITY (MAIZE) ----------------
function foodNumbers(i: Inputs) {
  const need = i.population * 1e6 * i.kgPerson / 1000 + i.otherUses * 1000; // tonnes
  const dry = i.dryHa * 1000 * i.dryYield * (i.rain / 100);
  const irr = i.irrHa * 1000 * i.irrYield;
  const produced = (dry + irr) * (1 - i.loss / 100);
  return { need, dry, irr, produced, gap: need - produced };
}
function foodCompute(i: Inputs): LabResult {
  const f = foodNumbers(i);
  const short = f.gap > 0;
  const haNeeded = short ? f.gap / (i.irrYield * (1 - i.loss / 100)) : 0;
  const capex = haNeeded * i.irrCost;
  const powerMW = haNeeded * i.kwPerHa / 1000;
  return {
    headline: short
      ? { label: "Maize shortfall this season", value: `${num(Math.round(f.gap / 1000))}k t`, sub: `import bill ≈ ${usd(f.gap * i.importPrice)}`, tone: "bad" }
      : { label: "Maize surplus this season", value: `${num(Math.round(-f.gap / 1000))}k t`, sub: `export potential ≈ ${usd(-f.gap * i.importPrice * 0.8)}`, tone: "good" },
    metrics: [
      { label: "National requirement", value: `${num(Math.round(f.need / 1000))}k t`, sub: "food + livestock + industry" },
      { label: "Production (after losses)", value: `${num(Math.round(f.produced / 1000))}k t`, sub: `rain at ${i.rain}% of normal` },
      { label: "Irrigated hectares to close the gap", value: short ? `${num(Math.round(haNeeded))} ha` : "None needed", sub: short ? `capex ≈ ${usd(capex)}` : undefined },
      { label: "Extra power for irrigation pumps", value: short ? mw(powerMW) : "—", sub: "feed this into the Power Lab", tone: powerMW > 50 ? "warn" : "neutral" },
    ],
    link: short ? { label: `irrigating ${num(Math.round(haNeeded))} more hectares needs about ${mw(powerMW)} of extra power — see what it does to load-shedding.`, lab: "power", key: "newIndustry", add: Math.round(powerMW) } : undefined,
    bars: {
      title: "Where the maize comes from", unit: "t", format: "t",
      items: [
        { label: "Dryland", value: f.dry * (1 - i.loss / 100) },
        { label: "Irrigated", value: f.irr * (1 - i.loss / 100) },
        { label: short ? "Gap (imports)" : "Surplus", value: Math.abs(f.gap), highlight: true },
      ],
    },
    working: [
      `Requirement = ${i.population}m people × ${i.kgPerson} kg + ${num(i.otherUses)}k t livestock/industry = ${num(Math.round(f.need / 1000))}k t.`,
      `Dryland = ${num(i.dryHa)}k ha × ${i.dryYield} t/ha × ${i.rain}% rain factor; irrigated = ${num(i.irrHa)}k ha × ${i.irrYield} t/ha; minus ${i.loss}% post-harvest loss.`,
      `Hectares to close gap = gap ÷ (irrigated yield × (1 − loss)). Capex = hectares × USD ${num(i.irrCost)}/ha.`,
    ],
    insights: [
      `One irrigated hectare produces as much as ${(i.irrYield / Math.max(0.1, i.dryYield * i.rain / 100)).toFixed(0)} dryland hectares this season — irrigation is drought insurance.`,
      `Cutting post-harvest losses from ${i.loss}% to 5% adds ${num(Math.round(((f.dry + f.irr) * Math.max(0, i.loss - 5) / 100) / 1000))}k t without planting anything new.`,
      i.rain > 70 ? `A drought year (rain at 50%) would cost about ${usd(i.dryHa * 1000 * i.dryYield * (i.rain - 50) / 100 * (1 - i.loss / 100) * i.importPrice)} in extra imports.` : `At ${i.rain}% rainfall, dryland output collapses — this is when the irrigated base matters most.`,
    ],
  };
}
function foodSolve(i: Inputs): SolveResult {
  const cur: Inputs = { ...i, loss: Math.min(i.loss, 5) };
  let f = foodNumbers(cur);
  while (f.gap > 0 && cur.irrHa < 500) { cur.irrHa += 5; f = foodNumbers(cur); }
  return {
    title: "Close the maize gap at home",
    steps: [
      { label: "Cut post-harvest losses", detail: `${i.loss}% → ${cur.loss}% (storage, hermetic bags, GMB silos)` },
      { label: "Expand irrigation", detail: `${num(i.irrHa)}k ha → ${num(cur.irrHa)}k ha irrigated` },
    ],
    summary: `Needs about ${usd((cur.irrHa - i.irrHa) * 1000 * i.irrCost)} of irrigation investment and ${mw((cur.irrHa - i.irrHa) * 1000 * i.kwPerHa / 1000)} of extra power.`,
    inputs: cur,
  };
}
export const FOOD_LAB: LabDef = {
  id: "food", name: "Food Security", short: "Food",
  question: "How much maize do we need, and what closes the gap?",
  keywords: ["maize", "food", "grain", "harvest", "irrigation", "drought", "rain", "hectare", "crop", "agric", "farm", "wheat"],
  inputs: [
    { key: "population", label: "Population", unit: "million", min: 14, max: 20, step: 0.1, default: 16.6, group: "Demand", source: "ZIMSTAT 2022 census + growth" },
    { key: "kgPerson", label: "Maize eaten per person", unit: "kg/yr", min: 60, max: 160, step: 5, default: 110, group: "Demand" },
    { key: "otherUses", label: "Livestock feed & industry", unit: "thousand t", min: 0, max: 800, step: 25, default: 400, group: "Demand" },
    { key: "dryHa", label: "Dryland maize area", unit: "thousand ha", min: 400, max: 2500, step: 25, default: 1600, group: "Production", aliases: ["dryland", "area"] },
    { key: "dryYield", label: "Dryland yield (normal rain)", unit: "t/ha", min: 0.3, max: 3, step: 0.1, default: 1.0, group: "Production", aliases: ["yield"] },
    { key: "rain", label: "Rainfall vs normal", unit: "%", min: 30, max: 130, step: 5, default: 100, group: "Production", aliases: ["rain", "drought", "el nino"] },
    { key: "irrHa", label: "Irrigated maize area", unit: "thousand ha", min: 0, max: 500, step: 5, default: 60, group: "Production", aliases: ["irrigat"] },
    { key: "irrYield", label: "Irrigated yield", unit: "t/ha", min: 3, max: 12, step: 0.5, default: 6, group: "Production" },
    { key: "loss", label: "Post-harvest losses", unit: "%", min: 0, max: 30, step: 1, default: 10, group: "Production", aliases: ["post-harvest", "losses"] },
    { key: "importPrice", label: "Import price (landed)", unit: "USD/t", min: 200, max: 600, step: 10, default: 330, group: "Costs" },
    { key: "irrCost", label: "Irrigation development cost", unit: "USD/ha", min: 2000, max: 15000, step: 500, default: 6000, group: "Costs" },
    { key: "kwPerHa", label: "Pumping power per hectare", unit: "kW", min: 0.3, max: 3, step: 0.1, default: 1, group: "Costs" },
  ],
  presets: [
    { id: "normal", name: "Normal season", blurb: "100% rain", set: {} },
    { id: "drought", name: "Drought (El Niño)", blurb: "Rain at 45%", set: { rain: 45 } },
    { id: "irrigate", name: "200k ha irrigated", blurb: "Pfumvudza + dams", set: { irrHa: 200, loss: 6 } },
  ],
  compute: foodCompute,
  solve: { label: "Find how to close the maize gap at home", run: foodSolve },
};

// ---------------- MINING VALUE-ADD (LITHIUM) ----------------
function miningCompute(i: Inputs): LabResult {
  const concProcessed = i.concentrate * 1000 * (i.processed / 100);
  const concRaw = i.concentrate * 1000 - concProcessed;
  const lce = concProcessed / i.ratio;
  const rawValue = i.concentrate * 1000 * i.sc6;
  const mixValue = concRaw * i.sc6 + lce * i.lcePrice;
  const uplift = mixValue - rawValue;
  const royalties = mixValue * i.royalty / 100;
  const capex = lce * i.capexPerT;
  const powerMW = (lce * i.mwhPerT) / 8760;
  const jobs = (lce / 10000) * i.jobsPer10k;
  return {
    headline: { label: "Annual lithium export earnings", value: usd(mixValue), sub: i.processed > 0 ? `${usd(uplift)} more than exporting raw concentrate` : "all exported as raw concentrate", tone: uplift > 0 ? "good" : "neutral" },
    metrics: [
      { label: "Royalties to Treasury", value: usd(royalties), sub: `at ${i.royalty}%` },
      { label: "Processing investment needed", value: usd(capex), sub: `${num(Math.round(lce))} t LCE capacity` },
      { label: "Power needed for processing", value: mw(powerMW), sub: "feed this into the Power Lab", tone: powerMW > 100 ? "warn" : "neutral" },
      { label: "Raw export value (today)", value: usd(rawValue), sub: "if nothing is processed" },
      { label: "Direct jobs in processing", value: num(Math.round(jobs)), sub: "indicative" },
    ],
    link: powerMW > 0.5 ? { label: `processing ${i.processed}% of lithium locally needs about ${mw(powerMW)} of extra power — see what it does to load-shedding.`, lab: "power", key: "newIndustry", add: Math.round(powerMW) } : undefined,
    bars: {
      title: "Export value by share processed locally", unit: "USD/yr", format: "usd",
      items: [0, 25, 50, 75, 100].map((p) => {
        const cp = i.concentrate * 1000 * p / 100;
        return { label: `${p}% processed`, value: (i.concentrate * 1000 - cp) * i.sc6 + (cp / i.ratio) * i.lcePrice, highlight: p === Math.round(i.processed / 25) * 25 };
      }),
    },
    working: [
      `Raw value = ${num(i.concentrate)}k t concentrate × USD ${num(i.sc6)}/t.`,
      `Processing: ${i.ratio} t of concentrate makes 1 t of lithium carbonate equivalent (LCE) worth USD ${num(i.lcePrice)}/t.`,
      `Power = LCE tonnes × ${i.mwhPerT} MWh/t ÷ 8,760 hours.`,
    ],
    insights: [
      `At these prices, processing 1 t of concentrate earns USD ${num(Math.round(i.lcePrice / i.ratio - i.sc6))} more than selling it raw.`,
      `Value-add needs power: ${mw(powerMW)} for this level of processing — that is why the Power Lab and Mining Lab are linked.`,
      `A 30% fall in lithium prices would cut earnings by about ${usd(mixValue * 0.3)}; processing locally protects royalty income because carbonate prices hold up better than concentrate in downturns (check against current market).`,
    ],
  };
}
export const MINING_LAB: LabDef = {
  id: "mining", name: "Mining Value-Add", short: "Mining",
  question: "What is lithium worth if we process it here instead of exporting it raw?",
  keywords: ["lithium", "mining", "mine", "beneficiat", "value add", "value-add", "concentrate", "spodumene", "royalt", "processing", "carbonate", "sulphate"],
  inputs: [
    { key: "concentrate", label: "Spodumene concentrate output", unit: "thousand t/yr", min: 100, max: 3000, step: 50, default: 1000, group: "Output", source: "Approx. combined output of Arcadia, Bikita, Sabi Star, Zulu and others" },
    { key: "sc6", label: "Concentrate price (SC6)", unit: "USD/t", min: 400, max: 6000, step: 50, default: 900, group: "Prices", aliases: ["spodumene price", "concentrate price"] },
    { key: "lcePrice", label: "Lithium carbonate price", unit: "USD/t", min: 5000, max: 80000, step: 500, default: 11000, group: "Prices", aliases: ["carbonate price", "lithium price"] },
    { key: "processed", label: "Share processed locally", unit: "%", min: 0, max: 100, step: 5, default: 0, group: "Policy", aliases: ["processed", "process", "beneficiat", "value add", "value-add"] },
    { key: "ratio", label: "Concentrate per tonne of LCE", unit: "t", min: 6, max: 10, step: 0.5, default: 7.5, group: "Technical" },
    { key: "royalty", label: "Royalty rate", unit: "%", min: 0, max: 15, step: 0.5, default: 7, group: "Policy", aliases: ["royalty"] },
    { key: "capexPerT", label: "Processing capex per t LCE", unit: "USD", min: 8000, max: 40000, step: 1000, default: 20000, group: "Technical" },
    { key: "mwhPerT", label: "Electricity per t LCE", unit: "MWh", min: 3, max: 30, step: 1, default: 12, group: "Technical" },
    { key: "jobsPer10k", label: "Jobs per 10,000 t LCE", unit: "jobs", min: 100, max: 1500, step: 50, default: 500, group: "Technical" },
  ],
  presets: [
    { id: "raw", name: "All raw", blurb: "Today", set: {} },
    { id: "half", name: "50% processed", blurb: "Sulphate/carbonate plants", set: { processed: 50 } },
    { id: "boom", name: "Price recovery", blurb: "SC6 2,000 / LCE 20,000", set: { sc6: 2000, lcePrice: 20000, processed: 50 } },
  ],
  compute: miningCompute,
};

// ---------------- PROJECT APPRAISAL ----------------
function cashflows(i: Inputs) {
  const tax = i.taxRate / 100;
  const dep = i.capex / i.life;
  const annual = (i.revenue - i.opex - dep) * (1 - tax) + dep;
  return { annual, flows: [-i.capex, ...Array.from({ length: i.life }, () => annual)] };
}
function npv(rate: number, flows: number[]) {
  return flows.reduce((s, f, t) => s + f / Math.pow(1 + rate, t), 0);
}
function irr(flows: number[]) {
  let lo = -0.9, hi = 1.5;
  if (npv(hi, flows) > 0) return hi;
  if (npv(lo, flows) < 0) return NaN;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (npv(m, flows) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function projectCompute(i: Inputs): LabResult {
  const { annual, flows } = cashflows(i);
  const v = npv(i.discount / 100, flows) * 1e6;
  const r = irr(flows);
  const payback = annual > 0 ? i.capex / annual : Infinity;
  const taxPaid = Math.max(0, (i.revenue - i.opex - i.capex / i.life) * i.taxRate / 100) * i.life * 1e6;
  return {
    headline: { label: "Net present value", value: usd(v), sub: v >= 0 ? `Worth backing at ${i.discount}% cost of capital` : `Destroys value at ${i.discount}% cost of capital`, tone: v >= 0 ? "good" : "bad" },
    metrics: [
      { label: "Internal rate of return", value: Number.isFinite(r) ? pct(r * 100) : "n/a", tone: r * 100 >= i.discount ? "good" : "bad" },
      { label: "Payback", value: Number.isFinite(payback) ? `${payback.toFixed(1)} years` : "never" },
      { label: "Jobs per USD 1m invested", value: num(i.jobs / i.capex, 1), sub: `${num(i.jobs)} jobs` },
      { label: "Corporate tax over life", value: usd(taxPaid) },
    ],
    bars: {
      title: "NPV at different costs of capital", unit: "USD", format: "usd",
      items: [8, 10, 12, 15, 18, 22].map((d) => ({ label: `${d}%`, value: npv(d / 100, flows) * 1e6, highlight: d === i.discount })),
    },
    working: [
      `Annual cash flow = (revenue ${i.revenue} − opex ${i.opex} − depreciation ${(i.capex / i.life).toFixed(1)}) × (1 − ${i.taxRate}% tax) + depreciation = USD ${annual.toFixed(1)}m.`,
      `NPV = −capex + Σ cash flow ÷ (1 + ${i.discount}%)^t over ${i.life} years. IRR = rate where NPV = 0.`,
    ],
    insights: [
      v >= 0 ? `The project clears a ${i.discount}% hurdle with ${usd(v)} to spare.` : `Revenue would need to rise to about USD ${breakEvenRevenue(i).toFixed(1)}m a year for NPV to reach zero.`,
      `Country risk matters: at 18% cost of capital NPV is ${usd(npv(0.18, flows) * 1e6)} — lowering perceived risk (guarantees, stable policy) directly creates value.`,
    ],
  };
}
function breakEvenRevenue(i: Inputs) {
  let lo = 0, hi = i.capex * 5 + i.opex * 5 + 1000;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (npv(i.discount / 100, cashflows({ ...i, revenue: m }).flows) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
export const PROJECT_LAB: LabDef = {
  id: "project", name: "Project Appraisal", short: "Projects",
  question: "Is this investment worth backing?",
  keywords: ["npv", "irr", "project", "payback", "appraisal", "worth", "investment case", "feasib", "return"],
  inputs: [
    { key: "capex", label: "Investment (capex)", unit: "USD m", min: 1, max: 2000, step: 1, default: 100, group: "Project", aliases: ["capex", "investment", "project", "cost"] },
    { key: "revenue", label: "Annual revenue", unit: "USD m", min: 0, max: 1000, step: 1, default: 30, group: "Project", aliases: ["revenue", "sales"] },
    { key: "opex", label: "Annual operating cost", unit: "USD m", min: 0, max: 800, step: 1, default: 12, group: "Project", aliases: ["opex", "operating"] },
    { key: "life", label: "Project life", unit: "years", min: 5, max: 40, step: 1, default: 20, group: "Project", aliases: ["life", "years"] },
    { key: "discount", label: "Cost of capital", unit: "%", min: 5, max: 30, step: 1, default: 12, group: "Finance", aliases: ["discount", "cost of capital", "hurdle", " at "] },
    { key: "taxRate", label: "Corporate tax", unit: "%", min: 0, max: 35, step: 0.25, default: 25.75, group: "Finance", source: "24% + 3% AIDS levy" },
    { key: "jobs", label: "Permanent jobs", unit: "jobs", min: 0, max: 10000, step: 10, default: 300, group: "Impact", aliases: ["jobs"] },
  ],
  presets: [
    { id: "base", name: "Generic USD 100m", blurb: "Base case", set: {} },
    { id: "solar", name: "100 MW solar IPP", blurb: "USD 70m, 20 yrs", set: { capex: 70, revenue: 11, opex: 1.5, life: 25, jobs: 40 } },
    { id: "factory", name: "Fertiliser plant", blurb: "USD 300m", set: { capex: 300, revenue: 140, opex: 95, life: 25, jobs: 900 } },
  ],
  compute: projectCompute,
  solve: {
    label: "Find the break-even revenue",
    run: (i) => {
      const r = breakEvenRevenue(i);
      return { title: "Break-even revenue", steps: [{ label: "Revenue needed for NPV = 0", detail: `USD ${r.toFixed(1)}m a year at ${i.discount}% cost of capital` }], summary: `Current revenue USD ${i.revenue}m is ${i.revenue >= r ? "above" : "below"} break-even.`, inputs: { ...i, revenue: Math.ceil(r) } };
    },
  },
};

// ---------------- TAX INCENTIVE CHECK ----------------
function taxCompute(i: Inputs): LabResult {
  const d = i.discount / 100;
  let foregone = 0, gained = 0;
  for (let t = 1; t <= i.horizon; t++) {
    const disc = Math.pow(1 + d, t);
    const corp = i.profit * i.taxRate / 100;
    if (t <= i.holiday) foregone += corp / disc;
    else gained += corp / disc;
    gained += (i.jobs * i.wage * i.paye / 100) / 1e6 / disc;
  }
  // Additional projects (a%) bring new tax after the holiday + PAYE; projects that
  // would have come anyway (1 − a%) simply lose the holiday-years tax.
  const a = i.additionality / 100;
  const net = (gained * a - foregone * (1 - a)) * 1e6;
  return {
    headline: { label: "Net gain to Treasury (present value)", value: usd(net), sub: net >= 0 ? "The incentive pays for itself" : "The incentive costs more than it brings", tone: net >= 0 ? "good" : "bad" },
    metrics: [
      { label: "Tax given up during holiday", value: usd(foregone * 1e6), sub: `${i.holiday} years × ${i.taxRate}% of USD ${i.profit}m profit` },
      { label: "Tax collected after (if project comes)", value: usd(gained * 1e6), sub: "corporate tax + PAYE" },
      { label: "Additionality", value: pct(i.additionality, 0), sub: "chance the project only comes because of the incentive" },
      { label: "Break-even additionality", value: pct(breakEvenAdd(i), 0), tone: "warn" },
    ],
    working: [
      `Without the incentive, a project that would have come anyway pays full tax — so the holiday is pure loss on those (1 − ${i.additionality}%).`,
      `With it, additional projects (${i.additionality}%) bring tax after the holiday plus PAYE on ${num(i.jobs)} jobs × USD ${num(i.wage)} × ${i.paye}%.`,
      `All values discounted at ${i.discount}% over ${i.horizon} years.`,
    ],
    insights: [
      `The incentive only works if at least ${pct(breakEvenAdd(i), 0)} of projects would not have come without it.`,
      `Shorter holidays with job-linked conditions (e.g. tax credit per local job) usually beat blanket holidays.`,
    ],
  };
}
function breakEvenAdd(i: Inputs) {
  for (let a = 0; a <= 100; a++) {
    const d = i.discount / 100; let f = 0, g = 0;
    for (let t = 1; t <= i.horizon; t++) { const disc = Math.pow(1 + d, t); const corp = i.profit * i.taxRate / 100; if (t <= i.holiday) f += corp / disc; else g += corp / disc; g += (i.jobs * i.wage * i.paye / 100) / 1e6 / disc; }
    if (g * a / 100 - f * (1 - a / 100) >= 0) return a;
  }
  return 100;
}
export const TAX_LAB: LabDef = {
  id: "tax", name: "Tax Incentive Check", short: "Incentives",
  question: "Does a tax holiday pay for itself?",
  keywords: ["tax holiday", "incentive", "sez", "special economic zone", "tax break", "exemption", "holiday"],
  inputs: [
    { key: "profit", label: "Annual profit before tax", unit: "USD m", min: 1, max: 500, step: 1, default: 30, group: "Project" },
    { key: "jobs", label: "Jobs created", unit: "jobs", min: 0, max: 20000, step: 50, default: 800, group: "Project", aliases: ["jobs"] },
    { key: "wage", label: "Average annual wage", unit: "USD", min: 1000, max: 30000, step: 100, default: 4800, group: "Project" },
    { key: "taxRate", label: "Corporate tax", unit: "%", min: 0, max: 35, step: 0.25, default: 25.75, group: "Tax" },
    { key: "paye", label: "Average PAYE rate", unit: "%", min: 0, max: 40, step: 1, default: 15, group: "Tax" },
    { key: "holiday", label: "Tax holiday length", unit: "years", min: 0, max: 15, step: 1, default: 5, group: "Incentive", aliases: ["holiday"] },
    { key: "additionality", label: "Projects that come only because of it", unit: "%", min: 0, max: 100, step: 5, default: 50, group: "Incentive", aliases: ["additional"] },
    { key: "horizon", label: "Horizon", unit: "years", min: 5, max: 30, step: 1, default: 15, group: "Finance" },
    { key: "discount", label: "Discount rate", unit: "%", min: 3, max: 20, step: 1, default: 10, group: "Finance" },
  ],
  presets: [
    { id: "sez", name: "SEZ 5-year holiday", blurb: "Base case", set: {} },
    { id: "long", name: "10-year holiday", blurb: "Generous", set: { holiday: 10 } },
  ],
  compute: taxCompute,
};

// ---------------- JOBS MULTIPLIER ----------------
const SECTORS = [
  { v: 0, label: "Agriculture & agro-processing", direct: 60, indirect: 1.5 },
  { v: 1, label: "Manufacturing", direct: 25, indirect: 1.8 },
  { v: 2, label: "Mining", direct: 8, indirect: 2.2 },
  { v: 3, label: "Construction & housing", direct: 30, indirect: 1.2 },
  { v: 4, label: "Tourism", direct: 40, indirect: 1.6 },
  { v: 5, label: "Solar & energy", direct: 6, indirect: 1.4 },
  { v: 6, label: "ICT & BPO", direct: 15, indirect: 1.3 },
];
function jobsCompute(i: Inputs): LabResult {
  const s = SECTORS[Math.round(i.sector)] ?? SECTORS[0];
  const direct = i.invest * s.direct;
  const indirect = direct * (s.indirect - 1);
  const induced = (direct + indirect) * i.induced / 100;
  const total = direct + indirect + induced;
  return {
    headline: { label: `Jobs from USD ${num(i.invest)}m in ${s.label}`, value: num(Math.round(total)), sub: `${num(Math.round(direct))} direct · ${num(Math.round(indirect))} in suppliers · ${num(Math.round(induced))} from spending`, tone: "good" },
    metrics: [
      { label: "Direct jobs", value: num(Math.round(direct)) },
      { label: "Supplier (indirect) jobs", value: num(Math.round(indirect)) },
      { label: "Induced jobs", value: num(Math.round(induced)), sub: "workers spending wages" },
      { label: "Cost per job", value: usd(i.invest * 1e6 / Math.max(1, total)) },
    ],
    bars: {
      title: `Total jobs from USD ${num(i.invest)}m, by sector`, unit: "jobs", format: "num",
      items: SECTORS.map((x) => { const d = i.invest * x.direct; const t = d * x.indirect * (1 + i.induced / 100); return { label: x.label, value: Math.round(t), highlight: x.v === s.v }; }).sort((a, b) => b.value - a.value),
    },
    working: [
      `Direct = USD ${num(i.invest)}m × ${s.direct} jobs per USD 1m. Indirect = direct × (${s.indirect} − 1). Induced = (direct + indirect) × ${i.induced}%.`,
      `Multipliers are indicative; replace with ZIMSTAT input-output tables for official use.`,
    ],
    insights: [
      `Per dollar, agriculture and tourism create the most jobs; mining and energy create the fewest directly but enable the others.`,
      `To create 100,000 jobs through ${s.label.toLowerCase()} would take about ${usd(100000 / (s.direct * s.indirect * (1 + i.induced / 100)) * 1e6)} of investment.`,
    ],
  };
}
export const JOBS_LAB: LabDef = {
  id: "jobs", name: "Jobs Multiplier", short: "Jobs",
  question: "How many jobs does an investment create, and in which sector?",
  keywords: ["jobs", "employment", "unemploy", "workers", "multiplier", "youth"],
  inputs: [
    { key: "invest", label: "Investment", unit: "USD m", min: 1, max: 5000, step: 1, default: 100, group: "Investment", aliases: ["invest", "investment", "usd", "million"] },
    { key: "sector", label: "Sector", unit: "", min: 0, max: 6, step: 1, default: 0, group: "Investment", options: SECTORS.map((s) => ({ value: s.v, label: s.label })), aliases: ["sector"] },
    { key: "induced", label: "Induced effect (wage spending)", unit: "%", min: 0, max: 100, step: 5, default: 50, group: "Multipliers" },
  ],
  presets: [
    { id: "agri", name: "USD 100m agriculture", blurb: "", set: {} },
    { id: "mine", name: "USD 500m mining", blurb: "", set: { invest: 500, sector: 2 } },
    { id: "tour", name: "USD 200m tourism", blurb: "", set: { invest: 200, sector: 4 } },
  ],
  compute: jobsCompute,
};
