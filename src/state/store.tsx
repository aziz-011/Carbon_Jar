import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Activity, Budget, DocumentRecord, EmissionFactor, Entity, EsgYear, LcaStudy, Organization, PortalSettings, Target, Vehicle } from '../domain/types';
import { DEFAULT_FACTORS } from '../data/emissionFactors';
import { computeInventory, type Inventory } from '../lib/calc';
import { plateKey } from '../lib/documents/commit';
import { uid } from '../lib/format';
import { DEMO_ACTIVITIES, DEMO_BUDGETS, DEMO_DOCUMENTS, DEMO_ENTITIES, DEMO_ESG, DEMO_LCA, DEMO_ORG, DEMO_TARGETS, DEMO_VEHICLES } from './demo';

/** Données d'un client (une organisation dont on établit le bilan). */
export interface AppState {
  org: Organization;
  entities: Entity[];
  activities: Activity[];
  targets: Target[];
  /** Facteurs créés par l'utilisateur ou valeurs par défaut surchargées (même id). */
  customFactors: EmissionFactor[];
  documents: DocumentRecord[];
  vehicles: Vehicle[];
  budgets: Budget[];
  /** Indicateurs sociaux et de gouvernance par année. */
  esg: Record<number, EsgYear>;
  portal: PortalSettings;
  /** Analyse de cycle de vie du produit principal. */
  lca?: LcaStudy;
}

export interface ClientRecord {
  id: string;
  createdAt: string;
  state: AppState;
}

/** Espace de travail du cabinet : plusieurs clients, un client actif. */
export interface Workspace {
  firmName: string;
  activeId: string;
  clients: ClientRecord[];
  /** Version du dossier de démonstration chargée dans cet espace. */
  demoVersion?: number;
}

/** Incrémenté quand le dossier de démonstration est enrichi : il est alors rechargé une fois. */
export const DEMO_VERSION = 3;

export type Action =
  | { type: 'org'; patch: Partial<Organization> }
  | { type: 'entity:upsert'; entity: Entity }
  | { type: 'entity:delete'; id: string }
  | { type: 'activity:upsert'; activity: Activity }
  | { type: 'activity:addMany'; activities: Activity[] }
  | { type: 'activity:delete'; id: string }
  | { type: 'target:upsert'; target: Target }
  | { type: 'target:delete'; id: string }
  | { type: 'factor:upsert'; factor: EmissionFactor }
  | { type: 'factor:delete'; id: string }
  | { type: 'document:upsert'; document: DocumentRecord }
  | { type: 'document:delete'; id: string }
  | { type: 'document:validate'; documentId: string; activities: Activity[]; vehicle?: Vehicle; newVehicles?: Vehicle[] }
  | { type: 'document:reopen'; documentId: string }
  | { type: 'vehicle:upsert'; vehicle: Vehicle }
  | { type: 'vehicle:delete'; id: string }
  | { type: 'budget:upsert'; budget: Budget }
  | { type: 'budget:delete'; id: string }
  | { type: 'esg'; year: number; patch: Partial<EsgYear> }
  | { type: 'portal'; patch: Partial<PortalSettings> }
  | { type: 'lca'; study: LcaStudy }
  | { type: 'reset'; state: AppState };

export type WorkspaceAction =
  | { type: 'client'; action: Action }
  | { type: 'client:add'; client: ClientRecord; select?: boolean }
  | { type: 'client:select'; id: string }
  | { type: 'client:delete'; id: string }
  | { type: 'firm'; name: string }
  | { type: 'workspace:reset'; workspace: Workspace };

const STORAGE_KEY = 'carbon-jar:v3';
const LEGACY_KEY = 'carbon-jar:v2';
/** Texte des documents conservé avec les données (le fichier original est dans IndexedDB). */
const MAX_DOC_TEXT = 8000;

export const DEMO_STATE: AppState = {
  org: DEMO_ORG,
  entities: DEMO_ENTITIES,
  activities: DEMO_ACTIVITIES,
  targets: DEMO_TARGETS,
  customFactors: [],
  documents: DEMO_DOCUMENTS,
  vehicles: DEMO_VEHICLES,
  budgets: DEMO_BUDGETS,
  esg: DEMO_ESG,
  lca: DEMO_LCA,
  portal: {
    notApplicable: [],
    reportPublished: true,
    publishedAt: '2026-03-12T10:00:00.000Z',
    message: 'Votre bilan carbone 2025 est finalisé et votre rapport ESG est disponible. Pensez à déposer vos factures 2026 au fil de l’eau.',
  },
};

export function emptyState(name = 'Nouveau client'): AppState {
  const year = new Date().getFullYear() - 1;
  return {
    org: { ...DEMO_ORG, name, intensityMetric: {}, exclusions: '', reportingYear: year, baseYear: year, offsetsTco2e: 0, intensityMetricLabel: 'salarié' },
    entities: [{ id: uid(), name: 'Site principal', equityShare: 100, financialControl: true, operationalControl: true, country: 'TN' }],
    activities: [],
    targets: [],
    customFactors: [],
    documents: [],
    vehicles: [],
    budgets: [],
    esg: {},
    portal: { notApplicable: [], reportPublished: false },
  };
}

