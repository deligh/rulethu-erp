"use client";

import { useMemo, useRef, useState } from "react";
import { useAppData, Attachment } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { buildDigest, runChecks, DigestSection } from "@/lib/ai";
import { PageHeader, Badge } from "@/components/ui";
import Avatar from "@/components/Avatar";

const MAX_BYTES = 1_500_000; // ~1.5 MB per file (browser storage limit)

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6";
  if (type.includes("pdf")) return "M6 2h9l5 5v15H6zM14 2v6h6";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "M4 4h16v16H4zM4 10h16M10 4v16";
  return "M14 2H6v20h12V8zM14 2v6h6";
}

export default function CommsPage() {
  const d = useAppData();
  const { channels, messages, addMessage, addChannel, addChannelMember, setChannelContext, addChannelInsight } = d;
  const { user, accounts } = useAuth();
  const [activeId, setActiveId] = useState("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState<string[]>([]); // emails for a new channel
  const [memberQuery, setMemberQuery] = useState("");
  const [managing, setManaging] = useState(false);
  const [manageQuery, setManageQuery] = useState("");
  const [briefing, setBriefing] = useState(false);     // brief/context panel open
  const [ctxDraft, setCtxDraft] = useState<string | null>(null); // editing buffer
  const [insightText, setInsightText] = useState("");

  const myEmail = (user?.email ?? "").toLowerCase();
  const canSee = (c: typeof channels[number]) => !c.private || (!!myEmail && (c.members ?? []).includes(myEmail));
  const [digest, setDigest] = useState<{ heading: string; sections: DigestSection[] } | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);

  const makeDigest = () => {
    setDigestBusy(true);
    setTimeout(() => {
      const checks = runChecks({
        entries: d.entries, pos: d.pos, requisitions: d.requisitions, requests: d.requests,
        tbills: d.tbills, loans: d.loans, leave: d.leave, employees: d.employees, deals: d.deals, goals: d.goals,
      });
      setDigest(buildDigest({
        entries: d.entries, pos: d.pos, requests: d.requests, reports: d.reports, leave: d.leave,
        deals: d.deals, tasks: d.tasks, tbills: d.tbills, loans: d.loans, checks,
      }));
      setDigestBusy(false);
    }, 420);
  };

  const postDigest = () => {
    if (!digest) return;
    const text = `📋 ${digest.heading}\n\n` + digest.sections.map((s) => `${s.title}\n${s.items.map((i) => `• ${i}`).join("\n")}`).join("\n\n");
    addMessage("announcements", "announcement", text, undefined, user?.name);
    setDigest(null);
    setActiveId("announcements");
  };
  const [text, setText] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [pending, setPending] = useState<Attachment | null>(null);
  const [creating, setCreating] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleChannels = channels.filter(canSee);
  const active = visibleChannels.find((c) => c.id === activeId) ?? visibleChannels[0];
  const channelMessages = useMemo(
    () => messages.filter((m) => m.channelId === (active?.id ?? "general")),
    [messages, active],
  );

  // accounts not already a member, filtered by a query — for the member pickers
  const pickable = (query: string, exclude: string[]) => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => !exclude.includes(a.email))
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.email.includes(q))
      .slice(0, 6);
  };

  const onFile = (file?: File) => {
    setError("");
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is ${fmtBytes(file.size)} — max is ${fmtBytes(MAX_BYTES)} in this demo.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPending({ name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const send = () => {
    const t = text.trim();
    if (!t && !pending) return;
    addMessage(active.id, isAnnouncement ? "announcement" : "message", t, pending ?? undefined, user?.name);
    setText("");
    setPending(null);
    setIsAnnouncement(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const createChannel = () => {
    const name = newChannel.trim();
    if (!name) return;
    const id = addChannel(name, isPrivate
      ? { isPrivate: true, members: [...members, myEmail].filter(Boolean), createdBy: user?.name }
      : { createdBy: user?.name });
    setActiveId(id);
    setNewChannel(""); setCreating(false); setIsPrivate(false); setMembers([]); setMemberQuery("");
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  return (
    <div>
      <PageHeader
        title="Comms"
        subtitle="A Slack-style workspace — channels, messages, announcements and file sharing for the whole team."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={makeDigest} disabled={digestBusy} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand)" }} title="Ask AI to summarise what's been done across the group">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
              {digestBusy ? "Summarising…" : "AI digest"}
            </button>
            <Badge tone="live">{visibleChannels.length} channels</Badge>
          </div>
        }
      />

      {digest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh]" style={{ background: "color-mix(in srgb, #0b0f17 55%, transparent)" }} onClick={() => setDigest(null)}>
          <div className="w-full max-w-lg rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-overlay)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, color-mix(in srgb, var(--brand) 12%, var(--surface)), var(--surface))" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
              <div className="font-semibold" style={{ color: "var(--text)" }}>{digest.heading}</div>
            </div>
            <div className="max-h-[56vh] overflow-y-auto px-5 py-4 space-y-4">
              {digest.sections.map((s) => (
                <div key={s.title}>
                  <div className="text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>{s.title}</div>
                  <ul className="space-y-1">
                    {s.items.map((it, i) => (
                      <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                        <span style={{ color: "var(--brand)" }}>•</span><span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>Arranged by Rulethu AI from live data — demo mode.</span>
              <div className="flex gap-2">
                <button onClick={() => setDigest(null)} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Close</button>
                <button onClick={postDigest} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--brand)" }}>Post to #announcements</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[220px_1fr] gap-4 items-start rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
        {/* Channel list */}
        <div className="border-r h-[64vh] overflow-y-auto" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="flex items-center justify-between px-3 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Channels</span>
            <button onClick={() => setCreating((c) => !c)} className="flex h-5 w-5 items-center justify-center rounded" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }} title="Create channel">+</button>
          </div>
          {creating && (
            <div className="px-3 pb-2">
              <input
                autoFocus
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !isPrivate) createChannel(); if (e.key === "Escape") setCreating(false); }}
                placeholder="new-channel"
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                style={inputStyle}
              />
              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: "var(--text-muted)" }}>
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                🔒 Private — only people you add can see it
              </label>
              {isPrivate && (
                <div className="mt-1.5">
                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {members.map((e) => {
                        const a = accounts.find((x) => x.email === e);
                        return <span key={e} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "var(--surface-3)", color: "var(--text)" }}>{a?.name ?? e}<button onClick={() => setMembers((m) => m.filter((x) => x !== e))} style={{ color: "var(--text-faint)" }}>✕</button></span>;
                      })}
                    </div>
                  )}
                  <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Add by name or email…" className="w-full rounded-md border px-2 py-1 text-xs" style={inputStyle} />
                  {memberQuery && (
                    <div className="mt-1 rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                      {pickable(memberQuery, [...members, myEmail]).map((a) => (
                        <button key={a.id} onClick={() => { setMembers((m) => [...m, a.email]); setMemberQuery(""); }} className="w-full text-left px-2 py-1 text-xs hover:bg-[var(--surface-3)]" style={{ color: "var(--text)" }}>{a.name} <span style={{ color: "var(--text-faint)" }}>· {a.email}</span></button>
                      ))}
                      {pickable(memberQuery, [...members, myEmail]).length === 0 && <div className="px-2 py-1 text-[11px]" style={{ color: "var(--text-faint)" }}>No match</div>}
                    </div>
                  )}
                </div>
              )}
              <button onClick={createChannel} className="mt-1.5 w-full rounded-md px-2 py-1 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Create {isPrivate ? "private " : ""}channel</button>
            </div>
          )}
          <div className="pb-3">
            {visibleChannels.map((c) => {
              const on = c.id === active?.id;
              const unread = messages.filter((m) => m.channelId === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => { setActiveId(c.id); setManaging(false); }}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-sm text-left"
                  style={{ background: on ? "var(--sidebar-active-bg)" : "transparent", color: on ? "var(--sidebar-active-fg)" : "var(--text-muted)", fontWeight: on ? 600 : 400 }}
                >
                  <span style={{ color: "var(--text-faint)" }}>{c.private ? "🔒" : "#"}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{unread}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message area */}
        <div className="flex flex-col h-[64vh]">
          <div className="px-4 py-3 border-b flex items-start justify-between gap-3" style={{ borderColor: "var(--border)" }}>
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-1.5" style={{ color: "var(--text)" }}>{active?.private ? "🔒" : "#"} {active?.name}</div>
              {active?.description && <div className="text-xs" style={{ color: "var(--text-faint)" }}>{active.description}</div>}
              {active?.private && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{active.members?.length ?? 0} member{(active.members?.length ?? 0) !== 1 ? "s" : ""} · only members can see this</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => { setBriefing((b) => !b); setCtxDraft(null); }} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: briefing ? "var(--brand)" : "var(--text-muted)" }}>
                {active?.context ? "📋 Brief" : "+ Brief"}
              </button>
              {active?.private && (
                <button onClick={() => setManaging((m) => !m)} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>{managing ? "Done" : "Members"}</button>
              )}
            </div>
          </div>

          {/* Channel brief / context — owner sets the style & intent; members add insights; the AI uses it when drafting */}
          {briefing && active && (() => {
            const isOwner = !!user && user.name === active.createdBy;
            const editing = ctxDraft !== null;
            return (
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Brief &amp; context — guides how the AI drafts for this channel</div>
                  {isOwner && !editing && (
                    <button onClick={() => setCtxDraft(active.context ?? "")} className="text-[11px] font-semibold" style={{ color: "var(--brand)" }}>{active.context ? "Edit" : "Set brief"}</button>
                  )}
                </div>
                {editing ? (
                  <div>
                    <textarea
                      value={ctxDraft}
                      onChange={(e) => setCtxDraft(e.target.value)}
                      rows={4}
                      placeholder="e.g. All memos for this deal: institutional tone, USD, lead with the recommendation, max 2 pages, cite the model. Audience: Investment Committee."
                      className="w-full rounded-md border px-2.5 py-2 text-sm"
                      style={inputStyle}
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => { setChannelContext(active.id, ctxDraft.trim()); setCtxDraft(null); }} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--brand)" }}>Save brief</button>
                      <button onClick={() => setCtxDraft(null)} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Cancel</button>
                    </div>
                  </div>
                ) : active.context ? (
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{active.context}</p>
                ) : (
                  <p className="text-sm" style={{ color: "var(--text-faint)" }}>{isOwner ? "No brief yet — set how documents for this channel should be written (style, audience, must-haves)." : "The channel owner hasn’t set a brief yet."}</p>
                )}

                {/* Insights from members → shared context database */}
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Insights ({active.insights?.length ?? 0})</div>
                  {(active.insights ?? []).length > 0 && (
                    <ul className="space-y-1 mb-2">
                      {(active.insights ?? []).map((ins) => (
                        <li key={ins.id} className="text-sm" style={{ color: "var(--text-muted)" }}>
                          <span className="font-semibold" style={{ color: "var(--text)" }}>{ins.author}:</span> {ins.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={insightText}
                      onChange={(e) => setInsightText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && insightText.trim()) { addChannelInsight(active.id, insightText.trim(), user?.name); setInsightText(""); } }}
                      placeholder="Add an insight the AI should know (facts, preferences, context)…"
                      className="flex-1 rounded-md border px-2.5 py-1.5 text-sm"
                      style={inputStyle}
                    />
                    <button onClick={() => { if (insightText.trim()) { addChannelInsight(active.id, insightText.trim(), user?.name); setInsightText(""); } }} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Add</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {managing && active?.private && (
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faint)" }}>Members</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(active.members ?? []).map((e) => {
                  const a = accounts.find((x) => x.email === e);
                  return <span key={e} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>{a?.name ?? e}{e === active.createdBy?.toLowerCase() ? " · owner" : ""}</span>;
                })}
              </div>
              <input value={manageQuery} onChange={(e) => setManageQuery(e.target.value)} placeholder="Add someone by name or email…" className="w-full rounded-md border px-2.5 py-1.5 text-sm" style={inputStyle} />
              {manageQuery && (
                <div className="mt-1 rounded-md border overflow-hidden max-w-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  {pickable(manageQuery, active.members ?? []).map((a) => (
                    <button key={a.id} onClick={() => { addChannelMember(active.id, a.email); setManageQuery(""); }} className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[var(--surface-2)]" style={{ color: "var(--text)" }}>+ {a.name} <span style={{ color: "var(--text-faint)" }}>· {a.email}</span></button>
                  ))}
                  {pickable(manageQuery, active.members ?? []).length === 0 && <div className="px-2.5 py-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>No match</div>}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {channelMessages.length === 0 && (
              <div className="text-sm text-center pt-10" style={{ color: "var(--text-faint)" }}>No messages yet in #{active?.name}. Say hello 👋</div>
            )}
            {channelMessages.map((m) => (
              <div key={m.id} className="flex gap-3">
                <Avatar name={m.author} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{m.author}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{timeLabel(m.createdAt)}</span>
                    {m.kind === "announcement" && <Badge tone="warn">Announcement</Badge>}
                  </div>
                  {m.text && <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: "var(--text)" }}>{m.text}</p>}
                  {m.attachment && (
                    <div className="mt-2 inline-flex items-center gap-3 rounded-lg border p-2.5 max-w-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                      {m.attachment.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.attachment.dataUrl} alt={m.attachment.name} className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded" style={{ background: "var(--surface-3)", color: "var(--brand)" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={fileIcon(m.attachment.type)} /></svg>
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{m.attachment.name}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{fmtBytes(m.attachment.size)}</div>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        {!m.attachment.type.startsWith("image/") && (
                          <button
                            onClick={() => {
                              const du = m.attachment!.dataUrl;
                              let htmlStr = "";
                              try {
                                const payload = du.split(",").slice(1).join(",");
                                htmlStr = du.includes(";base64,") ? decodeURIComponent(escape(atob(payload))) : decodeURIComponent(payload);
                              } catch { htmlStr = ""; }
                              const w = window.open("", "_blank");
                              if (w && htmlStr) { w.document.write(htmlStr); w.document.close(); }
                            }}
                            className="rounded-md border px-2.5 py-1.5 text-xs font-medium"
                            style={{ borderColor: "var(--border)", color: "var(--text)" }}
                          >
                            Open
                          </button>
                        )}
                        <a href={m.attachment.dataUrl} download={m.attachment.name} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>
                          Download
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
            {error && <div className="mb-2 text-xs" style={{ color: "var(--neg)" }}>{error}</div>}
            {pending && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                📎 {pending.name} · {fmtBytes(pending.size)}
                <button onClick={() => setPending(null)} style={{ color: "var(--text-faint)" }}>✕</button>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                <input type="checkbox" checked={isAnnouncement} onChange={(e) => setIsAnnouncement(e.target.checked)} />
                Post as announcement (notifies everyone)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} className="flex h-9 w-9 items-center justify-center rounded-md border shrink-0" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }} title="Attach a file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95L9.9 18.35a2 2 0 01-2.83-2.83l8.49-8.49" /></svg>
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder={`Message #${active?.name}…`}
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                style={inputStyle}
              />
              <button onClick={send} className="rounded-md px-4 py-2 text-sm font-medium text-white shrink-0" style={{ background: "var(--brand)" }}>Send</button>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
        Files up to {fmtBytes(MAX_BYTES)} are stored in the browser and downloadable by anyone using this session. Larger files and true multi-user sync arrive with the database.
      </p>
    </div>
  );
}
