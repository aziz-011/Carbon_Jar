/**
 * Modèle de données de la plateforme, aligné sur le GHG Protocol Corporate Standard
 * et le Scope 2 Guidance (2015).
 */

export type Scope = 1 | 2 | 3;

/** Gaz couverts par le GHG Protocol (Kyoto + NF3) et gaz hors Kyoto déclarés à part. */
export type KyotoGas = 'CO2' | 'CH4' | 'N2O' | 'HFC' | 'PFC' | 'SF6' | 'NF3';

/** Clé de ventilation : un gaz Kyoto, ou « CO2e » lorsque le facteur n'est disponible qu'agrégé. */
export type GasKey = KyotoGas | 'CO2e';

/** Jeu de PRG (pouvoir de réchauffement global) sur 100 ans du GIEC. */
export type GwpSet = 'AR5' | 'AR6';

/** Catégorie d'émission : Scope 1 (4 catégories), Scope 2 (4 flux), Scope 3 (15 catégories). */
export type CategoryId =
  // Scope 1
  | 'S1_STATIONARY'
  | 'S1_MOBILE'
  | 'S1_FUGITIVE'
  | 'S1_PROCESS'
  // Scope 2
  | 'S2_ELECTRICITY'
  | 'S2_HEAT'
  | 'S2_STEAM'
  | 'S2_COOLING'
  // Scope 3
  | 'S3_C1'
  | 'S3_C2'
  | 'S3_C3'
  | 'S3_C4'
  | 'S3_C5'
  | 'S3_C6'
  | 'S3_C7'
  | 'S3_C8'
  | 'S3_C9'
  | 'S3_C10'
  | 'S3_C11'
  | 'S3_C12'
  | 'S3_C13'
  | 'S3_C14'
  | 'S3_C15';

export interface Category {
  id: CategoryId;
  scope: Scope;
  label: string;
  description: string;
  /** Pour le Scope 3 : amont ou aval de la chaîne de valeur. */
  stream?: 'amont' | 'aval';
}

/**
 * Facteur d'émission : convertit une unité de donnée d'activité en GES.
 * Émissions = Donnée d'activité × Facteur d'émission.
 */
export interface EmissionFactor {
  id: string;
  label: string;
  category: CategoryId;
  /** Unité de la donnée d'activité (L, kWh, kg, t, km, p.km, t.km, €…). */
  unit: string;
  /**
   * Facteur décomposé par gaz, en kg de gaz par unité d'activité.
   * Permet la ventilation par gaz exigée pour le reporting des Scopes 1 et 2.
   */
  gases?: Partial<Record<'CO2' | 'CH4' | 'N2O' | 'SF6' | 'NF3', number>>;
  /** Pour les fluides frigorigènes : identifiant du fluide (PRG lu dans la table des PRG). */
  refrigerant?: string;
  /** Facteur agrégé en kg CO2e par unité, lorsque la décomposition par gaz n'est pas disponible. */
  co2e?: number;
  /** CO2 biogénique (kg/unité) : déclaré dans un poste mémo, hors scopes. */
  biogenicCO2?: number;
  /** Contenu énergétique (kWh par unité), pour suivre la consommation d'énergie. */
  energyKwhPerUnit?: number;
  /** Prix indicatif par unité (devise de l'organisation), utilisé si aucun coût n'est saisi. */
  defaultPrice?: number;
  /** Pour l'électricité : code pays/zone du réseau. */
  gridZone?: string;
  source: string;
  /** Mots-clés utilisés par le classificateur automatique. */
  keywords?: string[];
  /** Facteur créé par l'utilisateur. */
  custom?: boolean;
}

/** Instruments contractuels de la méthode market-based (hiérarchie du Scope 2 Guidance). */
export type MarketInstrument =
  | 'none' // pas d'instrument : mix résiduel ou, à défaut, moyenne réseau
  | 'ppa' // contrat direct / PPA avec attribut d'émission spécifique
  | 'eac' // certificat d'attribut énergétique : GO, REC, I-REC
  | 'supplier' // facteur spécifique du fournisseur
  | 'residual'; // facteur du mix résiduel

export type DataQuality = 1 | 2 | 3 | 4;

