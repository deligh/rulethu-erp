"use client";

import { useState } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { askClaude, aiLastError } from "@/lib/aiClient";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { researchPdf, ResearchDoc } from "@/lib/docpdf";

type Scope = "Company" | "Sector" | "Country" | "Macro" | "General";
const SCOPES: Scope[] = ["Company", "Sector", "Country", "Macro", "General"];

const SCOPE_HINT: Record<Scope, string> = {
  Company: "A target or portfolio company — e.g. “Padenga Holdings” or “a Zimbabwean lithium miner we could acquire”",
  Sector: "A sector or theme — e.g. “Zimbabwe gold mining economics” or “SADC solar IPPs”",
  Country: "A market — e.g. “Zambia macro & FX outlook for investors”",
  Macro: "A macro driver — e.g. “gold price outlook into 2027 and the Fed path”",
  General: "Any research question you'd hand a junior analyst",
};

const EXAMPLES: Record<Scope, string> = {
  Company: "Delta Corporation Zimbabwe — investment case, financials and risks",
  Sector: "Zimbabwe lithium sector — reserves, offtake, pricing and key players",
  Country: "Zambia — macro, copper, FX and the investment climate for 2026/27",
  Macro: "Platinum & palladium outlook into 2027 and what it means for PGM miners",
  General: "How are African sovereign funds allocating to private markets in 2026?",
};

// Pull the last complete, parseable top-level JSON object from a model reply.
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const cands: string[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { cands.push(t.slice(start, i + 1)); start = -1; } }
  }
  for (let i = cands.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(cands[i]); if (o && typeof o === "object") return o as Record<string, unknown>; } catch { /* repair below */ }
  }
  // Repair a truncated tail (close open strings/brackets) on the first candidate start.
  if (start < 0 && cands.length === 0 && t.indexOf("{") >= 0) t = t.slice(t.indexOf("{"));
  try {
    let out = ""; let s = false; let e = false; const stack: string[] = [];
    for (const ch of t) {
      if (e) { out += ch; e = false; continue; }
      if (ch === "\\" && s) { out += ch; e = true; continue; }
      if (ch === '"') { s = !s; out += ch; continue; }
      if (!s) { if (ch === "{") stack.push("}"); else if (ch === "[") stack.push("]"); else if (ch === "}" || ch === "]") stack.pop(); }
      out += ch;
    }
    if (s) out += '"';
    out = out.replace(/,\s*$/, "");
    while (stack.length) out += stack.pop();
    const o = JSON.parse(out.slice(out.indexOf("{")));
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch { return null; }
}

function toDoc(o: Record<string, unknown>, scope: Scope, country: string, author?: string): ResearchDoc {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  const sections = Array.isArray(o.sections)
    ? (o.sections as Record<string, unknown>[])
        .map((s) => ({ heading: String(s.heading ?? s.title ?? ""), body: String(s.body ?? s.text ?? "") }))
        .filter((s) => s.heading && s.body)
    : [];
  const sources = Array.isArray(o.sources)
    ? (o.sources as Record<string, unknown>[])
        .map((s) => ({ label: String(s.label ?? s.title ?? ""), url: String(s.url ?? "") }))
        .filter((s) => s.label && s.url)
        .slice(0, 12)
    : [];
  return {
    title: String(o.title ?? "Research report"),
    scope: [scope, country].filter(Boolean).join(" · "),
    executiveSummary: String(o.executiveSummary ?? o.summary ?? ""),
    keyFindings: arr(o.keyFindings ?? o.findings),
    sections,
    risks: arr(o.risks ?? o.riskFactors),
    outlook: String(o.outlook ?? o.conclusion ?? ""),
    sources,
    author,
  };
}

