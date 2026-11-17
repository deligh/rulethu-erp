# Procurement Module — Developer Handoff

Welcome. You're building on the **Rulethu Holdings ERP** (Next.js 16 + TypeScript +
Tailwind v4). This guide tells you everything you need so your Procurement work
looks and behaves **exactly like the rest of the system** — same colours, same
components, same patterns. Please read the two rules in **§1** before writing code.

---

## 0. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000/procurement. Your module lives at
`src/app/procurement/`.

---

## 1. The two golden rules (this is how consistency is kept)

**Rule 1 — Never hardcode a colour. Ever.** Every colour in this app comes from a
CSS variable defined in `src/app/globals.css`. Use `var(--token)` inline or via the
shared components. This is what makes the whole ERP one consistent system and gives
us free dark-mode. ❌ `color: "#0c66e4"` → ✅ `color: "var(--brand)"`.

**Rule 2 — Build with the shared components, not raw HTML.** Don't write your own
cards, tables, buttons or badges. Import them from `@/components/ui` and friends
(see §3). If you need something new, copy the style of an existing one and use the
tokens.

If you follow these two rules, your module will match automatically.

---

## 2. The colour tokens (the palette)

Defined in `src/app/globals.css` for both light and dark mode. The ones you'll use:

| Token | Use it for |
| --- | --- |
| `--bg` | page background |
| `--surface` | cards, panels |
| `--surface-2` | sunken areas, inputs, table headers |
| `--surface-3` | hover neutral |
| `--border` | all borders/dividers |
| `--text` | primary text |
| `--text-muted` | secondary text |
| `--text-faint` | labels, hints, timestamps |
| `--brand` | primary actions / links (Atlassian blue) |
| `--brand-hover` | hover state of primary |
| `--pos` `--neg` `--warn` `--info` | success / error / warning / info text |

**Status lozenges** (the little uppercase pills) have their own token pairs —
`--lz-green-bg/-fg`, `--lz-blue-bg/-fg`, `--lz-neutral-*`, `--lz-red-*`,
`--lz-yellow-*`, `--lz-purple-*` — but you never touch these directly; you use the
`<Badge tone="...">` component (see §3).

Do **not** add new colours. If you think you need one, ping the maintainer.

---

## 3. Shared components you must use

All under `src/components/`. Import with the `@/` alias, e.g.
`import { Card } from "@/components/ui"`.

| Component | Import | What it is |
| --- | --- | --- |
| `PageHeader` | `@/components/ui` | Page title + subtitle + right-side actions |
| `Card` | `@/components/ui` | Standard white panel with border + shadow |
| `StatCard` | `@/components/ui` | KPI tile (label, value, delta, hint) |
| `Badge` | `@/components/ui` | Status **lozenge**; `tone` = `live/beta/planned/pos/neg/warn/info/neutral` |
| `SectionTitle` | `@/components/ui` | Uppercase section label with optional hint |
| `Table`, `Th`, `Td` | `@/components/ui` | The standard data table (hover rows built in) |
| `QuickAdd` | `@/components/QuickAdd` | The toggleable "+ Add record" form — **use this for all create forms** |
| `DownloadButtons` | `@/components/DownloadButtons` | XLSX + PDF export buttons for any table |
| `ModuleTabs` | `@/components/ModuleTabs` | The sub-navigation tabs for a module |
| `ModuleProgress` | `@/components/ModuleProgress` | The progress strip under the header |
| `Avatar` | `@/components/Avatar` | Coloured initials avatar |

Look at the **current `src/app/procurement/page.tsx`** — it already uses all of
these. Copy its shape.

---

## 4. Data & state — the store

There is **no database yet**. All data lives in a shared client store
(`src/lib/store.tsx`, React Context + localStorage). You read and write it with the
`useAppData()` hook. Your page must start with `"use client";`.

```tsx
"use client";
import { useAppData, genId } from "@/lib/store";

export default function ProcurementPage() {
  const { pos, vendors, add, patch, addEntry } = useAppData();
  // pos      -> PurchaseOrder[]  (your purchase orders)
  // vendors  -> Vendor[]
  // add(key, item, note?)          -> create a record
  // patch(key, id, partial, note?) -> update a record
  // addEntry(memo, source, lines)  -> post a journal to Finance (see §6)
  ...
}
```

**Create a record** (raises a notification automatically if you pass `note`):

