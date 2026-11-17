"use client";

import { useMemo, useState } from "react";
import { useAppData, LeaveType, LeaveStatus, CURRENT_USER } from "@/lib/store";
import { PEOPLE } from "@/lib/tasks";
import { fmtDate } from "@/lib/format";
import { PageHeader, Card, StatCard, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

const TYPES: LeaveType[] = ["Annual", "Sick", "Study", "Compassionate", "Unpaid"];
const TONE: Record<LeaveStatus, "pos" | "warn" | "neg"> = { Approved: "pos", Pending: "warn", Declined: "neg" };

function daysBetween(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export default function LeavePage() {
  const { leave, addLeave, setLeaveStatus } = useAppData();
  const [employee, setEmployee] = useState(CURRENT_USER);
  const [type, setType] = useState<LeaveType>("Annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const days = useMemo(() => daysBetween(start, end), [start, end]);
  const canSubmit = employee && start && end && days > 0;

  const submit = () => {
    if (!canSubmit) return;
    addLeave({ employee, type, start, end, days, reason });
    setSubmitted(true);
    setStart("");
    setEnd("");
    setReason("");
    setTimeout(() => setSubmitted(false), 2500);
  };

  const pending = leave.filter((l) => l.status === "Pending").length;
  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  return (
    <div>
      <PageHeader
        title="HR · Leave"
        subtitle="Apply for leave — it appears here for HR to review, and everyone is notified."
        actions={<Badge tone="live">{pending} pending</Badge>}
      />
      <ModuleTabs moduleKey="hr" />

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Apply form */}
        <Card className="lg:sticky lg:top-20">
          <h3 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Apply for leave</h3>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Employee</span>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                {PEOPLE.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as LeaveType)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>From</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
              </label>
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>To</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Reason</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{days > 0 ? `${days} day(s)` : "—"}</span>
              <button onClick={submit} disabled={!canSubmit} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40" style={{ background: "var(--brand)" }}>
                Submit request
              </button>
            </div>
            {submitted && <Badge tone="pos">Submitted — sent to HR</Badge>}
          </div>
        </Card>

        {/* Requests list */}
        <div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="Total" value={String(leave.length)} />
            <StatCard label="Pending" value={String(pending)} />
            <StatCard label="Approved" value={String(leave.filter((l) => l.status === "Approved").length)} />
          </div>
          <div className="space-y-3">
            {leave.map((l) => (
              <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{l.employee}</span>
                    <Badge tone="neutral">{l.type}</Badge>
                    <Badge tone={TONE[l.status]}>{l.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    {fmtDate(l.start)} → {fmtDate(l.end)} · {l.days} day(s)
                  </div>
                  {l.reason && <div className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{l.reason}</div>}
                </div>
                {l.status === "Pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => setLeaveStatus(l.id, "Approved")} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Approve</button>
                    <button onClick={() => setLeaveStatus(l.id, "Declined")} className="rounded-lg border px-3 py-1.5 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Decline</button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