// Build a printable HTML body so a published report can be re-opened in the Library.
function toHtml(r: ResearchDoc): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const li = (xs: string[]) => xs.map((x) => `<li>${esc(x)}</li>`).join("");
  return (
    `<h1>${esc(r.title)}</h1>` +
    `<p><em>${esc(r.scope)} · ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}${r.author ? " · " + esc(r.author) : ""}</em></p>` +
    (r.executiveSummary ? `<h2>Executive summary</h2><p>${esc(r.executiveSummary)}</p>` : "") +
    (r.keyFindings.length ? `<h2>Key findings</h2><ul>${li(r.keyFindings)}</ul>` : "") +
    r.sections.map((s) => `<h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p>`).join("") +
    (r.risks.length ? `<h2>Risks &amp; watch-items</h2><ul>${li(r.risks)}</ul>` : "") +
    (r.outlook ? `<h2>Outlook</h2><p>${esc(r.outlook)}</p>` : "") +
    (r.sources.length ? `<h2>Sources</h2><ul>${r.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join("")}</ul>` : "")
  );
}

export default function DeepResearchPage() {
  const { publishReport } = useAppData();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("Company");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<ResearchDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  const run = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true); setDoc(null); setErr(null); setSaved(null); setOpen(0);
    const lens =
      "You are Rulethu AI's research desk at Rulethu Holdings, an African investment group in Harare, Zimbabwe " +
      "(gold & PGM mining, lithium, power/solar, private equity, microfinance, ZSE/VFEX). " +
      "Produce a rigorous, decision-useful research report for the investment team, always drawing the read-through " +
      "to Rulethu's strategy, a Zimbabwe/SADC lens and USD framing. Use web search and fetch to ground EVERY material " +
      "claim in real, current sources, and cite them. Be specific with numbers; flag where data is uncertain. Do NOT invent figures.";
    const shape =
      'Return ONLY one JSON object, no prose or code fences, EXACTLY: ' +
      '{"title": string, "executiveSummary": string, "keyFindings": [string], ' +
      '"sections": [{"heading": string, "body": string}], "risks": [string], "outlook": string, ' +
      '"sources": [{"label": string, "url": string}]}. ' +
      "Write 4–6 sections with substantive 2–4 sentence bodies (e.g. Market & context, Financials/economics, Competitive position, " +
      "Valuation/returns, Regulatory & ESG, Deal angle for Rulethu — adapt to the topic). " +
      "keyFindings: 4–6 sharp bullets. risks: 3–5. sources: the real pages you used, with URLs. Keep it tight and evidence-led.";
    try {
      const text = await askClaude({
        system: lens + " " + shape,
        prompt:
          `RESEARCH SCOPE: ${scope}${country ? ` (focus market: ${country})` : ""}\n` +
          `QUESTION / TARGET: ${q}\n\n` +
          "Research this now with live web search + fetch, then return the report JSON only.",
        model: "sonnet",
        webSearch: true,
        searchMaxUses: 6,
        webFetch: true,
        fetchMaxUses: 4,
        maxTokens: 7000,
        timeoutMs: 125_000,
      });
      if (!text) { setErr(aiLastError() ?? "The research desk didn't respond. Check the AI connection and try again."); setBusy(false); return; }
      const o = extractJson(text);
      if (!o) { setErr(`The AI replied but the report couldn't be read (${text.length} chars) — try again or narrow the question.`); setBusy(false); return; }
      setDoc(toDoc(o, scope, country, user?.name));
    } catch (e) {
      setErr(`Research error: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!doc) return;
    const id = genId("R");
    publishReport(
      {
        id,
        title: doc.title,
        type: "Sector Note",
        author: doc.author ?? user?.name ?? "Rulethu AI",
        date: new Date().toISOString().slice(0, 10),
        status: "Published",
        summary: doc.executiveSummary.slice(0, 400),
        sectors: [scope, country].filter(Boolean),
        body: toHtml(doc),
      },
      { summary: doc.executiveSummary.slice(0, 400) },
    );
    setSaved("Published to Research → Library and announced to the group.");
  };

  return (
    <div>
      <PageHeader
        title="Deep Research"
        subtitle="Hand the desk a company, sector, country or question — it runs live web research across multiple sources and returns a cited, decision-useful report through the Rulethu lens. Export it or publish it to the Library."
        actions={<Badge tone="live">AI · web research</Badge>}
      />
      <ModuleTabs moduleKey="ai" />

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Controls */}
        <Card>
          <SectionTitle hint="what to research">1 · Brief the desk</SectionTitle>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SCOPES.map((s) => (
              <button
                key={s}
                onClick={() => { setScope(s); }}
                className="rounded-full px-3 py-1 text-xs font-semibold border"
                style={scope === s
                  ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" }
                  : { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" }}
              >{s}</button>
            ))}
          </div>
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Question / target</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
            placeholder={SCOPE_HINT[scope]}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            style={iStyle}
          />
          <button onClick={() => setQuery(EXAMPLES[scope])} className="mt-1 text-[11px] font-medium" style={{ color: "var(--brand)" }}>
            Use an example ↳
          </button>
          {(scope === "Company" || scope === "Sector" || scope === "General") && (
            <div className="mt-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Focus market (optional)</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Zimbabwe, Zambia, SADC" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={iStyle} />
            </div>
          )}
          <button onClick={run} disabled={busy || !query.trim()} className="mt-4 w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>
            {busy ? "Researching…" : "🔎 Run deep research"}
          </button>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            Live web research takes ~30–90 seconds. Uses the AI web-search credit; the result is grounded in real, cited sources.
          </p>
        </Card>

        {/* Report */}
        <div>
          <SectionTitle>{doc ? "2 · Report" : "Report"}</SectionTitle>
          {busy && (
            <Card>
              <div className="flex items-center gap-3 py-6">
                <span className="inline-block h-4 w-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Searching sources, reading pages and drafting the report… this takes up to ~90 seconds.
                </div>
              </div>
            </Card>
          )}
          {err && !busy && (
            <Card><p className="py-6 text-center text-sm" style={{ color: "var(--neg)" }}>{err}</p></Card>
          )}
          {!doc && !busy && !err && (
            <Card className="border-dashed"><p className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>Your cited research report will appear here.</p></Card>
          )}
          {doc && !busy && (
            <Card className="space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{doc.scope}</div>
                <h2 className="mt-0.5 text-lg font-bold" style={{ color: "var(--text)" }}>{doc.title}</h2>
              </div>
              {doc.executiveSummary && (
                <div className="rounded-md border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--brand)" }}>Executive summary</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{doc.executiveSummary}</p>
                </div>
              )}
              {doc.keyFindings.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Key findings</div>
                  <ul className="space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    {doc.keyFindings.map((k, i) => <li key={i} className="flex gap-2"><span style={{ color: "var(--brand)" }}>▸</span><span>{k}</span></li>)}
                  </ul>
                </div>
              )}
              {doc.sections.length > 0 && (
                <div className="space-y-2">
                  {doc.sections.map((s, i) => {
                    const isOpen = open === i;
                    return (
                      <div key={i} className="rounded-md border" style={{ borderColor: isOpen ? "var(--brand)" : "var(--border)" }}>
                        <button onClick={() => setOpen(isOpen ? null : i)} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold" style={{ color: "var(--text)" }}>
                          <span>{s.heading}</span>
                          <span style={{ color: "var(--brand)" }}>{isOpen ? "▴" : "▾"}</span>
                        </button>
                        {isOpen && <p className="px-3 pb-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.body}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {doc.risks.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Risks &amp; watch-items</div>
                  <ul className="space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    {doc.risks.map((r, i) => <li key={i} className="flex gap-2"><span style={{ color: "var(--neg)" }}>⚠</span><span>{r}</span></li>)}
                  </ul>
                </div>
              )}
              {doc.outlook && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Outlook</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{doc.outlook}</p>
                </div>
              )}
              {doc.sources.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Sources</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {doc.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline" style={{ color: "var(--brand)" }}>{s.label} ↗</a>)}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => researchPdf(doc)} className="rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>⬇ Download PDF</button>
                <button onClick={publish} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Publish to Library</button>
                {saved && <span className="self-center text-xs" style={{ color: "var(--pos)" }}>{saved}</span>}
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Generated by Rulethu AI with live web research. Verify material figures before acting.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
