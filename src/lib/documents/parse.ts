import type { DocType, EmissionFactor, Extraction, ExtractedLine, ExtractedVehicle, VehicleEnergy } from '../../domain/types';
import { classify, normalize } from '../classifier';
import { parseNumber } from '../csv';
import { flightFactorForDistance, routeDistanceKm } from './airports';

/**
 * Analyse « à base de règles » du texte d'un document : reconnaissance du type de pièce
 * (facture STEG, ticket carburant, carte grise…) puis extraction des champs utiles
 * (quantités, montants, période, immatriculation…). Utilisée hors ligne et en repli
 * lorsque la lecture par Claude n'est pas disponible.
 */

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  facture_electricite: 'Facture d’électricité',
  facture_gaz: 'Facture de gaz',
  facture_carburant: 'Facture / ticket de carburant',
  carte_grise: 'Carte grise',
  fiche_vehicule: 'Fiche technique véhicule',
  facture_eau: 'Facture d’eau',
  billet_transport: 'Billet de transport',
  bordereau_dechets: 'Bordereau de déchets',
  registre_fluides: 'Registre / rapport fluides frigorigènes',
  facture_achat: 'Facture d’achat',
  autre: 'Autre document',
};

/** Mots-clés de reconnaissance du type de document (texte normalisé, sans accents). */
const DOC_SIGNALS: Array<[DocType, Array<[RegExp, number]>]> = [
  ['carte_grise', [[/certificat d.?immatriculation/, 6], [/carte grise/, 6], [/premiere mise en circulation|\bdpmc\b/, 3], [/puissance fiscale/, 2], [/genre\s*:?\s*(vp|vu|vehicule)/, 2], [/numero de serie|n.? de serie|\bvin\b/, 2]]],
  ['fiche_vehicule', [[/fiche technique/, 5], [/l\s*\/\s*100\s*km/, 3], [/g\s*(co2)?\s*\/\s*km/, 3], [/consommation mixte|cycle mixte|wltp|nedc/, 3]]],
  ['facture_electricite', [[/electricite/, 3], [/\bkwh\b/, 2], [/energie active|index (ancien|nouveau)|ancien index|nouvel index/, 3], [/\bsteg\b/, 1], [/puissance souscrite|compteur/, 1]]],
  ['facture_gaz', [[/gaz naturel/, 5], [/\bgaz\b/, 2], [/thermie|\bth\b/, 2], [/\bm3\b|m³/, 1]]],
  ['facture_carburant', [[/gasoil|gazoil|gas-oil|diesel/, 4], [/essence|sans plomb|\bsp ?9[58]\b/, 4], [/carburant|station[- ]service|bon de carburant|carte carburant/, 3], [/agil|ola energy|staroil|shell|total ?energies|\bsndp\b/, 2], [/\blitres?\b|\blt\b/, 1]]],
  ['facture_eau', [[/\bsonede\b/, 5], [/eau potable|consommation d.?eau|\bassainissement\b|\bonas\b/, 4]]],
  ['billet_transport', [[/billet|e-?ticket|carte d.?embarquement|boarding/, 4], [/tunisair|nouvelair|air france|transavia|lufthansa|turkish airlines|\bvol\b/, 3], [/\bsncft\b|\btrain\b/, 2]]],
  ['bordereau_dechets', [[/bordereau/, 3], [/dechets?/, 3], [/enlevement|collecte|\banged\b|valorisation/, 2]]],
  ['registre_fluides', [[/fluide frigorigene|frigorigene/, 5], [/\br-?(410a|404a|407c|134a|32|22)\b/, 4], [/recharge|bilan frigorifique|controle d.?etancheite/, 2]]],
  ['facture_achat', [[/facture/, 1], [/montant ht|total ht|\btva\b/, 1]]],
];

export function detectDocType(text: string, filename = ''): { type: DocType; score: number } {
  const t = normalize(`${filename} ${text}`.replace(/_/g, ' '));
  let best: { type: DocType; score: number } = { type: 'autre', score: 0 };
  for (const [type, signals] of DOC_SIGNALS) {
    const score = signals.reduce((s, [re, w]) => s + (re.test(t) ? w : 0), 0);
    if (score > best.score) best = { type, score };
  }
  return best;
}

