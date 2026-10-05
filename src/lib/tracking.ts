import type { ActivityResult, Budget, GwpSet, Scope } from '../domain/types';
import { factorKgCO2ePerUnit } from './calc';
import { fmt } from './format';

/**
 * Détail lisible du calcul d'une donnée d'activité, pour vérification :
 *   quantité × facteur (× part consolidée) = émissions.
 */
export function formulaText(r: ActivityResult, gwpSet: GwpSet): string {
  const perUnit = factorKgCO2ePerUnit(r.factor, gwpSet);
  const share = r.consolidationShare < 1 ? ` × ${fmt(r.consolidationShare * 100)} % (part consolidée)` : '';
  const base = `${fmt(r.activity.quantity, 3)} ${r.factor.unit} × ${fmt(perUnit, 6)} kg CO2e/${r.factor.unit}${share} = ${fmt(r.kgCO2e, 3)} kg CO2e`;
  const market = r.scope === 2 && r.kgCO2eMarket !== r.kgCO2e ? ` · market-based : ${fmt(r.kgCO2eMarket, 3)} kg CO2e` : '';
  const nonKyoto = r.nonKyotoKgCO2e > 0 ? ` · hors Kyoto : ${fmt(r.nonKyotoKgCO2e, 3)} kg CO2e` : '';
  return base + market + nonKyoto;
}

/** Affiche une masse en kg ou en tonnes selon l'ordre de grandeur. */
export function fmtMass(kg: number): string {
  if (Math.abs(kg) < 1000) return `${fmt(kg, 2)} kg CO2e`;
  const t = kg / 1000;
  return `${fmt(t, Math.abs(t) >= 100 ? 1 : 3)} t CO2e`;
}

const DAY = 86_400_000;

function parseDay(s: string | undefined): number | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return undefined;
  const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Number.isFinite(t) ? t : undefined;
}

/**
 * Poids de chaque mois de l'année (somme = 1) pour une donnée : au prorata des jours de
 * sa période de consommation, ou uniformément sur l'année si la période n'est pas connue.
 */
export function monthWeights(r: Pick<ActivityResult, 'activity'>, year: number): { weights: number[]; dated: boolean } {
  const start = parseDay(r.activity.periodStart);
  const end = parseDay(r.activity.periodEnd ?? r.activity.periodStart);
  if (start === undefined || end === undefined || end < start) return { weights: Array(12).fill(1 / 12), dated: false };
  const w = Array(12).fill(0);
  const yStart = Date.UTC(year, 0, 1);
  const yEnd = Date.UTC(year, 11, 31);
  const from = Math.max(start, yStart);
  const to = Math.min(end, yEnd);
  if (to < from) return { weights: Array(12).fill(1 / 12), dated: false };
  let total = 0;
  for (let t = from; t <= to; t += DAY) {
    w[new Date(t).getUTCMonth()] += 1;
    total += 1;
  }
  return { weights: w.map((x) => x / total), dated: true };
}

export interface MonthPoint {
  month: number;
  label: string;
  s1: number;
  s2: number;
  s3: number;
  total: number;
  mwh: number;
  cost: number;
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Émissions (t CO2e), énergie et coûts par mois. */
export function monthlySeries(results: ActivityResult[], year: number, method: 'location' | 'market' = 'location'): MonthPoint[] {
  const pts: MonthPoint[] = MONTHS.map((label, month) => ({ month, label, s1: 0, s2: 0, s3: 0, total: 0, mwh: 0, cost: 0 }));
  for (const r of results) {
    if (r.activity.year !== year) continue;
    const { weights } = monthWeights(r, year);
    const t = (method === 'market' ? r.kgCO2eMarket : r.kgCO2e) / 1000;
    weights.forEach((w, m) => {
      const key = (`s${r.scope}` as 's1' | 's2' | 's3');
      pts[m][key] += t * w;
      pts[m].total += t * w;
      pts[m].mwh += (r.energyKwh / 1000) * w;
      pts[m].cost += r.cost * w;
    });
  }
  return pts;
}

export interface BudgetStatus {
  used: number;
  remaining: number;
  usedPct: number;
  /** Projection de fin d'année au rythme actuel. */
  projected: number;
  /** Part de l'année couverte par les données (0–1). */
  coverage: number;
  unit: string;
  level: 'ok' | 'attention' | 'depasse';
}

export function budgetUnit(b: Budget, unitOf: (factorId: string) => string | undefined, currency: string): string {
  if (b.metric === 'emissions') return 't CO2e';
  if (b.metric === 'energy') return 'MWh';
  if (b.metric === 'cost') return currency;
  return unitOf(b.factorIds?.[0] ?? '') ?? '';
}

function matches(b: Budget, r: ActivityResult): boolean {
  if (r.activity.year !== b.year) return false;
  if (b.factorIds?.length && !b.factorIds.includes(r.factor.id)) return false;
  if (b.scopes?.length && !b.scopes.includes(r.scope as Scope)) return false;
  return true;
}

/**
 * Consommé / restant / projection d'un budget. La projection extrapole le consommé à
 * l'année entière d'après les mois couverts par des données datées ; les données sans
 * période sont considérées comme annuelles.
 */
export function budgetStatus(b: Budget, results: ActivityResult[], unit: string): BudgetStatus {
  const rs = results.filter((r) => matches(b, r));
  const value = (r: ActivityResult) =>
    b.metric === 'emissions' ? r.kgCO2e / 1000 : b.metric === 'energy' ? r.energyKwh / 1000 : b.metric === 'cost' ? r.cost : r.activity.quantity * r.consolidationShare;
  const used = rs.reduce((s, r) => s + value(r), 0);
  const covered = new Set<number>();
  let annual = false;
  for (const r of rs) {
    const { weights, dated } = monthWeights(r, b.year);
    if (!dated) annual = true;
    weights.forEach((w, m) => w > 0 && covered.add(m));
  }
  const coverage = rs.length === 0 ? 0 : annual ? 1 : covered.size / 12;
  const projected = coverage > 0 ? used / coverage : 0;
  const usedPct = b.limit > 0 ? used / b.limit : 0;
  const level = used > b.limit || projected > b.limit * 1.0001 ? (used > b.limit ? 'depasse' : 'attention') : usedPct > 0.9 ? 'attention' : 'ok';
  return { used, remaining: b.limit - used, usedPct, projected, coverage, unit, level };
}
