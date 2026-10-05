import type { EsgYear, Organization } from '../domain/types';
import { getCategory } from '../data/categories';
import type { Inventory } from './calc';
import { intensityRatio } from './calc';
import { fmt, fmtPct } from './format';
import type { Recommendation } from './recommendations';

/** Correspondance des indicateurs avec les référentiels GRI et ESRS (CSRD). */
export const FRAMEWORK_MAP: Array<{ topic: string; gri: string; esrs: string; section: string }> = [
  { topic: 'Émissions directes (Scope 1)', gri: 'GRI 305-1', esrs: 'ESRS E1-6 §44(a)', section: '4.1' },
  { topic: 'Émissions indirectes liées à l’énergie (Scope 2)', gri: 'GRI 305-2', esrs: 'ESRS E1-6 §44(b)', section: '4.1' },
  { topic: 'Autres émissions indirectes (Scope 3)', gri: 'GRI 305-3', esrs: 'ESRS E1-6 §44(c)', section: '4.2' },
  { topic: 'Intensité des émissions', gri: 'GRI 305-4', esrs: 'ESRS E1-6 §53', section: '4.6' },
  { topic: 'Réduction des émissions et plan d’action', gri: 'GRI 305-5', esrs: 'ESRS E1-3', section: '4.9' },
  { topic: 'Objectifs de réduction', gri: 'GRI 305-5', esrs: 'ESRS E1-4', section: '4.8' },
  { topic: 'Consommation d’énergie', gri: 'GRI 302-1', esrs: 'ESRS E1-5', section: '4.4' },
  { topic: 'Consommation d’eau', gri: 'GRI 303-5', esrs: 'ESRS E3-4', section: '4.7' },
  { topic: 'Déchets générés', gri: 'GRI 306-3', esrs: 'ESRS E5-5', section: '4.7' },
  { topic: 'Effectifs et diversité', gri: 'GRI 2-7, 405-1', esrs: 'ESRS S1-6, S1-9', section: '5' },
  { topic: 'Formation', gri: 'GRI 404-1', esrs: 'ESRS S1-13', section: '5' },
  { topic: 'Santé et sécurité', gri: 'GRI 403-9', esrs: 'ESRS S1-14', section: '5' },
  { topic: 'Rotation du personnel', gri: 'GRI 401-1', esrs: 'ESRS S1-6', section: '5' },
  { topic: 'Achats locaux', gri: 'GRI 204-1', esrs: 'ESRS G1-2', section: '5' },
  { topic: 'Structure de gouvernance', gri: 'GRI 2-9', esrs: 'ESRS 2 GOV-1', section: '6' },
  { topic: 'Éthique et lutte contre la corruption', gri: 'GRI 2-23, 205-2', esrs: 'ESRS G1-1, G1-3', section: '6' },
  { topic: 'Dispositif d’alerte', gri: 'GRI 2-26', esrs: 'ESRS G1-1', section: '6' },
];

export const SOCIAL_FIELDS: Array<{ key: keyof EsgYear; label: string; unit: string; ref: string }> = [
  { key: 'headcount', label: 'Effectif total', unit: 'salariés', ref: 'GRI 2-7 · S1-6' },
  { key: 'womenPct', label: 'Part des femmes dans l’effectif', unit: '%', ref: 'GRI 405-1 · S1-9' },
  { key: 'womenManagersPct', label: 'Part des femmes parmi les cadres', unit: '%', ref: 'GRI 405-1 · S1-9' },
  { key: 'trainingHoursPerEmployee', label: 'Heures de formation par salarié', unit: 'h/an', ref: 'GRI 404-1 · S1-13' },
  { key: 'lostTimeAccidents', label: 'Accidents du travail avec arrêt', unit: 'nombre', ref: 'GRI 403-9 · S1-14' },
  { key: 'frequencyRate', label: 'Taux de fréquence', unit: 'acc./million h', ref: 'GRI 403-9 · S1-14' },
  { key: 'severityRate', label: 'Taux de gravité', unit: 'j/millier h', ref: 'GRI 403-9 · S1-14' },
  { key: 'turnoverPct', label: 'Taux de rotation du personnel', unit: '%', ref: 'GRI 401-1 · S1-6' },
  { key: 'disabledPct', label: 'Salariés en situation de handicap', unit: '%', ref: 'GRI 405-1 · S1-12' },
  { key: 'localPurchasingPct', label: 'Achats auprès de fournisseurs locaux', unit: '%', ref: 'GRI 204-1' },
  { key: 'communityInvestment', label: 'Investissement dans la communauté', unit: 'TND', ref: 'GRI 201-1' },
];

export const ENV_EXTRA_FIELDS: Array<{ key: keyof EsgYear; label: string; unit: string; ref: string }> = [
  { key: 'waterM3', label: 'Consommation d’eau', unit: 'm³', ref: 'GRI 303-5 · E3-4' },
  { key: 'wasteTonnes', label: 'Déchets générés', unit: 't', ref: 'GRI 306-3 · E5-5' },
  { key: 'wasteRecycledPct', label: 'Part des déchets valorisés', unit: '%', ref: 'GRI 306-4 · E5-5' },
];

