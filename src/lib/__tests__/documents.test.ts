import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import { SAMPLE_DOCUMENTS } from '../../data/sampleDocuments';
import type { DocumentRecord } from '../../domain/types';
import { sanitizeAiExtraction } from '../documents/ai';
import { routeDistanceKm } from '../documents/airports';
import { checkLines, convertQuantity, extractionToActivities, mergeVehicle } from '../documents/commit';
import { parseDocument } from '../documents/parse';

const F = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));
const sample = (part: string) => {
  const d = SAMPLE_DOCUMENTS.find((s) => s.name.includes(part))!;
  return parseDocument(d.text, d.name, DEFAULT_FACTORS, 'TN');
};
const doc: DocumentRecord = { id: 'd1', name: 'facture.pdf', size: 1, mime: 'application/pdf', uploadedAt: '', entityId: 'usine', year: 2025, status: 'a_valider', activityIds: [] };

describe('analyse des documents', () => {
  it('facture STEG électricité', () => {
    const e = sample('STEG_electricite');
    expect(e.docType).toBe('facture_electricite');
    expect(e.supplier).toBe('STEG');
    expect(e.documentNumber).toBe('2025-04-778812');
    expect(e.periodStart).toBe('2025-04-01');
    expect(e.periodEnd).toBe('2025-04-30');
    expect(e.totalAmount).toBeCloseTo(112550.914, 3);
    expect(e.lines).toHaveLength(1);
    expect(e.lines[0].quantity).toBe(316600);
    expect(e.lines[0].factorId).toBe('elec_TN');
  });

  it('facture STEG gaz en thermies → kWh', () => {
    const e = sample('STEG_gaz');
    expect(e.docType).toBe('facture_gaz');
    expect(e.lines[0].quantity).toBeCloseTo(41250 * 1.163, 3);
    expect(e.lines[0].factorId).toBe('ng_kwh');
  });

  it('ticket carburant Agil', () => {
    const e = sample('Agil');
    expect(e.docType).toBe('facture_carburant');
    expect(e.lines[0].quantity).toBeCloseTo(85.4, 3);
    expect(e.lines[0].factorId).toBe('diesel_vehicle');
    expect(e.totalAmount).toBeCloseTo(188.307, 3);
    expect(e.vehicle?.plate).toBe('145 TU 2231');
  });

  it('carte grise', () => {
    const e = sample('carte_grise');
    expect(e.docType).toBe('carte_grise');
    expect(e.vehicle).toMatchObject({ plate: '145 TU 2231', make: 'ISUZU', model: 'D-MAX', energy: 'gasoil', fiscalPower: 9, firstRegistration: '2021-03-12', vin: 'MPATFS86JMT001234' });
    expect(e.lines).toHaveLength(0);
  });

  it('fiche technique', () => {
    const e = sample('fiche_technique');
    expect(e.docType).toBe('fiche_vehicule');
    expect(e.vehicle).toMatchObject({ plate: '145 TU 2231', consumptionL100: 8.1, co2gkm: 212 });
  });

  it('facture SONEDE', () => {
    const e = sample('SONEDE');
    expect(e.docType).toBe('facture_eau');
    expect(e.lines[0]).toMatchObject({ quantity: 1240, factorId: 'water' });
  });

  it('billet d’avion : distance par aéroports, aller-retour', () => {
    const e = sample('Tunisair');
    expect(e.docType).toBe('billet_transport');
    expect(e.lines).toHaveLength(2);
    expect(e.lines[0].factorId).toBe('flight_medium');
    expect(e.lines[0].quantity).toBeGreaterThan(1500);
    expect(e.lines[0].quantity).toBeLessThan(1700);
  });

  it('rapport de climatisation', () => {
    const e = sample('climatisation');
    expect(e.docType).toBe('registre_fluides');
    expect(e.lines[0]).toMatchObject({ quantity: 9, factorId: 'refrigerant_R-404A' });
  });

  it('bordereau de déchets', () => {
    const e = sample('dechets');
    expect(e.docType).toBe('bordereau_dechets');
    expect(e.lines[0]).toMatchObject({ quantity: 12.6, factorId: 'waste_landfill' });
  });
});

