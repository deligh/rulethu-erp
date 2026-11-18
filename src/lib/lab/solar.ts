// Solar: Zimbabwe vs the world, potential, and what we actually need.
// APPROXIMATE figures for scenario thinking:
//  - yield = typical annual output of 1 kW of panels (kWh per kWp), Global Solar Atlas-type averages
//  - installed = solar capacity, GW, ≈ end-2024 (IRENA / Ember style estimates; Zimbabwe rooftop poorly counted)
// Verify before quoting publicly.

import type { PowerOut } from "./power";
import { SOLAR_SHAPE } from "./power";

export interface SolarCountry { id: string; name: string; yield: number; gw: number; pop: number; note?: string }
export const SOLAR_COUNTRIES: SolarCountry[] = [
  { id: "zw", name: "Zimbabwe", yield: 1750, gw: 0.3, pop: 16.6, note: "Grid IPPs plus a fast-growing rooftop market; rooftop is poorly counted" },
  { id: "na", name: "Namibia", yield: 1950, gw: 0.3, pop: 2.6 },
  { id: "bw", name: "Botswana", yield: 1850, gw: 0.1, pop: 2.6 },
  { id: "za", name: "South Africa", yield: 1750, gw: 8, pop: 62, note: "Rooftop boom during load-shedding: homes and firms added ~5 GW in two years" },
  { id: "zm", name: "Zambia", yield: 1700, gw: 0.3, pop: 20.6 },
  { id: "ke", name: "Kenya", yield: 1600, gw: 0.5, pop: 55 },
  { id: "eg", name: "Egypt", yield: 1900, gw: 2.5, pop: 112, note: "Benban solar park (≈1.6 GW), one of the largest in the world" },
  { id: "ma", name: "Morocco", yield: 1800, gw: 1, pop: 37.5, note: "Noor Ouarzazate solar complex, with storage" },
  { id: "cl", name: "Chile", yield: 2000, gw: 12, pop: 19.6, note: "Atacama desert: some of the best sun on earth; solar now a large share of power" },
  { id: "au", name: "Australia", yield: 1600, gw: 39, pop: 26.6, note: "About one in three homes has rooftop solar" },
  { id: "es", name: "Spain", yield: 1550, gw: 39, pop: 48 },
  { id: "in", name: "India", yield: 1500, gw: 97, pop: 1430 },
  { id: "us", name: "United States", yield: 1450, gw: 177, pop: 335 },
  { id: "cn", name: "China", yield: 1300, gw: 887, pop: 1410, note: "Adds more solar each year than the rest of the world combined" },
  { id: "de", name: "Germany", yield: 950, gw: 99, pop: 84, note: "Cloudy and northern — yet one of the world's solar leaders" },
  { id: "nl", name: "Netherlands", yield: 920, gw: 28, pop: 17.9 },
  { id: "gb", name: "United Kingdom", yield: 900, gw: 18, pop: 68 },
];
export const wattsPerPerson = (c: SolarCountry) => (c.gw * 1e9) / (c.pop * 1e6);

// Zimbabwe constants (approximate)
export const ZW_LAND_KM2 = 390757;
export const KARIBA_KM2 = 5580;
export const HA_PER_MW = 2; // ground-mounted, incl. spacing
export const HA_PER_MW_FLOAT = 1.2;
export const HOME_MWH_YR = 2.4; // ≈ 200 kWh a month
export const NATIONAL_TWH = 13.5; // ≈ 2025 generation (1,537 MW average × 8,760 h)
export const SOLAR_CAPEX_M = 0.7, BATT_CAPEX_PER_MWH_M = 0.25;

export function potential(shareOfLandPct: number, yieldKwh = 1750) {
  const km2 = ZW_LAND_KM2 * shareOfLandPct / 100;
  const mw = (km2 * 100) / HA_PER_MW;
  const twh = (mw * yieldKwh) / 1e6;
  return { km2, mw, twh, timesNational: twh / NATIONAL_TWH };
}

/** Solar + batteries needed to wipe out the unserved energy in a Power Lab scenario. */
export function solarNeeded(o: PowerOut, margin = 0.15) {
  let dayMWh = 0, eveMWh = 0, eveMW = 0;
  for (const h of o.hours) {
    if (h.unserved <= 0) continue;
    if (SOLAR_SHAPE[h.h] >= 0.17) dayMWh += h.unserved; // hours where solar can serve directly
    else { eveMWh += h.unserved; eveMW = Math.max(eveMW, h.unserved); }
  }
  const perMwDay = SOLAR_SHAPE.reduce((a, b) => a + b, 0); // MWh per MW per day
  const solarMW = ((dayMWh + eveMWh / 0.88) / perMwDay) * (1 + margin);
  const batteryMW = eveMW;
  const batteryMWh = eveMWh;
  const annualGWh = (solarMW * perMwDay * 365) / 1000;
  return {
    dayMWh, eveMWh, solarMW, batteryMW, batteryMWh,
    hours: batteryMW > 0 ? batteryMWh / batteryMW : 0,
    landHa: solarMW * HA_PER_MW,
    capex: (solarMW * SOLAR_CAPEX_M + batteryMWh * BATT_CAPEX_PER_MWH_M) * 1e6,
    homes: (annualGWh * 1000) / HOME_MWH_YR,
    jobs: solarMW * 3 + batteryMW * 1,
    annualGWh,
  };
}