```tsx
add("pos", {
  id: genId("PO"),
  vendor: v.vendor,
  description: v.description,
  amount: Number(v.amount),
  currency: v.currency,
  status: "Requisition",
  requester: v.requester,
  date: new Date().toISOString().slice(0, 10),
}, { title: "New requisition raised", body: v.vendor, module: "procurement" });
```

**Update a record:**

```tsx
patch("pos", po.id, { status: "Approved" }, { title: "PO Approved", module: "procurement" });
```

Collections available to `add`/`patch`: `deals`, `loans`, `pos`, `vendors`,
`reports`, `alts`, `employees`, `tasks`. You'll mostly use `pos` and `vendors`.

---

## 5. Types

- `PurchaseOrder` and `Vendor`… `PurchaseOrder` is in `src/lib/seed.ts`; `Vendor`
  is in `src/lib/store.tsx`. If you add fields, update the type there **and tell the
  maintainer** (shared files — see §8).

```ts
interface PurchaseOrder {
  id: string; vendor: string; description: string; amount: number;
  currency: string;
  status: "Requisition" | "Pending Approval" | "Approved" | "Received" | "Paid";
  requester: string; date: string;
}
interface Vendor { id: string; name: string; category: string; terms: string; }
```

---

## 6. Posting to Finance (the important cross-module bit)

When a PO is **Paid**, it must post a journal into the Finance general ledger so the
Trial Balance and statements stay correct. The current page already does this — keep
it. Debit the expense account, credit the bank:

```tsx
addEntry(`Vendor payment — ${po.vendor} (${po.id})`, `Procurement ${po.id}`, [
  { accountCode: "5000", debit: po.amount, credit: 0 },   // Operating expenses
  { accountCode: "1000", debit: 0, credit: po.amount },   // Bank — Operating USD
]);
```

Account codes live in `src/lib/coa.ts` (`CHART_OF_ACCOUNTS`). Use existing codes; if
you need a new account, add it there and flag it to the maintainer.

---

## 7. Adding sub-modules (tabs)

Procurement's tabs (Purchase Orders / Requisitions / Vendors / Approvals) are defined
in `src/lib/submodules.ts` under `procurement`. Two kinds:

- **Data-driven tab** — add an object with `content` (stats/columns/rows) and it
  renders automatically via the catch-all route `src/app/procurement/[sub]/page.tsx`.
  No new page file needed.
- **Custom interactive tab** — set `custom: true` and create the page at
  `src/app/procurement/<slug>/page.tsx` (start it with `"use client"`, and include
  `<ModuleTabs moduleKey="procurement" />` near the top so the tabs show).

Every Procurement page should include, right under `<PageHeader>`:

```tsx
<ModuleTabs moduleKey="procurement" />
<ModuleProgress module="procurement" />
```

---

## 8. Files that are YOURS vs. SHARED

**Yours — edit freely:**
- `src/app/procurement/page.tsx`
- `src/app/procurement/[sub]/page.tsx` and any `src/app/procurement/<slug>/page.tsx`
- The `procurement:` block inside `src/lib/submodules.ts`

**Shared — change only if needed, and tell the maintainer so it can be merged:**
- `src/lib/store.tsx` (the `Vendor` type, seed vendors, any new collection/action)
- `src/lib/seed.ts` (the `PurchaseOrder` type / sample data)
- `src/lib/coa.ts` (new account codes)
- `src/lib/modules.ts` (the Procurement nav entry — usually leave as-is)
- Anything in `src/components/` (design system — **don't restyle these**)

Never restyle the shared components or change the tokens — that would knock the rest
of the ERP out of alignment.

---

## 9. Before you hand it back

1. `npm run build` must pass with **no type or lint errors**.
2. Colours: search your files for `#` — there should be **no hex colours**; only
   `var(--...)` tokens.
3. Keep the header pattern (`PageHeader` → `ModuleTabs` → `ModuleProgress`).
4. Hand back **the files you changed** (ideally as a git diff/branch, or just zip the
   `src/app/procurement/` folder plus a note listing any edits to `submodules.ts` /
   `store.tsx` / `seed.ts` / `coa.ts`). The maintainer will merge them in.

Questions on the design system → look at an existing module page
(`src/app/procurement/page.tsx` or `src/app/microfinance/page.tsx`) as the reference.
They're the template. Thanks!
