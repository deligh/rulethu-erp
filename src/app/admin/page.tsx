"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/store";
import { AccessRole, accessSummary } from "@/lib/access";
import { PageHeader, Card, Badge, StatCard, SectionTitle } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { aiHealthcheck, aiConfigured } from "@/lib/aiClient";

const ROLES: AccessRole[] = ["admin", "exec", "approver", "member"];
const DEPTS = ["Investments", "Finance", "Research", "Operations", "IT", "Risk & Compliance", "Executive", "Procurement", "Marketing", "Other"];

export default function AdminConsole() {
  const { user, accounts, isAdmin, addUser, removeUser, isAdded, setPassword, resetPassword, setAccessRole, passwordFor, audit } = useAuth();
  const { resetAll } = useAppData();
  const [edit, setEdit] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [reveal, setReveal] = useState<string | null>(null);
  // add-user form
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nDept, setNDept] = useState(DEPTS[0]);
  const [nTitle, setNTitle] = useState("");
  const [nRole, setNRole] = useState<AccessRole>("member");
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // AI engine status
  const [aiStatus, setAiStatus] = useState<"idle" | "checking" | "live" | "demo" | "error">("idle");
  const checkAi = async () => {
    setAiStatus("checking");
    setAiStatus(await aiHealthcheck());
  };

  const submitUser = () => {
    const res = addUser({ name: nName, email: nEmail, department: nDept, role: nTitle, accessRole: nRole });
    if (res.ok) { setAddMsg({ ok: true, text: `${nName.trim()} can now sign in with ${nEmail.trim().toLowerCase()} (password: rulethu).` }); setNName(""); setNEmail(""); setNTitle(""); setNRole("member"); }
    else setAddMsg({ ok: false, text: res.error ?? "Could not add user." });
  };

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md text-center">
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Admins only</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>The Admin console is restricted to administrators.</p>
          <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Back to dashboard</Link>
        </Card>
      </div>
    );
  }

  const savePw = (id: string) => { if (pw.trim()) { setPassword(id, pw.trim()); setEdit(null); setPw(""); } };
  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div>
      <PageHeader
        title="Admin console"
        subtitle="Manage accounts, access levels and passwords across the group. Admins and executives see every module."
        actions={<Badge tone="purple">Administrator</Badge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Accounts" value={String(accounts.length)} />
        <StatCard label="Admins & execs" value={String(accounts.filter((a) => a.accessRole === "admin" || a.accessRole === "exec").length)} hint="full access" />
        <StatCard label="Departments" value={String(new Set(accounts.map((a) => a.department)).size)} />
        <StatCard label="Approvers" value={String(accounts.filter((a) => a.accessRole === "approver").length)} />
      </div>

      {/* AI engine status */}
      <SectionTitle hint="is real Claude AI connected?">AI engine</SectionTitle>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {(() => {
            const map = {
              idle: { tone: "neutral" as const, label: "Not checked", dot: "var(--text-faint)" },
              checking: { tone: "neutral" as const, label: "Checking…", dot: "var(--warn)" },
              live: { tone: "pos" as const, label: "LIVE — real Claude AI", dot: "var(--pos)" },
              demo: { tone: "warn" as const, label: "Demo mode — no API key set", dot: "var(--warn)" },
              error: { tone: "neg" as const, label: "Error reaching AI proxy", dot: "var(--neg)" },
            }[aiStatus];
            return (
              <>
                <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text)" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: map.dot }} />
                  {map.label}
                </span>
                <Badge tone={map.tone}>{aiStatus === "live" ? "Connected" : aiStatus === "demo" ? "Demo" : "Status"}</Badge>
              </>
            );
          })()}
          <button onClick={checkAi} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Test AI connection</button>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
          {aiConfigured
            ? "The platform calls Claude through a secure proxy on Supabase — your API key is never in the app. Once the key secret is set on Supabase, this shows LIVE and the Ask-AI, chatbot, quiz tutor and Document Studio answer for real (cheapest models used to keep cost low)."
            : "Cloud config missing — AI runs in on-device demo mode only."}
        </p>
      </Card>

      {/* Add a user */}
      <SectionTitle hint="give someone access to the ERP">Add a user</SectionTitle>
      <Card className="mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Fld label="Full name"><input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="e.g. Tendai Moyo" className="w-full rounded-md border px-2.5 py-2 text-sm" style={iStyle} /></Fld>
          <Fld label="Work email"><input value={nEmail} onChange={(e) => setNEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitUser(); }} placeholder="name@rulethu.com" className="w-full rounded-md border px-2.5 py-2 text-sm" style={iStyle} /></Fld>
          <Fld label="Department"><select value={nDept} onChange={(e) => setNDept(e.target.value)} className="w-full rounded-md border px-2.5 py-2 text-sm" style={iStyle}>{DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Fld>
          <Fld label="Role / title"><input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="e.g. Analyst" className="w-full rounded-md border px-2.5 py-2 text-sm" style={iStyle} /></Fld>
          <Fld label="Access level"><select value={nRole} onChange={(e) => setNRole(e.target.value as AccessRole)} className="w-full rounded-md border px-2.5 py-2 text-sm" style={iStyle}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={submitUser} className="rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Add user</button>
          {addMsg && <span className="text-xs" style={{ color: addMsg.ok ? "var(--pos)" : "var(--neg)" }}>{addMsg.text}</span>}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
          The new account starts with the shared password <b>rulethu</b>; the person sets their own at first sign-in (or you can set one below). <b>Member</b> = shared workspace + their department; <b>exec/admin</b> = full access.
        </p>
      </Card>

      <SectionTitle hint="change access or reset a password">User management</SectionTitle>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--surface-2)" }}>
            <tr>
              {["User", "Department", "Access level", "Password", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const custom = passwordFor(a.id) !== "rulethu";
              return (
                <tr key={a.id}>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.name} size={30} />
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5" style={{ color: "var(--text)" }}>{a.name}{isAdded(a.id) && <Badge tone="info">added</Badge>}</div>
                        <div className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    {a.department}
                    <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{a.role}</div>
                  </td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <select value={a.accessRole} onChange={(e) => setAccessRole(a.id, e.target.value as AccessRole)} className="rounded-md border px-2 py-1 text-xs" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    {edit === a.id ? (
                      <div className="flex items-center gap-1.5">
                        <input autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") savePw(a.id); if (e.key === "Escape") { setEdit(null); setPw(""); } }} placeholder="new password" className="w-28 rounded-md border px-2 py-1 text-xs" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
                        <button onClick={() => savePw(a.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ background: "var(--brand)" }}>Set</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular" style={{ color: custom ? "var(--text)" : "var(--text-faint)" }}>
                          {reveal === a.id ? passwordFor(a.id) : "••••••"}
                        </span>
                        <button onClick={() => setReveal(reveal === a.id ? null : a.id)} className="text-[11px]" style={{ color: "var(--brand)" }}>{reveal === a.id ? "hide" : "show"}</button>
                        {custom && <Badge tone="warn">custom</Badge>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap" style={{ borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => { setEdit(a.id); setPw(""); }} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Set password</button>
                    {custom && <button onClick={() => resetPassword(a.id)} className="ml-1.5 rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--neg)" }}>Reset</button>}
                    {isAdded(a.id) && <button onClick={() => { if (confirm(`Remove ${a.name}'s access?`)) removeUser(a.id); }} className="ml-1.5 rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--neg)" }}>Remove</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
        Resetting returns an account to the shared demo password. In the real build, “reset” emails the user a secure one-time link and passwords are never visible to anyone.
      </p>

      {/* Security log — password changes (self-service + admin) */}
      <SectionTitle hint={`${audit.length} event${audit.length === 1 ? "" : "s"}`}>Security log</SectionTitle>
      <Card className="mb-6">
        {audit.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No password changes yet. When someone sets or resets a password, it appears here.</p>
        ) : (
          <ul className="space-y-2">
            {audit.slice(0, 30).map((a) => {
              const label = a.action === "self-change" ? "set their own password" : a.action === "admin-reset" ? "was reset to the default (by admin)" : a.action === "admin-set" ? "had a password set by admin" : "registered";
              const tone = a.action === "self-change" ? "var(--pos)" : a.action === "admin-reset" ? "var(--warn)" : "var(--text-muted)";
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span style={{ color: "var(--text)" }}><b>{a.userName}</b> <span style={{ color: tone }}>{label}</span></span>
                  <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>{new Date(a.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <SectionTitle hint="platform">Platform controls</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <div className="font-semibold mb-1" style={{ color: "var(--text)" }}>Your access</div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{accessSummary(user)}</p>
        </Card>
        <Card>
          <div className="font-semibold mb-1" style={{ color: "var(--text)" }}>Reset demo data</div>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>Return all records to their starting state (does not change logins).</p>
          <button onClick={() => { if (confirm("Reset all demo data to its starting state?")) resetAll(); }} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>↺ Reset demo data</button>
        </Card>
        <Card>
          <div className="font-semibold mb-1" style={{ color: "var(--text)" }}>Coming with the backend</div>
          <ul className="text-sm space-y-1" style={{ color: "var(--text-muted)" }}>
            <li>• Secure, enforced per-user passwords & SSO</li>
            <li>• Audit log of every admin action</li>
            <li>• Invite / deactivate staff</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
