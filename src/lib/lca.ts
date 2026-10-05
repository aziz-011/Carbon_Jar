import type { IconName } from '../components/Icon';
import type { ActivityResult, CategoryId, EmissionFactor, GwpSet, LcaFlow, LcaPhase, LcaStage, LcaStudy, Organization } from '../domain/types';
import { factorKgCO2ePerUnit } from './calc';
import { uid } from './format';

/**
 * Analyse de cycle de vie simplifiée, conduite selon les 4 phases des normes ISO 14040/14044 :
 *  1. définition des objectifs et du périmètre (unité fonctionnelle, frontières du système) ;
 *  2. inventaire des flux (matières, énergie, émissions) rapportés à l'unité fonctionnelle ;
 *  3. évaluation des impacts (changement climatique, énergie, eau, déchets) ;
 *  4. interprétation (points chauds, sensibilité, complétude, recommandations).
 */

export const LCA_STAGES: Array<{ id: LcaStage; label: string; short: string; icon: IconName; text: string }> = [
  { id: 'extraction', label: 'Extraction des matières premières', short: 'Matières premières', icon: 'globe', text: 'Pétrole, minerais, bois : extraction et préparation des matières et de l’énergie en amont.' },
  { id: 'fabrication', label: 'Transformation et fabrication', short: 'Fabrication', icon: 'factory', text: 'Énergie, procédés, fluides et déchets de production sur les sites.' },
  { id: 'transport', label: 'Transport et distribution', short: 'Transport', icon: 'truck', text: 'Approvisionnement des matières et livraison des produits aux clients.' },
  { id: 'utilisation', label: 'Utilisation', short: 'Utilisation', icon: 'zap', text: 'Énergie consommée, maintenance et durée de vie du produit chez l’utilisateur.' },
  { id: 'fin_de_vie', label: 'Fin de vie', short: 'Fin de vie', icon: 'recycle', text: 'Réemploi, recyclage, valorisation énergétique ou mise en décharge.' },
];

export const LCA_PHASES: Array<{ id: LcaPhase; n: number; label: string; text: string }> = [
  { id: 'objectifs', n: 1, label: 'Objectifs et périmètre', text: 'Produit étudié, unité fonctionnelle, frontières du système, règles de coupure et d’allocation.' },
  { id: 'inventaire', n: 2, label: 'Inventaire des flux', text: 'Matières, énergie et émissions de chaque étape, rapportées à l’unité fonctionnelle.' },
  { id: 'impacts', n: 3, label: 'Évaluation des impacts', text: 'Conversion des flux en indicateurs d’impact et contribution de chaque étape.' },
  { id: 'interpretation', n: 4, label: 'Interprétation', text: 'Points chauds, analyse de sensibilité, limites et recommandations.' },
];

export const QUALITY_LABEL: Record<LcaFlow['quality'], string> = { mesuree: 'Mesurée', calculee: 'Calculée', estimee: 'Estimée' };

export function emptyLca(org?: Pick<Organization, 'intensityMetric' | 'reportingYear' | 'intensityMetricLabel'>): LcaStudy {
  return {
    product: '',
    functionalUnit: org?.intensityMetricLabel ? `1 ${org.intensityMetricLabel}` : '',
    annualUnits: org?.intensityMetric[org.reportingYear],
    goal: 'Mesurer l’empreinte carbone du produit sur son cycle de vie et identifier les étapes à améliorer en priorité.',
    audience: 'Direction et clients de l’entreprise (communication externe non comparative).',
    boundary: 'berceau_tombe',
    stages: LCA_STAGES.map((s) => s.id),
    cutoffPct: 1,
    allocation: 'Allocation massique entre coproduits ; méthode des stocks (cut-off) pour le recyclage.',
    method: 'Changement climatique : PRG à 100 ans du GIEC (kg CO2e) ; énergie, eau et déchets en flux d’inventaire.',
    flows: [],
    recommendations: [],
    validated: [],
    published: false,
  };
}

// ─────────────────────────────── Phase 3 : évaluation des impacts ───────────────────────────────

export interface FlowImpact {
  flow: LcaFlow;
  unit: string;
  label: string;
  source: string;
  kgPerUnit: number;
  kgCO2e: number;
  energyKwh: number;
  waterM3: number;
  wasteKg: number;
}

export interface LcaAssessment {
  flows: FlowImpact[];
  /** kg CO2e par unité fonctionnelle, par étape (hors bénéfices évités). */
  byStage: Record<LcaStage, number>;
  energyByStage: Record<LcaStage, number>;
  total: number;
  /** Bénéfices évités (module D), en kg CO2e (valeur positive = émissions évitées). */
  avoided: number;
  energyKwh: number;
  waterM3: number;
  wasteKg: number;
  /** Part des émissions issues de données estimées. */
  estimatedShare: number;
  /** Flux classés par contribution décroissante. */
  hotspots: FlowImpact[];
}

