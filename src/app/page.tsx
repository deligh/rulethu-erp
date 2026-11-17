"use client";

import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { useAppData } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { canAccessModule, seesEverything } from "@/lib/access";
import { PageHeader, Card, StatCard, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import { fmtMoney, compact, fmtDate } from "@/lib/format";

export default function Dashboard() {
  const { deals, reports, alts, loans, tasks, employees, personalEvents, leave, goals } = useAppData();
  const { user } = useAuth();

  const exec = user ? seesEverything(user) : false;
  const modules = MODULES.filter((m) => m.key !== "dashboard" && (!user || canAccessModule(user, m.key)));
  const latestReports = [...reports].slice(0, 3);

  // ---------- Personal (scoped) dashboard for non-exec staff ----------
  if (user && !exec) {
    const me = user.name;
    const myEmp = employees.find((e) => e.name === me);
    const myTasks = tasks.filter((t) => myEmp && t.assigneeId === myEmp.id);
    const myOpen = myTasks.filter((t) => (t.status || "").toLowerCase() !== "done");
    const myTeam = myEmp ? employees.filter((e) => e.department === myEmp.department && e.id !== myEmp.id) : [];
    const todayIso = new Date().toISOString().slice(0, 10);
    const upcoming: { date: string; label: string; href: string }[] = [];
    for (const e of personalEvents) if (e.owner === me && e.date >= todayIso) upcoming.push({ date: e.date, label: e.title, href: "/calendar" });
    for (const l of leave) if (l.employee === me && l.status !== "Declined" && l.start >= todayIso) upcoming.push({ date: l.start, label: `Leave (${l.type})`, href: "/hr/leave" });
    for (const g of goals) if (g.owner === me && g.status !== "Done" && g.targetDate >= todayIso) upcoming.push({ date: g.targetDate, label: `Goal: ${g.title}`, href: "/hr/goals" });
    for (const t of myOpen) if (t.end && t.end >= todayIso) upcoming.push({ date: t.end, label: `Due: ${t.title}`, href: "/programme" });
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    const prTone = (p?: string) => (p === "High" ? "neg" : p === "Medium" ? "warn" : "neutral") as "neg" | "warn" | "neutral";

    return (
      <div>
        <PageHeader
          title={`Welcome, ${me.split(" ")[0]}`}
          subtitle={`Your work, your team and your day${myEmp ? ` · ${myEmp.department}` : ""}.`}
          actions={<Badge tone="purple">{user.accessRole === "approver" ? "Approver" : "My workspace"}</Badge>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="My open tasks" value={String(myOpen.length)} hint={myOpen.length ? "assigned to you" : "all clear"} />
          <StatCard label="Due soon" value={String(upcoming.length)} hint="your deadlines & events" />
          <StatCard label="My team" value={String(myTeam.length + (myEmp ? 1 : 0))} hint={myEmp?.department ?? "department"} />
          <StatCard label="Completed" value={String(myTasks.length - myOpen.length)} hint="tasks done" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          {/* My tasks */}
          <div>
            <SectionTitle hint="assigned to you">My tasks</SectionTitle>
            {myOpen.length === 0 ? (
              <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing assigned to you right now. 🎉</span></Card>
            ) : (
              <Table head={<><Th>Task</Th><Th>Priority</Th><Th right>Due</Th></>}>
                {myOpen.slice(0, 8).map((t) => (
                  <tr key={t.id}>
                    <Td>
                      <Link href="/programme" className="font-medium hover:underline">{t.title}</Link>
                      <div className="text-xs" style={{ color: "var(--text-faint)" }}>{t.status}</div>
                    </Td>
                    <Td><Badge tone={prTone(t.priority)}>{t.priority}</Badge></Td>
                    <Td right>{t.end ? fmtDate(t.end) : "—"}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>

          {/* My week */}
          <div>
            <SectionTitle hint="coming up for you">My week</SectionTitle>
            {upcoming.length === 0 ? (
              <Card className="border-dashed"><span className="text-sm" style={{ color: "var(--text-muted)" }}>No upcoming deadlines or events.</span></Card>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 7).map((u, i) => (
                  <Link key={i} href={u.href}>
                    <Card className="flex items-center justify-between gap-3 py-3 transition-shadow hover:shadow-md">
                      <span className="text-sm" style={{ color: "var(--text)" }}>{u.label}</span>
                      <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>{fmtDate(u.date)}</span>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My team */}
        {myTeam.length > 0 && (
          <div className="mb-10">
            <SectionTitle hint={myEmp?.department}>My team</SectionTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTeam.map((e) => (
                <Card key={e.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "var(--brand)" }}>{e.name.slice(0, 1)}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{e.name}{e.status === "On Leave" ? " · on leave" : ""}</div>
                    <div className="text-xs truncate" style={{ color: "var(--text-faint)" }}>{e.role}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <SectionTitle hint="what you can open">Your tools</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {modules.map((m) => (
            <Link key={m.key} href={m.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface-2)", color: "var(--brand)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
                  </div>
                  <Badge tone={m.status}>{m.status}</Badge>
                </div>
                <h3 className="mt-3 font-semibold" style={{ color: "var(--text)" }}>{m.name}</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{m.description}</p>
              </Card>
            </Link>
          ))}
        </div>

        <SectionTitle hint="published to the group">Latest research</SectionTitle>
        <div className="space-y-3">
          {latestReports.map((r) => (
            <Card key={r.id} className="flex items-start justify-between gap-4">
              <div>
                <Link href="/research" className="font-medium hover:underline" style={{ color: "var(--text)" }}>{r.title}</Link>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{r.summary}</p>
                <div className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>{r.author} · {fmtDate(r.date)}</div>
              </div>
              <Badge tone={r.status === "Published" ? "pos" : "warn"}>{r.status}</Badge>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Group dashboard for execs & admins ----------
  const pipelineValue = deals.reduce((s, d) => s + d.ticket, 0);
  const altNav = alts.reduce((s, a) => s + a.nav, 0);
  const loanBook = loans.reduce((s, l) => s + l.principal, 0);
  const atRisk = loans.filter((l) => l.status === "PAR>30").reduce((s, l) => s + l.principal, 0);
  const recentDeals = [...deals].slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Group Dashboard"
        subtitle="One trusted view across the investments function and supporting operations."
        actions={<Badge tone="live">All systems nominal</Badge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Live pipeline" value={compact(pipelineValue, "USD")} delta={{ value: `${deals.length} deals`, positive: true }} hint="proposed tickets" />
        <StatCard label="Alt. investments NAV" value={compact(altNav, "USD")} delta={{ value: "4.1%", positive: true }} hint="vs. committed" />
        <StatCard label="MFI loan book" value={compact(loanBook, "USD")} hint={`${loans.length} active loans`} />
        <StatCard label="Portfolio at risk" value={compact(atRisk, "USD")} delta={{ value: "PAR>30", positive: false }} hint="flagged" />
      </div>

      <SectionTitle hint="open any module">Modules</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {modules.map((m) => (
          <Link key={m.key} href={m.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface-2)", color: "var(--brand)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={m.icon} />
                  </svg>
                </div>
                <Badge tone={m.status}>{m.status}</Badge>
              </div>
              <h3 className="mt-3 font-semibold" style={{ color: "var(--text)" }}>{m.name}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{m.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <SectionTitle hint="live pipeline">Investment pipeline</SectionTitle>
          <Table head={<><Th>Deal</Th><Th>Stage</Th><Th right>Ticket</Th></>}>
            {recentDeals.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link href="/investments" className="font-medium hover:underline">{d.name}</Link>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{d.sector} · {d.country}</div>
                </Td>
                <Td><Badge tone="beta">{d.stage}</Badge></Td>
                <Td right strong>{fmtMoney(d.ticket)}</Td>
              </tr>
            ))}
          </Table>
        </div>

        <div>
          <SectionTitle hint="published to the group">Latest research</SectionTitle>
          <div className="space-y-3">
            {latestReports.map((r) => (
              <Card key={r.id} className="flex items-start justify-between gap-4">
                <div>
                  <Link href="/research" className="font-medium hover:underline" style={{ color: "var(--text)" }}>{r.title}</Link>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{r.summary}</p>
                  <div className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>{r.author} · {fmtDate(r.date)}</div>
                </div>
                <Badge tone={r.status === "Published" ? "pos" : "warn"}>{r.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
