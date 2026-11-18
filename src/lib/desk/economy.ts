// Economy Builder — data + engine.
// Country figures are APPROXIMATE (World Bank WDI / ITU, ~2023) and rounded for
// scenario thinking; verify against the latest WDI before quoting.
// Zimbabwe GDP uses ZIMSTAT's 2025 rebasing (≈ USD 44bn, ≈ USD 2,650 per person);
// on the pre-rebasing World Bank series it is ≈ USD 2,150 per person.

export interface Country {
  id: string; name: string; flag: string; group: "Zimbabwe" | "Africa" | "Fast risers" | "Advanced";
  pop: number; // millions
  gdpPc: number; // USD per person
  agri: number; ind: number; mfg: number; serv: number; // % of GDP
  exportsPct: number; // exports of goods & services, % GDP
  invest: number; // gross fixed capital formation, % GDP
  elec: number; // electricity use, kWh per person per year
  internet: number; // % of population online
  urban: number; // % urban
  life: number; // life expectancy, years
  produces: string;
  lesson?: string;
}

export const COUNTRIES: Country[] = [
  { id: "zw", name: "Zimbabwe", flag: "🇿🇼", group: "Zimbabwe", pop: 16.6, gdpPc: 2650, agri: 10, ind: 31, mfg: 12, serv: 59, exportsPct: 25, invest: 14, elec: 550, internet: 38, urban: 32, life: 62, produces: "Gold, platinum-group metals, tobacco, lithium, nickel, diamonds, ferrochrome" },
  { id: "bw", name: "Botswana", flag: "🇧🇼", group: "Africa", pop: 2.6, gdpPc: 7800, agri: 2, ind: 33, mfg: 5, serv: 65, exportsPct: 37, invest: 27, elec: 1700, internet: 77, urban: 72, life: 66, produces: "Diamonds, copper, beef", lesson: "One of the world's poorest countries at independence (1966). Took a 50/50 partnership with De Beers (Debswana), saved diamond revenue in the Pula Fund, kept budgets rule-based and institutions strong. Now upper-middle income." },
  { id: "za", name: "South Africa", flag: "🇿🇦", group: "Africa", pop: 62, gdpPc: 6000, agri: 2.5, ind: 25, mfg: 13, serv: 72, exportsPct: 33, invest: 15, elec: 3600, internet: 75, urban: 69, life: 62, produces: "PGMs, gold, coal, iron ore, vehicles, machinery", lesson: "Deep industrial and financial base, but years of power cuts (Eskom) and low investment held growth below 1%. Shows what unreliable power costs a whole economy." },
  { id: "zm", name: "Zambia", flag: "🇿🇲", group: "Africa", pop: 20.6, gdpPc: 1330, agri: 3, ind: 37, mfg: 8, serv: 60, exportsPct: 40, invest: 25, elec: 750, internet: 31, urban: 46, life: 62, produces: "Copper, cobalt, gold, sugar", lesson: "Copper is ~70% of exports, so growth rises and falls with the copper price; debt default in 2020 after the boom ended. A warning on depending on one mineral." },
  { id: "mz", name: "Mozambique", flag: "🇲🇿", group: "Africa", pop: 34, gdpPc: 650, agri: 25, ind: 22, mfg: 8, serv: 53, exportsPct: 40, invest: 30, elec: 500, internet: 21, urban: 39, life: 60, produces: "Aluminium (Mozal), coal, natural gas, electricity, tobacco" },
  { id: "ke", name: "Kenya", flag: "🇰🇪", group: "Africa", pop: 55, gdpPc: 2000, agri: 21, ind: 17, mfg: 7.5, serv: 62, exportsPct: 12, invest: 17, elec: 190, internet: 40, urban: 29, life: 62, produces: "Tea, flowers and horticulture, tourism, ICT services", lesson: "M-Pesa mobile money brought most adults into the financial system and made Nairobi a tech hub — services-led growth without big mineral wealth." },
  { id: "rw", name: "Rwanda", flag: "🇷🇼", group: "Africa", pop: 14, gdpPc: 1000, agri: 25, ind: 21, mfg: 9, serv: 54, exportsPct: 21, invest: 25, elec: 70, internet: 30, urban: 18, life: 67, produces: "Tourism, coffee, tea, minerals, conferences", lesson: "Landlocked and resource-poor, yet ~7% growth for two decades through clean governance, fast business registration and positioning as a conference and tourism hub." },
  { id: "mu", name: "Mauritius", flag: "🇲🇺", group: "Africa", pop: 1.3, gdpPc: 11000, agri: 3, ind: 18, mfg: 12, serv: 79, exportsPct: 50, invest: 20, elec: 2300, internet: 76, urban: 41, life: 74, produces: "Tourism, financial services, textiles, sugar, fish", lesson: "From a sugar economy to textiles (export processing zones in the 1970s), then tourism, then financial and ICT services — each step added higher-value work." },
  { id: "gh", name: "Ghana", flag: "🇬🇭", group: "Africa", pop: 34, gdpPc: 2250, agri: 20, ind: 31, mfg: 10, serv: 49, exportsPct: 35, invest: 13, elec: 600, internet: 70, urban: 59, life: 64, produces: "Gold, cocoa, oil" },
  { id: "vn", name: "Vietnam", flag: "🇻🇳", group: "Fast risers", pop: 100, gdpPc: 4300, agri: 12, ind: 38, mfg: 24, serv: 50, exportsPct: 87, invest: 30, elec: 2800, internet: 79, urban: 39, life: 74, produces: "Phones and electronics, textiles, footwear, machinery", lesson: "Doi Moi reforms (1986) opened the economy to trade and foreign investment. Samsung and others made it an electronics exporter; poverty fell from over half the population to under 5%." },
  { id: "my", name: "Malaysia", flag: "🇲🇾", group: "Fast risers", pop: 34, gdpPc: 11600, agri: 8, ind: 37, mfg: 23, serv: 55, exportsPct: 68, invest: 20, elec: 5200, internet: 97, urban: 78, life: 76, produces: "Semiconductors and electronics, palm oil, LNG, petroleum", lesson: "Moved from rubber and tin to electronics: free-trade zones in Penang drew Intel and others in the 1970s, and local suppliers grew around them. Now near high income." },
  { id: "cl", name: "Chile", flag: "🇨🇱", group: "Fast risers", pop: 19.6, gdpPc: 17000, agri: 4, ind: 31, mfg: 9, serv: 65, exportsPct: 31, invest: 24, elec: 4100, internet: 90, urban: 88, life: 79, produces: "Copper, lithium, fruit, salmon, wine, wood pulp", lesson: "The mining country that got rich: a fiscal rule and copper stabilisation fund saved windfalls, open trade grew fruit, salmon and wine exports, and lithium is run through state–private partnerships." },
  { id: "cn", name: "China", flag: "🇨🇳", group: "Fast risers", pop: 1410, gdpPc: 12600, agri: 7, ind: 38, mfg: 26, serv: 55, exportsPct: 20, invest: 41, elec: 6500, internet: 77, urban: 65, life: 78, produces: "Electronics, machinery, electric vehicles, solar panels, steel", lesson: "Special economic zones (Shenzhen, 1980) tested reforms; export manufacturing plus huge investment in power, roads and ports — investment above 40% of GDP for decades." },
  { id: "kr", name: "South Korea", flag: "🇰🇷", group: "Advanced", pop: 51.7, gdpPc: 33000, agri: 1.6, ind: 32, mfg: 25, serv: 58, exportsPct: 44, invest: 31, elec: 11300, internet: 97, urban: 81, life: 83, produces: "Semiconductors, cars, ships, petrochemicals, steel", lesson: "In 1960 its income per person (≈ USD 160) was below Southern Rhodesia's (≈ USD 280, World Bank series — verify). Export-led industrialisation, mass education and investment above 30% of GDP made it rich in one generation." },
  { id: "sg", name: "Singapore", flag: "🇸🇬", group: "Advanced", pop: 5.9, gdpPc: 84000, agri: 0, ind: 24, mfg: 20, serv: 76, exportsPct: 175, invest: 23, elec: 9000, internet: 96, urban: 100, life: 83, produces: "Electronics, refined petroleum, pharmaceuticals, finance, logistics", lesson: "No natural resources: built a world-class port, clean government and skills, and invited multinationals to make it their regional base." },
  { id: "de", name: "Germany", flag: "🇩🇪", group: "Advanced", pop: 84, gdpPc: 52700, agri: 1, ind: 27, mfg: 18, serv: 72, exportsPct: 47, invest: 22, elec: 6200, internet: 92, urban: 78, life: 81, produces: "Cars, machinery, chemicals, pharmaceuticals", lesson: "Thousands of family-owned specialist manufacturers (the Mittelstand) and apprenticeships that train most young people in a trade." },
  { id: "au", name: "Australia", flag: "🇦🇺", group: "Advanced", pop: 26.6, gdpPc: 65000, agri: 2.5, ind: 26, mfg: 5, serv: 71, exportsPct: 27, invest: 23, elec: 9600, internet: 96, urban: 87, life: 83, produces: "Iron ore, coal, LNG, gold, education, beef", lesson: "A mineral exporter that stayed rich: strong institutions, a sovereign Future Fund, and big service exports such as university education." },
  { id: "us", name: "United States", flag: "🇺🇸", group: "Advanced", pop: 335, gdpPc: 81000, agri: 1, ind: 18, mfg: 10, serv: 81, exportsPct: 11, invest: 21, elec: 12500, internet: 92, urban: 83, life: 77, produces: "Technology, aircraft, oil & gas, financial services, farm products" },
  { id: "gb", name: "United Kingdom", flag: "🇬🇧", group: "Advanced", pop: 68, gdpPc: 48800, agri: 0.6, ind: 17, mfg: 8, serv: 82, exportsPct: 32, invest: 18, elec: 4300, internet: 96, urban: 84, life: 81, produces: "Financial services, cars, pharmaceuticals, machinery" },
];
export const ZW = COUNTRIES[0];
export const countryById = (id: string) => COUNTRIES.find((c) => c.id === id) ?? ZW;

