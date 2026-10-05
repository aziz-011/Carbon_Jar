import type { DocType, EmissionFactor, Extraction, ExtractedLine } from '../../domain/types';
import { classify, normalize } from '../classifier';
import { parseCsv, parseNumber } from '../csv';
import { FUEL_FACTOR } from './parse';

/**
 * Analyse des relevés tabulaires (CSV, export Excel) : relevés de cartes carburant,
 * extractions d'ERP, historiques de factures. Chaque ligne est classée ; les pleins sont
 * regroupés par véhicule et par carburant, les autres lignes par poste.
 */

const COLS = {
  desc: ['libelle', 'designation', 'description', 'produit', 'article', 'carburant', 'poste', 'nature', 'intitule', 'objet', 'type'],
  qty: ['quantite', 'qte', 'litres', 'litre', 'volume', 'consommation', 'kwh', 'm3', 'quantity', 'qty', 'poids', 'tonnage'],
  unit: ['unite', 'unit', 'u.'],
  amount: ['montant', 'total', 'ttc', 'cout', 'amount', 'prix total', 'valeur', 'net a payer'],
  date: ['date', 'jour', 'periode', 'mois'],
  plate: ['immatriculation', 'matricule', 'vehicule', 'plaque', 'immat'],
};

type ColKey = keyof typeof COLS;

function findColumns(header: string[]): Partial<Record<ColKey, number>> {
  const idx: Partial<Record<ColKey, number>> = {};
  const used = new Set<number>();
  // Ordre : les colonnes les plus spécifiques d'abord.
  for (const key of ['plate', 'date', 'unit', 'amount', 'qty', 'desc'] as ColKey[]) {
    const i = header.findIndex((h, j) => !used.has(j) && COLS[key].some((k) => h === k || h.startsWith(k) || h.includes(` ${k}`) || h.endsWith(k)));
    if (i >= 0) {
      idx[key] = i;
      used.add(i);
    }
  }
  return idx;
}

function unitFromHeader(h: string | undefined): string | undefined {
  if (!h) return undefined;
  if (/litre|\bl\b|\(l\)/.test(h)) return 'L';
  if (/kwh/.test(h)) return 'kWh';
  if (/m3|m³/.test(h)) return 'm³';
  if (/tonne|\(t\)/.test(h)) return 't';
  if (/\bkg\b|poids/.test(h)) return 'kg';
  return undefined;
}

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (+m[2] < 1 || +m[2] > 12) return undefined;
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : undefined;
}

