import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Activity, EmissionFactor, Entity, Organization, Target } from '../domain/types';
import { DEFAULT_FACTORS } from '../data/emissionFactors';
import { computeInventory, type Inventory } from '../lib/calc';
import { DEMO_ACTIVITIES, DEMO_ENTITIES, DEMO_ORG, DEMO_TARGETS } from './demo';

export interface AppState {
  org: Organization;
  entities: Entity[];
  activities: Activity[];
  targets: Target[];
  /** Facteurs créés par l'utilisateur ou valeurs par défaut surchargées (même id). */
  customFactors: EmissionFactor[];
}

type Action =
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
  | { type: 'reset'; state: AppState };

// v2 : passage à la Tunisie (TND, réseau STEG) — les anciennes données de démonstration ne sont pas reprises.
const STORAGE_KEY = 'carbon-jar:v2';

export const DEMO_STATE: AppState = {
  org: DEMO_ORG,
  entities: DEMO_ENTITIES,
  activities: DEMO_ACTIVITIES,
  targets: DEMO_TARGETS,
  customFactors: [],
};

export const EMPTY_STATE: AppState = {
  org: { ...DEMO_ORG, name: 'Mon organisation', intensityMetric: {}, exclusions: '', reportingYear: new Date().getFullYear() - 1, baseYear: new Date().getFullYear() - 1 },
  entities: [{ id: 'principal', name: 'Site principal', equityShare: 100, financialControl: true, operationalControl: true, country: 'TN' }],
  activities: [],
  targets: [],
  customFactors: [],
};

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
      return { ...state, activities: state.activities.filter((a) => a.id !== action.id) };
    case 'target:upsert':
      return { ...state, targets: upsert(state.targets, action.target) };
    case 'target:delete':
      return { ...state, targets: state.targets.filter((t) => t.id !== action.id) };
    case 'factor:upsert':
      return { ...state, customFactors: upsert(state.customFactors, action.factor) };
    case 'factor:delete':
      return { ...state, customFactors: state.customFactors.filter((f) => f.id !== action.id) };
    case 'reset':
      return action.state;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.org && Array.isArray(parsed.activities)) return { ...DEMO_STATE, ...parsed };
    }
  } catch {
    // Stockage indisponible : on repart du jeu de démonstration.
  }
  return DEMO_STATE;
}

/** Fusionne les facteurs par défaut et ceux de l'utilisateur (un id identique remplace la valeur par défaut). */
export function mergeFactors(custom: EmissionFactor[]): EmissionFactor[] {
  const map = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));
  for (const f of custom) map.set(f.id, f);
  return [...map.values()];
}

interface Store {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  factors: EmissionFactor[];
  factorById: Map<string, EmissionFactor>;
  /** Inventaire de l'année de reporting. */
  inventory: Inventory;
  inventoryFor: (year: number) => Inventory;
  years: number[];
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Stockage plein ou bloqué : l'application reste utilisable en mémoire.
    }
  }, [state]);

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
    const years = [...new Set([...state.activities.map((a) => a.year), state.org.reportingYear, state.org.baseYear])].sort();
    return { state, dispatch, factors, factorById, inventory: inventoryFor(state.org.reportingYear), inventoryFor, years };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return s;
}
