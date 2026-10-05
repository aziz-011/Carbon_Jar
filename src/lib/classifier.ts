import type { CategoryId, EmissionFactor, Scope } from '../domain/types';
import { getCategory } from '../data/categories';

/** Normalise un texte : minuscules, sans accents ni ponctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.\-+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const UNIT_ALIASES: Record<string, string[]> = {
  L: ['l', 'litre', 'litres', 'liter', 'liters'],
  kWh: ['kwh', 'kilowattheure'],
  'kWh PCS': ['kwh', 'kwh pcs'],
  'm³': ['m3', 'm³', 'metre cube', 'metres cubes'],
  kg: ['kg', 'kilo', 'kilos', 'kilogramme'],
  t: ['t', 'tonne', 'tonnes'],
  km: ['km', 'kilometre', 'kilometres'],
  'p.km': ['p.km', 'pkm', 'km', 'passager.km'],
  't.km': ['t.km', 'tkm', 'tonne.km'],
  '€': ['€', 'eur', 'euro', 'euros', 'mad', 'dh', 'tnd', 'dzd', 'usd', '$', 'cfa'],
  nuit: ['nuit', 'nuits', 'nuitee', 'nuitees'],
  repas: ['repas', 'couvert', 'couverts'],
  'unité': ['unite', 'unites', 'u', 'pcs', 'piece', 'pieces'],
};

function unitMatches(factorUnit: string, inputUnit: string | undefined): boolean {
  if (!inputUnit) return false;
  const u = normalize(inputUnit);
  const aliases = UNIT_ALIASES[factorUnit] ?? [normalize(factorUnit)];
  return aliases.includes(u);
}

export interface ClassificationCandidate {
  factor: EmissionFactor;
  score: number;
  matched: string[];
}

export interface ClassificationResult {
  best?: ClassificationCandidate;
  alternatives: ClassificationCandidate[];
  scope?: Scope;
  category?: CategoryId;
  /** Confiance 0–1. */
  confidence: number;
  explanation: string;
}

/** Règles de contexte qui modifient la classification (frontières entre scopes). */
const CONTEXT_RULES: Array<{ pattern: RegExp; boost: (f: EmissionFactor) => number; reason: string }> = [
  {
    // Véhicule électrique de la flotte → électricité de recharge = Scope 2.
    pattern: /(vehicule|voiture|flotte).*electrique|borne de recharge|recharge (des |de )?(vehicule|voiture)/,
    boost: (f) => (f.category === 'S2_ELECTRICITY' ? 4 : f.category === 'S1_MOBILE' || f.category === 'S1_FUGITIVE' ? -4 : 0),
    reason: 'Véhicule électrique détenu : l’électricité de recharge relève du Scope 2.',
  },
  {
    // Transport par un prestataire externe → Scope 3, pas Scope 1.
    pattern: /(prestataire|transporteur|sous-trait|externe)/,
    boost: (f) => (getCategory(f.category).scope === 3 ? 2 : 0),
    reason: 'Source détenue par un tiers : Scope 3.',
  },
  {
    pattern: /(location|loue|taxi|vtc|uber|personnel)/,
    boost: (f) => (f.category === 'S3_C6' ? 2 : 0),
    reason: 'Véhicule non détenu par l’entreprise : déplacement professionnel (Scope 3, cat. 6).',
  },
  {
    pattern: /(domicile|trajet salarie|navette)/,
    boost: (f) => (f.category === 'S3_C7' ? 3 : 0),
    reason: 'Trajet domicile-travail des salariés : Scope 3, cat. 7.',
  },
];

/**
 * Classe automatiquement une ligne de données (libellé libre + unité) vers un facteur
 * d'émission, et donc vers un scope et une catégorie.
 */
