import type { IconName } from '../components/Icon';
import type { DocType, Scope } from '../domain/types';

/**
 * Liste des documents demandés au client, organisée par scope du GHG Protocol.
 * Chaque rubrique indique ce qu'il faut fournir et vers quel scope les données sont classées.
 */
export interface DocumentRequest {
  id: string;
  scope: Scope | 'esg';
  icon: IconName;
  title: string;
  description: string;
  examples: string;
  docTypes: DocType[];
  /** Type proposé à l'analyse lorsque la reconnaissance automatique hésite. */
  hint: DocType;
  required: boolean;
}

export const DOCUMENT_REQUESTS: DocumentRequest[] = [
  {
    id: 'combustibles',
    scope: 1,
    icon: 'flame',
    title: 'Gaz, fioul et combustibles',
    description: 'Combustion dans vos chaudières, fours, groupes électrogènes.',
    examples: 'Factures STEG gaz, livraisons de fioul, GPL, propane',
    docTypes: ['facture_gaz'],
    hint: 'facture_gaz',
    required: true,
  },
  {
    id: 'carburant',
    scope: 1,
    icon: 'fuel',
    title: 'Carburant des véhicules',
    description: 'Gazole et essence de vos véhicules et engins.',
    examples: 'Tickets de station, relevés de cartes carburant (Agil, OLA, Shell…)',
    docTypes: ['facture_carburant'],
    hint: 'facture_carburant',
    required: true,
  },
  {
    id: 'vehicules',
    scope: 1,
    icon: 'car',
    title: 'Véhicules et kilométrage',
    description: 'Votre flotte : chaque véhicule détenu ou loué longue durée.',
    examples: 'Cartes grises, fiches techniques, relevés kilométriques',
    docTypes: ['carte_grise', 'fiche_vehicule'],
    hint: 'carte_grise',
    required: true,
  },
  {
    id: 'climatisation',
    scope: 1,
    icon: 'snowflake',
    title: 'Climatisation et froid',
    description: 'Recharges de fluides frigorigènes (fuites).',
    examples: 'Rapports d’intervention, registres de recharge (R-410A, R-404A…)',
    docTypes: ['registre_fluides'],
    hint: 'registre_fluides',
    required: true,
  },
  {
    id: 'electricite',
    scope: 2,
    icon: 'zap',
    title: 'Électricité',
    description: 'L’électricité achetée pour vos sites, sur les 12 mois de l’exercice.',
    examples: 'Factures STEG (basse ou moyenne tension), contrats d’énergie verte',
    docTypes: ['facture_electricite'],
    hint: 'facture_electricite',
    required: true,
  },
  {
    id: 'deplacements',
    scope: 3,
    icon: 'plane',
    title: 'Déplacements professionnels',
    description: 'Voyages en avion et en train, nuitées d’hôtel.',
    examples: 'Billets électroniques, factures d’agence de voyage, notes de frais',
    docTypes: ['billet_transport'],
    hint: 'billet_transport',
    required: false,
  },
  {
    id: 'eau',
    scope: 3,
    icon: 'droplet',
    title: 'Eau',
    description: 'Consommation d’eau potable.',
    examples: 'Factures SONEDE',
    docTypes: ['facture_eau'],
    hint: 'facture_eau',
    required: false,
  },
  {
    id: 'dechets',
    scope: 3,
    icon: 'recycle',
    title: 'Déchets',
    description: 'Déchets enlevés et leur traitement (décharge, recyclage).',
    examples: 'Bordereaux de suivi, attestations de collecte',
    docTypes: ['bordereau_dechets'],
    hint: 'bordereau_dechets',
    required: false,
  },
  {
    id: 'achats',
    scope: 3,
    icon: 'cart',
    title: 'Achats principaux',
    description: 'Matières premières et fournitures les plus importantes.',
    examples: 'Factures fournisseurs, extraction des achats de votre ERP',
    docTypes: ['facture_achat'],
    hint: 'facture_achat',
    required: false,
  },
];

export const SCOPE_INTROS: Record<Scope, { title: string; text: string }> = {
  1: { title: 'Scope 1 — Émissions directes', text: 'Ce que vous brûlez ou laissez fuir vous-même : chaudières, véhicules, climatisation.' },
  2: { title: 'Scope 2 — Énergie achetée', text: 'L’électricité (et la chaleur ou le froid) que vous achetez.' },
  3: { title: 'Scope 3 — Chaîne de valeur', text: 'Déplacements, eau, déchets et achats : émissions chez vos partenaires.' },
};
