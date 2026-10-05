import type {
  Activity,
  ActivityResult,
  CategoryId,
  ConsolidationApproach,
  EmissionFactor,
  Entity,
  GasKey,
  GwpSet,
  Organization,
  Scope,
} from '../domain/types';
import { getCategory } from '../data/categories';
import { gasGwp, getRefrigerant, refrigerantGwp } from '../data/gwp';

/**
 * Moteur de calcul de l'inventaire GES.
 *
 * Formule centrale (Corporate Standard, chap. 6) :
 *   Émissions = Donnée d'activité × Facteur d'émission
 * puis conversion de chaque gaz en CO2e :
 *   CO2e = Σ (masse du gaz × PRG du gaz)
 */

export interface PerUnitEmissions {
  /** kg CO2e par unité, ventilé par gaz. */
  byGas: Partial<Record<GasKey, number>>;
  /** kg CO2e par unité, gaz hors Kyoto (déclarés séparément). */
  nonKyoto: number;
  /** kg de CO2 biogénique par unité (poste mémo). */
  biogenic: number;
}

/** Convertit un facteur d'émission en kg CO2e par unité, ventilé par gaz. */
export function perUnitEmissions(factor: EmissionFactor, gwpSet: GwpSet): PerUnitEmissions {
  const byGas: Partial<Record<GasKey, number>> = {};
  let nonKyoto = 0;

  if (factor.gases) {
    for (const [gas, kg] of Object.entries(factor.gases)) {
      if (!kg) continue;
      byGas[gas as GasKey] = (byGas[gas as GasKey] ?? 0) + kg * gasGwp(gas, gwpSet);
    }
  }
  if (factor.refrigerant) {
    const r = getRefrigerant(factor.refrigerant);
    const gwp = refrigerantGwp(factor.refrigerant, gwpSet);
    if (!r || r.group === 'NON_KYOTO') nonKyoto += gwp;
    else byGas[r.group] = (byGas[r.group] ?? 0) + gwp;
  }
  if (factor.co2e !== undefined) {
    byGas.CO2e = (byGas.CO2e ?? 0) + factor.co2e;
  }
  return { byGas, nonKyoto, biogenic: factor.biogenicCO2 ?? 0 };
}

export function sumGases(byGas: Partial<Record<GasKey, number>>): number {
  return Object.values(byGas).reduce<number>((s, v) => s + (v ?? 0), 0);
}

/** kg CO2e par unité (gaz Kyoto uniquement). */
export function factorKgCO2ePerUnit(factor: EmissionFactor, gwpSet: GwpSet): number {
  return sumGases(perUnitEmissions(factor, gwpSet).byGas);
}

/**
 * Part des émissions d'une entité intégrée dans l'inventaire selon l'approche de
 * consolidation (Corporate Standard, chap. 3) :
 *  - part de capital : au prorata de la participation ;
 *  - contrôle financier / opérationnel : 100 % si contrôle, 0 % sinon.
 */
export function consolidationShare(entity: Entity | undefined, approach: ConsolidationApproach): number {
  if (!entity) return 1;
  switch (approach) {
    case 'equity':
      return Math.max(0, Math.min(100, entity.equityShare)) / 100;
    case 'financial':
      return entity.financialControl ? 1 : 0;
    case 'operational':
      return entity.operationalControl ? 1 : 0;
  }
}

/**
 * Facteur market-based (kg CO2e/kWh) selon la hiérarchie du Scope 2 Guidance :
 * contrat direct / PPA > certificats (GO, REC) > facteur fournisseur > mix résiduel > moyenne réseau.
 */
export function marketBasedFactor(activity: Activity, locationFactor: number): { factor: number; note?: string } {
  switch (activity.instrument ?? 'none') {
    case 'eac':
      return { factor: activity.instrumentFactor ?? 0, note: 'Certificat d’attribut énergétique (GO/REC) — doit être annulé dans un registre.' };
    case 'ppa':
    case 'supplier':
    case 'residual':
      if (activity.instrumentFactor === undefined || Number.isNaN(activity.instrumentFactor)) {
        return { factor: locationFactor, note: 'Facteur contractuel manquant : moyenne réseau utilisée en dernier recours.' };
      }
      return { factor: activity.instrumentFactor };
    case 'none':
    default:
      return { factor: locationFactor, note: 'Aucun instrument : mix résiduel indisponible, moyenne réseau utilisée en dernier recours.' };
  }
}

