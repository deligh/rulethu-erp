"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { askClaude } from "@/lib/aiClient";
import {
  COUNTRIES, ZW, countryById, THRESHOLDS, incomeGroup, INDICATORS, gaps, fmtInd, yearsToReach,
  SECTORS, BUILDER_DEFAULTS, BUILDER_PRESETS, runBuilder, CONCEPTS, ZW_EXPORTS, focusAdvice,
  type BuilderInputs, type Country, type Indicator,
} from "@/lib/desk/economy";
import { textPdf, shareOrDownload } from "@/lib/desk/pdf";
import { Card, Btn, PageHead, AiTag, RichText } from "@/components/desk/ui";

type Tab = "where" | "builder" | "peers" | "focus" | "concepts";
const TABS: [Tab, string][] = [["where", "Where we are"], ["builder", "Growth builder"], ["peers", "Peers & the world"], ["focus", "Where to focus"], ["concepts", "Concepts made simple"]];
const usd = (n: number) => `USD ${Math.round(n).toLocaleString("en-US")}`;
const bn = (n: number) => `USD ${n.toFixed(n >= 100 ? 0 : 1)}bn`;

// ---------- charts ----------
function IncomeLadder({ highlight, ghost }: { highlight: string[]; ghost?: { label: string; pc: number } }) {
  const W = 760, H = 232, x0 = 20, x1 = W - 20;
  const lo = Math.log10(400), hi = Math.log10(100000);
  const x = (v: number) => x0 + ((Math.log10(v) - lo) / (hi - lo)) * (x1 - x0);
  const bands = [
    { from: 400, to: THRESHOLDS.lower, label: "Low", c: "rgba(200,16,46,0.07)" },
    { from: THRESHOLDS.lower, to: THRESHOLDS.upper, label: "Lower-middle", c: "rgba(201,162,39,0.10)" },
    { from: THRESHOLDS.upper, to: THRESHOLDS.high, label: "Upper-middle", c: "rgba(11,110,79,0.08)" },
    { from: THRESHOLDS.high, to: 100000, label: "High income", c: "rgba(28,114,147,0.09)" },
  ];
  // Label placement: Zimbabwe first, then each country takes the first label row
  // (above/below the axis) where it doesn't collide with an already-placed label.
  const ROWS = [140, 76, 156, 60, 172, 44];
  const placed: { row: number; a: number; b: number }[] = [];
  const short = (c: Country) => (c.id === "zw" ? "Zimbabwe" : c.name.replace("United States", "USA").replace("United Kingdom", "UK").replace("South Africa", "S. Africa").replace("South Korea", "S. Korea").replace("Mozambique", "Mozamb."));
  const order = [ZW, ...COUNTRIES.filter((c) => c.id !== "zw").sort((a, b) => a.gdpPc - b.gdpPc)];
  const labelRow = new Map<string, number>();
  for (const c of order) {
    const w = short(c).length * (c.id === "zw" ? 7 : 5.6) + 6, cx = x(c.gdpPc);
    const row = ROWS.find((r) => !placed.some((p) => p.row === r && cx - w / 2 < p.b && cx + w / 2 > p.a)) ?? ROWS[ROWS.length - 1];
    placed.push({ row, a: cx - w / 2, b: cx + w / 2 });
    labelRow.set(c.id, row);
  }
  const sorted = [...COUNTRIES].sort((a, b) => a.gdpPc - b.gdpPc);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Income per person, Zimbabwe and peers">
      {bands.map((b) => (
        <g key={b.label}>
          <rect x={x(b.from)} y={20} width={x(b.to) - x(b.from)} height={168} fill={b.c} />
          <text x={(x(b.from) + x(b.to)) / 2} y={14} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{b.label}</text>
        </g>
      ))}
      <line x1={x0} x2={x1} y1={110} y2={110} stroke="var(--border-strong, #c1c7d0)" />
      {[1000, 2000, 5000, 10000, 20000, 50000].map((t) => <text key={t} x={x(t)} y={204} textAnchor="middle" fontSize="10" fill="var(--text-faint)">{t >= 1000 ? `${t / 1000}k` : t}</text>)}
      <text x={x1} y={224} textAnchor="end" fontSize="10" fill="var(--text-faint)">USD per person (log scale)</text>
      {sorted.map((c) => {
        const hl = highlight.includes(c.id) || c.id === "zw";
        const row = labelRow.get(c.id) ?? 76;
        const above = row < 110;
        return (
          <g key={c.id} opacity={hl ? 1 : 0.5}>
            <line x1={x(c.gdpPc)} x2={x(c.gdpPc)} y1={110} y2={above ? row + 4 : row - 11} stroke={c.id === "zw" ? "#0b6e4f" : "var(--border-strong, #c1c7d0)"} strokeWidth={c.id === "zw" ? 2 : 1} />
            <circle cx={x(c.gdpPc)} cy={110} r={c.id === "zw" ? 7 : 4.5} fill={c.id === "zw" ? "#0b6e4f" : hl ? "#c9a227" : "#a5adba"}><title>{`${c.name}: ${usd(c.gdpPc)} per person`}</title></circle>
            <text x={x(c.gdpPc)} y={row} textAnchor="middle" fontSize={c.id === "zw" ? 12 : 10} fontWeight={c.id === "zw" ? 700 : 400} fill={c.id === "zw" ? "#0b6e4f" : "var(--text-muted)"}>{short(c)}<title>{`${c.name}: ${usd(c.gdpPc)} per person`}</title></text>
          </g>
        );
      })}
      {ghost && (
        <g>
          <circle cx={x(ghost.pc)} cy={110} r={7} fill="none" stroke="#0b6e4f" strokeWidth={2} strokeDasharray="3 2" />
          <text x={x(ghost.pc)} y={32} textAnchor="middle" fontSize="11" fontWeight={700} fill="#0b6e4f">{ghost.label}</text>
          <line x1={x(ZW.gdpPc) + 8} x2={x(ghost.pc) - 9} y1={110} y2={110} stroke="#0b6e4f" strokeWidth={2} markerEnd="url(#arr)" />
          <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#0b6e4f" /></marker></defs>
        </g>
      )}
    </svg>
  );
}

