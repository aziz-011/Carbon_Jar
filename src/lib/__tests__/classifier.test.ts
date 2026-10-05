import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import { DECISION_TREE, classify } from '../classifier';
import { mapRows, parseCsv, parseNumber } from '../csv';

const cases: Array<[string, string | undefined, number, string]> = [
  ['Facture gaz naturel chaudière', 'kWh', 1, 'S1_STATIONARY'],
  ['Gazole flotte camions', 'L', 1, 'S1_MOBILE'],
  ['Électricité EDF', 'kWh', 2, 'S2_ELECTRICITY'],
  ['Facture électricité STEG', 'kWh', 2, 'S2_ELECTRICITY'],
  ['Recharge climatisation R-410A', 'kg', 1, 'S1_FUGITIVE'],
  ['Billets avion Paris-Casablanca', 'p.km', 3, 'S3_C6'],
  ['Achat acier', 'kg', 3, 'S3_C1'],
  ['Transporteur externe livraison', 't.km', 3, 'S3_C4'],
  ['Déchets mis en décharge', 't', 3, 'S3_C5'],
  ['Réseau de chaleur urbain', 'kWh', 2, 'S2_HEAT'],
  ['Trajets domicile travail des salariés en voiture', 'km', 3, 'S3_C7'],
  ['Granulés bois chaufferie', 'kg', 1, 'S1_STATIONARY'],
];

describe('classification automatique', () => {
  it.each(cases)('%s → Scope %i', (text, unit, scope, category) => {
    const r = classify(text, DEFAULT_FACTORS, unit);
    expect(r.scope).toBe(scope);
    expect(r.category).toBe(category);
  });

  it('électricité sans pays précisé → réseau tunisien', () => {
    expect(classify('Facture électricité STEG', DEFAULT_FACTORS, 'kWh').best?.factor.id).toBe('elec_TN');
  });

  it('véhicule électrique de la flotte → Scope 2', () => {
    expect(classify('Recharge des véhicules électriques de la flotte', DEFAULT_FACTORS, 'kWh').scope).toBe(2);
  });

  it('texte inconnu → pas de proposition', () => {
    expect(classify('xyz', DEFAULT_FACTORS).best).toBeUndefined();
  });
});

describe('arbre de décision', () => {
  it('toutes les branches mènent à un nœud existant ou à un résultat', () => {
    for (const node of Object.values(DECISION_TREE)) {
      for (const o of node.options) {
        expect(Boolean(o.outcome) || Boolean(o.next && DECISION_TREE[o.next])).toBe(true);
      }
    }
  });
});

describe('import CSV', () => {
  it('nombres français et anglais', () => {
    expect(parseNumber('1 234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('45 000 €')).toBe(45000);
    expect(parseNumber('')).toBeUndefined();
  });

  it('détecte séparateur et en-têtes', () => {
    const rows = mapRows(parseCsv('Libellé;Quantité;Unité;Montant HT\n"Gaz; chaudière";1 000;kWh;100\n'));
    expect(rows).toEqual([{ line: 2, description: 'Gaz; chaudière', quantity: 1000, unit: 'kWh', cost: 100, year: undefined, site: undefined, evidence: undefined }]);
  });
});
