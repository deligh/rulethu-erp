// Relative valuation — EV/EBITDA and P/E comparable-company multiples, plus a
// blended "football field" that sets the intrinsic DCF value next to the market
// multiples and the current share price.

export interface Peer { name: string; evEbitda: number; pe: number }

export const DEFAULT_PEERS: Peer[] = [
  { name: "Regional industrial A", evEbitda: 6.5, pe: 11.0 },
  { name: "Regional industrial B", evEbitda: 5.8, pe: 9.5 },
  { name: "Regional industrial C", evEbitda: 7.2, pe: 12.5 },
  { name: "EM sector median", evEbitda: 6.0, pe: 10.0 },
];

export interface CompsInputs {
  ebitda: number;      // subject EBITDA
  netIncome: number;   // subject net income attributable to equity
  netDebt: number;     // total debt − cash (+ other claims)
  shares: number;
  peers: Peer[];
}

export interface MethodVal {
  multLow: number; multMid: number; multHigh: number;   // peer multiple range
  psLow: number; psMid: number; psHigh: number;         // implied value/share (reporting currency)
}
export interface CompsResult { evEbitda: MethodVal; pe: MethodVal }

function stats(xs: number[]): { low: number; mid: number; high: number } {
  const a = xs.filter((x) => isFinite(x) && x > 0).sort((p, q) => p - q);
  if (!a.length) return { low: 0, mid: 0, high: 0 };
  const mid = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  return { low: a[0], mid, high: a[a.length - 1] };
}

export function computeComps(i: CompsInputs): CompsResult {
  const ev = stats(i.peers.map((p) => p.evEbitda));
  const pe = stats(i.peers.map((p) => p.pe));
  const psEv = (mult: number) => (i.shares > 0 ? (mult * i.ebitda - i.netDebt) / i.shares : 0);
  const psPe = (mult: number) => (i.shares > 0 ? (mult * i.netIncome) / i.shares : 0);
  return {
    evEbitda: { multLow: ev.low, multMid: ev.mid, multHigh: ev.high, psLow: psEv(ev.low), psMid: psEv(ev.mid), psHigh: psEv(ev.high) },
    pe: { multLow: pe.low, multMid: pe.mid, multHigh: pe.high, psLow: psPe(pe.low), psMid: psPe(pe.mid), psHigh: psPe(pe.high) },
  };
}

// A blended range across methods, in a single currency (caller converts to local).
export interface FieldRow { label: string; low: number; mid: number; high: number }
export function footballField(dcfLow: number, dcfMid: number, dcfHigh: number, c: CompsResult): { rows: FieldRow[]; blendedMid: number; min: number; max: number } {
  const rows: FieldRow[] = [
    { label: "DCF (Bear–Bull)", low: dcfLow, mid: dcfMid, high: dcfHigh },
    { label: "EV/EBITDA comps", low: c.evEbitda.psLow, mid: c.evEbitda.psMid, high: c.evEbitda.psHigh },
    { label: "P/E comps", low: c.pe.psLow, mid: c.pe.psMid, high: c.pe.psHigh },
  ];
  const blendedMid = rows.reduce((s, r) => s + r.mid, 0) / rows.length;
  const all = rows.flatMap((r) => [r.low, r.high]).filter((x) => isFinite(x));
  return { rows, blendedMid, min: Math.min(...all, blendedMid), max: Math.max(...all, blendedMid) };
}
