import type { Activity, Budget, DocumentRecord, Entity, EsgYear, LcaStudy, Organization, Target, Vehicle } from '../domain/types';
import { DEFAULT_FACTORS } from '../data/emissionFactors';
import { computeInventory } from '../lib/calc';
import { emptyLca, flowsFromInventory } from '../lib/lca';
import { buildDemoDocuments } from './demoDocuments';

/**
 * Jeu de données de démonstration : une entreprise chimique tunisienne (exemple du document
 * « GHG – Carbon accounting ») avec une usine, un siège et une coentreprise à 50 %
 * (cas « Holland Industries » du rapport de synthèse). Montants en dinars tunisiens (TND).
 */
export const DEMO_ORG: Organization = {
  name: 'ChimieDémo Tunisie SA',
  sector: 'chimie',
  reportingYear: 2025,
  baseYear: 2024,
  consolidation: 'operational',
  gwpSet: 'AR5',
  currency: 'TND',
  carbonPrice: 270,
  intensityMetricLabel: 'tonne de produit fini',
  intensityMetric: { 2024: 12000, 2025: 12600 },
  exclusions: 'Émissions de la cantine sous-traitée (non matérielles, < 0,5 % estimé).',
  offsetsTco2e: 0,
};

export const DEMO_ENTITIES: Entity[] = [
  { id: 'usine', name: 'Usine de Sfax', equityShare: 100, financialControl: true, operationalControl: true, country: 'TN' },
  { id: 'siege', name: 'Siège social (Tunis)', equityShare: 100, financialControl: true, operationalControl: true, country: 'TN' },
  { id: 'jv', name: 'Coentreprise BGB (50 %)', equityShare: 50, financialControl: false, operationalControl: false, country: 'TN' },
];

let n = 0;
const a = (year: number, entityId: string, factorId: string, quantity: number, extra: Partial<Activity> = {}): Activity => ({
  id: `demo-${++n}`,
  year,
  entityId,
  factorId,
  quantity,
  quality: 2,
  ...extra,
});

/** Année de référence 2024 : données annuelles consolidées par le cabinet. */
function baseYear(year: number): Activity[] {
  return [
    a(year, 'usine', 'ng_kwh', 5200000, { description: 'Gaz naturel — chaudières vapeur', evidence: 'Factures STEG gaz', cost: 470000 }),
    a(year, 'usine', 'process_co2_measured', 850, { description: 'CO2 des réactions chimiques', quality: 1, evidence: 'Mesure CEMS' }),
    a(year, 'usine', 'diesel_vehicle', 42000, { description: 'Camions de livraison détenus', evidence: 'Cartes carburant' }),
    a(year, 'siege', 'petrol_vehicle', 1500, { description: 'Véhicule de direction', evidence: 'Cartes carburant' }),
    a(year, 'usine', 'lpg_forklift', 6500, { description: 'Chariots élévateurs GPL', evidence: 'Livraisons GPL' }),
    a(year, 'usine', 'refrigerant_R-404A', 18, { description: 'Recharge groupe froid R-404A', evidence: 'Registre maintenance' }),
    a(year, 'usine', 'generator_diesel', 1800, { description: 'Groupe électrogène — essais', quality: 3 }),
    a(year, 'usine', 'elec_TN', 3800000, { description: 'Électricité réacteurs et pompes', evidence: 'Factures STEG', cost: 1140000 }),
    a(year, 'siege', 'elec_TN', 220000, { description: 'Électricité bureaux', evidence: 'Factures STEG' }),
    a(year, 'siege', 'refrigerant_R-410A', 6, { description: 'Recharge climatisation bureaux R-410A', evidence: 'Registre maintenance' }),
    a(year, 'usine', 'petrochem', 2100000, { description: 'Matières premières pétrochimiques', quality: 3, evidence: 'ERP achats' }),
    a(year, 'usine', 'steel', 120000, { description: 'Acier (cuves, tuyauterie)', quality: 3 }),
    a(year, 'usine', 'water', 19200, { description: 'Eau potable', evidence: 'Factures SONEDE' }),
    a(year, 'usine', 'waste_landfill', 140, { description: 'Déchets industriels banals', evidence: 'Bordereaux' }),
    a(year, 'siege', 'flight_medium', 180000, { description: 'Déplacements professionnels avion', evidence: 'Agence de voyage' }),
    ...common(year, 1),
  ];
}