// ───────────────────────────── Champs génériques ─────────────────────────────

/** Nombre au format français, tunisien (3 décimales) ou anglais. */
const NUM = String.raw`(\d{1,3}(?:[ \u00a0.]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)`;

const num = (s: string | undefined) => (s === undefined ? undefined : parseNumber(s));

/** Texte en minuscules sans accents, en conservant les chiffres et la ponctuation utile. */
function flat(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ \t]+/g, ' ');
}

function toIsoDate(d: string): string | undefined {
  let m = d.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const day = +m[1];
    const month = +m[2];
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return d;
  return undefined;
}

const DATE = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})`;

function findDates(t: string): string[] {
  return [...t.matchAll(new RegExp(DATE, 'g'))].map((m) => toIsoDate(m[1])).filter((d): d is string => !!d);
}

function findPeriod(t: string): { start?: string; end?: string } {
  const m =
    t.match(new RegExp(String.raw`(?:du|periode(?: de consommation)?\s*:?\s*(?:du)?)\s*${DATE}\s*(?:au|a|-)\s*${DATE}`)) ??
    t.match(new RegExp(String.raw`periode[^\n]{0,40}?${DATE}[^\n]{0,10}?${DATE}`));
  if (!m) return {};
  return { start: toIsoDate(m[1]), end: toIsoDate(m[2]) };
}

function findDocDate(t: string): string | undefined {
  const m = t.match(new RegExp(String.raw`date(?: de (?:la )?facture| d.?emission| facture)?\s*:?\s*${DATE}`));
  return (m && toIsoDate(m[1])) ?? findDates(t)[0];
}

function findNumber(t: string): string | undefined {
  const m = t.match(/(?:facture|invoice|ticket|bon|bordereau|reference|ref\.?)\s*(?:n[°o]\.?|num(?:ero)?\.?|#)\s*:?\s*([a-z0-9][a-z0-9\-/]{2,})/);
  return m?.[1]?.toUpperCase();
}

/** Montant total : « net à payer », « total TTC »… (première occurrence par ordre de priorité). */
function findTotal(t: string): number | undefined {
  const labels = ['net a payer', 'montant a payer', 'total a payer', 'total ttc', 'montant ttc', 'montant total', 'total general', 'total', 'montant'];
  for (const l of labels) {
    const m = t.match(new RegExp(String.raw`${l}[^\d\n]{0,25}${NUM}`));
    const v = num(m?.[1]);
    if (v !== undefined && v > 0) return v;
  }
  return undefined;
}

function findSupplier(t: string): string | undefined {
  const known: Array<[RegExp, string]> = [
    [/\bsteg\b|societe tunisienne de l.?electricite et du gaz/, 'STEG'],
    [/\bsonede\b/, 'SONEDE'],
    [/\bagil\b/, 'Agil'],
    [/ola energy/, 'OLA Energy'],
    [/\bshell\b/, 'Shell'],
    [/total ?energies|\btotal\b station/, 'TotalEnergies'],
    [/staroil/, 'Staroil'],
    [/tunisair/, 'Tunisair'],
    [/nouvelair/, 'Nouvelair'],
    [/\bsncft\b/, 'SNCFT'],
    [/\banged\b/, 'ANGed'],
  ];
  return known.find(([re]) => re.test(t))?.[1];
}

// ─────────────────────────── Extraction par type ───────────────────────────

function electricity(t: string, warnings: string[]): ExtractedLine[] {
  const conso = t.match(new RegExp(String.raw`(?:consommation|energie (?:active )?(?:consommee)?|quantite)[^\d\n]{0,30}${NUM}\s*kwh`));
  let kwh = num(conso?.[1]);
  if (kwh === undefined) {
    const oldIdx = num(t.match(new RegExp(String.raw`(?:ancien(?:ne)? index|index (?:ancien|precedent))[^\d\n]{0,15}${NUM}`))?.[1]);
    const newIdx = num(t.match(new RegExp(String.raw`(?:nouv(?:el|eau) index|index (?:nouveau|actuel))[^\d\n]{0,15}${NUM}`))?.[1]);
    if (oldIdx !== undefined && newIdx !== undefined && newIdx > oldIdx) {
      kwh = newIdx - oldIdx;
      warnings.push(`Consommation calculée par différence d’index (${newIdx} − ${oldIdx}) : vérifiez le coefficient du compteur.`);
    }
  }
  if (kwh === undefined) {
    const all = [...t.matchAll(new RegExp(String.raw`${NUM}\s*kwh\b`, 'g'))].map((m) => num(m[1])).filter((v): v is number => v !== undefined);
    if (all.length) {
      kwh = Math.max(...all);
      warnings.push('Consommation non libellée explicitement : la plus grande valeur en kWh a été retenue, à vérifier.');
    }
  }
  return kwh !== undefined ? [{ description: 'Électricité consommée', quantity: kwh, unit: 'kWh', confidence: conso ? 0.9 : 0.6 }] : [];
}

function gas(t: string, warnings: string[]): ExtractedLine[] {
  const kwh = num(t.match(new RegExp(String.raw`(?:consommation|quantite)?[^\d\n]{0,20}${NUM}\s*kwh`))?.[1]);
  if (kwh !== undefined) return [{ description: 'Gaz naturel consommé', quantity: kwh, unit: 'kWh PCS', factorId: 'ng_kwh', confidence: 0.85 }];
  const th = num(t.match(new RegExp(String.raw`${NUM}\s*(?:thermies?|\bth\b)`))?.[1]);
  if (th !== undefined) {
    warnings.push('Consommation en thermies convertie en kWh (1 thermie = 1,163 kWh).');
    return [{ description: 'Gaz naturel consommé (converti depuis les thermies)', quantity: Math.round(th * 1.163 * 1000) / 1000, unit: 'kWh PCS', factorId: 'ng_kwh', confidence: 0.75 }];
  }
  const m3 = num(t.match(new RegExp(String.raw`${NUM}\s*(?:m3|m³)`))?.[1]);
  if (m3 !== undefined) return [{ description: 'Gaz naturel consommé', quantity: m3, unit: 'm³', factorId: 'ng_m3', confidence: 0.8 }];
  return [];
}

function fuelEnergy(t: string): VehicleEnergy | undefined {
  if (/gasoil|gazoil|gas-oil|diesel|\bgo\b/.test(t)) return 'gasoil';
  if (/essence|sans plomb|\bsp ?9[58]\b/.test(t)) return 'essence';
  if (/\bgpl\b/.test(t)) return 'gpl';
  if (/electrique|electric/.test(t)) return 'electrique';
  return undefined;
}

export const FUEL_FACTOR: Record<VehicleEnergy, string | undefined> = {
  gasoil: 'diesel_vehicle',
  essence: 'petrol_vehicle',
  gpl: 'lpg_forklift',
  hybride: 'petrol_vehicle',
  electrique: undefined,
  autre: undefined,
};

function fuel(t: string, warnings: string[]): ExtractedLine[] {
  const energy = fuelEnergy(t) ?? 'gasoil';
  const litres = [...t.matchAll(new RegExp(String.raw`${NUM}\s*(?:l|lt|ltr|litres?)\b`, 'g'))].map((m) => num(m[1])).filter((v): v is number => v !== undefined && v > 0);
  if (!litres.length) return [];
  // Un ticket peut répéter le volume ; un relevé de carte carburant liste plusieurs pleins.
  const isStatement = /releve|recapitulatif|carte carburant|total litres/.test(t);
  const totalLine = num(t.match(new RegExp(String.raw`total (?:litres|volume|quantite)[^\d\n]{0,15}${NUM}`))?.[1]);
  let qty: number;
  if (totalLine !== undefined) qty = totalLine;
  else if (isStatement) {
    qty = litres.reduce((a, b) => a + b, 0);
    warnings.push(`Relevé : ${litres.length} pleins additionnés.`);
  } else qty = Math.max(...litres);
  if (!fuelEnergy(t)) warnings.push('Type de carburant non précisé : gazole retenu par défaut.');
  return [{ description: energy === 'essence' ? 'Essence' : energy === 'gpl' ? 'GPL carburant' : 'Gazole', quantity: Math.round(qty * 1000) / 1000, unit: 'L', factorId: FUEL_FACTOR[energy], confidence: fuelEnergy(t) ? 0.85 : 0.6 }];
}

function water(t: string): ExtractedLine[] {
  const m3 = num(t.match(new RegExp(String.raw`(?:consommation)?[^\d\n]{0,20}${NUM}\s*(?:m3|m³)`))?.[1]);
  return m3 !== undefined ? [{ description: 'Eau potable consommée', quantity: m3, unit: 'm³', factorId: 'water', confidence: 0.85 }] : [];
}

function waste(t: string): ExtractedLine[] {
  const tonnes = num(t.match(new RegExp(String.raw`${NUM}\s*(?:t|tonnes?)\b`))?.[1]);
  const kg = num(t.match(new RegExp(String.raw`${NUM}\s*kg\b`))?.[1]);
  const qty = tonnes ?? (kg !== undefined ? kg / 1000 : undefined);
  if (qty === undefined) return [];
  const factorId = /recycl|valoris/.test(t) ? 'waste_recycling' : /incinera/.test(t) ? 'waste_incineration' : /compost/.test(t) ? 'waste_compost' : 'waste_landfill';
  return [{ description: 'Déchets enlevés', quantity: qty, unit: 't', factorId, confidence: 0.7 }];
}

function refrigerant(t: string): ExtractedLine[] {
  const fluid = t.match(/\br-?(410a|404a|407c|134a|32|22|744|290)\b/);
  const kg = num(t.match(new RegExp(String.raw`(?:recharge|appoint|quantite|charge ajoutee)[^\d\n]{0,25}${NUM}\s*kg`))?.[1] ?? t.match(new RegExp(String.raw`${NUM}\s*kg`))?.[1]);
  if (!fluid || kg === undefined) return [];
  const id = `R-${fluid[1].toUpperCase()}`;
  return [{ description: `Recharge de fluide ${id}`, quantity: kg, unit: 'kg', factorId: `refrigerant_${id}`, confidence: 0.8 }];
}

function ticket(t: string, warnings: string[]): ExtractedLine[] {
  const codes = [...t.toUpperCase().matchAll(/\b([A-Z]{3})\s*(?:-|→|>|\/|–|to|vers)\s*([A-Z]{3})\b/g)];
  const lines: ExtractedLine[] = [];
  for (const m of codes) {
    const d = routeDistanceKm(m[1], m[2]);
    if (d === undefined) continue;
    const passengers = num(t.match(/(\d+)\s*(?:passagers?|pax|adultes?)/)?.[1]) ?? 1;
    lines.push({ description: `Vol ${m[1]} → ${m[2]} (${Math.round(d)} km)`, quantity: Math.round(d * passengers), unit: 'p.km', factorId: flightFactorForDistance(d), confidence: 0.75 });
  }
  if (!lines.length) warnings.push('Trajet non reconnu : indiquez la distance en passager.km.');
  return lines;
}

export function extractVehicle(raw: string): ExtractedVehicle {
  const t = flat(raw);
  const v: ExtractedVehicle = {};
  const tu = raw.match(/(\d{1,3})\s*(?:TU|TUN|تونس)\s*(\d{1,4})/i);
  const rs = raw.match(/\b(\d{1,6})\s*RS\b/);
  if (tu) v.plate = `${tu[1]} TU ${tu[2]}`;
  else if (rs) v.plate = `RS ${rs[1]}`;
  else {
    const generic = t.match(/immatriculation\s*:?\s*([a-z0-9][a-z0-9 -]{3,12})/);
    if (generic) v.plate = generic[1].toUpperCase().trim();
  }
  v.energy = (() => {
    const m = t.match(/(?:energie|carburant|source d.?energie)\s*:?\s*([a-z-]+)/);
    return fuelEnergy(m?.[1] ?? '') ?? (/hybride/.test(t) ? 'hybride' : fuelEnergy(t));
  })();
  const make = raw.match(/(?:marque|make)\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]+)/i);
  if (make) v.make = make[1].toUpperCase();
  const model = raw.match(/(?:type commercial|modele|modèle|model)\s*:?\s*([A-Za-z0-9][A-Za-z0-9 .-]{1,24})/i);
  if (model) v.model = model[1].trim();
  const cv = t.match(/(?:puissance fiscale|p\.?\s*f\.?|puissance)\s*:?\s*(\d{1,2})\s*(?:cv)?/);
  if (cv) v.fiscalPower = +cv[1];
  const dpmc = t.match(new RegExp(String.raw`(?:premiere mise en circulation|mise en circulation|dpmc)\s*:?\s*${DATE}`));
  if (dpmc) v.firstRegistration = toIsoDate(dpmc[1]);
  const vin = raw.match(/(?:VIN|N[°o]\s*de\s*s[ée]rie|num[ée]ro de s[ée]rie|ch[aâ]ssis)\s*:?\s*([A-HJ-NPR-Z0-9]{11,17})/i);
  if (vin) v.vin = vin[1].toUpperCase();
  const cons = t.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*l\s*\/\s*100\s*km/);
  if (cons) v.consumptionL100 = parseNumber(cons[1]);
  const kwh100 = t.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*kwh\s*\/\s*100\s*km/);
  if (kwh100 && !cons) v.consumptionL100 = parseNumber(kwh100[1]);
  const co2 = t.match(/(\d{2,3})\s*g\s*(?:de\s*)?(?:co2\s*)?\/\s*km/);
  if (co2) v.co2gkm = +co2[1];
  return v;
}

/** Analyse complète d'un texte de document. */
export function parseDocument(text: string, filename: string, factors: EmissionFactor[], country = 'TN', hintType?: DocType): Extraction {
  const t = flat(text);
  const warnings: string[] = [];
  const detected = detectDocType(text, filename);
  // Rubrique choisie par le client : elle prime lorsque la reconnaissance est incertaine.
  if (hintType && hintType !== detected.type && detected.score < 4) detected.type = hintType;
  const type = detected.type;
  let lines: ExtractedLine[] = [];
  let vehicle: ExtractedVehicle | undefined;

  switch (type) {
    case 'facture_electricite':
      lines = electricity(t, warnings).map((l) => ({ ...l, factorId: factors.some((f) => f.id === `elec_${country}`) ? `elec_${country}` : 'elec_TN' }));
      break;
    case 'facture_gaz':
      lines = gas(t, warnings);
      break;
    case 'facture_carburant':
      lines = fuel(t, warnings);
      vehicle = extractVehicle(text);
      if (!vehicle.plate) vehicle = undefined;
      break;
    case 'facture_eau':
      lines = water(t);
      break;
    case 'bordereau_dechets':
      lines = waste(t);
      break;
    case 'registre_fluides':
      lines = refrigerant(t);
      break;
    case 'billet_transport':
      lines = ticket(text, warnings);
      break;
    case 'carte_grise':
    case 'fiche_vehicule':
      vehicle = extractVehicle(text);
      if (!vehicle.plate && type === 'carte_grise') warnings.push('Immatriculation non trouvée : complétez-la.');
      break;
    case 'facture_achat':
    case 'autre': {
      const total = findTotal(t);
      const c = classify(text.slice(0, 600), factors);
      if (c.best && c.best.factor.unit !== 'TND') {
        warnings.push('Document générique : vérifiez la quantité proposée.');
      }
      if (total !== undefined) {
        const spend = c.best?.factor.unit === 'TND' ? c.best.factor.id : 'spend_goods';
        lines = [{ description: 'Achat (approche monétaire)', quantity: total, unit: 'TND', factorId: spend, confidence: 0.4 }];
        warnings.push('Achat comptabilisé par ratio monétaire (moins précis qu’une donnée physique).');
      }
      break;
    }
  }

  const total = findTotal(t);
  if (lines.length === 1 && total !== undefined && lines[0].amount === undefined) lines[0] = { ...lines[0], amount: total };
  if (!lines.length && type !== 'carte_grise' && type !== 'fiche_vehicule') warnings.push('Aucune quantité reconnue : complétez manuellement.');

  const period = findPeriod(t);
  const confidence = Math.min(1, (detected.score / 6) * 0.5 + (lines.length ? 0.5 * Math.min(...lines.map((l) => l.confidence)) : vehicle?.plate ? 0.4 : 0));
  return {
    docType: type,
    method: 'texte',
    supplier: findSupplier(t),
    documentNumber: findNumber(t),
    date: findDocDate(t),
    periodStart: period.start,
    periodEnd: period.end,
    totalAmount: total,
    currency: /\btnd\b|\bdt\b|dinars?/.test(t) ? 'TND' : /€|\beur\b/.test(t) ? 'EUR' : undefined,
    lines,
    vehicle,
    confidence,
    warnings,
  };
}