function PathChart({ path, target, year }: { path: { year: number; pc: number }[]; target: number; year: number }) {
  const W = 760, H = 260, x0 = 56, x1 = W - 16, y0 = 18, yb = H - 30;
  const maxV = Math.max(target * 1.15, ...path.map((p) => p.pc)) * 1.05;
  const x = (yr: number) => x0 + ((yr - path[0].year) / (path[path.length - 1].year - path[0].year)) * (x1 - x0);
  const y = (v: number) => yb - (v / maxV) * (yb - y0);
  const line = path.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.pc)}`).join(" ");
  const req = path.map((p, i) => { const t = p.year - 2025; const yrs = year - 2025; const v = path[0].pc * Math.pow(target / path[0].pc, Math.min(t, yrs) / yrs); return `${i ? "L" : "M"}${x(p.year)},${y(t <= yrs ? v : target)}`; }).join(" ");
  const tStep = Math.max(500, Math.ceil(maxV / 4 / 500) * 500); const ticks = [0, 1, 2, 3, 4].map((k) => k * tStep).filter((v) => v <= maxV);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Income per person path">
      {ticks.map((t) => <g key={t}><line x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke="var(--border)" /><text x={x0 - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--text-faint)">{t.toLocaleString()}</text></g>)}
      <line x1={x0} x2={x1} y1={y(target)} y2={y(target)} stroke="#c9a227" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={x1} y={y(target) - 6} textAnchor="end" fontSize="11" fontWeight={700} fill="#a17e12">Upper-middle income (USD {target.toLocaleString()})</text>
      <path d={req} fill="none" stroke="#c9a227" strokeWidth={1.5} opacity={0.6} />
      <path d={line} fill="none" stroke="#0b6e4f" strokeWidth={3} />
      {path.map((p) => <circle key={p.year} cx={x(p.year)} cy={y(p.pc)} r={p.year === year ? 5 : 2.5} fill="#0b6e4f"><title>{`${p.year}: ${usd(p.pc)} per person`}</title></circle>)}
      <line x1={x(year)} x2={x(year)} y1={y0} y2={yb} stroke="var(--text-faint)" strokeDasharray="2 3" />
      <text x={x(year) + 4} y={y0 + 10} fontSize="10" fill="var(--text-faint)">{year}</text>
      {path.filter((_, i) => i % 2 === 0).map((p) => <text key={p.year} x={x(p.year)} y={yb + 16} textAnchor="middle" fontSize="10" fill="var(--text-faint)">{p.year}</text>)}
      <text x={x0} y={10} fontSize="10" fill="var(--text-faint)">USD per person</text>
    </svg>
  );
}

function Bar({ label, value, max, fmt, color = "var(--brand)", sub }: { label: string; value: number; max: number; fmt: (n: number) => string; color?: string; sub?: string }) {
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs mb-1"><span style={{ color: "var(--text-muted)" }}>{label}</span><span className="font-semibold" style={{ color: "var(--text)" }}>{fmt(value)}</span></div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2, #eee)" }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(1.5, Math.min(100, (value / Math.max(0.0001, max)) * 100))}%`, background: color }} /></div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}