/** Donnée d'activité saisie par l'utilisateur. */
export interface Activity {
  id: string;
  entityId: string;
  year: number;
  factorId: string;
  quantity: number;
  description?: string;
  /** Coût réel payé (devise de l'organisation). Si absent, estimé avec le prix par défaut. */
  cost?: number;
  /** Niveau de qualité : 1 mesure directe, 2 facture, 3 calcul équipement, 4 estimation/ratio. */
  quality: DataQuality;
  /** Source documentaire (facture, compteur…) pour la piste d'audit. */
  evidence?: string;
  // Scope 2 — méthode market-based
  instrument?: MarketInstrument;
  /** Facteur contractuel (kg CO2e/kWh) pour PPA / fournisseur / mix résiduel. */
  instrumentFactor?: number;
  /** Énergie achetée revendue à des utilisateurs finaux : exclue du Scope 2 (bascule en Scope 3). */
  resold?: boolean;
  /** Période de consommation (AAAA-MM-JJ), pour le suivi mensuel. */
  periodStart?: string;
  periodEnd?: string;
  /** Document justificatif à l'origine de la donnée. */
  documentId?: string;
  /** Véhicule concerné (combustion mobile). */
  vehicleId?: string;
}

export type ConsolidationApproach = 'equity' | 'financial' | 'operational';

/** Entité / site / filiale du périmètre organisationnel. */
export interface Entity {
  id: string;
  name: string;
  /** Part de capital détenue (0–100). */
  equityShare: number;
  financialControl: boolean;
  operationalControl: boolean;
  country: string;
}

export type TargetType = 'absolute' | 'intensity';

export interface Target {
  id: string;
  name: string;
  type: TargetType;
  scopes: Scope[];
  baseYear: number;
  targetYear: number;
  /** Réduction visée en % par rapport à l'année de base. */
  reductionPct: number;
  scope2Method: 'location' | 'market';
}

export interface Organization {
  name: string;
  sector: Sector;
  reportingYear: number;
  baseYear: number;
  consolidation: ConsolidationApproach;
  gwpSet: GwpSet;
  currency: string;
  /** Prix carbone interne (devise / tCO2e) pour évaluer l'exposition financière. */
  carbonPrice: number;
  /** Métrique d'activité pour le ratio d'intensité. */
  intensityMetricLabel: string;
  /** Valeur de la métrique par année. */
  intensityMetric: Record<number, number>;
  /** Sources exclues de l'inventaire, avec justification (principe d'exhaustivité). */
  exclusions: string;
  /** Crédits carbone (offsets) achetés, déclarés séparément, jamais soustraits. */
  offsetsTco2e: number;
}

export type Sector = 'industrie' | 'chimie' | 'agroalimentaire' | 'sante' | 'universite' | 'services' | 'commerce' | 'transport' | 'autre';

/** Résultat de calcul pour une activité. */
export interface ActivityResult {
  activity: Activity;
  factor: EmissionFactor;
  entity: Entity | undefined;
  scope: Scope;
  category: CategoryId;
  /** Coefficient de consolidation appliqué (0–1). */
  consolidationShare: number;
  /** Ventilation par gaz en kg CO2e (méthode location-based pour le Scope 2). */
  byGas: Partial<Record<GasKey, number>>;
  /** Total kg CO2e (location-based pour le Scope 2). */
  kgCO2e: number;
  /** Scope 2 market-based (kg CO2e). Égal au location-based hors Scope 2. */
  kgCO2eMarket: number;
  /** CO2 biogénique, poste mémo (kg). */
  biogenicKg: number;
  /** Émissions de gaz hors Kyoto (ex. HCFC R-22), déclarées à part (kg CO2e). */
  nonKyotoKgCO2e: number;
  energyKwh: number;
  cost: number;
  costEstimated: boolean;
  /** Note expliquant un reclassement (ex. électricité revendue → Scope 3). */
  note?: string;
}

// ───────────────────────── Documents et pièces justificatives ─────────────────────────

/** Types de documents reconnus par la plateforme. */
export type DocType =
  | 'facture_electricite'
  | 'facture_gaz'
  | 'facture_carburant'
  | 'carte_grise'
  | 'fiche_vehicule'
  | 'facture_eau'
  | 'billet_transport'
  | 'bordereau_dechets'
  | 'registre_fluides'
  | 'facture_achat'
  | 'autre';

export type VehicleEnergy = 'gasoil' | 'essence' | 'gpl' | 'electrique' | 'hybride' | 'autre';

