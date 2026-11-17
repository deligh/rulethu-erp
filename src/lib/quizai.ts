// Daily Quiz — AI study & Q&A engine (demo mode).
//
// Lets anyone ask questions about the quiz topics, markets, valuation,
// Zimbabwe / ZSE / SADC and Rulethu's sectors, and get a useful answer — a
// learning resource. Rule-based now; with the Claude API connected,
// `studyAnswer` becomes a full model call with the platform's data as context.

export interface Source { label: string; href: string }
export interface StudyAnswer { title: string; text: string; sources: Source[] }

export interface StudyTopic { id: string; title: string; category: string; blurb: string }

interface Entry { keys: string[]; title: string; text: string; sources?: Source[] }

const KB: Entry[] = [
  {
    keys: ["treasury bill", "t-bill", "tbill", "coupon", "discount yield", "zero coupon", "gilts"],
    title: "Treasury bills & yields",
    text: "A treasury bill is short-dated government debt. You pay a price today (often below face value) and get the face value at maturity, plus any coupon. Return comes from the **discount** (face − price, annualised over the tenor) and/or the **coupon** (periodic interest on face). A zero-coupon bill earns purely from the discount. Portfolio yield is weighted by each bill's face value, and longer tenors are more sensitive to rate moves (duration). Rulethu tracks all this live in the Treasury module.",
    sources: [{ label: "Treasury module", href: "/treasury" }],
  },
  {
    keys: ["npv", "net present value", "discount cash", "present value"],
    title: "NPV (Net Present Value)",
    text: "NPV discounts every future cash flow back to today at the cost of capital (WACC) and sums them. **NPV > 0** means the project earns more than its required return — it creates value. Raising the discount rate lowers NPV (future cash is worth less today). It's the cleanest single test of whether a deal is worth doing.",
    sources: [{ label: "DCF Valuation", href: "/investments/dcf" }, { label: "Model Builder", href: "/investments/models/builder" }],
  },
  {
    keys: ["irr", "internal rate of return", "equity irr", "project irr", "hurdle"],
    title: "IRR (Internal Rate of Return)",
    text: "IRR is the discount rate at which NPV = 0. If IRR is above the hurdle (WACC), the project clears it. **Project IRR** is unlevered; **Equity IRR** is after debt service — leverage can raise or lower it versus the project IRR. Watch out: IRR assumes reinvestment at the IRR and can mislead with unusual cash-flow shapes, so pair it with NPV.",
    sources: [{ label: "Equity Valuation", href: "/investments/valuation" }],
  },
  {
    keys: ["dscr", "debt service", "cover ratio", "covenant"],
    title: "DSCR (Debt-Service Cover Ratio)",
    text: "DSCR = cash available for debt service ÷ debt service (interest + principal). Lenders want it comfortably above 1.0x — typically a **1.2x–1.4x floor** — so there's a buffer to service the loan in a bad year. In project finance the debt is often 'sculpted' to a target DSCR each period.",
    sources: [{ label: "Solar project-finance model", href: "/investments/models/solar" }],
  },
  {
    keys: ["wacc", "cost of capital", "capm", "beta", "cost of equity"],
    title: "WACC & cost of capital",
    text: "WACC blends the cost of equity and after-tax cost of debt by their weights: WACC = Ke·(E/V) + Kd·(1−tax)·(D/V). Cost of equity (Ke) usually comes from CAPM: risk-free + beta × equity-risk-premium. In Zimbabwe the risk-free and ERP are high, so WACCs are often **15–20%+** — which is why capex discipline and strong early cash flows matter so much here.",
    sources: [{ label: "DCF Valuation", href: "/investments/dcf" }],
  },
  {
    keys: ["dcf", "discounted cash flow", "terminal value", "fcff", "free cash flow"],
    title: "DCF valuation",
    text: "A DCF projects unlevered free cash flow (FCFF), discounts it at WACC, adds a terminal value (Gordon-growth or an exit multiple), nets off debt, and divides by shares for a per-share value. **Terminal value often drives most of the number**, so stress the terminal growth and WACC. Rulethu's Equity Valuation does this for ZSE names with comps and a football-field range.",
    sources: [{ label: "Equity Valuation", href: "/investments/valuation" }],
  },
  {
    keys: ["multiple", "ev/ebitda", "p/e", "pe ratio", "comps", "comparable", "ev/sales"],
    title: "Trading multiples & comps",
    text: "Relative valuation applies a peer multiple to a company's metric: EV/EBITDA and EV/Sales give enterprise value (subtract net debt for equity); P/E and P/B give equity value directly. Use the **median** of a clean peer set and cross-check against the DCF. On the ZSE, thin liquidity means multiples can look distorted — triangulate.",
    sources: [{ label: "Equity Valuation", href: "/investments/valuation" }],
  },
  {
    keys: ["working capital", "receivable", "payable", "cash conversion", "inventory"],
    title: "Working capital",
    text: "Working capital is cash tied up in operations: receivables + inventory − payables. **Growth consumes cash** through working capital before profit becomes cash, so a fast-growing company can be profitable yet cash-tight. Managing debtor days, stock and creditor terms is often the fastest lever on cash.",
    sources: [{ label: "Cash Flow Statement", href: "/finance/cash-flow" }],
  },
  {
    keys: ["zimbabwe", "zse", "zwg", "rbz", "inflation", "zimbabwe stock", "victoria falls"],
    title: "Zimbabwe economy & ZSE",
    text: "Zimbabwe runs a multi-currency system — the gold-backed **ZiG/ZWG** alongside the US dollar — with historically high inflation and FX volatility, so most serious models are built in **USD**. Equities trade on the **Zimbabwe Stock Exchange (ZSE)** and the USD-denominated **Victoria Falls Stock Exchange (VFEX)**; liquidity is thin, so position sizing and exit matter. High local discount rates reward hard-currency revenue (exports, PPAs) and tight capex.",
    sources: [{ label: "Equity Valuation (ZSE)", href: "/investments/valuation" }, { label: "Treasury", href: "/treasury" }],
  },
  {
    keys: ["sadc", "southern africa", "regional", "south africa", "zambia", "botswana", "mozambique"],
    title: "SADC markets",
    text: "SADC is a 16-member Southern African bloc (South Africa, Zambia, Botswana, Mozambique, Zimbabwe and more) moving toward freer trade and investment under the SADC Free Trade Area and the broader AfCFTA. For Rulethu it means a cross-border opportunity set — power, mining, infrastructure, agri and logistics corridors — with country-by-country currency, regulatory and off-taker risk to price in.",
    sources: [{ label: "Investments pipeline", href: "/investments" }],
  },
  {
    keys: ["solar", "ipp", "ppa", "renewable", "power", "energy"],
    title: "Solar IPP & power",
    text: "A solar IPP sells power under a long **PPA** (often 20 years) to a utility or C&I off-taker. Economics hinge on specific yield (kWh/kWp), tariff and escalation, degradation (~0.5%/yr after year one), capex ($/Wp), and a senior-debt structure sculpted to a DSCR. In Zimbabwe, hard-currency PPAs that hedge the FX risk are the key to bankability — exactly what the Khayah-style model captures.",
    sources: [{ label: "Solar model", href: "/investments/models/solar" }],
  },
  {
    keys: ["mining", "lithium", "gold", "ore", "commodity", "off-take"],
    title: "Mining & resources",
    text: "Mining projects are front-loaded (big capex, then production) and priced off a commodity curve, so they're sensitive to price and grade. Returns come fast but with no terminal value once reserves deplete. Off-take agreements de-risk revenue. Zimbabwe is rich in lithium, gold and PGMs — a core Rulethu theme — but power, logistics and beneficiation rules shape the economics.",
    sources: [{ label: "Models hub", href: "/investments/models" }],
  },
  {
    keys: ["private equity", "dpi", "tvpi", "moic", "capital call", "j-curve", "distribution", "lp", "fund"],
    title: "Private equity metrics",
    text: "Alternatives are tracked with **DPI** (cash returned ÷ paid-in), **TVPI** (total value ÷ paid-in) and **MOIC**. Early on a fund shows the **J-curve** — negative returns as capital is called and fees bite — before distributions turn it positive. Commitments are drawn via capital calls over time, not all upfront.",
    sources: [{ label: "Alternative Investments", href: "/alternatives" }],
  },
  {
    keys: ["amortization", "amortisation", "loan", "emi", "reducing balance", "flat rate", "microfinance"],
    title: "Loan amortisation",
    text: "Amortisation splits each repayment into interest (on the outstanding balance) and principal. **Reducing-balance** (EMI) charges interest on the falling balance — the true cost; **flat-rate** charges on the original principal, so the effective rate is higher than it looks. Rulethu's MFI amortisation tool models reducing-balance, flat, interest-only, graduated and balloon.",
    sources: [{ label: "Amortisation calculator", href: "/microfinance/amortization" }],
  },
];