// World Bank income thresholds (GNI per person, FY2025; GDP used as a proxy).
export const THRESHOLDS = { lower: 1146, upper: 4516, high: 14006 };
export function incomeGroup(pc: number) {
  return pc >= THRESHOLDS.high ? "High income" : pc >= THRESHOLDS.upper ? "Upper-middle income" : pc >= THRESHOLDS.lower ? "Lower-middle income" : "Low income";
}

export interface Indicator { key: keyof Country; label: string; unit: string; better: "high" | "low"; why: string; weight: number }
export const INDICATORS: Indicator[] = [
  { key: "gdpPc", label: "Income per person", unit: "USD", better: "high", why: "The scoreboard: what the economy produces per person.", weight: 0 },
  { key: "elec", label: "Electricity per person", unit: "kWh", better: "high", why: "No country has become rich without abundant, reliable power. Factories, mines and irrigation all run on it.", weight: 1.3 },
  { key: "invest", label: "Investment rate", unit: "% of GDP", better: "high", why: "Fast growers invest 25–40% of GDP every year in machines, roads, power and buildings.", weight: 1.3 },
  { key: "mfg", label: "Manufacturing share", unit: "% of GDP", better: "high", why: "Manufacturing raises productivity fastest and creates many formal jobs — the classic ladder out of poverty.", weight: 1.1 },
  { key: "exportsPct", label: "Exports", unit: "% of GDP", better: "high", why: "Exports earn the dollars to import machines and fuel, and force firms to compete with the best.", weight: 1.0 },
  { key: "internet", label: "People online", unit: "%", better: "high", why: "Digital access drives services, mobile money, e-government and new businesses.", weight: 0.7 },
  { key: "urban", label: "Urbanisation", unit: "%", better: "high", why: "Cities concentrate workers and firms; productivity per worker is much higher in towns than in subsistence farming.", weight: 0.5 },
  { key: "life", label: "Life expectancy", unit: "years", better: "high", why: "A healthy workforce works longer and learns more.", weight: 0.5 },
  { key: "agri", label: "Agriculture share", unit: "% of GDP", better: "low", why: "As countries develop, farming becomes more productive and its share of GDP falls while output rises.", weight: 0.3 },
];