const zero = (): Record<LcaStage, number> => ({ extraction: 0, fabrication: 0, transport: 0, utilisation: 0, fin_de_vie: 0 });
const WASTE_CATEGORIES: CategoryId[] = ['S3_C5', 'S3_C12'];

export function flowImpact(flow: LcaFlow, factorById: Map<string, EmissionFactor>, gwpSet: GwpSet): FlowImpact {
  const f = flow.factorId ? factorById.get(flow.factorId) : undefined;
  const kgPerUnit = flow.customFactor ? flow.customFactor.kgCO2ePerUnit : f ? factorKgCO2ePerUnit(f, gwpSet) : 0;
  const unit = flow.customFactor?.unit ?? f?.unit ?? '';
  const q = flow.quantity || 0;
  const isWaste = !!f && WASTE_CATEGORIES.includes(f.category) && unit === 't';
  return {
    flow,
    unit,
    label: f?.label ?? 'Facteur spécifique',
    source: flow.customFactor?.source ?? f?.source ?? '—',
    kgPerUnit,
    kgCO2e: q * kgPerUnit,
    energyKwh: q * (f?.energyKwhPerUnit ?? 0),
    waterM3: unit === 'm³' && f?.id === 'water' ? q : 0,
    wasteKg: isWaste ? q * 1000 : 0,
  };
}

export function assessLca(study: LcaStudy, factorById: Map<string, EmissionFactor>, gwpSet: GwpSet): LcaAssessment {
  const flows = study.flows.filter((fl) => study.stages.includes(fl.stage)).map((fl) => flowImpact(fl, factorById, gwpSet));
  const counted = flows.filter((x) => !x.flow.avoided);
  const byStage = zero();
  const energyByStage = zero();
  for (const x of counted) {
    byStage[x.flow.stage] += x.kgCO2e;
    energyByStage[x.flow.stage] += x.energyKwh;
  }
  const total = counted.reduce((s, x) => s + x.kgCO2e, 0);
  const estimated = counted.filter((x) => x.flow.quality === 'estimee').reduce((s, x) => s + x.kgCO2e, 0);
  return {
    flows,
    byStage,
    energyByStage,
    total,
    avoided: flows.filter((x) => x.flow.avoided).reduce((s, x) => s + x.kgCO2e, 0),
    energyKwh: counted.reduce((s, x) => s + x.energyKwh, 0),
    waterM3: counted.reduce((s, x) => s + x.waterM3, 0),
    wasteKg: counted.reduce((s, x) => s + x.wasteKg, 0),
    estimatedShare: total > 0 ? estimated / total : 0,
    hotspots: [...counted].sort((a, b) => b.kgCO2e - a.kgCO2e),
  };
}

// ─────────────────────────────── Phase 4 : interprétation ───────────────────────────────

/** Sensibilité : effet d'une variation de ±20 % des trois flux les plus contributeurs sur le résultat. */
export function sensitivity(a: LcaAssessment, variation = 0.2): Array<{ impact: FlowImpact; deltaPct: number }> {
  if (a.total <= 0) return [];
  return a.hotspots.slice(0, 3).map((impact) => ({ impact, deltaPct: (impact.kgCO2e * variation) / a.total }));
}

export interface IsoCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** Contrôles de complétude, de cohérence et de qualité (ISO 14044 § 4.5.3). */
export function isoChecks(study: LcaStudy, a: LcaAssessment): IsoCheck[] {
  const missing = study.stages.filter((s) => !study.flows.some((f) => f.stage === s && !f.avoided));
  const belowCutoff = a.total > 0 ? a.hotspots.filter((x) => x.kgCO2e / a.total < study.cutoffPct / 100) : [];
  return [
    { label: 'Unité fonctionnelle définie', ok: study.functionalUnit.trim().length > 0 && study.product.trim().length > 0, detail: study.functionalUnit || 'à définir' },
    { label: 'Frontières du système décrites', ok: study.stages.length > 0, detail: study.boundary === 'berceau_tombe' ? 'Du berceau à la tombe' : 'Du berceau à la porte' },
    { label: 'Complétude : chaque étape incluse a au moins un flux', ok: missing.length === 0, detail: missing.length ? `manque : ${missing.map((m) => LCA_STAGES.find((s) => s.id === m)!.short.toLowerCase()).join(', ')}` : 'complet' },
    { label: 'Règle de coupure respectée', ok: true, detail: `${belowCutoff.length} flux sous ${study.cutoffPct} % conservés` },
    { label: 'Qualité des données : moins de 30 % d’émissions estimées', ok: a.estimatedShare < 0.3, detail: `${Math.round(a.estimatedShare * 100)} % estimées` },
    { label: 'Bénéfices évités déclarés à part (module D)', ok: true, detail: a.avoided > 0 ? 'oui, non soustraits' : 'aucun' },
    { label: 'Analyse de sensibilité réalisée', ok: a.total > 0, detail: '±20 % sur les 3 premiers flux' },
  ];
}