/** Calcule émissions, énergie et coût pour une donnée d'activité. */
export function computeActivity(
  activity: Activity,
  factor: EmissionFactor,
  entity: Entity | undefined,
  org: Pick<Organization, 'gwpSet' | 'consolidation'>,
): ActivityResult {
  const share = consolidationShare(entity, org.consolidation);
  const qty = activity.quantity * share;
  const unit = perUnitEmissions(factor, org.gwpSet);

  const byGas: Partial<Record<GasKey, number>> = {};
  for (const [gas, v] of Object.entries(unit.byGas)) byGas[gas as GasKey] = (v ?? 0) * qty;
  const kgCO2e = sumGases(byGas);

  let category: CategoryId = factor.category;
  let scope: Scope = getCategory(category).scope;
  let kgCO2eMarket = kgCO2e;
  let note: string | undefined;

  if (scope === 2) {
    if (activity.resold) {
      // Énergie achetée pour être revendue à des utilisateurs finaux : exclue du Scope 2, déclarée en Scope 3.
      category = 'S3_C3';
      scope = 3;
      note = 'Énergie revendue à des utilisateurs finaux : reclassée en Scope 3 (cat. 3) pour éviter le double comptage.';
    } else if (activity.instrument && activity.instrument !== 'none') {
      const locationPerUnit = sumGases(unit.byGas);
      const mb = marketBasedFactor(activity, locationPerUnit);
      kgCO2eMarket = mb.factor * qty;
      note = mb.note;
    }
  }

  const energyKwh = (factor.energyKwhPerUnit ?? 0) * qty;
  const hasCost = activity.cost !== undefined && !Number.isNaN(activity.cost);
  const cost = hasCost ? (activity.cost as number) * share : factor.defaultPrice !== undefined ? factor.defaultPrice * qty : 0;

  return {
    activity,
    factor,
    entity,
    scope,
    category,
    consolidationShare: share,
    byGas,
    kgCO2e,
    kgCO2eMarket,
    biogenicKg: unit.biogenic * qty,
    nonKyotoKgCO2e: unit.nonKyoto * qty,
    energyKwh,
    cost,
    costEstimated: !hasCost && factor.defaultPrice !== undefined && cost > 0,
    note,
  };
}

export interface Inventory {
  results: ActivityResult[];
  /** Totaux en t CO2e. Scope 2 et total « location » / « market ». */
  scope1: number;
  scope2Location: number;
  scope2Market: number;
  scope3: number;
  totalLocation: number;
  totalMarket: number;
  byCategory: Record<string, number>;
  byGas: Partial<Record<GasKey, number>>;
  /** Ventilation par gaz des seuls Scopes 1 et 2 (exigence de reporting). */
  byGasScope12: Partial<Record<GasKey, number>>;
  biogenicT: number;
  nonKyotoT: number;
  energyMWh: number;
  energyByScope: Record<Scope, number>;
  cost: number;
  costByScope: Record<Scope, number>;
  costEstimatedShare: number;
}

const kgToT = (kg: number) => kg / 1000;

export function buildInventory(results: ActivityResult[]): Inventory {
  const inv: Inventory = {
    results,
    scope1: 0,
    scope2Location: 0,
    scope2Market: 0,
    scope3: 0,
    totalLocation: 0,
    totalMarket: 0,
    byCategory: {},
    byGas: {},
    byGasScope12: {},
    biogenicT: 0,
    nonKyotoT: 0,
    energyMWh: 0,
    energyByScope: { 1: 0, 2: 0, 3: 0 },
    cost: 0,
    costByScope: { 1: 0, 2: 0, 3: 0 },
    costEstimatedShare: 0,
  };
  let estimatedCost = 0;
  for (const r of results) {
    const t = kgToT(r.kgCO2e);
    if (r.scope === 1) inv.scope1 += t;
    if (r.scope === 2) {
      inv.scope2Location += t;
      inv.scope2Market += kgToT(r.kgCO2eMarket);
    }
    if (r.scope === 3) inv.scope3 += t;
    inv.byCategory[r.category] = (inv.byCategory[r.category] ?? 0) + t;
    for (const [g, v] of Object.entries(r.byGas)) {
      const key = g as GasKey;
      inv.byGas[key] = (inv.byGas[key] ?? 0) + kgToT(v ?? 0);
      if (r.scope !== 3) inv.byGasScope12[key] = (inv.byGasScope12[key] ?? 0) + kgToT(v ?? 0);
    }
    inv.biogenicT += kgToT(r.biogenicKg);
    inv.nonKyotoT += kgToT(r.nonKyotoKgCO2e);
    inv.energyMWh += r.energyKwh / 1000;
    inv.energyByScope[r.scope] += r.energyKwh / 1000;
    inv.cost += r.cost;
    inv.costByScope[r.scope] += r.cost;
    if (r.costEstimated) estimatedCost += r.cost;
  }
  inv.totalLocation = inv.scope1 + inv.scope2Location + inv.scope3;
  inv.totalMarket = inv.scope1 + inv.scope2Market + inv.scope3;
  inv.costEstimatedShare = inv.cost > 0 ? estimatedCost / inv.cost : 0;
  return inv;
}

