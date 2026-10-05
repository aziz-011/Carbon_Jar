import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import { SECTOR_TIPS } from '../../data/sectorAdvice';
import type { Activity, Entity } from '../../domain/types';
import { computeInventory } from '../calc';
import { recommend } from '../recommendations';
import { moneyView, reductionScenario } from '../savings';

const site: Entity = { id: 's', name: 'S', equityShare: 100, financialControl: true, operationalControl: true, country: 'TN' };
const act = (factorId: string, quantity: number, cost?: number): Activity => ({ id: factorId, entityId: 's', year: 2025, factorId, quantity, quality: 2, cost });
const inv = computeInventory([act('elec_TN', 100_000, 30_000), act('diesel_vehicle', 10_000, 22_050), act('flight_short', 5000)], DEFAULT_FACTORS, [site], { gwpSet: 'AR5', consolidation: 'operational' }, 2025);

describe('vue financière', () => {
  it('dépenses par scope et coût carbone', () => {
    const m = moneyView(inv, [], 270);
    expect(m.spendByScope[2]).toBe(30_000);
    expect(m.spendByScope[1]).toBe(22_050);
    expect(m.totalSpend).toBe(52_050);
    expect(m.carbonCostTotal).toBeCloseTo(inv.totalLocation * 270, 6);
    expect(m.carbonCostScope12).toBeCloseTo((inv.scope1 + inv.scope2Location) * 270, 6);
  });

  it('gains = économies d’énergie + coût carbone évité, potentiel plafonné', () => {
    const recos = recommend(inv, { gridFactor: 0.58, country: 'TN' });
    const m = moneyView(inv, recos, 270);
    expect(m.gains.reductionT[1]).toBeLessThanOrEqual(inv.totalLocation * 0.9 + 1e-9);
    expect(m.gains.total[1]).toBeCloseTo(m.gains.energySaved[1] + m.gains.carbonAvoided[1], 6);
    expect(m.gains.total[0]).toBeGreaterThan(0);
  });

  it('scénario de réduction de 20 %', () => {
    const s = reductionScenario(inv, 20, 270);
    expect(s.avoidedT).toBeCloseTo(inv.totalLocation * 0.2, 9);
    expect(s.energySaved).toBeCloseTo(52_050 * 0.2, 6);
    expect(s.carbonSaved).toBeCloseTo(inv.totalLocation * 0.2 * 270, 6);
  });
});

it('chaque secteur a au moins 4 conseils distincts', () => {
  for (const tips of Object.values(SECTOR_TIPS)) {
    expect(tips.length).toBeGreaterThanOrEqual(4);
    expect(new Set(tips.map((t) => t.title)).size).toBe(tips.length);
  }
});
