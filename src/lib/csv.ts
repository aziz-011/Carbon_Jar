import { normalize } from './classifier';

/** Parse un CSV (séparateur « ; », « , » ou tabulation détecté automatiquement, champs entre guillemets). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', '\t', ','].reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best), ';');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

/** Convertit un nombre au format français ou anglais (« 1 234,5 », « 1,234.5 »). */
export function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  let s = raw.replace(/[\s €$]/g, '').replace(/(mad|dh|tnd|eur|usd|dzd)$/i, '');
  if (!s) return undefined;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export interface ImportedRow {
  line: number;
  description: string;
  quantity?: number;
  unit?: string;
  cost?: number;
  year?: number;
  site?: string;
  evidence?: string;
}

const HEADERS: Record<keyof Omit<ImportedRow, 'line'>, string[]> = {
  description: ['description', 'libelle', 'designation', 'poste', 'activite', 'intitule', 'label'],
  quantity: ['quantite', 'qte', 'quantity', 'volume', 'consommation', 'valeur'],
  unit: ['unite', 'unit', 'u'],
  cost: ['cout', 'montant', 'cost', 'prix', 'ht', 'montant ht', 'ttc'],
  year: ['annee', 'year', 'exercice'],
  site: ['site', 'entite', 'filiale', 'etablissement'],
  evidence: ['justificatif', 'source', 'piece', 'facture', 'reference'],
};

/** Associe les colonnes d'un CSV aux champs attendus en reconnaissant les en-têtes usuels. */
export function mapRows(rows: string[][]): ImportedRow[] {
  if (rows.length < 2) return [];
  const header = rows[0].map(normalize);
  const idx: Partial<Record<keyof typeof HEADERS, number>> = {};
  for (const [key, names] of Object.entries(HEADERS) as Array<[keyof typeof HEADERS, string[]]>) {
    const i = header.findIndex((h) => names.includes(h) || names.some((n) => n.length > 3 && h.startsWith(n)));
    if (i >= 0) idx[key] = i;
  }
  if (idx.description === undefined) idx.description = 0;
  return rows.slice(1).map((r, n) => ({
    line: n + 2,
    description: r[idx.description!] ?? '',
    quantity: idx.quantity !== undefined ? parseNumber(r[idx.quantity]) : undefined,
    unit: idx.unit !== undefined ? r[idx.unit] : undefined,
    cost: idx.cost !== undefined ? parseNumber(r[idx.cost]) : undefined,
    year: idx.year !== undefined ? parseNumber(r[idx.year]) : undefined,
    site: idx.site !== undefined ? r[idx.site] : undefined,
    evidence: idx.evidence !== undefined ? r[idx.evidence] : undefined,
  }));
}

/** Sérialise un tableau en CSV (séparateur « ; », compatible Excel en français). */
export function toCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
          return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';'),
    )
    .join('\n');
}

/** Vrai lorsque l'application tourne dans un cadre intégré (ex. Artifact claude.ai) où les téléchargements sont bloqués. */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export interface ExportRequest {
  filename: string;
  content: string;
}

/**
 * Propose un fichier à l'utilisateur. Hors cadre intégré, le fichier est téléchargé ;
 * dans un cadre intégré, le contenu est affiché dans un panneau avec un bouton « Copier ».
 */
export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  if (isEmbedded()) {
    window.dispatchEvent(new CustomEvent<ExportRequest>('carbonjar:export', { detail: { filename, content } }));
    return;
  }
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const CSV_TEMPLATE = `libellé;quantité;unité;coût;année;site;justificatif
Gaz naturel chaudière;450000;kWh;40500;2025;Usine;Facture STEG gaz 2025
Gazole flotte camions;32000;L;70560;2025;Usine;Cartes carburant
Électricité STEG;1200000;kWh;360000;2025;Usine;Factures STEG
Recharge climatisation R-410A;12;kg;;2025;Usine;Registre maintenance
Billets avion;85000;p.km;;2025;Siège;Agence de voyage
Achat acier;150000;kg;600000;2025;Usine;ERP achats
`;
