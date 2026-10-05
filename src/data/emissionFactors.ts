import type { EmissionFactor } from '../domain/types';
import { REFRIGERANTS } from './gwp';

/**
 * Base de facteurs d'émission par défaut.
 *
 * Hiérarchie recommandée (module de formation §6.3) : facteur spécifique au site ou au
 * fournisseur > facteur national officiel (ADEME, DEFRA, EPA) > facteur générique
 * (GHG Protocol, GIEC). Les valeurs ci-dessous sont des valeurs par défaut documentées ;
 * remplacez-les par des facteurs spécifiques dès que possible (page « Facteurs d'émission »).
 *
 * Combustibles : facteurs par défaut des IPCC 2006 Guidelines (vol. 2), convertis par unité
 * commerciale à partir des pouvoirs calorifiques inférieurs (PCI) par défaut :
 *   gazole 36,1 MJ/L · essence 33,0 MJ/L · GPL 25,5 MJ/L · charbon 25,8 GJ/t · granulés 17 MJ/kg.
 */

const IPCC = 'GIEC 2006 Guidelines, valeurs par défaut (vol. 2)';
const GRID = 'Valeur indicative (IEA / ADEME / DEFRA) — à remplacer par le facteur officiel de votre pays';
const ADEME = 'Ordre de grandeur ADEME Base Empreinte — à affiner';
const DEFRA = 'Ordre de grandeur DEFRA conversion factors — à affiner';

/** Émissions par unité à partir d'un contenu énergétique (TJ/unité) et de facteurs IPCC en kg/TJ. */
function ipcc(tjPerUnit: number, co2: number, ch4: number, n2o: number) {
  return { CO2: tjPerUnit * co2, CH4: tjPerUnit * ch4, N2O: tjPerUnit * n2o };
}

const TJ_PER_KWH = 3.6e-6;
/** Les factures de gaz sont exprimées en kWh PCS ; PCI ≈ 0,9 × PCS. */
const TJ_PER_KWH_PCS = TJ_PER_KWH * 0.9;
const TJ_PER_L_DIESEL = 36.1e-6;
const TJ_PER_L_PETROL = 33.0e-6;
const TJ_PER_L_LPG = 25.5e-6;
const TJ_PER_T_COAL = 25.8e-3;
const TJ_PER_KG_PELLETS = 17e-6;
const TJ_PER_KG_WOOD = 15.6e-6;

