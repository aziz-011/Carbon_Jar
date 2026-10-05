import type { ActivityResult, CategoryId, Scope } from '../domain/types';
import type { Inventory } from './calc';

/**
 * Moteur de recommandations : à partir de l'inventaire, identifie les postes les plus
 * émetteurs et propose des leviers de réduction chiffrés (t CO2e, MWh, coût).
 * Les potentiels sont des fourchettes indicatives issues de retours d'expérience
 * courants ; ils doivent être confirmés par une étude de faisabilité.
 */

export type Effort = 'faible' | 'moyen' | 'élevé';

export interface Recommendation {
  id: string;
  title: string;
  scope: Scope;
  categories: CategoryId[];
  description: string;
  actions: string[];
  effort: Effort;
  /** Émissions du poste concerné (t CO2e). */
  baselineT: number;
  /** Réduction estimée (t CO2e) : fourchette basse / haute. */
  reductionT: [number, number];
  /** Économie d'énergie estimée (MWh) : fourchette. */
  energySavedMWh: [number, number];
  /** Économie financière estimée (devise) : fourchette. Négatif = surcoût. */
  costSaved: [number, number];
  /** Remarque méthodologique (ex. effet uniquement market-based). */
  note?: string;
  /** Levier purement contractuel : réduit le Scope 2 market-based sans changer les émissions physiques. */
  marketOnly?: boolean;
}

interface Rule {
  id: string;
  title: string;
  description: string;
  actions: string[];
  effort: Effort;
  match: (r: ActivityResult) => boolean;
  /** Fourchette de réduction des émissions du poste (0–1). */
  emissionCut: [number, number] | ((rs: ActivityResult[], ctx: Context) => [number, number]);
  /** Fourchette d'économie d'énergie du poste (0–1). */
  energyCut?: [number, number];
  /** Fourchette d'économie de coût du poste (0–1). */
  costCut?: [number, number];
  /** Utiliser les émissions market-based comme base (leviers contractuels). */
  marketOnly?: boolean;
  note?: string;
}

interface Context {
  /** Facteur du réseau électrique (kg CO2e/kWh) de la zone principale de l'organisation. */
  gridFactor: number;
  /** Pays principal (code de zone réseau, ex. « TN ») pour adapter les conseils au contexte local. */
  country?: string;
}

/** Précisions propres au contexte tunisien, ajoutées aux leviers concernés. */
const TUNISIA_NOTES: Record<string, string> = {
  'solar-pv':
    'En Tunisie, l’ensoleillement élevé (de l’ordre de 1 600 à 1 800 kWh produits par kWc et par an) rend l’autoconsommation particulièrement rentable. Le cadre de l’autoproduction (loi n° 2015-12) et l’ANME accompagnent ces projets.',
  'electricity-efficiency':
    'En Tunisie, l’ANME accompagne les audits énergétiques (obligatoires au-delà de certains seuils de consommation) et les contrats-programmes d’efficacité énergétique.',
  'heat-efficiency': 'L’ANME peut cofinancer l’audit énergétique et les investissements d’efficacité thermique.',
  'renewable-contracts':
    'En Tunisie, le marché des garanties d’origine est peu développé : privilégiez l’autoproduction sur site ou un contrat d’achat direct avec un producteur renouvelable, avec des attributs traçables.',
};

const FOSSIL_HEAT = new Set(['ng_kwh', 'ng_m3', 'fuel_oil', 'lpg_stationary', 'coal']);
const FLEET = new Set(['diesel_vehicle', 'petrol_vehicle']);

/** Émissions par kWh de combustible (kg CO2e/kWh) d'un ensemble de résultats. */
function kgPerKwh(rs: ActivityResult[]): number {
  const kg = rs.reduce((s, r) => s + r.kgCO2e, 0);
  const kwh = rs.reduce((s, r) => s + r.energyKwh, 0);
  return kwh > 0 ? kg / kwh : 0;
}

const clamp = (x: number): number => Math.max(0, Math.min(1, x));