describe('validation des documents', () => {
  it('crée des activités liées au document, avec période et coût', () => {
    const e = sample('STEG_electricite');
    const acts = extractionToActivities(doc, e, F);
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ factorId: 'elec_TN', quantity: 316600, year: 2025, periodStart: '2025-04-01', documentId: 'd1', quality: 2 });
    expect(acts[0].cost).toBeCloseTo(112550.914, 3);
    expect(acts[0].evidence).toContain('2025-04-778812');
  });

  it('convertit les unités compatibles et refuse les autres', () => {
    expect(convertQuantity(2, 'MWh', 'kWh')).toMatchObject({ qty: 2000, ok: true });
    expect(convertQuantity(500, 'kg', 't')).toMatchObject({ qty: 0.5, ok: true });
    expect(convertQuantity(5, 'L', 'kWh').ok).toBe(false);
    const checks = checkLines({ docType: 'autre', method: 'manuel', lines: [{ description: 'x', quantity: 3, unit: 'L', factorId: 'elec_TN', confidence: 1 }], confidence: 1, warnings: [] }, F);
    expect(checks[0].ok).toBe(false);
  });

  it('fusionne carte grise et fiche technique sur le même véhicule', () => {
    const v1 = mergeVehicle([], sample('carte_grise'), doc)!;
    const v2 = mergeVehicle([v1], sample('fiche_technique'), { ...doc, id: 'd2' })!;
    expect(v2.id).toBe(v1.id);
    expect(v2).toMatchObject({ make: 'ISUZU', consumptionL100: 8.1, energy: 'gasoil' });
    expect(v2.documentIds).toEqual(['d1', 'd2']);
  });
});

describe('lecture par Claude : contrôle de la réponse', () => {
  it('rejette les facteurs inconnus et les valeurs invalides', () => {
    const e = sanitizeAiExtraction(
      { docType: 'facture_electricite', lines: [{ description: 'Électricité STEG', quantity: 1460, unit: 'kWh', factorId: 'n_importe_quoi' }, { description: 'x', quantity: -3 }], date: '05/05/2025' },
      DEFAULT_FACTORS,
    );
    expect(e.lines[0].factorId).toBe('elec_TN');
    expect(e.lines[1].quantity).toBeUndefined();
    expect(e.date).toBeUndefined();
    expect(e.warnings.join(' ')).toMatch(/inconnu/);
  });

  it('type inconnu → autre', () => {
    expect(sanitizeAiExtraction({ docType: 'bidon' }, DEFAULT_FACTORS).docType).toBe('autre');
  });
});

it('distance TUN–CDG ≈ 1 480 km × 1,08', () => {
  expect(routeDistanceKm('TUN', 'CDG')).toBeGreaterThan(1550);
  expect(routeDistanceKm('TUN', 'CDG')).toBeLessThan(1650);
});

describe('état : validation des documents', async () => {
  const { reducer, emptyState } = await import('../../state/store');
  it('deux documents du même véhicule ne créent qu’une fiche', () => {
    let s = emptyState('Test');
    const e1 = sample('carte_grise');
    const d1 = { ...doc, id: 'c1' };
    s = reducer(s, { type: 'document:upsert', document: d1 });
    s = reducer(s, { type: 'document:validate', documentId: 'c1', activities: [], vehicle: mergeVehicle([], e1, d1) });
    const e2 = sample('fiche_technique');
    const d2 = { ...doc, id: 'c2' };
    s = reducer(s, { type: 'document:upsert', document: d2 });
    s = reducer(s, { type: 'document:validate', documentId: 'c2', activities: [], vehicle: mergeVehicle([], e2, d2) });
    expect(s.vehicles).toHaveLength(1);
    expect(s.vehicles[0]).toMatchObject({ make: 'ISUZU', consumptionL100: 8.1, documentIds: ['c1', 'c2'] });
  });

  it('supprimer un document retire ses données de l’inventaire', () => {
    let s = emptyState('Test');
    const e = sample('STEG_electricite');
    s = reducer(s, { type: 'document:upsert', document: doc });
    s = reducer(s, { type: 'document:validate', documentId: doc.id, activities: extractionToActivities(doc, e, F) });
    expect(s.activities).toHaveLength(1);
    s = reducer(s, { type: 'document:delete', id: doc.id });
    expect(s.activities).toHaveLength(0);
  });
});
