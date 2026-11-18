"use client";

import React, { useMemo, useState } from "react";
import { useDesk, STAGES, uid, todayISO, daysBetween, type Deal, type Stage } from "@/lib/desk/store";
import { textPdf, shareOrDownload } from "@/lib/desk/pdf";
import { Card, Btn, PageHead, Modal, Field, inputCls, inputStyle } from "@/components/desk/ui";

export default function PipelinePage() {
  const d = useDesk();
  const t = todayISO();
  const [edit, setEdit] = useState<Deal | null>(null);
  const pledged = d.deals.reduce((s, x) => s + x.pledged, 0), landed = d.deals.reduce((s, x) => s + x.landed, 0), jobs = d.deals.reduce((s, x) => s + x.jobs, 0);
  const jobsLive = d.deals.filter((x) => x.stage === "Operational").reduce((s, x) => s + x.jobs, 0);
  const stuck = d.deals.filter((x) => x.stage !== "Operational" && daysBetween(x.stageSince, t) > 90);
  const bySector = useMemo(() => { const m = new Map<string, number>(); for (const x of d.deals) m.set(x.sector, (m.get(x.sector) ?? 0) + x.pledged); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [d.deals]);
  const byCountry = useMemo(() => { const m = new Map<string, number>(); for (const x of d.deals) m.set(x.country, (m.get(x.country) ?? 0) + x.pledged); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [d.deals]);
  const headline = `USD ${pledged.toLocaleString()} million pledged across ${d.deals.length} projects; USD ${landed.toLocaleString()} million (${Math.round((landed / pledged) * 100)}%) has landed, with ${jobs.toLocaleString()} jobs promised.`;

  const move = (x: Deal, s: Stage) => d.upsert("deals", { ...x, stage: s, stageSince: t });

  return (
    <div>
      <PageHead kicker="Investment promotion" title="Investment pipeline" sub="From first contact to money landed." right={<>
        <Btn kind="ghost" onClick={async () => shareOrDownload(await textPdf("Investment pipeline", `As at ${t}`, [`HEADLINE\n${headline}`, ...STAGES.map((s) => `${s.toUpperCase()}\n${d.deals.filter((x) => x.stage === s).map((x) => `• ${x.name} — ${x.investor} (${x.country}), USD ${x.pledged}m pledged, USD ${x.landed}m landed, ${x.jobs} jobs${x.blocker ? `. Blocker: ${x.blocker}` : ""}`).join("\n") || "—"}`)].join("\n\n")), "Pipeline")}>Pipeline PDF</Btn>
        <Btn onClick={() => setEdit({ id: uid("D"), name: "", investor: "", country: "", sector: "", province: "", pledged: 0, landed: 0, jobs: 0, stage: "Lead", stageSince: t })}>+ New project</Btn>
      </>} />

      <Card className="mb-5" style={{ background: "linear-gradient(135deg, #06352a, #0b6e4f)", borderColor: "transparent" }}>
        <div className="text-[11px] uppercase tracking-wider" style={{ color: "#f3d675" }}>The line to quote</div>
        <p className="text-white text-lg md:text-xl font-semibold mt-1 leading-snug">“{headline}”</p>
        <div className="mt-4 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.18)" }}><div className="h-full rounded-full" style={{ width: `${(landed / pledged) * 100}%`, background: "#f3d675" }} /></div>
        <div className="flex justify-between text-xs mt-1.5 text-white/80"><span>Landed USD {landed}m</span><span>Pledged USD {pledged}m</span></div>
        <div className="text-xs mt-2 text-white/80">{jobsLive.toLocaleString()} of {jobs.toLocaleString()} promised jobs are in operating projects.</div>
      </Card>

      {stuck.length > 0 && (
        <Card className="mb-5" style={{ borderColor: "var(--warn)" }}>
          <div className="font-bold text-sm mb-2" style={{ color: "var(--text)" }}>⚠ Stuck for more than 90 days</div>
          {stuck.map((x) => <div key={x.id} className="text-sm py-1" style={{ color: "var(--text-muted)" }}><b style={{ color: "var(--text)" }}>{x.name}</b> — {daysBetween(x.stageSince, t)} days at “{x.stage}”{x.blocker ? `. Blocker: ${x.blocker}` : ""}</div>)}
        </Card>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 mb-5">
        {STAGES.map((s) => {
          const xs = d.deals.filter((x) => x.stage === s);
          return (
            <div key={s} className="rounded-xl p-2.5 w-[260px] shrink-0" style={{ background: "var(--surface-2, #f4f5f7)" }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const x = d.deals.find((y) => y.id === e.dataTransfer.getData("text")); if (x) move(x, s); }}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wide px-1 mb-2" style={{ color: "var(--text-muted)" }}><span>{s}</span><span>USD {xs.reduce((a, x) => a + x.pledged, 0)}m</span></div>
              <div className="space-y-2">
                {xs.map((x) => (
                  <div key={x.id} draggable onDragStart={(e) => e.dataTransfer.setData("text", x.id)} onClick={() => setEdit(x)} className="rounded-lg border p-2.5 cursor-grab" style={{ background: "var(--surface)", borderColor: daysBetween(x.stageSince, t) > 90 && s !== "Operational" ? "var(--warn)" : "var(--border)" }}>
                    <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{x.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{x.investor} · {x.country}</div>
                    <div className="flex justify-between text-xs mt-1.5"><span style={{ color: "var(--text)" }}>USD {x.pledged}m</span><span style={{ color: "var(--text-faint)" }}>{x.jobs} jobs</span></div>
                    {x.landed > 0 && <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "var(--border)" }}><div className="h-full" style={{ width: `${Math.min(100, (x.landed / Math.max(1, x.pledged)) * 100)}%`, background: "var(--brand)" }} /></div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {[["Pledged by sector", bySector], ["Pledged by source country", byCountry]].map(([title, rows]) => (
          <Card key={title as string}>
            <h3 className="font-bold mb-3" style={{ color: "var(--text)" }}>{title as string}</h3>
            {(rows as [string, number][]).map(([k, v]) => (
              <div key={k} className="mb-2"><div className="flex justify-between text-xs mb-1"><span style={{ color: "var(--text-muted)" }}>{k}</span><span className="font-semibold" style={{ color: "var(--text)" }}>USD {v}m</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2, #eee)" }}><div className="h-full rounded-full" style={{ width: `${(v / pledged) * 100}%`, background: "var(--brand)" }} /></div></div>
            ))}
          </Card>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Investment project">
        {edit && (() => {
          const x = edit; const u = <K extends keyof Deal>(k: K, v: Deal[K]) => setEdit({ ...x, [k]: v });
          const n = (k: "pledged" | "landed" | "jobs") => <input type="number" className={inputCls} style={inputStyle} value={x[k]} onChange={(e) => u(k, +e.target.value)} />;
          return (
            <div className="space-y-3">
              <Field label="Project"><input className={inputCls} style={inputStyle} value={x.name} onChange={(e) => u("name", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Investor"><input className={inputCls} style={inputStyle} value={x.investor} onChange={(e) => u("investor", e.target.value)} /></Field>
                <Field label="Country"><input className={inputCls} style={inputStyle} value={x.country} onChange={(e) => u("country", e.target.value)} /></Field>
                <Field label="Sector"><input className={inputCls} style={inputStyle} value={x.sector} onChange={(e) => u("sector", e.target.value)} /></Field>
                <Field label="Province"><input className={inputCls} style={inputStyle} value={x.province} onChange={(e) => u("province", e.target.value)} /></Field>
                <Field label="Pledged (USD m)">{n("pledged")}</Field>
                <Field label="Landed (USD m)">{n("landed")}</Field>
                <Field label="Jobs">{n("jobs")}</Field>
                <Field label="Stage"><select className={inputCls} style={inputStyle} value={x.stage} onChange={(e) => setEdit({ ...x, stage: e.target.value as Stage, stageSince: e.target.value !== x.stage ? t : x.stageSince })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              </div>
              <Field label="Blocker (if any)"><input className={inputCls} style={inputStyle} value={x.blocker ?? ""} onChange={(e) => u("blocker", e.target.value || undefined)} /></Field>
              <div className="flex justify-between">{d.deals.some((y) => y.id === x.id) ? <Btn kind="danger" onClick={() => { d.remove("deals", x.id); setEdit(null); }}>Delete</Btn> : <span />}<Btn onClick={() => { if (x.name.trim()) d.upsert("deals", x); setEdit(null); }}>Save</Btn></div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