// ---------- AI economist ----------
async function askEconomist(q: string, b: BuilderInputs, out: ReturnType<typeof runBuilder>, peers: Country[]): Promise<{ text: string; live: boolean }> {
  const data = COUNTRIES.map((c) => `${c.name}: USD ${c.gdpPc}/person, pop ${c.pop}m, agri ${c.agri}%, industry ${c.ind}%, manufacturing ${c.mfg}%, services ${c.serv}%, exports ${c.exportsPct}% GDP, investment ${c.invest}% GDP, electricity ${c.elec} kWh/person, internet ${c.internet}%, produces: ${c.produces}`).join("\n");
  const text = await askClaude({
    system: `You are the chief economist advising Zimbabwe's Minister of Economic Development. He loves understanding how things work. Explain simply, like a brilliant teacher: short sentences, one clear idea at a time, a concrete Zimbabwe example, and numbers from the data given (all approximate). Structure: a one-sentence answer first, then 3-5 short bullets ("- "), then "So what for Zimbabwe:" with one line. Under 220 words. Never invent precise statistics not in the data; say "approximately" where needed.

COUNTRY DATA (approx., ~2023; Zimbabwe uses ZIMSTAT rebased GDP):
${data}

CURRENT GROWTH-BUILDER SCENARIO: sector growth rates ${JSON.stringify(b.growth)}; weighted real GDP growth ${out.g.toFixed(1)}%/yr; investment ${b.invest}% of GDP (needed ${out.investNeeded.toFixed(0)}% at ICOR ${b.icor}); income per person in ${b.year}: USD ${Math.round(out.pcEnd)}; upper-middle income reached in ${out.umicYear ?? "after 2045"}. Peers currently selected: ${peers.map((p) => p.name).join(", ")}.`,
    prompt: q, model: "sonnet", maxTokens: 2500, timeoutMs: 60000,
  });
  if (text) return { text, live: true };
  const s = q.toLowerCase();
  const c = CONCEPTS.find((k) => s.includes(k.title.toLowerCase().split(" ")[0]) || k.oneLine.toLowerCase().split(" ").some((w) => w.length > 6 && s.includes(w)));
  if (c) return { live: false, text: `${c.oneLine}\n\n${c.simple}\n\nSo what for Zimbabwe: ${c.zim}` };
  return { live: false, text: "Offline mode: open 'Concepts made simple' for plain-English explanations, or connect live AI for a full answer." };
}

