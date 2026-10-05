import { useEffect, useRef, useState } from 'react';
import type { DocType, DocumentRecord, Extraction } from '../domain/types';
import { aiExtract, aiImageSupport, getSample } from '../lib/documents/ai';
import { checkLines, extractionToActivities, mergeVehicle } from '../lib/documents/commit';
import { detectDocType, parseDocument } from '../lib/documents/parse';
import { isImage, isPdf, readDocumentText, renderPdfFirstPage } from '../lib/documents/read';
import { saveFile } from '../lib/fileStore';
import { uid } from '../lib/format';
import { useStore } from './store';

export const AUTO_THRESHOLD = 0.8;

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

/**
 * Chaîne de traitement d'un document, commune au portail client et à l'espace cabinet :
 * enregistrement du fichier → lecture du texte → extraction (Claude ou règles) → classement
 * par scope → validation automatique si l'extraction est sûre, sinon file de vérification.
 */
export function useDocumentPipeline() {
  const { state, dispatch, factors, factorById } = useStore();
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiImages, setAiImages] = useState(false);
  const [queue, setQueue] = useState<Array<{ key: string; name: string; step: string }>>([]);
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
    const vehicle = mergeVehicle(stateRef.current.vehicles, e, doc);
    const activities = extractionToActivities(doc, e, factorById, vehicle);
    dispatch({ type: 'document:upsert', document: { ...doc, extraction: e } });
    dispatch({ type: 'document:validate', documentId: doc.id, activities, vehicle });
  };

  /** Valide un document si l'extraction est complète et suffisamment sûre. */
  const isSafe = (e: Extraction): boolean => {
    if (e.confidence < AUTO_THRESHOLD) return false;
    const checks = checkLines(e, factorById);
    const vehicleOnly = (e.docType === 'carte_grise' || e.docType === 'fiche_vehicule') && !!e.vehicle?.plate;
    return vehicleOnly || (checks.length > 0 && checks.every((c) => c.ok));
  };

  const analyse = async (opts: { file?: File; doc: DocumentRecord; text: string; scanned: boolean; wantAi: boolean; hintType?: DocType }): Promise<Extraction> => {
    const { file, doc, text, scanned, wantAi, hintType } = opts;
    const country = countryOf(doc.entityId);
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

  const processFiles = async (files: IncomingFile[], opts: ProcessOptions) => {
    for (const f of files) {
      const isFile = f instanceof File;
      const key = uid();
      const name = f.name;
      setQueue((q) => [...q, { key, name, step: 'Lecture…' }]);
      const step = (s: string) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, step: s } : x)));
      const doc: DocumentRecord = {
        id: uid(),
        name,
        size: isFile ? f.size : f.text.length,
        mime: isFile ? f.type || 'application/octet-stream' : 'text/plain',
        uploadedAt: new Date().toISOString(),
        entityId: opts.entityId,
        year: opts.year,
        status: 'a_valider',
        activityIds: [],
        sample: !isFile,
        source: opts.source,
        requestId: opts.requestId,
      };
      try {
        const file = isFile ? f : new File([f.text], name, { type: 'text/plain' });
        await saveFile(doc.id, file);
        const { text, scanned } = isFile ? await readDocumentText(f) : { text: f.text, scanned: false };
        step(opts.useAi && aiAvailable ? 'Lecture par Claude…' : 'Extraction et classement…');
        const extraction = await analyse({ file, doc, text, scanned, wantAi: opts.useAi, hintType: opts.hintType });
        const full: DocumentRecord = { ...doc, text, extraction };
        dispatch({ type: 'document:upsert', document: full });
        if (opts.autoValidate && isSafe(extraction)) validate(full, extraction);
      } catch (err) {
        dispatch({ type: 'document:upsert', document: { ...doc, status: 'erreur', error: err instanceof Error ? err.message : 'Lecture impossible' } });
      } finally {
        setQueue((q) => q.filter((x) => x.key !== key));
      }
    }
  };

  return { aiAvailable, aiImages, queue, processFiles, validate, analyse };
}