export interface Gap { ind: Indicator; zw: number; peer: number; ratio: number; score: number; text: string }
export function gaps(peer: Country, zw: Country = ZW): Gap[] {
  return INDICATORS.filter((i) => i.weight > 0).map((ind) => {
    const a = zw[ind.key] as number, b = peer[ind.key] as number;
    const ratio = ind.better === "high" ? a / Math.max(0.01, b) : b / Math.max(0.01, a);
    const score = Math.max(0, 1 - Math.min(1, ratio)) * ind.weight;
    const text = ind.better === "high"
      ? ratio >= 1 ? `Zimbabwe is level or ahead.` : `Zimbabwe is at ${Math.round(ratio * 100)}% of ${peer.name}'s level (${fmtInd(ind, a)} vs ${fmtInd(ind, b)}).`
      : `Zimbabwe ${fmtInd(ind, a)} vs ${fmtInd(ind, b)}.`;
    return { ind, zw: a, peer: b, ratio, score, text };
  }).sort((x, y) => y.score - x.score);
}
export function fmtInd(ind: Indicator, v: number) {
  if (ind.unit === "USD") return `USD ${Math.round(v).toLocaleString("en-US")}`;
  if (ind.unit === "kWh") return `${Math.round(v).toLocaleString("en-US")} kWh`;
  if (ind.unit === "years") return `${v} yrs`;
  return `${v}%`;
}

