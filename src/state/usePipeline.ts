import { useEffect, useRef, useState } from 'react';
import { getCategory } from '../data/categories';
import type { DocType, DocumentRecord, Extraction, Scope } from '../domain/types';
import { aiExtract, aiImageSupport, getSample } from '../lib/documents/ai';
import { blocksAutoValidation, fileHash, runChecks } from '../lib/documents/checks';
import { checkLines, extractionToActivities, mergeVehicle, vehiclesFromLines } from '../lib/documents/commit';
import { DOC_TYPE_LABELS, detectDocType, parseDocument } from '../lib/documents/parse';
import { isImage, isPdf, isSpreadsheet, readDocumentText, renderPdfFirstPage } from '../lib/documents/read';
import { looksTabular, parseTable } from '../lib/documents/table';
import { saveFile } from '../lib/fileStore';
import { fmt, uid } from '../lib/format';
import { useStore } from './store';

export const AUTO_THRESHOLD = 0.8;
export const MAX_FILE_MB = 25;
export const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.tsv,.xlsx,.xls,.ods,application/pdf,image/*,text/plain,text/csv';

export interface ProcessOptions {
  entityId: string;
  year: number;
  autoValidate: boolean;
  useAi: boolean;
  source: 'client' | 'cabinet';
  requestId?: string;
  hintType?: DocType;
}

export type IncomingFile = File | { name: string; text: string };

export type ReceiptOutcome = 'integre' | 'a_verifier' | 'doublon' | 'refuse' | 'erreur';

/** Accusé de réception d'un fichier : ce qui a été lu et ce qu'il est devenu. */
export interface Receipt {
  key: string;
  name: string;
  outcome: ReceiptOutcome;
  docId?: string;
  docType?: DocType;
  summary: string;
  reason?: string;
  scopes: Scope[];
  at: string;
}

export interface QueueItem {
  key: string;
  name: string;
  step: number;
  label: string;
}

export const PIPELINE_STEPS = ['Réception', 'Lecture', 'Extraction', 'Contrôles', 'Classement'];

function rejectReason(f: IncomingFile): string | undefined {
  if (!(f instanceof File)) return undefined;
  if (f.size === 0) return 'Fichier vide.';
  if (f.size > MAX_FILE_MB * 1024 * 1024) return `Fichier trop volumineux (${fmt(f.size / 1024 / 1024, 1)} Mo, maximum ${MAX_FILE_MB} Mo).`;
  const ok = isPdf(f) || isImage(f) || isSpreadsheet(f) || /\.(txt|csv|tsv)$/i.test(f.name) || f.type.startsWith('text/');
  if (!ok) return 'Format non pris en charge : envoyez un PDF, une photo (JPG, PNG), un fichier Excel ou CSV.';
  return undefined;
}

/**
 * Chaîne de traitement d'un document, commune au portail client et à l'espace cabinet :
 * contrôle du fichier → empreinte (doublons) → lecture du texte ou du tableau →
 * extraction (Claude ou règles) → contrôles de cohérence → classement par scope →
 * intégration automatique si tout est sûr, sinon file de vérification.
 */