export function classify(text: string, factors: EmissionFactor[], unit?: string): ClassificationResult {
  const norm = normalize(text);
  const padded = ` ${norm} `;
  const candidates: ClassificationCandidate[] = [];

  for (const f of factors) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of f.keywords ?? []) {
      const k = normalize(kw);
      if (!k) continue;
      if (padded.includes(` ${k} `) || (k.length > 4 && norm.includes(k))) {
        score += 1 + k.split(' ').length; // les expressions multi-mots pèsent plus
        matched.push(kw);
      }
    }
    if (normalize(f.label) === norm) score += 5;
    if (score > 0 && unitMatches(f.unit, unit)) score += 1.5;
    for (const rule of CONTEXT_RULES) {
      if (!rule.pattern.test(norm)) continue;
      const b = rule.boost(f);
      if (b === 0) continue;
      // Une règle de contexte renforce (ou écarte) un candidat ; seule, elle suffit à proposer la catégorie.
      score += b < 0 || score > 0 ? b : b / 2;
    }
    if (score > 0) candidates.push({ factor: f, score, matched });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    return {
      alternatives: [],
      confidence: 0,
      explanation: 'Aucun mot-clé reconnu : utilisez l’assistant de classification ou choisissez le facteur manuellement.',
    };
  }
  const second = candidates[1]?.score ?? 0;
  const confidence = Math.max(0.2, Math.min(1, (best.score - second / 2) / 6));
  const cat = getCategory(best.factor.category);
  const reasons = CONTEXT_RULES.filter((r) => r.pattern.test(norm) && r.boost(best.factor) > 0).map((r) => r.reason);
  const explanation = [
    `Classé en ${cat.scope === 3 ? 'Scope 3' : `Scope ${cat.scope}`} — ${cat.label}`,
    best.matched.length ? `(mots-clés : ${best.matched.join(', ')})` : '',
    ...reasons,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    best,
    alternatives: candidates.slice(1, 5),
    scope: cat.scope,
    category: cat.id,
    confidence,
    explanation,
  };
}

// ─────────────────────── Arbre de décision des scopes ───────────────────────

/**
 * Logique de classification (module de formation §3.3) : « qui possède ou contrôle
 * physiquement la source d'émission, et l'émission résulte-t-elle d'un achat d'énergie ? »
 * Complétée par les cas particuliers §3.4–3.5 (biomasse, revente, autoproduction, VE,
 * gaz hors Kyoto, actifs loués).
 */
export interface DecisionNode {
  id: string;
  question: string;
  help?: string;
  options: Array<{ label: string; next?: string; outcome?: DecisionOutcome }>;
}

export interface DecisionOutcome {
  scope: Scope | 'memo' | 'hors-inventaire';
  category?: CategoryId;
  title: string;
  explanation: string;
}

