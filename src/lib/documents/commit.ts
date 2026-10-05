import type { Activity, DocumentRecord, EmissionFactor, Extraction, ExtractedLine, Vehicle } from '../../domain/types';
import { uid } from '../format';
import { DOC_TYPE_LABELS, FUEL_FACTOR } from './parse';

/** Clé de comparaison d'une immatriculation (sans espaces ni tirets). */
export const plateKey = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, '');

const UNIT_GROUPS: Record<string, { base: string; factor: number }> = {
  wh: { base: 'kwh', factor: 0.001 },
  kwh: { base: 'kwh', factor: 1 },
  'kwh pcs': { base: 'kwh', factor: 1 },
  mwh: { base: 'kwh', factor: 1000 },
  gwh: { base: 'kwh', factor: 1e6 },
  g: { base: 'kg', factor: 0.001 },
  kg: { base: 'kg', factor: 1 },
  t: { base: 'kg', factor: 1000 },
  tonne: { base: 'kg', factor: 1000 },
  tonnes: { base: 'kg', factor: 1000 },
  l: { base: 'l', factor: 1 },
  litre: { base: 'l', factor: 1 },
  litres: { base: 'l', factor: 1 },
  m3: { base: 'm3', factor: 1 },
  'm³': { base: 'm3', factor: 1 },
};

/**
 * Convertit une quantité vers l'unité attendue par le facteur (kWh↔MWh, kg↔t…).
 * Renvoie ok=false si les unités sont incompatibles : la ligne doit alors être vérifiée.
 */
export function convertQuantity(qty: number, from: string | undefined, to: string): { qty: number; ok: boolean; note?: string } {
  if (!from) return { qty, ok: true };
  const f = UNIT_GROUPS[from.trim().toLowerCase()];
  const t = UNIT_GROUPS[to.trim().toLowerCase()];
  if (!f || !t) return { qty, ok: from.trim().toLowerCase() === to.trim().toLowerCase() };
  if (f.base !== t.base) return { qty, ok: false };
  if (f.factor === t.factor) return { qty, ok: true };
  const converted = (qty * f.factor) / t.factor;
  return { qty: converted, ok: true, note: `${qty} ${from} convertis en ${+converted.toFixed(6)} ${to}` };
}