/** Constats automatiques proposés à l'ingénieur pour la phase d'interprétation. */
export function findings(study: LcaStudy, a: LcaAssessment): string[] {
  if (a.total <= 0) return [];
  const out: string[] = [];
  const stages = [...LCA_STAGES].filter((s) => study.stages.includes(s.id)).sort((x, y) => a.byStage[y.id] - a.byStage[x.id]);
  const top = stages[0];
  out.push(`L’étape « ${top.label} » concentre ${pct(a.byStage[top.id] / a.total)} de l’empreinte du produit.`);
  const h = a.hotspots[0];
  if (h) out.push(`Premier point chaud : « ${h.flow.description} » (${pct(h.kgCO2e / a.total)} du total).`);
  const s = sensitivity(a)[0];
  if (s) out.push(`Une variation de ±20 % de ce flux modifie le résultat de ±${pct(s.deltaPct)} : ${s.deltaPct > 0.05 ? 'la donnée doit être consolidée en priorité' : 'le résultat est robuste'}.`);
  if (a.avoided > 0) out.push(`Le recyclage en fin de vie permet d’éviter ${fmt1(a.avoided)} kg CO2e par unité fonctionnelle, déclarés à part (module D).`);
  if (a.estimatedShare >= 0.3) out.push(`${pct(a.estimatedShare)} des émissions reposent sur des données estimées : l’incertitude est élevée.`);
  return out;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;
const fmt1 = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

// ─────────────────────────────── Phase 2 : pré-remplissage ───────────────────────────────

/** Étape du cycle de vie correspondant à une catégorie du bilan carbone (undefined = hors périmètre produit). */
export function stageOfCategory(category: CategoryId, factor: EmissionFactor): LcaStage | undefined {
  if (factor.unit === 'TND') return undefined; // ratios monétaires : trop imprécis pour une ACV produit
  switch (category) {
    case 'S3_C1':
    case 'S3_C2':
    case 'S3_C3':
      return 'extraction';
    case 'S1_STATIONARY':
    case 'S1_PROCESS':
    case 'S1_FUGITIVE':
    case 'S2_ELECTRICITY':
    case 'S2_HEAT':
    case 'S2_STEAM':
    case 'S2_COOLING':
    case 'S3_C5':
      return 'fabrication';
    case 'S1_MOBILE':
      return factor.id === 'lpg_forklift' || factor.id === 'diesel_offroad' ? 'fabrication' : 'transport';
    case 'S3_C4':
    case 'S3_C9':
      return 'transport';
    case 'S3_C11':
      return 'utilisation';
    case 'S3_C12':
      return 'fin_de_vie';
    default:
      return undefined; // déplacements, trajets domicile-travail, investissements : frais généraux exclus
  }
}

/**
 * Construit l'inventaire à partir du bilan carbone de l'année : chaque donnée d'activité du périmètre
 * produit est divisée par la production annuelle pour obtenir une quantité par unité fonctionnelle.
 */
export function flowsFromInventory(results: ActivityResult[], annualUnits: number): LcaFlow[] {
  if (!(annualUnits > 0)) return [];
  const grouped = new Map<string, { stage: LcaStage; factor: EmissionFactor; qty: number; quality: number; descs: Set<string> }>();
  for (const r of results) {
    const stage = stageOfCategory(r.category, r.factor);
    if (!stage) continue;
    const key = `${stage}:${r.factor.id}`;
    const g = grouped.get(key) ?? { stage, factor: r.factor, qty: 0, quality: 0, descs: new Set<string>() };
    g.descs.add(r.activity.description?.split(' — ')[0] ?? r.factor.label);
    g.qty += r.activity.quantity * r.consolidationShare;
    g.quality = Math.max(g.quality, r.activity.quality);
    grouped.set(key, g);
  }
  return [...grouped.values()].filter((g) => g.qty > 0).map((g) => ({
    id: uid(),
    stage: g.stage,
    description: g.descs.size === 1 ? [...g.descs][0] : g.factor.label,
    factorId: g.factor.id,
    quantity: round(g.qty / annualUnits),
    quality: g.quality <= 2 ? 'mesuree' : g.quality === 3 ? 'calculee' : 'estimee',
    source: PREFILL_SOURCE,
  }));
}

export const PREFILL_SOURCE = 'Bilan carbone de l’année (données d’activité ÷ production annuelle)';

const round = (v: number) => (v >= 100 ? Math.round(v * 10) / 10 : Math.round(v * 10000) / 10000);
