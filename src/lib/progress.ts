import { DOCUMENT_REQUESTS, type DocumentRequest } from '../data/documentRequests';
import type { DocumentRecord } from '../domain/types';
import type { AppState } from '../state/store';
import type { Inventory } from './calc';

export type RequestState = 'na' | 'missing' | 'pending' | 'integrated';

export interface RequestProgress {
  request: DocumentRequest;
  state: RequestState;
  documents: DocumentRecord[];
}

/** Documents rattachés à une rubrique : déposés dans la rubrique, ou reconnus comme tels. */
export function documentsForRequest(r: DocumentRequest, docs: DocumentRecord[]): DocumentRecord[] {
  return docs.filter((d) => d.status !== 'rejete' && (d.requestId === r.id || (!d.requestId && !!d.extraction && r.docTypes.includes(d.extraction.docType))));
}

export function requestProgress(state: AppState): RequestProgress[] {
  return DOCUMENT_REQUESTS.map((request) => {
    const documents = documentsForRequest(request, state.documents);
    const na = state.portal.notApplicable.includes(request.id);
    const st: RequestState = documents.length === 0 ? (na ? 'na' : 'missing') : documents.every((d) => d.status === 'valide') ? 'integrated' : 'pending';
    return { request, state: st, documents };
  });
}

/** Part des rubriques concernées pour lesquelles au moins un document a été fourni. */
export function collectionRate(progress: RequestProgress[]): { done: number; total: number; rate: number; missingRequired: RequestProgress[] } {
  const concerned = progress.filter((p) => p.state !== 'na');
  const done = concerned.filter((p) => p.state !== 'missing').length;
  return {
    done,
    total: concerned.length,
    rate: concerned.length ? done / concerned.length : 1,
    missingRequired: concerned.filter((p) => p.state === 'missing' && p.request.required),
  };
}

export type StepState = 'done' | 'current' | 'todo';

export interface WorkflowStep {
  id: string;
  title: string;
  sub: string;
  state: StepState;
}

/** Les cinq étapes du dossier, de la collecte au rapport publié. */
export function workflowSteps(state: AppState, inv: Inventory): WorkflowStep[] {
  const progress = requestProgress(state);
  const col = collectionRate(progress);
  const docs = state.documents.filter((d) => d.status !== 'rejete');
  const pending = docs.filter((d) => d.status === 'a_valider' || d.status === 'erreur').length;
  const flags = [
    col.missingRequired.length === 0 && docs.length > 0,
    docs.length > 0,
    docs.length > 0 && pending === 0,
    inv.results.length > 0 && pending === 0,
    state.portal.reportPublished,
  ];
  // Une étape est terminée si elle et toutes les précédentes le sont ; la première ouverte est « en cours ».
  let blocked = false;
  const states: StepState[] = flags.map((f) => {
    if (!blocked && f) return 'done';
    if (!blocked) {
      blocked = true;
      return 'current';
    }
    return 'todo';
  });
  const st = (i: number) => states[i];
  return [
    { id: 'collecte', title: 'Collecte', sub: `${col.done}/${col.total} rubriques fournies`, state: st(0) },
    { id: 'extraction', title: 'Extraction', sub: docs.length ? `${docs.length} pièce(s) lue(s) et classée(s)` : 'automatique au dépôt', state: st(1) },
    { id: 'verification', title: 'Vérification', sub: pending ? `${pending} pièce(s) en cours` : 'par les ingénieurs', state: st(2) },
    { id: 'bilan', title: 'Bilan carbone', sub: inv.results.length ? `${Math.round(inv.totalLocation).toLocaleString('fr-FR')} t CO2e` : 'calcul des scopes', state: st(3) },
    { id: 'rapport', title: 'Rapport ESG', sub: state.portal.reportPublished ? 'publié' : 'rédaction par le cabinet', state: st(4) },
  ];
}

/** Onglets du portail : ils s'ouvrent au fur et à mesure du dossier. */
export function portalTabs(state: AppState, inv: Inventory) {
  return {
    results: inv.results.length > 0,
    fleet: state.vehicles.length > 0,
    report: state.portal.reportPublished,
  };
}
