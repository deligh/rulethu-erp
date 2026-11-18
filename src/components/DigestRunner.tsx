"use client";

// Scheduled daily digest (client-driven).
//
// A true server cron will live in Supabase (pg_cron) once the backend lands.
// Until then this posts the morning digest the first time anyone opens the
// platform after 07:00 each day. The post is gated by a shared `digestDate`
// flag synced in the cloud state, so it fires once per day for the whole group,
// not once per person. All figures are real (live tasks, pipeline, holdings,
// reports, market) — the AI only writes a one-line topline, with a safe fallback.

import { useEffect, useRef } from "react";
import { useAppData } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { askClaude } from "@/lib/aiClient";
import { compact } from "@/lib/format";

const DIGEST_HOUR = 7; // local time after which the day's digest may post

export default function DigestRunner() {
  const d = useAppData();
  const { user } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (!d.hydrated || !user || ran.current) return;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    if (d.digestDate === today) return;        // already done today
    if (now.getHours() < DIGEST_HOUR) return;  // too early
    ran.current = true;

    // Optimistic lock so two open tabs don't both post.
    d.setDigestDate(today);

    (async () => {
      const empName = new Map(d.employees.map((e) => [e.id, e.name] as const));

      // Tasks due today / overdue (not done)
      const open = d.tasks.filter((t) => t.status !== "Done");
      const overdue = open.filter((t) => t.end < today);
      const dueToday = open.filter((t) => t.end === today);

      // Pipeline at decision stages
      const hot = d.deals.filter((x) => x.stage === "IC" || x.stage === "Due Diligence");

      // Portfolio flags
      const watch = (d.holdings ?? []).filter((h) => h.status === "Watch" || h.status === "Underperforming");

      // Latest published report
      const published = [...d.reports].filter((r) => r.status === "Published").sort((a, b) => b.date.localeCompare(a.date))[0];

      // Market topline
      const mk = d.market;
      const priceLine = mk?.prices?.length
        ? mk.prices.slice(0, 3).map((p) => `${p.name} ${p.value} (${p.change})`).join(", ")
        : null;

      const lines: string[] = [];
      lines.push(`Good morning team. Daily digest for ${now.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" })}.`);
      lines.push("");
      lines.push(`Tasks: ${open.length} open${overdue.length ? `, ${overdue.length} overdue` : ""}${dueToday.length ? `, ${dueToday.length} due today` : ""}.`);
      if (dueToday.length) {
        dueToday.slice(0, 5).forEach((t) => lines.push(`  - ${t.title} (${empName.get(t.assigneeId) ?? "unassigned"})`));
      }
      if (hot.length) {
        lines.push(`Pipeline at decision: ${hot.length} deal(s).`);
        hot.slice(0, 4).forEach((x) => lines.push(`  - ${x.name} — ${x.stage}, ${compact(x.ticket, "USD")} (${x.owner})`));
      }
      if (watch.length) {
        lines.push(`Portfolio watch: ${watch.map((h) => h.company).join(", ")}.`);
      }
      if (priceLine) lines.push(`Markets: ${priceLine}.`);
      if (published) lines.push(`Latest research: ${published.title}.`);

      // One-line AI topline (cheap, optional).
      const topline = await askClaude({
        system: "You write a single upbeat one-line opener (max 22 words) for a Southern African investment group's internal morning digest. Plain text only, no markdown, no asterisks, no emojis. Be specific to the data given.",
        prompt: `Data:\n${lines.join("\n")}\n\nWrite ONLY the one-line opener.`,
        model: "haiku",
        maxTokens: 80,
      });
      const clean = (topline ?? "").replace(/[*_#`]/g, "").trim().split("\n")[0];
      const body = (clean ? `${clean}\n\n` : "") + lines.join("\n");

      const ch = d.channels.find((c) => c.id === "announcements") ?? d.channels.find((c) => c.id === "general") ?? d.channels[0];
      if (ch) {
        d.addMessage(ch.id, "message", body, undefined, "Rulethu AI");
        d.notify("Daily digest posted", "Your morning brief is in Comms.", "comms");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.hydrated, user]);

  return null;
}
