import { expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import { spreadsheetToCsv } from '../documents/read';
import { parseTable } from '../documents/table';

it('lit un relevé Excel (dates, nombres) et le classe', async () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Relevé carte carburant'],
    ['Date', 'Immatriculation', 'Produit', 'Litres', 'Montant TTC'],
    [new Date(Date.UTC(2025, 3, 2)), '145 TU 2231', 'Gasoil', 60.5, 133.403],
    [new Date(Date.UTC(2025, 3, 9)), '145 TU 2231', 'Gasoil', 58.2, 128.331],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Avril');
  const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const sheets = await spreadsheetToCsv(buf);
  expect(sheets).toHaveLength(1);
  const e = parseTable(sheets[0], DEFAULT_FACTORS, 'TN');
  expect(e.lines).toHaveLength(1);
  expect(e.lines[0].quantity).toBeCloseTo(118.7, 6);
  expect(e.lines[0].plate).toBe('145 TU 2231');
  expect([e.periodStart, e.periodEnd]).toEqual(['2025-04-02', '2025-04-09']);
});
