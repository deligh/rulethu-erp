"use client";

import React, { useState } from "react";
import { Modal, Btn, AiTag, RichText } from "./ui";
import { useDesk, type DeskEvent, fmtDate } from "@/lib/desk/store";
import { meetingBrief } from "@/lib/desk/ai";
import { textPdf, shareOrDownload } from "@/lib/desk/pdf";

export default function BriefModal({ ev, onClose }: { ev: DeskEvent | null; onClose: () => void }) {
  const d = useDesk();
  const [text, setText] = useState<string>("");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (research: boolean) => {
    if (!ev) return;
    setBusy(true); setText("");
    const r = await meetingBrief(ev, d, research);
    setText(r.text); setLive(r.live); setBusy(false);
  };

  const close = () => { setText(""); onClose(); };
  if (!ev) return null;
  return (
    <Modal open={!!ev} onClose={close} title={`Brief: ${ev.title}`} wide>
      <div className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
        {fmtDate(ev.date, { weekday: "long", day: "numeric", month: "long" })} · {ev.start}–{ev.end}{ev.location ? ` · ${ev.location}` : ""}{ev.with ? ` · with ${ev.with}` : ""}
      </div>
      {!text && !busy && (
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={() => run(false)}>Prepare brief</Btn>
          <Btn kind="gold" onClick={() => run(true)}>Prepare with web research (≈1 min)</Btn>
        </div>
      )}
      {busy && <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>Preparing the brief…</p>}
      {text && (
        <>
          <div className="flex items-center gap-2 mb-2"><AiTag live={live} /><span className="text-xs" style={{ color: "var(--text-faint)" }}>{live ? "Drafted by AI from the Desk records" : "Offline template"}</span></div>
          <div className="rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line" style={{ background: "var(--surface-2, #f4f5f7)", color: "var(--text)" }}><RichText text={text} /></div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Btn onClick={async () => shareOrDownload(await textPdf(`Meeting brief: ${ev.title}`, `${fmtDate(ev.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${ev.start}${ev.location ? ` · ${ev.location}` : ""}`, text), ev.title)}>Share / download PDF</Btn>
            <Btn kind="ghost" onClick={() => run(false)}>Regenerate</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