export const STUDY_TOPICS: StudyTopic[] = [
  { id: "t1", title: "How a DCF works", category: "Valuation", blurb: "FCFF, WACC, terminal value → per-share value." },
  { id: "t2", title: "IRR vs NPV vs DSCR", category: "Analysis", blurb: "The three numbers every IC paper needs." },
  { id: "t3", title: "Zimbabwe economy & ZSE", category: "Markets", blurb: "ZiG/USD, inflation, ZSE vs VFEX." },
  { id: "t4", title: "SADC opportunity set", category: "Markets", blurb: "Regional trade, power, mining, agri." },
  { id: "t5", title: "Solar IPP economics", category: "Sectors", blurb: "PPA, yield, degradation, DSCR." },
  { id: "t6", title: "Trading multiples & comps", category: "Valuation", blurb: "EV/EBITDA, P/E, when to use which." },
  { id: "t7", title: "Private equity: DPI, TVPI, J-curve", category: "Alternatives", blurb: "How fund returns are measured." },
  { id: "t8", title: "Treasury bills & yields", category: "Markets", blurb: "Coupon, discount, accrual, duration." },
];

/* ------------------------------------------------------------------ */
/* Live AI study — tries Claude via the secure proxy, else rule-based  */
/* ------------------------------------------------------------------ */

