import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import { DEMO_STATE } from '../../state/store';
import { computeInventory } from '../calc';
import { monthlyCoverage } from '../documents/checks';
import { portalTabs, requestProgress, workflowSteps } from '../progress';

const s = DEMO_STATE;
const inv = (year: number) => computeInventory(s.activities, DEFAULT_FACTORS, s.entities, s.org, year);

describe('dossier de démonstration', () => {
  it('toutes les rubriques sont fournies et intégrées, les onglets du portail ouverts', () => {
    expect(requestProgress(s).map((p) => p.state)).toEqual(Array(9).fill('integrated'));
    expect(portalTabs(s, inv(2025))).toEqual({ results: true, fleet: true, report: true });
    expect(workflowSteps(s, inv(2025)).every((w) => w.state === 'done')).toBe(true);
  });

  it('12 mois couverts pour l’électricité et le gaz', () => {
    expect(monthlyCoverage(s.documents, ['facture_electricite'], 2025).missing).toEqual([]);
    expect(monthlyCoverage(s.documents, ['facture_gaz'], 2025).missing).toEqual([]);
  });

  it('chaque donnée issue d’une pièce est rattachée à son document et chaque plein à un véhicule', () => {
    const ids = new Set(s.activities.map((a) => a.id));
    for (const d of s.documents) for (const id of d.activityIds) expect(ids.has(id)).toBe(true);
    const fuel = s.activities.filter((a) => a.year === 2025 && (a.factorId === 'diesel_vehicle' || a.factorId === 'petrol_vehicle'));
    expect(fuel.length).toBe(60);
    expect(fuel.every((a) => s.vehicles.some((v) => v.id === a.vehicleId))).toBe(true);
  });

  it('les Scopes 1 et 2 baissent entre 2024 et 2025', () => {
    const a = inv(2024);
    const b = inv(2025);
    expect(b.scope1).toBeLessThan(a.scope1);
    expect(b.scope2Location).toBeLessThan(a.scope2Location);
  });
});
