import type { Inventory } from './calc';
import { fmt, fmtPct } from './format';
import type { AppState } from '../state/store';

/**
 * Exigences de déclaration du GHG Protocol (Corporate Standard, chapitre 9) vérifiées sur le dossier.
 * Partagées par la page « Conformité GHG » du cabinet et la page « Conformité » du portail client.
 */
export interface ComplianceCheck {
  id: string;
  label: string;
  ok: boolean;
  /** Valeur constatée (affichée à droite). */
  detail: string;
  /** Explication simple de l'exigence, pour le client. */
  why: string;
  /** Ce que le client peut faire si l'exigence n'est pas satisfaite. */
  todo?: string;
  /** Exigence facultative au sens du GHG Protocol. */
  optional?: boolean;
}

const APPROACH_LABEL = { equity: 'Part de capital', financial: 'Contrôle financier', operational: 'Contrôle opérationnel' } as const;

export function complianceChecks(state: AppState, inv: Inventory, base: Inventory): ComplianceCheck[] {
  const { org } = state;
  const withEvidence = inv.results.length ? inv.results.filter((r) => r.activity.evidence).length / inv.results.length : 0;
  const gases = Object.keys(inv.byGasScope12).length;
  return [
    {
      id: 'perimetre',
      label: 'Périmètre organisationnel et approche de consolidation décrits',
      ok: state.entities.length > 0,
      detail: APPROACH_LABEL[org.consolidation],
      why: 'Les sites et filiales inclus dans le bilan, et la règle qui fixe la part de leurs émissions reprise.',
      todo: 'Indiquez-nous la liste de vos sites et filiales.',
    },
    {
      id: 'scopes12',
      label: 'Scopes 1 et 2 déclarés séparément',
      ok: inv.scope1 > 0 && inv.scope2Location > 0,
      detail: `${fmt(inv.scope1)} t / ${fmt(inv.scope2Location)} t`,
      why: 'Vos émissions directes (combustibles, véhicules, climatisation) et celles de l’électricité achetée sont publiées à part.',
      todo: 'Déposez vos factures de gaz, de carburant et d’électricité.',
    },
    {
      id: 'gaz',
      label: 'Ventilation des Scopes 1 et 2 par gaz',
      ok: gases > 0,
      detail: `${gases} gaz`,
      why: 'Le CO2, le méthane, le protoxyde d’azote et les gaz fluorés sont présentés séparément.',
    },
    {
      id: 'scope2',
      label: 'Scope 2 en double reporting (location / market)',
      ok: inv.scope2Location > 0,
      detail: `${fmt(inv.scope2Location)} / ${fmt(inv.scope2Market)} t`,
      why: 'L’électricité est calculée avec le facteur du réseau STEG et avec vos contrats d’énergie verte éventuels.',
      todo: 'Déposez vos factures STEG et, le cas échéant, vos contrats d’énergie renouvelable.',
    },
    {
      id: 'biogenique',
      label: 'CO2 biogénique déclaré séparément',
      ok: true,
      detail: `${fmt(inv.biogenicT)} t`,
      why: 'Le CO2 issu de la biomasse (bois, biogaz) est indiqué à part, hors scopes.',
    },
    {
      id: 'base',
      label: 'Année de base et profil historique',
      ok: base.results.length > 0,
      detail: String(org.baseYear),
      why: 'Une année de référence permet de mesurer vos progrès dans le temps.',
      todo: 'Transmettez-nous vos factures de l’année de référence.',
    },
    {
      id: 'prg',
      label: 'Source des PRG indiquée',
      ok: true,
      detail: org.gwpSet,
      why: 'Les coefficients du GIEC utilisés pour convertir chaque gaz en CO2e sont cités.',
    },
    {
      id: 'exclusions',
      label: 'Exclusions documentées et justifiées',
      ok: org.exclusions.trim().length > 0,
      detail: org.exclusions ? 'oui' : 'à compléter',
      why: 'Toute source non comptée est listée avec sa justification.',
      todo: 'Signalez-nous les activités que vous n’avez pas pu documenter.',
    },
    {
      id: 'audit',
      label: 'Piste d’audit : justificatifs rattachés',
      ok: withEvidence >= 0.8,
      detail: fmtPct(withEvidence),
      why: 'Chaque donnée renvoie à sa pièce justificative (facture, relevé, registre), ce qui permet une vérification externe.',
      todo: 'Déposez les justificatifs manquants dans « Documents à fournir ».',
    },
    {
      id: 'credits',
      label: 'Crédits carbone non soustraits des émissions brutes',
      ok: true,
      detail: `${fmt(org.offsetsTco2e)} t déclarées à part`,
      why: 'D’éventuels crédits de compensation sont mentionnés à part et ne réduisent pas les émissions déclarées.',
    },
    {
      id: 'scope3',
      label: 'Scope 3 (optionnel, exigé par la CSRD si matériel)',
      ok: inv.scope3 > 0,
      detail: `${fmt(inv.scope3)} t`,
      why: 'Les émissions de votre chaîne de valeur : achats, transport, déplacements, déchets, trajets des salariés.',
      todo: 'Déposez vos billets, factures d’eau, bordereaux de déchets et extractions d’achats.',
      optional: true,
    },
  ];
}
