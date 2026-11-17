import { CHART_OF_ACCOUNTS } from "@/lib/coa";
import { PageHeader, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";
import DownloadButtons from "@/components/DownloadButtons";

export default function ChartOfAccountsPage() {
  const rows = CHART_OF_ACCOUNTS.map((a) => ({ code: a.code, name: a.name, type: a.type }));
  const cols = [
    { key: "code", label: "Code" },
    { key: "name", label: "Account" },
    { key: "type", label: "Type" },
  ];

  return (
    <div>
      <PageHeader
        title="Finance · Chart of Accounts"
        subtitle="The account structure the ledger, trial balance and statements are built on."
        actions={<DownloadButtons filename="chart-of-accounts" title="Chart of Accounts" subtitle="Rulethu Holdings" columns={cols} rows={rows} sheetName="CoA" />}
      />
      <ModuleTabs moduleKey="finance" />

      <div className="overflow-x-auto rounded-xl border max-w-2xl" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--surface-2)" }}>
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-faint)" }}>Code</th>
              <th className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-faint)" }}>Account</th>
              <th className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-faint)" }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {CHART_OF_ACCOUNTS.map((a) => (
              <tr key={a.code}>
                <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}>{a.code}</td>
                <td className="px-4 py-2.5 font-medium" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>{a.name}</td>
                <td className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                  <Badge tone="neutral">{a.type}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