/** Years to reach a target income per person at a given per-person growth rate. */
export function yearsToReach(from: number, to: number, gPc: number) {
  if (to <= from) return 0;
  if (gPc <= 0) return Infinity;
  return Math.log(to / from) / Math.log(1 + gPc / 100);
}

// ---------------- Growth builder ----------------
export interface Sector { key: string; label: string; share: number; growth: number; hint: string }
export const SECTORS: Sector[] = [
  { key: "agri", label: "Agriculture", share: 10, growth: 4, hint: "Irrigation, inputs, tobacco, horticulture" },
  { key: "mining", label: "Mining", share: 11, growth: 5, hint: "Gold, PGMs, lithium, chrome" },
  { key: "mfg", label: "Manufacturing", share: 12, growth: 3, hint: "Processing, agro-industry, value addition" },
  { key: "energy", label: "Electricity & water", share: 3, growth: 3, hint: "Power generation, utilities" },
  { key: "constr", label: "Construction", share: 4, growth: 5, hint: "Housing, roads, dams" },
  { key: "trade", label: "Trade & tourism", share: 18, growth: 4, hint: "Retail, hotels, Victoria Falls" },
  { key: "fin", label: "Finance & ICT", share: 12, growth: 6, hint: "Banks, insurance, telecoms, mobile money" },
  { key: "transport", label: "Transport & logistics", share: 5, growth: 4, hint: "Rail, road, dry ports" },
  { key: "public", label: "Public & other services", share: 25, growth: 3, hint: "Government, health, education, real estate" },
];

