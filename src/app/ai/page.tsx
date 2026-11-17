"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/store";
import { AGENTS, AI_DEMO_NOTE } from "@/lib/ai";
import { openAskAI } from "@/components/AskAI";
import AIChecks from "@/components/AIChecks";
import ModuleTabs from "@/components/ModuleTabs";
import { PageHeader, Card, Badge, SectionTitle, StatCard } from "@/components/ui";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AiHub() {
  const { drafts, templates } = useAppData();
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Rulethu AI"
        subtitle="Built-in AI agents for the whole group — ask anything and jump to the right place, and draft documents from your own department templates using live platform data."
        actions={<Badge tone="live">{AGENTS.filter((a) => a.status === "live").length} agents live</Badge>}
      />
      <ModuleTabs moduleKey="ai" />

      {/* Hero ask box */}
      <Card className="mb-6 overflow-hidden !p-0">
        <div className="p-6 md:p-7" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand) 12%, var(--surface)), var(--surface))" }}>
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand)" }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Ask Rulethu AI</h2>
          </div>
          <p className="text-sm mb-4 max-w-2xl" style={{ color: "var(--text-muted)" }}>
            Type a question — “where do I log a travel claim?”, “how many deals are in the pipeline?”, “which treasury bill matures next?” — and get an answer that takes you straight to the right tab, or start a document.
          </p>
          <button
            onClick={() => openAskAI()}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            Open Ask AI
            <kbd className="text-[10px] rounded px-1.5 py-0.5" style={{ background: "color-mix(in srgb, #fff 22%, transparent)" }}>⌘K</kbd>
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Agents" value={String(AGENTS.length)} hint="built-in" />
        <StatCard label="Templates" value={String(templates.length)} hint="across departments" />
        <StatCard label="Drafts created" value={String(drafts.length)} />
        <StatCard label="Mode" value="Demo" hint="no cost · key-ready" />
      </div>

      <div className="mb-8">
        <SectionTitle hint="AI scans every module">Checks &amp; suggestions</SectionTitle>
        <AIChecks />
      </div>

      <SectionTitle hint="pick one to start">Agents</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {AGENTS.map((a) => (
          <Card key={a.id} className="h-full flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, " + a.accent + " 14%, transparent)", color: a.accent }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg>
              </div>
              <Badge tone={a.status === "live" ? "live" : "beta"}>{a.status}</Badge>
            </div>
            <h3 className="mt-3 font-semibold" style={{ color: "var(--text)" }}>{a.name}</h3>
            <div className="text-xs font-medium mb-1" style={{ color: a.accent }}>{a.tagline}</div>
            <p className="text-sm flex-1" style={{ color: "var(--text-muted)" }}>{a.description}</p>
            <button
              onClick={() => (a.action.href ? router.push(a.action.href) : openAskAI(a.action.ask ?? ""))}
              className="mt-4 w-full rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              {a.action.label}
            </button>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <SectionTitle hint="from the Document Studio">Recent drafts</SectionTitle>
          {drafts.length === 0 ? (
            <Card className="border-dashed">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No drafts yet. <Link href="/ai/studio" className="font-medium" style={{ color: "var(--brand)" }}>Open the Document Studio</Link> to draft a memo, report or letter from a template.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {drafts.slice(0, 5).map((d) => (
                <Link key={d.id} href={`/ai/studio?draft=${d.id}`}>
                  <Card className="flex items-start justify-between gap-4 hover:shadow-md transition-shadow">
                    <div className="min-w-0">
                      <div className="font-medium truncate" style={{ color: "var(--text)" }}>{d.title}</div>
                      <p className="mt-0.5 text-xs truncate" style={{ color: "var(--text-muted)" }}>{d.brief}</p>
                      <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>{d.author} · {timeLabel(d.createdAt)}</div>
                    </div>
                    <Badge tone="info">{d.department}</Badge>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle hint="shared across the group">How it works</SectionTitle>
          <Card>
            <ol className="space-y-3 text-sm" style={{ color: "var(--text-muted)" }}>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--brand)" }}>1</span><span><strong style={{ color: "var(--text)" }}>Each department uploads its templates</strong> — memos, letters, credit papers, reports — in the Templates tab.</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--brand)" }}>2</span><span><strong style={{ color: "var(--text)" }}>Anyone drafts from them</strong> — pick a template, give a one-line brief, and the AI drafts the full document using live platform data.</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--brand)" }}>3</span><span><strong style={{ color: "var(--text)" }}>Ask AI navigates</strong> — ask where anything lives and it takes you straight there.</span></li>
            </ol>
            <p className="mt-4 text-[11px] rounded-md px-3 py-2" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>{AI_DEMO_NOTE}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