/** Compatibilité ascendante : complète un état enregistré par une version précédente. */
function normalizeState(s: Partial<AppState>): AppState {
  const base = emptyState();
  return {
    ...base,
    ...s,
    org: { ...base.org, ...(s.org ?? {}) },
    documents: s.documents ?? [],
    vehicles: s.vehicles ?? [],
    budgets: s.budgets ?? [],
    esg: s.esg ?? {},
    portal: { ...base.portal, ...(s.portal ?? {}) },
  } as AppState;
}

export function demoWorkspace(): Workspace {
  return {
    firmName: 'Mon cabinet de conseil',
    activeId: 'demo',
    demoVersion: DEMO_VERSION,
    clients: [{ id: 'demo', createdAt: new Date().toISOString(), state: DEMO_STATE }],
  };
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'org':
      return { ...state, org: { ...state.org, ...action.patch } };
    case 'entity:upsert':
      return { ...state, entities: upsert(state.entities, action.entity) };
    case 'entity:delete':
      return {
        ...state,
        entities: state.entities.filter((e) => e.id !== action.id),
        activities: state.activities.filter((a) => a.entityId !== action.id),
      };
    case 'activity:upsert':
      return { ...state, activities: upsert(state.activities, action.activity) };
    case 'activity:addMany':
      return { ...state, activities: [...state.activities, ...action.activities] };
    case 'activity:delete':
      return {
        ...state,
        activities: state.activities.filter((a) => a.id !== action.id),
        documents: state.documents.map((d) => (d.activityIds.includes(action.id) ? { ...d, activityIds: d.activityIds.filter((x) => x !== action.id) } : d)),
      };
    case 'target:upsert':
      return { ...state, targets: upsert(state.targets, action.target) };
    case 'target:delete':
      return { ...state, targets: state.targets.filter((t) => t.id !== action.id) };
    case 'factor:upsert':
      return { ...state, customFactors: upsert(state.customFactors, action.factor) };
    case 'factor:delete':
      return { ...state, customFactors: state.customFactors.filter((f) => f.id !== action.id) };
    case 'document:upsert': {
      const d = action.document;
      const text = d.text && d.text.length > MAX_DOC_TEXT ? d.text.slice(0, MAX_DOC_TEXT) : d.text;
      return { ...state, documents: upsert(state.documents, { ...d, text }) };
    }
    case 'document:delete': {
      const doc = state.documents.find((d) => d.id === action.id);
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.id),
        activities: state.activities.filter((a) => a.documentId !== action.id && !doc?.activityIds.includes(a.id)),
        vehicles: state.vehicles.map((v) => ({ ...v, documentIds: v.documentIds.filter((x) => x !== action.id) })),
      };
    }
    case 'document:validate': {
      let vehicle = action.vehicle;
      let activities = action.activities;
      if (vehicle) {
        // Même immatriculation déjà au registre : on complète la fiche existante.
        const same = state.vehicles.find((v) => v.id !== vehicle!.id && plateKey(v.plate) === plateKey(vehicle!.plate));
        if (same) {
          const defined = Object.fromEntries(Object.entries(vehicle).filter(([, v]) => v !== undefined && v !== 'autre'));
          vehicle = { ...same, ...defined, id: same.id, documentIds: [...new Set([...same.documentIds, ...vehicle.documentIds])] };
          activities = activities.map((a) => (a.vehicleId === action.vehicle!.id ? { ...a, vehicleId: same.id } : a));
        }
      }
      let vehicles = vehicle ? upsert(state.vehicles, vehicle) : state.vehicles;
      for (const nv of action.newVehicles ?? []) if (!vehicles.some((v) => plateKey(v.plate) === plateKey(nv.plate))) vehicles = [...vehicles, nv];
      return {
        ...state,
        vehicles,
        activities: [...state.activities.filter((a) => a.documentId !== action.documentId), ...activities],
        documents: state.documents.map((d) =>
          d.id === action.documentId ? { ...d, status: 'valide', activityIds: activities.map((a) => a.id), vehicleId: vehicle?.id ?? d.vehicleId } : d,
        ),
      };
    }
    case 'document:reopen':
      return {
        ...state,
        activities: state.activities.filter((a) => a.documentId !== action.documentId),
        documents: state.documents.map((d) => (d.id === action.documentId ? { ...d, status: 'a_valider', activityIds: [] } : d)),
      };
    case 'vehicle:upsert':
      return { ...state, vehicles: upsert(state.vehicles, action.vehicle) };
    case 'vehicle:delete':
      return { ...state, vehicles: state.vehicles.filter((v) => v.id !== action.id) };
    case 'budget:upsert':
      return { ...state, budgets: upsert(state.budgets, action.budget) };
    case 'budget:delete':
      return { ...state, budgets: state.budgets.filter((b) => b.id !== action.id) };
    case 'esg':
      return { ...state, esg: { ...state.esg, [action.year]: { ...(state.esg[action.year] ?? {}), ...action.patch } } };
    case 'portal':
      return { ...state, portal: { ...state.portal, ...action.patch } };
    case 'lca':
      return { ...state, lca: action.study };
    case 'reset':
      return normalizeState(action.state);
  }
}

