"use client";

import { useMemo, useRef, useState } from "react";
import { computeFcff, FCFF_SAMPLE, FcffInputs, scenarioTable, fcffSensitivity } from "@/lib/fcff";
import { computeComps, DEFAULT_PEERS, Peer } from "@/lib/comps";
import { fcffXlsx, fcffPdf } from "@/lib/fcffexport";
import { Section, NumField, Tabs } from "@/components/model/ModelKit";
import { PageHeader, Card, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { askClaude } from "@/lib/aiClient";
import { extractText } from "@/lib/files";
import { useAuth } from "@/lib/auth";

const m0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

type Tab = "setup" | "assumptions" | "valuation" | "comps" | "summary" | "scenarios" | "sensitivity";
const TABS = [
  { key: "setup" as const, label: "Set up (AI / upload)" },
  { key: "assumptions" as const, label: "Assumptions" },
  { key: "valuation" as const, label: "DCF Valuation" },
  { key: "comps" as const, label: "Comps (EV/EBITDA · P/E)" },
  { key: "summary" as const, label: "Summary" },
  { key: "scenarios" as const, label: "Scenarios" },
  { key: "sensitivity" as const, label: "Sensitivity" },
];

function extractJson(raw: string): Record<string, unknown> | null {
  let t = (raw ?? "").trim();
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) t = f[1];
  const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

export default function FcffPage() {
  const { user } = useAuth();
  const [inp, setInp] = useState<FcffInputs>(FCFF_SAMPLE);
  const [tab, setTab] = useState<Tab>("valuation");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const r = useMemo(() => computeFcff(inp), [inp]);
  const scn = useMemo(() => scenarioTable(inp), [inp]);
  const sens = useMemo(() => fcffSensitivity(inp), [inp]);

  // Relative valuation (comps)
  const [peers, setPeers] = useState<Peer[]>(DEFAULT_PEERS);
  const derivedEbitda = r.years[0].ebit + r.years[0].da;
  const derivedNi = r.years[0].nopat;
  const [ebitdaOv, setEbitdaOv] = useState<number | null>(null);
  const [niOv, setNiOv] = useState<number | null>(null);
  const subjEbitda = ebitdaOv ?? derivedEbitda;
  const subjNi = niOv ?? derivedNi;
  const netDebt = inp.totalDebt - inp.cash;
  const comps = useMemo(() => computeComps({ ebitda: subjEbitda, netIncome: subjNi, netDebt, shares: inp.shares, peers }),
    [subjEbitda, subjNi, netDebt, inp.shares, peers]);
  const fx = inp.exchangeRate;
  const setPeer = (idx: number, k: keyof Peer, v: string) => setPeers((p) => p.map((x, i) => (i === idx ? { ...x, [k]: k === "name" ? v : Number(v) } : x)));
  const addPeer = () => setPeers((p) => [...p, { name: "New peer", evEbitda: 6, pe: 10 }]);
  const delPeer = (idx: number) => setPeers((p) => p.filter((_, i) => i !== idx));

  // football field (local currency)
  const field = useMemo(() => {
    const rows = [
      { label: "DCF (Bear–Bull)", low: scn[0].perShareLocal, mid: scn[1].perShareLocal, high: scn[2].perShareLocal },
      { label: "EV/EBITDA comps", low: comps.evEbitda.psLow * fx, mid: comps.evEbitda.psMid * fx, high: comps.evEbitda.psHigh * fx },
      { label: "P/E comps", low: comps.pe.psLow * fx, mid: comps.pe.psMid * fx, high: comps.pe.psHigh * fx },
    ];
    const blended = rows.reduce((s, x) => s + x.mid, 0) / rows.length;
    const vals = rows.flatMap((x) => [x.low, x.high]).concat(inp.vwap, inp.lastTraded, blended).filter((x) => isFinite(x) && x > 0);
    return { rows, blended, min: Math.min(...vals) * 0.9, max: Math.max(...vals) * 1.05 };
  }, [scn, comps, fx, inp.vwap, inp.lastTraded]);

  const set = (k: keyof FcffInputs, v: number) => setInp((p) => ({ ...p, [k]: v }));
  const setArr = (k: "revGrowth" | "ebitMargin", idx: number, v: number) => setInp((p) => { const a = [...p[k]]; a[idx] = v; return { ...p, [k]: a }; });

  const applyAi = (o: Record<string, unknown>) => {
    const num = (x: unknown, f: number) => (typeof x === "number" && isFinite(x) ? x : f);
    const arr = (x: unknown, f: number[]) => (Array.isArray(x) && x.length === 5 ? x.map((v, i) => num(v, f[i])) : f);
    setInp((p) => ({
      ...p,
      company: typeof o.company === "string" && o.company ? o.company : p.company,
      currency: typeof o.currency === "string" && o.currency ? o.currency : p.currency,
      baseRevenue: num(o.baseRevenue, p.baseRevenue),
      baseEbitMargin: num(o.baseEbitMargin, p.baseEbitMargin),
      revGrowth: arr(o.revGrowth, p.revGrowth),
      ebitMargin: arr(o.ebitMargin, p.ebitMargin),
      capexPctRev: num(o.capexPctRev, p.capexPctRev),
      daPctRev: num(o.daPctRev, p.daPctRev),
      wcPctOfRevGrowth: num(o.wcPctOfRevGrowth, p.wcPctOfRevGrowth),
      taxRate: num(o.taxRate, p.taxRate),
      wacc: num(o.wacc, p.wacc),
      terminalWacc: num(o.wacc, p.terminalWacc),
      terminalGrowth: num(o.terminalGrowth, p.terminalGrowth),
      terminalReinvestRate: num(o.terminalReinvestRate, p.terminalReinvestRate),
      cash: num(o.cash, p.cash),
      nonOpAssets: num(o.nonOpAssets, p.nonOpAssets),
      totalDebt: num(o.totalDebt, p.totalDebt),
      shares: num(o.shares, p.shares),
    }));
    if (typeof o.rationale === "string") setAiMsg(o.rationale);
  };

  const SYS = "You are an equity analyst at Rulethu Holdings, Harare. From a company description (and any financials provided), propose a full set of FCFF DCF valuation assumptions for an African/SADC-listed or private company. " +
    "Return ONLY a JSON object (no markdown): {\"company\":str,\"currency\":str,\"baseRevenue\":num,\"baseEbitMargin\":num(0-1),\"revGrowth\":[5 nums 0-1],\"ebitMargin\":[5 nums 0-1],\"capexPctRev\":num,\"daPctRev\":num,\"wcPctOfRevGrowth\":num,\"taxRate\":num,\"wacc\":num,\"terminalGrowth\":num,\"terminalReinvestRate\":num,\"cash\":num,\"nonOpAssets\":num,\"totalDebt\":num,\"shares\":num,\"rationale\":str}. " +
    "Use realistic emerging-market figures: WACC typically 0.14-0.20, terminal growth 0.02-0.04, tax ~0.25-0.30. Only fill fields you can reasonably infer; omit unknown numeric fields. Keep rationale to 3-4 sentences explaining the key calls.";

  const suggest = async () => {
    setBusy(true); setAiMsg(null);
    const text = await askClaude({ system: SYS, prompt: `Company description:\n${desc.trim() || inp.company}\n\nPropose the assumptions JSON now.`, model: "haiku", maxTokens: 900 });
    const o = extractJson(text ?? "");
    if (o) { applyAi(o); setTab("assumptions"); } else setAiMsg("Couldn't read AI suggestions — try again or enter assumptions manually.");
    setBusy(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    setBusy(true); setAiMsg("Reading financials…");
    const { text } = await extractText(f);
    if (!text) { setAiMsg("Couldn't read that file. Use an Excel (.xlsx) or CSV with the income statement & balance sheet, or describe the company instead."); setBusy(false); return; }
    const out = await askClaude({ system: SYS, prompt: `Company: ${desc.trim() || "(infer from data)"}\n\nFINANCIALS (extracted):\n${text.slice(0, 5000)}\n\nFrom these actual financials, propose the assumptions JSON now (use the real base revenue, margins, cash, debt and shares where present).`, model: "haiku", maxTokens: 1000 });
    const o = extractJson(out ?? "");
    if (o) { applyAi(o); setAiMsg("Assumptions drafted from your file — review and edit below."); setTab("assumptions"); }
    else setAiMsg("Read the file but couldn't draft assumptions — try describing the company.");
    setBusy(false);
  };

  const genNote = async () => {
    setNoteBusy(true);
    const text = await askClaude({
      system: "You are an equity analyst at Rulethu Holdings, Harare. Write a concise valuation note for the investment committee. Plain text, no markdown. Short labelled sections on their own line: VERDICT, VALUE, KEY DRIVERS, SENSITIVITY, RISKS, RECOMMENDATION. Explain how the intrinsic value is built (FCFF discounted at WACC plus terminal value, bridged to equity), what the result is most sensitive to, and end with a clear call. Indicative analysis, not advice.",
      prompt: `Company: ${inp.company}. Intrinsic value ${inp.currency} ${r.perShare.toFixed(3)}/share (${r.perShareLocal.toFixed(3)} local). Verdict ${r.verdict}. WACC ${pct(inp.wacc)}, terminal growth ${pct(inp.terminalGrowth)}. Revenue ${m0(inp.baseRevenue)} base, growth ${inp.revGrowth.map((g) => pct(g)).join("/")}, EBIT margin ${inp.ebitMargin.map((x) => pct(x)).join("/")}. Equity value ${m0(r.equityValuePriced)}. Last traded ${inp.lastTraded}, VWAP ${inp.vwap} (local). Write the note now.`,
      model: "haiku", maxTokens: 900,
    });
    setNote((text ?? "").replace(/[*_#`]/g, "").trim()); setNoteBusy(false);
  };

  const relPack = () => ({
    peers, evMultMid: comps.evEbitda.multMid, peMultMid: comps.pe.multMid,
    subjEbitda, subjNi, netDebt, fx, rows: field.rows, blended: field.blended, price: inp.vwap,
  });

  const vTone = r.verdict === "UNDERVALUED" ? "live" : r.verdict === "OVERVALUED" ? "neg" : "warn";

  return (
    <div>
      <PageHeader
        title="Company Valuation (FCFF)"
        subtitle="A full in-house FCFF/DCF — type assumptions, let AI draft them from a description or an uploaded model, then calculate intrinsic value per share with scenarios, sensitivity and a follow-able Excel."
        actions={<Badge tone={vTone}>{r.verdict}</Badge>}
      />
      <ModuleTabs moduleKey="investments" />

      {/* headline */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <Card className="rz-rise"><div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>Intrinsic value / share</div><div className="text-2xl font-bold" style={{ color: "var(--brand)" }}>{inp.currency} {r.perShare.toFixed(3)}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>{r.perShareLocal.toFixed(3)} local</div></Card>
        <Card className="rz-rise"><div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>Equity value</div><div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{m0(r.equityValuePriced)}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>at pricing date</div></Card>
        <Card className="rz-rise"><div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>vs VWAP</div><div className="text-2xl font-bold" style={{ color: r.premiumVsVwap >= 0 ? "var(--pos)" : "var(--neg)" }}>{pct(r.premiumVsVwap, 1)}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>premium / (discount)</div></Card>
        <Card className="rz-rise"><div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>WACC / terminal g</div><div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{pct(inp.wacc)}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>g {pct(inp.terminalGrowth)}</div></Card>
      </div>

      {/* export bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => fcffXlsx(inp, r, relPack())} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ Excel (live formulas)</button>
        <button onClick={() => fcffPdf(inp, r, note, user?.name, relPack())} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ PDF{note ? " + note" : ""}</button>
        <button onClick={genNote} disabled={noteBusy} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>{noteBusy ? "Writing…" : "✨ Valuation note (AI)"}</button>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Excel is fully formula-driven — change any assumption and it recalculates.</span>
      </div>
      {note && <Card className="mb-5"><SectionTitle hint="editable · added to the PDF">Valuation note</SectionTitle><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={8} className="w-full rounded-md border px-3 py-2 text-sm mt-2" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} /></Card>}

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === "setup" && (
        <Card>
          <SectionTitle hint="AI drafts assumptions — you review & edit">Let AI set up the valuation</SectionTitle>
          <p className="text-sm mt-1 mb-2" style={{ color: "var(--text-muted)" }}>Describe the company (sector, size, growth outlook, listing), or upload its financials. The AI drafts a full set of assumptions you can then edit.</p>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="e.g. Proplastics — Zimbabwe-listed plastic pipe manufacturer, ~US$23m revenue, recovering margins, replacement capex only, 260m shares, trades ~1.15 ZWG." className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={suggest} disabled={busy} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>{busy ? "Thinking…" : "✨ Suggest assumptions"}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={onFile} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬆ Upload financials (Excel/CSV)</button>
          </div>
          {aiMsg && <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>{aiMsg}</p>}
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>AI figures are a starting point only — always review each assumption. Indicative, not advice.</p>
        </Card>
      )}

      {tab === "assumptions" && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-[420px] lg:shrink-0">
            <Section title="Base year" cols={2}>
              <NumField label="Base revenue" value={inp.baseRevenue} onChange={(v) => set("baseRevenue", v)} suffix="$" step={100000} />
              <NumField label="Base EBIT margin" value={inp.baseEbitMargin * 100} onChange={(v) => set("baseEbitMargin", v / 100)} suffix="%" step={0.5} />
            </Section>
            <Section title="Reinvestment drivers" cols={2}>
              <NumField label="Capex % rev" value={inp.capexPctRev * 100} onChange={(v) => set("capexPctRev", v / 100)} suffix="%" step={0.5} />
              <NumField label="D&A % rev" value={inp.daPctRev * 100} onChange={(v) => set("daPctRev", v / 100)} suffix="%" step={0.5} />
              <NumField label="ΔWC % of Δrev" value={inp.wcPctOfRevGrowth * 100} onChange={(v) => set("wcPctOfRevGrowth", v / 100)} suffix="%" step={1} />
              <NumField label="Terminal RIR" value={inp.terminalReinvestRate * 100} onChange={(v) => set("terminalReinvestRate", v / 100)} suffix="%" step={1} />
            </Section>
            <Section title="Rates" cols={2}>
              <NumField label="WACC" value={inp.wacc * 100} onChange={(v) => { set("wacc", v / 100); set("terminalWacc", v / 100); }} suffix="%" step={0.25} />
              <NumField label="Terminal growth" value={inp.terminalGrowth * 100} onChange={(v) => set("terminalGrowth", v / 100)} suffix="%" step={0.25} />
              <NumField label="Tax rate" value={inp.taxRate * 100} onChange={(v) => set("taxRate", v / 100)} suffix="%" step={1} />
              <NumField label="Illiquidity disc." value={inp.illiquidityDiscount * 100} onChange={(v) => set("illiquidityDiscount", v / 100)} suffix="%" step={1} />
            </Section>
            <Section title="Bridge to equity" cols={2}>
              <NumField label="Cash" value={inp.cash} onChange={(v) => set("cash", v)} suffix="$" step={10000} />
              <NumField label="Non-op assets" value={inp.nonOpAssets} onChange={(v) => set("nonOpAssets", v)} suffix="$" step={10000} />
              <NumField label="Total debt" value={inp.totalDebt} onChange={(v) => set("totalDebt", v)} suffix="$" step={10000} />
              <NumField label="Shares (m)" value={inp.shares / 1_000_000} onChange={(v) => set("shares", v * 1_000_000)} suffix="m" step={1} />
              <NumField label="Roll-forward" value={inp.rollForwardYears} onChange={(v) => set("rollForwardYears", v)} suffix="yrs" step={0.1} />
            </Section>
            <Section title="Market (local currency)" cols={2}>
              <NumField label="Exchange rate" value={inp.exchangeRate} onChange={(v) => set("exchangeRate", v)} suffix="/USD" step={0.1} />
              <NumField label="Last traded" value={inp.lastTraded} onChange={(v) => set("lastTraded", v)} step={0.01} />
              <NumField label="30-day VWAP" value={inp.vwap} onChange={(v) => set("vwap", v)} step={0.01} />
            </Section>
          </div>
          <div className="flex-1 min-w-0 w-full">
            <Card>
              <SectionTitle hint="per-year drivers (FY1–FY5)">Revenue growth & EBIT margin</SectionTitle>
              <div className="mt-2 space-y-3">
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Revenue growth %</div>
                  <div className="grid grid-cols-5 gap-2">{inp.revGrowth.map((g, idx) => <input key={idx} type="number" value={+(g * 100).toFixed(2)} onChange={(e) => setArr("revGrowth", idx, Number(e.target.value) / 100)} className="rounded-md border px-2 py-1.5 text-sm w-full" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />)}</div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>EBIT margin %</div>
                  <div className="grid grid-cols-5 gap-2">{inp.ebitMargin.map((g, idx) => <input key={idx} type="number" value={+(g * 100).toFixed(2)} onChange={(e) => setArr("ebitMargin", idx, Number(e.target.value) / 100)} className="rounded-md border px-2 py-1.5 text-sm w-full" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />)}</div>
                </div>
              </div>
              <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Mid-year discounting is on. Terminal value uses stable growth: FCFF₅₊₁ ÷ (WACC − g).</p>
            </Card>
          </div>
        </div>
      )}

      {tab === "valuation" && (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card>
            <SectionTitle hint="FCFF discounted at WACC">Projection</SectionTitle>
            <Table head={<><Th>Line</Th>{r.years.map((y) => <Th key={y.label} right>FY{y.label.split(" ")[1]}</Th>)}<Th right>Term.</Th></>}>
              <tr><Td strong>Revenue</Td>{r.years.map((y) => <Td key={y.label} right>{m0(y.revenue)}</Td>)}<Td right>{m0(r.terminal.revenue)}</Td></tr>
              <tr><Td>Growth</Td>{r.years.map((y) => <Td key={y.label} right>{pct(y.growth, 1)}</Td>)}<Td right>{pct(inp.terminalGrowth, 1)}</Td></tr>
              <tr><Td>EBIT</Td>{r.years.map((y) => <Td key={y.label} right>{m0(y.ebit)}</Td>)}<Td right>{m0(r.terminal.ebit)}</Td></tr>
              <tr><Td>NOPAT</Td>{r.years.map((y) => <Td key={y.label} right>{m0(y.nopat)}</Td>)}<Td right>{m0(r.terminal.nopat)}</Td></tr>
              <tr><Td>Reinvestment</Td>{r.years.map((y) => <Td key={y.label} right>({m0(y.reinvest)})</Td>)}<Td right>({m0(r.terminal.reinvest)})</Td></tr>
              <tr><Td strong>FCFF</Td>{r.years.map((y) => <Td key={y.label} right strong>{m0(y.fcff)}</Td>)}<Td right strong>{m0(r.terminal.fcff)}</Td></tr>
              <tr><Td>PV</Td>{r.years.map((y) => <Td key={y.label} right>{m0(y.pv)}</Td>)}<Td right>{m0(r.terminal.pvTv)}</Td></tr>
            </Table>
          </Card>
          <Card>
            <SectionTitle hint="PV → equity → per share">Valuation bridge</SectionTitle>
            <Table head={<><Th>Line</Th><Th right>{inp.currency}</Th></>}>
              {r.bridge.map((b) => <tr key={b.label}><Td strong={/equity|pricing/i.test(b.label)}>{b.label}</Td><Td right strong={/equity|pricing/i.test(b.label)}>{m0(b.value)}</Td></tr>)}
              <tr><Td strong>Intrinsic value / share</Td><Td right strong><span style={{ color: "var(--brand)" }}>{inp.currency} {r.perShare.toFixed(3)}</span></Td></tr>
              <tr><Td>Intrinsic / share (local)</Td><Td right>{r.perShareLocal.toFixed(3)}</Td></tr>
              <tr><Td>Last traded (local)</Td><Td right>{inp.lastTraded.toFixed(2)}</Td></tr>
              <tr><Td>Premium vs VWAP</Td><Td right><span style={{ color: r.premiumVsVwap >= 0 ? "var(--pos)" : "var(--neg)" }}>{pct(r.premiumVsVwap, 1)}</span></Td></tr>
              <tr><Td strong>Verdict</Td><Td right><Badge tone={vTone}>{r.verdict}</Badge></Td></tr>
            </Table>
          </Card>
        </div>
      )}

      {tab === "comps" && (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card>
            <div className="flex items-center justify-between gap-2 mb-1">
              <SectionTitle hint="peer trading multiples — edit to your comp set">Comparable companies</SectionTitle>
              <button onClick={addPeer} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>+ Peer</button>
            </div>
            <Table head={<><Th>Company</Th><Th right>EV/EBITDA</Th><Th right>P/E</Th><Th right>{""}</Th></>}>
              {peers.map((p, idx) => (
                <tr key={idx}>
                  <Td><input value={p.name} onChange={(e) => setPeer(idx, "name", e.target.value)} className="w-full bg-transparent text-sm" style={{ color: "var(--text)" }} /></Td>
                  <Td right><input type="number" value={p.evEbitda} onChange={(e) => setPeer(idx, "evEbitda", e.target.value)} className="w-16 text-right bg-transparent text-sm tabular" style={{ color: "var(--text)" }} /></Td>
                  <Td right><input type="number" value={p.pe} onChange={(e) => setPeer(idx, "pe", e.target.value)} className="w-16 text-right bg-transparent text-sm tabular" style={{ color: "var(--text)" }} /></Td>
                  <Td right><button onClick={() => delPeer(idx)} className="text-xs" style={{ color: "var(--neg)" }}>✕</button></Td>
                </tr>
              ))}
              <tr><Td strong>Median</Td><Td right strong>{comps.evEbitda.multMid.toFixed(1)}x</Td><Td right strong>{comps.pe.multMid.toFixed(1)}x</Td><Td right>{""}</Td></tr>
            </Table>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Subject EBITDA<input type="number" value={Math.round(subjEbitda)} onChange={(e) => setEbitdaOv(Number(e.target.value))} className="w-full rounded-md border px-2.5 py-1.5 text-sm mt-1" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} /></label>
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Subject net income<input type="number" value={Math.round(subjNi)} onChange={(e) => setNiOv(Number(e.target.value))} className="w-full rounded-md border px-2.5 py-1.5 text-sm mt-1" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} /></label>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>Net debt {m0(netDebt)} (debt − cash). EBITDA & net income default from the model; edit for reported figures. {(ebitdaOv !== null || niOv !== null) && <button onClick={() => { setEbitdaOv(null); setNiOv(null); }} className="underline" style={{ color: "var(--brand)" }}>reset to model</button>}</p>
          </Card>
          <Card>
            <SectionTitle hint="implied value / share (local)">Relative valuation</SectionTitle>
            <Table head={<><Th>Method</Th><Th right>Low</Th><Th right>Median</Th><Th right>High</Th></>}>
              <tr><Td strong>EV/EBITDA</Td><Td right>{(comps.evEbitda.psLow * fx).toFixed(3)}</Td><Td right strong>{(comps.evEbitda.psMid * fx).toFixed(3)}</Td><Td right>{(comps.evEbitda.psHigh * fx).toFixed(3)}</Td></tr>
              <tr><Td strong>P/E</Td><Td right>{(comps.pe.psLow * fx).toFixed(3)}</Td><Td right strong>{(comps.pe.psMid * fx).toFixed(3)}</Td><Td right>{(comps.pe.psHigh * fx).toFixed(3)}</Td></tr>
              <tr><Td>DCF intrinsic</Td><Td right>{scn[0].perShareLocal.toFixed(3)}</Td><Td right strong><span style={{ color: "var(--brand)" }}>{r.perShareLocal.toFixed(3)}</span></Td><Td right>{scn[2].perShareLocal.toFixed(3)}</Td></tr>
              <tr><Td>Market (VWAP)</Td><Td right>{""}</Td><Td right>{inp.vwap.toFixed(2)}</Td><Td right>{""}</Td></tr>
            </Table>
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>EV/EBITDA: (multiple × EBITDA − net debt) ÷ shares. P/E: multiple × net income ÷ shares. Converted at {fx.toFixed(2)}/USD.</p>
          </Card>
        </div>
      )}

      {tab === "summary" && (
        <Card>
          <SectionTitle hint="DCF vs market multiples vs price (local currency)">Valuation summary — football field</SectionTitle>
          <div className="mt-3 space-y-3">
            {field.rows.map((row) => {
              const span = field.max - field.min || 1;
              const L = ((row.low - field.min) / span) * 100;
              const Wd = ((row.high - row.low) / span) * 100;
              const M = ((row.mid - field.min) / span) * 100;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1"><span style={{ color: "var(--text-muted)" }}>{row.label}</span><span className="tabular" style={{ color: "var(--text)" }}>{row.low.toFixed(2)} – {row.high.toFixed(2)} (mid {row.mid.toFixed(2)})</span></div>
                  <div className="relative h-5 rounded" style={{ background: "var(--surface-2)" }}>
                    <div className="absolute h-5 rounded" style={{ left: `${L}%`, width: `${Math.max(1, Wd)}%`, background: "color-mix(in srgb, var(--brand) 45%, transparent)" }} />
                    <div className="absolute h-5 w-0.5" style={{ left: `${M}%`, background: "var(--brand)" }} />
                  </div>
                </div>
              );
            })}
            {/* price + blended markers */}
            {(() => {
              const span = field.max - field.min || 1;
              const priceL = ((inp.vwap - field.min) / span) * 100;
              const blendL = ((field.blended - field.min) / span) * 100;
              return (
                <div className="relative h-8 mt-2">
                  <div className="absolute top-0 h-8 w-0.5" style={{ left: `${priceL}%`, background: "var(--neg)" }} />
                  <div className="absolute top-0 text-[10px] font-semibold" style={{ left: `${priceL}%`, color: "var(--neg)", transform: "translateX(-50%)" }}>price {inp.vwap.toFixed(2)}</div>
                  <div className="absolute bottom-0 h-8 w-0.5" style={{ left: `${blendL}%`, background: "var(--accent)" }} />
                  <div className="absolute bottom-0 text-[10px] font-semibold" style={{ left: `${blendL}%`, color: "var(--accent)", transform: "translateX(-50%)" }}>blended {field.blended.toFixed(2)}</div>
                </div>
              );
            })()}
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}><div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Blended value / share</div><div className="text-xl font-bold" style={{ color: "var(--brand)" }}>{field.blended.toFixed(3)}</div></div>
            <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}><div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Market (VWAP)</div><div className="text-xl font-bold" style={{ color: "var(--text)" }}>{inp.vwap.toFixed(3)}</div></div>
            <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}><div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Upside to blended</div><div className="text-xl font-bold" style={{ color: field.blended >= inp.vwap ? "var(--pos)" : "var(--neg)" }}>{pct(inp.vwap ? field.blended / inp.vwap - 1 : 0, 1)}</div></div>
          </div>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Blended = average of the DCF, EV/EBITDA and P/E midpoints. Indicative only, not advice.</p>
        </Card>
      )}

      {tab === "scenarios" && (
        <Card>
          <SectionTitle hint="Bear / Base / Bull">Scenario analysis</SectionTitle>
          <Table head={<><Th>Scenario</Th><Th right>Value / share (local)</Th><Th right>vs VWAP</Th><Th>Verdict</Th></>}>
            {scn.map((s) => <tr key={s.key}><Td strong>{s.label}</Td><Td right>{s.perShareLocal.toFixed(3)}</Td><Td right>{pct(inp.vwap ? s.perShareLocal / inp.vwap - 1 : 0, 1)}</Td><Td>{s.verdict}</Td></tr>)}
          </Table>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Bear flexes growth down and margins down; Bull flexes both up. Base is your current assumptions.</p>
        </Card>
      )}

      {tab === "sensitivity" && (
        <Card>
          <SectionTitle hint="intrinsic value / share (local) — WACC × terminal growth">Sensitivity</SectionTitle>
          <div className="overflow-x-auto mt-2">
            <table className="text-sm">
              <thead><tr><th className="px-3 py-2 text-left" style={{ color: "var(--text-faint)" }}>WACC \ g</th>{sens.growths.map((g) => <th key={g} className="px-3 py-2 text-right" style={{ color: "var(--text-faint)" }}>{pct(g, 1)}</th>)}</tr></thead>
              <tbody>
                {sens.waccs.map((w, wi) => (
                  <tr key={w}>
                    <td className="px-3 py-2 font-medium" style={{ color: "var(--text)" }}>{pct(w, 1)}</td>
                    {sens.grid[wi].map((v, gi) => <td key={gi} className="px-3 py-2 text-right tabular" style={{ color: Math.abs(w - inp.wacc) < 1e-6 && Math.abs(sens.growths[gi] - inp.terminalGrowth) < 1e-6 ? "var(--brand)" : "var(--text-muted)", fontWeight: Math.abs(w - inp.wacc) < 1e-6 && Math.abs(sens.growths[gi] - inp.terminalGrowth) < 1e-6 ? 700 : 400 }}>{v.toFixed(3)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