/** Postes estimés ou consolidés par le cabinet (sans pièce déposée par le client). */
function common(year: number, k: number): Activity[] {
  return [
    a(year, 'usine', 'freight_road', 1900000 * k, { description: 'Transport par prestataire externe', quality: 3, evidence: 'Lettres de voiture du transporteur' }),
    a(year, 'siege', 'train_avg', 40000, { description: 'Déplacements professionnels train (SNCFT)', evidence: 'Notes de frais' }),
    a(year, 'usine', 'commute_car', 1350000, { description: 'Trajets domicile-travail (enquête)', quality: 4, evidence: 'Enquête mobilité salariés' }),
    a(year, 'usine', 'spend_services', 2200000, { description: 'Prestations de services', quality: 4, cost: 2200000, evidence: 'Grand livre comptable' }),
    a(year, 'jv', 'ng_kwh', 2400000, { description: 'Gaz naturel coentreprise', quality: 2, evidence: 'Reporting de la coentreprise' }),
    a(year, 'jv', 'elec_TN', 1500000, { description: 'Électricité coentreprise', quality: 2, evidence: 'Reporting de la coentreprise' }),
  ];
}

const DOCS_2025 = buildDemoDocuments();

export const DEMO_DOCUMENTS: DocumentRecord[] = DOCS_2025.documents;

export const DEMO_ACTIVITIES: Activity[] = [
  ...baseYear(2024),
  ...DOCS_2025.activities,
  a(2025, 'usine', 'process_co2_measured', 816, { description: 'CO2 des réactions chimiques', quality: 1, evidence: 'Mesure en continu (CEMS) — rapport annuel' }),
  ...common(2025, 0.96),
];

export const DEMO_TARGETS: Target[] = [
  { id: 't1', name: 'Scopes 1+2 : −42 % d’ici 2030', type: 'absolute', scopes: [1, 2], baseYear: 2024, targetYear: 2030, reductionPct: 42, scope2Method: 'market' },
  { id: 't2', name: 'Intensité Scope 1+2+3 : −30 % par tonne', type: 'intensity', scopes: [1, 2, 3], baseYear: 2024, targetYear: 2030, reductionPct: 30, scope2Method: 'location' },
];

export const DEMO_VEHICLES: Vehicle[] = DOCS_2025.vehicles;

/** Budgets annuels : consommé / restant / projection. */
export const DEMO_BUDGETS: Budget[] = [
  { id: 'b1', name: 'Électricité STEG', year: 2025, metric: 'quantity', factorIds: ['elec_TN'], limit: 4_200_000 },
  { id: 'b2', name: 'Gazole de la flotte', year: 2025, metric: 'quantity', factorIds: ['diesel_vehicle'], limit: 45_000 },
  { id: 'b3', name: 'Émissions Scopes 1 + 2', year: 2025, metric: 'emissions', scopes: [1, 2], limit: 4_000 },
  { id: 'b4', name: 'Budget énergie (TND)', year: 2025, metric: 'cost', scopes: [1, 2], limit: 2_400_000 },
];

export const DEMO_ESG: Record<number, EsgYear> = {
  2024: {
    headcount: 207,
    womenPct: 29,
    womenManagersPct: 19,
    trainingHoursPerEmployee: 14,
    lostTimeAccidents: 6,
    frequencyRate: 14.2,
    severityRate: 0.32,
    turnoverPct: 8.9,
    disabledPct: 1.0,
    localPurchasingPct: 58,
    communityInvestment: 30000,
    waterM3: 19200,
    wasteTonnes: 140,
    wasteRecycledPct: 0,
    boardMembers: 7,
    independentBoardPct: 14,
    womenBoardPct: 14,
    ethicsCode: true,
    antiCorruption: false,
    csrPolicy: false,
    esgCommittee: false,
    whistleblowing: false,
    iso14001: true,
    iso45001: false,
    iso50001: false,
    dataPrivacy: true,
  },
  2025: {
    headcount: 214,
    womenPct: 31,
    womenManagersPct: 22,
    trainingHoursPerEmployee: 18,
    lostTimeAccidents: 4,
    frequencyRate: 9.8,
    severityRate: 0.21,
    turnoverPct: 7.5,
    disabledPct: 1.4,
    localPurchasingPct: 64,
    communityInvestment: 45000,
    waterM3: 18500,
    wasteTonnes: 140,
    wasteRecycledPct: 38,
    boardMembers: 7,
    independentBoardPct: 29,
    womenBoardPct: 14,
    ethicsCode: true,
    antiCorruption: true,
    csrPolicy: true,
    esgCommittee: true,
    whistleblowing: true,
    iso14001: true,
    iso45001: true,
    iso50001: false,
    dataPrivacy: true,
    executiveSummary:
      `En 2025, ChimieDémo Tunisie SA a établi son bilan carbone complet à partir de ${DOCS_2025.documents.length} pièces justificatives (factures STEG, relevés de cartes carburant, cartes grises, registres de fluides, factures SONEDE, bordereaux de déchets). Les émissions directes et indirectes liées à l’énergie (Scopes 1 et 2) reculent par rapport à 2024, portées par la baisse de 4 % de la consommation de gaz et d’électricité de l’usine de Sfax et par la réduction de moitié des fuites de fluide frigorigène. Les achats de matières premières pétrochimiques restent le premier poste du Scope 3 et la priorité du plan d’action fournisseurs.`,
    commitments:
      '1. Installer 1,2 MWc de panneaux photovoltaïques en toiture de l’usine de Sfax d’ici 2027 (≈ 1 800 MWh/an autoproduits).\n2. Récupérer la chaleur des purges des chaudières vapeur (−8 % de gaz naturel).\n3. Remplacer le R-404A par un fluide à faible PRG (R-448A puis CO2 transcritique).\n4. Former les chauffeurs à l’écoconduite et renouveler deux camions par des modèles Euro VI.\n5. Engager une certification ISO 50001 du système de management de l’énergie en 2026.',
  },
};

