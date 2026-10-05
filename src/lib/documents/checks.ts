import type { Activity, DocCheck, DocType, DocumentRecord, EmissionFactor, Extraction } from '../../domain/types';
import { fmt } from '../format';
import { DOC_TYPE_LABELS } from './parse';

/**
 * Contrôles de cohérence appliqués à chaque document reçu. Un document avec une alerte
 * « attention » ou « bloquant » n'est jamais intégré automatiquement : il passe en
 * vérification par les ingénieurs.
 */

const DAY = 86_400_000;
const MONTHLY_TYPES: DocType[] = ['facture_electricite', 'facture_gaz', 'facture_eau'];

const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : undefined);

/** Empreinte SHA-256 du contenu (repli : taille + nom si l'API n'est pas disponible). */
export async function fileHash(data: ArrayBuffer, fallback: string): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${data.byteLength}:${fallback}`;
  }
}

export interface CheckContext {
  documents: DocumentRecord[];
  activities: Activity[];
  factors: Map<string, EmissionFactor>;
  reportingYear: number;
  today?: string;
}

/** Consommation journalière d'une période (quantité ÷ nombre de jours). */
function perDay(quantity: number, start?: string, end?: string): number | undefined {
  const a = day(start);
  const b = day(end);
  if (a === undefined || b === undefined || b < a) return undefined;
  return quantity / ((b - a) / DAY + 1);
}

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function runChecks(doc: DocumentRecord, e: Extraction, ctx: CheckContext): DocCheck[] {
  const out: DocCheck[] = [];
  const others = ctx.documents.filter((d) => d.id !== doc.id && d.status !== 'rejete');

  // 1. Doublons : même fichier, ou même numéro de pièce chez le même fournisseur.
  const sameFile = doc.hash ? others.find((d) => d.hash === doc.hash) : undefined;
  if (sameFile) out.push({ code: 'doublon', level: 'bloquant', message: `Fichier identique déjà reçu (« ${sameFile.name} »).` });
  else if (e.documentNumber) {
    const sameNumber = others.find((d) => d.extraction?.documentNumber === e.documentNumber && d.extraction?.docType === e.docType && (d.extraction?.supplier ?? '') === (e.supplier ?? ''));
    if (sameNumber) out.push({ code: 'doublon', level: 'bloquant', message: `${DOC_TYPE_LABELS[e.docType]} n° ${e.documentNumber} déjà reçue (« ${sameNumber.name} »).` });
  }

  // 2. Période déjà couverte par une autre facture du même type et du même site.
  const s = day(e.periodStart);
  const en = day(e.periodEnd);
  if (MONTHLY_TYPES.includes(e.docType) && s !== undefined && en !== undefined) {
    for (const d of others) {
      if (d.entityId !== doc.entityId || d.extraction?.docType !== e.docType) continue;
      const ds = day(d.extraction.periodStart);
      const de = day(d.extraction.periodEnd);
      if (ds === undefined || de === undefined) continue;
      const overlap = (Math.min(en, de) - Math.max(s, ds)) / DAY;
      if (overlap > 3) {
        out.push({ code: 'periode_couverte', level: 'attention', message: `La période recoupe « ${d.name} » (${d.extraction.periodStart} → ${d.extraction.periodEnd}). Plusieurs compteurs ? Sinon, risque de double comptage.` });
        break;
      }
    }
  }

  for (const l of e.lines) {
    const f = l.factorId ? ctx.factors.get(l.factorId) : undefined;
    if (!f || !l.quantity) continue;
    // 3. Prix unitaire implicite très éloigné du prix habituel : quantité probablement mal lue.
    if (l.amount && f.defaultPrice && f.unit !== 'TND' && (!e.currency || e.currency === 'TND')) {
      const unitPrice = l.amount / l.quantity;
      const ratio = unitPrice / f.defaultPrice;
      if (ratio > 4 || ratio < 0.25) {
        out.push({
          code: 'prix_atypique',
          level: 'attention',
          message: `Prix unitaire de ${fmt(unitPrice, 3)} TND/${f.unit} pour « ${l.description} » (habituellement ≈ ${fmt(f.defaultPrice, 3)}) : vérifiez la quantité lue.`,
        });
      }
    }
    // 4. Consommation journalière atypique par rapport aux autres périodes du même poste.
    const pd = perDay(l.quantity, l.periodStart ?? e.periodStart, l.periodEnd ?? e.periodEnd);
    if (pd !== undefined) {
      const refs = ctx.activities
        .filter((a) => a.factorId === f.id && a.entityId === doc.entityId && a.documentId !== doc.id)
        .map((a) => perDay(a.quantity, a.periodStart, a.periodEnd))
        .filter((v): v is number => v !== undefined && v > 0);
      if (refs.length >= 2) {
        const med = median(refs);
        if (pd > med * 3 || pd < med / 3) {
          out.push({
            code: 'valeur_atypique',
            level: 'attention',
            message: `« ${l.description} » : ${fmt(pd, 1)} ${f.unit}/jour contre ${fmt(med, 1)} ${f.unit}/jour habituellement (×${fmt(pd / med, 1)}).`,
          });
        }
      }
    }
  }

  // 5. Rattachement à l'exercice et dates.
  const end = e.periodEnd ?? e.date;
  if (end && Number(end.slice(0, 4)) !== ctx.reportingYear) {
    out.push({ code: 'hors_exercice', level: 'info', message: `Pièce de ${end.slice(0, 4)} : rattachée à cet exercice-là, pas à ${ctx.reportingYear}.` });
  }
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  if (e.date && e.date > today) out.push({ code: 'date_future', level: 'attention', message: `Date ${e.date} postérieure à aujourd’hui : vérifiez la lecture de la date.` });

  return out;
}

export const blocksAutoValidation = (checks: DocCheck[]) => checks.some((c) => c.level !== 'info');

// ─────────────────────────────── Couverture ───────────────────────────────

const MONTH_LABELS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Mois de l'exercice couverts par les factures d'un type (électricité, gaz, eau) :
 * sert à signaler au client les factures manquantes.
 */
export function monthlyCoverage(docs: DocumentRecord[], types: DocType[], year: number): { covered: number[]; missing: string[] } {
  const covered = new Set<number>();
  for (const d of docs) {
    const e = d.extraction;
    if (!e || d.status === 'rejete' || !types.includes(e.docType)) continue;
    const ranges = e.lines.some((l) => l.periodStart) ? e.lines.map((l) => [l.periodStart, l.periodEnd] as const) : [[e.periodStart ?? e.date, e.periodEnd ?? e.date] as const];
    for (const [a, b] of ranges) {
      const s = day(a);
      const en = day(b);
      if (s === undefined || en === undefined) continue;
      for (let t = s; t <= en; t += DAY) {
        const dt = new Date(t);
        if (dt.getUTCFullYear() === year) covered.add(dt.getUTCMonth());
      }
    }
  }
  const missing = MONTH_LABELS.filter((_, i) => !covered.has(i));
  return { covered: [...covered].sort((a, b) => a - b), missing };
}

export const MONTHLY_REQUESTS: Record<string, DocType[]> = {
  electricite: ['facture_electricite'],
  combustibles: ['facture_gaz'],
  eau: ['facture_eau'],
};
