"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { askClaude, aiLastError } from "@/lib/aiClient";
import { PageHeader, Card, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { fmtMoney, compact } from "@/lib/format";

export default function DealRoomsPage() {
  const { dealRooms, dealRoomNotes, dealRoomChats, holdings, deals, add, remove } = useAppData();
  const { user } = useAuth();
  const me = user?.name ?? "Rulethu";
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  const [activeId, setActiveId] = useState<string | null>(dealRooms[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // New-room form
  const [rName, setRName] = useState("");
  const [rSubject, setRSubject] = useState("");
  const [rLink, setRLink] = useState("");

  const active = useMemo(() => dealRooms.find((r) => r.id === activeId) ?? null, [dealRooms, activeId]);
  const notes = useMemo(() => dealRoomNotes.filter((n) => n.roomId === activeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [dealRoomNotes, activeId]);
  const chats = useMemo(() => dealRoomChats.filter((c) => c.roomId === activeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [dealRoomChats, activeId]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats.length, busy]);

  // Linked live entity for the active room.
  const linked = useMemo(() => {
    if (!active?.linkId) return null;
    if (active.linkKind === "holding") {
      const h = holdings.find((x) => x.id === active.linkId);
      if (!h) return null;
      const moic = h.invested ? h.fairValue / h.invested : 0;
      return {
        kind: "holding" as const, title: h.company, sector: h.sector, status: h.status,
        stats: [
          { k: "Invested", v: compact(h.invested) }, { k: "Fair value", v: compact(h.fairValue) },
          { k: "MOIC", v: `${moic.toFixed(2)}×` }, { k: "Ownership", v: `${h.ownership}%` },
        ],
        context: `LINKED HOLDING — ${h.company} · ${h.sector} · stage ${h.stage} · invested ${fmtMoney(h.invested)} · fair value ${fmtMoney(h.fairValue)} (MOIC ${moic.toFixed(2)}x) · ownership ${h.ownership}% · status ${h.status} · lead ${h.lead} · note: ${h.note}`,
      };
    }
    const d = deals.find((x) => x.id === active.linkId);
    if (!d) return null;
    return {
      kind: "deal" as const, title: d.name, sector: d.sector, status: d.stage,
      stats: [
        { k: "Ticket", v: compact(d.ticket) }, { k: "Stage", v: d.stage },
        { k: "Country", v: d.country }, { k: "Owner", v: d.owner },
      ],
      context: `LINKED PIPELINE DEAL — ${d.name} · ${d.sector} · ${d.country} · stage ${d.stage} · ticket ${fmtMoney(d.ticket)} · owner ${d.owner}`,
    };
  }, [active, holdings, deals]);

  const createRoom = () => {
    const name = rName.trim();
    if (!name) return;
    const id = genId("DR");
    let linkKind: "holding" | "deal" | undefined; let linkId: string | undefined;
    if (rLink) { const [k, lid] = rLink.split(":"); linkKind = k as "holding" | "deal"; linkId = lid; }
    add("dealRooms", { id, name, subject: rSubject.trim() || undefined, linkKind, linkId, createdBy: me, createdAt: new Date().toISOString() });
    setActiveId(id); setCreating(false); setRName(""); setRSubject(""); setRLink("");
  };

  const addNote = () => {
    const t = note.trim(); if (!t || !activeId) return;
    add("dealRoomNotes", { id: genId("DN"), roomId: activeId, text: t, author: me, createdAt: new Date().toISOString() });
    setNote("");
  };

  const ask = async () => {
    const question = q.trim(); if (!question || !activeId || !active) return;
    add("dealRoomChats", { id: genId("DC"), roomId: activeId, role: "user", text: question, author: me, createdAt: new Date().toISOString() });
    setQ(""); setBusy(true);
    const memory = notes.length ? notes.map((n) => `- ${n.text}`).join("\n") : "(no memory notes yet)";
    const history = chats.slice(-8).map((c) => `${c.role === "ai" ? "AI" : "Team"}: ${c.text}`).join("\n");
    const nowStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const text = await askClaude({
      system:
        `You are Rulethu AI's deal-room analyst for "${active.name}" at an African investment group in Harare, Zimbabwe. ` +
        `Today is ${nowStr}. You hold a PERSISTENT MEMORY of this ${active.linkKind ?? "deal"} (the memory notes + linked live data below). ` +
        "Answer the colleague's question using that memory and data, with a concrete, practical Rulethu / Zimbabwe-SADC lens (valuation, risk, next steps). " +
        "If the memory doesn't cover something, say what you'd add to the room. Keep it to 1-3 short paragraphs. Plain text, no markdown asterisks.",
      prompt:
        `ROOM: ${active.name}${active.subject ? ` — ${active.subject}` : ""}\n` +
        `${linked ? linked.context + "\n" : ""}` +
        `MEMORY NOTES:\n${memory}\n\n` +
        `${history ? `RECENT CONVERSATION:\n${history}\n\n` : ""}` +
        `NEW QUESTION: ${question}\n\nAnswer:`,
      model: "sonnet",
      maxTokens: 1200,
    });
    add("dealRoomChats", { id: genId("DC"), roomId: activeId, role: "ai", text: text || `I couldn't answer just now (${aiLastError() ?? "no response"}). Try again in a moment.`, author: "Rulethu AI", createdAt: new Date().toISOString() });
    setBusy(false);
  };

  const linkOptions = [
    ...holdings.map((h) => ({ value: `holding:${h.id}`, label: `Holding · ${h.company}` })),
    ...deals.map((d) => ({ value: `deal:${d.id}`, label: `Deal · ${d.name}` })),
  ];

  return (
    <div>
      <PageHeader
        title="Deal Rooms"
        subtitle="A persistent AI workspace for each company or deal — it remembers the room's notes and the linked live data, so you can ask anything in context and pick up where the team left off."
        actions={<Badge tone="live">AI · memory</Badge>}
      />
      <ModuleTabs moduleKey="ai" />

      <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
        {/* Rooms list */}
        <div className="space-y-2">
          <button onClick={() => setCreating((v) => !v)} className="w-full rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
            {creating ? "Close" : "+ New deal room"}
          </button>
          {creating && (
            <Card className="space-y-2">
              <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Company / deal name" className="w-full rounded-md border px-2.5 py-1.5 text-sm" style={iStyle} />
              <input value={rSubject} onChange={(e) => setRSubject(e.target.value)} placeholder="What's this room about? (optional)" className="w-full rounded-md border px-2.5 py-1.5 text-sm" style={iStyle} />
              <select value={rLink} onChange={(e) => setRLink(e.target.value)} className="w-full rounded-md border px-2.5 py-1.5 text-sm" style={iStyle}>
                <option value="">Link to live data (optional)…</option>
                {linkOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={createRoom} disabled={!rName.trim()} className="w-full rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Create room</button>
            </Card>
          )}
          {dealRooms.length === 0 && !creating && (
            <p className="text-sm px-1 py-4" style={{ color: "var(--text-faint)" }}>No rooms yet — create one for a company or deal.</p>
          )}
          {dealRooms.map((r) => (
            <button key={r.id} onClick={() => setActiveId(r.id)} className="w-full text-left rounded-lg border p-3"
              style={{ background: r.id === activeId ? "var(--surface-2)" : "var(--surface)", borderColor: r.id === activeId ? "var(--brand)" : "var(--border)" }}>
              <div className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{r.name}</div>
              {r.subject && <div className="text-[11px] leading-snug mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>{r.subject}</div>}
              <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-faint)" }}>
                {dealRoomNotes.filter((n) => n.roomId === r.id).length} notes · {dealRoomChats.filter((c) => c.roomId === r.id).length} msgs
              </div>
            </button>
          ))}
        </div>

        {/* Active room */}
        {!active ? (
          <Card className="border-dashed"><p className="py-16 text-center text-sm" style={{ color: "var(--text-faint)" }}>Select a room, or create one.</p></Card>
        ) : (
          <div className="space-y-4">
            {/* Header + linked live data */}
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>{active.name}</h2>
                  {active.subject && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{active.subject}</p>}
                </div>
                <button onClick={() => { if (confirm(`Delete the room "${active.name}" and its notes & chat?`)) { dealRoomNotes.filter((n) => n.roomId === active.id).forEach((n) => remove("dealRoomNotes", n.id)); dealRoomChats.filter((c) => c.roomId === active.id).forEach((c) => remove("dealRoomChats", c.id)); remove("dealRooms", active.id); setActiveId(null); } }}
                  className="text-[11px] font-medium" style={{ color: "var(--neg)" }}>Delete room</button>
              </div>
              {linked && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge tone="info">{linked.kind === "holding" ? "Linked holding" : "Linked deal"}</Badge>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{linked.sector} · {linked.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {linked.stats.map((s, i) => (
                      <div key={i}><div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{s.k}</div><div className="text-sm font-bold" style={{ color: "var(--text)" }}>{s.v}</div></div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="grid lg:grid-cols-2 gap-4 items-start">
              {/* Memory */}
              <Card className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>🧠 Memory</h3>
                  <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{notes.length} notes · the AI uses these</span>
                </div>
                <div className="flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} placeholder="Add a fact, decision or risk the room should remember…" className="flex-1 rounded-md border px-2.5 py-1.5 text-sm" style={iStyle} />
                  <button onClick={addNote} disabled={!note.trim()} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white shrink-0 disabled:opacity-50" style={{ background: "var(--brand)" }}>Add</button>
                </div>
                {notes.length === 0 ? (
                  <p className="text-sm py-3" style={{ color: "var(--text-faint)" }}>No memory yet — add the key facts, decisions and risks.</p>
                ) : (
                  <ul className="space-y-2">
                    {notes.map((n) => (
                      <li key={n.id} className="group rounded-md border p-2.5 text-sm" style={{ borderColor: "var(--border)" }}>
                        <div style={{ color: "var(--text)" }}>{n.text}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{n.author} · {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                          <button onClick={() => remove("dealRoomNotes", n.id)} className="text-[10px] opacity-0 group-hover:opacity-100" style={{ color: "var(--neg)" }}>remove</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Chat */}
              <Card className="flex flex-col" >
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--text)" }}>💬 Ask the room</h3>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 360 }}>
                  {chats.length === 0 && !busy && (
                    <p className="text-sm py-3" style={{ color: "var(--text-faint)" }}>Ask anything about {active.name} — the AI answers from this room&apos;s memory and linked live data.</p>
                  )}
                  {chats.map((c) => (
                    <div key={c.id} className={c.role === "ai" ? "flex gap-2" : "flex gap-2 flex-row-reverse"}>
                      <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: c.role === "ai" ? "var(--accent)" : "var(--brand)", color: c.role === "ai" ? "#1a1205" : "#fff" }}>{c.role === "ai" ? "✦" : me.slice(0, 1).toUpperCase()}</div>
                      <div className="max-w-[85%] rounded-lg border px-3 py-2 text-sm whitespace-pre-line" style={{ background: c.role === "ai" ? "var(--surface-2)" : "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>{c.text}</div>
                    </div>
                  ))}
                  {busy && <div className="flex gap-2"><div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs" style={{ background: "var(--accent)", color: "#1a1205" }}>✦</div><div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Thinking…</div></div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2 mt-3">
                  <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !busy) ask(); }} placeholder="e.g. What's the biggest risk here, and the next step?" className="flex-1 rounded-md border px-2.5 py-1.5 text-sm" style={iStyle} />
                  <button onClick={ask} disabled={busy || !q.trim()} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white shrink-0 disabled:opacity-50" style={{ background: "var(--brand)" }}>Ask</button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
