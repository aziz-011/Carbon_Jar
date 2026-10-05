import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import type { Activity, DocumentRecord, Extraction } from '../../domain/types';
import { monthlyCoverage, runChecks } from '../documents/checks';
import { extractionToActivities, vehiclesFromLines } from '../documents/commit';
import { normalizeDates, parseDocument } from '../documents/parse';
import { looksTabular, parseTable } from '../documents/table';

const F = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));
const parse = (text: string) => parseDocument(text, 'facture.pdf', DEFAULT_FACTORS, 'TN');
const doc = (id: string, e?: Extraction, extra: Partial<DocumentRecord> = {}): DocumentRecord => ({ id, name: `${id}.pdf`, size: 1, mime: 'application/pdf', uploadedAt: '', entityId: 's', year: 2025, status: 'valide', activityIds: [], extraction: e, ...extra });

describe('lecture des factures', () => {
  it('postes horaires STEG moyenne tension : somme jour + pointe + soir + nuit', () => {
    const e = parse(`STEG — Facture d'électricité moyenne tension
Facture N° : MT-2025-0091
Période de consommation : du 01/05/2025 au 31/05/2025
Énergie active Jour : 120 000 kWh
Énergie active Pointe : 18 500 kWh
Énergie active Soir : 41 200 kWh
Énergie active Nuit : 60 300 kWh
Énergie réactive : 30 000 kVArh
Net à payer : 72 450,800 DT`);
    expect(e.docType).toBe('facture_electricite');
    expect(e.lines[0].quantity).toBe(240_000);
    expect(e.warnings.join(' ')).toMatch(/postes horaires/);
  });

  it('le total explicite prime sur les postes', () => {
    const e = parse(`Facture électricité STEG
Jour : 100 kWh
Nuit : 50 kWh
Total énergie active : 160 kWh`);
    expect(e.lines[0].quantity).toBe(160);
  });

  it('différence d’index × coefficient du compteur', () => {
    const e = parse(`Facture d'électricité STEG
Ancien index : 12 340
Nouvel index : 12 980
Coefficient de lecture : 40`);
    expect(e.lines[0].quantity).toBe(640 * 40);
  });

  it('consommation en MWh convertie en kWh', () => {
    expect(parse('Facture électricité STEG\nConsommation : 1 250,5 MWh').lines[0].quantity).toBe(1_250_500);
  });

  it('dates en toutes lettres et période mensuelle', () => {
    expect(normalizeDates('du 1er avril 2025 au 30 avril 2025')).toBe('du 01/04/2025 au 30/04/2025');
    const e = parse('Facture électricité STEG\nMois de facturation : mars 2025\nConsommation : 1 460 kWh');
    expect(e.periodStart).toBe('2025-03-01');
    expect(e.periodEnd).toBe('2025-03-31');
    const f = parse('SONEDE facture eau\nPériode : 02/2025\nConsommation : 120 m3');
    expect([f.periodStart, f.periodEnd]).toEqual(['2025-02-01', '2025-02-28']);
  });

  it('gaz en MWh et en GJ', () => {
    expect(parse('Facture gaz naturel STEG\nConsommation : 12 MWh').lines[0].quantity).toBe(12_000);
    expect(parse('Facture gaz naturel\nQuantité : 100 GJ').lines[0].quantity).toBeCloseTo(27_777.8, 1);
  });
});

describe('relevés tabulaires (CSV / Excel)', () => {
  const fuel = `Relevé carte carburant Agil — avril 2025
Date;Immatriculation;Produit;Litres;Montant TTC
02/04/2025;145 TU 2231;Gasoil;60,5;133,403
09/04/2025;145 TU 2231;Gasoil;58,2;128,331
11/04/2025;231 TU 77;Sans plomb;40;101,000
TOTAL;;;158,7;362,734`;

  it('regroupe les pleins par véhicule et carburant, ignore la ligne total', () => {
    expect(looksTabular(fuel)).toBe(true);
    const e = parseTable(fuel, DEFAULT_FACTORS, 'TN');
    expect(e.docType).toBe('facture_carburant');
    expect(e.lines).toHaveLength(2);
    const d = e.lines.find((l) => l.plate === '145 TU 2231')!;
    expect(d.quantity).toBeCloseTo(118.7, 6);
    expect(d.factorId).toBe('diesel_vehicle');
    expect(d.amount).toBeCloseTo(261.734, 6);
    expect([d.periodStart, d.periodEnd]).toEqual(['2025-04-02', '2025-04-09']);
    expect(e.lines.find((l) => l.plate === '231 TU 77')!.factorId).toBe('petrol_vehicle');
    expect([e.periodStart, e.periodEnd]).toEqual(['2025-04-02', '2025-04-11']);
  });

  it('crée les véhicules inconnus et rattache chaque ligne à son véhicule et sa période', () => {
    const e = parseTable(fuel, DEFAULT_FACTORS, 'TN');
    const d = doc('r1', e, { status: 'a_valider' });
    const fresh = vehiclesFromLines([], e, d, F);
    expect(fresh.map((v) => v.plate).sort()).toEqual(['145 TU 2231', '231 TU 77']);
    const acts = extractionToActivities(d, e, F, undefined, fresh);
    expect(acts).toHaveLength(2);
    expect(acts.every((a) => a.vehicleId)).toBe(true);
    expect(acts.find((a) => a.quantity === 40)!.periodStart).toBe('2025-04-11');
  });

  it('extraction ERP : classement ligne par ligne', () => {
    const erp = `Libellé;Quantité;Unité;Montant
Électricité STEG;12000;kWh;3600
Gazole camions;800;L;1764
Achat acier;2500;kg;9000`;
    const e = parseTable(erp, DEFAULT_FACTORS, 'TN');
    expect(e.lines.map((l) => l.factorId).sort()).toEqual(['diesel_vehicle', 'elec_TN', 'steel'].sort());
  });
});

