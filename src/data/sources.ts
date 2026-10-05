import type { IconName } from '../components/Icon';
import type { CategoryId } from '../domain/types';

/** Libellés « grand public » des postes d'émission, pour le portail client et le rapport. */
export const SOURCE_OF: Record<CategoryId, { label: string; icon: IconName }> = {
  S1_STATIONARY: { label: 'Gaz et combustibles', icon: 'flame' },
  S1_MOBILE: { label: 'Carburant des véhicules', icon: 'fuel' },
  S1_FUGITIVE: { label: 'Climatisation et froid', icon: 'snowflake' },
  S1_PROCESS: { label: 'Procédés industriels', icon: 'factory' },
  S2_ELECTRICITY: { label: 'Électricité', icon: 'zap' },
  S2_HEAT: { label: 'Chaleur achetée', icon: 'flame' },
  S2_STEAM: { label: 'Vapeur achetée', icon: 'cloud' },
  S2_COOLING: { label: 'Froid acheté', icon: 'snowflake' },
  S3_C1: { label: 'Achats et eau', icon: 'cart' },
  S3_C2: { label: 'Équipements', icon: 'building' },
  S3_C3: { label: 'Amont de l’énergie', icon: 'zap' },
  S3_C4: { label: 'Transport des achats', icon: 'truck' },
  S3_C5: { label: 'Déchets', icon: 'recycle' },
  S3_C6: { label: 'Déplacements professionnels', icon: 'plane' },
  S3_C7: { label: 'Trajets domicile-travail', icon: 'car' },
  S3_C8: { label: 'Actifs loués', icon: 'building' },
  S3_C9: { label: 'Livraisons aux clients', icon: 'truck' },
  S3_C10: { label: 'Transformation des produits', icon: 'factory' },
  S3_C11: { label: 'Utilisation des produits', icon: 'zap' },
  S3_C12: { label: 'Fin de vie des produits', icon: 'recycle' },
  S3_C13: { label: 'Actifs loués à des tiers', icon: 'building' },
  S3_C14: { label: 'Franchises', icon: 'briefcase' },
  S3_C15: { label: 'Investissements', icon: 'briefcase' },
};
