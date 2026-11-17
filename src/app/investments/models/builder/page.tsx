"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData, CURRENT_USER, genId, SavedModel } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  CATEGORIES, HISTORIC_MODELS, MODEL_FIELDS, ModelCategory, ModelInputs,
  blankModel, cloneHistoric, buildFromPrompt, computeModel, reviewModel, suggestComplexModel,
} from "@/lib/modelbuilder";
import { Section, NumField } from "@/components/model/ModelKit";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { compact } from "@/lib/format";

type Method = "ai" | "clone" | "manual";
const money = (v: number) => compact(v, "USD");

const METHODS: { key: Method; title: string; blurb: string; icon: string }[] = [
  { key: "ai", title: "Ask AI to build it", blurb: "Describe the opportunity in words — AI drafts the assumptions.", icon: "M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" },
  { key: "clone", title: "Clone a historic model", blurb: "Start from a model that mimics a past Rulethu deal.", icon: "M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" },
  { key: "manual", title: "Enter inputs manually", blurb: "Start from sector defaults and type your own numbers.", icon: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" },
];

export default function ModelBuilder() {
  const { savedModels, add } = useAppData();
  const { user } = useAuth();

  const [method, setMethod] = useState<Method>("ai");
  const [prompt, setPrompt] = useState("");
  const [cloneId, setCloneId] = useState(HISTORIC_MODELS[0].id);
  const [manualCat, setManualCat] = useState<ModelCategory>("Solar / Energy");

  const [inputs, setInputs] = useState<ModelInputs | null>(null);
  const [category, setCategory] = useState<ModelCategory>("Solar / Energy");
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<SavedModel["basis"]>("AI");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const result = useMemo(() => (inputs ? computeModel(inputs) : null), [inputs]);

  const set = (k: keyof ModelInputs, v: number) => { setInputs((p) => (p ? { ...p, [k]: v } : p)); setSaved(false); };

  const runAI = () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setTimeout(() => {
      const b = buildFromPrompt(prompt);
      setInputs(b.inputs); setCategory(b.category); setName(b.name); setRationale(b.rationale); setBasis("AI"); setBusy(false); setSaved(false);
    }, 500);
  };
  const runClone = () => {
    const c = cloneHistoric(cloneId);
    if (c) { setInputs(c.inputs); setCategory(c.category); setName(c.name); setRationale(`Cloned from ${HISTORIC_MODELS.find((h) => h.id === cloneId)?.name}. Adjust any assumption on the right.`); setBasis("Clone"); setSaved(false); }
  };
  const runManual = () => {
    setInputs(blankModel(manualCat)); setCategory(manualCat); setName(`${manualCat.split(" ")[0]} model`); setRationale("Started from sector defaults — edit every assumption as needed."); setBasis("Manual"); setSaved(false);
  };

  const save = () => {
    if (!inputs) return;
    const m: SavedModel = { id: genId("MDL"), name: name.trim() || `${category} model`, category, basis, inputs, rationale, createdBy: user?.name ?? CURRENT_USER, createdAt: new Date().toISOString() };
    add("savedModels", m, { title: "Model saved", body: `${m.name} (${m.category})`, module: "investments" });
    setSaved(true);
  };

  // Open a saved model to build on it (loads its assumptions as a new draft).
  const buildOn = (m: SavedModel) => {
    setInputs({ ...m.inputs }); setCategory(m.category); setName(`${m.name} (v2)`); setBasis("Manual");
    setRationale(`Building on "${m.name}" by ${m.createdBy}. Adjust any assumption and save as a new model.`); setSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const review = useMemo(() => (inputs && result ? reviewModel(inputs, result) : []), [inputs, result]);
  const suggestion = method === "ai" ? suggestComplexModel(prompt) : null;

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  // chart data: cumulative cashflow incl. year 0
  const bars = result ? [{ label: "0", value: -inputs!.capex }, ...result.projection.map((p) => ({ label: String(p.year), value: p.cumulative }))] : [];
  const maxAbs = Math.max(1, ...bars.map((b) => Math.abs(b.value)));

  return (
    <div>
      <PageHeader
        title="Model Builder"
        subtitle="Spin up a financial model for any sector — ask AI to build it, clone a historic model, or enter inputs yourself. It values live."
        actions={<Link href="/investments/models" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>← Models hub</Link>}
      />
      <ModuleTabs moduleKey="investments" />

      {/* Method chooser */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {METHODS.map((m) => {
          const on = method === m.key;
          return (
            <button key={m.key} onClick={() => setMethod(m.key)} className="text-left rounded-lg border p-4 transition-shadow hover:shadow-md" style={{ borderColor: on ? "var(--brand)" : "var(--border)", background: on ? "color-mix(in srgb, var(--brand) 7%, var(--surface))" : "var(--surface)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: on ? "var(--brand)" : "var(--surface-2)", color: on ? "#fff" : "var(--brand)" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
                </span>
                <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{m.title}</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* Left: method input + assumptions */}
        <div className="space-y-4">
          <Card>
            {method === "ai" && (
              <>
                <SectionTitle>Describe the opportunity</SectionTitle>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="e.g. A 50MW solar IPP in Zambia on a 20-year PPA, ~$55M capex." className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />
                <button onClick={runAI} disabled={busy || !prompt.trim()} className="w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>{busy ? "Building…" : "✦ Build model with AI"}</button>
                {suggestion && (
                  <Link href={suggestion.href} className="mt-2 flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--brand)", background: "color-mix(in srgb, var(--brand) 6%, transparent)" }}>
                    ✦ For a fuller model: {suggestion.label} →
                  </Link>
                )}
              </>
            )}
            {method === "clone" && (
              <>
                <SectionTitle>Pick a historic model</SectionTitle>
                <select value={cloneId} onChange={(e) => setCloneId(e.target.value)} className="w-full rounded-md border px-2.5 py-2 text-sm mb-2" style={inputStyle}>
                  {HISTORIC_MODELS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{HISTORIC_MODELS.find((h) => h.id === cloneId)?.note}</p>
                <button onClick={runClone} className="w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Clone &amp; open</button>
              </>
            )}
            {method === "manual" && (
              <>
                <SectionTitle>Choose a sector</SectionTitle>
                <select value={manualCat} onChange={(e) => setManualCat(e.target.value as ModelCategory)} className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={runManual} className="w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Start from defaults</button>
              </>
            )}
          </Card>

          {inputs && (
            <Section title={`Assumptions · ${category}`} cols={2}>
              {MODEL_FIELDS.map((f) => {
                const isPct = f.unit === "%";
                return (
                  <NumField
                    key={f.key}
                    label={f.label}
                    value={isPct ? Math.round(inputs[f.key] * 1000) / 10 : inputs[f.key]}
                    onChange={(v) => set(f.key, isPct ? v / 100 : v)}
                    suffix={f.unit === "$" ? "$" : f.unit === "%" ? "%" : "yrs"}
                    step={f.step}
                  />
                );
              })}
            </Section>
          )}
        </div>

        {/* Right: results */}
        <div>
          {!inputs && (
            <Card className="border-dashed">
              <div className="py-16 text-center">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: "var(--text-faint)" }}><path d="M3 17l6-6 4 4 8-8M21 7v5M21 7h-5" /></svg>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Choose how to start on the left. Your model — assumptions, NPV, IRR, payback and a cash-flow chart — appears here and values live.</p>
              </div>
            </Card>
          )}

          {inputs && result && (
            <div className="space-y-4">
              {/* Name + save */}
              <div className="flex items-center gap-2">
                <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className="flex-1 rounded-md border px-3 py-2 text-sm font-medium" style={inputStyle} />
                <Badge tone={basis === "AI" ? "purple" : basis === "Clone" ? "info" : "neutral"}>{basis === "AI" ? "AI-built" : basis}</Badge>
                <button onClick={save} className="rounded-md px-3 py-2 text-sm font-semibold text-white shrink-0" style={{ background: saved ? "var(--pos)" : "var(--brand)" }}>{saved ? "✓ Saved" : "Save model"}</button>
              </div>

              {rationale && (
                <div className="rounded-lg border p-3 flex gap-2.5" style={{ borderColor: "var(--border)", background: "var(--lz-blue-bg)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" style={{ color: "var(--lz-blue-fg)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{rationale}</p>
                </div>
              )}

              {/* AI review of the current model */}
              {review.length > 0 && (
                <Card className="!p-0 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>AI review</span>
                  </div>
                  <ul className="p-3 space-y-1.5">
                    {review.map((t, i) => (
                      <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span style={{ color: "var(--brand)" }}>•</span><span><Bold text={t} /></span>
                      </li>
                    ))}
                  </ul>
                  <p className="px-3 pb-2 text-[11px]" style={{ color: "var(--text-faint)" }}>Illustrative review — with the Claude API connected this becomes a full written appraisal with risks and a recommendation.</p>
                </Card>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="NPV" value={money(result.npv)} tone={result.npv >= 0 ? "pos" : "neg"} />
                <Kpi label="IRR" value={result.irr != null ? `${(result.irr * 100).toFixed(1)}%` : "n/a"} tone={result.irr != null && result.irr >= inputs.wacc ? "pos" : "neg"} />
                <Kpi label="Payback" value={result.paybackYears != null ? `${result.paybackYears} yrs` : `>${inputs.years} yrs`} />
                <Kpi label="Terminal value" value={money(result.terminalValue)} />
              </div>

              {/* Cumulative cash-flow chart */}
              <Card>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Cumulative cash flow</h3>
                <svg width="100%" viewBox="0 0 720 150" style={{ display: "block" }}>
                  <line x1={16} y1={115} x2={704} y2={115} stroke="var(--border)" />
                  {bars.map((b, i) => {
                    const bw = (720 - 32) / bars.length;
                    const h = (Math.abs(b.value) / maxAbs) * 92;
                    const x = 16 + i * bw + bw * 0.15;
                    const w = bw * 0.7;
                    const y = b.value >= 0 ? 115 - h : 115;
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={w} height={h} rx={2} fill={b.value >= 0 ? "var(--pos)" : "var(--neg)"} />
                        {i % Math.ceil(bars.length / 12 || 1) === 0 && <text x={x + w / 2} y={132} fontSize={9} textAnchor="middle" fill="var(--text-faint)">{b.label}</text>}
                      </g>
                    );
                  })}
                </svg>
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Year 0 is the upfront capex; bars turn positive once the project pays back.</p>
              </Card>

              {/* Projection table */}
              <Card className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: "var(--surface-2)" }}>
                      <tr>
                        {["Year", "Revenue", "EBITDA", "Free cash flow", "Cumulative"].map((h, i) => (
                          <th key={h} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`} style={{ color: "var(--text-faint)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.projection.map((p) => (
                        <tr key={p.year}>
                          <td className="px-3 py-1.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{p.year}</td>
                          <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{money(p.revenue)}</td>
                          <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{money(p.ebitda)}</td>
                          <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{money(p.fcf)}</td>
                          <td className="px-3 py-1.5 text-right tabular" style={{ borderTop: "1px solid var(--border)", color: p.cumulative >= 0 ? "var(--pos)" : "var(--neg)" }}>{money(p.cumulative)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Demo engine — a clean DCF on these assumptions. With a connected key, AI will also write the model’s narrative and stress the key risks.</p>
            </div>
          )}
        </div>
      </div>

      {savedModels.length > 0 && (
        <div className="mt-8">
          <SectionTitle hint="shared library · open one to build on it">Model library</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedModels.map((m) => {
              const r = computeModel(m.inputs);
              return (
                <Card key={m.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{m.name}</span>
                    <Badge tone={m.basis === "AI" ? "purple" : m.basis === "Clone" ? "info" : "neutral"}>{m.basis}</Badge>
                  </div>
                  <div className="text-[11px] mb-2" style={{ color: "var(--text-faint)" }}>{m.category} · {m.createdBy}</div>
                  <div className="flex gap-4 text-xs mb-3">
                    <span style={{ color: "var(--text-muted)" }}>NPV <b style={{ color: r.npv >= 0 ? "var(--pos)" : "var(--neg)" }}>{money(r.npv)}</b></span>
                    <span style={{ color: "var(--text-muted)" }}>IRR <b style={{ color: "var(--text)" }}>{r.irr != null ? `${(r.irr * 100).toFixed(1)}%` : "n/a"}</b></span>
                  </div>
                  <button onClick={() => buildOn(m)} className="mt-auto w-full rounded-md border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--brand)" }}>Open &amp; build on this →</button>
                </Card>
              );
            })}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>Saved models are the group&apos;s shared library — once the cloud database is connected, anyone can open a colleague&apos;s model here, clone it, or build on it.</p>
        </div>
      )}
    </div>
  );
}

function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} style={{ color: "var(--text)" }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <Card className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className="text-xl font-semibold tabular" style={{ color: tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--text)" }}>{value}</span>
    </Card>
  );
}