describe('contrôles de cohérence', () => {
  const ctx = (documents: DocumentRecord[], activities: Activity[] = []) => ({ documents, activities, factors: F, reportingYear: 2025, today: '2025-12-31' });
  const elec = (kwh: number, amount?: number, start = '2025-04-01', end = '2025-04-30', n = 'A1'): Extraction => ({
    docType: 'facture_electricite', method: 'texte', supplier: 'STEG', documentNumber: n, periodStart: start, periodEnd: end, confidence: 0.9, warnings: [],
    lines: [{ description: 'Électricité', quantity: kwh, unit: 'kWh', amount, factorId: 'elec_TN', confidence: 0.9 }],
  });

  it('doublon par fichier identique et par numéro de facture', () => {
    expect(runChecks(doc('b', elec(1)), elec(1), ctx([doc('a', elec(1), { hash: 'h1' })])).length).toBeGreaterThan(0);
    const c = runChecks(doc('b', undefined, { hash: 'h1' }), elec(1, undefined, '2025-05-01', '2025-05-31', 'X'), ctx([doc('a', elec(1), { hash: 'h1' })]));
    expect(c.some((x) => x.code === 'doublon' && x.level === 'bloquant')).toBe(true);
  });

  it('prix unitaire atypique (quantité mal lue)', () => {
    const c = runChecks(doc('b'), elec(1.46, 425), ctx([]));
    expect(c.find((x) => x.code === 'prix_atypique')).toBeTruthy();
    expect(runChecks(doc('b'), elec(1460, 425), ctx([])).find((x) => x.code === 'prix_atypique')).toBeUndefined();
  });

  it('période déjà couverte sur le même site', () => {
    const c = runChecks(doc('b'), elec(100, undefined, '2025-04-10', '2025-05-09', 'B2'), ctx([doc('a', elec(100))]));
    expect(c.find((x) => x.code === 'periode_couverte')).toBeTruthy();
  });

  it('consommation journalière atypique', () => {
    const acts: Activity[] = ['01', '02', '03'].map((m) => ({ id: m, entityId: 's', year: 2025, factorId: 'elec_TN', quantity: 3000, quality: 2, periodStart: `2025-${m}-01`, periodEnd: `2025-${m}-28` }));
    const c = runChecks(doc('b'), elec(30_000, undefined, '2025-04-01', '2025-04-28', 'C'), ctx([], acts));
    expect(c.find((x) => x.code === 'valeur_atypique')).toBeTruthy();
    expect(runChecks(doc('b'), elec(3100, undefined, '2025-04-01', '2025-04-28', 'C'), ctx([], acts)).find((x) => x.code === 'valeur_atypique')).toBeUndefined();
  });

  it('hors exercice et date future', () => {
    const e = { ...elec(10, undefined, '2024-12-01', '2024-12-31', 'D'), date: '2026-03-01' };
    const c = runChecks(doc('b'), e, ctx([]));
    expect(c.map((x) => x.code).sort()).toEqual(['date_future', 'hors_exercice']);
  });
});

it('mois couverts et manquants', () => {
  const docs = ['01', '02', '04'].map((m, i) => doc(`d${i}`, { docType: 'facture_electricite', method: 'texte', periodStart: `2025-${m}-01`, periodEnd: `2025-${m}-28`, lines: [], confidence: 1, warnings: [] }));
  const cov = monthlyCoverage(docs, ['facture_electricite'], 2025);
  expect(cov.covered).toEqual([0, 1, 3]);
  expect(cov.missing).toContain('mars');
  expect(cov.missing).toHaveLength(9);
});

describe('intégration groupée', async () => {
  const { reducer, emptyState } = await import('../../state/store');
  it('une pièce avec alerte « attention » reste en vérification', () => {
    // Même règle que validateMany : aucune alerte autre qu'« info ».
    const checks = runChecks(doc('b'), { docType: 'facture_electricite', method: 'texte', confidence: 0.9, warnings: [], lines: [{ description: 'x', quantity: 1.46, unit: 'kWh', amount: 425, factorId: 'elec_TN', confidence: 0.9 }] }, { documents: [], activities: [], factors: F, reportingYear: 2025 });
    expect(checks.some((c) => c.level !== 'info')).toBe(true);
    expect(reducer(emptyState(), { type: 'portal', patch: {} }).documents).toHaveLength(0);
  });
});
