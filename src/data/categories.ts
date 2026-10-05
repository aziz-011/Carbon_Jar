import type { Category, CategoryId, Scope } from '../domain/types';

/**
 * Catégories d'émissions.
 * Scope 1 : 4 catégories de sources (Corporate Standard, chap. 4 ; module de formation §4).
 * Scope 2 : 4 flux d'énergie achetée (Scope 2 Guidance ; module de formation §5.1).
 * Scope 3 : 15 catégories du Scope 3 Standard (amont / aval).
 */
export const CATEGORIES: Category[] = [
  { id: 'S1_STATIONARY', scope: 1, label: 'Combustion fixe', description: 'Chaudières, fours, turbines, groupes électrogènes, chauffage sur site.' },
  { id: 'S1_MOBILE', scope: 1, label: 'Combustion mobile', description: 'Véhicules et engins détenus ou contrôlés : camions, voitures, chariots élévateurs, engins de chantier.' },
  { id: 'S1_FUGITIVE', scope: 1, label: 'Émissions fugitives', description: 'Fuites de fluides frigorigènes (HFC), SF6 des équipements électriques, fuites de méthane.' },
  { id: 'S1_PROCESS', scope: 1, label: 'Procédés industriels', description: 'Réactions chimiques ou physiques du procédé : calcination, fermentation, électrolyse.' },

  { id: 'S2_ELECTRICITY', scope: 2, label: 'Électricité achetée', description: 'Électricité importée du réseau ou d’un tiers pour la consommation propre (y compris recharge des véhicules électriques).' },
  { id: 'S2_HEAT', scope: 2, label: 'Chaleur achetée', description: 'Réseau de chaleur urbain, chaufferie tierce.' },
  { id: 'S2_STEAM', scope: 2, label: 'Vapeur achetée', description: 'Vapeur industrielle produite par un tiers.' },
  { id: 'S2_COOLING', scope: 2, label: 'Froid acheté', description: 'Réseau de froid urbain, groupe frigorifique tiers.' },

  { id: 'S3_C1', scope: 3, stream: 'amont', label: '1. Biens et services achetés', description: 'Extraction, production et transport des biens et services achetés (matières premières, fournitures, prestations).' },
  { id: 'S3_C2', scope: 3, stream: 'amont', label: '2. Biens d’équipement', description: 'Fabrication des immobilisations : machines, bâtiments, matériel informatique.' },
  { id: 'S3_C3', scope: 3, stream: 'amont', label: '3. Activités liées aux combustibles et à l’énergie', description: 'Extraction/raffinage des combustibles, pertes en ligne (T&D), électricité achetée et revendue.' },
  { id: 'S3_C4', scope: 3, stream: 'amont', label: '4. Transport et distribution amont', description: 'Transport des achats par des prestataires externes.' },
  { id: 'S3_C5', scope: 3, stream: 'amont', label: '5. Déchets générés', description: 'Traitement des déchets des opérations (mise en décharge, incinération, recyclage).' },
  { id: 'S3_C6', scope: 3, stream: 'amont', label: '6. Déplacements professionnels', description: 'Avion, train, voiture de location, nuitées d’hôtel.' },
  { id: 'S3_C7', scope: 3, stream: 'amont', label: '7. Déplacements domicile-travail', description: 'Trajets des salariés entre domicile et lieu de travail, télétravail.' },
  { id: 'S3_C8', scope: 3, stream: 'amont', label: '8. Actifs loués (amont)', description: 'Actifs loués non inclus dans les Scopes 1 et 2.' },
  { id: 'S3_C9', scope: 3, stream: 'aval', label: '9. Transport et distribution aval', description: 'Transport des produits vendus vers les clients.' },
  { id: 'S3_C10', scope: 3, stream: 'aval', label: '10. Transformation des produits vendus', description: 'Transformation des produits intermédiaires par des tiers.' },
  { id: 'S3_C11', scope: 3, stream: 'aval', label: '11. Utilisation des produits vendus', description: 'Énergie consommée pendant l’usage des produits vendus.' },
  { id: 'S3_C12', scope: 3, stream: 'aval', label: '12. Fin de vie des produits vendus', description: 'Recyclage, incinération, mise en décharge des produits vendus.' },
  { id: 'S3_C13', scope: 3, stream: 'aval', label: '13. Actifs loués (aval)', description: 'Actifs détenus et loués à des tiers.' },
  { id: 'S3_C14', scope: 3, stream: 'aval', label: '14. Franchises', description: 'Émissions des franchisés.' },
  { id: 'S3_C15', scope: 3, stream: 'aval', label: '15. Investissements', description: 'Émissions des participations financières non consolidées.' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: CategoryId): Category {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Catégorie inconnue : ${id}`);
  return c;
}

export function categoriesOfScope(scope: Scope): Category[] {
  return CATEGORIES.filter((c) => c.scope === scope);
}

export const SCOPE_LABELS: Record<Scope, { title: string; short: string; description: string }> = {
  1: {
    title: 'Scope 1 — Émissions directes',
    short: 'Directes',
    description: 'Émissions provenant de sources détenues ou contrôlées par l’entreprise.',
  },
  2: {
    title: 'Scope 2 — Indirectes liées à l’énergie',
    short: 'Énergie achetée',
    description: 'Émissions liées à la production de l’électricité, de la chaleur, de la vapeur ou du froid achetés et consommés.',
  },
  3: {
    title: 'Scope 3 — Autres émissions indirectes',
    short: 'Chaîne de valeur',
    description: 'Toutes les autres émissions de la chaîne de valeur, en amont et en aval.',
  },
};