const SCOPE1: EmissionFactor[] = [
  // ── Combustion fixe ─────────────────────────────────────────────
  {
    id: 'ng_kwh',
    label: 'Gaz naturel (chaudière, four)',
    category: 'S1_STATIONARY',
    unit: 'kWh PCS',
    gases: ipcc(TJ_PER_KWH_PCS, 56100, 5, 0.1),
    energyKwhPerUnit: 1,
    defaultPrice: 0.1,
    source: IPCC,
    keywords: ['gaz naturel', 'gaz de ville', 'natural gas', 'chaudiere gaz', 'grdf', 'chauffage gaz', 'four gaz'],
  },
  {
    id: 'ng_m3',
    label: 'Gaz naturel (en m³)',
    category: 'S1_STATIONARY',
    unit: 'm³',
    gases: ipcc(TJ_PER_KWH_PCS * 10.5, 56100, 5, 0.1),
    energyKwhPerUnit: 10.5,
    defaultPrice: 1.05,
    source: `${IPCC} — 10,5 kWh PCS/m³`,
    keywords: ['m3 gaz', 'metre cube gaz'],
  },
  {
    id: 'fuel_oil',
    label: 'Fioul domestique / gazole de chauffage',
    category: 'S1_STATIONARY',
    unit: 'L',
    gases: ipcc(TJ_PER_L_DIESEL, 74100, 10, 0.6),
    energyKwhPerUnit: 10.03,
    defaultPrice: 1.2,
    source: IPCC,
    keywords: ['fioul', 'fuel oil', 'mazout', 'heating oil', 'chaudiere fioul'],
  },
  {
    id: 'generator_diesel',
    label: 'Gazole — groupe électrogène',
    category: 'S1_STATIONARY',
    unit: 'L',
    gases: ipcc(TJ_PER_L_DIESEL, 74100, 3, 0.6),
    energyKwhPerUnit: 10.03,
    defaultPrice: 1.7,
    source: IPCC,
    keywords: ['groupe electrogene', 'generateur', 'generator', 'secours'],
  },
  {
    id: 'lpg_stationary',
    label: 'GPL / propane (chauffage, process)',
    category: 'S1_STATIONARY',
    unit: 'L',
    gases: ipcc(TJ_PER_L_LPG, 63100, 5, 0.1),
    energyKwhPerUnit: 7.08,
    defaultPrice: 1.0,
    source: IPCC,
    keywords: ['propane', 'butane', 'gpl chauffage', 'citerne'],
  },
  {
    id: 'coal',
    label: 'Charbon (bitumineux)',
    category: 'S1_STATIONARY',
    unit: 't',
    gases: ipcc(TJ_PER_T_COAL, 94600, 10, 1.5),
    energyKwhPerUnit: 7167,
    defaultPrice: 200,
    source: IPCC,
    keywords: ['charbon', 'coal', 'houille'],
  },
  {
    id: 'wood_pellets',
    label: 'Granulés de bois (biomasse)',
    category: 'S1_STATIONARY',
    unit: 'kg',
    gases: { CH4: TJ_PER_KG_PELLETS * 300, N2O: TJ_PER_KG_PELLETS * 4 },
    biogenicCO2: TJ_PER_KG_PELLETS * 112000,
    energyKwhPerUnit: 4.72,
    defaultPrice: 0.4,
    source: `${IPCC} — CO2 biogénique déclaré hors scopes`,
    keywords: ['granules', 'pellets', 'biomasse', 'chaudiere bois'],
  },
  {
    id: 'wood_logs',
    label: 'Bois bûche / plaquettes (biomasse)',
    category: 'S1_STATIONARY',
    unit: 'kg',
    gases: { CH4: TJ_PER_KG_WOOD * 300, N2O: TJ_PER_KG_WOOD * 4 },
    biogenicCO2: TJ_PER_KG_WOOD * 112000,
    energyKwhPerUnit: 4.33,
    defaultPrice: 0.15,
    source: `${IPCC} — CO2 biogénique déclaré hors scopes`,
    keywords: ['bois', 'buche', 'plaquettes', 'wood'],
  },
  // ── Combustion mobile ──────────────────────────────────────────
  {
    id: 'diesel_vehicle',
    label: 'Gazole — véhicules de la flotte',
    category: 'S1_MOBILE',
    unit: 'L',
    gases: ipcc(TJ_PER_L_DIESEL, 74100, 3.9, 3.9),
    energyKwhPerUnit: 10.03,
    defaultPrice: 1.7,
    source: IPCC,
    keywords: ['gazole', 'diesel', 'carte carburant', 'flotte', 'camion', 'poids lourd', 'utilitaire', 'gasoil'],
  },
  {
    id: 'petrol_vehicle',
    label: 'Essence — véhicules de la flotte',
    category: 'S1_MOBILE',
    unit: 'L',
    gases: ipcc(TJ_PER_L_PETROL, 69300, 25, 8),
    energyKwhPerUnit: 9.17,
    defaultPrice: 1.8,
    source: IPCC,
    keywords: ['essence', 'petrol', 'gasoline', 'sp95', 'sp98', 'e10', 'sans plomb'],
  },
  {
    id: 'lpg_forklift',
    label: 'GPL — chariots élévateurs / engins',
    category: 'S1_MOBILE',
    unit: 'L',
    gases: ipcc(TJ_PER_L_LPG, 63100, 62, 0.2),
    energyKwhPerUnit: 7.08,
    defaultPrice: 1.0,
    source: IPCC,
    keywords: ['chariot', 'elevateur', 'forklift', 'gpl carburant', 'engin'],
  },
  {
    id: 'diesel_offroad',
    label: 'Gazole non routier (engins de chantier, agricoles)',
    category: 'S1_MOBILE',
    unit: 'L',
    gases: ipcc(TJ_PER_L_DIESEL, 74100, 4.15, 28.6),
    energyKwhPerUnit: 10.03,
    defaultPrice: 1.4,
    source: IPCC,
    keywords: ['gnr', 'non routier', 'tracteur', 'chantier', 'pelleteuse'],
  },
  // ── Procédés ──────────────────────────────────────────────────
  {
    id: 'process_clinker',
    label: 'Production de clinker (calcination)',
    category: 'S1_PROCESS',
    unit: 't',
    gases: { CO2: 520 },
    source: 'GIEC 2006, vol. 3, chap. 2 — 0,52 t CO2/t clinker',
    keywords: ['clinker', 'ciment', 'cimenterie'],
  },
  {
    id: 'process_limestone',
    label: 'Décarbonatation de calcaire (CaCO3)',
    category: 'S1_PROCESS',
    unit: 't',
    gases: { CO2: 439.7 },
    source: 'GIEC 2006, vol. 3 — stœchiométrie 0,4397 t CO2/t CaCO3',
    keywords: ['calcaire', 'chaux', 'limestone', 'carbonate'],
  },
  {
    id: 'process_co2_measured',
    label: 'CO2 de procédé mesuré (réaction chimique, CEMS)',
    category: 'S1_PROCESS',
    unit: 't CO2',
    gases: { CO2: 1000 },
    source: 'Mesure directe sur site',
    keywords: ['reaction chimique', 'procede', 'cems', 'co2 procede'],
  },
  {
    id: 'process_n2o',
    label: 'N2O de procédé (acide nitrique, adipique…)',
    category: 'S1_PROCESS',
    unit: 'kg N2O',
    gases: { N2O: 1 },
    source: 'Mesure ou bilan matière',
    keywords: ['acide nitrique', 'n2o', 'protoxyde'],
  },
  {
    id: 'methane_leak',
    label: 'Fuite de méthane (réseau gaz, biogaz)',
    category: 'S1_FUGITIVE',
    unit: 'kg CH4',
    gases: { CH4: 1 },
    source: 'Bilan massique / mesure',
    keywords: ['fuite methane', 'methane', 'ch4'],
  },
];

