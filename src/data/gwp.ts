import type { GwpSet, KyotoGas } from '../domain/types';

/**
 * Pouvoirs de réchauffement global (PRG / GWP) à 100 ans.
 * Sources : GIEC AR5 (2013, tableau 8.A.1) et AR6 (2021, tableau 7.SM.7).
 * La source du PRG utilisée doit être explicitement déclarée dans le reporting
 * (principe de transparence).
 */
export const GWP_BASE: Record<string, Record<GwpSet, number>> = {
  CO2: { AR5: 1, AR6: 1 },
  CH4: { AR5: 28, AR6: 29.8 }, // AR6 : méthane d'origine fossile
  N2O: { AR5: 265, AR6: 273 },
  SF6: { AR5: 23500, AR6: 24300 },
  NF3: { AR5: 16100, AR6: 17400 },
  'HFC-23': { AR5: 12400, AR6: 14600 },
  'HFC-32': { AR5: 677, AR6: 771 },
  'HFC-125': { AR5: 3170, AR6: 3740 },
  'HFC-134a': { AR5: 1300, AR6: 1530 },
  'HFC-143a': { AR5: 4800, AR6: 5810 },
  'HFC-152a': { AR5: 138, AR6: 164 },
  'PFC-14': { AR5: 6630, AR6: 7380 },
  'HCFC-22': { AR5: 1760, AR6: 1960 },
};

export interface Refrigerant {
  id: string;
  label: string;
  /** Famille de gaz : détermine le rattachement Kyoto (HFC/PFC/SF6) ou hors Kyoto. */
  group: KyotoGas | 'NON_KYOTO';
  /** Composition massique du mélange (somme = 1). */
  composition: Record<string, number>;
  /** PRG fixé pour les fluides naturels / HFO (non couverts par la table de base). */
  fixedGwp?: number;
  note?: string;
}

/**
 * Fluides frigorigènes courants. Les mélanges (R-404A, R-407C, R-410A) sont calculés
 * comme la moyenne pondérée des PRG de leurs composants.
 */
export const REFRIGERANTS: Refrigerant[] = [
  { id: 'R-134a', label: 'R-134a (HFC-134a)', group: 'HFC', composition: { 'HFC-134a': 1 } },
  { id: 'R-32', label: 'R-32 (HFC-32)', group: 'HFC', composition: { 'HFC-32': 1 } },
  { id: 'R-410A', label: 'R-410A (50 % R-32 / 50 % R-125)', group: 'HFC', composition: { 'HFC-32': 0.5, 'HFC-125': 0.5 } },
  { id: 'R-404A', label: 'R-404A (R-125 / R-143a / R-134a)', group: 'HFC', composition: { 'HFC-125': 0.44, 'HFC-143a': 0.52, 'HFC-134a': 0.04 } },
  { id: 'R-407C', label: 'R-407C (R-32 / R-125 / R-134a)', group: 'HFC', composition: { 'HFC-32': 0.23, 'HFC-125': 0.25, 'HFC-134a': 0.52 } },
  { id: 'R-23', label: 'R-23 (HFC-23)', group: 'HFC', composition: { 'HFC-23': 1 } },
  { id: 'SF6', label: 'SF6 (appareillage électrique)', group: 'SF6', composition: { SF6: 1 } },
  { id: 'CF4', label: 'CF4 (PFC-14)', group: 'PFC', composition: { 'PFC-14': 1 } },
  {
    id: 'R-22',
    label: 'R-22 (HCFC-22) — hors Kyoto',
    group: 'NON_KYOTO',
    composition: { 'HCFC-22': 1 },
    note: 'Gaz hors Kyoto (Protocole de Montréal) : déclaré séparément, hors scopes.',
  },
  { id: 'R-744', label: 'R-744 (CO2)', group: 'CO2', composition: {}, fixedGwp: 1 },
  { id: 'R-290', label: 'R-290 (propane)', group: 'NON_KYOTO', composition: {}, fixedGwp: 3, note: 'Hydrocarbure, PRG très faible.' },
  { id: 'R-1234yf', label: 'R-1234yf (HFO)', group: 'NON_KYOTO', composition: {}, fixedGwp: 1, note: 'HFO, PRG < 1.' },
];

const REFRIGERANT_BY_ID = new Map(REFRIGERANTS.map((r) => [r.id, r]));

export function getRefrigerant(id: string): Refrigerant | undefined {
  return REFRIGERANT_BY_ID.get(id);
}

/** PRG d'un gaz simple (CO2, CH4, N2O, SF6, NF3, HFC-xx…). */
export function gasGwp(gas: string, set: GwpSet): number {
  const v = GWP_BASE[gas];
  if (!v) throw new Error(`PRG inconnu pour le gaz ${gas}`);
  return v[set];
}

/** PRG d'un fluide frigorigène (mélange pondéré par la composition massique). */
export function refrigerantGwp(id: string, set: GwpSet): number {
  const r = getRefrigerant(id);
  if (!r) throw new Error(`Fluide frigorigène inconnu : ${id}`);
  if (r.fixedGwp !== undefined) return r.fixedGwp;
  return Object.entries(r.composition).reduce((sum, [gas, share]) => sum + share * gasGwp(gas, set), 0);
}

export const GWP_SET_LABELS: Record<GwpSet, string> = {
  AR5: 'GIEC AR5 (2013) — PRG 100 ans',
  AR6: 'GIEC AR6 (2021) — PRG 100 ans',
};