const STUDY_SYSTEM =
  "You are the Rulethu AI study tutor inside Rulethu Holdings' in-house ERP. " +
  "Rulethu is an African investment group based in Harare, Zimbabwe, investing " +
  "across private equity, solar/IPP power, mining (lithium, gold, PGMs), " +
  "microfinance/lending, treasury bills and ZSE/VFEX equities (e.g. Proplastics, " +
  "Masimba). Teach the analyst thoroughly and accurately for a Zimbabwe / SADC " +
  "investment context, with USD framing where relevant. Give a complete answer: " +
  "define the concept, explain how it works with a short worked example or the " +
  "key formula, and tie it to how Rulethu would actually use it. Aim for 3-5 " +
  "well-structured paragraphs (use short bullet lists where they help). Use " +
  "**bold** for key terms. Be concrete and correct; don't be terse. Do not " +
  "invent Rulethu-internal figures you were not given.";

/**
 * Live study answer. Calls Claude (cheap Haiku) through the secure proxy; if
 * that isn't available (not deployed / no key / offline), falls back to the
 * built-in knowledge base so the feature always works.
 */
export async function studyAnswerLive(question: string): Promise<StudyAnswer> {
  const q = question.trim();
  if (!q) return studyAnswer(q);

  // Lazy import keeps quizai.ts usable in any context (and SSR-safe).
  try {
    const { askClaude } = await import("./aiClient");
    const text = await askClaude({
      system: STUDY_SYSTEM,
      prompt: q,
      model: "sonnet",
      maxTokens: 1600,
    });
    if (text) {
      // Attach any matching in-app sources from the KB for deep links.
      const rule = studyAnswer(q);
      return { title: rule.title !== "Rulethu AI — study" ? rule.title : "Rulethu AI", text, sources: rule.sources };
    }
  } catch {
    /* fall through to demo */
  }
  return studyAnswer(q);
}

export function studyAnswer(question: string): StudyAnswer {
  const q = question.trim().toLowerCase();
  if (!q) return { title: "Ask me anything", text: "Ask about markets, valuation (DCF, IRR, multiples), Zimbabwe/ZSE, SADC, or Rulethu's sectors (solar, mining, lending). Try a topic below.", sources: [] };
  let best: Entry | null = null; let bestScore = 0;
  for (const e of KB) {
    let score = 0;
    for (const k of e.keys) if (q.includes(k)) score += k.length; // longer key match = stronger
    if (score > bestScore) { bestScore = score; best = e; }
  }
  if (best) return { title: best.title, text: best.text, sources: best.sources ?? [] };
  return {
    title: "Rulethu AI — study",
    text: `In demo mode I answer from a built-in library of markets, valuation, Zimbabwe/SADC and Rulethu-sector topics — I couldn't match "${question.trim()}" to one yet. Once the Claude API key is connected, I'll answer this fully and pull in the platform's own live data and documents. Try one of the topics below, or ask about NPV, IRR, DCF, treasury bills, the ZSE, solar, mining or private equity.`,
    sources: [],
  };
}