function docTypeOf(lines: ExtractedLine[], factors: Map<string, EmissionFactor>): DocType {
  const count = new Map<DocType, number>();
  for (const l of lines) {
    const f = l.factorId ? factors.get(l.factorId) : undefined;
    if (!f) continue;
    const t: DocType =
      f.category === 'S1_MOBILE' ? 'facture_carburant' : f.category === 'S2_ELECTRICITY' ? 'facture_electricite' : f.id.startsWith('ng_') ? 'facture_gaz' : f.id === 'water' ? 'facture_eau' : f.category === 'S3_C6' ? 'billet_transport' : f.category === 'S3_C5' ? 'bordereau_dechets' : f.category === 'S1_FUGITIVE' ? 'registre_fluides' : 'facture_achat';
    count.set(t, (count.get(t) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'autre';
}

/** Vrai si le texte ressemble à un tableau (au moins 2 lignes de données sous un en-tête). */
export function looksTabular(text: string): boolean {
  const rows = parseCsv(text).filter((r) => r.filter((c) => c.trim()).length >= 2);
  return rows.length >= 3;
}

export function parseTable(text: string, factors: EmissionFactor[], country = 'TN', hintType?: DocType): Extraction {
  const fmap = new Map(factors.map((f) => [f.id, f]));
  const rows = parseCsv(text);
  const warnings: string[] = [];
  // En-tête : première ligne (parmi les 10 premières) reconnaissant au moins deux colonnes.
  let headerRow = 0;
  let cols: Partial<Record<ColKey, number>> = {};
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const c = findColumns(rows[i].map(normalize));
    if (Object.keys(c).length >= 2) {
      headerRow = i;
      cols = c;
      break;
    }
  }
  const header = (rows[headerRow] ?? []).map(normalize);
  const headerUnit = unitFromHeader(cols.qty !== undefined ? header[cols.qty] : undefined);
  const fuelMode = hintType === 'facture_carburant' || (cols.plate !== undefined && headerUnit === 'L');

  type Acc = ExtractedLine & { n: number };
  const groups = new Map<string, Acc>();
  let skipped = 0;
  let dates: string[] = [];

  for (const r of rows.slice(headerRow + 1)) {
    const cell = (k: ColKey) => (cols[k] !== undefined ? r[cols[k]!]?.trim() : undefined);
    const qty = parseNumber(cell('qty'));
    const amount = parseNumber(cell('amount'));
    const desc = cell('desc') || '';
    if ((qty === undefined || qty <= 0) && (amount === undefined || amount <= 0)) continue;
    // Lignes de totaux (dans n'importe quelle colonne) : déjà comptées dans le détail.
    if (r.some((c) => /^(total|sous-total|sous total|cumul|totaux)\b/.test(normalize(c)))) continue;
    const date = toIso(cell('date'));
    if (date) dates.push(date);
    const unit = cell('unit') || headerUnit;
    const plate = cell('plate')?.toUpperCase().replace(/\s+/g, ' ');

    let factorId: string | undefined;
    let confidence = 0.85;
    if (fuelMode) {
      const d = normalize(desc);
      const energy = /essence|sans plomb|sp ?9/.test(d) ? 'essence' : /gpl/.test(d) ? 'gpl' : 'gasoil';
      factorId = FUEL_FACTOR[energy];
      if (!desc) confidence = 0.75;
    } else {
      const c = classify(`${desc} ${hintType ? hintType.replace('_', ' ') : ''}`, factors, unit);
      factorId = c.best?.factor.id;
      confidence = c.best ? Math.max(0.5, c.confidence) : 0;
      // Électricité : réseau du pays du site.
      if (factorId && fmap.get(factorId)?.gridZone && fmap.has(`elec_${country}`)) factorId = `elec_${country}`;
    }
    if (!factorId) {
      skipped++;
      continue;
    }
    const f = fmap.get(factorId)!;
    // Ligne exprimée seulement en montant : quantité monétaire si le facteur est un ratio monétaire.
    const quantity = qty !== undefined && qty > 0 ? qty : f.unit === 'TND' ? amount : undefined;
    const key = fuelMode ? `${plate ?? '—'}|${factorId}` : `${factorId}|${normalize(desc)}`;
    const g = groups.get(key) ?? { description: fuelMode ? `${f.label.split(' —')[0]}${plate ? ` — ${plate}` : ''}` : desc || f.label, quantity: 0, unit: unit ?? f.unit, amount: 0, factorId, confidence, plate: fuelMode ? plate : undefined, n: 0 };
    g.quantity = (g.quantity ?? 0) + (quantity ?? 0);
    g.amount = (g.amount ?? 0) + (amount ?? 0);
    g.confidence = Math.min(g.confidence, confidence);
    g.n++;
    if (date) {
      g.periodStart = !g.periodStart || date < g.periodStart ? date : g.periodStart;
      g.periodEnd = !g.periodEnd || date > g.periodEnd ? date : g.periodEnd;
    }
    groups.set(key, g);
  }

  const lines: ExtractedLine[] = [...groups.values()].map(({ n, ...l }) => ({
    ...l,
    description: n > 1 ? `${l.description} (${n} lignes)` : l.description,
    quantity: Math.round((l.quantity ?? 0) * 1000) / 1000,
    amount: l.amount ? Math.round(l.amount * 1000) / 1000 : undefined,
  }));
  if (skipped) warnings.push(`${skipped} ligne(s) non reconnue(s) ont été ignorées : à vérifier.`);
  if (cols.qty === undefined) warnings.push('Colonne de quantité non trouvée : seuls les montants ont été lus.');
  if (fuelMode && cols.plate !== undefined) warnings.push(`Relevé de carburant regroupé par véhicule (${lines.length} groupe(s)).`);
  dates = dates.sort();
  const confidence = lines.length ? Math.min(0.95, lines.reduce((s, l) => s + l.confidence, 0) / lines.length) * (skipped ? 0.85 : 1) : 0;
  return {
    docType: fuelMode ? 'facture_carburant' : hintType ?? docTypeOf(lines, fmap),
    method: 'texte',
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    totalAmount: lines.reduce((s, l) => s + (l.amount ?? 0), 0) || undefined,
    lines,
    confidence,
    warnings,
  };
}
