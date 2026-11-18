"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeskProvider, useDesk, isOverdue } from "@/lib/desk/store";

const LOCK_KEY = "mdesk-lock-v1";
const SESSION_KEY = "mdesk-unlocked";

export const NAV = [
  { href: "/desk", label: "Today", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/desk/economy", label: "Economy Builder", icon: "M3 3v18h18M7 16l3-5 4 3 5-8" },
  { href: "/desk/commitments", label: "Commitments", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" },
  { href: "/desk/calendar", label: "Calendar", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
  { href: "/desk/meetings", label: "Meetings", icon: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" },
  { href: "/desk/pipeline", label: "Investment", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
  { href: "/desk/drafts", label: "Drafter", icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
  { href: "/desk/ask", label: "Ask the Desk", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { href: "/lab", label: "Economic Lab", icon: "M13 2 4 14h7l-1 8 9-12h-7l1-8z" },
  { href: "/desk/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];
const MOBILE = ["/desk", "/desk/economy", "/desk/commitments", "/desk/meetings", "/desk/ask"];

export function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mdesk:" + s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function Lock({ onOpen }: { onOpen: () => void }) {
  const [hash, setHash] = useState<string | null | undefined>(undefined);
  const [pin, setPin] = useState(""), [pin2, setPin2] = useState(""), [err, setErr] = useState("");
  useEffect(() => { try { setHash(localStorage.getItem(LOCK_KEY)); } catch { setHash(null); } }, []);
  if (hash === undefined) return null;
  const setup = !hash;
  const go = async () => {
    setErr("");
    if (setup) {
      if (pin.length < 4) return setErr("Use at least 4 digits.");
      if (pin !== pin2) return setErr("The two passcodes don't match.");
      try { localStorage.setItem(LOCK_KEY, await sha(pin)); } catch { /* ignore */ }
      onOpen();
    } else if ((await sha(pin)) === hash) onOpen();
    else { setErr("Wrong passcode."); setPin(""); }
  };
  return (
    <div className="h-[100dvh] flex items-center justify-center p-6" style={{ background: "linear-gradient(150deg, #04261d 0%, #0b6e4f 70%, #0f7f5c 100%)" }}>
      <div className="w-full max-w-sm text-center text-white">
        <div className="flex h-1.5 w-24 mx-auto rounded overflow-hidden mb-6">
          <div className="flex-1" style={{ background: "#319B42" }} /><div className="flex-1" style={{ background: "#FFD200" }} /><div className="flex-1" style={{ background: "#DE2010" }} /><div className="flex-1" style={{ background: "#000" }} />
        </div>
        <div className="text-[11px] tracking-[0.25em] uppercase" style={{ color: "#f3d675" }}>Minister&apos;s Desk</div>
        <h1 className="text-2xl font-bold mt-1">{setup ? "Set your passcode" : "Welcome back"}</h1>
        <p className="text-sm opacity-80 mt-1">{setup ? "Protects the Desk on this device." : "Enter your passcode to open the Desk."}</p>
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="mt-6 space-y-3">
          <input autoFocus inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Passcode" className="w-full rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] outline-none" style={{ background: "rgba(255,255,255,0.95)", color: "#172b4d" }} />
          {setup && <input inputMode="numeric" type="password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Repeat passcode" className="w-full rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] outline-none" style={{ background: "rgba(255,255,255,0.95)", color: "#172b4d" }} />}
          {err && <div className="text-sm" style={{ color: "#ffb4a8" }}>{err}</div>}
          <button type="submit" className="w-full rounded-xl py-3 font-semibold" style={{ background: "#f3d675", color: "#1f1600" }}>{setup ? "Set passcode & open" : "Open the Desk"}</button>
        </form>
        {setup && <button onClick={onOpen} className="mt-4 text-xs underline opacity-70">Skip for now (demo)</button>}
        <p className="text-[11px] opacity-60 mt-8">Data stays on this device. Demo build with sample data.</p>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = (usePathname() ?? "/desk").replace(/\/$/, "") || "/desk";
  const d = useDesk();
  const overdue = d.commitments.filter((c) => isOverdue(c)).length;
  const lock = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } location.reload(); };
  const active = (href: string) => (href === "/desk" ? path === "/desk" : path.startsWith(href));
  return (
    <div className="h-[100dvh] flex" style={{ background: "var(--bg)" }}>
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col text-white" style={{ background: "linear-gradient(180deg, #06352a 0%, #0a5c43 100%)" }}>
        <div className="flex h-1"><div className="flex-1" style={{ background: "#319B42" }} /><div className="flex-1" style={{ background: "#FFD200" }} /><div className="flex-1" style={{ background: "#DE2010" }} /><div className="flex-1" style={{ background: "#000" }} /></div>
        <div className="px-5 pt-5 pb-4">
          <div className="text-[10px] tracking-[0.25em] uppercase" style={{ color: "#f3d675" }}>Minister&apos;s Desk</div>
          <div className="text-lg font-bold leading-tight mt-0.5">Economic Development</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition" style={{ background: active(n.href) ? "rgba(255,255,255,0.14)" : "transparent", fontWeight: active(n.href) ? 700 : 500, color: active(n.href) ? "#fff" : "rgba(255,255,255,0.78)" }}>
              <Icon d={n.icon} />
              <span className="flex-1">{n.label}</span>
              {n.href === "/desk/commitments" && overdue > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: "#DE2010" }}>{overdue}</span>}
            </Link>
          ))}
        </nav>
        <button onClick={lock} className="m-3 rounded-lg px-3 py-2 text-xs text-left" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}>🔒 Lock the Desk</button>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden flex items-center justify-between px-4 py-3 text-white" style={{ background: "linear-gradient(135deg, #06352a, #0b6e4f)" }}>
          <div>
            <div className="text-[9px] tracking-[0.25em] uppercase" style={{ color: "#f3d675" }}>Minister&apos;s Desk</div>
            <div className="text-sm font-bold">{NAV.find((n) => active(n.href))?.label ?? "Today"}</div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/lab" className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.14)" }}>⚡ Lab</Link>
            <Link href="/desk/calendar" className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.14)" }}>Calendar</Link>
            <Link href="/desk/pipeline" className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.14)" }}>Invest</Link>
            <Link href="/desk/drafts" className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.14)" }}>Draft</Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-10">{children}</div>
        </main>
        {/* Bottom tabs (mobile) */}
        <nav className="md:hidden flex border-t" style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] relative" style={{ color: active(n.href) ? "var(--brand)" : "var(--text-faint)", fontWeight: active(n.href) ? 700 : 500 }}>
              <Icon d={n.icon} size={20} />
              {n.label === "Ask the Desk" ? "Ask" : n.label === "Economy Builder" ? "Economy" : n.label}
              {n.href === "/desk/commitments" && overdue > 0 && <span className="absolute top-1 right-[28%] h-2 w-2 rounded-full" style={{ background: "#DE2010" }} />}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function DeskShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => { try { setOpen(sessionStorage.getItem(SESSION_KEY) === "1"); } catch { setOpen(false); } }, []);
  const unlock = () => { try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ } setOpen(true); };
  if (open === null) return <div className="h-[100dvh]" style={{ background: "#06352a" }} />;
  if (!open) return <Lock onOpen={unlock} />;
  return <DeskProvider><Shell>{children}</Shell></DeskProvider>;
}
