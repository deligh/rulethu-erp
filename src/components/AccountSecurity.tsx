"use client";

import { useState } from "react";
import { useAuth, DEMO_PASSWORD } from "@/lib/auth";

function PasswordFields({ onDone, cta = "Set new password" }: { onDone?: () => void; cta?: string }) {
  const { changeMyPassword } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  const submit = () => {
    if (pw.trim().length < 4) return setMsg({ ok: false, text: "Use at least 4 characters." });
    if (pw === DEMO_PASSWORD) return setMsg({ ok: false, text: "Choose a password different from the default." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The two passwords don't match." });
    changeMyPassword(pw.trim());
    setPw(""); setPw2("");
    setMsg({ ok: true, text: "✓ Password updated — only you know it now. Your admin is notified of the change." });
    onDone?.();
  };

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="rounded-md border px-3 py-2 text-sm" style={iStyle} />
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Confirm new password" className="rounded-md border px-3 py-2 text-sm" style={iStyle} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={submit} className="rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>{cta}</button>
        {msg && <span className="text-xs" style={{ color: msg.ok ? "var(--pos)" : "var(--neg)" }}>{msg.text}</span>}
      </div>
    </div>
  );
}

/** Change-password card for a person's own account (e.g. in My Workspace). */
export function ChangePasswordCard() {
  const { user, usingDefaultPassword } = useAuth();
  if (!user) return null;
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
      <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>Account &amp; password</h3>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-faint)" }}>
        {usingDefaultPassword
          ? "You're still using the default password. Set your own so only you can sign in — your admin is notified when you do."
          : "You have your own password. You can change it any time; your admin is notified of the change."}
      </p>
      <PasswordFields cta={usingDefaultPassword ? "Set my password" : "Change password"} />
      <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Forgot your password? An administrator can reset it for you from the Admin console.</p>
    </div>
  );
}

/** App-wide nudge shown to anyone still on the default password. */
export function DefaultPasswordBanner() {
  const { user, usingDefaultPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (!user || !usingDefaultPassword || dismissed) return null;

  return (
    <div className="mb-4 rounded-lg border p-3" style={{ background: "var(--lz-yellow-bg)", borderColor: "var(--lz-yellow-fg)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm" style={{ color: "var(--lz-yellow-fg)" }}>
          🔒 <b>Secure your account</b> — you&apos;re using the shared default password. Set your own so only you can sign in.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--brand)" }}>{open ? "Close" : "Set my password"}</button>
          <button onClick={() => setDismissed(true)} className="text-xs" style={{ color: "var(--lz-yellow-fg)" }}>Later</button>
        </div>
      </div>
      {open && (
        <div className="mt-3 rounded-md border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <PasswordFields cta="Set my password" onDone={() => { setTimeout(() => { setOpen(false); setDismissed(true); }, 1500); }} />
        </div>
      )}
    </div>
  );
}