const RULES: Rule[] = [
  {
    id: 'heat-efficiency',
    title: 'Efficacité énergétique du chauffage et des procédés thermiques',
    description: 'Réduire la consommation de combustibles des chaudières et fours par la régulation, la maintenance et l’isolation.',
    actions: [
      'Régler et entretenir les brûleurs (analyse de combustion annuelle).',
      'Abaisser les consignes de température et programmer les réduits de nuit / week-end.',
      'Calorifuger les réseaux de vapeur et d’eau chaude, réparer les purgeurs défectueux.',
      'Récupérer la chaleur fatale (fumées, compresseurs, groupes froid).',
      'Isoler l’enveloppe des bâtiments (toiture, combles, menuiseries).',
    ],
    effort: 'faible',
    match: (r) => FOSSIL_HEAT.has(r.factor.id),
    emissionCut: [0.1, 0.25],
    energyCut: [0.1, 0.25],
    costCut: [0.1, 0.25],
  },
  {
    id: 'heat-pump',
    title: 'Électrifier la chaleur basse température (pompe à chaleur)',
    description: 'Remplacer les chaudières fossiles par des pompes à chaleur (COP ≈ 3) pour le chauffage et les besoins < 100 °C.',
    actions: [
      'Réaliser un audit énergétique pour dimensionner les besoins de chaleur par niveau de température.',
      'Installer des pompes à chaleur air/eau ou eau/eau, ou se raccorder à un réseau de chaleur bas carbone.',
      'Combiner avec la récupération de chaleur fatale.',
    ],
    effort: 'élevé',
    match: (r) => FOSSIL_HEAT.has(r.factor.id),
    emissionCut: (rs, ctx) => {
      // Émissions résiduelles = (énergie / COP) × facteur réseau.
      const fossil = kgPerKwh(rs);
      if (fossil <= 0) return [0, 0];
      const low = clamp(1 - ctx.gridFactor / 2.5 / fossil);
      const high = clamp(1 - ctx.gridFactor / 3.5 / fossil);
      return [low * 0.5, high * 0.8]; // part des besoins électrifiables
    },
    energyCut: [0.3, 0.55],
    costCut: [0.0, 0.3],
    note: 'Les émissions basculent du Scope 1 vers le Scope 2 ; le gain dépend du contenu carbone de l’électricité.',
  },
  {
    id: 'coal-switch',
    title: 'Sortir du charbon',
    description: 'Le charbon est le combustible le plus émissif par kWh. Le substituer par du gaz, de la biomasse durable ou de l’électricité.',
    actions: ['Étudier la conversion des chaudières au gaz naturel ou à la biomasse.', 'Planifier la sortie du charbon dans la trajectoire de réduction.'],
    effort: 'élevé',
    match: (r) => r.factor.id === 'coal',
    emissionCut: [0.4, 0.9],
  },
  {
    id: 'fleet-ecodriving',
    title: 'Éco-conduite et optimisation de la flotte',
    description: 'Réduire la consommation de carburant des véhicules détenus ou contrôlés.',
    actions: [
      'Former les conducteurs à l’éco-conduite.',
      'Optimiser les tournées (logiciel de routage) et le taux de remplissage.',
      'Suivre la consommation par véhicule via les cartes carburant ; contrôler la pression des pneus.',
      'Réduire la vitesse maximale (limiteurs) et le ralenti moteur.',
    ],
    effort: 'faible',
    match: (r) => FLEET.has(r.factor.id) || r.factor.id === 'diesel_offroad',
    emissionCut: [0.05, 0.15],
    energyCut: [0.05, 0.15],
    costCut: [0.05, 0.15],
  },
  {
    id: 'fleet-electrification',
    title: 'Électrifier la flotte de véhicules',
    description: 'Remplacer progressivement les véhicules thermiques par des véhicules électriques lors du renouvellement.',
    actions: [
      'Identifier les usages compatibles (kilométrage journalier, retour au dépôt).',
      'Installer des bornes de recharge sur site, idéalement couplées à du photovoltaïque.',
      'Intégrer le coût total de possession (TCO) dans la politique d’achat.',
    ],
    effort: 'élevé',
    match: (r) => FLEET.has(r.factor.id),
    emissionCut: (_rs, ctx) => {
      // 1 L de carburant ≈ 15 km ≈ 2,7 kWh électriques ; ≈ 2,5 kg CO2e/L en thermique.
      const evPerLitre = 2.7 * ctx.gridFactor;
      const cut = clamp(1 - evPerLitre / 2.5);
      return [cut * 0.3, cut * 0.8];
    },
    energyCut: [0.2, 0.55],
    costCut: [0.15, 0.45],
    note: 'Pour un véhicule électrique détenu, les émissions passent en Scope 2 (électricité de recharge).',
  },
  {
    id: 'forklift-electric',
    title: 'Passer les chariots élévateurs et engins au tout électrique',
    description: 'Les chariots GPL ou diesel ont des équivalents électriques matures.',
    actions: ['Remplacer les chariots thermiques par des chariots électriques (batteries lithium).', 'Mutualiser la recharge sur les heures creuses.'],
    effort: 'moyen',
    match: (r) => r.factor.id === 'lpg_forklift',
    emissionCut: [0.5, 0.9],
    energyCut: [0.5, 0.7],
    costCut: [0.2, 0.5],
  },
  {
    id: 'refrigerant-leaks',
    title: 'Maîtriser les fuites de fluides frigorigènes',
    description: 'Le PRG des HFC dépasse 1 000 à 4 000 fois celui du CO2 : une petite fuite pèse lourd dans l’inventaire.',
    actions: [
      'Mettre en place des contrôles d’étanchéité périodiques et des détecteurs de fuite permanents.',
      'Tenir un registre précis des recharges (bilan massique) avec le prestataire de maintenance.',
      'Remplacer les équipements au R-404A / R-410A par des fluides à bas PRG (R-744 CO2, R-290 propane, R-32).',
      'Récupérer les fluides en fin de vie des équipements.',
    ],
    effort: 'moyen',
    match: (r) => r.category === 'S1_FUGITIVE' && !!r.factor.refrigerant && r.factor.refrigerant !== 'SF6',
    emissionCut: [0.5, 0.9],
  },
  {
    id: 'sf6',
    title: 'Réduire le SF6 des appareillages électriques',
    description: 'Le SF6 est le gaz au PRG le plus élevé (> 23 000).',
    actions: ['Surveiller la densité de gaz des cellules HTA.', 'Choisir des cellules sans SF6 (air sec, vide) lors des remplacements.'],
    effort: 'moyen',
    match: (r) => r.factor.refrigerant === 'SF6',
    emissionCut: [0.5, 0.95],
  },
  {
    id: 'process',
    title: 'Décarboner les procédés industriels',
    description: 'Les émissions de procédé exigent des leviers technologiques spécifiques.',
    actions: [
      'Réduire le taux de clinker (ciments composés, laitiers, argiles calcinées).',
      'Installer des catalyseurs de destruction du N2O (acide nitrique / adipique).',
      'Étudier le captage, l’utilisation et le stockage du carbone (CCUS) pour les sources concentrées.',
    ],
    effort: 'élevé',
    match: (r) => r.category === 'S1_PROCESS',
    emissionCut: [0.1, 0.3],
  },
  {
    id: 'electricity-efficiency',
    title: 'Sobriété et efficacité électrique',
    description: 'Réduire les kWh consommés : éclairage, moteurs, air comprimé, froid, informatique.',
    actions: [
      'Passer l’éclairage en LED avec détection de présence (−50 à −70 % sur l’éclairage).',
      'Équiper les moteurs de variateurs de vitesse ; traquer les fuites d’air comprimé.',
      'Mettre en place un système de management de l’énergie (ISO 50001) et un sous-comptage.',
      'Couper les équipements en veille la nuit et le week-end ; optimiser la climatisation.',
    ],
    effort: 'faible',
    match: (r) => r.category === 'S2_ELECTRICITY',
    emissionCut: [0.1, 0.25],
    energyCut: [0.1, 0.25],
    costCut: [0.1, 0.25],
  },
  {
    id: 'solar-pv',
    title: 'Autoconsommation photovoltaïque',
    description: 'Produire une partie de l’électricité sur site (toitures, ombrières de parking).',
    actions: [
      'Évaluer le gisement solaire des toitures et parkings.',
      'Dimensionner l’installation sur le profil de consommation diurne.',
    ],
    effort: 'moyen',
    match: (r) => r.category === 'S2_ELECTRICITY',
    emissionCut: [0.1, 0.3],
    costCut: [0.1, 0.25],
    note: 'Réduit les émissions location-based et market-based ; l’électricité autoproduite n’entre pas en Scope 2.',
  },
  {
    id: 'renewable-contracts',
    title: 'Contrats d’électricité renouvelable (PPA, garanties d’origine)',
    description: 'Acheter de l’électricité renouvelable via des instruments contractuels respectant les critères de qualité du Scope 2 Guidance.',
    actions: [
      'Privilégier un PPA avec un parc identifié (additionnalité) plutôt que des certificats seuls.',
      'Vérifier que les certificats sont émis dans le même marché et annulés dans un registre.',
      'Publier les deux totaux Scope 2 (location-based et market-based).',
    ],
    effort: 'moyen',
    match: (r) => r.category === 'S2_ELECTRICITY' && (r.activity.instrument ?? 'none') === 'none',
    emissionCut: [0.5, 1],
    costCut: [-0.05, 0],
    marketOnly: true,
    note: 'Effet uniquement sur le total market-based. Exemple : IBM a réduit l’inventaire de son site d’Austin de 4 100 t CO2/an grâce à un contrat éolien de 5,25 millions de kWh.',
  },
  {
    id: 'heat-network',
    title: 'Optimiser la chaleur, la vapeur et le froid achetés',
    description: 'Réduire les besoins et choisir un réseau ou un fournisseur à faible contenu carbone.',
    actions: ['Équilibrer les réseaux hydrauliques et optimiser les sous-stations.', 'Demander le contenu CO2 au fournisseur ; privilégier les réseaux alimentés en renouvelables / récupération.'],
    effort: 'faible',
    match: (r) => r.category === 'S2_HEAT' || r.category === 'S2_STEAM' || r.category === 'S2_COOLING',
    emissionCut: [0.1, 0.2],
    energyCut: [0.1, 0.2],
    costCut: [0.1, 0.2],
  },
  {
    id: 'purchasing',
    title: 'Achats responsables et engagement des fournisseurs',
    description: 'Le Scope 3 représente souvent 50 à 90 % des émissions : les achats sont le premier levier de la chaîne de valeur.',
    actions: [
      'Cartographier les fournisseurs les plus émetteurs et leur demander des données primaires (facteurs spécifiques).',
      'Intégrer un critère carbone dans les appels d’offres.',
      'Privilégier les matières recyclées (aluminium recyclé ≈ −90 % vs primaire, acier électrique).',
      'Écoconcevoir les produits pour réduire la quantité de matière (analyse du cycle de vie).',
    ],
    effort: 'moyen',
    match: (r) => r.category === 'S3_C1',
    emissionCut: [0.1, 0.3],
    costCut: [0, 0.05],
  },
  {
    id: 'capex',
    title: 'Allonger la durée de vie des équipements',
    description: 'La fabrication du matériel concentre l’essentiel de son empreinte.',
    actions: ['Allonger la durée d’usage du matériel informatique (5 ans et plus).', 'Acheter du matériel reconditionné.', 'Mutualiser et réparer plutôt que remplacer.'],
    effort: 'faible',
    match: (r) => r.category === 'S3_C2',
    emissionCut: [0.2, 0.4],
    costCut: [0.2, 0.4],
  },
  {
    id: 'travel',
    title: 'Politique de déplacements bas carbone',
    description: 'Prioriser le train et la visioconférence pour les déplacements professionnels.',
    actions: [
      'Imposer le train pour les trajets de moins de 4 à 5 heures (le TGV émet ≈ 90 fois moins que l’avion par passager.km).',
      'Remplacer une partie des réunions par de la visioconférence.',
      'Regrouper les déplacements et voyager en classe économique.',
    ],
    effort: 'faible',
    match: (r) => r.category === 'S3_C6',
    emissionCut: [0.2, 0.5],
    costCut: [0.1, 0.3],
  },
  {
    id: 'commuting',
    title: 'Plan de mobilité employeur',
    description: 'Réduire l’usage de la voiture individuelle pour les trajets domicile-travail.',
    actions: ['Forfait mobilités durables, parkings vélo sécurisés.', 'Covoiturage et navettes.', 'Télétravail partiel.'],
    effort: 'faible',
    match: (r) => r.category === 'S3_C7',
    emissionCut: [0.1, 0.3],
  },
  {
    id: 'freight',
    title: 'Optimiser le transport de marchandises',
    description: 'Report modal et massification des flux.',
    actions: ['Report modal vers le rail ou le fluvial/maritime.', 'Augmenter le taux de remplissage, réduire les livraisons express.', 'Éviter le fret aérien.', 'Choisir des transporteurs engagés (labels, carburants alternatifs).'],
    effort: 'moyen',
    match: (r) => r.category === 'S3_C4' || r.category === 'S3_C9',
    emissionCut: [0.1, 0.3],
    costCut: [0.05, 0.15],
  },
  {
    id: 'waste',
    title: 'Réduire et valoriser les déchets',
    description: 'La mise en décharge est le mode de traitement le plus émissif (méthane).',
    actions: ['Réduire les déchets à la source (emballages réutilisables).', 'Trier pour recycler et composter les biodéchets.', 'Éviter la mise en décharge.'],
    effort: 'faible',
    match: (r) => r.factor.id === 'waste_landfill',
    emissionCut: [0.5, 0.9],
    costCut: [0.1, 0.3],
  },
  {
    id: 'food',
    title: 'Restauration bas carbone',
    description: 'Un repas végétarien émet environ 4 fois moins qu’un repas moyen avec viande.',
    actions: ['Proposer une option végétarienne quotidienne.', 'Lutter contre le gaspillage alimentaire.', 'Privilégier les produits locaux et de saison.'],
    effort: 'faible',
    match: (r) => r.factor.id === 'meal_standard' || r.factor.id === 'spend_food',
    emissionCut: [0.15, 0.4],
  },
];