export const GOVERNANCE_FIELDS: Array<{ key: keyof EsgYear; label: string; unit: string; ref: string }> = [
  { key: 'boardMembers', label: 'Membres du conseil d’administration', unit: 'nombre', ref: 'GRI 2-9 · GOV-1' },
  { key: 'independentBoardPct', label: 'Administrateurs indépendants', unit: '%', ref: 'GRI 2-9 · GOV-1' },
  { key: 'womenBoardPct', label: 'Femmes au conseil', unit: '%', ref: 'GRI 405-1 · GOV-1' },
];

export const GOVERNANCE_PRACTICES: Array<{ key: keyof EsgYear; label: string; ref: string }> = [
  { key: 'csrPolicy', label: 'Politique RSE / développement durable formalisée', ref: 'GRI 2-23 · G1-1' },
  { key: 'esgCommittee', label: 'Comité ou référent ESG au niveau de la direction', ref: 'GRI 2-12 · GOV-1' },
  { key: 'ethicsCode', label: 'Code d’éthique / de conduite', ref: 'GRI 2-23 · G1-1' },
  { key: 'antiCorruption', label: 'Dispositif de prévention de la corruption', ref: 'GRI 205-2 · G1-3' },
  { key: 'whistleblowing', label: 'Dispositif d’alerte (lanceurs d’alerte)', ref: 'GRI 2-26 · G1-1' },
  { key: 'dataPrivacy', label: 'Politique de protection des données personnelles', ref: 'GRI 418-1' },
  { key: 'iso14001', label: 'Certification ISO 14001 (environnement)', ref: 'E2 / E1' },
  { key: 'iso45001', label: 'Certification ISO 45001 (santé-sécurité)', ref: 'S1-14' },
  { key: 'iso50001', label: 'Certification ISO 50001 (énergie)', ref: 'E1-5' },
];

/**
 * Rédige une synthèse exécutive factuelle à partir des résultats (modifiable ensuite).
 * Chaque phrase s'appuie sur un chiffre calculé ; rien n'est inventé.
 */
export function buildExecutiveSummary(opts: {
  org: Organization;
  inv: Inventory;
  base?: Inventory;
  recos: Recommendation[];
  esg?: EsgYear;
}): string {
  const { org, inv, base, recos, esg } = opts;
  const y = org.reportingYear;
  const parts: string[] = [];
  const total = inv.totalLocation;
  if (total <= 0) return `Aucune donnée d’activité n’a encore été comptabilisée pour ${y}.`;
  const share = (v: number) => fmtPct(v / total);
  parts.push(
    `En ${y}, les émissions de gaz à effet de serre de ${org.name} s’élèvent à ${fmt(total)} t CO2e (Scope 2 selon la méthode location-based), dont ${fmt(inv.scope1)} t en Scope 1 (${share(inv.scope1)}), ${fmt(inv.scope2Location)} t en Scope 2 (${share(inv.scope2Location)}) et ${fmt(inv.scope3)} t en Scope 3 (${share(inv.scope3)}).` +
      (Math.abs(inv.scope2Market - inv.scope2Location) > 0.5 ? ` Selon la méthode market-based, le Scope 2 atteint ${fmt(inv.scope2Market)} t CO2e.` : ''),
  );
  const top = Object.entries(inv.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) {
    parts.push(`Les principaux postes sont : ${top.map(([id, t]) => `${getCategory(id as never).label.replace(/^\d+\.\s*/, '').toLowerCase()} (${fmt(t)} t, ${share(t)})`).join(', ')}.`);
  }
  if (inv.energyMWh > 0) {
    parts.push(`La consommation d’énergie atteint ${fmt(inv.energyMWh)} MWh pour un coût de ${fmt(inv.cost, 0)} ${org.currency}.`);
  }
  const intensity = intensityRatio(total, org.intensityMetric[y]);
  if (intensity !== undefined) parts.push(`L’intensité carbone est de ${fmt(intensity, 3)} t CO2e par ${org.intensityMetricLabel}.`);
  if (base && base.totalLocation > 0 && org.baseYear !== y) {
    const d = (total - base.totalLocation) / base.totalLocation;
    parts.push(`Par rapport à l’année de base ${org.baseYear} (${fmt(base.totalLocation)} t CO2e), les émissions ${d <= 0 ? 'diminuent' : 'augmentent'} de ${fmtPct(Math.abs(d), 1)}.`);
  }
  if (recos.length) {
    const low = recos.reduce((s, r) => s + r.reductionT[0], 0);
    const high = recos.reduce((s, r) => s + r.reductionT[1], 0);
    parts.push(
      `${recos.length} leviers de réduction ont été identifiés, pour un potentiel indicatif de ${fmt(low)} à ${fmt(high)} t CO2e par an ; les trois prioritaires sont : ${recos
        .slice(0, 3)
        .map((r) => r.title.toLowerCase())
        .join(' ; ')}.`,
    );
  }
  if (esg?.headcount) {
    parts.push(
      `Sur le plan social, l’organisation compte ${fmt(esg.headcount)} salariés${esg.womenPct !== undefined ? `, dont ${fmt(esg.womenPct)} % de femmes` : ''}${esg.trainingHoursPerEmployee !== undefined ? `, avec ${fmt(esg.trainingHoursPerEmployee)} heures de formation par salarié` : ''}.`,
    );
  }
  return parts.join(' ');
}
