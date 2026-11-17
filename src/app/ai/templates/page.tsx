"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAppData, CURRENT_USER, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Template, Department, DEPARTMENTS } from "@/lib/ai";
import ModuleTabs from "@/components/ModuleTabs";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";

export default function TemplatesPage() {
  const { templates, add } = useAppData();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [dept, setDept] = useState<Department>("Investments");
  const [desc, setDesc] = useState("");
  const [sections, setSections] = useState("");
  const [fileName, setFileName] = useState("");
  const [filter, setFilter] = useState<Department | "All">("All");

  const visible = templates.filter((t) => filter === "All" || t.department === filter);
  const byDept = DEPARTMENTS.map((d) => ({ d, items: templates.filter((t) => t.department === d) })).filter((g) => g.items.length);

  const addTemplate = () => {
    if (!name.trim()) return;
    const secs = sections.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const tpl: Template = {
      id: genId("tpl"),
      name: name.trim(),
      department: dept,
      description: desc.trim() || "Uploaded department template.",
      sections: secs.length ? secs : ["Summary", "Detail", "Recommendation"],
      uploaded: true,
      attachmentName: fileName || undefined,
      createdBy: user?.name ?? CURRENT_USER,
      createdAt: new Date().toISOString(),
    };
    add("templates", tpl, { title: "Template added", body: `${tpl.name} (${tpl.department})`, module: "ai" });
    setName(""); setDesc(""); setSections(""); setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Each department’s house templates. The Document Studio drafts from these, so uploads here instantly improve every draft."
        actions={<Link href="/ai/studio" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand)" }}>Open Document Studio</Link>}
      />
      <ModuleTabs moduleKey="ai" />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Template list */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(["All", ...DEPARTMENTS] as (Department | "All")[]).map((d) => (
              <button key={d} onClick={() => setFilter(d)} className="rounded-full px-2.5 py-1 text-xs font-medium border" style={{ background: filter === d ? "var(--brand)" : "transparent", color: filter === d ? "#fff" : "var(--text-muted)", borderColor: "var(--border)" }}>{d}</button>
            ))}
          </div>

          {filter === "All" ? (
            <div className="space-y-6">
              {byDept.map((g) => (
                <div key={g.d}>
                  <SectionTitle hint={`${g.items.length}`}>{g.d}</SectionTitle>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {g.items.map((t) => <TemplateCard key={t.id} t={t} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {visible.map((t) => <TemplateCard key={t.id} t={t} />)}
              {visible.length === 0 && <Card className="border-dashed"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No templates for {filter} yet — add one on the right.</p></Card>}
            </div>
          )}
        </div>

        {/* Upload / add template */}
        <Card>
          <SectionTitle>Add a template</SectionTitle>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Template name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Term Sheet" className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Department</label>
          <select value={dept} onChange={(e) => setDept(e.target.value as Department)} className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Description</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What it’s for" className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Sections <span style={{ color: "var(--text-faint)" }}>(one per line — optional)</span></label>
          <textarea value={sections} onChange={(e) => setSections(e.target.value)} rows={4} placeholder={"Executive Summary\nBackground\nRecommendation"} className="w-full rounded-md border px-2.5 py-2 text-sm mb-3" style={inputStyle} />

          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Attach the original (optional)</label>
          <input ref={fileRef} type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} className="w-full text-xs mb-1" style={{ color: "var(--text-muted)" }} />
          {fileName && <div className="text-[11px] mb-2" style={{ color: "var(--text-faint)" }}>📎 {fileName}</div>}

          <button onClick={addTemplate} disabled={!name.trim()} className="mt-2 w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Add template</button>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>In demo mode the AI uses the sections you list as the document’s structure. With a connected key it also reads the attached file to match your exact wording and style.</p>
        </Card>
      </div>
    </div>
  );
}

function TemplateCard({ t }: { t: Template }) {
  return (
    <Link href={`/ai/studio?templateId=${t.id}&dept=${encodeURIComponent(t.department)}`}>
      <Card className="h-full hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>{t.name}</h3>
          {t.uploaded ? <Badge tone="purple">yours</Badge> : <Badge tone="neutral">house</Badge>}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{t.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {t.sections.slice(0, 4).map((s) => (
            <span key={s} className="text-[10px] rounded px-1.5 py-0.5" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>{s}</span>
          ))}
          {t.sections.length > 4 && <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>+{t.sections.length - 4}</span>}
        </div>
      </Card>
    </Link>
  );
}