export interface BuilderInputs {
  growth: Record<string, number>;
  popGrowth: number; // %/yr
  invest: number; // % of GDP
  icor: number; // investment per unit of growth
  gdp0: number; // USD bn, 2025
  year: number; // target year
}
export const BUILDER_DEFAULTS: BuilderInputs = {
  growth: Object.fromEntries(SECTORS.map((s) => [s.key, s.growth])),
  popGrowth: 1.5, invest: 14, icor: 4, gdp0: 44, year: 2030,
};

export interface BuilderOut {
  g: number; // real GDP growth %/yr (weighted)
  contributions: { key: string; label: string; pp: number }[];
  path: { year: number; gdp: number; pc: number }[];
  pcEnd: number;
  investNeeded: number; // % of GDP
  financingGap: number; // USD bn per year
  supported: number; // growth supported by current investment
  powerMW: number; // peak MW needed by target year
  umicYear: number | null;
  requiredForUmic: number; // real GDP growth needed to reach UMIC by target year
  structureEnd: { key: string; label: string; share: number }[];
}

export function runBuilder(b: BuilderInputs): BuilderOut {
  const pop0 = ZW.pop;
  const contributions = SECTORS.map((s) => ({ key: s.key, label: s.label, pp: (s.share / 100) * (b.growth[s.key] ?? 0) }));
  const g = contributions.reduce((a, c) => a + c.pp, 0);
  const path: { year: number; gdp: number; pc: number }[] = [];
  let umicYear: number | null = null;
  const shares = SECTORS.map((s) => s.share);
  let level = shares.slice();
  for (let y = 2025; y <= 2045; y++) {
    const t = y - 2025;
    if (t > 0) level = level.map((v, k) => v * (1 + (b.growth[SECTORS[k].key] ?? 0) / 100));
    const gdp = b.gdp0 * level.reduce((a, v) => a + v, 0) / 100;
    const pop = pop0 * Math.pow(1 + b.popGrowth / 100, t);
    const pc = (gdp * 1e3) / pop; // USD per person (gdp in bn, pop in m)
    if (umicYear === null && pc >= THRESHOLDS.upper) umicYear = y;
    if (y <= Math.max(b.year, 2035)) path.push({ year: y, gdp, pc });
  }
  const end = path.find((p) => p.year === b.year) ?? path[path.length - 1];
  const yrs = b.year - 2025;
  const pc0 = (b.gdp0 * 1e3) / pop0;
  const requiredPc = yrs > 0 ? (Math.pow(THRESHOLDS.upper / pc0, 1 / yrs) - 1) * 100 : 0;
  const requiredForUmic = ((1 + requiredPc / 100) * (1 + b.popGrowth / 100) - 1) * 100;
  const investNeeded = g * b.icor;
  const lvlEnd = SECTORS.map((s, k) => shares[k] * Math.pow(1 + (b.growth[s.key] ?? 0) / 100, yrs));
  const tot = lvlEnd.reduce((a, v) => a + v, 0);
  return {
    g, contributions, path, pcEnd: end.pc,
    investNeeded,
    financingGap: Math.max(0, (investNeeded - ZW.invest) / 100 * b.gdp0), // vs. today's actual investment rate
    supported: b.invest / b.icor,
    powerMW: 2100 * Math.pow(end.gdp / b.gdp0, 0.9),
    umicYear,
    requiredForUmic,
    structureEnd: SECTORS.map((s, k) => ({ key: s.key, label: s.label, share: (lvlEnd[k] / tot) * 100 })),
  };
}

export const BUILDER_PRESETS: { id: string; name: string; blurb: string; growth: Record<string, number>; invest?: number }[] = [
  { id: "base", name: "Current path", blurb: "Recent trends", growth: BUILDER_DEFAULTS.growth },
  { id: "mining", name: "Mining boom only", blurb: "Minerals up, the rest flat", growth: { ...BUILDER_DEFAULTS.growth, mining: 12, constr: 6 } },
  { id: "value", name: "Value addition", blurb: "Process what we mine and grow", growth: { ...BUILDER_DEFAULTS.growth, mining: 7, mfg: 10, energy: 9, agri: 6, transport: 6 }, invest: 24 },
  { id: "tiger", name: "Asian-tiger push", blurb: "Vietnam-style manufacturing & exports", growth: { agri: 6, mining: 8, mfg: 14, energy: 12, constr: 10, trade: 7, fin: 9, transport: 8, public: 4 }, invest: 32 },
];

