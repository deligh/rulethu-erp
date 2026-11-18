"use client";

import React, { useState } from "react";
import { useDesk, uid, fmtDate } from "@/lib/desk/store";
import { draftDocument, DRAFT_KINDS } from "@/lib/desk/ai";
import { textPdf, shareOrDownload } from "@/lib/desk/pdf";
import { Card, Btn, PageHead, Field, inputCls, inputStyle, AiTag } from "@/components/desk/ui";
import { useDictation } from "@/components/desk/useDictation";

export default function DraftsPage() {
  const d = useDesk();
  const [kind, setKind] = useState(DRAFT_KINDS[0]);
  const [brief, setBrief] = useState("");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [live, setLive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const dict = useDictation((t) => setBrief((s) => (s ? s + " " : "") + t));

  const run = async () => {
    if (!brief.trim()) return;
    setBusy(true);
    const r = await draftDocument(kind, brief, d);
    setBody(r.text); setLive(r.live); setTitle(r.text.split("\n")[0].replace(/^#+\s*/, "").slice(0, 80) || kind); setBusy(false); setOpenId(null);
  };
  const save = () => {
    const id = openId ?? uid("DR");
    d.upsert("drafts", { id, kind, title: title || kind, body, createdAt: new Date().toISOString() });
    setOpenId(id);
  };

  return (
    <div>
      <PageHead kicker="Write faster" title="Drafter" sub="Speeches, statements, Cabinet memos and letters in the Minister's voice. Figures are never invented: gaps are marked [figure]." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Card>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {DRAFT_KINDS.map((k) => <button key={k} onClick={() => setKind(k)} className="text-xs rounded-full border px-3 py-1" style={{ borderColor: kind === k ? "var(--brand)" : "var(--border)", color: kind === k ? "var(--brand)" : "var(--text-muted)", background: kind === k ? "var(--sidebar-active-bg)" : "var(--surface)", fontWeight: kind === k ? 700 : 500 }}>{k}</button>)}
            </div>
            <Field label="What should it say? (type or dictate)">
              <textarea rows={6} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. 5-minute keynote for the investment conference at HICC: Zimbabwe is open for business, the SEZ 30-day licensing promise, lithium beneficiation, ending load-shedding. Warm, confident tone." className={inputCls + " text-sm"} style={inputStyle} />
            </Field>
            <div className="flex gap-2 mt-3">
              <Btn onClick={run} disabled={busy || !brief.trim()}>{busy ? "Drafting…" : `✦ Draft ${kind.toLowerCase()}`}</Btn>
              {dict.supported && <Btn kind="ghost" onClick={dict.listening ? dict.stop : dict.start}>{dict.listening ? "■ Stop" : "🎙 Dictate"}</Btn>}
            </div>
          </Card>
          {d.drafts.length > 0 && (
            <Card>
              <h3 className="font-bold mb-2 text-sm" style={{ color: "var(--text)" }}>Saved drafts</h3>
              {d.drafts.map((x) => (
                <button key={x.id} onClick={() => { setOpenId(x.id); setBody(x.body); setTitle(x.title); setKind(x.kind); setLive(null); }} className="w-full text-left py-2 border-t text-sm" style={{ borderColor: "var(--border)" }}>
                  <div className="font-medium truncate" style={{ color: "var(--text)" }}>{x.title}</div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{x.kind} · {fmtDate(x.createdAt.slice(0, 10))}</div>
                </button>
              ))}
            </Card>
          )}
        </div>
        <Card>
          {body ? (
            <>
              <div className="flex items-center gap-2 mb-2">{live !== null && <AiTag live={live} />}<input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 font-bold bg-transparent outline-none" style={{ color: "var(--text)" }} /></div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={22} className={inputCls + " text-sm leading-relaxed"} style={inputStyle} />
              <div className="flex gap-2 mt-3 flex-wrap">
                <Btn onClick={save}>{openId ? "Save changes" : "Save draft"}</Btn>
                <Btn kind="ghost" onClick={async () => shareOrDownload(await textPdf(title || kind, kind, body), title)}>Share PDF</Btn>
                <Btn kind="ghost" onClick={() => navigator.clipboard?.writeText(body)}>Copy text</Btn>
                {openId && <Btn kind="danger" onClick={() => { d.remove("drafts", openId); setOpenId(null); setBody(""); }}>Delete</Btn>}
              </div>
            </>
          ) : <div className="h-full min-h-[300px] flex items-center justify-center text-sm text-center" style={{ color: "var(--text-faint)" }}>Your draft appears here, ready to edit and share.</div>}
        </Card>
      </div>
    </div>
  );
}
