import { useState } from 'react';
import { Card, PageHead, ScopeBadge } from '../components/ui';
import { categoriesOfScope, getCategory, SCOPE_LABELS } from '../data/categories';
import { GWP_SET_LABELS } from '../data/gwp';
import type { GasKey, Scope } from '../domain/types';
import { consolidationShare } from '../lib/calc';
import { fmt, fmtMoney, fmtPct } from '../lib/format';
import { downloadFile, toCsv } from '../lib/csv';
import { useStore } from '../state/store';

const GAS_LABELS: Record<GasKey, string> = {
  CO2: 'CO2',
  CH4: 'CH4',
  N2O: 'N2O',
  HFC: 'HFC',
  PFC: 'PFC',
  SF6: 'SF6',
  NF3: 'NF3',
  CO2e: 'CO2e non ventilé (facteurs agrégés)',
};

export function InventoryPage() {
  const { state, inventoryFor, years } = useStore();
  const { org } = state;
  const [year, setYear] = useState(org.reportingYear);
  const inv = inventoryFor(year);

  const exportCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['Année', 'Site', 'Scope', 'Catégorie', 'Donnée', 'Facteur', 'Quantité', 'Unité', 'Part consolidée', 't CO2e (location)', 't CO2e (market)', 'CO2 biogénique (t)', 'MWh', `Coût (${org.currency})`, 'Coût estimé', 'Qualité', 'Justificatif', 'Source du facteur'],
      ...inv.results.map((r) => [
        r.activity.year,
        r.entity?.name ?? '',
        r.scope,
        getCategory(r.category).label,
        r.activity.description ?? '',
        r.factor.label,
        r.activity.quantity,
        r.factor.unit,
        r.consolidationShare,
        +(r.kgCO2e / 1000).toFixed(4),
        +(r.kgCO2eMarket / 1000).toFixed(4),
        +(r.biogenicKg / 1000).toFixed(4),
        +(r.energyKwh / 1000).toFixed(3),
        +r.cost.toFixed(2),
        r.costEstimated ? 'oui' : 'non',
        r.activity.quality,
        r.activity.evidence ?? '',
        r.factor.source,
      ]),
    ];
    downloadFile(`inventaire-ges-${year}.csv`, toCsv(rows));
  };

  const catRow = (scope: Scope) =>
    categoriesOfScope(scope)
      .map((c) => {
        const rs = inv.results.filter((r) => r.category === c.id);
        return {
          c,
          n: rs.length,
          t: rs.reduce((s, r) => s + r.kgCO2e, 0) / 1000,
          tm: rs.reduce((s, r) => s + r.kgCO2eMarket, 0) / 1000,
          mwh: rs.reduce((s, r) => s + r.energyKwh, 0) / 1000,
          cost: rs.reduce((s, r) => s + r.cost, 0),
        };
      })
      .filter((x) => x.n > 0);

  const total = inv.totalLocation || 1;

  return (
    <div className="stack">
      <PageHead
        title="Inventaire GES"
        intro="Émissions consolidées par scope, catégorie et gaz. Les Scopes 1 et 2 sont déclarés séparément ; le Scope 2 selon les deux méthodes ; le CO2 biogénique et les gaz hors Kyoto hors scopes."
        actions={
          <>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année">
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <button onClick={exportCsv}>⬇ Export CSV (piste d’audit)</button>
          </>
        }
      />

      <Card title="Synthèse par scope">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scope / catégorie</th>
                <th className="num">t CO2e</th>
                <th className="num">Part</th>
                <th className="num">Énergie (MWh)</th>
                <th className="num">Coût ({org.currency})</th>
                <th className="num">Lignes</th>
              </tr>
            </thead>
            <tbody>
              {([1, 2, 3] as Scope[]).map((s) => {
                const rows = catRow(s);
                const st = s === 1 ? inv.scope1 : s === 2 ? inv.scope2Location : inv.scope3;
                return [
                  <tr key={`s${s}`} className="total">
                    <td>
                      <ScopeBadge scope={s} /> {SCOPE_LABELS[s].title.split('—')[1]}
                      {s === 2 && <span className="small muted"> (location-based)</span>}
                    </td>
                    <td className="num">{fmt(st)}</td>
                    <td className="num">{fmtPct(st / total, 1)}</td>
                    <td className="num">{fmt(inv.energyByScope[s])}</td>
                    <td className="num">{fmt(inv.costByScope[s], 0)}</td>
                    <td className="num">{rows.reduce((a, r) => a + r.n, 0)}</td>
                  </tr>,
                  ...rows.map((r) => (
                    <tr key={r.c.id}>
                      <td style={{ paddingLeft: 28 }}>{r.c.label}</td>
                      <td className="num">{fmt(r.t)}</td>
                      <td className="num">{fmtPct(r.t / total, 1)}</td>
                      <td className="num">{r.mwh ? fmt(r.mwh) : '—'}</td>
                      <td className="num">{r.cost ? fmt(r.cost, 0) : '—'}</td>
                      <td className="num">{r.n}</td>
                    </tr>
                  )),
                ];
              })}
              <tr className="total">
                <td>Total (Scope 2 location-based)</td>
                <td className="num">{fmt(inv.totalLocation)}</td>
                <td className="num">100 %</td>
                <td className="num">{fmt(inv.energyMWh)}</td>
                <td className="num">{fmt(inv.cost, 0)}</td>
                <td className="num">{inv.results.length}</td>
              </tr>
              <tr className="sub">
                <td>Total (Scope 2 market-based)</td>
                <td className="num">{fmt(inv.totalMarket)}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Scope 2 — double reporting">
          <table>
            <thead>
              <tr>
                <th>Flux</th>
                <th className="num">Location-based</th>
                <th className="num">Market-based</th>
              </tr>
            </thead>
            <tbody>
              {catRow(2).map((r) => (
                <tr key={r.c.id}>
                  <td>{r.c.label}</td>
                  <td className="num">{fmt(r.t)}</td>
                  <td className="num">{fmt(r.tm)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total Scope 2 (t CO2e)</td>
                <td className="num">{fmt(inv.scope2Location)}</td>
                <td className="num">{fmt(inv.scope2Market)}</td>
              </tr>
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 8 }}>
            Instruments utilisés :{' '}
            {[...new Set(inv.results.filter((r) => r.scope === 2).map((r) => r.activity.instrument ?? 'none'))]
              .map((i) => ({ none: 'aucun (moyenne réseau)', ppa: 'PPA / contrat direct', eac: 'GO / REC', supplier: 'facteur fournisseur', residual: 'mix résiduel' })[i])
              .join(', ') || '—'}
          </p>
        </Card>

        <Card title="Scopes 1 + 2 — ventilation par gaz (t CO2e)">
          <table>
            <tbody>
              {(Object.keys(GAS_LABELS) as GasKey[])
                .filter((g) => (inv.byGasScope12[g] ?? 0) > 0)
                .map((g) => (
                  <tr key={g}>
                    <td>{GAS_LABELS[g]}</td>
                    <td className="num">{fmt(inv.byGasScope12[g])}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 8 }}>PRG : {GWP_SET_LABELS[org.gwpSet]}.</p>
        </Card>
      </div>

      <Card title="Informations déclarées séparément (hors scopes)">
        <table>
          <tbody>
            <tr>
              <td>
                <ScopeBadge scope="memo" /> CO2 biogénique (combustion de biomasse)
              </td>
              <td className="num">{fmt(inv.biogenicT)} t CO2</td>
            </tr>
            <tr>
              <td>
                <ScopeBadge scope="hors-inventaire" /> Gaz hors Kyoto (HCFC, CFC…)
              </td>
              <td className="num">{fmt(inv.nonKyotoT)} t CO2e</td>
            </tr>
            <tr>
              <td>
                <span className="badge neutral">Information</span> Crédits carbone achetés (non soustraits)
              </td>
              <td className="num">{year === org.reportingYear ? `${fmt(org.offsetsTco2e)} t CO2e` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Détail par site">
        <table>
          <thead>
            <tr>
              <th>Site / entité</th>
              <th className="num">Consolidation</th>
              <th className="num">Scope 1</th>
              <th className="num">Scope 2 (LB)</th>
              <th className="num">Scope 3</th>
              <th className="num">Coût</th>
            </tr>
          </thead>
          <tbody>
            {state.entities.map((e) => {
              const rs = inv.results.filter((r) => r.entity?.id === e.id);
              const sum = (s: Scope) => rs.filter((r) => r.scope === s).reduce((a, r) => a + r.kgCO2e, 0) / 1000;
              return (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td className="num">{fmt(consolidationShare(e, org.consolidation) * 100)} %</td>
                  <td className="num">{fmt(sum(1))}</td>
                  <td className="num">{fmt(sum(2))}</td>
                  <td className="num">{fmt(sum(3))}</td>
                  <td className="num">{fmtMoney(rs.reduce((a, r) => a + r.cost, 0), org.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
