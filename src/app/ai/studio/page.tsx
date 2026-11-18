"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppData, CURRENT_USER, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  draftFromTemplate, draftFromTemplateLive, scopeSnapshot, AiSnapshot, Template, Department, DEPARTMENTS, AI_DEMO_NOTE, AiDraft,
} from "@/lib/ai";
import { canAccessModule } from "@/lib/access";
import ModuleTabs from "@/components/ModuleTabs";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";

/* markdown-ish → HTML for Word/print export */
function toHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/_([^_]+)_/g, "<em>$1</em>");
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line) { closeList(); out.push(""); continue; }
    if (/^[-•*]\s+/.test(line)) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(line.replace(/^[-•*]\s+/, ""))}</li>`); continue; }
    closeList();
    if (line === "---") out.push("<hr/>");
    else if (line.startsWith("### ")) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

/* Selectable letterheads. The document gets the chosen entity's branding. */
export interface Entity {
  id: string; name: string; sub: string; color: string; accent: string; contact: string;
}
export const ENTITIES: Entity[] = [
  { id: "rulethu", name: "RULETHU & CO.", sub: "PRIVATE LIMITED", color: "#0B5D52", accent: "#C9A227", contact: "info@rulethu.com &nbsp;|&nbsp; +263 8677010018 &nbsp;|&nbsp; rulethu.com" },
  { id: "holdings", name: "RULETHU HOLDINGS", sub: "INVESTMENT GROUP", color: "#0B5D52", accent: "#C9A227", contact: "info@rulethu.com &nbsp;|&nbsp; +263 8677010018 &nbsp;|&nbsp; rulethu.com" },
  { id: "microfinance", name: "RULETHU MICROFINANCE", sub: "A RULETHU COMPANY", color: "#0B5D52", accent: "#C9A227", contact: "info@rulethu.com &nbsp;|&nbsp; +263 8677010018 &nbsp;|&nbsp; rulethu.com" },
  { id: "capital", name: "RULETHU CAPITAL", sub: "ADVISORY & INVESTMENTS", color: "#0B5D52", accent: "#C9A227", contact: "info@rulethu.com &nbsp;|&nbsp; +263 8677010018 &nbsp;|&nbsp; rulethu.com" },
];

/** Full branded, furnished document HTML — used for both PDF (print) and Word. */
function brandedHtml(e: Entity, opts: { title: string; author: string; date: string; department: string; bodyMd: string }): string {
  const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Body without the model's own leading # title (letterhead carries the title).
  const body = opts.bodyMd.replace(/^#\s+.*\n?/, "");
  return `<!doctype html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:"Segoe UI",Calibri,Arial,sans-serif;color:#1a2b3c;background:#fff;font-size:12.5pt;line-height:1.55}
  .page{max-width:820px;margin:0 auto;padding:30px 40px}
  .top{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid ${e.color};padding-bottom:10px}
  .brand{font-weight:800;font-size:21px;letter-spacing:.5px;color:${e.color};position:relative}
  .brand .dot{color:${e.accent}}
  .brand small{display:block;font-weight:600;font-size:10px;color:#667;letter-spacing:2px;margin-top:2px}
  .rlabel{text-align:right;font-weight:700;color:${e.color};font-size:12px}
  .rlabel small{display:block;font-weight:500;color:#667}
  h1{font-size:21px;margin:18px 0 2px;color:#1a2b3c}
  h2{font-size:14.5px;color:${e.color};margin:18px 0 4px;border-bottom:1px solid ${e.accent};padding-bottom:3px}
  h3{font-size:12.5px;color:${e.color};margin:12px 0 2px}
  p{margin:6px 0}
  ul{margin:6px 0 6px 18px}
  li{margin:2px 0}
  hr{border:none;border-top:1px solid #e5eae8;margin:16px 0}
  .meta{color:#667;font-size:11.5px;margin-bottom:14px}
  .foot{margin-top:26px;border-top:2px solid ${e.color};padding-top:10px;font-size:10.5px;color:#667}
  .foot b{color:${e.color}}
  .disc{margin-top:8px;font-size:9px;color:#98a2b3;line-height:1.4}
  @media print{.page{padding:14px 18px}}
</style></head>
<body><div class="page">
  <div class="top">
    <div class="brand">${esc(e.name)}<span class="dot">.</span><small>${esc(e.sub)}</small></div>
    <div class="rlabel">${esc(opts.department)}<small>${esc(opts.date)}</small></div>
  </div>
  <h1>${esc(opts.title)}</h1>
  <div class="meta">Prepared by ${esc(opts.author)} · ${esc(e.name.replace(/\.$/, ""))}</div>
  ${toHtml(body)}
  <div class="foot">
    <b>${esc(e.name)}</b> — an investment holding and development company focused on infrastructure, trade, primary industry and financial services.<br/>
    ${e.contact}
    <div class="disc">DISCLAIMER: This document has been prepared solely for informational purposes. The views expressed are those of the author at the time of preparation and are subject to change without notice. This material does not constitute investment advice.</div>
  </div>
</div></body></html>`;
}

function StudioInner() {
  const data = useAppData();
  const { user } = useAuth();
  const params = useSearchParams();
  const { templates, drafts, add } = data;

  const snap: AiSnapshot = useMemo(() => ({
    deals: data.deals.map((d) => ({ name: d.name, stage: d.stage, ticket: d.ticket, sector: d.sector })),
    loans: data.loans.map((l) => ({ borrower: l.borrower, principal: l.principal, status: l.status })),
    tbills: data.tbills.map((t) => ({ client: t.client, reference: t.reference, maturityDate: t.maturityDate, faceValue: t.faceValue })),
    employees: data.employees.map((e) => ({ name: e.name, role: e.role, department: e.department, status: e.status })),
    tasks: data.tasks.map((t) => ({ title: t.title, status: (t as { status?: string }).status })),
    leave: data.leave.map((l) => ({ employee: l.employee, type: l.type, status: l.status })),
    reports: data.reports.map((r) => ({ title: r.title })),
    ledger: data.entries.reduce((acc, e) => {
      for (const l of e.lines) { acc.debit += l.debit || 0; acc.credit += l.credit || 0; }
      return acc;
    }, { debit: 0, credit: 0 }),
  }), [data.deals, data.loans, data.tbills, data.employees, data.tasks, data.leave, data.reports, data.entries]);

  const scopedSnap = useMemo(() => {
    if (!user) return scopeSnapshot(snap, { deals: false, ledger: false, book: false });
    return scopeSnapshot(snap, {
      deals: canAccessModule(user, "investments"),
      ledger: canAccessModule(user, "finance"),
      book: canAccessModule(user, "finance") || canAccessModule(user, "treasury") || canAccessModule(user, "microfinance"),
    });
  }, [snap, user]);

  const [dept, setDept] = useState<Department | "All">("All");
  const [entityId, setEntityId] = useState<string>("rulethu");
  const [selId, setSelId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [channelId, setChannelId] = useState<string>("");

  // Channels the user can see that carry a brief/context the AI can follow.
  const myEmail = (user?.email ?? "").toLowerCase();
  const briefChannels = data.channels.filter(
    (c) => (!c.private || (!!myEmail && (c.members ?? []).includes(myEmail))) && ((c.context && c.context.trim()) || (c.insights && c.insights.length)),
  );
  const selectedChannel = briefChannels.find((c) => c.id === channelId);

  // Compose the brief the AI receives, folding in the channel's context + insights.
  const composeBrief = (): string => {
    let b = brief.trim();
    if (selectedChannel) {
      const parts: string[] = [];
      if (selectedChannel.context?.trim()) parts.push(`CHANNEL BRIEF (follow this style, tone and requirements): ${selectedChannel.context.trim()}`);
      if (selectedChannel.insights?.length) parts.push(`TEAM INSIGHTS to incorporate:\n${selectedChannel.insights.map((i) => `- ${i.author}: ${i.text}`).join("\n")}`);
      if (parts.length) b = `${b}\n\n${parts.join("\n\n")}`;
    }
    return b;
  };

  const visible = templates.filter((t) => dept === "All" || t.department === dept);
  const selected = templates.find((t) => t.id === selId);

  // Prefill from query (?dept= / ?templateId= / ?draft=)
  useEffect(() => {
    const d = params.get("dept") as Department | null;
    const tid = params.get("templateId");
    const did = params.get("draft");
    if (did) {
      const dr = drafts.find((x) => x.id === did);
      if (dr) { setDept(dr.department); setSelId(dr.templateId); setTitle(dr.title); setBrief(dr.brief); setContent(dr.content); return; }
    }
    if (d && DEPARTMENTS.includes(d)) setDept(d);
    if (tid) setSelId(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (t: Template) => {
    setSelId(t.id);
    setSaved(false);
    if (!title) setTitle(t.name);
  };

  const generate = () => {
    if (!selected) return;
    setBusy(true);
    setSaved(false);
    setContent("");
    const fullBrief = composeBrief();
    setTimeout(async () => {
      try {
        setContent(await draftFromTemplateLive(selected, fullBrief, scopedSnap));
      } catch {
        setContent(draftFromTemplate(selected, fullBrief, scopedSnap));
      } finally {
        setBusy(false);
      }
    }, 450);
  };

  const save = () => {
    if (!selected || !content) return;
    const draft: AiDraft = {
      id: genId("DR"),
      title: title.trim() || selected.name,
      templateId: selected.id,
      templateName: selected.name,
      department: selected.department,
      brief: brief.trim(),
      content,
      author: user?.name ?? CURRENT_USER,
      createdAt: new Date().toISOString(),
    };
    add("drafts", draft, { title: "Draft saved", body: draft.title, module: "ai" });
    setSaved(true);
  };

  const fileBase = (title.trim() || selected?.name || "rulethu-draft").replace(/[^a-z0-9]+/gi, "-");
  const entity = ENTITIES.find((x) => x.id === entityId) ?? ENTITIES[0];
  const docMeta = () => ({
    title: title.trim() || selected?.name || "Document",
    author: user?.name ?? CURRENT_USER,
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
    department: selected?.department ?? "",
    bodyMd: content,
  });
  const downloadTxt = () => {
    triggerDownload(new Blob([content], { type: "text/plain;charset=utf-8" }), `${fileBase}.txt`);
  };
  // Editable Word (.doc, HTML-based — opens and edits cleanly in Word), branded.
  const downloadWord = () => {
    const html = brandedHtml(entity, docMeta());
    triggerDownload(new Blob([html], { type: "application/msword" }), `${fileBase}.doc`);
  };
  // Furnished PDF via the print dialog, on the chosen letterhead.
  const downloadPdf = () => {
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups to create the PDF."); return; }
    w.document.write(brandedHtml(entity, docMeta()));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div>
      <PageHeader
        title="Document Studio"
        subtitle="Pick a department template, give a one-line brief, and draft a full document from live platform data — then edit, save and download."
        actions={<Link href="/ai/templates" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Manage templates</Link>}
      />
      <ModuleTabs moduleKey="ai" />

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Left: template picker + brief */}
        <div className="space-y-4">
          <Card>
            <SectionTitle hint={`${visible.length}`}>1 · Choose a template</SectionTitle>
            <select value={dept} onChange={(e) => setDept(e.target.value as Department | "All")} className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle}>
              <option value="All">All departments</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {visible.map((t) => {
                const on = t.id === selId;
                return (
                  <button key={t.id} onClick={() => pick(t)} className="w-full text-left rounded-md border px-3 py-2" style={{ borderColor: on ? "var(--brand)" : "var(--border)", background: on ? "color-mix(in srgb, var(--brand) 8%, transparent)" : "var(--surface)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.name}</span>
                      {t.uploaded && <Badge tone="purple">yours</Badge>}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{t.department}</div>
                  </button>
                );
              })}
              {visible.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No templates for this department yet.</p>}
            </div>
          </Card>

          <Card>
            <SectionTitle>2 · Brief it</SectionTitle>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Document title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selected?.name ?? "e.g. Solar IPP — IC Memo"} className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>What should it cover? (one or two lines)</label>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="e.g. 40MW solar IPP in Mberengwa; $22M ticket; recommend proceeding to IC with a 20-year PPA." className="w-full rounded-md border px-2.5 py-2 text-sm" style={inputStyle} />

            {briefChannels.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Apply a channel brief (style & context) <span style={{ color: "var(--text-faint)" }}>— optional</span></label>
                <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="w-full rounded-md border px-2.5 py-2 text-sm" style={inputStyle}>
                  <option value="">None</option>
                  {briefChannels.map((c) => (
                    <option key={c.id} value={c.id}>{c.private ? "🔒 " : "#"}{c.name}{c.insights?.length ? ` · ${c.insights.length} insight${c.insights.length > 1 ? "s" : ""}` : ""}</option>
                  ))}
                </select>
                {selectedChannel && (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    The AI will follow #{selectedChannel.name}&apos;s brief{selectedChannel.insights?.length ? ` and fold in ${selectedChannel.insights.length} team insight(s)` : ""}.
                  </p>
                )}
              </div>
            )}

            <button onClick={generate} disabled={!selected || busy} className="mt-3 w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>
              {busy ? "Drafting…" : selected ? `Draft ${selected.name}` : "Pick a template first"}
            </button>
          </Card>
        </div>

        {/* Right: draft preview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>{content ? "3 · Your draft" : "Draft preview"}</SectionTitle>
            {content && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px]" style={{ color: "var(--text-faint)" }}>Letterhead</label>
                <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="rounded-md border px-2 py-1.5 text-xs" style={inputStyle} title="Choose the entity whose logo & letterhead appears on the document">
                  {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.name.replace(/\.$/, "")}</option>)}
                </select>
                <button onClick={save} className="rounded-md border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: saved ? "var(--pos)" : "var(--text)" }}>{saved ? "✓ Saved" : "Save draft"}</button>
                <button onClick={downloadWord} className="rounded-md border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ Word (editable)</button>
                <button onClick={downloadTxt} className="rounded-md border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>.txt</button>
                <button onClick={downloadPdf} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--brand)" }}>⬇ PDF (branded)</button>
              </div>
            )}
          </div>

          {!content && !busy && (
            <Card className="border-dashed">
              <div className="py-10 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: "var(--text-faint)" }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6" /></svg>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Choose a template and brief it, then your drafted document appears here — ready to edit and download.</p>
              </div>
            </Card>
          )}

          {busy && (
            <Card>
              <div className="py-12 flex flex-col items-center gap-3">
                <span className="inline-flex gap-1.5">
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "120ms" }} />
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: "var(--brand)", animationDelay: "240ms" }} />
                </span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Drafting {selected?.name} from live data…</span>
              </div>
            </Card>
          )}

          {content && !busy && (
            <>
              <Card className="!p-0 overflow-hidden">
                <textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setSaved(false); }}
                  rows={26}
                  className="w-full resize-y px-5 py-4 text-sm font-mono leading-relaxed outline-none"
                  style={{ background: "var(--surface)", color: "var(--text)", border: "none" }}
                />
              </Card>
              <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>{AI_DEMO_NOTE} You can edit the draft above before saving or downloading.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading studio…</div>}>
      <StudioInner />
    </Suspense>
  );
}