export function workspaceReducer(ws: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'client':
      return { ...ws, clients: ws.clients.map((c) => (c.id === ws.activeId ? { ...c, state: reducer(c.state, action.action) } : c)) };
    case 'client:add':
      return { ...ws, clients: [...ws.clients, action.client], activeId: action.select ? action.client.id : ws.activeId };
    case 'client:select':
      return ws.clients.some((c) => c.id === action.id) ? { ...ws, activeId: action.id } : ws;
    case 'client:delete': {
      const clients = ws.clients.filter((c) => c.id !== action.id);
      if (clients.length === 0) {
        const fresh: ClientRecord = { id: uid(), createdAt: new Date().toISOString(), state: emptyState() };
        return { ...ws, clients: [fresh], activeId: fresh.id };
      }
      return { ...ws, clients, activeId: ws.activeId === action.id ? clients[0].id : ws.activeId };
    }
    case 'firm':
      return { ...ws, firmName: action.name };
    case 'workspace:reset':
      return action.workspace;
  }
}

function load(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const ws = JSON.parse(raw) as Workspace;
      if (Array.isArray(ws.clients) && ws.clients.length) {
        const clients = ws.clients.map((c) => ({ ...c, state: normalizeState(c.state) }));
        if ((ws.demoVersion ?? 1) < DEMO_VERSION) {
          // Nouvelle version du dossier de démonstration : il remplace l'ancien et s'ouvre ; les autres clients sont conservés.
          const demo: ClientRecord = { id: 'demo', createdAt: new Date().toISOString(), state: DEMO_STATE };
          const others = clients.filter((c) => c.id !== 'demo');
          return { ...ws, demoVersion: DEMO_VERSION, clients: [demo, ...others], activeId: 'demo' };
        }
        return { ...ws, clients, activeId: clients.some((c) => c.id === ws.activeId) ? ws.activeId : clients[0].id };
      }
    }
    // Reprise des données d'un seul client enregistrées par la version précédente.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as Partial<AppState>;
      if (s.org && Array.isArray(s.activities)) {
        return { firmName: 'Mon cabinet de conseil', activeId: 'legacy', clients: [{ id: 'legacy', createdAt: new Date().toISOString(), state: normalizeState(s) }] };
      }
    }
  } catch {
    // Stockage indisponible : on repart de la démonstration.
  }
  return demoWorkspace();
}

/** Fusionne les facteurs par défaut et ceux de l'utilisateur (un id identique remplace la valeur par défaut). */
export function mergeFactors(custom: EmissionFactor[]): EmissionFactor[] {
  const map = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));
  for (const f of custom) map.set(f.id, f);
  return [...map.values()];
}

export function computeYears(state: AppState): number[] {
  return [...new Set([...state.activities.map((a) => a.year), state.org.reportingYear, state.org.baseYear])].sort();
}

interface Store {
  state: AppState;
  dispatch: (action: Action) => void;
  factors: EmissionFactor[];
  factorById: Map<string, EmissionFactor>;
  /** Inventaire de l'année de reporting. */
  inventory: Inventory;
  inventoryFor: (year: number) => Inventory;
  years: number[];
  workspace: Workspace;
  wsDispatch: React.Dispatch<WorkspaceAction>;
  /** Le dernier enregistrement a échoué (stockage plein ou bloqué). */
  storageError: boolean;
}

const Ctx = createContext<Store | null>(null);

let storageError = false;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [workspace, wsDispatch] = useReducer(workspaceReducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      storageError = false;
    } catch {
      // Stockage plein ou bloqué : l'application reste utilisable en mémoire.
      storageError = true;
    }
  }, [workspace]);

  const active = workspace.clients.find((c) => c.id === workspace.activeId) ?? workspace.clients[0];
  const state = active.state;

  const value = useMemo<Store>(() => {
    const factors = mergeFactors(state.customFactors);
    const factorById = new Map(factors.map((f) => [f.id, f]));
    const cache = new Map<number, Inventory>();
    const inventoryFor = (year: number) => {
      let inv = cache.get(year);
      if (!inv) {
        inv = computeInventory(state.activities, factors, state.entities, state.org, year);
        cache.set(year, inv);
      }
      return inv;
    };
    const dispatch = (action: Action) => wsDispatch({ type: 'client', action });
    return {
      state,
      dispatch,
      factors,
      factorById,
      inventory: inventoryFor(state.org.reportingYear),
      inventoryFor,
      years: computeYears(state),
      workspace,
      wsDispatch,
      storageError,
    };
  }, [state, workspace]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return s;
}
