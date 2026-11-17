"use client";

import { useState } from "react";
import { useAuth, DEMO_PASSWORD } from "@/lib/auth";
import { accessSummary } from "@/lib/access";
import Avatar from "@/components/Avatar";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, hydrated, accounts, login, register, loginAs } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // Avoid SSR/hydration flash: render a neutral splash until we've read storage.
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg, var(--surface-2))" }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-faint)" }}>
          <span className="h-5 w-5 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ background: "var(--brand)" }}>R</span>
          Loading…
        </div>
      </div>
    );
  }

  if (user) return <>{children}</>;

  const submit = () => {
    setError("");
    if (mode === "register") {
      if (password !== confirm) { setError("Passwords don't match."); return; }
      const res = register(email, fullName, password);
      if (!res.ok) setError(res.error ?? "Registration failed.");
      return;
    }
    const res = login(email, password);
    if (!res.ok) setError(res.error ?? "Sign-in failed.");
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: "var(--surface)" }}>
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden" style={{ background: "linear-gradient(155deg, #0b6e4f 0%, #08543c 55%, #042e22 100%)" }}>
        {/* subtle radial glow + grid pattern */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle, rgba(201,162,39,0.35), transparent 70%)" }} />

        <div className="relative flex items-center gap-3 text-white">
          <span className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-xl" style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)" }}>R</span>
          <div>
            <div className="font-semibold text-lg leading-tight">Rulethu Holdings</div>
            <div className="text-sm" style={{ color: "#c9a227" }}>Integrated ERP &amp; Investment Platform</div>
          </div>
        </div>

        <div className="relative text-white max-w-md">
          <div className="h-1 w-12 rounded-full mb-5" style={{ background: "#c9a227" }} />
          <h1 className="text-[36px] font-semibold leading-[1.12] mb-4">One platform.<br />One <span style={{ color: "#f0d680" }}>source of truth</span>.</h1>
          <p className="text-sm opacity-85 mb-7">Investments, treasury, finance, procurement, research, HR and more — with built-in AI. Sign in to your department; you’ll see what’s yours, and what’s shared.</p>
          <div className="space-y-2.5">
            {["Role-based access — your department, your work", "Built-in AI: ask, draft, and build models", "Live valuations, treasury and financials"].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(201,162,39,0.25)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0d680" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                <span className="opacity-90">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs opacity-60 text-white">Confidential · For Rulethu Holdings staff · Harare</div>
      </div>

      {/* Sign-in form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <span className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-white" style={{ background: "var(--brand)" }}>R</span>
            <span className="font-semibold" style={{ color: "var(--text)" }}>Rulethu Holdings</span>
          </div>

          <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>{mode === "register" ? "Set up your account" : "Sign in"}</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{mode === "register" ? "First time here? Enter your name and choose a password." : "Use your Rulethu email to continue."}</p>

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Work email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="you@rulethu.com" autoFocus className="w-full rounded-md border px-3 py-2.5 text-sm mb-3" style={inputStyle} />

          {mode === "register" && (
            <>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="e.g. Tendai Moyo" className="w-full rounded-md border px-3 py-2.5 text-sm mb-3" style={inputStyle} />
            </>
          )}

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{mode === "register" ? "Choose a password" : "Password"}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="••••••••" className="w-full rounded-md border px-3 py-2.5 text-sm mb-3" style={inputStyle} />

          {mode === "register" && (
            <>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="••••••••" className="w-full rounded-md border px-3 py-2.5 text-sm mb-3" style={inputStyle} />
            </>
          )}

          {error && <div className="mb-3 text-xs" style={{ color: "var(--neg)" }}>{error}</div>}

          <button onClick={submit} className="w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>{mode === "register" ? "Create account & sign in" : "Sign in"}</button>

          <button onClick={() => { setMode(mode === "register" ? "signin" : "register"); setError(""); }} className="mt-3 w-full text-center text-xs font-medium" style={{ color: "var(--brand)" }}>
            {mode === "register" ? "← Back to sign in" : "First time here? Set up your account →"}
          </button>

          <div className="mt-4 rounded-md px-3 py-2 text-[11px]" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>
            Demo mode — new accounts start with the password <b style={{ color: "var(--text-muted)" }}>{DEMO_PASSWORD}</b>; set your own at first sign-in. Real per-user passwords & reset-by-email arrive with the secure backend.
          </div>

          <button onClick={() => setShowPicker((s) => !s)} className="mt-4 w-full text-center text-xs font-medium" style={{ color: "var(--brand)" }}>
            {showPicker ? "Hide" : "Quick sign-in as a staff member →"}
          </button>

          {showPicker && (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border divide-y" style={{ borderColor: "var(--border)" }}>
              {accounts.map((a) => (
                <button key={a.id} onClick={() => loginAs(a.id)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--surface-2)]">
                  <Avatar name={a.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{a.name} <span className="text-[10px] font-normal uppercase rounded px-1 py-0.5 ml-1" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>{a.accessRole}</span></div>
                    <div className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>{a.role} · {accessSummary(a)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