/** Calcule l'inventaire d'une année à partir des données saisies. */
export function computeInventory(
  activities: Activity[],
  factors: EmissionFactor[],
  entities: Entity[],
  org: Pick<Organization, 'gwpSet' | 'consolidation'>,
  year?: number,
): Inventory {
  const fMap = new Map(factors.map((f) => [f.id, f]));
  const eMap = new Map(entities.map((e) => [e.id, e]));
  const results: ActivityResult[] = [];
  for (const a of activities) {
    if (year !== undefined && a.year !== year) continue;
    const f = fMap.get(a.factorId);
    if (!f) continue;
    results.push(computeActivity(a, f, eMap.get(a.entityId), org));
  }
  return buildInventory(results);
}

// ───────────────────────────── Indicateurs ─────────────────────────────

/** Ratio d'intensité = Émissions de GES / Métrique d'activité (Corporate Standard, chap. 9). */
export function intensityRatio(emissionsT: number, metric: number | undefined): number | undefined {
  if (!metric || metric <= 0) return undefined;
  return emissionsT / metric;
}

/** Exposition financière au risque carbone = émissions (t CO2e) × prix carbone. */
export function carbonCostExposure(emissionsT: number, carbonPrice: number): number {
  return emissionsT * carbonPrice;
}

/**
 * Émissions fugitives par la méthode du bilan massique (module de formation §4.3) :
 *   Quantité fuitée = charge initiale + recharges − charge finale
 * Variante complète du GHG Protocol : + (capacité des équipements retirés − capacité des équipements neufs).
 */
export function refrigerantMassBalance(input: {
  initialStock: number;
  recharges: number;
  finalStock: number;
  retiredCapacity?: number;
  newCapacity?: number;
}): number {
  const leaked =
    input.initialStock + input.recharges - input.finalStock + (input.retiredCapacity ?? 0) - (input.newCapacity ?? 0);
  return Math.max(0, leaked);
}

/**
 * Recalcul de l'année de base (Corporate Standard, chap. 5) : nécessaire en cas de
 * changement structurel (fusion, acquisition, cession), de méthode, ou d'erreur
 * significative dépassant le seuil de signification. La croissance organique ne
 * déclenche pas de recalcul.
 */
export function baseYearRecalculation(input: {
  baseYearEmissions: number;
  acquiredEmissions: number;
  divestedEmissions: number;
  methodologyDelta: number;
  thresholdPct: number;
}): { change: number; changePct: number; recalculate: boolean; adjustedBase: number } {
  const change = input.acquiredEmissions - input.divestedEmissions + input.methodologyDelta;
  const gross = Math.abs(input.acquiredEmissions) + Math.abs(input.divestedEmissions) + Math.abs(input.methodologyDelta);
  const changePct = input.baseYearEmissions > 0 ? (gross / input.baseYearEmissions) * 100 : 0;
  return {
    change,
    changePct,
    recalculate: changePct >= input.thresholdPct,
    adjustedBase: input.baseYearEmissions + change,
  };
}

/** Trajectoire linéaire de réduction entre l'année de base et l'année cible. */
export function targetTrajectory(baseValue: number, baseYear: number, targetYear: number, reductionPct: number) {
  const target = baseValue * (1 - reductionPct / 100);
  const points: Array<{ year: number; value: number }> = [];
  const span = Math.max(1, targetYear - baseYear);
  for (let y = baseYear; y <= targetYear; y++) {
    points.push({ year: y, value: baseValue + ((target - baseValue) * (y - baseYear)) / span });
  }
  return { target, points, annualRatePct: reductionPct / span };
}

/** Progression vers l'objectif : part de la réduction visée déjà réalisée. */
export function targetProgress(baseValue: number, currentValue: number, reductionPct: number) {
  const achievedPct = baseValue > 0 ? ((baseValue - currentValue) / baseValue) * 100 : 0;
  const progress = reductionPct > 0 ? achievedPct / reductionPct : 0;
  return { achievedPct, progress };
}

/** Référence SBTi : réduction linéaire minimale de 4,2 %/an (Scopes 1 et 2) pour une trajectoire 1,5 °C. */
export const SBTI_ANNUAL_RATE_15C = 4.2;

/**
 * Trajectoire Net Zero de référence : baisse linéaire des émissions de l'année de base
 * jusqu'à zéro en 2050 (horizon de l'Accord de Paris et du standard Net Zero de la SBTi).
 */
export function netZeroPath(baseTotal: number, baseYear: number, year: number, netZeroYear = 2050): number | undefined {
  if (year < baseYear || baseTotal <= 0) return undefined;
  return Math.max(0, baseTotal * (1 - (year - baseYear) / (netZeroYear - baseYear)));
}

/** Années affichées avec la trajectoire : celles mesurées, prolongées jusqu'à l'horizon donné. */
export function trajectoryYears(years: number[], until = 2030): number[] {
  const from = Math.min(...years);
  const to = Math.max(until, ...years);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
