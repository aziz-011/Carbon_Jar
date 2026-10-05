const nf = (digits: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Nombre au format français avec un nombre adaptatif de décimales. */
export function fmt(n: number | undefined, digits?: number): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  const d = digits ?? (Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 1 ? 1 : 3);
  return nf(d).format(n);
}

export const fmtT = (t: number | undefined) => `${fmt(t)} t CO2e`;
export const fmtMWh = (mwh: number | undefined) => `${fmt(mwh)} MWh`;
export const fmtMoney = (v: number | undefined, currency: string) => `${fmt(v, 0)} ${currency}`;
export const fmtPct = (v: number | undefined, digits = 0) => (v === undefined || !Number.isFinite(v) ? '—' : `${fmt(v * 100, digits)} %`);

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
