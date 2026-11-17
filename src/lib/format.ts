// Formatting helpers shared across modules.

export function fmtMoney(value: number, currency = "USD", maximumFractionDigits = 0): string {
  if (!isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function fmtNumber(value: number, digits = 0): string {
  if (!isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function fmtPct(value: number, digits = 1): string {
  if (!isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function compact(value: number, currency?: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = currency ? currencySymbol(currency) : "";
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(0)}`;
}

export function currencySymbol(currency: string): string {
  const map: Record<string, string> = { USD: "$", ZWL: "Z$", ZAR: "R", GBP: "£", EUR: "€" };
  return map[currency] ?? `${currency} `;
}
