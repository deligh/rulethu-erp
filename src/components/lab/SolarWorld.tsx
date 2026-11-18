"use client";

import React, { useMemo, useState } from "react";
import type { PowerOut } from "@/lib/lab/power";
import {
  SOLAR_COUNTRIES, wattsPerPerson, potential, solarNeeded,
  KARIBA_KM2, HA_PER_MW_FLOAT, NATIONAL_TWH, HOME_MWH_YR,
} from "@/lib/lab/solar";
import { usd, num } from "@/lib/lab/types";

const ZW = SOLAR_COUNTRIES[0];
type View = "need" | "world" | "potential";

function HBar({ label, value, max, text, hl, note }: { label: string; value: number; max: number; text: string; hl?: boolean; note?: string }) {
  return (
    <div title={note}>
      <div className="flex justify-between gap-2 text-xs mb-1">
        <span style={{ color: hl ? "var(--text)" : "var(--text-muted)", fontWeight: hl ? 700 : 400 }}>{label}</span>
        <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>{text}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2, #eee)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(1.2, Math.min(100, (value / max) * 100))}%`, background: hl ? "#e3a008" : "#a5adba" }} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface-2, #f4f5f7)" }}>
      <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{label}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color: tone ?? "var(--text)" }}>{value}</div>
      {sub && <div className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

export default function SolarWorld({ o, year, onApply }: { o: PowerOut; year: number; onApply: (solarMW: number, batteryMW: number) => void }) {
  const [view, setView] = useState<View>("need");
  const [metric, setMetric] = useState<"wpp" | "yield" | "gw">("wpp");
  const [land, setLand] = useState(0.1);
  const [kariba, setKariba] = useState(1);
  const need = useMemo(() => solarNeeded(o), [o]);
  const pot = potential(land);
  const de = SOLAR_COUNTRIES.find((c) => c.id === "de")!;
  const ratioSun = ZW.yield / de.yield;
  const ratioWpp = wattsPerPerson(de) / wattsPerPerson(ZW);
  const floatMW = (KARIBA_KM2 * kariba / 100 * 100) / HA_PER_MW_FLOAT;
  const battForLab = Math.max(need.batteryMW, need.batteryMWh / 4);

  const rows = [...SOLAR_COUNTRIES].map((c) => ({ c, v: metric === "wpp" ? wattsPerPerson(c) : metric === "yield" ? c.yield : c.gw })).sort((a, b) => b.v - a.v);
  const max = Math.max(...rows.map((r) => r.v));
  const fmt = (v: number) => (metric === "wpp" ? `${num(Math.round(v))} W` : metric === "yield" ? `${num(v)} kWh` : v >= 10 ? `${num(Math.round(v))} GW` : `${v} GW`);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="p-4 md:p-5" style={{ background: "linear-gradient(135deg, #3b2a00 0%, #a16207 55%, #e3a008 100%)" }}>
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "#fde68a" }}>Solar · Zimbabwe vs the world</div>
        <div className="text-white text-xl md:text-2xl font-bold mt-1 leading-snug">
          A solar panel in Zimbabwe produces {ratioSun.toFixed(1)}× what the same panel makes in Germany — yet Germany has {Math.round(ratioWpp)}× more solar per person.
        </div>
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {([["need", "What we actually need"], ["world", "How the world compares"], ["potential", "Our potential"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: view === k ? "#fff" : "rgba(255,255,255,0.15)", color: view === k ? "#713f12" : "#fff" }}>{l}</button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-5">
        {view === "need" && (
          o.unservedMWh < 1 ? (
            <p className="text-sm" style={{ color: "var(--text)" }}>This scenario has no load-shedding in {year} — no extra solar is needed to close the gap. Try “2030, do nothing” to see what it would take.</p>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                To wipe out the <b style={{ color: "var(--text)" }}>{num(Math.round(o.unservedMWh))} MWh</b> of load-shedding a day in this {year} scenario with solar — {num(Math.round(need.dayMWh))} MWh in daylight hours and {num(Math.round(need.eveMWh))} MWh after sunset (which needs batteries):
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="New solar needed" value={`${num(Math.round(need.solarMW / 50) * 50)} MW`} sub="incl. 15% margin for cloudy days" tone="#a16207" />
                <Stat label="Batteries for the evening" value={`${num(Math.round(need.batteryMWh / 50) * 50)} MWh`} sub={`${num(Math.round(battForLab))} MW for ≈ ${need.hours.toFixed(1)} hours`} />
                <Stat label="Land" value={`${num(Math.round(need.landHa / 100) * 100)} ha`} sub={`${(need.landHa / 100 / 390757 * 100).toFixed(3)}% of Zimbabwe`} />
                <Stat label="Investment" value={usd(need.capex)} sub="solar ≈ USD 0.7m/MW, batteries ≈ USD 0.25m/MWh" />
                <Stat label="Clean energy a year" value={`${num(Math.round(need.annualGWh))} GWh`} sub={`≈ ${(need.annualGWh / 1000 / NATIONAL_TWH * 100).toFixed(0)}% of today's national generation`} />
                <Stat label="Homes it could power" value={num(Math.round(need.homes / 1000) * 1000)} sub={`at ${HOME_MWH_YR * 1000 / 12} kWh a month each`} />
                <Stat label="Construction jobs" value={num(Math.round(need.jobs / 100) * 100)} sub="job-years, indicative" />
                <Stat label="Forex on diesel avoided" value={usd(o.unservedMWh * 365 * 1000 * 0.28)} sub="if the gap were filled with diesel instead" />
              </div>
              <div className="flex gap-2 mt-4 flex-wrap items-center">
                <button onClick={() => onApply(Math.round(need.solarMW / 50) * 50, Math.round(battForLab / 50) * 50)} className="text-sm rounded-lg px-4 py-2 font-semibold text-white" style={{ background: "#a16207" }}>
                  Add this solar + storage to the Power Lab →
                </button>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>Then watch the red load-shedding area on the chart above disappear.</span>
              </div>
            </>
          )
        )}

        {view === "world" && (
          <>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {([["wpp", "Solar per person"], ["yield", "Sunshine (output per panel)"], ["gw", "Total installed"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMetric(k)} className="text-xs rounded-full border px-3 py-1" style={{ borderColor: metric === k ? "#a16207" : "var(--border)", color: metric === k ? "#a16207" : "var(--text-muted)", fontWeight: metric === k ? 700 : 500, background: "var(--surface)" }}>{l}</button>
              ))}
            </div>
            <div className="grid gap-2.5 md:grid-cols-2 md:gap-x-8">
              {rows.map(({ c, v }) => <HBar key={c.id} label={c.name} value={v} max={max} text={fmt(v)} hl={c.id === "zw"} note={c.note} />)}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3 text-sm">
              <div className="rounded-lg p-3" style={{ background: "#fef3c7", color: "#713f12" }}><b>Best sun, least solar.</b> Zimbabwe&apos;s panels yield ≈ {num(ZW.yield)} kWh a year per kW — more than Spain, the US or China.</div>
              <div className="rounded-lg p-3" style={{ background: "#fef3c7", color: "#713f12" }}><b>South Africa&apos;s lesson.</b> Load-shedding pushed homes and firms to install ≈ 5 GW of rooftop solar in two years, without waiting for big power stations.</div>
              <div className="rounded-lg p-3" style={{ background: "#fef3c7", color: "#713f12" }}><b>If we matched South Africa per person</b> (≈ {num(Math.round(wattsPerPerson(SOLAR_COUNTRIES[3])))} W), Zimbabwe would have ≈ {num(Math.round(wattsPerPerson(SOLAR_COUNTRIES[3]) * ZW.pop))} MW of solar.</div>
            </div>
            {metric === "yield" && <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>Output per panel = how many kWh one kilowatt of panels produces in a year. It depends on sunshine and latitude.</p>}
          </>
        )}

        {view === "potential" && (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Cover {land}% of Zimbabwe&apos;s land with panels</span>
                </div>
                <input type="range" min={0.01} max={0.5} step={0.01} value={land} onChange={(e) => setLand(+e.target.value)} className="w-full" style={{ accentColor: "#a16207" }} />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Stat label="Area" value={`${num(Math.round(pot.km2))} km²`} sub={`≈ ${Math.round(pot.km2 / 100) / 10}k ha · a square ${Math.sqrt(pot.km2).toFixed(0)} km a side`} />
                  <Stat label="Solar capacity" value={`${num(Math.round(pot.mw / 100) * 100)} MW`} />
                  <Stat label="Energy a year" value={`${pot.twh.toFixed(1)} TWh`} tone="#a16207" />
                  <Stat label="vs. all electricity today" value={`${pot.timesNational.toFixed(1)}×`} sub={`national generation ≈ ${NATIONAL_TWH} TWh`} tone={pot.timesNational >= 1 ? "var(--pos)" : undefined} />
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Floating solar on {kariba}% of Lake Kariba</span>
                <input type="range" min={0.1} max={3} step={0.1} value={kariba} onChange={(e) => setKariba(+e.target.value)} className="w-full" style={{ accentColor: "#a16207" }} />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Stat label="Lake area used" value={`${num(Math.round(KARIBA_KM2 * kariba / 100))} km²`} sub="lake ≈ 5,580 km² (shared with Zambia)" />
                  <Stat label="Floating solar" value={`≈ ${num(Math.round(floatMW / 100) * 100)} MW`} sub="panels also cut evaporation" tone="#a16207" />
                </div>
                <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>Floating panels on a hydro lake share the existing Kariba grid connection, and solar by day lets the dam save water for the evening peak — solar and hydro work as a team.</p>
              </div>
            </div>
            <div className="mt-5 rounded-lg p-4 text-sm leading-relaxed" style={{ background: "var(--sidebar-active-bg)", color: "var(--text)" }}>
              <b>The big idea:</b> Zimbabwe&apos;s problem is not sunshine — it is storage, grid connections, finance and bankable power-purchase agreements. Solar covers the day; batteries, Kariba water and Hwange cover the evening peak. Rooftop solar for homes, mines and factories can move fastest, because owners finance it themselves.
            </div>
          </>
        )}
        <p className="text-[11px] mt-4" style={{ color: "var(--text-faint)" }}>Approximate figures (Global Solar Atlas-type yields; installed capacity ≈ end-2024 from IRENA/Ember-style estimates; Zimbabwe&apos;s rooftop solar is not fully counted). Verify before public use.</p>
      </div>
    </div>
  );
}
