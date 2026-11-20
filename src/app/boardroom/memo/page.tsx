"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppData, CURRENT_USER } from "@/lib/store";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import { icMemoPdf, MemoDoc } from "@/lib/memoexport";
import { compact } from "@/lib/format";

type Src = { kind: "deal" | "holding"; id: string; label: string };

const REC_OPTIONS = ["PROCEED", "BUY", "HOLD", "PASS", "DECLINE"];

function extractJson(text: string): Record<string, unknown> | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  if (start < 0) return null;
  t = t.slice(start);
  // First try a clean parse up to the last closing brace.
  const end = t.lastIndexOf("}");
  if (end > 0) { try { return JSON.parse(t.slice(0, end + 1)); } catch { /* fall through to repair */ } }
  // Repair a truncated tail: close any open string/array/object so we still get
  // whatever fields completed before the cut-off.
  let out = ""; let inStr = false; let esc = false; const stack: string[] = [];
  for (const ch of t) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\" && inStr) { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (!inStr) {
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
    out += ch;
  }
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop();
  try { return JSON.parse(out); } catch { return null; }
}
const arr = (v: unknown): string[] => Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : (v ? [String(v)] : []);

export default function MemoPage() {
  const { deals, holdings } = useAppData();
  const [src, setSrc] = useState<Src | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [memo, setMemo] = useState<MemoDoc | null>(null);

  const sources: Src[] = useMemo(() => [
    ...deals.map((d) => ({ kind: "deal" as const, id: d.id, label: `${d.name} · ${compact(d.ticket, "USD")}` })),
    ...holdings.map((h) => ({ kind: "holding" as const, id: h.id, label: `${h.company} · ${compact(h.fairValue, "USD")} (holding)` })),
  ], [deals, holdings]);

  const buildContext = (s: Src): { ctx: string; subject: string; sector: string; country: string; ticket: string } => {
    if (s.kind === "deal") {
      const d = deals.find((x) => x.id === s.id)!;
      return {
        subject: d.name, sector: d.sector, country: d.country, ticket: compact(d.ticket, "USD"),
        ctx: `This is a PIPELINE DEAL under evaluation.\nName: ${d.name}\nSector: ${d.sector}\nCountry: ${d.country}\nProposed ticket: $${d.ticket.toLocaleString()} USD\nCurrent stage: ${d.stage}\nDeal lead: ${d.owner}`,
      };
    }
    const h = holdings.find((x) => x.id === s.id)!;
    const moic = h.invested ? (h.fairValue / h.invested).toFixed(2) : "—";
    return {
      subject: h.company, sector: h.sector, country: "Zimbabwe", ticket: compact(h.invested, "USD"),
      ctx: `This is an EXISTING PORTFOLIO HOLDING under review.\nCompany: ${h.company}\nSector: ${h.sector}\nStage: ${h.stage}\nCost basis: $${h.invested.toLocaleString()} USD\nCurrent fair value: $${h.fairValue.toLocaleString()} USD (${moic}x MOIC)\nOwnership: ${h.ownership}%\nStatus: ${h.status}\nEntry: ${h.entryDate}\nLead: ${h.lead}\nNote: ${h.note ?? "—"}`,
    };
  };

  const generate = async () => {
    if (!src) return;
    setBusy(true); setErr(null);
    const info = buildContext(src);
    const { askClaude, aiLastError } = await import("@/lib/aiClient");
    const system =
      "You are an investment professional at Rulethu Holdings, an African investment group in Harare, Zimbabwe (mining/PGMs/lithium, power & solar, real assets, private equity, financial services). " +
      "Write a concise, decision-ready Investment Committee memo for the subject described. Be specific, commercial and balanced — a real IC paper, not marketing. " +
      "Return ONLY a single JSON object, no prose, no code fences, EXACTLY:\n" +
      '{"recommendation": "PROCEED"|"BUY"|"HOLD"|"PASS"|"DECLINE", "thesis": string (2-4 sentences), ' +
      '"highlights": [string x4-6], "valuation": string (2-3 sentences on how to value it and a rough range/basis), ' +
      '"risks": [string x3-5], "mitigants": [string x3-5], "terms": string (proposed structure/instrument, ownership, protections), ' +
      '"nextSteps": [string x3-5]}';
    const text = await askClaude({
      system,
      prompt: `Draft the IC memo for the following.\n\n${info.ctx}\n\nGround the memo in this profile; where specifics are unknown, use sensible, clearly reasonable assumptions for this sector and market. Output ONLY the JSON object.`,
      model: "sonnet",
      maxTokens: 3200,
      timeoutMs: 120_000,
    });
    if (!text) { setErr(aiLastError() ?? "The AI did not respond. Check the AI status in Admin."); setBusy(false); return; }
    const j = extractJson(text);
    if (!j) { setErr("The AI reply could not be read as a memo. Try again."); setBusy(false); return; }
    setMemo({
      subject: info.subject, sector: info.sector, country: info.country, ticket: info.ticket,
      recommendation: String(j.recommendation ?? "PROCEED"),
      thesis: String(j.thesis ?? ""),
      highlights: arr(j.highlights),
      valuation: String(j.valuation ?? ""),
      risks: arr(j.risks),
      mitigants: arr(j.mitigants),
      terms: String(j.terms ?? ""),
      nextSteps: arr(j.nextSteps),
      author: CURRENT_USER,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
    });
    setBusy(false);
  };

  const download = () => {
    if (!memo) return;
    const doc = icMemoPdf(memo);
    doc.save(`IC-Memo-${memo.subject.replace(/[^\w]+/g, "-").slice(0, 40)}.pdf`);
  };

  const input = "rounded-md border px-2.5 py-1.5 text-sm w-full";
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div>
      <PageHeader
        eyebrow="Boardroom"
        title="One-click IC Memo"
        subtitle="Pick a deal or holding, and Rulethu AI drafts a full Investment Committee memo — thesis, valuation, risks, terms and a clear recommendation. Edit anything, then export a polished PDF."
        actions={<Link href="/boardroom" className="rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--surface-2)", color: "var(--text)" }}>← Command Center</Link>}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Subject</label>
            <select className={input + " mt-1"} style={iStyle} value={src ? `${src.kind}:${src.id}` : ""}
              onChange={(e) => {
                const [kind, id] = e.target.value.split(":");
                const found = sources.find((s) => s.kind === kind && s.id === id) ?? null;
                setSrc(found); setMemo(null); setErr(null);
              }}>
              <option value="">Choose a deal or holding…</option>
              <optgroup label="Pipeline deals">{sources.filter((s) => s.kind === "deal").map((s) => <option key={s.id} value={`deal:${s.id}`}>{s.label}</option>)}</optgroup>
              <optgroup label="Portfolio holdings">{sources.filter((s) => s.kind === "holding").map((s) => <option key={s.id} value={`holding:${s.id}`}>{s.label}</option>)}</optgroup>
            </select>
          </div>
          <button onClick={generate} disabled={!src || busy}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>
            {busy ? "Drafting…" : memo ? "↻ Regenerate" : "✦ Generate memo"}
          </button>
          {memo && <button onClick={download} className="rounded-md px-4 py-2 text-sm font-semibold" style={{ background: "var(--surface-2)", color: "var(--text)" }}>⬇ Download PDF</button>}
        </div>
        {err && <p className="mt-3 text-sm" style={{ color: "var(--neg)" }}>{err}</p>}
        {busy && <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Rulethu AI is drafting the memo — thesis, valuation, risks and recommendation…</p>}
      </Card>

      {memo && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>{memo.subject}</h2>
            <span className="text-sm" style={{ color: "var(--text-faint)" }}>{memo.sector} · {memo.country} · {memo.ticket}</span>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Recommendation</label>
              <select className="rounded-md border px-2 py-1 text-sm font-bold" style={iStyle} value={memo.recommendation}
                onChange={(e) => setMemo({ ...memo, recommendation: e.target.value })}>
                {REC_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <FieldArea label="Investment thesis" value={memo.thesis} onChange={(v) => setMemo({ ...memo, thesis: v })} />
          <ListEdit label="Key highlights" items={memo.highlights} onChange={(v) => setMemo({ ...memo, highlights: v })} />
          <FieldArea label="Valuation" value={memo.valuation} onChange={(v) => setMemo({ ...memo, valuation: v })} />
          <div className="grid gap-5 lg:grid-cols-2">
            <ListEdit label="Key risks" items={memo.risks} onChange={(v) => setMemo({ ...memo, risks: v })} />
            <ListEdit label="Mitigants" items={memo.mitigants} onChange={(v) => setMemo({ ...memo, mitigants: v })} />
          </div>
          <FieldArea label="Proposed terms / structure" value={memo.terms} onChange={(v) => setMemo({ ...memo, terms: v })} />
          <ListEdit label="Recommended next steps" items={memo.nextSteps} onChange={(v) => setMemo({ ...memo, nextSteps: v })} />

          <div className="flex justify-end">
            <button onClick={download} className="rounded-md px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>⬇ Download IC Memo PDF</button>
          </div>
        </div>
      )}

      {!memo && !busy && (
        <Card className="border-dashed">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Choose a subject above and generate — the memo appears here, fully editable, ready to export.</p>
        </Card>
      )}
    </div>
  );
}

function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <SectionTitle>{label}</SectionTitle>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={Math.max(2, Math.ceil(value.length / 90))}
        className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
    </div>
  );
}

function ListEdit({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const del = (i: number) => onChange(items.filter((_, j) => j !== i));
  return (
    <div>
      <SectionTitle hint="editable">{label}</SectionTitle>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 text-sm" style={{ color: "var(--brand)" }}>•</span>
            <textarea value={it} onChange={(e) => set(i, e.target.value)} rows={Math.max(1, Math.ceil(it.length / 70))}
              className="flex-1 rounded-md border px-3 py-1.5 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
            <button onClick={() => del(i)} className="mt-1 text-xs" style={{ color: "var(--text-faint)" }} title="Remove">✕</button>
          </div>
        ))}
        <button onClick={() => onChange([...items, ""])} className="text-xs font-medium" style={{ color: "var(--brand)" }}>+ Add point</button>
      </div>
    </div>
  );
}