/** Année de rattachement : fin de période, puis date du document, puis année choisie. */
export function extractionYear(e: Extraction, fallback: number): number {
  const d = e.periodEnd ?? e.date;
  const y = d ? Number(d.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 1990 && y < 2100 ? y : fallback;
}

export function evidenceLabel(doc: Pick<DocumentRecord, 'name'>, e: Extraction): string {
  return `${DOC_TYPE_LABELS[e.docType]}${e.supplier ? ` ${e.supplier}` : ''}${e.documentNumber ? ` n° ${e.documentNumber}` : ''} — ${doc.name}`;
}

export interface LineCheck {
  line: ExtractedLine;
  factor?: EmissionFactor;
  quantity?: number;
  ok: boolean;
  problem?: string;
  note?: string;
}

/** Contrôle chaque ligne avant validation : facteur connu, quantité présente, unité compatible. */
export function checkLines(e: Extraction, factors: Map<string, EmissionFactor>): LineCheck[] {
  return e.lines.map((line) => {
    const factor = line.factorId ? factors.get(line.factorId) : undefined;
    if (!factor) return { line, ok: false, problem: 'Choisissez la source d’émission.' };
    if (line.quantity === undefined || !(line.quantity > 0)) return { line, factor, ok: false, problem: 'Quantité manquante.' };
    const c = convertQuantity(line.quantity, line.unit, factor.unit);
    if (!c.ok) return { line, factor, ok: false, problem: `Unité « ${line.unit} » incompatible avec « ${factor.unit} ».` };
    return { line, factor, quantity: c.qty, ok: true, note: c.note };
  });
}

/** Crée ou met à jour le véhicule décrit par une carte grise, une fiche ou un ticket. */
export function mergeVehicle(existing: Vehicle[], e: Extraction, doc: DocumentRecord): Vehicle | undefined {
  const v = e.vehicle;
  if (!v?.plate) return undefined;
  const found = existing.find((x) => plateKey(x.plate) === plateKey(v.plate!));
  const base: Vehicle = found ?? { id: uid(), plate: v.plate, energy: v.energy ?? 'autre', entityId: doc.entityId, documentIds: [] };
  return {
    ...base,
    make: v.make ?? base.make,
    model: v.model ?? base.model,
    energy: v.energy ?? base.energy,
    fiscalPower: v.fiscalPower ?? base.fiscalPower,
    firstRegistration: v.firstRegistration ?? base.firstRegistration,
    consumptionL100: v.consumptionL100 ?? base.consumptionL100,
    co2gkm: v.co2gkm ?? base.co2gkm,
    documentIds: base.documentIds.includes(doc.id) ? base.documentIds : [...base.documentIds, doc.id],
  };
}

/**
 * Transforme une extraction validée en données d'activité de l'inventaire, chacune liée
 * à son document (piste d'audit).
 */
/**
 * Véhicules cités ligne par ligne (relevés de cartes carburant) et absents du registre :
 * une fiche minimale est créée pour chacun.
 */
export function vehiclesFromLines(existing: Vehicle[], e: Extraction, doc: DocumentRecord, factors: Map<string, EmissionFactor>): Vehicle[] {
  const out: Vehicle[] = [];
  for (const l of e.lines) {
    if (!l.plate) continue;
    const key = plateKey(l.plate);
    if (existing.some((v) => plateKey(v.plate) === key) || out.some((v) => plateKey(v.plate) === key)) continue;
    const f = l.factorId ? factors.get(l.factorId) : undefined;
    const energy = f?.id === 'petrol_vehicle' ? 'essence' : f?.id === 'lpg_forklift' ? 'gpl' : 'gasoil';
    out.push({ id: uid(), plate: l.plate, energy, entityId: doc.entityId, documentIds: [doc.id] });
  }
  return out;
}

/**
 * Transforme une extraction validée en données d'activité de l'inventaire, chacune liée
 * à son document (piste d'audit), à sa période et, le cas échéant, à son véhicule.
 */
export function extractionToActivities(
  doc: DocumentRecord,
  e: Extraction,
  factors: Map<string, EmissionFactor>,
  vehicle?: Vehicle,
  fleet: Vehicle[] = [],
): Activity[] {
  const checks = checkLines(e, factors).filter((c) => c.ok);
  return checks.map((c) => {
    const lineVehicle = c.line.plate ? fleet.find((v) => plateKey(v.plate) === plateKey(c.line.plate!)) : vehicle;
    // Pour un plein rattaché à un véhicule connu, le carburant du véhicule prime.
    let factorId = c.factor!.id;
    if (lineVehicle && c.factor!.category === 'S1_MOBILE' && FUEL_FACTOR[lineVehicle.energy]) factorId = FUEL_FACTOR[lineVehicle.energy]!;
    const amount = c.line.amount ?? (checks.length === 1 ? e.totalAmount : undefined);
    const periodStart = c.line.periodStart ?? e.periodStart ?? e.date;
    const periodEnd = c.line.periodEnd ?? e.periodEnd ?? e.date;
    const y = periodEnd ? Number(periodEnd.slice(0, 4)) : NaN;
    return {
      id: uid(),
      entityId: doc.entityId,
      year: Number.isFinite(y) && y > 1990 && y < 2100 ? y : extractionYear(e, doc.year),
      factorId,
      quantity: c.quantity!,
      cost: amount,
      description: `${c.line.description}${e.supplier ? ` — ${e.supplier}` : ''}`,
      quality: 2,
      evidence: evidenceLabel(doc, e),
      periodStart,
      periodEnd,
      documentId: doc.id,
      vehicleId: lineVehicle?.id,
    };
  });
}
