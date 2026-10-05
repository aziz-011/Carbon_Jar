import type { Activity, Budget, Entity, EsgYear, Organization, Target, Vehicle } from '../domain/types';

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

function yearData(year: number, k: number): Activity[] {
  return [
    a(year, 'usine', 'ng_kwh', 5200000 * k, { description: 'Gaz naturel — chaudières vapeur', evidence: 'Factures STEG gaz', cost: 470000 * k }),
    a(year, 'usine', 'process_co2_measured', 850 * k, { description: 'CO2 des réactions chimiques', quality: 1, evidence: 'Mesure CEMS' }),
    a(year, 'usine', 'diesel_vehicle', 42000 * k, { description: 'Camions de livraison détenus', evidence: 'Cartes carburant' }),
    a(year, 'usine', 'lpg_forklift', 6500, { description: 'Chariots élévateurs GPL', evidence: 'Livraisons GPL' }),
    a(year, 'usine', 'refrigerant_R-404A', year === 2024 ? 18 : 9, { description: 'Recharge groupe froid R-404A', evidence: 'Registre maintenance' }),
    a(year, 'usine', 'generator_diesel', 1800, { description: 'Groupe électrogène — essais', quality: 3 }),
    a(year, 'usine', 'elec_TN', 3800000 * k, { description: 'Électricité réacteurs et pompes', evidence: 'Factures STEG', cost: 1140000 * k }),
    a(year, 'siege', 'elec_TN', 220000, { description: 'Électricité bureaux', evidence: 'Factures STEG' }),
    a(year, 'siege', 'refrigerant_R-410A', year === 2024 ? 6 : 4, { description: 'Recharge climatisation bureaux R-410A', evidence: 'Registre maintenance' }),
    a(year, 'usine', 'petrochem', 2100000 * k, { description: 'Matières premières pétrochimiques', quality: 3, evidence: 'ERP achats' }),
    a(year, 'usine', 'steel', 120000, { description: 'Acier (cuves, tuyauterie)', quality: 3 }),
    a(year, 'usine', 'freight_road', 1900000 * k, { description: 'Transport par prestataire externe', quality: 3 }),
    a(year, 'usine', 'waste_landfill', 140, { description: 'Déchets industriels banals', evidence: 'Bordereaux' }),
    a(year, 'siege', 'flight_medium', 180000, { description: 'Déplacements professionnels avion', evidence: 'Agence de voyage' }),
    a(year, 'siege', 'train_avg', 40000, { description: 'Déplacements professionnels train (SNCFT)' }),
    a(year, 'usine', 'commute_car', 1350000, { description: 'Trajets domicile-travail (enquête)', quality: 4 }),
    a(year, 'usine', 'spend_services', 2200000, { description: 'Prestations de services', quality: 4, cost: 2200000 }),
    a(year, 'jv', 'ng_kwh', 2400000, { description: 'Gaz naturel coentreprise', quality: 2 }),
    a(year, 'jv', 'elec_TN', 1500000, { description: 'Électricité coentreprise', quality: 2 }),
  ];
}

export const DEMO_ACTIVITIES: Activity[] = [...yearData(2024, 1), ...yearData(2025, 0.96)];

export const DEMO_TARGETS: Target[] = [
  { id: 't1', name: 'Scopes 1+2 : −42 % d’ici 2030', type: 'absolute', scopes: [1, 2], baseYear: 2024, targetYear: 2030, reductionPct: 42, scope2Method: 'market' },
  { id: 't2', name: 'Intensité Scope 1+2+3 : −30 % par tonne', type: 'intensity', scopes: [1, 2, 3], baseYear: 2024, targetYear: 2030, reductionPct: 30, scope2Method: 'location' },
];

export const DEMO_VEHICLES: Vehicle[] = [
  { id: 'v1', plate: '210 TU 4512', make: 'IVECO', model: 'Eurocargo', energy: 'gasoil', fiscalPower: 18, consumptionL100: 22, annualKm: 62000, entityId: 'usine', documentIds: [] },
  { id: 'v2', plate: '188 TU 903', make: 'RENAULT', model: 'Master', energy: 'gasoil', fiscalPower: 10, consumptionL100: 9.5, annualKm: 41000, entityId: 'usine', documentIds: [] },
  { id: 'v3', plate: '231 TU 77', make: 'PEUGEOT', model: '308', energy: 'essence', fiscalPower: 7, consumptionL100: 6.4, annualKm: 23000, entityId: 'siege', documentIds: [] },
];

/** Budgets annuels : consommé / restant / projection. */
export const DEMO_BUDGETS: Budget[] = [
  { id: 'b1', name: 'Électricité STEG', year: 2025, metric: 'quantity', factorIds: ['elec_TN'], limit: 4_200_000 },
  { id: 'b2', name: 'Gazole de la flotte', year: 2025, metric: 'quantity', factorIds: ['diesel_vehicle'], limit: 45_000 },
  { id: 'b3', name: 'Émissions Scopes 1 + 2', year: 2025, metric: 'emissions', scopes: [1, 2], limit: 4_000 },
  { id: 'b4', name: 'Budget énergie (TND)', year: 2025, metric: 'cost', scopes: [1, 2], limit: 2_400_000 },
];

export const DEMO_ESG: Record<number, EsgYear> = {
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
    esgCommittee: false,
    whistleblowing: false,
    iso14001: true,
    iso45001: false,
    iso50001: false,
    dataPrivacy: true,
  },
};
