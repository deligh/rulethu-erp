import Link from "next/link";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import ModuleTabs from "@/components/ModuleTabs";

interface ModelCard { name: string; href: string; desc: string }
const SECTORS: { sector: string; icon: string; models: ModelCard[] }[] = [
  {
    sector: "Energy & Power", icon: "M12 3v2M5 12H3m18 0h-2M12 8a4 4 0 100 8 4 4 0 000-8z",
    models: [
      { name: "Solar PV (IPP)", href: "/investments/models/solar", desc: "Capacity, degradation, PPA tariff, DSCR, LCOE, equity IRR." },
      { name: "Thermal power", href: "/investments/models/plant?preset=power", desc: "Dispatchable generation — fuel cost, availability, debt cover, LCOE." },
      { name: "Mini-hydro", href: "/investments/models/plant?preset=hydro", desc: "Run-of-river hydro — high capacity factor, long-tenor debt, LCOE." },
    ],
  },
  {
    sector: "Mining", icon: "M14 12l-8 8-3-3 8-8M14 12l6-6-3-3-6 6M14 12l3 3",
    models: [
      { name: "Open-pit mine", href: "/investments/models/plant?preset=mining", desc: "Ore output, commodity price, cash cost/t, royalties, NPV/IRR." },
      { name: "Underground mine", href: "/investments/models/plant?preset=underground", desc: "Higher-grade, capex-heavy operation with longer ramp and cover." },
      { name: "Mineral processing", href: "/investments/models/plant?preset=processing", desc: "Beneficiation/smelting — throughput, conversion margin, utilisation." },
    ],
  },
  {
    sector: "Infrastructure", icon: "M3 21h18M4 21V10l6 3V10l6 3V6l4 2v13",
    models: [
      { name: "Toll road (concession)", href: "/investments/models/plant?preset=toll", desc: "Traffic × toll with escalation, O&M, long-tenor debt, concession life." },
      { name: "Housing development", href: "/investments/models/plant?preset=housing", desc: "Units built & sold, build cost, sales ramp, developer returns." },
      { name: "Water utility (concession)", href: "/investments/models/plant?preset=water", desc: "Volume × tariff, regulated escalation, long-life assets, DSCR." },
    ],
  },
  {
    sector: "Manufacturing", icon: "M3 21h18M4 21V10l6 3V10l6 3V6l4 2v13",
    models: [
      { name: "Aluminium cable", href: "/investments/models/plant?preset=aluminium", desc: "Conductor output, metal-linked pricing, unit economics." },
      { name: "Cement plant", href: "/investments/models/plant?preset=cement", desc: "Clinker/cement tonnes, energy-heavy cost base, capex depreciation." },
      { name: "Plastics manufacturing", href: "/investments/models/plant?preset=plastics", desc: "Resin throughput, conversion margin, working capital." },
      { name: "Clay bricks", href: "/investments/models/plant?preset=bricks", desc: "Brick output, clay/coal/power cost, kiln capex." },
    ],
  },
  {
    sector: "Agriculture", icon: "M12 2C8 6 8 12 12 22C16 12 16 6 12 2zM12 8v14",
    models: [
      { name: "Blueberry — outgrower", href: "/investments/models/agri", desc: "Full model: Ferungwe (grower) + BlueDot (exporter) + Combined, farmgate split, debt, sensitivity." },
      { name: "Row crop (maize)", href: "/investments/models/plant?preset=maize", desc: "Land & irrigation capex, yield × price, seasonal opex, returns." },
      { name: "Poultry / livestock", href: "/investments/models/plant?preset=poultry", desc: "Flock throughput, feed-driven cost, short-cycle returns." },
    ],
  },
  {
    sector: "Financial services", icon: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    models: [
      { name: "Lending / Microfinance", href: "/investments/models/lending", desc: "Loan-book growth, yield, cost of funds, provisions, ROE and DCF valuation." },
      { name: "Asset finance / leasing", href: "/microfinance/amortization", desc: "Amortisation engine — reducing balance, flat or interest-only schedules." },
      { name: "Treasury / TB trading", href: "/treasury", desc: "TB portfolio, coupons, maturities and yields with per-client statements." },
    ],
  },
  {
    sector: "Trade & Services", icon: "M3 3v18h18M7 15l3-3 3 3 5-6",
    models: [
      { name: "Multi-service operating co.", href: "/investments/models/opco", desc: "Several revenue lines rolled into one P&L, cash flow, IRR and NPV." },
      { name: "Wholesale distribution", href: "/investments/models/opco", desc: "Model distribution lines by margin and growth — edit the lines to fit." },
      { name: "Commodity trading desk", href: "/investments/models/opco", desc: "Trading books as revenue lines with turn and margin; consolidated returns." },
    ],
  },
];

export default function ModelsHub() {
  const count = SECTORS.reduce((s, x) => s + x.models.length, 0);
  return (
    <div>
      <PageHeader
        title="Financial Models"
        subtitle="Pick a model for the deal's sector — it opens the right assumptions, then runs the full projection (NPV, IRR, DSCR, payback) live."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/investments/models/builder" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Build a model
            </Link>
            <Badge tone="live">{count} models · {SECTORS.length} sectors</Badge>
          </div>
        }
      />
      <ModuleTabs moduleKey="investments" />

      <Link href="/investments/models/builder">
        <Card className="mb-8 !p-0 overflow-hidden transition-shadow hover:shadow-md">
          <div className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand) 13%, var(--surface)), var(--surface))" }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg shrink-0" style={{ background: "var(--brand)", color: "#fff" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" /></svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg" style={{ color: "var(--text)" }}>Build a model for any sector</div>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>New opportunity, no template yet? <b>Ask AI to build it</b>, <b>clone a historic model</b> that mimics a past deal, or <b>enter inputs manually</b> — it values live.</p>
            </div>
            <span className="inline-block text-sm font-semibold shrink-0" style={{ color: "var(--brand)" }}>Open builder →</span>
          </div>
        </Card>
      </Link>

      {SECTORS.map((s) => (
        <div key={s.sector} className="mb-8">
          <SectionTitle hint={`${s.models.length} model${s.models.length > 1 ? "s" : ""}`}>{s.sector}</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.models.map((m) => (
              <Link key={m.name} href={m.href}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg mb-2" style={{ background: "var(--surface-2)", color: "var(--brand)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
                  </div>
                  <div className="font-semibold" style={{ color: "var(--text)" }}>{m.name}</div>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{m.desc}</p>
                  <span className="mt-2 inline-block text-sm font-medium" style={{ color: "var(--brand)" }}>Open model →</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        Every model calculates in your browser. Automatic data feeds (commodity prices, FX, tariffs) can be wired in so assumptions pre-fill on their own.
      </p>
    </div>
  );
}
