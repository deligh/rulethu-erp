"use client";

import React, { useRef, useState } from "react";
import { useDesk } from "@/lib/desk/store";
import { Card, Btn, PageHead, Field, inputCls, inputStyle } from "@/components/desk/ui";

export default function SettingsPage() {
  const d = useDesk();
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const backup = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([d.exportJSON()], { type: "application/json" }));
    a.download = `ministers-desk-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  return (
    <div className="max-w-2xl">
      <PageHead kicker="Desk" title="Settings" />
      <div className="space-y-4">
        <Card>
          <Field label="How the Desk greets you"><input className={inputCls} style={inputStyle} value={d.ownerName} onChange={(e) => d.set("ownerName", e.target.value)} /></Field>
        </Card>
        <Card>
          <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>Your data</h3>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>Everything is stored on this device only. Back it up, or move it to another device.</p>
          <div className="flex gap-2 flex-wrap">
            <Btn onClick={backup}>Download backup</Btn>
            <Btn kind="ghost" onClick={() => file.current?.click()}>Restore from backup</Btn>
            <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setMsg(d.importJSON(await f.text()) ? "Restored." : "That file isn't a Desk backup."); }} />
          </div>
          {msg && <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{msg}</p>}
        </Card>
        <Card>
          <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>Security</h3>
          <div className="flex gap-2 flex-wrap mt-2">
            <Btn kind="ghost" onClick={() => { try { localStorage.removeItem("mdesk-lock-v1"); sessionStorage.removeItem("mdesk-unlocked"); } catch { /* ignore */ } location.reload(); }}>Change passcode</Btn>
            <Btn kind="danger" onClick={() => { if (confirm("Replace everything on this device with the sample demo data?")) d.resetDemo(); }}>Reset to demo data</Btn>
          </div>
        </Card>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>Demo build. For real use, the Desk moves to a Zimbabwe-hosted database with proper sign-in, so data syncs across the Minister&apos;s phone and laptop and stays in-country.</p>
      </div>
    </div>
  );
}
