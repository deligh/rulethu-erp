"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDesk, todayISO, addDays, fmtDate, isOverdue, type DeskEvent } from "@/lib/desk/store";
import { fetchPulse } from "@/lib/desk/ai";
import { textPdf, shareOrDownload } from "@/lib/desk/pdf";
import { Card, Btn, Pill, AiTag } from "@/components/desk/ui";
import BriefModal from "@/components/desk/BriefModal";
import QuickCapture from "@/components/desk/QuickCapture";

export default function TodayPage() {
  const d = useDesk();
  const t = todayISO();
  const [brief, setBrief] = useState<DeskEvent | null>(null);
  const [pulseBusy, setPulseBusy] = useState(false);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const todays = d.events.filter((e) => e.date === t).sort((a, b) => a.start.localeCompare(b.start));
  const overdue = d.commitments.filter((c) => isOverdue(c)).sort((a, b) => a.due.localeCompare(b.due));
  const week = d.commitments.filter((c) => c.status !== "Done" && c.due >= t && c.due <= addDays(t, 7)).sort((a, b) => a.due.localeCompare(b.due));
  const pledged = d.deals.reduce((s, x) => s + x.pledged, 0), landed = d.deals.reduce((s, x) => s + x.landed, 0);
  const stuck = d.deals.filter((x) => x.stage !== "Operational" && (Date.now() - new Date(x.stageSince).getTime()) / 864e5 > 90);

  const refresh = async () => { setPulseBusy(true); const p = await fetchPulse(); d.set("pulse", p); setPulseBusy(false); };
  useEffect(() => {
    if (!d.hydrated) return;
    const stale = !d.pulse || (Date.now() - new Date(d.pulse.at).getTime()) / 36e5 > 12 || !d.pulse.live;
    if (stale && !pulseBusy) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.hydrated]);

  const briefPdf = async () => {
    const body = [
      `TODAY'S SCHEDULE\n${todays.map((e) => `${e.start}–${e.end}  ${e.title}${e.location ? ` (${e.location})` : ""}`).join("\n") || "No engagements."}`,
      `OVERDUE COMMITMENTS\n${overdue.map((c) => `• ${c.title} — ${c.owner} (due ${fmtDate(c.due)})`).join("\n") || "None."}`,
      `DUE THIS WEEK\n${week.map((c) => `• ${c.title} — ${c.owner} (${fmtDate(c.due, { weekday: "short", day: "numeric", month: "short" })})`).join("\n") || "None."}`,
      d.pulse ? `ECONOMY PULSE\n${d.pulse.headline}\n${d.pulse.items.map((i) => `• ${i.label}: ${i.value}${i.change && i.change !== "n/a" ? ` (${i.change})` : ""}`).join("\n")}` : "",
      d.pulse?.news.length ? `IN THE NEWS\n${d.pulse.news.map((n) => `• ${n.title} — ${n.take}`).join("\n")}` : "",
      `INVESTMENT PIPELINE\nUSD ${pledged.toLocaleString()}m pledged, USD ${landed.toLocaleString()}m landed (${Math.round((landed / pledged) * 100)}%). ${stuck.length} project(s) stuck over 90 days.`,
    ].filter(Boolean).join("\n\n");
    shareOrDownload(await textPdf(`Daily brief — ${fmtDate(t, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`, "Prepared for the Minister of Economic Development", body), "Daily brief");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{fmtDate(t, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <h1 className="text-2xl md:text-3xl font-bold mt-0.5" style={{ color: "var(--text)" }}>{greet}, {d.ownerName}.</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {todays.length} engagement{todays.length === 1 ? "" : "s"} today · <span style={{ color: overdue.length ? "var(--neg)" : "inherit", fontWeight: overdue.length ? 700 : 400 }}>{overdue.length} overdue</span> · {week.length} due this week
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={briefPdf}>Share today&apos;s brief (PDF)</Btn>
          <Link href="/desk/speech"><Btn kind="ghost">🎤 Speech Builder</Btn></Link>
          <Link href="/desk/economy"><Btn kind="gold">Economy Builder →</Btn></Link>
        </div>
      </div>

      <Card><div className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Capture an instruction</div><QuickCapture /></Card>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Schedule */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold" style={{ color: "var(--text)" }}>Today</h2>
            <Link href="/desk/calendar" className="text-xs font-semibold" style={{ color: "var(--brand)" }}>Calendar →</Link>
          </div>
          {todays.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>A clear day.</p>}
          <ol className="space-y-2.5">
            {todays.map((e) => (
              <li key={e.id} className="flex gap-3 items-start rounded-lg p-3" style={{ background: "var(--surface-2, #f4f5f7)" }}>
                <div className="text-sm font-bold tabular-nums w-12 shrink-0" style={{ color: "var(--brand)" }}>{e.start}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{e.title}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{e.end && `until ${e.end}`}{e.location ? ` · ${e.location}` : ""}</div>
                  {e.kind === "Meeting" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setBrief(e)} className="text-xs font-semibold rounded-md px-2 py-1" style={{ background: "var(--brand)", color: "#fff" }}>Brief me</button>
                      <Link href={`/desk/meetings?event=${e.id}`} className="text-xs font-semibold rounded-md px-2 py-1 border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>● Record</Link>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* Attention */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold" style={{ color: "var(--text)" }}>Needs your attention</h2>
            <Link href="/desk/commitments" className="text-xs font-semibold" style={{ color: "var(--brand)" }}>All →</Link>
          </div>
          <ul className="space-y-2">
            {[...overdue, ...week].slice(0, 7).map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <Pill v={isOverdue(c) ? "Overdue" : c.status} />
                <div className="min-w-0">
                  <div style={{ color: "var(--text)" }}>{c.title}</div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{c.owner} · due {fmtDate(c.due, { weekday: "short", day: "numeric", month: "short" })}</div>
                </div>
              </li>
            ))}
            {overdue.length + week.length === 0 && <li className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing due this week.</li>}
          </ul>
          {stuck.length > 0 && (
            <div className="mt-4 rounded-lg p-3 text-xs" style={{ background: "var(--lz-yellow-bg)", color: "var(--lz-yellow-fg)" }}>
              <b>{stuck.length} investment project{stuck.length > 1 ? "s" : ""} stuck &gt; 90 days:</b> {stuck.map((x) => `${x.name}${x.blocker ? ` (${x.blocker})` : ""}`).join("; ")}
            </div>
          )}
        </Card>
      </div>

      {/* Economy pulse */}
      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>Economy pulse {d.pulse && <AiTag live={d.pulse.live} />}</h2>
          <div className="flex items-center gap-2">
            {d.pulse && <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>Updated {new Date(d.pulse.at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>}
            <Btn kind="ghost" onClick={refresh} disabled={pulseBusy}>{pulseBusy ? "Searching the web…" : "Refresh"}</Btn>
          </div>
        </div>
        {d.pulse ? (
          <>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>{d.pulse.headline}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {d.pulse.items.map((i) => (
                <div key={i.label} className="rounded-lg p-3" style={{ background: "var(--surface-2, #f4f5f7)" }} title={i.note}>
                  <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{i.label}</div>
                  <div className="text-base font-bold mt-0.5" style={{ color: "var(--text)" }}>{i.value}</div>
                  {i.change && i.change !== "n/a" && <div className="text-xs font-semibold" style={{ color: i.dir === "up" ? "var(--pos)" : i.dir === "down" ? "var(--neg)" : "var(--text-muted)" }}>{i.dir === "up" ? "▲" : i.dir === "down" ? "▼" : "•"} {i.change}</div>}
                </div>
              ))}
            </div>
            {d.pulse.news.length > 0 && (
              <ul className="mt-4 space-y-2">
                {d.pulse.news.map((n, k) => (
                  <li key={k} className="flex gap-2 text-sm items-start"><Pill v={n.tone} /><div><span className="font-semibold" style={{ color: "var(--text)" }}>{n.title}</span> <span style={{ color: "var(--text-muted)" }}>— {n.take}</span></div></li>
                ))}
              </ul>
            )}
          </>
        ) : <p className="text-sm" style={{ color: "var(--text-muted)" }}>Fetching today&apos;s figures…</p>}
      </Card>

      {/* Pipeline headline */}
      <Link href="/desk/pipeline">
        <Card className="mt-5 hover:shadow-md transition cursor-pointer">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs" style={{ color: "var(--text-faint)" }}>Investment pipeline</div>
              <div className="text-lg font-bold" style={{ color: "var(--text)" }}>USD {pledged.toLocaleString()}m pledged · USD {landed.toLocaleString()}m landed</div>
            </div>
            <div className="w-full md:w-72 h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-2, #eee)" }}>
              <div className="h-full rounded-full" style={{ width: `${(landed / pledged) * 100}%`, background: "var(--brand)" }} />
            </div>
          </div>
        </Card>
      </Link>

      <BriefModal ev={brief} onClose={() => setBrief(null)} />
    </div>
  );
}
