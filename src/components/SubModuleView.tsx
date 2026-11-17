import { notFound } from "next/navigation";
import { ModuleKey, moduleByKey } from "@/lib/modules";
import { getSub } from "@/lib/submodules";
import ModuleTabs from "@/components/ModuleTabs";
import { PageHeader, StatCard, Badge, EmptyModuleNote } from "@/components/ui";

// Generic renderer for a data-driven sub-module (the catch-all route uses this).
export default function SubModuleView({ moduleKey, slug }: { moduleKey: ModuleKey; slug: string }) {
  const mod = moduleByKey(moduleKey);
  const sub = getSub(moduleKey, slug);
  if (!mod || !sub || sub.custom || !sub.content) notFound();

  const c = sub.content;

  return (
    <div>
      <PageHeader
        title={`${mod.name} · ${sub.name}`}
        subtitle={c.subtitle}
        actions={<Badge tone={sub.status}>{sub.status}</Badge>}
      />
      <ModuleTabs moduleKey={moduleKey} />

      {c.stats && c.stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {c.stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} />
          ))}
        </div>
      )}

      {c.columns && c.rows && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {c.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-medium text-xs uppercase tracking-wide ${col.right ? "text-right" : "text-left"}`}
                    style={{ color: "var(--text-faint)" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row, i) => (
                <tr key={i}>
                  {c.columns!.map((col, j) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.right ? "text-right tabular" : ""} ${j === 0 ? "font-medium" : ""}`}
                      style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}
                    >
                      {row[col.key] === "" ? "—" : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {c.note && (
        <div className="mt-4">
          <EmptyModuleNote>{c.note}</EmptyModuleNote>
        </div>
      )}
    </div>
  );
}