export function useDocumentPipeline() {
  const { state, dispatch, factors, factorById } = useStore();
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiImages, setAiImages] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  // Dernier état connu (les traitements s'enchaînent de manière asynchrone).
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    getSample().then((s) => alive && setAiAvailable(!!s));
    aiImageSupport().then((i) => alive && setAiImages(!!i));
    return () => {
      alive = false;
    };
  }, []);

  const countryOf = (entityId: string) => stateRef.current.entities.find((e) => e.id === entityId)?.country ?? 'TN';

  const validate = (doc: DocumentRecord, e: Extraction) => {
    const st = stateRef.current;
    const vehicle = mergeVehicle(st.vehicles, e, doc);
    const newVehicles = vehiclesFromLines(vehicle ? [...st.vehicles, vehicle] : st.vehicles, e, doc, factorById);
    const fleet = [...st.vehicles, ...(vehicle ? [vehicle] : []), ...newVehicles];
    const activities = extractionToActivities(doc, e, factorById, vehicle, fleet);
    dispatch({ type: 'document:upsert', document: { ...doc, extraction: e } });
    dispatch({ type: 'document:validate', documentId: doc.id, activities, vehicle, newVehicles });
  };

  /** Extraction complète, sûre et sans alerte : intégrable sans vérification humaine. */
  const isSafe = (e: Extraction, doc: DocumentRecord): boolean => {
    if (e.confidence < AUTO_THRESHOLD || blocksAutoValidation(doc.checks ?? [])) return false;
    const checks = checkLines(e, factorById);
    const vehicleOnly = (e.docType === 'carte_grise' || e.docType === 'fiche_vehicule') && !!e.vehicle?.plate;
    return vehicleOnly || (checks.length > 0 && checks.every((c) => c.ok));
  };

  const analyse = async (opts: { file?: File; doc: DocumentRecord; text: string; scanned: boolean; wantAi: boolean; hintType?: DocType; sheets?: string[] }): Promise<Extraction> => {
    const { file, doc, text, scanned, wantAi, hintType, sheets } = opts;
    const country = countryOf(doc.entityId);
    // Tableaux (Excel, CSV) : analyse déterministe ligne par ligne.
    const tables = sheets?.filter(looksTabular) ?? [];
    if (tables.length) {
      const parts = tables.map((t) => parseTable(t, factors, country, hintType));
      const lines = parts.flatMap((p) => p.lines);
      const dates = parts.flatMap((p) => [p.periodStart, p.periodEnd]).filter((d): d is string => !!d).sort();
      return {
        ...parts[0],
        lines,
        periodStart: dates[0],
        periodEnd: dates[dates.length - 1],
        totalAmount: parts.reduce((s, p) => s + (p.totalAmount ?? 0), 0) || undefined,
        confidence: Math.min(...parts.map((p) => p.confidence)),
        warnings: parts.flatMap((p) => p.warnings),
      };
    }
    if (wantAi && aiAvailable) {
      let image: Blob | undefined;
      if (file && isImage(file) && aiImages) image = file;
      else if (file && isPdf(file) && scanned && aiImages) image = await renderPdfFirstPage(await file.arrayBuffer());
      if (text.trim() || image) {
        try {
          return await aiExtract({ text, filename: doc.name, image, factors, country });
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code === 'not_granted' || code === 'sampling_disabled') setAiAvailable(false);
          // Repli sur l'analyse locale du texte.
        }
      }
    }
    if (text.trim()) return parseDocument(text, doc.name, factors, country, hintType);
    const guess = detectDocType('', doc.name);
    return {
      docType: hintType && guess.score < 4 ? hintType : guess.type,
      method: 'manuel',
      lines: [],
      confidence: 0,
      warnings: [
        scanned
          ? 'Document scanné ou photo : le texte n’a pas pu être lu sur cet appareil. Les valeurs seront saisies lors de la vérification (lecture automatique disponible sur claude.ai).'
          : 'Aucun texte lisible : les valeurs seront saisies lors de la vérification.',
      ],
    };
  };

  const summarize = (e: Extraction): { summary: string; scopes: Scope[] } => {
    const parts: string[] = [DOC_TYPE_LABELS[e.docType] + (e.supplier ? ` ${e.supplier}` : '')];
    const scopes = new Set<Scope>();
    for (const l of e.lines) {
      const f = l.factorId ? factorById.get(l.factorId) : undefined;
      if (f) scopes.add(getCategory(f.category).scope);
    }
    const first = e.lines[0];
    if (first?.quantity !== undefined) parts.push(`${fmt(first.quantity, Math.abs(first.quantity) < 100 ? 3 : 0)} ${first.unit ?? ''}`.trim() + (e.lines.length > 1 ? ` (+ ${e.lines.length - 1} ligne(s))` : ''));
    if (e.vehicle?.plate) parts.push(`véhicule ${e.vehicle.plate}`);
    if (e.periodStart && e.periodEnd) parts.push(`${e.periodStart} → ${e.periodEnd}`);
    return { summary: parts.join(' · '), scopes: [...scopes].sort() };
  };

  const pushReceipt = (r: Omit<Receipt, 'at'>) => setReceipts((rs) => [{ ...r, at: new Date().toISOString() }, ...rs].slice(0, 50));

  const processFiles = async (files: IncomingFile[], opts: ProcessOptions) => {
    // Tous les fichiers apparaissent tout de suite dans la file, puis sont traités un par un.
    const items = files.map((f) => ({ f, key: uid() }));
    setQueue((q) => [...q, ...items.map(({ f, key }) => ({ key, name: f.name, step: 0, label: 'En attente' }))]);
    for (const { f, key } of items) {
      const name = f.name;
      const step = (n: number) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, step: n, label: PIPELINE_STEPS[n] } : x)));
      const done = () => setQueue((q) => q.filter((x) => x.key !== key));
      step(0);
      const refused = rejectReason(f);
      if (refused) {
        pushReceipt({ key, name, outcome: 'refuse', summary: 'Fichier refusé', reason: refused, scopes: [] });
        done();
        continue;
      }
      const isFile = f instanceof File;
      const file = isFile ? f : new File([f.text], name, { type: 'text/plain' });
      try {
        const buf = await file.arrayBuffer();
        const hash = await fileHash(buf, `${name}:${file.size}`);
        const dup = stateRef.current.documents.find((d) => d.hash === hash && d.status !== 'rejete');
        if (dup) {
          pushReceipt({ key, name, outcome: 'doublon', docId: dup.id, summary: 'Déjà reçu', reason: `Ce fichier a déjà été déposé (« ${dup.name} ») : il n’a pas été ajouté une seconde fois.`, scopes: [] });
          done();
          continue;
        }
        const doc: DocumentRecord = {
          id: uid(),
          name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          entityId: opts.entityId,
          year: opts.year,
          status: 'a_valider',
          activityIds: [],
          sample: !isFile,
          source: opts.source,
          requestId: opts.requestId,
          hash,
        };
        await saveFile(doc.id, file);
        step(1);
        const read = isFile ? await readDocumentText(f) : { text: f.text, scanned: false, sheets: /\.(csv|tsv)$/i.test(name) ? [f.text] : undefined };
        step(2);
        const extraction = await analyse({ file, doc, text: read.text, scanned: read.scanned, wantAi: opts.useAi, hintType: opts.hintType, sheets: read.sheets });
        step(3);
        const st = stateRef.current;
        const checks = runChecks(doc, extraction, { documents: st.documents, activities: st.activities, factors: factorById, reportingYear: st.org.reportingYear });
        const full: DocumentRecord = { ...doc, text: read.text, extraction, checks };
        dispatch({ type: 'document:upsert', document: full });
        step(4);
        const { summary, scopes } = summarize(extraction);
        if (opts.autoValidate && isSafe(extraction, full)) {
          validate(full, extraction);
          pushReceipt({ key, name, outcome: 'integre', docId: doc.id, docType: extraction.docType, summary, scopes });
        } else {
          const alert = checks.find((c) => c.level !== 'info');
          const reason =
            alert?.message ??
            (extraction.lines.length === 0 && !extraction.vehicle?.plate
              ? 'Aucune quantité lue automatiquement : nos ingénieurs vont la saisir.'
              : extraction.confidence < AUTO_THRESHOLD
                ? `Lecture incertaine (confiance ${Math.round(extraction.confidence * 100)} %) : vérification par nos ingénieurs.`
                : 'Vérification par nos ingénieurs.');
          pushReceipt({ key, name, outcome: 'a_verifier', docId: doc.id, docType: extraction.docType, summary, reason, scopes });
        }
      } catch (err) {
        pushReceipt({ key, name, outcome: 'erreur', summary: 'Lecture impossible', reason: err instanceof Error ? err.message : 'Le fichier n’a pas pu être lu.', scopes: [] });
      } finally {
        done();
      }
    }
  };

  /** Intègre d'un coup les pièces en attente dont l'extraction est complète et sans aucune alerte. */
  const validateMany = (docs: DocumentRecord[]): number => {
    let n = 0;
    for (const d of docs) {
      const e = d.extraction;
      if (!e || d.status !== 'a_valider') continue;
      const lines = checkLines(e, factorById);
      const ok = (lines.length > 0 && lines.every((c) => c.ok)) || (!!e.vehicle?.plate && e.lines.length === 0);
      // Seules les pièces sans aucune alerte sont intégrées d'un coup ; les autres s'ouvrent une à une.
      if (!ok || (d.checks ?? []).some((c) => c.level !== 'info')) continue;
      validate(d, e);
      n++;
    }
    return n;
  };

  return { aiAvailable, aiImages, queue, receipts, clearReceipts: () => setReceipts([]), processFiles, validate, validateMany, analyse };
}
