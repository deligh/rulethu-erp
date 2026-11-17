"use client";

import { useRef, useState, useCallback } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";

const COLORS = [
  "var(--lz-yellow-bg)",
  "var(--lz-blue-bg)",
  "var(--lz-green-bg)",
  "var(--lz-purple-bg)",
  "var(--lz-red-bg)",
];

export default function BoardPage() {
  const { boardNotes, add, patch, remove } = useAppData();
  const { user } = useAuth();
  const me = user?.name ?? "Delight";
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);

  const addNote = () => {
    add("boardNotes", {
      id: genId("BN"),
      author: me,
      text: "New note",
      color,
      x: 20 + Math.random() * 30,
      y: 20 + Math.random() * 30,
      createdAt: new Date().toISOString(),
    });
  };

  const pointFromEvent = useCallback((clientX: number, clientY: number) => {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(92, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(90, ((clientY - r.top) / r.height) * 100)),
    };
  }, []);

  const onDown = (e: React.PointerEvent, id: string, nx: number, ny: number) => {
    const p = pointFromEvent(e.clientX, e.clientY);
    setDrag({ id, dx: p.x - nx, dy: p.y - ny });
    setLive({ id, x: nx, y: ny });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointFromEvent(e.clientX, e.clientY);
    setLive({ id: drag.id, x: p.x - drag.dx, y: p.y - drag.dy });
  };
  const onUp = () => {
    if (drag && live) patch("boardNotes", drag.id, { x: live.x, y: live.y });
    setDrag(null); setLive(null);
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Whiteboard"
        subtitle="A live shared canvas — drop sticky notes, brainstorm and map ideas with the group. Drag to move; everyone sees updates."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--pos)" }} /> Live · shared with the group
            </span>
            <Badge tone="live">{boardNotes.length} notes</Badge>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className="h-5 w-5 rounded-full border-2" style={{ background: c, borderColor: color === c ? "var(--brand)" : "transparent" }} aria-label="colour" />
              ))}
            </div>
            <button onClick={addNote} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>+ Note</button>
          </div>
        }
      />

      <div
        ref={boardRef}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="relative rounded-xl border overflow-hidden"
        style={{
          height: "calc(100vh - 220px)",
          minHeight: 460,
          borderColor: "var(--border)",
          background:
            "radial-gradient(circle, var(--border) 1px, transparent 1px) 0 0 / 22px 22px, var(--surface)",
          touchAction: "none",
        }}
      >
        {boardNotes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "var(--text-faint)" }}>
            Empty board — click <span className="mx-1 font-semibold" style={{ color: "var(--brand)" }}>+ Note</span> to add the first sticky.
          </div>
        )}
        {boardNotes.map((n) => {
          const pos = live && live.id === n.id ? live : n;
          const dragging = drag?.id === n.id;
          return (
            <div
              key={n.id}
              className="absolute w-44 rounded-lg p-2.5 shadow-md select-none"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                background: n.color,
                border: "1px solid var(--border)",
                cursor: dragging ? "grabbing" : "grab",
                zIndex: dragging ? 20 : 1,
                boxShadow: dragging ? "0 10px 24px rgba(0,0,0,0.18)" : "var(--shadow-card)",
              }}
            >
              <div
                onPointerDown={(e) => onDown(e, n.id, pos.x, pos.y)}
                className="flex items-center justify-between mb-1 cursor-grab"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{n.author}</span>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove("boardNotes", n.id)} className="text-xs leading-none" style={{ color: "var(--text-faint)" }} aria-label="delete">✕</button>
              </div>
              <textarea
                value={n.text}
                onChange={(e) => patch("boardNotes", n.id, { text: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                rows={3}
                className="w-full resize-none bg-transparent text-sm outline-none"
                style={{ color: "var(--text)" }}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
        Drag a note by its top bar. Edit text inline. Pick a colour before adding. The board is shared with everyone and syncs across devices.
      </p>
    </div>
  );
}