export default function EconomyPage() {
  const [tab, setTab] = useState<Tab>("where");
  const [b, setB] = useState<BuilderInputs>(BUILDER_DEFAULTS);
  const [preset, setPreset] = useState("base");
  const [peerIds, setPeerIds] = useState<string[]>(["bw", "za", "zm", "ke", "vn", "my", "cl", "kr"]);
  const [ind, setInd] = useState<keyof Country>("elec");
  const [target, setTarget] = useState("my");
  const [gpc, setGpc] = useState(5);
  const [openC, setOpenC] = useState<string | null>("drivers");
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<{ q: string; text: string; live: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const out = useMemo(() => runBuilder(b), [b]);
  const peers = COUNTRIES.filter((c) => peerIds.includes(c.id));
  const tgt = countryById(target);
  const gapList = useMemo(() => gaps(tgt), [tgt]);
  const indMeta = INDICATORS.find((i) => i.key === ind) as Indicator;

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true); setAns({ q: text, text: "", live: false });
    const r = await askEconomist(text, b, out, peers);
    setAns({ q: text, ...r }); setBusy(false); setQ("");
  };
  const setG = (k: string, v: number) => { setB((x) => ({ ...x, growth: { ...x.growth, [k]: v } })); setPreset("custom"); };

  const verdict = out.umicYear && out.umicYear <= b.year
    ? { tone: "var(--pos)", text: `On track: upper-middle income by ${out.umicYear}.` }
    : { tone: "var(--neg)", text: `At ${out.g.toFixed(1)}% growth, upper-middle income arrives in ${out.umicYear ?? "after 2045"}. Reaching it by ${b.year} needs ≈ ${out.requiredForUmic.toFixed(1)}% a year.` };

  const exportPdf = async () => {
    const body = [
      `THE PICTURE\nZimbabwe: ≈ USD ${ZW.gdpPc.toLocaleString()} per person (${incomeGroup(ZW.gdpPc).toLowerCase()}), GDP ≈ USD ${b.gdp0}bn, ${ZW.pop}m people.`,
      `GROWTH SCENARIO (${BUILDER_PRESETS.find((p) => p.id === preset)?.name ?? "Custom"})\nReal GDP growth ≈ ${out.g.toFixed(1)}% a year → income per person ≈ ${usd(out.pcEnd)} in ${b.year}.\n${verdict.text}\nInvestment needed ≈ ${out.investNeeded.toFixed(0)}% of GDP (today ${b.invest}%): a gap of ≈ ${bn(out.financingGap)} a year.\nPower needed by ${b.year}: ≈ ${Math.round(out.powerMW).toLocaleString()} MW peak (today ≈ 2,100 MW demand).`,
      `WHAT DRIVES THE GROWTH\n${[...out.contributions].sort((x, y) => y.pp - x.pp).map((c) => `• ${c.label}: ${c.pp.toFixed(2)} percentage points`).join("\n")}`,
      `WHERE TO FOCUS (vs ${tgt.name})\n${gapList.slice(0, 5).map((g) => `• ${g.ind.label}: ${g.text}`).join("\n")}\n\n${focusAdvice(tgt, gapList).map((s) => `• ${s}`).join("\n")}`,
      tgt.lesson ? `LESSON FROM ${tgt.name.toUpperCase()}\n${tgt.lesson}` : "",
      ans?.text ? `ECONOMIST'S NOTE\nQ: ${ans.q}\n${ans.text}` : "",
    ].filter(Boolean).join("\n\n");
    shareOrDownload(await textPdf("Economy Builder: where we are and where to focus", "Approximate figures for scenario thinking — verify before public use", body), "Economy Builder");
  };

  return (
    <div>
      <PageHead kicker="Economy Builder" title="Build Zimbabwe's economy" sub="See where we stand, what drives growth, how we compare with the world, and where to concentrate. Every number explains itself." right={<Btn kind="ghost" onClick={exportPdf}>Share as PDF</Btn>} />

      {/* Ask the economist */}
      <Card className="mb-5" style={{ background: "linear-gradient(135deg, #06352a, #0b6e4f)", borderColor: "transparent" }}>
        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the economist… “Why did Botswana grow and Zambia didn't?”" className="flex-1 min-w-0 rounded-xl px-4 py-3 text-sm outline-none" style={{ background: "rgba(255,255,255,0.96)", color: "#172b4d" }} />
          <button type="submit" disabled={busy || !q.trim()} className="rounded-xl px-4 font-semibold text-sm disabled:opacity-60" style={{ background: "#f3d675", color: "#1f1600" }}>{busy ? "…" : "Ask"}</button>
        </form>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {["What makes an economy grow, simply?", "Why did South Korea get rich and we didn't?", "Is a mining boom enough to reach upper-middle income?", "What should Zimbabwe make that it doesn't today?", "How does Chile manage its copper and lithium?"].map((s) => (
            <button key={s} onClick={() => ask(s)} className="text-xs rounded-full px-3 py-1.5 whitespace-nowrap text-white" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>{s}</button>
          ))}
        </div>
        {ans && (
          <div className="mt-4 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-line" style={{ background: "rgba(255,255,255,0.97)", color: "#172b4d" }}>
            <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: "#626f86" }}>{!busy && <AiTag live={ans.live} />} {ans.q}</div>
            {busy ? "Thinking it through…" : <RichText text={ans.text} />}
          </div>
        )}
      </Card>

      <div className="flex gap-1 border-b mb-5 overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="px-3 py-2.5 text-sm border-b-2 whitespace-nowrap" style={{ borderColor: tab === k ? "var(--brand)" : "transparent", color: tab === k ? "var(--brand)" : "var(--text-muted)", fontWeight: tab === k ? 700 : 500 }}>{l}</button>)}
      </div>

      {/* ---------- WHERE WE ARE ---------- */}
      {tab === "where" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Economy (GDP)", `≈ USD ${b.gdp0}bn`, "ZIMSTAT rebased"], ["Income per person", `≈ ${usd(ZW.gdpPc)}`, incomeGroup(ZW.gdpPc)], ["People", `${ZW.pop}m`, `${ZW.urban}% in towns`], ["Gap to upper-middle", `${usd(THRESHOLDS.upper - ZW.gdpPc)}`, `per person (+${Math.round((THRESHOLDS.upper / ZW.gdpPc - 1) * 100)}%)`]].map(([l, v, s]) => (
              <Card key={l} className="!p-3.5"><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{l}</div><div className="text-xl font-bold mt-0.5" style={{ color: "var(--text)" }}>{v}</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s}</div></Card>
            ))}
          </div>
          <Card>
            <h3 className="font-bold" style={{ color: "var(--text)" }}>Where Zimbabwe sits in the world</h3>
            <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Income per person. The dashed circle is where your Growth Builder scenario takes us by {b.year}.</p>
            <IncomeLadder highlight={peerIds} ghost={{ label: `${b.year}: ${usd(out.pcEnd)}`, pc: out.pcEnd }} />
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>What the economy is made of</h3>
              <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>Share of GDP by sector (approximate)</p>
              <div className="space-y-2.5">{[...SECTORS].sort((x, y) => y.share - x.share).map((s) => <Bar key={s.key} label={s.label} value={s.share} max={25} fmt={(n) => `${n}%`} sub={s.hint} />)}</div>
            </Card>
            <Card>
              <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>What we sell to the world</h3>
              <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>Share of goods exports, ≈ 2024</p>
              <div className="space-y-2.5">{ZW_EXPORTS.map((e) => <Bar key={e.label} label={e.label} value={e.share} max={40} fmt={(n) => `${n}%`} color={e.label === "Everything else" ? "#a5adba" : "var(--brand)"} />)}</div>
              <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "var(--lz-yellow-bg)", color: "var(--lz-yellow-fg)" }}>
                <b>The big picture:</b> over 80% of exports are raw minerals and tobacco. Prices are set abroad, so earnings swing with world markets — and most of the value is added in other countries.
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ---------- GROWTH BUILDER ---------- */}
      {tab === "builder" && (
        <div className="space-y-5">
          <div className="flex gap-2 flex-wrap">
            {BUILDER_PRESETS.map((p) => (
              <button key={p.id} onClick={() => { setB((x) => ({ ...x, growth: { ...p.growth }, invest: p.invest ?? BUILDER_DEFAULTS.invest })); setPreset(p.id); }} title={p.blurb} className="text-xs rounded-lg border px-3 py-1.5 font-medium" style={{ borderColor: preset === p.id ? "var(--brand)" : "var(--border)", background: preset === p.id ? "var(--sidebar-active-bg)" : "var(--surface)", color: preset === p.id ? "var(--brand)" : "var(--text)" }}>{p.name}</button>
            ))}
            <span className="text-xs self-center ml-1" style={{ color: "var(--text-faint)" }}>Target year</span>
            {[2030, 2035].map((y) => <button key={y} onClick={() => setB((x) => ({ ...x, year: y }))} className="text-xs rounded-lg border px-3 py-1.5" style={{ borderColor: b.year === y ? "var(--brand)" : "var(--border)", color: b.year === y ? "var(--brand)" : "var(--text-muted)", background: "var(--surface)" }}>{y}</button>)}
          </div>

          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="order-2 lg:order-1">
              <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>Grow each sector</h3>
              <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>Real growth per year. Bigger sectors move the total more.</p>
              {SECTORS.map((s) => (
                <div key={s.key} className="py-1.5">
                  <div className="flex justify-between text-[13px]"><span style={{ color: "var(--text)" }}>{s.label} <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>({s.share}% of GDP)</span></span><b style={{ color: "var(--brand)" }}>{b.growth[s.key]}%</b></div>
                  <input type="range" min={-5} max={20} step={0.5} value={b.growth[s.key]} onChange={(e) => setG(s.key, +e.target.value)} className="w-full" style={{ accentColor: "var(--brand)" }} />
                </div>
              ))}
              <div className="border-t mt-3 pt-3 space-y-2" style={{ borderColor: "var(--border)" }}>
                {([["invest", "Investment rate (scenario; today ≈ 14%)", "% of GDP", 5, 45, 1], ["icor", "ICOR (investment per 1% growth)", "", 2, 7, 0.5], ["popGrowth", "Population growth", "%/yr", 0, 3, 0.1]] as const).map(([k, l, u, mn, mx, st]) => (
                  <div key={k}>
                    <div className="flex justify-between text-[13px]"><span style={{ color: "var(--text)" }}>{l}</span><b style={{ color: "var(--text)" }}>{b[k]}{u ? ` ${u}` : ""}</b></div>
                    <input type="range" min={mn} max={mx} step={st} value={b[k]} onChange={(e) => setB((x) => ({ ...x, [k]: +e.target.value }))} className="w-full" style={{ accentColor: "var(--brand)" }} />
                  </div>
                ))}
              </div>
            </Card>

            <div className="order-1 lg:order-2 space-y-5 min-w-0">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Card className="!p-3.5" style={{ borderLeft: "5px solid var(--brand)" }}><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>GDP growth</div><div className="text-2xl font-extrabold" style={{ color: "var(--brand)" }}>{out.g.toFixed(1)}%</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>a year, real</div></Card>
                <Card className="!p-3.5"><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>Income per person {b.year}</div><div className="text-2xl font-extrabold" style={{ color: "var(--text)" }}>{usd(out.pcEnd)}</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{incomeGroup(out.pcEnd)}</div></Card>
                <Card className="!p-3.5"><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>Investment needed</div><div className="text-2xl font-extrabold" style={{ color: out.investNeeded > b.invest + 1 ? "var(--neg)" : "var(--pos)" }}>{out.investNeeded.toFixed(0)}%</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>of GDP (scenario {b.invest}%)</div></Card>
                <Card className="!p-3.5"><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>Power needed {b.year}</div><div className="text-2xl font-extrabold" style={{ color: "var(--text)" }}>{Math.round(out.powerMW).toLocaleString()} MW</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>peak demand (≈ 2,100 today)</div></Card>
              </div>

              <Card style={{ borderColor: verdict.tone }}>
                <div className="font-bold" style={{ color: verdict.tone }}>{verdict.text}</div>
                <ul className="text-sm mt-2 space-y-1.5" style={{ color: "var(--text)" }}>
                  <li>• <b>The investment test:</b> {out.g.toFixed(1)}% growth × ICOR {b.icor} = investment of ≈ {out.investNeeded.toFixed(0)}% of GDP. {out.supported >= out.g - 0.05 ? `Investment of ${b.invest}% of GDP is enough (it supports ≈ ${out.supported.toFixed(1)}%) — but today Zimbabwe invests only ≈ 14%` : `Investment of ${b.invest}% supports only ≈ ${out.supported.toFixed(1)}% growth`}{out.financingGap > 0 ? ` — a gap of ≈ ${bn(out.financingGap)} of investment a year to find (FDI, diaspora, pensions, PPPs)` : ""}.</li>
                  <li>• <b>The power test:</b> this economy needs ≈ {Math.round(out.powerMW).toLocaleString()} MW at peak by {b.year}. <Link href="/lab" className="font-semibold" style={{ color: "var(--brand)" }}>Check it in the Power Lab →</Link></li>
                  <li>• <b>The doubling test (rule of 70):</b> at {(out.g - b.popGrowth).toFixed(1)}% growth per person, income per person doubles every {out.g - b.popGrowth > 0 ? Math.round(70 / (out.g - b.popGrowth)) : "∞"} years.</li>
                </ul>
              </Card>

              <Card>
                <h3 className="font-bold" style={{ color: "var(--text)" }}>Income per person, {2025}–{Math.max(b.year, 2035)}</h3>
                <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>Green: your scenario. Gold: the path needed to reach upper-middle income by {b.year}.</p>
                <PathChart path={out.path} target={THRESHOLDS.upper} year={b.year} />
              </Card>

              <div className="grid gap-5 md:grid-cols-2">
                <Card>
                  <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>What drives the growth</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>Percentage points each sector adds (share × growth)</p>
                  <div className="space-y-2.5">{[...out.contributions].sort((x, y) => y.pp - x.pp).map((c) => <Bar key={c.key} label={c.label} value={c.pp} max={Math.max(...out.contributions.map((z) => z.pp), 0.1)} fmt={(n) => `${n.toFixed(2)} pp`} />)}</div>
                </Card>
                <Card>
                  <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>Economy in {b.year} vs today</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>Share of GDP — watch the structure change</p>
                  <div className="space-y-2">{out.structureEnd.map((s) => { const now = SECTORS.find((z) => z.key === s.key)!.share; const dlt = s.share - now; return (
                    <div key={s.key} className="flex items-center gap-2 text-xs"><span className="w-36 truncate" style={{ color: "var(--text-muted)" }}>{s.label}</span><span className="w-10 text-right" style={{ color: "var(--text-faint)" }}>{now}%</span><span>→</span><b className="w-12" style={{ color: "var(--text)" }}>{s.share.toFixed(1)}%</b><span style={{ color: dlt > 0.2 ? "var(--pos)" : dlt < -0.2 ? "var(--neg)" : "var(--text-faint)" }}>{dlt > 0 ? "▲" : dlt < 0 ? "▼" : ""}{Math.abs(dlt).toFixed(1)}</span></div>
                  ); })}</div>
                </Card>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn kind="gold" onClick={() => ask(`Explain my current growth scenario simply: what drives it, is it realistic compared with countries that achieved this, and what are the 3 biggest risks?`)}>✦ Explain this scenario to me</Btn>
                <Btn kind="ghost" onClick={() => ask(`What combination of sector growth rates would realistically get Zimbabwe to upper-middle income by ${b.year}, and which countries achieved similar growth?`)}>What would it take?</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- PEERS ---------- */}
      {tab === "peers" && (
        <div className="space-y-5">
          <Card>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Compare Zimbabwe with:</div>
            <div className="flex gap-1.5 flex-wrap">
              {COUNTRIES.filter((c) => c.id !== "zw").map((c) => { const on = peerIds.includes(c.id); return (
                <button key={c.id} onClick={() => setPeerIds((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))} className="text-xs rounded-full border px-2.5 py-1" style={{ borderColor: on ? "var(--brand)" : "var(--border)", background: on ? "var(--sidebar-active-bg)" : "var(--surface)", color: on ? "var(--brand)" : "var(--text-muted)", fontWeight: on ? 700 : 500 }}>{c.flag} {c.name}</button>
              ); })}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <h3 className="font-bold" style={{ color: "var(--text)" }}>{indMeta.label}</h3>
              <select value={ind as string} onChange={(e) => setInd(e.target.value as keyof Country)} className="rounded-lg border px-2 py-1.5 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
                {INDICATORS.map((i) => <option key={i.key as string} value={i.key as string}>{i.label}</option>)}
              </select>
            </div>
            <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>{indMeta.why}</p>
            {(() => { const rows = [ZW, ...peers].sort((x, y) => (y[ind] as number) - (x[ind] as number)); const mx = Math.max(...rows.map((r) => r[ind] as number)); return (
              <div className="space-y-2">{rows.map((c) => <Bar key={c.id} label={`${c.flag} ${c.name}`} value={c[ind] as number} max={mx} fmt={(n) => fmtInd(indMeta, n)} color={c.id === "zw" ? "var(--brand)" : "#a5adba"} />)}</div>
            ); })()}
          </Card>

          <Card>
            <h3 className="font-bold mb-3" style={{ color: "var(--text)" }}>Side by side</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm whitespace-nowrap">
                <thead><tr style={{ color: "var(--text-faint)" }}><th className="text-left py-2 pr-3 font-medium">Country</th>{INDICATORS.map((i) => <th key={i.key as string} className="text-right px-2 font-medium">{i.label}</th>)}</tr></thead>
                <tbody>
                  {[ZW, ...peers].map((c) => (
                    <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)", background: c.id === "zw" ? "var(--sidebar-active-bg)" : undefined, fontWeight: c.id === "zw" ? 700 : 400 }}>
                      <td className="py-2 pr-3" style={{ color: "var(--text)" }}>{c.flag} {c.name}</td>
                      {INDICATORS.map((i) => { const v = c[i.key] as number, z = ZW[i.key] as number; const better = c.id !== "zw" && (i.better === "high" ? v > z * 1.1 : v < z * 0.9); return <td key={i.key as string} className="text-right px-2 tabular-nums" style={{ color: c.id === "zw" ? "var(--text)" : better ? "var(--pos)" : "var(--text-muted)" }}>{fmtInd(i, v)}</td>; })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>Green = clearly ahead of Zimbabwe. Approximate World Bank / ITU figures, ≈ 2023.</p>
          </Card>

          <Card>
            <h3 className="font-bold" style={{ color: "var(--text)" }}>How long to catch up?</h3>
            <div className="flex items-center gap-3 mt-2 mb-4 flex-wrap">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>If income per person grows</span>
              <input type="range" min={1} max={10} step={0.5} value={gpc} onChange={(e) => setGpc(+e.target.value)} className="w-40" style={{ accentColor: "var(--brand)" }} />
              <b className="text-lg" style={{ color: "var(--brand)" }}>{gpc}% a year</b>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {peers.filter((p) => p.gdpPc > ZW.gdpPc).sort((x, y) => x.gdpPc - y.gdpPc).map((p) => { const yrs = yearsToReach(ZW.gdpPc, p.gdpPc, gpc); return (
                <div key={p.id} className="flex items-center justify-between rounded-lg p-2.5 text-sm" style={{ background: "var(--surface-2, #f4f5f7)" }}>
                  <span style={{ color: "var(--text)" }}>{p.flag} {p.name}'s level today ({usd(p.gdpPc)})</span>
                  <b style={{ color: yrs <= 15 ? "var(--pos)" : yrs <= 30 ? "var(--warn)" : "var(--neg)" }}>{Number.isFinite(yrs) ? `${Math.round(yrs)} yrs (${2025 + Math.round(yrs)})` : "never"}</b>
                </div>
              ); })}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>Their incomes keep growing too, so real catch-up takes longer — the point is how much faster growth shortens the journey.</p>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {[ZW, ...peers].map((c) => (
              <Card key={c.id} className="!p-4">
                <div className="flex justify-between gap-2"><div className="font-bold" style={{ color: "var(--text)" }}>{c.flag} {c.name}</div><span className="text-xs" style={{ color: "var(--text-faint)" }}>{usd(c.gdpPc)}/person</span></div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}><b>Produces:</b> {c.produces}</div>
                {c.lesson && <div className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text)" }}><b style={{ color: "var(--accent)" }}>Lesson:</b> {c.lesson}</div>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ---------- WHERE TO FOCUS ---------- */}
      {tab === "focus" && (
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Benchmark Zimbabwe against</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
                {COUNTRIES.filter((c) => c.id !== "zw").map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name} — {usd(c.gdpPc)}/person</option>)}
              </select>
            </div>
          </Card>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <h3 className="font-bold" style={{ color: "var(--text)" }}>The gaps, biggest first</h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>Zimbabwe as a share of {tgt.name}'s level. Ranked by gap size × how strongly it drives growth.</p>
              <div className="space-y-3.5">
                {gapList.map((g, k) => (
                  <div key={g.ind.key as string}>
                    <div className="flex justify-between text-sm"><span style={{ color: "var(--text)" }}><b className="mr-1" style={{ color: k < 3 ? "var(--neg)" : "var(--text-faint)" }}>{k + 1}.</b>{g.ind.label}</span><span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtInd(g.ind, g.zw)} vs {fmtInd(g.ind, g.peer)}</span></div>
                    <div className="h-3 rounded-full overflow-hidden mt-1 relative" style={{ background: "var(--surface-2, #eee)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, g.ratio * 100)}%`, background: g.ratio < 0.4 ? "var(--neg)" : g.ratio < 0.8 ? "var(--warn)" : "var(--pos)" }} />
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{g.ind.better === "high" ? `${Math.round(Math.min(g.ratio, 9.99) * 100)}% of ${tgt.name}` : g.text} · {g.ind.why}</div>
                  </div>
                ))}
              </div>
            </Card>
            <div className="space-y-5">
              <Card style={{ borderColor: "var(--brand)" }}>
                <h3 className="font-bold mb-2" style={{ color: "var(--text)" }}>Where to concentrate</h3>
                <ol className="space-y-2.5">
                  {focusAdvice(tgt, gapList).map((s, k) => <li key={k} className="flex gap-2.5 text-sm" style={{ color: "var(--text)" }}><span className="h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 text-white" style={{ background: "var(--brand)" }}>{k + 1}</span>{s}</li>)}
                </ol>
              </Card>
              {tgt.lesson && <Card><div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--accent)" }}>How {tgt.name} did it</div><p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{tgt.lesson}</p><div className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>Produces: {tgt.produces}</div></Card>}
              <Btn kind="gold" onClick={() => ask(`Compare Zimbabwe with ${tgt.name}: what exactly did ${tgt.name} do that we should copy, what does not apply to us, and give a 3-step plan.`)}>✦ What should we copy from {tgt.name}?</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ---------- CONCEPTS ---------- */}
      {tab === "concepts" && (
        <div className="grid gap-3 md:grid-cols-2">
          {CONCEPTS.map((c) => { const open = openC === c.id; return (
            <Card key={c.id} className="cursor-pointer" onClick={() => setOpenC(open ? null : c.id)} style={{ borderColor: open ? "var(--brand)" : "var(--border)" }}>
              <div className="flex justify-between gap-2"><div className="font-bold" style={{ color: "var(--text)" }}>{c.title}</div><span style={{ color: "var(--text-faint)" }}>{open ? "−" : "+"}</span></div>
              <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{c.oneLine}</div>
              {open && (
                <div className="mt-3 space-y-2 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
                  <p style={{ color: "var(--text)" }}>{c.simple}</p>
                  <p className="rounded-lg p-3" style={{ background: "var(--sidebar-active-bg)", color: "var(--text)" }}><b style={{ color: "var(--brand)" }}>In Zimbabwe:</b> {c.zim}</p>
                  <div className="flex gap-2 flex-wrap">
                    {c.tab && <Btn kind="ghost" onClick={() => setTab(c.tab as Tab)}>See it in the numbers →</Btn>}
                    <Btn kind="ghost" onClick={() => ask(`Explain "${c.title}" to me with a Zimbabwe example and one example from another country.`)}>Ask the economist</Btn>
                  </div>
                </div>
              )}
            </Card>
          ); })}
        </div>
      )}

      <p className="text-[11px] mt-6" style={{ color: "var(--text-faint)" }}>Figures are approximate (World Bank WDI / ITU ≈ 2023; Zimbabwe GDP per ZIMSTAT 2025 rebasing) and rounded for scenario thinking. Verify against the latest releases before quoting publicly.</p>
    </div>
  );
}
