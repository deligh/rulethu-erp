"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/store";
import { useAuth } from "@/lib/auth";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function NotificationsBell() {
  const { notifications, markAllRead, markNoteRead, hydrated } = useAppData();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const openNote = (id: string, href?: string) => {
    markNoteRead(id);
    setOpen(false);
    if (href) router.push(href);
  };

  // Notifications addressed to me or everyone.
  const mine = notifications.filter((n) => n.audience === "all" || n.audience === user?.name);
  const unread = hydrated ? mine.filter((n) => !n.read).length : 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)" }}>
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white" style={{ background: "var(--neg)" }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border shadow-lg z-30"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Notifications</span>
              <button onClick={markAllRead} className="text-xs font-medium" style={{ color: "var(--brand)" }}>
                Mark all read
              </button>
            </div>
            {mine.length === 0 && (
              <div className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-faint)" }}>
                Nothing yet.
              </div>
            )}
            {mine.slice(0, 30).map((n) => {
              const clickable = !!n.href;
              return (
                <div
                  key={n.id}
                  onClick={clickable ? () => openNote(n.id, n.href) : undefined}
                  className={`px-4 py-3 border-b ${clickable ? "cursor-pointer hover:bg-[var(--surface-2)]" : ""}`}
                  style={{ borderColor: "var(--border)", background: n.read ? "transparent" : "color-mix(in srgb, var(--brand) 6%, transparent)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{n.title}</span>
                    <span className="text-[11px] shrink-0" style={{ color: "var(--text-faint)" }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{n.body}</p>}
                  {clickable && <span className="mt-1 inline-block text-[11px] font-semibold" style={{ color: "var(--brand)" }}>Open →</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
