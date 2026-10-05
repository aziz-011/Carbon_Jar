import type { Scope } from '../domain/types';
import type { Inventory } from './calc';
import type { Recommendation } from './recommendations';

/**
 * Lecture « argent » du bilan carbone pour le client :
 *  - dépenses liées aux activités émettrices (énergie, carburant, achats…), par scope ;
 *  - coût carbone : émissions × prix carbone (risque financier lié aux futures taxes ou quotas) ;
 *  - gains possibles : économies d'énergie des leviers + coût carbone évité.
 */
export interface MoneyView {
  /** Dépenses par scope (devise). */
  spendByScope: Record<Scope, number>;
  totalSpend: number;
  /** Coût carbone total (Scopes 1, 2 et 3) et sur le périmètre maîtrisé (1 + 2). */
  carbonCostTotal: number;
  carbonCostScope12: number;
  /** Dépense moyenne par tonne émise. */
  spendPerTonne?: number;
  /** Gains annuels estimés si les leviers recommandés sont mis en œuvre. */
  gains: {
    reductionT: [number, number];
    energySaved: [number, number];
    carbonAvoided: [number, number];
    total: [number, number];
  };
}

export function moneyView(inv: Inventory, recos: Recommendation[], carbonPrice: number): MoneyView {
  const totalSpend = inv.cost;
  // Potentiel plafonné à 90 % des émissions : les leviers d'un même poste se recouvrent.
  const cap = inv.totalLocation * 0.9;
  const reductionT: [number, number] = [
    Math.min(cap, recos.reduce((s, r) => s + r.reductionT[0], 0)),
    Math.min(cap, recos.reduce((s, r) => s + r.reductionT[1], 0)),
  ];
  const energySaved: [number, number] = [
    Math.max(0, recos.reduce((s, r) => s + r.costSaved[0], 0)),
    Math.max(0, Math.min(totalSpend * 0.6, recos.reduce((s, r) => s + r.costSaved[1], 0))),
  ];
  const carbonAvoided: [number, number] = [reductionT[0] * carbonPrice, reductionT[1] * carbonPrice];
  return {
    spendByScope: { ...inv.costByScope },
    totalSpend,
    carbonCostTotal: inv.totalLocation * carbonPrice,
    carbonCostScope12: (inv.scope1 + inv.scope2Location) * carbonPrice,
    spendPerTonne: inv.totalLocation > 0 ? totalSpend / inv.totalLocation : undefined,
    gains: {
      reductionT,
      energySaved,
      carbonAvoided,
      total: [energySaved[0] + carbonAvoided[0], energySaved[1] + carbonAvoided[1]],
    },
  };
}

/**
 * Scénario « si je réduis mes émissions de X % » : tonnes évitées, coût carbone évité et
 * économies d'énergie, en supposant que la baisse porte sur les postes énergétiques
 * (Scopes 1 et 2) au prorata de leur dépense.
 */
export function reductionScenario(inv: Inventory, pct: number, carbonPrice: number) {
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const avoidedT = inv.totalLocation * p;
  const energySpend = inv.costByScope[1] + inv.costByScope[2];
  const energySaved = energySpend * p;
  const carbonSaved = avoidedT * carbonPrice;
  return { avoidedT, remainingT: inv.totalLocation - avoidedT, energySaved, carbonSaved, total: energySaved + carbonSaved };
}