/**
 * Génère les recommandations triées par potentiel de réduction (milieu de fourchette).
 */
export function recommend(inventory: Inventory, ctx: Context): Recommendation[] {
  const recos: Recommendation[] = [];
  for (const rule of RULES) {
    const rs = inventory.results.filter(rule.match);
    if (rs.length === 0) continue;
    const baselineKg = rs.reduce((s, r) => s + (rule.marketOnly ? r.kgCO2eMarket : r.kgCO2e), 0);
    if (baselineKg <= 0) continue;
    const energyKwh = rs.reduce((s, r) => s + r.energyKwh, 0);
    const cost = rs.reduce((s, r) => s + r.cost, 0);
    let cut = typeof rule.emissionCut === 'function' ? rule.emissionCut(rs, ctx) : rule.emissionCut;
    // Gisement solaire tunisien plus élevé : part d'électricité autoproductible plus importante.
    if (rule.id === 'solar-pv' && ctx.country === 'TN') cut = [0.15, 0.4];
    // Marché des garanties d'origine peu développé en Tunisie : potentiel contractuel plus limité.
    if (rule.id === 'renewable-contracts' && ctx.country === 'TN') cut = [0.1, 0.5];
    const localNote = ctx.country === 'TN' ? TUNISIA_NOTES[rule.id] : undefined;
    const baselineT = baselineKg / 1000;
    recos.push({
      id: rule.id,
      title: rule.title,
      scope: rs[0].scope,
      categories: [...new Set(rs.map((r) => r.category))],
      description: rule.description,
      actions: rule.actions,
      effort: rule.effort,
      baselineT,
      reductionT: [baselineT * cut[0], baselineT * cut[1]],
      energySavedMWh: rule.energyCut ? [(energyKwh / 1000) * rule.energyCut[0], (energyKwh / 1000) * rule.energyCut[1]] : [0, 0],
      costSaved: rule.costCut ? [cost * rule.costCut[0], cost * rule.costCut[1]] : [0, 0],
      note: [rule.note, localNote].filter(Boolean).join(' ') || undefined,
      marketOnly: rule.marketOnly,
    });
  }
  // Les réductions physiques passent devant les leviers purement contractuels (market-based).
  const mid = (r: Recommendation) => ((r.reductionT[0] + r.reductionT[1]) / 2) * (r.marketOnly ? 0.3 : 1);
  return recos.sort((a, b) => mid(b) - mid(a));
}

