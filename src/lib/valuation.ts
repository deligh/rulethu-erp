// Full listed-equity valuation — for ZSE names (Proplastics, Masimba, …).
// Methods: DCF (FCFF), trading multiples, net asset value, dividend discount.
// All financial figures are in $m; price is per share; shares in millions, so
// equity($m) / shares(m) = price per share directly.

export interface EquityInputs {
  name: string;
  ticker: string;
  currency: string;
  // Market
  sharesOutM: number;     // millions
  currentPrice: number;   // per share
  netDebt: number;        // $m (net of cash; negative = net cash)
  // Financials (latest FY, $m)
  revenue: number;
  ebitda: number;
  ebit: number;
  netIncome: number;
  bookEquity: number;
  da: number;
  capex: number;
  nwcChange: number;
  taxRate: number;
  dps: number;            // dividend per share
  // DCF assumptions
  revGrowth: number;
  ebitMargin: number;
  fadeYears: number;
  wacc: number;
  terminalGrowth: number;
  // Relative-value target multiples
  targetEvEbitda: number;
  targetPe: number;
  targetEvSales: number;
  targetPb: number;
  // Dividend growth
  ddmGrowth: number;
}

export interface DcfYear { year: number; revenue: number; ebit: number; nopat: number; fcff: number; pv: number }
export interface Method { label: string; perShare: number; low: number; high: number; tone: string }

export interface EquityResult {
  marketCap: number; ev: number;
  curEvEbitda: number; curPe: number; curEvSales: number; curPb: number; divYield: number;
  // DCF
  dcfYears: DcfYear[]; dcfEV: number; dcfEquity: number; dcfPerShare: number; terminalPv: number;
  // relative
  relPerShare: { evEbitda: number; pe: number; evSales: number; pb: number };
  relMean: number;
  navPerShare: number;
  ddmPerShare: number;
  // conclusion
  methods: Method[];
  targetPrice: number; low: number; high: number;
  upside: number; rating: "Buy" | "Hold" | "Sell";
}

function dcfPerShare(i: EquityInputs, wacc: number): { ev: number; perShare: number; years: DcfYear[]; terminalPv: number } {
  const daPct = i.revenue ? i.da / i.revenue : 0;
  const capexPct = i.revenue ? i.capex / i.revenue : 0;
  const nwcPct = i.revenue ? i.nwcChange / i.revenue : 0;
  const years: DcfYear[] = [];
  let pvSum = 0; let lastFcff = 0; let rev = i.revenue;
  const n = Math.max(1, Math.round(i.fadeYears));
  for (let y = 1; y <= n; y++) {
    rev = rev * (1 + i.revGrowth);
    const ebit = rev * i.ebitMargin;
    const nopat = ebit * (1 - i.taxRate);
    const fcff = nopat + rev * daPct - rev * capexPct - rev * nwcPct;
    lastFcff = fcff;
    const pv = fcff / Math.pow(1 + wacc, y);
    pvSum += pv;
    years.push({ year: y, revenue: rev, ebit, nopat, fcff, pv });
  }
  const tv = wacc > i.terminalGrowth ? (lastFcff * (1 + i.terminalGrowth)) / (wacc - i.terminalGrowth) : 0;
  const terminalPv = tv / Math.pow(1 + wacc, n);
  const ev = pvSum + terminalPv;
  const equity = ev - i.netDebt;
  return { ev, perShare: equity / i.sharesOutM, years, terminalPv };
}

