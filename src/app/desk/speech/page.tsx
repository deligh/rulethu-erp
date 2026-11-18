"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDesk, uid, todayISO } from "@/lib/desk/store";
import {
  OCCASIONS, TONES, LENGTHS, WPM, GREETINGS, factsBank, draftSpeech, REWRITES, rewriteSpeech,
  talkingPoints, factCheck, scanPromises, wordCount, type SpeechSpec, type Promise_,
} from "@/lib/desk/speech";
import { textPdf, shareOrDownload } from "@/lib/desk/pdf";
import { Card, Btn, PageHead, Field, inputCls, inputStyle, AiTag, RichText } from "@/components/desk/ui";
import { useDictation } from "@/components/desk/useDictation";

const DRAFT_KEY = "mdesk-speech-draft";

function Teleprompter({ text, onClose }: { text: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(40); // px per second
  const [size, setSize] = useState(44);
  useEffect(() => {
    if (!play) return;
    let last = performance.now(), raf = 0;
    const tick = (t: number) => { if (box.current) box.current.scrollTop += ((t - last) / 1000) * speed; last = t; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, speed]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === " ") { e.preventDefault(); setPlay((p) => !p); } if (e.key === "Escape") onClose(); if (e.key === "ArrowUp") setSpeed((s) => s + 10); if (e.key === "ArrowDown") setSpeed((s) => Math.max(5, s - 10)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const blocks = text.split(/\n{2,}|\n(?=[A-Z][A-Z ']{3,}\n)/);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "#000" }}>
      <div className="flex items-center gap-3 px-4 py-2 text-white text-xs flex-wrap" style={{ background: "#111" }}>
        <button onClick={() => setPlay((p) => !p)} className="rounded-md px-3 py-1.5 font-bold" style={{ background: play ? "#DE2010" : "#0b6e4f" }}>{play ? "❚❚ Pause" : "▶ Play"}</button>
        <label className="flex items-center gap-2">Speed <input type="range" min={5} max={150} value={speed} onChange={(e) => setSpeed(+e.target.value)} /></label>
        <label className="flex items-center gap-2">Size <input type="range" min={24} max={80} value={size} onChange={(e) => setSize(+e.target.value)} /></label>
        <button onClick={() => box.current && (box.current.scrollTop = 0)} className="rounded-md px-2 py-1 border border-white/30">⟲ Top</button>
        <span className="opacity-60 hidden md:inline">Space = play/pause · ↑↓ = speed · Esc = close</span>
        <button onClick={onClose} className="ml-auto rounded-md px-3 py-1.5 border border-white/30">Close</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute left-0 right-0 top-[38%] h-[1.4em] z-10" style={{ fontSize: size, background: "rgba(243,214,117,0.08)", borderTop: "1px solid rgba(243,214,117,0.35)", borderBottom: "1px solid rgba(243,214,117,0.35)" }} />
        <div ref={box} className="h-full overflow-y-auto px-[6vw]" style={{ scrollbarWidth: "none" }}>
          <div style={{ height: "38vh" }} />
          {blocks.map((b, i) => {
            const lines = b.split("\n");
            const head = /^[A-Z][A-Z '&]{3,}$/.test(lines[0].trim()) ? lines.shift() : null;
            return (
              <div key={i} className="mb-[1.2em]" style={{ fontSize: size, lineHeight: 1.45, color: "#fff", fontWeight: 600 }}>
                {head && <div style={{ fontSize: Math.max(14, size * 0.35), color: "#f3d675", letterSpacing: "0.2em", marginBottom: 8 }}>{head}</div>}
                {lines.join(" ").split(/(\*[^*]+\*|\[pause\])/gi).map((p, k) =>
                  /^\[pause\]$/i.test(p) ? <span key={k} style={{ color: "#4ade80" }}> ⏸ </span>
                    : p.startsWith("*") && p.endsWith("*") ? <span key={k} style={{ color: "#f3d675" }}>{p.slice(1, -1)}</span>
                      : <React.Fragment key={k}>{p}</React.Fragment>)}
              </div>
            );
          })}
          <div style={{ height: "70vh" }} className="text-center text-white/40 text-lg">— End —</div>
        </div>
      </div>
    </div>
  );
}

export default function SpeechPage() {
  const d = useDesk();
  const facts = useMemo(() => factsBank(d), [d]);
  const [spec, setSpec] = useState<SpeechSpec>({ occasion: OCCASIONS[0], audience: "Local and international investors, business leaders, diplomats", minutes: 5, tone: "Inspiring", greeting: GREETINGS["Shona + Ndebele"], messages: "Zimbabwe is open for business\nWe are ending load-shedding with solar, storage and fixing what we have\nProcess our minerals here: lithium, chrome, platinum\nSEZ investors licensed within 30 days", story: "", cta: "Invest in Zimbabwe now — partner with us in power, processing and agriculture.", venue: "HICC, Harare" });
  const [picked, setPicked] = useState<string[]>(() => ["inv1", "inv2", "sol1", "sol2", "eco2", "eco4", "eco5"]);
  const [text, setText] = useState("");
  const [live, setLive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<"check" | "points" | "promises" | null>(null);
  const [points, setPoints] = useState<{ text: string; live: boolean } | null>(null);
  const [promises, setPromises] = useState<{ items: Promise_[]; live: boolean } | null>(null);
  const [added, setAdded] = useState(false);
  const [prompter, setPrompter] = useState(false);
  const [saved, setSaved] = useState(false);
  const dict = useDictation((t) => setSpec((s) => ({ ...s, messages: (s.messages ? s.messages + "\n" : "") + t })));

  useEffect(() => { try { const s = localStorage.getItem(DRAFT_KEY); if (s) setText(s); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, text); } catch { /* ignore */ } setSaved(false); }, [text]);

  const useFacts = facts.filter((f) => picked.includes(f.id));
  const u = <K extends keyof SpeechSpec>(k: K, v: SpeechSpec[K]) => setSpec((s) => ({ ...s, [k]: v }));
  const words = wordCount(text);
  const mins = words / WPM;
  const target = spec.minutes;
  const check = useMemo(() => factCheck(text, facts, `${spec.messages} ${spec.story} ${spec.cta}`), [text, facts, spec.messages, spec.story, spec.cta]);
  const flagged = check.items.filter((x) => !x.ok).length;

  const gen = async () => { setBusy("draft"); setPanel(null); const r = await draftSpeech(spec, useFacts); setText(r.text); setLive(r.live); setBusy(null); setPoints(null); setPromises(null); setAdded(false); };
  const rw = async (id: string, instr: string) => { setBusy(id); const r = await rewriteSpeech(text, instr, useFacts); setText(r.text); setLive(r.live); setBusy(null); };
  const doPoints = async () => { setPanel("points"); if (!points) { setBusy("points"); setPoints(await talkingPoints(text)); setBusy(null); } };
  const doPromises = async () => { setPanel("promises"); setBusy("promises"); setPromises(await scanPromises(text)); setBusy(null); setAdded(false); };
  const addPromises = () => { for (const p of promises?.items ?? []) d.upsert("commitments", { id: uid("C"), title: p.title, owner: p.owner, due: p.due, status: "Not started", priority: "Medium", source: `Speech: ${spec.occasion}`, createdAt: todayISO() }); setAdded(true); };
  const title = `${spec.occasion}${spec.venue ? ` — ${spec.venue}` : ""}`;

  const groups = [...new Set(facts.map((f) => f.group))];

  return (
    <div>
      <PageHead kicker="Speech Builder" title="Build a speech in minutes" sub="Set the occasion, choose your facts, and get a speech that sounds like you — then rehearse it on the teleprompter." right={text ? <>
        <Btn kind="gold" onClick={() => setPrompter(true)}>▶ Teleprompter</Btn>
        <Btn kind="ghost" onClick={async () => shareOrDownload(await textPdf(title, `Reading copy · ${words.toLocaleString()} words · ≈ ${Math.round(mins)} min`, text.replace(/\[pause\]/gi, "  /  ").replace(/\*/g, "")), title)}>Reading copy PDF</Btn>
      </> : undefined} />

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* ---------- Setup ---------- */}
        <div className="space-y-4">
          <Card>
            <div className="space-y-3">
              <Field label="Occasion"><select className={inputCls} style={inputStyle} value={spec.occasion} onChange={(e) => u("occasion", e.target.value)}>{OCCASIONS.map((o) => <option key={o}>{o}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Venue"><input className={inputCls} style={inputStyle} value={spec.venue} onChange={(e) => u("venue", e.target.value)} /></Field>
                <Field label="Tone"><select className={inputCls} style={inputStyle} value={spec.tone} onChange={(e) => u("tone", e.target.value)}>{TONES.map((o) => <option key={o}>{o}</option>)}</select></Field>
              </div>
              <Field label="Audience"><input className={inputCls} style={inputStyle} value={spec.audience} onChange={(e) => u("audience", e.target.value)} /></Field>
              <div>
                <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Length</div>
                <div className="flex gap-1.5">{LENGTHS.map((m) => <button key={m} onClick={() => u("minutes", m)} className="flex-1 text-xs rounded-lg border py-1.5" style={{ borderColor: spec.minutes === m ? "var(--brand)" : "var(--border)", color: spec.minutes === m ? "var(--brand)" : "var(--text-muted)", fontWeight: spec.minutes === m ? 700 : 500, background: spec.minutes === m ? "var(--sidebar-active-bg)" : "var(--surface)" }}>{m} min</button>)}</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--text-faint)" }}>≈ {(spec.minutes * WPM).toLocaleString()} words at {WPM} words a minute</div>
              </div>
              <Field label="Opening greeting">
                <select className={inputCls} style={inputStyle} value={Object.keys(GREETINGS).find((k) => GREETINGS[k] === spec.greeting) ?? "None"} onChange={(e) => u("greeting", GREETINGS[e.target.value])}>{Object.keys(GREETINGS).map((k) => <option key={k}>{k}</option>)}</select>
              </Field>
              <Field label="Key messages (one per line — type or dictate)"><textarea rows={4} className={inputCls + " text-sm"} style={inputStyle} value={spec.messages} onChange={(e) => u("messages", e.target.value)} /></Field>
              {dict.supported && <button onClick={dict.listening ? dict.stop : dict.start} className="text-xs font-semibold" style={{ color: dict.listening ? "var(--neg)" : "var(--brand)" }}>{dict.listening ? "■ Stop dictating" : "🎙 Dictate a message"}</button>}
              <Field label="A story or example (optional)"><input className={inputCls} style={inputStyle} value={spec.story} onChange={(e) => u("story", e.target.value)} placeholder="e.g. the young engineer at the Bikita lithium plant" /></Field>
              <Field label="Call to action"><input className={inputCls} style={inputStyle} value={spec.cta} onChange={(e) => u("cta", e.target.value)} /></Field>
            </div>
          </Card>
          <Card>
            <div className="flex justify-between items-baseline mb-1"><h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Facts bank</h3><span className="text-xs" style={{ color: "var(--text-faint)" }}>{picked.length} selected</span></div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Live from your Desk. The speech may only use the numbers you tick.</p>
            {groups.map((g) => (
              <div key={g} className="mb-3">
                <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--accent)" }}>{g}</div>
                {facts.filter((f) => f.group === g).map((f) => (
                  <label key={f.id} className="flex gap-2 items-start text-xs py-1 cursor-pointer" style={{ color: "var(--text)" }}>
                    <input type="checkbox" checked={picked.includes(f.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.id] : p.filter((x) => x !== f.id)))} className="mt-0.5" style={{ accentColor: "var(--brand)" }} />
                    <span>{f.text} <span style={{ color: "var(--text-faint)" }}>({f.source})</span></span>
                  </label>
                ))}
              </div>
            ))}
          </Card>
          <Btn onClick={gen} disabled={!!busy} className="w-full !py-3">{busy === "draft" ? "Writing your speech…" : text ? "✦ Write a fresh draft" : "✦ Write my speech"}</Btn>
        </div>

        {/* ---------- Editor ---------- */}
        <div className="space-y-4 min-w-0">
          {text ? (
            <>
              <Card className="!p-3">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  {live !== null && <AiTag live={live} />}
                  <span style={{ color: "var(--text)" }}><b>{words.toLocaleString()}</b> words</span>
                  <span style={{ color: Math.abs(mins - target) / target > 0.2 ? "var(--warn)" : "var(--pos)" }}>≈ <b>{mins.toFixed(1)}</b> min <span className="text-xs" style={{ color: "var(--text-faint)" }}>(target {target})</span></span>
                  <button onClick={() => setPanel(panel === "check" ? null : "check")} className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: flagged || check.placeholders ? "var(--lz-yellow-bg)" : "var(--lz-green-bg)", color: flagged || check.placeholders ? "var(--lz-yellow-fg)" : "var(--lz-green-fg)" }}>
                    {flagged || check.placeholders ? `⚠ ${flagged} unverified number${flagged === 1 ? "" : "s"}${check.placeholders ? ` · ${check.placeholders} [figure]` : ""}` : "✓ All numbers from facts bank"}
                  </button>
                  <div className="ml-auto flex gap-2">
                    <Btn kind="ghost" onClick={doPoints}>Talking points</Btn>
                    <Btn kind="ghost" onClick={doPromises}>Scan promises</Btn>
                    <Btn kind="ghost" onClick={() => { d.upsert("drafts", { id: uid("DR"), kind: "Speech", title, body: text, createdAt: new Date().toISOString() }); setSaved(true); }}>{saved ? "✓ Saved" : "Save"}</Btn>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {REWRITES.map((r) => <button key={r.id} onClick={() => rw(r.id, r.instruction)} disabled={!!busy} className="text-xs rounded-full border px-3 py-1 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>{busy === r.id ? "Rewriting…" : r.label}</button>)}
                </div>
              </Card>

              {panel === "check" && (
                <Card>
                  <h3 className="font-bold text-sm mb-2" style={{ color: "var(--text)" }}>Fact check — every number in the speech</h3>
                  {check.items.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No numbers found.</p>}
                  <div className="space-y-1.5">{check.items.map((x, i) => (
                    <div key={i} className="text-xs flex gap-2 items-start"><span className="font-bold shrink-0" style={{ color: x.ok ? "var(--pos)" : "var(--neg)" }}>{x.ok ? "✓" : "?"} {x.n}</span><span style={{ color: "var(--text-muted)" }}>…{x.context}…</span></div>
                  ))}</div>
                  {check.placeholders > 0 && <p className="text-xs mt-2" style={{ color: "var(--warn)" }}>{check.placeholders} [figure] placeholder(s): fill these with verified numbers before delivery.</p>}
                  <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>✓ = matches a number in the facts bank. ? = not in the bank — verify or remove.</p>
                </Card>
              )}
              {panel === "points" && (
                <Card>
                  <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Talking-points card {points && <AiTag live={points.live} />}</h3>{points && <Btn kind="ghost" onClick={async () => shareOrDownload(await textPdf(`Talking points: ${title}`, "One-page card", points.text), "Talking points")}>PDF</Btn>}</div>
                  {busy === "points" ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>Preparing…</p> : <div className="text-sm whitespace-pre-line leading-relaxed" style={{ color: "var(--text)" }}><RichText text={points?.text ?? ""} /></div>}
                </Card>
              )}
              {panel === "promises" && (
                <Card>
                  <h3 className="font-bold text-sm mb-2" style={{ color: "var(--text)" }}>Promises in this speech {promises && <AiTag live={promises.live} />}</h3>
                  {busy === "promises" ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>Scanning…</p> : (
                    <>
                      {(promises?.items ?? []).map((p, i) => <div key={i} className="text-sm py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text)" }}>• {p.title} <span className="text-xs" style={{ color: "var(--text-faint)" }}>— {p.owner}, by {p.due}</span></div>)}
                      {promises && promises.items.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No concrete promises found.</p>}
                      {promises && promises.items.length > 0 && <Btn className="mt-3" onClick={addPromises} disabled={added}>{added ? `✓ Added ${promises.items.length} to Commitments` : `Track these ${promises.items.length} promises in Commitments`}</Btn>}
                      <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>Every public promise becomes a tracked commitment, so nothing said on stage is forgotten.</p>
                    </>
                  )}
                </Card>
              )}

              <Card className="!p-0 overflow-hidden">
                <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full p-5 text-[15px] leading-relaxed outline-none min-h-[60vh] font-serif" style={{ background: "var(--surface)", color: "var(--text)" }} />
              </Card>
            </>
          ) : (
            <Card className="text-center py-16">
              <div className="text-5xl mb-3">🎤</div>
              <div className="font-bold text-lg" style={{ color: "var(--text)" }}>Your speech appears here</div>
              <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>Set the occasion, tick the facts you want to use, and press <b>Write my speech</b>. Then polish it with one-click rewrites, fact-check every number, and rehearse on the teleprompter.</p>
            </Card>
          )}
        </div>
      </div>

      {prompter && <Teleprompter text={text} onClose={() => setPrompter(false)} />}
    </div>
  );
}
