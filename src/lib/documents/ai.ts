import type { DocType, EmissionFactor, Extraction, ExtractedLine, ExtractedVehicle, VehicleEnergy } from '../../domain/types';
import { classify } from '../classifier';
import { DOC_TYPE_LABELS } from './parse';

/**
 * Lecture des documents par Claude, disponible lorsque la plateforme est ouverte comme
 * Artifact sur claude.ai (capacité « sample »). Claude lit le texte extrait ou l'image
 * (scan, photo) et renvoie les champs structurés ; la plateforme vérifie ensuite chaque
 * facteur proposé et recalcule tout elle-même.
 */

interface SampleFn {
  (input: string, options?: Record<string, unknown>): Promise<{ text: string }>;
  json<T>(input: string, options?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[]; maxInputBytes: number } }>;
}

interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

let samplePromise: Promise<SampleFn | null> | undefined;

/** Fonction « sample » de l'Artifact, ou null hors claude.ai. */
export function getSample(): Promise<SampleFn | null> {
  if (!samplePromise) {
    const rt = (window as unknown as { claude?: ClaudeRuntime }).claude;
    samplePromise = rt?.use ? (rt.use('sample') as Promise<SampleFn | null>).catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

export async function aiImageSupport(): Promise<{ mediaTypes: string[] } | null> {
  const s = await getSample();
  if (!s) return null;
  try {
    const l = await s.limits();
    return l.images ? { mediaTypes: l.images.mediaTypes } : null;
  } catch {
    return null;
  }
}

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];
const ENERGIES: VehicleEnergy[] = ['gasoil', 'essence', 'gpl', 'electrique', 'hybride', 'autre'];

function catalogue(factors: EmissionFactor[]): string {
  return factors.map((f) => `${f.id} | ${f.label} | ${f.unit}`).join('\n');
}

function buildPrompt(text: string, filename: string, factors: EmissionFactor[], country: string): string {
  return `Tu es un assistant de comptabilité carbone (GHG Protocol) pour un cabinet de conseil en Tunisie.
Analyse le document ci-dessous (nom de fichier : « ${filename} ») et extrais les données utiles au bilan carbone.

Règles :
- docType parmi : ${DOC_TYPES.join(', ')}.
- Pour chaque consommation, une ligne avec la quantité PHYSIQUE (kWh, litres, m³, kg, t, passager.km…) telle qu'écrite sur le document, sans la convertir sauf indication contraire.
- Pour une facture d'électricité, prends l'énergie consommée sur la période (pas les index, pas les prix unitaires).
- factorId : choisis l'identifiant le plus adapté dans le catalogue ci-dessous ; pour l'électricité du réseau, utilise elec_${country} sauf si le pays est différent.
- amount : montant de la ligne en dinars si présent (sinon omis). totalAmount : net à payer / total TTC.
- Dates au format AAAA-MM-JJ. Période de consommation dans periodStart / periodEnd.
- Pour une carte grise ou une fiche technique, remplis vehicle (plate au format « 123 TU 4567 », energy parmi ${ENERGIES.join(', ')}, consumptionL100, co2gkm si présents) et laisse lines vide.
- confidence entre 0 et 1 pour chaque ligne. N'invente aucune valeur : omets un champ illisible et ajoute un avertissement dans warnings.

Réponds UNIQUEMENT avec un objet JSON de la forme :
{"docType": "...", "supplier": "...", "documentNumber": "...", "date": "AAAA-MM-JJ", "periodStart": "AAAA-MM-JJ", "periodEnd": "AAAA-MM-JJ", "totalAmount": 0, "currency": "TND", "lines": [{"description": "...", "quantity": 0, "unit": "...", "amount": 0, "factorId": "...", "confidence": 0.9}], "vehicle": {"plate": "...", "make": "...", "model": "...", "energy": "gasoil", "fiscalPower": 0, "firstRegistration": "AAAA-MM-JJ", "consumptionL100": 0, "co2gkm": 0}, "warnings": ["..."]}

Catalogue des facteurs (id | libellé | unité) :
${catalogue(factors)}

${text ? `Texte du document :\n"""\n${text.slice(0, 12000)}\n"""` : 'Le document est fourni en image.'}`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const date = (v: unknown) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};

/** Vérifie et normalise la réponse de Claude (aucune valeur n'est acceptée sans contrôle). */
export function sanitizeAiExtraction(raw: unknown, factors: EmissionFactor[]): Extraction {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ids = new Set(factors.map((f) => f.id));
  const warnings = Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === 'string') : [];
  const lines: ExtractedLine[] = (Array.isArray(r.lines) ? r.lines : [])
    .map((l): ExtractedLine | undefined => {
      if (!l || typeof l !== 'object') return undefined;
      const o = l as Record<string, unknown>;
      const description = str(o.description) ?? 'Ligne';
      let factorId = str(o.factorId);
      if (factorId && !ids.has(factorId)) {
        warnings.push(`Facteur « ${factorId} » inconnu : classification automatique appliquée.`);
        factorId = undefined;
      }
      if (!factorId) factorId = classify(description, factors, str(o.unit)).best?.factor.id;
      const quantity = isNum(o.quantity) && o.quantity >= 0 ? o.quantity : undefined;
      return {
        description,
        quantity,
        unit: str(o.unit),
        amount: isNum(o.amount) ? o.amount : undefined,
        factorId,
        confidence: isNum(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0.7,
      };
    })
    .filter((l): l is ExtractedLine => !!l);

  let vehicle: ExtractedVehicle | undefined;
  if (r.vehicle && typeof r.vehicle === 'object') {
    const v = r.vehicle as Record<string, unknown>;
    const energy = str(v.energy) as VehicleEnergy | undefined;
    vehicle = {
      plate: str(v.plate)?.toUpperCase(),
      make: str(v.make),
      model: str(v.model),
      energy: energy && ENERGIES.includes(energy) ? energy : undefined,
      fiscalPower: isNum(v.fiscalPower) && v.fiscalPower > 0 ? v.fiscalPower : undefined,
      firstRegistration: date(v.firstRegistration),
      consumptionL100: isNum(v.consumptionL100) && v.consumptionL100 > 0 ? v.consumptionL100 : undefined,
      co2gkm: isNum(v.co2gkm) && v.co2gkm > 0 ? v.co2gkm : undefined,
    };
    if (!vehicle.plate && !vehicle.make && !vehicle.model) vehicle = undefined;
  }

  const docType = DOC_TYPES.includes(r.docType as DocType) ? (r.docType as DocType) : 'autre';
  return {
    docType,
    method: 'ia',
    supplier: str(r.supplier),
    documentNumber: str(r.documentNumber),
    date: date(r.date),
    periodStart: date(r.periodStart),
    periodEnd: date(r.periodEnd),
    totalAmount: isNum(r.totalAmount) ? r.totalAmount : undefined,
    currency: str(r.currency),
    lines,
    vehicle,
    confidence: lines.length ? Math.min(...lines.map((l) => l.confidence)) : vehicle ? 0.8 : 0.3,
    warnings,
  };
}

/** Demande à Claude de lire un document (texte et/ou image). */
export async function aiExtract(opts: {
  text: string;
  filename: string;
  image?: Blob;
  factors: EmissionFactor[];
  country: string;
  signal?: AbortSignal;
}): Promise<Extraction> {
  const sample = await getSample();
  if (!sample) throw { code: 'unavailable', message: 'Lecture par Claude indisponible ici.' };
  const options: Record<string, unknown> = {};
  if (opts.image) options.images = [opts.image];
  if (opts.signal) options.signal = opts.signal;
  const raw = await sample.json<unknown>(buildPrompt(opts.text, opts.filename, opts.factors, opts.country), options);
  return sanitizeAiExtraction(raw, opts.factors);
}