export const DECISION_TREE: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    question: 'L’émission concerne-t-elle un gaz à effet de serre couvert par le GHG Protocol ?',
    help: 'Gaz couverts : CO2, CH4, N2O, HFC, PFC, SF6, NF3. Les CFC/HCFC (ex. R-22) et les NOx sont hors Kyoto.',
    options: [
      { label: 'Oui (CO2, CH4, N2O, HFC, PFC, SF6, NF3)', next: 'biogenic' },
      {
        label: 'Non (CFC, HCFC comme le R-22, NOx…)',
        outcome: {
          scope: 'hors-inventaire',
          title: 'Hors scopes — reporting séparé',
          explanation: 'Les gaz hors Kyoto ne sont pas inclus dans les Scopes, mais peuvent faire l’objet d’un reporting séparé.',
        },
      },
    ],
  },
  biogenic: {
    id: 'biogenic',
    question: 'S’agit-il du CO2 issu de la combustion de biomasse (bois, biogaz, biocarburants) ?',
    options: [
      {
        label: 'Oui, CO2 biogénique',
        outcome: {
          scope: 'memo',
          title: 'Poste mémo — CO2 biogénique',
          explanation: 'Le CO2 biogénique est déclaré séparément, hors totaux de scope. Le CH4 et le N2O de cette même combustion restent en Scope 1.',
        },
      },
      { label: 'Non', next: 'control' },
    ],
  },
  control: {
    id: 'control',
    question: 'L’entreprise possède-t-elle ou contrôle-t-elle la source qui émet physiquement le GES ?',
    help: 'Exemples : chaudière du site, véhicule de la flotte, équipement de climatisation, procédé de l’usine, actif loué sous contrôle opérationnel.',
    options: [
      { label: 'Oui, source détenue ou contrôlée', next: 'scope1Type' },
      { label: 'Non, la source appartient à un tiers', next: 'energyPurchased' },
    ],
  },
  scope1Type: {
    id: 'scope1Type',
    question: 'Quel type de source ?',
    options: [
      {
        label: 'Combustion dans une installation fixe (chaudière, four, groupe électrogène, cogénération)',
        outcome: {
          scope: 1,
          category: 'S1_STATIONARY',
          title: 'Scope 1 — Combustion fixe',
          explanation: 'L’électricité autoproduite (cogénération) relève aussi du Scope 1 pour le combustible consommé, pas du Scope 2.',
        },
      },
      { label: 'Véhicule ou engin mobile', next: 'vehicleType' },
      {
        label: 'Fuite (fluide frigorigène, SF6, méthane)',
        outcome: {
          scope: 1,
          category: 'S1_FUGITIVE',
          title: 'Scope 1 — Émissions fugitives',
          explanation: 'Quantité fuitée = charge initiale + recharges − charge finale, multipliée par le PRG du fluide.',
        },
      },
      {
        label: 'Réaction chimique ou physique du procédé (calcination, fermentation, électrolyse)',
        outcome: {
          scope: 1,
          category: 'S1_PROCESS',
          title: 'Scope 1 — Procédés industriels',
          explanation: 'Ne pas confondre avec la combustion fixe lorsque procédé et énergie sont couplés (ex. four de calcination chauffé au gaz).',
        },
      },
    ],
  },
  vehicleType: {
    id: 'vehicleType',
    question: 'Quelle motorisation ?',
    options: [
      {
        label: 'Thermique (essence, gazole, GPL, GNV)',
        outcome: { scope: 1, category: 'S1_MOBILE', title: 'Scope 1 — Combustion mobile', explanation: 'Carburant brûlé dans un véhicule détenu ou contrôlé. Inclure aussi les engins non immatriculés (chariots élévateurs).' },
      },
      {
        label: 'Électrique',
        outcome: {
          scope: 2,
          category: 'S2_ELECTRICITY',
          title: 'Scope 2 — Électricité achetée',
          explanation: 'Pour un véhicule électrique détenu, l’émission se déplace vers la production de l’électricité de recharge : Scope 2.',
        },
      },
    ],
  },
  energyPurchased: {
    id: 'energyPurchased',
    question: 'L’émission provient-elle de la production d’énergie achetée (électricité, chaleur, vapeur, froid) ?',
    options: [
      { label: 'Oui', next: 'energyUse' },
      { label: 'Non', next: 'valueChain' },
    ],
  },
  energyUse: {
    id: 'energyUse',
    question: 'Cette énergie est-elle consommée par l’entreprise ou revendue ?',
    options: [
      {
        label: 'Consommée par l’entreprise',
        outcome: {
          scope: 2,
          category: 'S2_ELECTRICITY',
          title: 'Scope 2 — Énergie achetée',
          explanation: 'À déclarer selon les deux méthodes : location-based (moyenne du réseau) et market-based (instruments contractuels).',
        },
      },
      {
        label: 'Revendue à des utilisateurs finaux',
        outcome: {
          scope: 3,
          category: 'S3_C3',
          title: 'Scope 3 — Cat. 3 Activités liées à l’énergie',
          explanation: 'L’électricité achetée pour être revendue est exclue du Scope 2 et déclarée en Scope 3 pour éviter le double comptage.',
        },
      },
      {
        label: 'Pertes en ligne / extraction des combustibles (amont)',
        outcome: { scope: 3, category: 'S3_C3', title: 'Scope 3 — Cat. 3 Activités liées à l’énergie', explanation: 'Extraction, raffinage, transport des combustibles et pertes de transport-distribution (T&D).' },
      },
    ],
  },
  valueChain: {
    id: 'valueChain',
    question: 'À quel moment de la chaîne de valeur l’émission a-t-elle lieu ?',
    options: [
      { label: 'En amont (avant / pendant la production)', next: 'upstream' },
      { label: 'En aval (après la vente)', next: 'downstream' },
    ],
  },
  upstream: {
    id: 'upstream',
    question: 'Quelle activité amont ?',
    options: [
      { label: 'Achat de matières premières, biens ou services', outcome: { scope: 3, category: 'S3_C1', title: 'Scope 3 — Cat. 1 Biens et services achetés', explanation: 'Ex. : les émissions de fabrication de l’acier acheté sont du Scope 3.' } },
      { label: 'Achat d’équipements / immobilisations', outcome: { scope: 3, category: 'S3_C2', title: 'Scope 3 — Cat. 2 Biens d’équipement', explanation: 'Émissions de fabrication des machines, bâtiments, matériel informatique.' } },
      { label: 'Transport par un prestataire externe', outcome: { scope: 3, category: 'S3_C4', title: 'Scope 3 — Cat. 4 Transport amont', explanation: 'Les camions d’un transporteur ne sont pas détenus par l’entreprise : Scope 3.' } },
      { label: 'Traitement des déchets', outcome: { scope: 3, category: 'S3_C5', title: 'Scope 3 — Cat. 5 Déchets', explanation: 'Mise en décharge, incinération, recyclage des déchets des opérations.' } },
      { label: 'Déplacements professionnels (avion, train, hôtel, location)', outcome: { scope: 3, category: 'S3_C6', title: 'Scope 3 — Cat. 6 Déplacements professionnels', explanation: 'Moyens de transport non détenus par l’entreprise.' } },
      { label: 'Trajets domicile-travail des salariés', outcome: { scope: 3, category: 'S3_C7', title: 'Scope 3 — Cat. 7 Domicile-travail', explanation: 'Véhicules personnels et transports en commun des salariés.' } },
      { label: 'Actif loué non inclus dans le périmètre', outcome: { scope: 3, category: 'S3_C8', title: 'Scope 3 — Cat. 8 Actifs loués amont', explanation: 'Sous contrôle opérationnel, un actif loué que l’entreprise gère entre en Scopes 1/2 ; sinon Scope 3.' } },
    ],
  },
  downstream: {
    id: 'downstream',
    question: 'Quelle activité aval ?',
    options: [
      { label: 'Transport vers les clients (non payé par l’entreprise)', outcome: { scope: 3, category: 'S3_C9', title: 'Scope 3 — Cat. 9 Transport aval', explanation: 'Distribution des produits vendus.' } },
      { label: 'Transformation des produits par des tiers', outcome: { scope: 3, category: 'S3_C10', title: 'Scope 3 — Cat. 10 Transformation', explanation: 'Produits intermédiaires transformés par les clients.' } },
      { label: 'Utilisation des produits vendus', outcome: { scope: 3, category: 'S3_C11', title: 'Scope 3 — Cat. 11 Utilisation', explanation: 'Ex. : électricité consommée par un appareil vendu.' } },
      { label: 'Fin de vie des produits vendus', outcome: { scope: 3, category: 'S3_C12', title: 'Scope 3 — Cat. 12 Fin de vie', explanation: 'Recyclage, incinération, mise en décharge.' } },
      { label: 'Franchises / actifs loués à des tiers / investissements', outcome: { scope: 3, category: 'S3_C15', title: 'Scope 3 — Cat. 13 à 15', explanation: 'Actifs loués aval (13), franchises (14), investissements (15).' } },
    ],
  },
};