/** Fluides frigorigènes et SF6 : quantité fuitée (méthode du bilan massique). */
const FUGITIVE: EmissionFactor[] = REFRIGERANTS.map((r) => ({
  id: `refrigerant_${r.id}`,
  label: `Fuite de fluide ${r.label}`,
  category: 'S1_FUGITIVE' as const,
  unit: 'kg',
  refrigerant: r.id,
  source: 'PRG GIEC — quantité fuitée = charge initiale + recharges − charge finale',
  keywords: [r.id.toLowerCase(), 'recharge', 'fluide frigorigene', 'climatisation', 'refrigerant', 'clim', 'groupe froid'],
}));

const GRID_FACTORS: Array<[string, string, number]> = [
  ['FR', 'France', 0.052],
  ['BE', 'Belgique', 0.15],
  ['DE', 'Allemagne', 0.38],
  ['ES', 'Espagne', 0.15],
  ['IT', 'Italie', 0.29],
  ['GB', 'Royaume-Uni', 0.207],
  ['EU', 'Union européenne (moyenne)', 0.25],
  ['MA', 'Maroc', 0.63],
  ['DZ', 'Algérie', 0.52],
  ['TN', 'Tunisie', 0.46],
  ['SN', 'Sénégal', 0.53],
  ['CI', 'Côte d’Ivoire', 0.44],
  ['CA', 'Canada (moyenne)', 0.12],
  ['QC', 'Québec', 0.002],
  ['US', 'États-Unis (moyenne)', 0.37],
  ['CN', 'Chine', 0.58],
  ['WORLD', 'Monde (moyenne)', 0.46],
];

export const GRID_ZONES = GRID_FACTORS.map(([code, name, value]) => ({ code, name, value }));