/** Ligne de consommation extraite d'un document, proposée pour l'inventaire. */
export interface ExtractedLine {
  description: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  factorId?: string;
  /** Confiance 0–1 de la classification. */
  confidence: number;
}

export interface ExtractedVehicle {
  plate?: string;
  make?: string;
  model?: string;
  energy?: VehicleEnergy;
  fiscalPower?: number;
  firstRegistration?: string;
  vin?: string;
  /** Consommation normalisée (L/100 km ou kWh/100 km pour l'électrique). */
  consumptionL100?: number;
  /** Émissions homologuées (g CO2/km). */
  co2gkm?: number;
}

export interface Extraction {
  docType: DocType;
  /** Méthode : lecture par Claude (IA), analyse du texte, ou saisie manuelle. */
  method: 'ia' | 'texte' | 'manuel';
  supplier?: string;
  documentNumber?: string;
  /** Date du document (AAAA-MM-JJ). */
  date?: string;
  /** Période de consommation (AAAA-MM-JJ). */
  periodStart?: string;
  periodEnd?: string;
  totalAmount?: number;
  currency?: string;
  lines: ExtractedLine[];
  vehicle?: ExtractedVehicle;
  confidence: number;
  warnings: string[];
}

export type DocumentStatus = 'a_valider' | 'valide' | 'rejete' | 'erreur';

export interface DocumentRecord {
  id: string;
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
  entityId: string;
  year: number;
  status: DocumentStatus;
  /** Texte extrait (tronqué) pour l'analyse et la piste d'audit. */
  text?: string;
  extraction?: Extraction;
  /** Données d'activité créées à la validation. */
  activityIds: string[];
  vehicleId?: string;
  error?: string;
  /** Document d'exemple fourni avec la démonstration. */
  sample?: boolean;
  /** Origine : déposé par le client sur son portail, ou par le cabinet. */
  source?: 'client' | 'cabinet';
  /** Rubrique de la liste des documents demandés. */
  requestId?: string;
}

/** Réglages du portail client. */
export interface PortalSettings {
  /** Rubriques que le client a déclarées « non concernées ». */
  notApplicable: string[];
  /** Le rapport ESG est publié sur le portail du client. */
  reportPublished: boolean;
  publishedAt?: string;
  /** Message du cabinet affiché sur l'accueil du portail. */
  message?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  make?: string;
  model?: string;
  energy: VehicleEnergy;
  fiscalPower?: number;
  firstRegistration?: string;
  consumptionL100?: number;
  co2gkm?: number;
  /** Kilométrage annuel (pour l'estimation lorsque les factures de carburant manquent). */
  annualKm?: number;
  entityId: string;
  documentIds: string[];
}

/** Budget de consommation ou d'émissions : consommé / restant / projection. */
export interface Budget {
  id: string;
  name: string;
  year: number;
  metric: 'emissions' | 'energy' | 'cost' | 'quantity';
  /** Filtre sur les scopes (émissions, énergie, coût). */
  scopes?: Scope[];
  /** Filtre sur les facteurs (obligatoire pour « quantité » : kWh, L…). */
  factorIds?: string[];
  limit: number;
}

/** Indicateurs sociaux et de gouvernance pour le rapport ESG (référentiels GRI / ESRS). */
export interface EsgYear {
  headcount?: number;
  womenPct?: number;
  womenManagersPct?: number;
  trainingHoursPerEmployee?: number;
  lostTimeAccidents?: number;
  frequencyRate?: number;
  severityRate?: number;
  turnoverPct?: number;
  disabledPct?: number;
  localPurchasingPct?: number;
  communityInvestment?: number;
  waterM3?: number;
  wasteTonnes?: number;
  wasteRecycledPct?: number;
  boardMembers?: number;
  independentBoardPct?: number;
  womenBoardPct?: number;
  ethicsCode?: boolean;
  antiCorruption?: boolean;
  csrPolicy?: boolean;
  esgCommittee?: boolean;
  whistleblowing?: boolean;
  iso14001?: boolean;
  iso45001?: boolean;
  iso50001?: boolean;
  dataPrivacy?: boolean;
  /** Synthèse exécutive rédigée (modifiable). */
  executiveSummary?: string;
  /** Engagements et prochaines étapes. */
  commitments?: string;
}
