"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppData, genId } from "@/lib/store";
import { Employee, EmpDoc, employeeCompleteness } from "@/lib/seed";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import Avatar from "@/components/Avatar";

const MAX = 1_500_000;
const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function EField({ label, value, onChange, type = "text", full, numeric }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; full?: boolean; numeric?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${numeric ? "text-right tabular" : ""}`} style={inputStyle} />
    </label>
  );
}

export default function EmployeeProfile() {
  const params = useParams();
  const id = String(params.id);
  const { employees, patch } = useAppData();
  const emp = employees.find((e) => e.id === id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("Passport");
  const [err, setErr] = useState("");

  if (!emp) return <div><PageHeader title="Employee not found" subtitle="This record does not exist." actions={<Link href="/hr" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Back to HR</Link>} /></div>;

  const up = (p: Partial<Employee>) => patch("employees", emp.id, p);
  const docs = emp.documents ?? [];

  const onFile = (file?: File) => {
    setErr("");
    if (!file) return;
    if (file.size > MAX) { setErr(`"${file.name}" is ${fmtBytes(file.size)} — max ${fmtBytes(MAX)}.`); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const doc: EmpDoc = { id: genId("DOC"), name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl: String(reader.result), category, uploadedAt: new Date().toISOString() };
      up({ documents: [...docs, doc] });
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };
  const delDoc = (docId: string) => up({ documents: docs.filter((d) => d.id !== docId) });

  return (
    <div>
      <PageHeader
        title="HR · Employee Record"
        subtitle="Complete profile — personal details, contacts, next of kin, banking and documents."
        actions={<Link href="/hr" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>← Directory</Link>}
      />
      <ModuleTabs moduleKey="hr" />

      <Card className="flex items-center gap-4 mb-6">
        <Avatar name={emp.name} size={56} />
        <div className="flex-1">
          <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>{emp.name}</div>
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>{emp.role} · {emp.department}</div>
          <div className="text-xs" style={{ color: "var(--text-faint)" }}>{emp.id} · {emp.email}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={emp.status === "Active" ? "pos" : "warn"}>{emp.status}</Badge>
            <select value={emp.status} onChange={(e) => up({ status: e.target.value as Employee["status"] })} className="rounded-md border px-2 py-1 text-xs" style={inputStyle}><option>Active</option><option>On Leave</option></select>
          </div>
          {(() => { const pct = Math.round(employeeCompleteness(emp) * 100); return (
            <div className="flex items-center gap-2 w-40">
              <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Profile</span>
              <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--surface-2)" }}><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? "var(--pos)" : pct >= 50 ? "var(--warn)" : "var(--neg)" }} /></div>
              <span className="text-xs font-medium tabular" style={{ color: "var(--text)" }}>{pct}%</span>
            </div>
          ); })()}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <div><SectionTitle>Personal details</SectionTitle><Card className="grid sm:grid-cols-2 gap-3">
            <EField label="Full name" value={emp.name} onChange={(v) => up({ name: v })} full />
            <EField label="Date of birth" type="date" value={emp.dob ?? ""} onChange={(v) => up({ dob: v })} />
            <EField label="Gender" value={emp.gender ?? ""} onChange={(v) => up({ gender: v })} />
            <EField label="Marital status" value={emp.maritalStatus ?? ""} onChange={(v) => up({ maritalStatus: v })} />
            <EField label="National ID" value={emp.nationalId ?? ""} onChange={(v) => up({ nationalId: v })} />
            <EField label="Passport no." value={emp.passportNo ?? ""} onChange={(v) => up({ passportNo: v })} />
          </Card></div>

          <div><SectionTitle>Contact & address</SectionTitle><Card className="grid sm:grid-cols-2 gap-3">
            <EField label="Phone" value={emp.phone ?? ""} onChange={(v) => up({ phone: v })} />
            <EField label="Email" value={emp.email ?? ""} onChange={(v) => up({ email: v })} />
            <EField label="Address" value={emp.address ?? ""} onChange={(v) => up({ address: v })} full />
            <EField label="City / town" value={emp.city ?? ""} onChange={(v) => up({ city: v })} />
            <EField label="Location" value={emp.location} onChange={(v) => up({ location: v })} />
          </Card></div>

          <div><SectionTitle>Next of kin</SectionTitle><Card className="grid sm:grid-cols-2 gap-3">
            <EField label="Full name" value={emp.nokName ?? ""} onChange={(v) => up({ nokName: v })} />
            <EField label="Relationship" value={emp.nokRelationship ?? ""} onChange={(v) => up({ nokRelationship: v })} />
            <EField label="Phone" value={emp.nokPhone ?? ""} onChange={(v) => up({ nokPhone: v })} />
          </Card></div>
        </div>

        <div className="space-y-6">
          <div><SectionTitle>Employment</SectionTitle><Card className="grid sm:grid-cols-2 gap-3">
            <EField label="Role / title" value={emp.role} onChange={(v) => up({ role: v })} />
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Department</span>
              <select value={emp.department} onChange={(e) => up({ department: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle}>{["Executive", "Investments", "Research", "Finance", "Operations", "IT"].map((d) => <option key={d}>{d}</option>)}</select>
            </label>
            <label className="block"><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Manager</span>
              <select value={emp.managerId ?? ""} onChange={(e) => up({ managerId: e.target.value || undefined })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle}><option value="">— none —</option>{employees.filter((m) => m.id !== emp.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </label>
            <EField label="Start date" type="date" value={emp.startDate ?? ""} onChange={(v) => up({ startDate: v })} />
            <EField label="Contract type" value={emp.contractType ?? ""} onChange={(v) => up({ contractType: v })} />
            <EField label="Gross salary (monthly)" numeric value={emp.salary ?? 0} onChange={(v) => up({ salary: parseFloat(v) || 0 })} />
          </Card></div>

          <div><SectionTitle>Banking</SectionTitle><Card className="grid sm:grid-cols-2 gap-3">
            <EField label="Bank" value={emp.bankName ?? ""} onChange={(v) => up({ bankName: v })} />
            <EField label="Account number" value={emp.bankAccount ?? ""} onChange={(v) => up({ bankAccount: v })} />
          </Card></div>

          <div>
            <SectionTitle hint={`${docs.length} files`}>Documents</SectionTitle>
            <Card>
              {err && <div className="mb-2 text-xs" style={{ color: "var(--neg)" }}>{err}</div>}
              <div className="flex items-center gap-2 mb-3">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm" style={inputStyle}>{["Passport", "National ID", "Contract", "CV", "Certificate", "Other"].map((c) => <option key={c}>{c}</option>)}</select>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                <button onClick={() => fileRef.current?.click()} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Upload {category}</button>
              </div>
              {docs.length === 0 ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No documents uploaded.</p> : (
                <div className="space-y-2">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
                      <Badge tone="neutral">{d.category}</Badge>
                      <div className="min-w-0 flex-1"><div className="text-sm truncate" style={{ color: "var(--text)" }}>{d.name}</div><div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{fmtBytes(d.size)}</div></div>
                      <a href={d.dataUrl} download={d.name} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Download</a>
                      <button onClick={() => delDoc(d.id)} className="text-xs" style={{ color: "var(--text-faint)" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>Files up to {fmtBytes(MAX)} are stored in the browser (like Comms). Larger files & shared storage come with the database.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
