import type { IconName } from '../components/Icon';
import type { DocType } from '../domain/types';

export const DOC_TYPE_ICON: Record<DocType, IconName> = {
  facture_electricite: 'zap',
  facture_gaz: 'flame',
  facture_carburant: 'fuel',
  carte_grise: 'car',
  fiche_vehicule: 'car',
  facture_eau: 'droplet',
  billet_transport: 'plane',
  bordereau_dechets: 'recycle',
  registre_fluides: 'snowflake',
  facture_achat: 'cart',
  autre: 'file',
};
