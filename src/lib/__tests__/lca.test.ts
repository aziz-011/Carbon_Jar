import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import type { LcaStudy } from '../../domain/types';
import { DEMO_STATE } from '../../state/store';
import { assessLca, emptyLca, findings, isoChecks, sensitivity } from '../lca';

const F = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));

describe('ACV', () => {
  it('calcule les impacts par étape et sépare les bénéfices évités', () => {
    const s: LcaStudy = {
      ...emptyLca(),
      product: 'P',
      functionalUnit: '1 t',
      flows: [
        { id: 'a', stage: 'fabrication', description: 'Électricité', factorId: 'elec_TN', quantity: 1000, quality: 'mesuree' },
        { id: 'b', stage: 'extraction', description: 'Matière', customFactor: { kgCO2ePerUnit: 2, unit: 'kg', source: 'EPD' }, quantity: 100, quality: 'calculee' },
        { id: 'c', stage: 'fin_de_vie', description: 'Évité', customFactor: { kgCO2ePerUnit: 1, unit: 'kg', source: 'x' }, quantity: 50, quality: 'estimee', avoided: true },
      ],
    };
    const a = assessLca(s, F, 'AR5');
    expect(a.byStage.fabrication).toBeCloseTo(580);
    expect(a.byStage.extraction).toBeCloseTo(200);
    expect(a.total).toBeCloseTo(780);
    expect(a.avoided).toBeCloseTo(50);
    expect(a.energyKwh).toBeCloseTo(1000);
    expect(sensitivity(a)[0].deltaPct).toBeCloseTo((580 * 0.2) / 780);
    const checks = isoChecks(s, a);
    expect(checks.find((c) => c.label.startsWith('Complétude'))!.ok).toBe(false);
  });

  it('dossier de démonstration : les 5 étapes sont renseignées et le rapport par unité est cohérent', () => {
    const lca = DEMO_STATE.lca!;
    const a = assessLca(lca, F, DEMO_STATE.org.gwpSet);
    for (const st of lca.stages) expect(a.byStage[st]).toBeGreaterThan(0);
    expect(isoChecks(lca, a).every((c) => c.ok)).toBe(true);
    expect(findings(lca, a).length).toBeGreaterThan(2);
    // L'ACV ne dépasse pas le bilan rapporté à la production (frais généraux exclus, aval ajouté).
    expect(a.total).toBeGreaterThan(300);
    expect(a.total).toBeLessThan(1500);
  });
});