// ---------------- Concepts ----------------
export interface Concept { id: string; title: string; oneLine: string; simple: string; zim: string; tab?: string }
export const CONCEPTS: Concept[] = [
  { id: "gdp", title: "GDP", oneLine: "The value of everything the country produces in a year.", simple: "Add up the value of every bag of maize, ounce of gold, haircut and bank service produced in Zimbabwe in a year (without double-counting inputs). Divide by the population and you get income per person — the number used to rank countries as low, middle or high income.", zim: "≈ USD 44bn after ZIMSTAT's rebasing, ≈ USD 2,650 per person: lower-middle income.", tab: "where" },
  { id: "drivers", title: "What makes economies grow", oneLine: "More machines, more (and better-skilled) workers, and using both more cleverly.", simple: "Economists split growth into three engines: capital (investment in machines, power, roads), labour (more workers, better skills), and productivity — getting more output from the same inputs through technology, better management, reliable power and good policy. Rich countries got rich mainly through productivity.", zim: "Investment is ≈ 14% of GDP versus 25–40% in fast growers; power shortages cut productivity across mining and manufacturing.", tab: "builder" },
  { id: "icor", title: "ICOR — the price of growth", oneLine: "How much investment buys one percentage point of growth.", simple: "ICOR (incremental capital-output ratio) is a rule of thumb: in most developing countries, every 1% of extra growth needs investment of about 3–5% of GDP. So 7% growth needs investment near 28% of GDP. If investment is 14%, growth tends to settle near 3–4%.", zim: "At 14% investment and an ICOR of 4, the economy can sustain ≈ 3.5% growth. Doubling growth means roughly doubling investment — or using capital more efficiently (lower ICOR).", tab: "builder" },
  { id: "tfp", title: "Productivity (TFP)", oneLine: "Getting more output from the same people and machines.", simple: "Total factor productivity is the 'cleverness' term: same workers and equipment, more output — because power doesn't cut out, permits come quickly, firms adopt better technology, and markets work. It explains most of the gap between rich and poor countries.", zim: "Load-shedding means machines stand idle; ending it is one of the fastest productivity gains available.", tab: "focus" },
  { id: "value", title: "Value addition", oneLine: "Processing raw materials at home captures more of the final price.", simple: "Selling raw ore captures only a slice of the final value; each processing step (concentrate → chemical → battery material → battery) adds value, skills and jobs. But each step needs power, skills, capital and market access.", zim: "Lithium concentrate sells for ≈ USD 900/t; processed into carbonate it is worth several times more per tonne of ore. See the Mining Value-Add lab.", tab: "builder" },
  { id: "dutch", title: "Resource curse / Dutch disease", oneLine: "Mineral booms can weaken the rest of the economy.", simple: "A mineral boom brings in dollars, raising the currency's value and wages, which makes farms and factories less competitive. When the boom ends, little else is left. Countries avoid it by saving windfalls, investing them in infrastructure and skills, and keeping the rest of the economy competitive.", zim: "Gold and PGMs are over half of exports. Botswana and Chile show how to manage mineral wealth; Zambia shows the risk.", tab: "peers" },
  { id: "complexity", title: "Economic complexity", oneLine: "Rich countries make many sophisticated things; poor countries make a few simple ones.", simple: "A country's know-how shows in what it exports. Countries that export many complex products (machinery, chemicals, electronics) grow faster later, because those capabilities can be recombined into new products. The path is to move into products 'next door' to what you already make.", zim: "Next-door opportunities: from tobacco to processed tobacco and cigarettes, from lithium ore to lithium chemicals, from cotton to garments, from chrome to stainless-steel inputs.", tab: "focus" },
  { id: "mit", title: "Middle-income trap", oneLine: "Growth that stalls before a country becomes rich.", simple: "Cheap labour and raw materials can lift a country to middle income, but then wages rise and that advantage fades. To keep growing, it must shift to higher productivity: skills, technology, better institutions. Many countries stall here for decades.", zim: "Relevant after Zimbabwe reaches upper-middle income — planning for skills and technology now avoids it.", tab: "peers" },
  { id: "demo", title: "Demographic dividend", oneLine: "A young, growing workforce can turbo-charge growth — if there are jobs.", simple: "When a large share of the population is of working age, and they are healthy, educated and employed, output per person jumps. Without jobs, the same young population becomes unemployment and emigration.", zim: "Over 60% of Zimbabweans are under 25. Labour-intensive sectors (agro-processing, manufacturing, tourism) turn that into a dividend.", tab: "builder" },
  { id: "export", title: "Export-led growth", oneLine: "Selling to the world market grows faster than selling only at home.", simple: "The home market is limited; the world market is not. Exporting forces firms to meet world standards, earns foreign currency, and attracts investment. Korea, Vietnam and Mauritius all grew this way.", zim: "Exports are ≈ 25% of GDP versus 87% in Vietnam. AfCFTA opens a 1.3-billion-person market on our doorstep.", tab: "peers" },
  { id: "r70", title: "Rule of 70", oneLine: "How many years it takes to double: 70 ÷ growth rate.", simple: "Divide 70 by the annual growth rate to get the years needed to double. At 2% growth, income doubles in 35 years; at 7%, in 10 years. Small differences in growth make huge differences over a generation.", zim: "At 3% per-person growth, Zimbabwe's income doubles in ≈ 23 years; at 7%, in 10 years.", tab: "peers" },
  { id: "comparative", title: "Comparative advantage", oneLine: "Specialise in what you do relatively best, trade for the rest.", simple: "A country gains by focusing on what it produces at lowest relative cost — and that advantage can be built (skills, infrastructure, clusters), not only inherited (minerals, climate).", zim: "Natural advantages: minerals, climate for tobacco and horticulture, Victoria Falls, an educated workforce, central position in SADC.", tab: "focus" },
];

