"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Inputs, InputSpec, LabResult, Metric, Preset, SolveResult } from "@/lib/lab/types";
import { defaults, clampInput } from "@/lib/lab/types";
import { LABS, labById, askLab, briefFromResult, SUGGESTIONS } from "@/lib/lab/ask";
import { runPower, SOURCE_META, type SourceKey } from "@/lib/lab/power";
import { HourlyChart, RankBars } from "./LabCharts";
import { downloadBrief } from "@/lib/lab/brief";

type Saved = { id: string; lab: string; name: string; inputs: Inputs };
const SAVE_KEY = "mdesk-scenarios-v1";

const toneColor = (t?: Metric["tone"]) =>
  t === "good" ? "var(--pos)" : t === "bad" ? "var(--neg)" : t === "warn" ? "var(--warn)" : "var(--text)";

const LAB_ICONS: Record<string, string> = {
  power: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  fuel: "M3 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17M3 22h11M14 9h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3M6 7h5",
  food: "M12 22V12M12 12c0-4 3-7 7-8-1 4-3 7-7 8zm0 0c0-4-3-7-7-8 1 4 3 7 7 8zM12 12V6",
  mining: "M14 4l6 6M4 20l9-9M15 3l-2 2 6 6 2-2a4.2 4.2 0 0 0-6-6z",
  project: "M3 3v18h18M7 15l4-4 3 3 5-6",
  tax: "M19 5 5 19M7 7h.01M17 17h.01M9 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  jobs: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
};

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl border p-4 md:p-5 ${className}`} style={{ background: "var(--surface)", borderColor: "var(--border)", ...style }}>
      {children}
    </div>
  );
}

function SliderRow({ spec, value, onChange }: { spec: InputSpec; value: number; onChange: (v: number) => void }) {
  const changed = value !== spec.default;
  if (spec.options) {
    return (
      <label className="block py-2">
        <span className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{spec.label}</span>
        <select value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
          {spec.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    );
  }
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium flex items-center gap-1.5 min-w-0" style={{ color: "var(--text)" }} title={[spec.source, spec.help].filter(Boolean).join(" · ")}>
          {changed && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />}
          <span className="truncate">{spec.label}</span>
          {(spec.source || spec.help) && <span className="text-[10px] rounded-full border px-1 shrink-0" style={{ color: "var(--text-faint)", borderColor: "var(--border)" }}>i</span>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <input
            type="number" value={value} step={spec.step} min={spec.min} max={spec.max}
            onChange={(e) => onChange(clampInput(spec, parseFloat(e.target.value)))}
            className="w-[76px] rounded-md border px-1.5 py-0.5 text-right text-[13px] font-semibold tabular-nums"
            style={{ background: "var(--surface)", borderColor: changed ? "var(--accent)" : "var(--border)", color: "var(--text)" }}
          />
          <span className="text-[11px] w-[70px] truncate" style={{ color: "var(--text-faint)" }}>{spec.unit}</span>
        </span>
      </div>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full mt-1" style={{ accentColor: "var(--brand)" }} />
      {(spec.source || spec.help) && <div className="text-[11px] leading-snug" style={{ color: "var(--text-faint)" }}>{spec.source ?? spec.help}</div>}
    </div>
  );
}

export default function LabApp() {
  const [labId, setLabId] = useState("power");
  const [byLab, setByLab] = useState<Record<string, Inputs>>(() => Object.fromEntries(LABS.map((l) => [l.id, defaults(l.inputs)])));
  const lab = labById(labId);
  const inputs = byLab[labId];
  const result: LabResult = useMemo(() => lab.compute(inputs), [lab, inputs]);
  const powerOut = useMemo(() => (labId === "power" ? runPower(inputs) : null), [labId, inputs]);

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ q: string; reply: string; live: boolean; intent: string } | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefNote, setBriefNote] = useState("");
  const [plan, setPlan] = useState<SolveResult | null>(null);
  const [undo, setUndo] = useState<{ lab: string; inputs: Inputs } | null>(null);
  const [scenario, setScenario] = useState<string>("Today (2025)");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [showWorking, setShowWorking] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({ "Cost assumptions": true });
  const [aiState, setAiState] = useState<"unknown" | "live" | "offline">("unknown");
  const [saveName, setSaveName] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) setSaved(JSON.parse(raw)); } catch { /* storage unavailable */ }
  }, []);
  const persist = (list: Saved[]) => { setSaved(list); try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch { /* ignore */ } };

  const setInput = (key: string, v: number) => {
    setByLab((b) => ({ ...b, [labId]: { ...b[labId], [key]: v } }));
    setScenario("Custom");
    setBrief(null);
  };
  const switchLab = (id: string) => { setLabId(id); setPlan(null); setBrief(null); setScenario(labById(id).presets[0]?.name ?? "Custom"); };
  const applyPreset = (p: Preset) => {
    setByLab((b) => ({ ...b, [labId]: { ...defaults(lab.inputs), ...p.set } }));
    setScenario(p.name); setPlan(null); setBrief(null);
  };

  async function runBrief(question: string, labIdX: string, inp: Inputs) {
    const L = labById(labIdX);
    setBriefBusy(true); setBriefNote("");
    const t = await briefFromResult(question, L, inp, L.compute(inp));
    setBriefBusy(false);
    if (t) { setBrief(t); setAiState("live"); }
    else { setBrief(null); setAiState("offline"); setBriefNote("Live AI isn't connected right now — the built-in analysis above is computed from the model."); }
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true); setPlan(null); setBrief(null); setBriefNote("");
    const p = await askLab(question, labId, inputs);
    const L = labById(p.lab);
    const base = p.lab === labId ? inputs : byLab[p.lab] ?? defaults(L.inputs);
    let next = { ...base, ...p.set };
    let sol: SolveResult | null = null;
    if (p.intent === "solve" && L.solve) { sol = L.solve.run(next); next = sol.inputs; }
    setUndo({ lab: labId, inputs });
    setByLab((b) => ({ ...b, [p.lab]: next }));
    setLabId(p.lab);
    setPlan(sol);
    setScenario(sol ? sol.title : question.length > 60 ? question.slice(0, 57) + "…" : question);
    setAnswer({ q: question, reply: p.reply, live: p.live, intent: p.intent });
    setAiState(p.live ? "live" : "offline");
    setBusy(false);
    setQ("");
    if (p.live) runBrief(question, p.lab, next);
  }

  const solveNow = () => {
    if (!lab.solve) return;
    const sol = lab.solve.run(inputs);
    setUndo({ lab: labId, inputs });
    setByLab((b) => ({ ...b, [labId]: sol.inputs }));
    setPlan(sol); setScenario(sol.title); setBrief(null);
  };

  const doUndo = () => { if (!undo) return; setByLab((b) => ({ ...b, [undo.lab]: undo.inputs })); setLabId(undo.lab); setUndo(null); setPlan(null); setScenario("Custom"); };

  const saveScenario = () => {
    const name = saveName.trim() || scenario || `Scenario ${saved.length + 1}`;
    const s: Saved = { id: `${Date.now()}`, lab: labId, name, inputs };
    persist([...saved, s]);
    setCompare((c) => [...c.slice(-2), s.id]);
    setSaveName("");
  };

  const pushLink = () => {
    if (!result.link) return;
    const L = labById(result.link.lab);
    const cur = byLab[L.id];
    const spec = L.inputs.find((x) => x.key === result.link!.key)!;
    setUndo({ lab: labId, inputs });
    setByLab((b) => ({ ...b, [L.id]: { ...cur, [spec.key]: clampInput(spec, cur[spec.key] + result.link!.add) } }));
    setLabId(L.id); setScenario(`${scenario} + ${lab.short} load`); setPlan(null);
    topRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const groups = useMemo(() => {
    const m = new Map<string, InputSpec[]>();
    for (const s of lab.inputs) { if (!m.has(s.group)) m.set(s.group, []); m.get(s.group)!.push(s); }
    return [...m.entries()];
  }, [lab]);

  const labSaved = saved.filter((s) => s.lab === labId);
  const compareRows = labSaved.filter((s) => compare.includes(s.id));

  return (
    // The global app-shell CSS locks body scrolling, so the Lab is its own scroll container.
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden" style={{ background: "var(--bg)", WebkitOverflowScrolling: "touch" }} ref={topRef}>
      {/* ===== Header ===== */}
      <header style={{ background: "linear-gradient(135deg, #06352a 0%, #0b6e4f 60%, #0f7f5c 100%)" }} className="text-white">
        <div className="flex h-1.5">
          <div className="flex-1" style={{ background: "#319B42" }} /><div className="flex-1" style={{ background: "#FFD200" }} /><div className="flex-1" style={{ background: "#DE2010" }} /><div className="flex-1" style={{ background: "#000" }} />
        </div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-5 pb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "#f3d675" }}>Minister&apos;s Desk</div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight mt-0.5">Economic Lab</h1>
              <p className="text-sm mt-1 opacity-85 max-w-xl">Ask any question about Zimbabwe&apos;s economy. Move the sliders, and every number, chart and brief recalculates instantly, with sources and working shown.</p>
            </div>
            <span className="text-[11px] rounded-full px-2.5 py-1 font-semibold flex items-center gap-1.5" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: aiState === "live" ? "#4ade80" : aiState === "offline" ? "#f3d675" : "#cbd5e1" }} />
              {aiState === "live" ? "AI analyst: live" : aiState === "offline" ? "AI analyst: offline mode" : "AI analyst ready"}
            </span>
          </div>

          {/* Ask bar */}
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="mt-5">
            <div className="flex gap-2 rounded-2xl p-1.5" style={{ background: "rgba(255,255,255,0.97)", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Ask anything… e.g. “What's the cheapest way to end load-shedding by 2030?”"
                className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[15px] outline-none" style={{ color: "#172b4d" }}
              />
              <button type="submit" disabled={busy || !q.trim()} className="rounded-xl px-4 md:px-5 text-sm font-semibold text-white disabled:opacity-50 shrink-0" style={{ background: "#0b6e4f" }}>
                {busy ? "Thinking…" : "Ask"}
              </button>
            </div>
          </form>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={busy} className="text-xs rounded-full px-3 py-1.5 whitespace-nowrap shrink-0 hover:bg-white/20 transition" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ===== Lab tabs ===== */}
      <nav className="sticky top-0 z-20 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="max-w-[1400px] mx-auto px-2 md:px-6 flex gap-1 overflow-x-auto">
          {LABS.map((l) => {
            const active = l.id === labId;
            return (
              <button key={l.id} onClick={() => switchLab(l.id)} className="flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap border-b-2 transition" style={{ borderColor: active ? "var(--brand)" : "transparent", color: active ? "var(--brand)" : "var(--text-muted)", fontWeight: active ? 700 : 500 }}>
                <Icon d={LAB_ICONS[l.id]} size={15} />{l.name}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 md:py-6 space-y-5">
        {/* AI answer */}
        {answer && (
          <Card style={{ borderColor: "var(--brand)", background: "linear-gradient(0deg, var(--surface), var(--surface))" }}>
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 text-sm font-bold" style={{ background: "var(--brand)" }}>AI</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>You asked: “{answer.q}”</div>
                <div className="text-[15px] mt-1 font-medium" style={{ color: "var(--text)" }}>{answer.reply}</div>
                {!answer.live && <div className="text-[11px] mt-1" style={{ color: "var(--text-faint)" }}>Answered by the built-in parser (offline mode). Every figure below comes from the model.</div>}
              </div>
              {undo && <button onClick={doUndo} className="text-xs rounded-md border px-2 py-1 shrink-0" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Undo</button>}
            </div>
          </Card>
        )}

        {/* Question + presets */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{lab.name}</div>
            <h2 className="text-xl md:text-2xl font-bold mt-0.5" style={{ color: "var(--text)" }}>{lab.question}</h2>
            <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Scenario: <b style={{ color: "var(--text)" }}>{scenario}</b></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {lab.presets.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p)} title={p.blurb} className="text-xs rounded-lg border px-3 py-1.5 font-medium hover:shadow-sm transition" style={{ borderColor: scenario === p.name ? "var(--brand)" : "var(--border)", background: scenario === p.name ? "var(--sidebar-active-bg)" : "var(--surface)", color: scenario === p.name ? "var(--brand)" : "var(--text)" }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* ===== Inputs ===== */}
          <aside className="order-2 lg:order-1 min-w-0 space-y-3 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
            {groups.map(([g, specs]) => (
              <Card key={g} className="!py-3">
                <button onClick={() => setClosed((c) => ({ ...c, [g]: !c[g] }))} className="w-full flex items-center justify-between text-left">
                  <span className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{g}</span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{closed[g] ? "Show" : "Hide"}</span>
                </button>
                {!closed[g] && specs.map((s) => <SliderRow key={s.key} spec={s} value={inputs[s.key]} onChange={(v) => setInput(s.key, v)} />)}
              </Card>
            ))}
            <button onClick={() => applyPreset(lab.presets[0])} className="w-full text-xs rounded-lg border py-2" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>Reset to defaults</button>
          </aside>

          {/* ===== Results ===== */}
          <section className="order-1 lg:order-2 space-y-5 min-w-0">
            <div className="grid gap-4 md:grid-cols-[1.3fr_2fr]">
              <Card style={{ borderLeft: `5px solid ${toneColor(result.headline.tone)}` }}>
                <div className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>{result.headline.label}</div>
                <div className="text-3xl md:text-4xl font-extrabold mt-1 tabular-nums" style={{ color: toneColor(result.headline.tone) }}>{result.headline.value}</div>
                {result.headline.sub && <div className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>{result.headline.sub}</div>}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {lab.solve && (
                    <button onClick={solveNow} className="text-xs rounded-lg px-3 py-2 font-semibold text-white" style={{ background: "var(--brand)" }}>✦ {lab.solve.label}</button>
                  )}
                  <button onClick={() => downloadBrief(lab, inputs, result, { question: answer?.q, aiBrief: brief, scenario })} className="text-xs rounded-lg border px-3 py-2 font-semibold" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Download 1-page brief (PDF)</button>
                </div>
              </Card>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {result.metrics.map((m) => (
                  <Card key={m.label} className="!p-3.5">
                    <div className="text-[11px] leading-tight" style={{ color: "var(--text-faint)" }}>{m.label}</div>
                    <div className="text-lg font-bold mt-1 tabular-nums" style={{ color: toneColor(m.tone) }}>{m.value}</div>
                    {m.sub && <div className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{m.sub}</div>}
                  </Card>
                ))}
              </div>
            </div>

            {/* Solver plan */}
            {plan && (
              <Card style={{ borderColor: "var(--accent)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Optimiser result · applied</div>
                    <h3 className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>{plan.title}</h3>
                  </div>
                  {undo && <button onClick={doUndo} className="text-xs rounded-md border px-2 py-1" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Undo</button>}
                </div>
                <ol className="mt-3 space-y-2">
                  {plan.steps.map((s, k) => (
                    <li key={s.label} className="flex gap-3 items-start">
                      <span className="h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 text-white" style={{ background: "var(--brand)" }}>{k + 1}</span>
                      <div><div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.label}</div><div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.detail}</div></div>
                    </li>
                  ))}
                  {plan.steps.length === 0 && <li className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing to change — this scenario already meets the goal.</li>}
                </ol>
                <p className="text-sm mt-3 font-medium" style={{ color: "var(--text)" }}>{plan.summary}</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-faint)" }}>The optimiser tries every lever step by step and always picks the one that closes the most gap per dollar (capex + 5 years of running cost).</p>
              </Card>
            )}

            {/* Chart */}
            <Card>
              {powerOut ? (
                <>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <h3 className="font-bold" style={{ color: "var(--text)" }}>A typical day in {inputs.year}: supply vs demand, hour by hour</h3>
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>Hover any hour for the numbers</span>
                  </div>
                  <div className="mt-3"><HourlyChart o={powerOut} /></div>
                </>
              ) : result.bars ? (
                <>
                  <h3 className="font-bold mb-3" style={{ color: "var(--text)" }}>{result.bars.title}</h3>
                  <RankBars items={result.bars.items} format={result.bars.format} />
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Adjust the sliders to see the result.</p>
              )}
            </Card>

            {powerOut && (
              <Card>
                <h3 className="font-bold mb-3" style={{ color: "var(--text)" }}>Where each day&apos;s electricity comes from</h3>
                <RankBars
                  format="num"
                  items={(Object.keys(powerOut.bySource) as SourceKey[]).filter((k) => powerOut.bySource[k] > 0.5).map((k) => ({ label: `${SOURCE_META[k].label} (MWh/day)`, value: Math.round(powerOut.bySource[k]), highlight: k === "solar" || k === "battery" })).sort((a, b) => b.value - a.value)}
                />
              </Card>
            )}

            {/* Link to another lab */}
            {result.link && result.link.add > 0.5 && (
              <Card style={{ borderStyle: "dashed", borderColor: "var(--brand)" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm" style={{ color: "var(--text)" }}><b>Linked models:</b> {result.link.label}</div>
                  <button onClick={pushLink} className="text-xs rounded-lg px-3 py-2 font-semibold text-white" style={{ background: "var(--brand)" }}>Add to Power Lab →</button>
                </div>
              </Card>
            )}

            {/* AI advisor */}
            <Card>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
                  <span className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "var(--accent)" }}>AI</span>
                  Analyst&apos;s findings
                </h3>
                <button onClick={() => runBrief(answer?.q ?? "", labId, inputs)} disabled={briefBusy} className="text-xs rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-60" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  {briefBusy ? "Writing brief…" : "Write me a Minister's brief"}
                </button>
              </div>
              <ul className="mt-3 space-y-2.5">
                {result.insights.map((s, k) => (
                  <li key={k} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                    <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--brand)" }} />{s}
                  </li>
                ))}
              </ul>
              {brief && (
                <div className="mt-4 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line" style={{ background: "var(--sidebar-active-bg)", color: "var(--text)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--brand)" }}>Brief for the Minister · written by AI from the numbers above</div>
                  {brief}
                </div>
              )}
              {briefNote && <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>{briefNote}</p>}
            </Card>

            {/* Scenarios */}
            <Card>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold" style={{ color: "var(--text)" }}>Compare scenarios</h3>
                <div className="flex gap-2">
                  <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={scenario} className="rounded-lg border px-2 py-1.5 text-xs w-44" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
                  <button onClick={saveScenario} className="text-xs rounded-lg px-3 py-1.5 font-semibold text-white" style={{ background: "var(--brand)" }}>Save current</button>
                </div>
              </div>
              {labSaved.length === 0 ? (
                <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>Save a scenario, change the sliders, save again, then compare them side by side.</p>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap mt-3">
                    {labSaved.map((s) => {
                      const on = compare.includes(s.id);
                      return (
                        <span key={s.id} className="flex items-center gap-1 text-xs rounded-full border pl-2.5 pr-1 py-1" style={{ borderColor: on ? "var(--brand)" : "var(--border)", color: on ? "var(--brand)" : "var(--text-muted)" }}>
                          <button onClick={() => setCompare((c) => (on ? c.filter((x) => x !== s.id) : [...c.slice(-2), s.id]))}>{on ? "✓ " : ""}{s.name}</button>
                          <button onClick={() => { setByLab((b) => ({ ...b, [labId]: s.inputs })); setScenario(s.name); setPlan(null); }} title="Load" className="px-1">↺</button>
                          <button onClick={() => { persist(saved.filter((x) => x.id !== s.id)); setCompare((c) => c.filter((x) => x !== s.id)); }} title="Delete" className="px-1">×</button>
                        </span>
                      );
                    })}
                  </div>
                  {compareRows.length > 0 && (
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ color: "var(--text-faint)" }}>
                            <th className="text-left font-medium py-2 pr-3">Measure</th>
                            <th className="text-right font-semibold py-2 px-3" style={{ color: "var(--brand)" }}>Current</th>
                            {compareRows.map((s) => <th key={s.id} className="text-right font-semibold py-2 px-3" style={{ color: "var(--text)" }}>{s.name}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const res = compareRows.map((s) => lab.compute(s.inputs));
                            const rows: { label: string; cur: string; vals: string[] }[] = [
                              { label: result.headline.label, cur: result.headline.value, vals: res.map((r) => r.headline.value) },
                              ...result.metrics.map((m, k) => ({ label: m.label, cur: m.value, vals: res.map((r) => r.metrics[k]?.value ?? "—") })),
                            ];
                            return rows.map((r) => (
                              <tr key={r.label} className="border-t" style={{ borderColor: "var(--border)" }}>
                                <td className="py-2 pr-3" style={{ color: "var(--text-muted)" }}>{r.label}</td>
                                <td className="py-2 px-3 text-right font-semibold tabular-nums" style={{ color: "var(--text)" }}>{r.cur}</td>
                                {r.vals.map((v, k) => <td key={k} className="py-2 px-3 text-right tabular-nums" style={{ color: "var(--text)" }}>{v}</td>)}
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Working */}
            <Card>
              <button onClick={() => setShowWorking((s) => !s)} className="w-full flex items-center justify-between">
                <h3 className="font-bold" style={{ color: "var(--text)" }}>Show working: how every number is calculated</h3>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>{showWorking ? "Hide" : "Show"}</span>
              </button>
              {showWorking && (
                <ol className="mt-3 space-y-2 list-decimal pl-5 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                  {result.working.map((w, k) => <li key={k}>{w}</li>)}
                </ol>
              )}
            </Card>

            <p className="text-[11px] leading-relaxed pb-6" style={{ color: "var(--text-faint)" }}>
              Defaults are approximate public figures (ZESA/ZPC, ZERA, ZIMSTAT, World Bank and industry benchmarks) and are meant for scenario thinking, not official statistics. Hover the “i” on any input for its source. Verify against the latest releases before quoting in public.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
