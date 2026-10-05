import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import type { Activity, Entity } from '../../domain/types';
import { computeActivity } from '../calc';
import { budgetStatus, formulaText, monthWeights, monthlySeries } from '../tracking';

const F = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));
const site: Entity = { id: 's', name: 'S', equityShare: 100, financialControl: true, operationalControl: true, country: 'TN' };
const org = { gwpSet: 'AR5' as const, consolidation: 'operational' as const };
const res = (factorId: string, quantity: number, extra: Partial<Activity> = {}) =>
  computeActivity({ id: Math.random().toString(), entityId: 's', year: 2025, factorId, quantity, quality: 2, ...extra }, F.get(factorId)!, site, org);

describe('détail des calculs', () => {
  it('1 460 kWh × 0,58 = 846,8 kg CO2e', () => {
    const r = res('elec_TN', 1460);
    expect(r.kgCO2e).toBeCloseTo(846.8, 9);
    expect(formulaText(r, 'AR5').replace(/\u202f/g, ' ')).toBe('1 460 kWh × 0,58 kg CO2e/kWh = 846,8 kg CO2e');
  });

  it('1 416 kWh × 0,58 = 821,28 kg CO2e', () => {
    expect(res('elec_TN', 1416).kgCO2e).toBeCloseTo(821.28, 9);
  });

  it('mentionne la part consolidée', () => {
    const r = computeActivity({ id: 'x', entityId: 'j', year: 2025, factorId: 'elec_TN', quantity: 1000, quality: 2 }, F.get('elec_TN')!, { ...site, id: 'j', equityShare: 50 }, { gwpSet: 'AR5', consolidation: 'equity' });
    expect(formulaText(r, 'AR5')).toContain('× 50 % (part consolidée) = 290 kg CO2e');
  });
});

describe('répartition mensuelle', () => {
  it('au prorata des jours de la période', () => {
    const { weights, dated } = monthWeights(res('elec_TN', 1, { periodStart: '2025-04-01', periodEnd: '2025-04-30' }), 2025);
    expect(dated).toBe(true);
    expect(weights[3]).toBe(1);
    const two = monthWeights(res('elec_TN', 1, { periodStart: '2025-01-15', periodEnd: '2025-02-14' }), 2025).weights;
    expect(two[0]).toBeCloseTo(17 / 31, 6);
    expect(two[1]).toBeCloseTo(14 / 31, 6);
  });

  it('uniforme sans période', () => {
    expect(monthWeights(res('elec_TN', 1), 2025).weights.every((w) => Math.abs(w - 1 / 12) < 1e-12)).toBe(true);
  });

  it('la somme mensuelle égale le total annuel', () => {
    const rs = [res('elec_TN', 12000, { periodStart: '2025-03-01', periodEnd: '2025-05-31' }), res('ng_kwh', 50000)];
    const total = rs.reduce((s, r) => s + r.kgCO2e / 1000, 0);
    const series = monthlySeries(rs, 2025);
    expect(series.reduce((s, p) => s + p.total, 0)).toBeCloseTo(total, 9);
  });
});

describe('budgets', () => {
  it('consommé, restant et projection sur 4 mois de données', () => {
    const months = ['01', '02', '03', '04'];
    const rs = months.map((m) => res('elec_TN', 100_000, { periodStart: `2025-${m}-01`, periodEnd: `2025-${m}-28` }));
    const st = budgetStatus({ id: 'b', name: 'Élec', year: 2025, metric: 'quantity', factorIds: ['elec_TN'], limit: 1_000_000 }, rs, 'kWh');
    expect(st.used).toBe(400_000);
    expect(st.remaining).toBe(600_000);
    expect(st.coverage).toBeCloseTo(4 / 12, 9);
    expect(st.projected).toBeCloseTo(1_200_000, 6);
    expect(st.level).toBe('attention');
  });

  it('budget d’émissions filtré par scope', () => {
    const rs = [res('elec_TN', 1000), res('flight_short', 1000)];
    const st = budgetStatus({ id: 'b', name: 'S2', year: 2025, metric: 'emissions', scopes: [2], limit: 1 }, rs, 't CO2e');
    expect(st.used).toBeCloseTo(0.58, 9);
    expect(st.level).toBe('ok');
  });
});