export function computeEquity(i: EquityInputs): EquityResult {
  const marketCap = i.currentPrice * i.sharesOutM;
  const ev = marketCap + i.netDebt;
  const curEvEbitda = i.ebitda ? ev / i.ebitda : 0;
  const curPe = i.netIncome ? marketCap / i.netIncome : 0;
  const curEvSales = i.revenue ? ev / i.revenue : 0;
  const curPb = i.bookEquity ? marketCap / i.bookEquity : 0;
  const divYield = i.currentPrice ? i.dps / i.currentPrice : 0;

  const base = dcfPerShare(i, i.wacc);
  const hi = dcfPerShare(i, Math.max(0.001, i.wacc - 0.01));
  const lo = dcfPerShare(i, i.wacc + 0.01);

  const relEvEbitda = (i.targetEvEbitda * i.ebitda - i.netDebt) / i.sharesOutM;
  const relPe = (i.targetPe * i.netIncome) / i.sharesOutM;
  const relEvSales = (i.targetEvSales * i.revenue - i.netDebt) / i.sharesOutM;
  const relPb = (i.targetPb * i.bookEquity) / i.sharesOutM;
  const relVals = [relEvEbitda, relPe, relEvSales, relPb].filter((v) => isFinite(v));
  const relMean = relVals.reduce((a, b) => a + b, 0) / relVals.length;
  const relMin = Math.min(...relVals), relMax = Math.max(...relVals);

  const navPerShare = i.bookEquity / i.sharesOutM;
  const ddmPerShare = i.dps > 0 && i.wacc > i.ddmGrowth ? (i.dps * (1 + i.ddmGrowth)) / (i.wacc - i.ddmGrowth) : 0;

  const methods: Method[] = [
    { label: "DCF (FCFF)", perShare: base.perShare, low: lo.perShare, high: hi.perShare, tone: "var(--brand)" },
    { label: "Trading multiples", perShare: relMean, low: relMin, high: relMax, tone: "var(--accent)" },
    { label: "Net asset value", perShare: navPerShare, low: navPerShare * 0.9, high: navPerShare * 1.1, tone: "var(--info)" },
  ];
  if (ddmPerShare > 0) methods.push({ label: "Dividend discount", perShare: ddmPerShare, low: ddmPerShare * 0.85, high: ddmPerShare * 1.15, tone: "var(--pos)" });

  const bases = methods.map((m) => m.perShare).filter((v) => isFinite(v) && v > 0).sort((a, b) => a - b);
  const median = bases.length % 2 ? bases[(bases.length - 1) / 2] : (bases[bases.length / 2 - 1] + bases[bases.length / 2]) / 2;
  const targetPrice = median;
  const low = Math.min(...methods.map((m) => m.low).filter((v) => isFinite(v)));
  const high = Math.max(...methods.map((m) => m.high).filter((v) => isFinite(v)));
  const upside = i.currentPrice ? targetPrice / i.currentPrice - 1 : 0;
  const rating: EquityResult["rating"] = upside > 0.15 ? "Buy" : upside < -0.1 ? "Sell" : "Hold";

  return {
    marketCap, ev, curEvEbitda, curPe, curEvSales, curPb, divYield,
    dcfYears: base.years, dcfEV: base.ev, dcfEquity: base.ev - i.netDebt, dcfPerShare: base.perShare, terminalPv: base.terminalPv,
    relPerShare: { evEbitda: relEvEbitda, pe: relPe, evSales: relEvSales, pb: relPb }, relMean,
    navPerShare, ddmPerShare,
    methods, targetPrice, low, high, upside, rating,
  };
}

export const ZSE_COMPANIES: EquityInputs[] = [
  {
    name: "Proplastics Limited", ticker: "ZSE:PROL", currency: "USD",
    sharesOutM: 420, currentPrice: 0.10, netDebt: 3,
    revenue: 30, ebitda: 6, ebit: 4.5, netIncome: 3, bookEquity: 25, da: 1.5, capex: 3, nwcChange: 1, taxRate: 0.2472, dps: 0.004,
    revGrowth: 0.08, ebitMargin: 0.15, fadeYears: 5, wacc: 0.18, terminalGrowth: 0.04,
    targetEvEbitda: 5, targetPe: 7, targetEvSales: 1.1, targetPb: 1.3, ddmGrowth: 0.05,
  },
  {
    name: "Masimba Holdings", ticker: "ZSE:MSHL", currency: "USD",
    sharesOutM: 242, currentPrice: 0.40, netDebt: 8,
    revenue: 120, ebitda: 14, ebit: 11, netIncome: 7, bookEquity: 35, da: 3, capex: 5, nwcChange: 2, taxRate: 0.2472, dps: 0.02,
    revGrowth: 0.10, ebitMargin: 0.092, fadeYears: 5, wacc: 0.19, terminalGrowth: 0.045,
    targetEvEbitda: 4.5, targetPe: 6.5, targetEvSales: 0.7, targetPb: 1.6, ddmGrowth: 0.06,
  },
];

export const SAMPLE_EQUITY = ZSE_COMPANIES[0];
