# Rulethu Holdings — ERP

An internal platform for Rulethu Holdings' investments function and supporting
operations. One trusted place for deals, research, finance, the internal MFI,
procurement, alternatives, HR — and a programme view (assignments + Gantt) over
all of it.

Built with **Next.js 16 (App Router) + TypeScript + Tailwind v4**. Deployable to
Vercel today; designed so the **data layer can move to an Africa-region / self-hosted
database** later without touching the UI (see _Data sovereignty_ below).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Production build: `npm run build && npm start`.

## Deploy to Vercel

Push this folder to a Git repo and import it in Vercel — it builds with zero config.
(The app currently uses in-memory sample data, so a demo needs no database.)

## Modules

| Module | Route | Status | What's live now |
| --- | --- | --- | --- |
| Dashboard | `/` | live | Group KPIs, module grid, pipeline & research feeds |
| **Programme** | `/programme` | live | Assignments (anyone, incl. bosses), per-module progress, **Gantt chart** |
| **Investments** | `/investments` | live | Pipeline kanban + **Valuation Workbench** (NAV, multiples, DCF → range) |
| **Research** | `/research` | live | Report library + **Report Composer** (publish / download / print-to-PDF) |
| **Microfinance** | `/microfinance` | live | Loan book + **Amortization engine** (reducing / flat / interest-only, CSV) |
| Finance | `/finance` | beta | Statements & reconciliation view (parsing/matching to be wired) |
| Alternatives | `/alternatives` | beta | Holdings, capital calls, NAV, MOIC |
| Procurement | `/procurement` | beta | Requisitions → PO → approval → Finance |
| HR | `/hr` | beta | Directory; payroll → Finance journals (to be wired) |

The three **bold** tools do real calculations in the browser now — no backend needed.

## Project structure

```
src/
  app/                 # one folder per module route (App Router)
  components/          # Sidebar, Topbar, Gantt, ModuleProgress, ui primitives
  lib/
    modules.ts         # module registry — drives nav + dashboard
    valuation.ts       # NAV / multiples / DCF engine
    amortization.ts    # loan schedule engine (3 methods) + CSV export
    tasks.ts           # people, assignments, progress, Gantt data
    seed.ts            # sample data (replace with DB queries)
    format.ts          # money / % / date helpers
```

## Roadmap (next steps to make it production)

1. **Data layer** — add Prisma + Postgres; replace `lib/seed.ts` reads with queries.
   Keep the DB in an Africa region (or self-hosted) — see below.
2. **Auth & roles** — sign-in (Microsoft 365 SSO fits the existing tenant) with
   role-based access appropriate to a regulated asset manager.
3. **Priority workflow A — market intelligence** — ingest Bloomberg / RBZ / World Bank
   figures and news into the Research composer so daily reports build themselves.
4. **Priority workflow B — intake → decision** — upload a deal pack, extract financials,
   auto-populate the Valuation Workbench, draft the recommendation.
5. **Finance reconciliation** — statement parsing (PDF/CSV/MT940) + auto-match.
6. **Persistence for Programme** — tasks/assignments saved, editable, with notifications.

## Data sovereignty (important)

Rulethu's asset-management subsidiary is regulated by **SecZim**, and Zimbabwe's
**Cyber and Data Protection Act** applies — investor/client data may need to stay
in-country or in-region. Vercel hosts the **app/UI** globally, which is fine, but the
**database and document store** (where regulated data lives) should be
**Africa-region or self-hosted**. The code separates the two so this is a
configuration choice, not a rewrite. Confirm the data-location decision with Group IT
before loading real regulated data.

---
_Internal build v0.1 — Rulethu Holdings. Confidential._
