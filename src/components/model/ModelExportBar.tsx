"use client";

import { useState } from "react";
import { ModelResult } from "@/lib/finmodels";
import { modelXlsx, modelPdf } from "@/lib/modelexport";
import { askClaude } from "@/lib/aiClient";
import { useAuth } from "@/lib/auth";

/** Export + AI-interpretation bar, reusable across every model page. */
export default function ModelExportBar({ name, sector, result }: { name: string; sector: string; result: ModelResult }) {
  const { user } = useAuth();
  const [ai, setAi] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const explain = async () => {
    setBusy(true); setOpen(true);
    const asm = (result.assumptions ?? []).map((a) => `${a.label}: ${a.value}`).join("; ");
    const kpis = result.kpis.map((k) => `${k.label} ${k.value}${k.hint ? ` (${k.hint})` : ""}`).join("; ");
    const text = await askClaude({
      system:
        "You are an investment analyst at Rulethu Holdings, an African investment group in Harare. Write a crisp investment interpretation of a financial model for the investment committee. " +
        "Plain text only, no markdown or symbols as headings. Use short labelled sections on their own line: VERDICT, WHY, KEY SENSITIVITIES, RISKS, RECOMMENDATION. " +
        "In VERDICT give a clear read (attractive / marginal / weak) referencing the IRR versus the hurdle (WACC). Explain in plain words how the returns and DSCR are driven by the assumptions, name the 2-3 assumptions the result is most sensitive to, flag the main risks, and end with a clear recommendation (proceed to DD / revise / pass). Be specific with the numbers; this is indicative analysis, not personalised financial advice.",
      prompt: `Model: ${name} (${sector}).\nKey metrics: ${kpis}.\nAssumptions: ${asm}.\nWrite the interpretation now.`,
      model: "haiku",
      maxTokens: 900,
    });
    setAi((text ?? "").replace(/[*_#`]/g, "").trim());
    setBusy(false);
  };

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => modelXlsx(name, sector, result)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ Excel</button>
        <button onClick={() => modelPdf(name, sector, result, ai, user?.name)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ PDF{ai ? " + notes" : ""}</button>
        <button onClick={explain} disabled={busy} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>{busy ? "Analysing…" : "✨ Interpret with AI"}</button>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Export the model, or let AI read the result for the committee.</span>
      </div>
      {open && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {busy && !ai ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Reading the model…</p>
          ) : (
            <textarea value={ai} onChange={(e) => setAi(e.target.value)} rows={9} className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} placeholder="AI interpretation will appear here — editable before you add it to the PDF." />
          )}
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>Editable · included in the PDF when you download it · indicative analysis, not advice.</p>
        </div>
      )}
    </div>
  );
}
