/**
 * Lecture des fichiers téléversés, entièrement dans le navigateur :
 *  - PDF : extraction du texte avec pdf.js (exécuté sur le fil principal, sans worker séparé,
 *    pour fonctionner dans un fichier HTML unique et dans un Artifact) ;
 *  - texte / CSV : lecture directe ;
 *  - images (scans, photos) : pas de lecture du texte localement ; Claude peut les lire
 *    dans la version claude.ai.
 */

type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | undefined;

async function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const worker = await import('pdfjs-dist/build/pdf.worker.mjs');
      // pdf.js utilise ce gestionnaire sur le fil principal (« fake worker »).
      (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = worker;
      return import('pdfjs-dist');
    })();
  }
  return pdfjsPromise;
}

export function isPdf(file: { name: string; type: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImage(file: { name: string; type: string }): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic)$/i.test(file.name);
}

export function isText(file: { name: string; type: string }): boolean {
  return file.type.startsWith('text/') || /\.(txt|csv|tsv)$/i.test(file.name);
}

export function isSpreadsheet(file: { name: string; type: string }): boolean {
  return /\.(xlsx|xls|ods)$/i.test(file.name) || /spreadsheet|excel/.test(file.type);
}

export function isTabularFile(file: { name: string; type: string }): boolean {
  return isSpreadsheet(file) || /\.(csv|tsv)$/i.test(file.name);
}

/** Convertit un classeur Excel en texte CSV (séparateur « ; »), une feuille après l'autre. */
export async function spreadsheetToCsv(data: ArrayBuffer): Promise<string[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy' });
  return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ';', blankrows: false, dateNF: 'dd/mm/yyyy', rawNumbers: true })).filter((csv) => csv.trim().length > 0);
}

/** Extrait le texte d'un PDF, page par page, en reconstituant les lignes. */
export async function extractPdfText(data: ArrayBuffer, maxPages = 10): Promise<{ text: string; pages: number }> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const out: string[] = [];
  const n = Math.min(doc.numPages, maxPages);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Regroupe les fragments par ligne (coordonnée verticale) puis les trie de gauche à droite.
    const rows = new Map<number, Array<{ x: number; s: string }>>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3);
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str });
      rows.set(y, row);
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map((r) => r.s).join(' ').replace(/\s+/g, ' ').trim());
    out.push(lines.join('\n'));
  }
  await doc.destroy();
  return { text: out.join('\n\n'), pages: doc.numPages };
}

/** Rend la première page d'un PDF en image PNG (pour la lecture des PDF scannés par Claude). */
export async function renderPdfFirstPage(data: ArrayBuffer, scale = 1.6): Promise<Blob | undefined> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return await new Promise<Blob | undefined>((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), 'image/png'));
  } finally {
    await doc.destroy();
  }
}

export interface ReadResult {
  text: string;
  /** Le PDF ne contient pas de texte exploitable (document scanné). */
  scanned: boolean;
  /** Feuilles d'un tableau (CSV ou Excel), à analyser ligne par ligne. */
  sheets?: string[];
}

/** Lit le texte d'un fichier quand c'est possible localement. */
export async function readDocumentText(file: File): Promise<ReadResult> {
  if (isPdf(file)) {
    const { text } = await extractPdfText(await file.arrayBuffer());
    return { text, scanned: text.replace(/\s/g, '').length < 30 };
  }
  if (isSpreadsheet(file)) {
    const sheets = await spreadsheetToCsv(await file.arrayBuffer());
    return { text: sheets.join('\n\n'), scanned: false, sheets };
  }
  if (isText(file)) {
    const text = await file.text();
    return { text, scanned: false, sheets: /\.(csv|tsv)$/i.test(file.name) ? [text] : undefined };
  }
  return { text: '', scanned: isImage(file) };
}