// Approximate export mix (share of goods exports, ~2024).
export const ZW_EXPORTS = [
  { label: "Gold", share: 38 },
  { label: "Platinum-group metals", share: 17 },
  { label: "Tobacco", share: 14 },
  { label: "Lithium", share: 7 },
  { label: "Nickel", share: 4 },
  { label: "Diamonds", share: 4 },
  { label: "Ferrochrome & chrome", share: 5 },
  { label: "Everything else", share: 11 },
];

export function focusAdvice(peer: Country, top: Gap[]): string[] {
  const tips: Record<string, string> = {
    elec: "End load-shedding first: losses, Hwange refurbishment, solar + storage (see Power Lab). Every other priority depends on it.",
    invest: "Lift investment towards 25% of GDP: predictable policy, faster licensing, protected investments, and channel diaspora and pension savings into infrastructure.",
    mfg: "Grow manufacturing through value addition — process lithium, chrome, cotton, tobacco and food locally, in SEZs with reliable power.",
    exportsPct: "Push exports beyond raw minerals: horticulture, processed minerals, tourism and services into AfCFTA and Asian markets.",
    internet: "Cut data costs and expand broadband; digitise government services and payments.",
    urban: "Plan productive cities: serviced industrial land, housing and transport near jobs.",
    life: "Keep investing in primary health care — a healthy workforce is a productive one.",
    agri: "Raise farm productivity (irrigation, inputs, storage) so fewer people produce more food and labour moves into higher-value work.",
  };
  return top.filter((g) => g.ratio < 0.95).slice(0, 4).map((g) => tips[g.ind.key as string] ?? g.ind.why);
}