const SCOPE2: EmissionFactor[] = [
  ...GRID_FACTORS.map(([code, name, value]) => ({
    id: `elec_${code}`,
    label: `Électricité réseau — ${name}`,
    category: 'S2_ELECTRICITY' as const,
    unit: 'kWh',
    co2e: value,
    energyKwhPerUnit: 1,
    defaultPrice: 0.2,
    gridZone: code,
    source: GRID,
    keywords: code === 'FR' ? ['electricite', 'electricity', 'edf', 'kwh', 'courant', 'recharge vehicule electrique', 'borne'] : [],
  })),
  {
    id: 'heat_network',
    label: 'Chaleur achetée (réseau de chaleur)',
    category: 'S2_HEAT',
    unit: 'kWh',
    co2e: 0.17,
    energyKwhPerUnit: 1,
    defaultPrice: 0.09,
    source: `${DEFRA} — remplacez par le contenu CO2 de votre réseau`,
    keywords: ['reseau de chaleur', 'chauffage urbain', 'district heating', 'chaleur achetee'],
  },
  {
    id: 'steam',
    label: 'Vapeur achetée',
    category: 'S2_STEAM',
    unit: 'kWh',
    co2e: 0.17,
    energyKwhPerUnit: 1,
    defaultPrice: 0.07,
    source: `${DEFRA} — remplacez par le facteur du fournisseur`,
    keywords: ['vapeur', 'steam'],
  },
  {
    id: 'cooling_network',
    label: 'Froid acheté (réseau de froid)',
    category: 'S2_COOLING',
    unit: 'kWh',
    co2e: 0.03,
    energyKwhPerUnit: 1,
    defaultPrice: 0.08,
    source: `${ADEME} — remplacez par le facteur du réseau`,
    keywords: ['reseau de froid', 'froid achete', 'district cooling', 'eau glacee'],
  },
];