export interface QualityAdvice {
  level: 'info' | 'attention' | 'critique';
  message: string;
}

/**
 * Conseils de qualité et de conformité de l'inventaire (principes du GHG Protocol :
 * pertinence, exhaustivité, cohérence, transparence, exactitude).
 */
export function qualityAdvice(inventory: Inventory, opts: { exclusions: string; hasBaseYearData: boolean; offsetsT: number }): QualityAdvice[] {
  const out: QualityAdvice[] = [];
  const rs = inventory.results;
  if (rs.length === 0) {
    out.push({ level: 'critique', message: 'Aucune donnée d’activité pour cette année : commencez par la saisie ou l’import.' });
    return out;
  }
  const total = inventory.totalLocation || 1;
  const estimated = rs.filter((r) => r.activity.quality >= 4).reduce((s, r) => s + r.kgCO2e / 1000, 0);
  if (estimated / total > 0.2) {
    out.push({
      level: 'attention',
      message: `${Math.round((estimated / total) * 100)} % des émissions reposent sur des estimations (niveau 4). Remplacez-les par des données facturées ou mesurées (principe d’exactitude).`,
    });
  }
  const noEvidence = rs.filter((r) => !r.activity.evidence).length;
  if (noEvidence > 0) {
    out.push({ level: 'info', message: `${noEvidence} donnée(s) sans pièce justificative : complétez la piste d’audit (facture, relevé de compteur, contrat).` });
  }
  if (inventory.scope1 === 0) out.push({ level: 'attention', message: 'Aucune émission de Scope 1 : vérifiez chauffage, véhicules, groupes électrogènes et fuites de climatisation (principe d’exhaustivité).' });
  if (inventory.scope2Location === 0) out.push({ level: 'attention', message: 'Aucune émission de Scope 2 : l’électricité achetée est presque toujours présente.' });
  if (!rs.some((r) => r.category === 'S1_FUGITIVE')) {
    out.push({ level: 'info', message: 'Aucune fuite de fluide frigorigène déclarée : si vous avez de la climatisation ou du froid, demandez les registres de recharge à votre prestataire.' });
  }
  if (inventory.scope3 === 0) out.push({ level: 'info', message: 'Le Scope 3 est optionnel dans le Corporate Standard mais représente souvent 50 à 90 % des émissions ; la CSRD l’exige lorsqu’il est matériel.' });
  if (!opts.exclusions.trim()) out.push({ level: 'info', message: 'Documentez les sources exclues et leur justification (paramètres de l’organisation).' });
  if (!opts.hasBaseYearData) out.push({ level: 'attention', message: 'Aucune donnée pour l’année de base : elle est nécessaire pour suivre les objectifs de réduction.' });
  if (opts.offsetsT > 0) out.push({ level: 'info', message: 'Les crédits carbone sont déclarés séparément et ne sont jamais soustraits des émissions brutes.' });
  if (inventory.nonKyotoT > 0) out.push({ level: 'info', message: 'Des gaz hors Kyoto (ex. R-22) sont déclarés : ils figurent hors scopes, dans une rubrique séparée.' });
  return out;
}
