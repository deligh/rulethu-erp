"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData, InternalRequest, RequestType } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { seesEverything } from "@/lib/access";
import { PageHeader, Card, Badge, StatCard, SectionTitle } from "@/components/ui";
import AIChecks from "@/components/AIChecks";
import { fmtMoney, fmtDate } from "@/lib/format";

// Queues a request can be sent to, and which departments handle each queue.
const QUEUES = ["Finance", "Procurement", "HR", "IT", "Investments", "Research", "Executive"] as const;
const QUEUE_DEPTS: Record<string, string[]> = {
  Finance: ["Finance"],
  Procurement: ["Operations", "Finance"],
  HR: ["Operations"],
  IT: ["IT"],
  Investments: ["Investments"],
  Research: ["Research"],
  Executive: ["Executive"],
};
const TYPES: RequestType[] = ["Procurement", "Payment", "Finance posting", "HR", "IT", "Other"];

const STATUS_TONE: Record<InternalRequest["status"], "neutral" | "info" | "pos" | "neg"> = {
  Open: "neutral", "In progress": "info", Fulfilled: "pos", Declined: "neg",
};

export default function RequestsPage() {
  const { requests, raiseRequest, fulfilRequest, setRequestStatus } = useAppData();
  const { user } = useAuth();

  const [toDept, setToDept] = useState<string>("Procurement");
  const [type, setType] = useState<RequestType>("Procurement");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const myDept = user?.department ?? "";
  const all = seesEverything(user!);

  const handles = (r: InternalRequest) => all || (QUEUE_DEPTS[r.toDept]?.includes(myDept) ?? false);
  const mine = (r: InternalRequest) => r.fromUser === user?.name || r.fromDept === myDept;

  const inbox = useMemo(() => requests.filter((r) => handles(r) && !mine(r)), [requests, user]);
  const outbox = useMemo(() => requests.filter((r) => mine(r)), [requests, user]);

  const openInbox = inbox.filter((r) => r.status === "Open" || r.status === "In progress");

  const submit = () => {
    if (!title.trim() || !user) return;
    raiseRequest({
      fromDept: myDept, fromUser: user.name, toDept, type,
      title: title.trim(), detail: detail.trim(),
      amount: Number(amount) || 0, currency: "USD",
    });
    setTitle(""); setDetail(""); setAmount("");
  };

  const doFulfil = (r: InternalRequest) => {
    fulfilRequest(r.id, user?.name ?? "—", noteFor === r.id ? note.trim() : undefined);
    setNoteFor(null); setNote("");
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  const RequestRow = ({ r, actions }: { r: InternalRequest; actions?: boolean }) => (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium" style={{ color: "var(--text)" }}>{r.title}</span>
            <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
            <Badge tone="neutral">{r.type}</Badge>
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{r.detail}</div>
          <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
            {r.fromDept} ({r.fromUser}) → {r.toDept} · {fmtDate(r.createdAt.slice(0, 10))}
            {r.amount > 0 && <> · <span style={{ color: "var(--text-muted)" }}>{fmtMoney(r.amount)}</span></>}
            {r.resolvedBy && <> · resolved by {r.resolvedBy}</>}
          </div>
          {r.note && <div className="mt-1 text-[11px] italic" style={{ color: "var(--text-faint)" }}>“{r.note}”</div>}
        </div>
        {actions && (r.status === "Open" || r.status === "In progress") && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {r.status === "Open" && (
              <button onClick={() => setRequestStatus(r.id, "In progress", user?.name)} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Accept</button>
            )}
            <button onClick={() => doFulfil(r)} className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--brand)" }}>
              {r.amount > 0 ? "Fulfil + post" : "Fulfil"}
            </button>
            <button onClick={() => setRequestStatus(r.id, "Declined", user?.name)} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--neg)" }}>Decline</button>
          </div>
        )}
      </div>
      {actions && noteFor === r.id && (
        <div className="mt-2 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 rounded-md border px-2 py-1 text-xs" style={inputStyle} />
        </div>
      )}
      {actions && (r.status === "Open" || r.status === "In progress") && noteFor !== r.id && (
        <button onClick={() => { setNoteFor(r.id); setNote(""); }} className="mt-1 text-[11px]" style={{ color: "var(--brand)" }}>+ add a note</button>
      )}
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Internal Requests"
        subtitle="Ask another department to do something — and track it to done. Requests with a value post straight to the Finance ledger when fulfilled."
        actions={<Badge tone="info">{openInbox.length} in your queue</Badge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="In your queue" value={String(openInbox.length)} hint="to action" />
        <StatCard label="Raised by you" value={String(outbox.length)} />
        <StatCard label="Fulfilled" value={String(requests.filter((r) => r.status === "Fulfilled").length)} hint="posted to Finance" />
        <StatCard label="All requests" value={String(requests.length)} />
      </div>

      <AIChecks moduleKey="requests" />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6">
          {/* Inbox */}
          <div>
            <SectionTitle hint={all ? "all departments (admin view)" : `for ${myDept}`}>
              {all ? "All incoming requests" : "Your queue"}
            </SectionTitle>
            <div className="space-y-3">
              {inbox.length === 0 && <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing waiting on your department.</span></Card>}
              {inbox.map((r) => <RequestRow key={r.id} r={r} actions />)}
            </div>
          </div>

          {/* Outbox */}
          <div>
            <SectionTitle hint="status updates as they’re actioned">Raised by you / your department</SectionTitle>
            <div className="space-y-3">
              {outbox.length === 0 && <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>You haven’t raised any requests yet.</span></Card>}
              {outbox.map((r) => <RequestRow key={r.id} r={r} />)}
            </div>
          </div>
        </div>

        {/* Raise a request */}
        <Card>
          <SectionTitle>Raise a request</SectionTitle>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Send to</label>
          <select value={toDept} onChange={(e) => setToDept(e.target.value)} className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle}>
            {QUEUES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as RequestType)} className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>What do you need?</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Procure 4 analyst laptops" className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Detail</label>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="Specs, context, deadline…" className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Value (USD) <span style={{ color: "var(--text-faint)" }}>— 0 if none</span></label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />

          <button onClick={submit} disabled={!title.trim()} className="w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Send request</button>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
            When the receiving department fulfils a request with a value, it posts <b>Dr expense / Cr payables</b> to the <Link href="/finance/general-ledger" style={{ color: "var(--brand)" }}>Finance ledger</Link> automatically.
          </p>
        </Card>
      </div>
    </div>
  );
}
