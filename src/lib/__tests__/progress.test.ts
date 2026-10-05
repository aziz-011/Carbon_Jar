import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import { SAMPLE_DOCUMENTS } from '../../data/sampleDocuments';
import type { DocumentRecord } from '../../domain/types';
import { emptyState, reducer } from '../../state/store';
import { computeInventory } from '../calc';
import { extractionToActivities } from '../documents/commit';
import { parseDocument } from '../documents/parse';
import { collectionRate, portalTabs, requestProgress, workflowSteps } from '../progress';

const F = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));
const inv = (s: ReturnType<typeof emptyState>) => computeInventory(s.activities, DEFAULT_FACTORS, s.entities, s.org, s.org.reportingYear);

function addDoc(s: ReturnType<typeof emptyState>, part: string, validate: boolean, requestId?: string) {
  const sample = SAMPLE_DOCUMENTS.find((d) => d.name.includes(part))!;
  const e = parseDocument(sample.text, sample.name, DEFAULT_FACTORS, 'TN');
  const doc: DocumentRecord = { id: part, name: sample.name, size: 1, mime: 'text/plain', uploadedAt: '2025-01-01', entityId: s.entities[0].id, year: 2025, status: 'a_valider', activityIds: [], extraction: e, requestId, source: 'client' };
  s = reducer(s, { type: 'document:upsert', document: doc });
  if (validate) s = reducer(s, { type: 'document:validate', documentId: doc.id, activities: extractionToActivities(doc, e, F) });
  return s;
}

describe('portail client', () => {
  it('nouveau dossier : tout est à fournir, résultats et rapport verrouillés', () => {
    const s = emptyState('Client');
    const col = collectionRate(requestProgress(s));
    expect(col.done).toBe(0);
    expect(col.missingRequired.length).toBe(5);
    expect(portalTabs(s, inv(s))).toEqual({ results: false, fleet: false, report: false });
    expect(workflowSteps(s, inv(s))[0].state).toBe('current');
  });

  it('une facture STEG reconnue coche la rubrique électricité et débloque les résultats', () => {
    let s = { ...emptyState('Client'), org: { ...emptyState().org, reportingYear: 2025 } };
    s = addDoc(s, 'STEG_electricite', true);
    const elec = requestProgress(s).find((p) => p.request.id === 'electricite')!;
    expect(elec.state).toBe('integrated');
    expect(portalTabs(s, inv(s)).results).toBe(true);
  });

  it('un document en attente rend la rubrique « reçue » et bloque l’étape de vérification', () => {
    let s = { ...emptyState('Client'), org: { ...emptyState().org, reportingYear: 2025 } };
    s = addDoc(s, 'Agil', false, 'carburant');
    expect(requestProgress(s).find((p) => p.request.id === 'carburant')!.state).toBe('pending');
    const steps = workflowSteps(s, inv(s));
    expect(steps.find((x) => x.id === 'verification')!.state).not.toBe('done');
  });

  it('« non concerné » retire la rubrique du calcul de collecte', () => {
    let s = emptyState('Client');
    s = reducer(s, { type: 'portal', patch: { notApplicable: ['climatisation', 'combustibles'] } });
    const col = collectionRate(requestProgress(s));
    expect(col.total).toBe(7);
    expect(col.missingRequired.map((p) => p.request.id)).not.toContain('climatisation');
  });

  it('une carte grise fait apparaître l’onglet flotte ; la publication ouvre le rapport', () => {
    let s = emptyState('Client');
    const sample = SAMPLE_DOCUMENTS.find((d) => d.name.includes('carte_grise'))!;
    const e = parseDocument(sample.text, sample.name, DEFAULT_FACTORS, 'TN');
    s = reducer(s, { type: 'document:validate', documentId: 'x', activities: [], vehicle: { id: 'v', plate: e.vehicle!.plate!, energy: 'gasoil', entityId: s.entities[0].id, documentIds: ['x'] } });
    s = reducer(s, { type: 'portal', patch: { reportPublished: true } });
    expect(portalTabs(s, inv(s))).toMatchObject({ fleet: true, report: true });
  });
});
