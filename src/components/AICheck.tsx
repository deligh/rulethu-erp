"use client";

import { ledgerCheck } from "@/lib/ai";
import { openAskAI } from "@/components/AskAI";

// A small AI health-check banner for the financials. Flags whether the trial
// balance balances and, if not, suggests the likely cause.
export default function AICheck({ totalDebit, totalCredit }: { totalDebit: number; totalCredit: number }) {
  const chk = ledgerCheck(totalDebit, totalCredit);
  const ok = chk.balanced;
  const bg = ok ? "var(--lz-green-bg)" : "var(--lz-yellow-bg)";
  const fg = ok ? "var(--lz-green-fg)" : "var(--lz-yellow-fg)";

  return (
    <div className="mb-5 rounded-lg border p-3.5 flex items-start gap-3" style={{ borderColor: "var(--border)", background: bg }}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, " + fg + " 18%, transparent)", color: fg }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: fg }}>
          AI check — {ok ? "the books balance ✓" : "the trial balance is out of balance"}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {ok
            ? "Total debits equal total credits across every General Ledger posting. Rulethu AI will flag any imbalance here the moment it appears."
            : chk.hint}
        </p>
      </div>
      <button onClick={() => openAskAI("Does the trial balance balance?")} className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold" style={{ background: "var(--surface)", color: fg, border: "1px solid var(--border)" }}>
        Ask AI
      </button>
    </div>
  );
}