const SCOPE3: EmissionFactor[] = [
  // 1. Biens et services achetés — données physiques
  { id: 'steel', label: 'Acier (primaire, moyenne mondiale)', category: 'S3_C1', unit: 'kg', co2e: 1.9, source: 'worldsteel — ordre de grandeur', keywords: ['acier', 'steel', 'tole', 'fer'] },
  { id: 'aluminium', label: 'Aluminium primaire', category: 'S3_C1', unit: 'kg', co2e: 8.6, source: 'Ordre de grandeur Europe — à affiner', keywords: ['aluminium', 'alu'] },
  { id: 'aluminium_recycled', label: 'Aluminium recyclé', category: 'S3_C1', unit: 'kg', co2e: 0.6, source: 'Ordre de grandeur — à affiner', keywords: ['aluminium recycle'] },
  { id: 'cement', label: 'Ciment', category: 'S3_C1', unit: 't', co2e: 600, source: ADEME, keywords: ['ciment', 'cement'] },
  { id: 'concrete', label: 'Béton prêt à l’emploi', category: 'S3_C1', unit: 't', co2e: 130, source: ADEME, keywords: ['beton', 'concrete'] },
  { id: 'plastic', label: 'Plastiques (PE / PP)', category: 'S3_C1', unit: 'kg', co2e: 2.0, source: ADEME, keywords: ['plastique', 'polyethylene', 'polypropylene', 'pe', 'pp', 'emballage plastique'] },
  { id: 'petrochem', label: 'Matières premières pétrochimiques (moyenne)', category: 'S3_C1', unit: 'kg', co2e: 2.0, source: ADEME, keywords: ['petrochimique', 'solvant', 'resine', 'matiere premiere chimique'] },
  { id: 'paper', label: 'Papier / carton', category: 'S3_C1', unit: 'kg', co2e: 0.9, source: ADEME, keywords: ['papier', 'carton', 'ramette', 'emballage carton'] },
  { id: 'glass', label: 'Verre', category: 'S3_C1', unit: 'kg', co2e: 0.85, source: ADEME, keywords: ['verre', 'glass'] },
  { id: 'water', label: 'Eau potable (adduction + traitement)', category: 'S3_C1', unit: 'm³', co2e: 0.42, defaultPrice: 4, source: DEFRA, keywords: ['eau', 'water', 'veolia', 'suez'] },
  { id: 'meal_standard', label: 'Repas (moyen, avec viande)', category: 'S3_C1', unit: 'repas', co2e: 2.0, defaultPrice: 12, source: ADEME, keywords: ['repas', 'cantine', 'restauration', 'dejeuner'] },
  { id: 'meal_veg', label: 'Repas végétarien', category: 'S3_C1', unit: 'repas', co2e: 0.5, defaultPrice: 10, source: ADEME, keywords: ['vegetarien'] },
  // 1. Ratios monétaires (approche « spend-based »)
  { id: 'spend_services', label: 'Prestations de services intellectuels (ratio monétaire)', category: 'S3_C1', unit: '€', co2e: 0.11, defaultPrice: 1, source: `${ADEME} — ratio monétaire`, keywords: ['conseil', 'honoraires', 'prestation', 'audit', 'formation', 'avocat', 'comptable', 'consulting'] },
  { id: 'spend_goods', label: 'Fournitures et biens manufacturés (ratio monétaire)', category: 'S3_C1', unit: '€', co2e: 0.45, defaultPrice: 1, source: `${ADEME} — ratio monétaire`, keywords: ['fournitures', 'achat', 'materiel', 'consommables', 'pieces'] },
  { id: 'spend_food', label: 'Achats alimentaires (ratio monétaire)', category: 'S3_C1', unit: '€', co2e: 0.6, defaultPrice: 1, source: `${ADEME} — ratio monétaire`, keywords: ['alimentaire', 'traiteur', 'nourriture'] },
  { id: 'spend_digital', label: 'Services numériques / cloud (ratio monétaire)', category: 'S3_C1', unit: '€', co2e: 0.15, defaultPrice: 1, source: `${ADEME} — ratio monétaire`, keywords: ['cloud', 'logiciel', 'saas', 'hebergement', 'licence'] },
  // 2. Biens d'équipement
  { id: 'laptop', label: 'Ordinateur portable (fabrication)', category: 'S3_C2', unit: 'unité', co2e: 156, defaultPrice: 1000, source: ADEME, keywords: ['ordinateur', 'laptop', 'pc portable'] },
  { id: 'smartphone', label: 'Smartphone (fabrication)', category: 'S3_C2', unit: 'unité', co2e: 39, defaultPrice: 400, source: ADEME, keywords: ['smartphone', 'telephone'] },
  { id: 'spend_capex', label: 'Machines et équipements (ratio monétaire)', category: 'S3_C2', unit: '€', co2e: 0.5, defaultPrice: 1, source: `${ADEME} — ratio monétaire`, keywords: ['machine', 'equipement', 'investissement', 'immobilisation'] },
  { id: 'spend_building', label: 'Construction / travaux (ratio monétaire)', category: 'S3_C2', unit: '€', co2e: 0.36, defaultPrice: 1, source: `${ADEME} — ratio monétaire`, keywords: ['travaux', 'construction', 'batiment', 'renovation'] },
  // 3. Amont de l'énergie
  { id: 'wtt_diesel', label: 'Amont du gazole (extraction, raffinage, transport)', category: 'S3_C3', unit: 'L', co2e: 0.61, source: DEFRA, keywords: ['amont carburant', 'well to tank', 'wtt'] },
  { id: 'wtt_gas', label: 'Amont du gaz naturel', category: 'S3_C3', unit: 'kWh PCS', co2e: 0.03, source: DEFRA, keywords: ['amont gaz'] },
  // 4 / 9. Transport de marchandises
  { id: 'freight_road', label: 'Fret routier (prestataire)', category: 'S3_C4', unit: 't.km', co2e: 0.107, source: DEFRA, keywords: ['transporteur', 'fret routier', 'livraison', 'messagerie', 'logistique'] },
  { id: 'freight_rail', label: 'Fret ferroviaire', category: 'S3_C4', unit: 't.km', co2e: 0.028, source: DEFRA, keywords: ['fret ferroviaire', 'wagon'] },
  { id: 'freight_sea', label: 'Fret maritime (conteneur)', category: 'S3_C4', unit: 't.km', co2e: 0.016, source: DEFRA, keywords: ['maritime', 'conteneur', 'bateau', 'container'] },
  { id: 'freight_air', label: 'Fret aérien', category: 'S3_C4', unit: 't.km', co2e: 1.1, source: DEFRA, keywords: ['fret aerien', 'air cargo'] },
  { id: 'freight_road_down', label: 'Transport aval vers clients (routier)', category: 'S3_C9', unit: 't.km', co2e: 0.107, source: DEFRA, keywords: ['expedition', 'livraison client'] },
  // 5. Déchets
  { id: 'waste_landfill', label: 'Déchets — mise en décharge', category: 'S3_C5', unit: 't', co2e: 467, source: DEFRA, keywords: ['decharge', 'enfouissement', 'ordures', 'dib', 'dechets'] },
  { id: 'waste_incineration', label: 'Déchets — incinération avec valorisation', category: 'S3_C5', unit: 't', co2e: 21, source: DEFRA, keywords: ['incineration'] },
  { id: 'waste_recycling', label: 'Déchets — recyclage', category: 'S3_C5', unit: 't', co2e: 21, source: DEFRA, keywords: ['recyclage', 'tri'] },
  { id: 'waste_compost', label: 'Déchets — compostage', category: 'S3_C5', unit: 't', co2e: 8.9, source: DEFRA, keywords: ['compost', 'biodechets'] },
  // 6. Déplacements professionnels
  { id: 'flight_short', label: 'Avion court-courrier (< 1 000 km)', category: 'S3_C6', unit: 'p.km', co2e: 0.258, source: `${ADEME} — avec traînées`, keywords: ['avion', 'vol', 'flight', 'billet avion', 'aerien'] },
  { id: 'flight_medium', label: 'Avion moyen-courrier (1 000–3 500 km)', category: 'S3_C6', unit: 'p.km', co2e: 0.187, source: `${ADEME} — avec traînées`, keywords: ['moyen courrier'] },
  { id: 'flight_long', label: 'Avion long-courrier (> 3 500 km)', category: 'S3_C6', unit: 'p.km', co2e: 0.152, source: `${ADEME} — avec traînées`, keywords: ['long courrier'] },
  { id: 'train_hs', label: 'Train grande vitesse (France)', category: 'S3_C6', unit: 'p.km', co2e: 0.0029, source: ADEME, keywords: ['tgv', 'sncf', 'train', 'ouigo'] },
  { id: 'train_avg', label: 'Train (moyenne européenne)', category: 'S3_C6', unit: 'p.km', co2e: 0.035, source: DEFRA, keywords: ['rail', 'oncf', 'sncft'] },
  { id: 'car_business', label: 'Voiture thermique (location, véhicule personnel)', category: 'S3_C6', unit: 'km', co2e: 0.17, source: DEFRA, keywords: ['location voiture', 'indemnites kilometriques', 'taxi', 'vtc', 'uber'] },
  { id: 'hotel_night', label: 'Nuitée d’hôtel', category: 'S3_C6', unit: 'nuit', co2e: 7, defaultPrice: 110, source: DEFRA, keywords: ['hotel', 'nuitee', 'hebergement'] },
  // 7. Domicile-travail
  { id: 'commute_car', label: 'Domicile-travail — voiture thermique', category: 'S3_C7', unit: 'km', co2e: 0.17, source: DEFRA, keywords: ['domicile travail', 'trajet salarie', 'navette'] },
  { id: 'commute_ev', label: 'Domicile-travail — voiture électrique', category: 'S3_C7', unit: 'km', co2e: 0.05, source: 'Ordre de grandeur — dépend du mix électrique', keywords: [] },
  { id: 'commute_bus', label: 'Domicile-travail — bus / car', category: 'S3_C7', unit: 'p.km', co2e: 0.1, source: DEFRA, keywords: ['bus', 'car'] },
  { id: 'commute_metro', label: 'Domicile-travail — métro / tramway', category: 'S3_C7', unit: 'p.km', co2e: 0.004, source: ADEME, keywords: ['metro', 'tram', 'rer'] },
  { id: 'commute_soft', label: 'Domicile-travail — vélo / marche', category: 'S3_C7', unit: 'km', co2e: 0, source: '—', keywords: ['velo', 'marche', 'trottinette'] },
  // 11 / 12. Utilisation et fin de vie des produits vendus
  { id: 'use_electricity', label: 'Électricité consommée par les produits vendus (durée de vie)', category: 'S3_C11', unit: 'kWh', co2e: 0.46, source: `${GRID} — mix monde`, keywords: ['utilisation produit', 'consommation produit vendu'] },
  { id: 'use_fuel', label: 'Carburant consommé par les produits vendus', category: 'S3_C11', unit: 'L', co2e: 2.68, source: IPCC, keywords: [] },
  { id: 'eol_landfill', label: 'Fin de vie des produits vendus — décharge', category: 'S3_C12', unit: 't', co2e: 467, source: DEFRA, keywords: ['fin de vie'] },
  { id: 'eol_recycling', label: 'Fin de vie des produits vendus — recyclage', category: 'S3_C12', unit: 't', co2e: 21, source: DEFRA, keywords: [] },
];

export const DEFAULT_FACTORS: EmissionFactor[] = [...SCOPE1, ...FUGITIVE, ...SCOPE2, ...SCOPE3];
