"use client";

import { useMemo, useState } from "react";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { askClaude } from "@/lib/aiClient";
import { PageHeader, Card, Badge, SectionTitle, Table, Th, Td, StatCard } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import { listPeriods, periodStatements, keyRatios, PeriodType } from "@/lib/finperiods";
import { financialsXlsx, financialsPdf } from "@/lib/finexport";
import { fmtMoney, fmtPct } from "@/lib/format";

const TYPES: { key: PeriodType; label: string }[] = [
  { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" }, { key: "annual", label: "Annual" },
];

export default function FinancialStatementsPage() {
  const { entries, finStatements, importJournals, add, remove, addMessage, channels } = useAppData();
  const { user } = useAuth();
  const [type, setType] = useState<PeriodType>("monthly");
  const [idx, setIdx] = useState(0);
  const [commentary, setCommentary] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hasSample = entries.some((e) => e.source?.startsWith("Auto"));
  const periods = useMemo(() => listPeriods(entries, type), [entries, type]);
  const def = periods[Math.min(idx, periods.length - 1)] ?? periods[0];
  const report = useMemo(() => (def ? periodStatements(entries, def) : null), [entries, def]);

  const loadSample = () => {
    import("@/lib/finseed").then(({ SAMPLE_JOURNALS }) => {
      importJournals(SAMPLE_JOURNALS);
      setNote("Sample daily postings loaded into the General Ledger.");
    });
  };

  const genCommentary = async () => {
    if (!report) return;
    setGenBusy(true);
    const r = report;
    const money = (n: number) => fmtMoney(n);
    const lines = (arr: { name: string; amount: number }[]) => arr.map((l) => `${l.name} ${money(l.amount)}`).join("; ");
    const ratios = keyRatios(r).map((k) => `${k.label} = ${k.value} (${k.basis})`).join("; ");
    const vs = r.prior ? `Prior period: revenue ${money(r.prior.revenue)}, expenses ${money(r.prior.expenses)}, net profit ${money(r.prior.netProfit)}.` : "No prior-period comparison available.";
    const text = await askClaude({
      system:
        "You are the Finance Manager at Rulethu Holdings, an African investment group in Harare, writing the Notes & Analysis that accompany a set of financial statements for the board. " +
        "Plain text only — no markdown, no asterisks, no symbols as headings. Write clear, well-structured prose a non-accountant can follow, with short labelled sections separated by blank lines. " +
        "Use these section labels on their own line: OVERVIEW, HOW THE RESULT IS BUILT, PROFITABILITY, CASH POSITION, BALANCE SHEET AND RATIOS, WHAT TO WATCH. " +
        "In HOW THE RESULT IS BUILT, explicitly explain the arithmetic in words (e.g. net profit of X equals revenue Y less total expenses Z; revenue Y is made up of these income lines). " +
        "In BALANCE SHEET AND RATIOS, explain what each key ratio means and how it is derived from the figures. Be specific with the actual numbers provided, accurate, and board-ready.",
      prompt: `Period: ${r.def.label} (${r.def.start} to ${r.def.end}). ${r.entryCount} postings.
INCOME lines: ${lines(r.incomeLines)}. Total revenue ${money(r.revenue)}.
EXPENSE lines: ${lines(r.expenseLines)}. Total expenses ${money(r.expenses)}.
Net profit: ${money(r.netProfit)} (margin ${r.revenue ? fmtPct(r.netProfit / r.revenue) : "n/a"}). ${vs}
BALANCE SHEET as at ${r.def.end}: assets [${lines(r.assetLines)}] total ${money(r.totalAssets)}; liabilities [${lines(r.liabilityLines)}] total ${money(r.totalLiabilities)}; equity [${lines(r.equityLines)}] plus retained earnings ${money(r.retainedEarnings)}, total equity ${money(r.totalEquity)}.
CASH: opened ${money(r.cashOpen)}, moved ${money(r.cashMovement)}, closed ${money(r.cashClose)}.
RATIOS: ${ratios}.
Write the Notes & Analysis now.`,
      model: "sonnet",   // low-frequency, board-grade document — worth the stronger model
      maxTokens: 1300,
    });
    setCommentary((text ?? "").replace(/[*_#`]/g, "").trim());
    setGenBusy(false);
  };

  const publish = () => {
    if (!report) return;
    add("finStatements", {
      id: genId("FS"),
      periodType: type, label: report.def.label, start: report.def.start, end: report.def.end,
      commentary, report, publishedBy: user?.name ?? "Finance", publishedAt: new Date().toISOString(),
    }, { title: "Financial statements published", body: report.def.label, module: "finance" });
    const ch = channels.find((c) => c.id === "general") ?? channels[0];
    if (ch) addMessage(ch.id, "message", `📊 Financial statements published — ${report.def.label}. Net profit ${fmtMoney(report.netProfit)} on revenue ${fmtMoney(report.revenue)}. See Finance · Financial Statements.`, undefined, user?.name);
    setNote(`Published ${report.def.label}. It is now locked and visible in the published list.`);
  };

  const deltaPct = (cur: number, prior?: number) => (prior ? (cur - prior) / Math.abs(prior) : 0);

  return (
    <div>
      <PageHeader
        title="Financial Statements"
        subtitle="Built straight from the General Ledger — daily postings roll up automatically into weekly, monthly and annual statements that always tie back to the books."
        actions={<Badge tone="live">Live from GL</Badge>}
      />
      <ModuleTabs moduleKey="finance" />

      {!hasSample && (
        <Card className="mb-4" style={{ borderColor: "var(--accent)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Your ledger only has opening balances. Load sample daily postings to see weekly/monthly/annual statements populate.</p>
            <button onClick={loadSample} className="rounded-md px-3 py-2 text-sm font-semibold text-white shrink-0" style={{ background: "var(--brand)" }}>Load sample daily postings</button>
          </div>
        </Card>
      )}

      {/* period controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => { setType(t.key); setIdx(0); }} className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: type === t.key ? "var(--brand)" : "transparent", color: type === t.key ? "#fff" : "var(--text-muted)" }}>{t.label}</button>
          ))}
        </div>
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="rounded-md border px-2.5 py-1.5 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
          {periods.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
        </select>
        {report && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => financialsXlsx(report, commentary)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ Excel (formulas)</button>
            <button onClick={() => financialsPdf(report, commentary, user?.name)} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>⬇ PDF</button>
            <button onClick={publish} className="rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>Publish</button>
          </div>
        )}
      </div>

      {note && <p className="mb-4 text-xs" style={{ color: "var(--pos)" }}>{note}</p>}

      {report && (
        <>
          {/* integrity */}
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <Badge tone={report.plBalanced ? "live" : "neg"}>{report.plBalanced ? "Debits = Credits" : "Out of balance"}</Badge>
            <Badge tone={report.bsBalanced ? "live" : "neg"}>{report.bsBalanced ? "Assets = Liabilities + Equity" : `Off by ${fmtMoney(report.bsDifference)}`}</Badge>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>{report.entryCount} posting(s) in period · {report.def.start} to {report.def.end}</span>
          </div>

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard label="Revenue" value={fmtMoney(report.revenue)} delta={report.prior ? { value: fmtPct(deltaPct(report.revenue, report.prior.revenue), 0), positive: report.revenue >= report.prior.revenue } : undefined} hint="this period" />
            <StatCard label="Net profit" value={fmtMoney(report.netProfit)} delta={report.prior ? { value: fmtPct(deltaPct(report.netProfit, report.prior.netProfit), 0), positive: report.netProfit >= report.prior.netProfit } : undefined} hint={report.revenue ? `${fmtPct(report.netProfit / report.revenue, 0)} margin` : ""} />
            <StatCard label="Cash at bank" value={fmtMoney(report.cashClose)} delta={{ value: fmtMoney(report.cashMovement), positive: report.cashMovement >= 0 }} hint="period movement" />
            <StatCard label="Total assets" value={fmtMoney(report.totalAssets)} hint={`equity ${fmtMoney(report.totalEquity)}`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6 items-start">
            {/* Income statement */}
            <Card>
              <SectionTitle hint={report.def.label}>Income Statement</SectionTitle>
              <Table head={<><Th>Line</Th><Th right>{report.def.label}</Th><Th right>{report.prior ? "Prior" : ""}</Th></>}>
                {report.incomeLines.map((l) => <tr key={l.code}><Td>{l.name}</Td><Td right>{fmtMoney(l.amount)}</Td><Td right>{""}</Td></tr>)}
                <tr><Td strong>Total revenue</Td><Td right strong>{fmtMoney(report.revenue)}</Td><Td right>{report.prior ? fmtMoney(report.prior.revenue) : ""}</Td></tr>
                {report.expenseLines.map((l) => <tr key={l.code}><Td>{l.name}</Td><Td right>({fmtMoney(l.amount)})</Td><Td right>{""}</Td></tr>)}
                <tr><Td strong>Total expenses</Td><Td right strong>({fmtMoney(report.expenses)})</Td><Td right>{report.prior ? `(${fmtMoney(report.prior.expenses)})` : ""}</Td></tr>
                <tr><Td strong>Net profit / (loss)</Td><Td right strong><span style={{ color: report.netProfit >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(report.netProfit)}</span></Td><Td right>{report.prior ? fmtMoney(report.prior.netProfit) : ""}</Td></tr>
              </Table>
            </Card>

            {/* Balance sheet */}
            <Card>
              <SectionTitle hint={`as at ${report.def.end}`}>Balance Sheet</SectionTitle>
              <Table head={<><Th>Line</Th><Th right>Amount</Th></>}>
                {report.assetLines.map((l) => <tr key={l.code}><Td>{l.name}</Td><Td right>{fmtMoney(l.amount)}</Td></tr>)}
                <tr><Td strong>Total assets</Td><Td right strong>{fmtMoney(report.totalAssets)}</Td></tr>
                {report.liabilityLines.map((l) => <tr key={l.code}><Td>{l.name}</Td><Td right>{fmtMoney(l.amount)}</Td></tr>)}
                <tr><Td strong>Total liabilities</Td><Td right strong>{fmtMoney(report.totalLiabilities)}</Td></tr>
                {report.equityLines.map((l) => <tr key={l.code}><Td>{l.name}</Td><Td right>{fmtMoney(l.amount)}</Td></tr>)}
                <tr><Td>Retained earnings — period</Td><Td right>{fmtMoney(report.retainedEarnings)}</Td></tr>
                <tr><Td strong>Total equity</Td><Td right strong>{fmtMoney(report.totalEquity)}</Td></tr>
              </Table>
            </Card>
          </div>

          {/* key ratios */}
          <Card className="mb-6">
            <SectionTitle hint="each figure shows the maths behind it">Key ratios</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-2">
              {keyRatios(report).map((k) => (
                <div key={k.label} className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
                  <div className="text-lg font-bold" style={{ color: "var(--brand)" }}>{k.value}</div>
                  <div className="text-xs font-medium" style={{ color: "var(--text)" }}>{k.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{k.basis}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* notes & analysis (editable before publish) */}
          <Card className="mb-6">
            <div className="flex items-center justify-between gap-2 mb-2">
              <SectionTitle hint="AI explains the figures · editable before you publish">Notes &amp; analysis</SectionTitle>
              <button onClick={genCommentary} disabled={genBusy} className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{genBusy ? "Writing…" : "✨ Explain with AI"}</button>
            </div>
            <textarea value={commentary} onChange={(e) => setCommentary(e.target.value)} rows={10} placeholder="Click ‘Explain with AI’ to generate board-ready notes that explain how each figure is built and what it means — then edit freely before publishing." className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }} />
          </Card>
        </>
      )}

      {/* published */}
      {finStatements.length > 0 && (
        <Card>
          <SectionTitle hint="finalised & locked">Published statements</SectionTitle>
          <Table head={<><Th>Period</Th><Th>Published</Th><Th>By</Th><Th right>Net profit</Th><Th right>Actions</Th></>}>
            {[...finStatements].reverse().map((s) => (
              <tr key={s.id}>
                <Td strong>{s.label}</Td>
                <Td>{new Date(s.publishedAt).toLocaleDateString("en-GB")}</Td>
                <Td>{s.publishedBy}</Td>
                <Td right>{fmtMoney(s.report.netProfit)}</Td>
                <Td right>
                  <button onClick={() => financialsXlsx(s.report, s.commentary)} className="text-xs font-medium mr-3" style={{ color: "var(--info)" }}>Excel</button>
                  <button onClick={() => financialsPdf(s.report, s.commentary, s.publishedBy)} className="text-xs font-medium mr-3" style={{ color: "var(--info)" }}>PDF</button>
                  {(user?.accessRole === "admin" || user?.accessRole === "exec") && <button onClick={() => remove("finStatements", s.id)} className="text-xs font-medium" style={{ color: "var(--neg)" }}>Delete</button>}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
