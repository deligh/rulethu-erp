"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
const ACCENTS: { key: string; label: string; swatch: string }[] = [
  { key: "green", label: "Rulethu green", swatch: "#0b6e4f" },
  { key: "teal", label: "Teal", swatch: "#0e7c86" },
  { key: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { key: "violet", label: "Violet", swatch: "#7c3aed" },
  { key: "amber", label: "Amber", swatch: "#b45309" },
  { key: "rose", label: "Rose", swatch: "#be123c" },
];

const resolve = (m: Mode): "light" | "dark" =>
  m === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : m;

export default function ThemeControl() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("system");
  const [accent, setAccent] = useState("green");

  useEffect(() => {
    try {
      setMode((localStorage.getItem("rulethu-theme") as Mode) || "system");
      setAccent(localStorage.getItem("rulethu-accent") || "green");
    } catch { /* ignore */ }
  }, []);

  // Keep following the OS when in "system" mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.setAttribute("data-theme", resolve("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const applyMode = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem("rulethu-theme", m); } catch { /* ignore */ }
    document.documentElement.setAttribute("data-theme", resolve(m));
  };
  const applyAccent = (a: string) => {
    setAccent(a);
    try { localStorage.setItem("rulethu-accent", a); } catch { /* ignore */ }
    document.documentElement.setAttribute("data-accent", a);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 flex items-center justify-center rounded-md border"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        title="Appearance"
        aria-label="Appearance"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 rounded-lg border p-3 z-30" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-overlay)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faint)" }}>Theme</div>
            <div className="flex gap-1 rounded-lg border p-0.5 mb-3" style={{ borderColor: "var(--border)" }}>
              {(["light", "dark", "system"] as Mode[]).map((m) => (
                <button key={m} onClick={() => applyMode(m)} className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize"
                  style={{ background: mode === m ? "var(--brand)" : "transparent", color: mode === m ? "#fff" : "var(--text-muted)" }}>
                  {m}
                </button>
              ))}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faint)" }}>Accent colour</div>
            <div className="grid grid-cols-6 gap-1.5">
              {ACCENTS.map((a) => (
                <button key={a.key} onClick={() => applyAccent(a.key)} title={a.label}
                  className="h-7 w-7 rounded-full flex items-center justify-center"
                  style={{ background: a.swatch, outline: accent === a.key ? "2px solid var(--text)" : "none", outlineOffset: 2 }}>
                  {accent === a.key && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px]" style={{ color: "var(--text-faint)" }}>Saved on this device · applies across the platform.</p>
          </div>
        </>
      )}
    </div>
  );
}