/** ACV de la résine produite à Sfax : inventaire issu du bilan 2025, complété des étapes aval. */
function demoLca(): LcaStudy {
  const inv = computeInventory(DEMO_ACTIVITIES, DEFAULT_FACTORS, DEMO_ENTITIES, DEMO_ORG, 2025);
  const units = DEMO_ORG.intensityMetric[2025];
  const base = emptyLca(DEMO_ORG);
  const flows: LcaStudy['flows'] = [
    ...flowsFromInventory(inv.results, units),
    { id: 'lca-sea', stage: 'transport', description: 'Export vers l’Europe (porte-conteneurs Radès – Gênes)', factorId: 'freight_sea', quantity: 620, quality: 'calculee', source: 'Part export 40 % × 1 550 km' },
    { id: 'lca-road', stage: 'transport', description: 'Livraison clients par transporteur', factorId: 'freight_road_down', quantity: 180, quality: 'estimee', source: 'Distance moyenne 180 km' },
    { id: 'lca-use', stage: 'utilisation', description: 'Séchage du revêtement chez l’utilisateur', factorId: 'use_electricity', quantity: 45, quality: 'estimee', source: 'Fiche technique : 45 kWh par tonne appliquée' },
    { id: 'lca-eol-land', stage: 'fin_de_vie', description: 'Mise en décharge des supports revêtus', factorId: 'eol_landfill', quantity: 0.3, quality: 'calculee', source: 'Statistiques ANGed : 30 % de la masse appliquée finit en décharge' },
    { id: 'lca-eol-rec', stage: 'fin_de_vie', description: 'Recyclage des emballages et supports', factorId: 'eol_recycling', quantity: 0.4, quality: 'calculee', source: 'Statistiques ANGed : 40 % recyclés' },
    { id: 'lca-avoided', stage: 'fin_de_vie', description: 'Matière vierge évitée grâce au recyclage', factorId: 'plastic', quantity: 120, quality: 'estimee', avoided: true, source: 'Taux de substitution 30 %' },
  ];
  return {
    ...base,
    product: 'Résine de revêtement (production de l’usine de Sfax)',
    functionalUnit: '1 tonne de résine livrée et appliquée chez le client',
    annualUnits: units,
    goal: 'Quantifier l’empreinte carbone de la résine sur son cycle de vie, identifier les étapes à améliorer et répondre aux demandes de données carbone des clients européens (MACF / CBAM).',
    audience: 'Direction industrielle, service commercial export et clients européens (communication non comparative).',
    flows,
    conclusions:
      'L’empreinte de la résine est dominée par l’amont (matières premières pétrochimiques) et par l’énergie de fabrication (gaz des chaudières et électricité). Le transport et la fin de vie pèsent peu. Les résultats de fabrication reposent sur des données mesurées (factures, compteurs) ; l’amont et la fin de vie reposent sur des facteurs génériques et doivent être consolidés avec les fournisseurs.',
    recommendations: [
      'Obtenir des fournisseurs de matières pétrochimiques des déclarations environnementales (EPD) pour remplacer les facteurs génériques.',
      'Intégrer 20 % de matière recyclée ou biosourcée dans la formulation d’ici 2028.',
      'Récupérer la chaleur des purges des chaudières et installer le photovoltaïque en toiture pour réduire l’énergie de fabrication.',
      'Proposer aux clients une reprise des emballages pour augmenter le taux de recyclage en fin de vie.',
    ],
    validated: ['objectifs', 'inventaire', 'impacts', 'interpretation'],
    published: true,
    publishedAt: '2026-03-12T10:00:00.000Z',
  };
}

export const DEMO_LCA: LcaStudy = demoLca();
