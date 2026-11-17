"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData, CURRENT_USER } from "@/lib/store";
import { PEOPLE } from "@/lib/tasks";
import { fmtMoney, fmtDate } from "@/lib/format";
import { PageHeader, Card, StatCard, Badge } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

// Three vehicle types the fuel reimbursement is pegged to (rate per km).
const CAR_TYPES = [
  { name: "Sedan (petrol)", ratePerKm: 0.35 },
  { name: "SUV (petrol)", ratePerKm: 0.42 },
  { name: "Double cab (diesel)", ratePerKm: 0.45 },
];

export default function TravelPage() {
  const { claims, addClaim } = useAppData();
  const [employee, setEmployee] = useState(CURRENT_USER);
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [km, setKm] = useState("");
  const [carIdx, setCarIdx] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pushed, setPushed] = useState(false);

  const car = CAR_TYPES[carIdx];
  const kmNum = parseFloat(km) || 0;
  const amount = useMemo(() => kmNum * car.ratePerKm, [kmNum, car]);
  const canSubmit = employee && destination && kmNum > 0;

  const submit = () => {
    if (!canSubmit) return;
    addClaim({ employee, destination, purpose, km: kmNum, carType: car.name, ratePerKm: car.ratePerKm, amount, date });
    setPushed(true);
    setDestination("");
    setPurpose("");
    setKm("");
    setTimeout(() => setPushed(false), 2800);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };
  const mine = claims;

  return (
    <div>
      <PageHeader
        title="HR · Travel Claims"
        subtitle="Enter your trip — the fuel reimbursement is calculated from the vehicle rate and pushed to Finance."
        actions={
          <Link href="/finance/expense-claims" className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            Finance inbox →
          </Link>
        }
      />
      <ModuleTabs moduleKey="hr" />

      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* Claim form */}
        <Card className="lg:sticky lg:top-20">
          <h3 className="font-semibold mb-4" style={{ color: "var(--text)" }}>New travel claim</h3>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Employee</span>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                {PEOPLE.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Where are you going?</span>
              <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Bulawayo site visit" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
            </label>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Purpose</span>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Reason for the trip" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Distance (km)</span>
                <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-right tabular" style={inputStyle} />
              </label>
              <label className="block">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
              </label>
            </div>

            <div>
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Vehicle (sets the rate)</span>
              <div className="mt-2 space-y-2">
                {CAR_TYPES.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setCarIdx(i)}
                    className="w-full flex items-center justify-between rounded-lg border px-3 py-2"
                    style={{
                      borderColor: carIdx === i ? "var(--brand)" : "var(--border)",
                      background: carIdx === i ? "color-mix(in srgb, var(--brand) 8%, transparent)" : "transparent",
                    }}
                  >
                    <span className="text-sm" style={{ color: "var(--text)" }}>{c.name}</span>
                    <span className="text-xs tabular" style={{ color: "var(--text-muted)" }}>${c.ratePerKm.toFixed(2)}/km</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between py-2.5 px-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Fuel reimbursement</span>
              <span className="text-lg font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(amount, "USD", 2)}</span>
            </div>

            <button onClick={submit} disabled={!canSubmit} className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: "var(--brand)" }}>
              Submit & push to Finance
            </button>
            {pushed && <Badge tone="pos">Pushed to Finance — everyone notified</Badge>}
          </div>
        </Card>

        {/* My claims */}
        <div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="Claims" value={String(mine.length)} />
            <StatCard label="Awaiting Finance" value={String(mine.filter((c) => c.status === "Pushed to Finance").length)} />
            <StatCard label="Paid" value={String(mine.filter((c) => c.status === "Paid").length)} />
          </div>
          <div className="space-y-3">
            {mine.map((c) => (
              <Card key={c.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{c.destination}</span>
                    <Badge tone={c.status === "Paid" ? "pos" : c.status === "Declined" ? "neg" : "warn"}>{c.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                    {c.employee} · {c.km} km · {c.carType} · {fmtDate(c.date)}
                  </div>
                </div>
                <span className="text-base font-semibold tabular" style={{ color: "var(--text)" }}>{fmtMoney(c.amount, "USD", 2)}</span>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
