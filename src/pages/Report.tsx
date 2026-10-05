import { Icon } from '../components/Icon';
import { Card, PageHead, ScopeBadge } from '../components/ui';
import { categoriesOfScope, getCategory } from '../data/categories';
import { GWP_SET_LABELS } from '../data/gwp';
import type { DataQuality, Scope } from '../domain/types';
import { carbonCostExposure, intensityRatio } from '../lib/calc';
import { downloadFile, isEmbedded } from '../lib/csv';
import { fmt, fmtMoney, fmtPct } from '../lib/format';
import { useStore } from '../state/store';
import { APPROACHES } from './Boundary';

export function Report() {
  const { state, inventory: inv, inventoryFor, years } = useStore();
  const { org } = state;
  const base = inventoryFor(org.baseYear);
  const approach = APPROACHES.find(([id]) => id === org.consolidation)!;
  const metric = org.intensityMetric[org.reportingYear];
  const instruments = [...new Set(inv.results.filter((r) => r.scope === 2).map((r) => r.activity.instrument ?? 'none'))];
  const qualityShare = (q: DataQuality) => (inv.totalLocation ? inv.results.filter((r) => r.activity.quality === q).reduce((s, r) => s + r.kgCO2e / 1000, 0) / inv.totalLocation : 0);
  const withEvidence = inv.results.length ? inv.results.filter((r) => r.activity.evidence).length / inv.results.length : 0;

  const checks: Array<[string, boolean, string]> = [
    ['Périmètre organisationnel et approche de consolidation décrits', state.entities.length > 0, approach[1]],
    ['Scopes 1 et 2 déclarés séparément', inv.scope1 > 0 && inv.scope2Location > 0, `${fmt(inv.scope1)} t / ${fmt(inv.scope2Location)} t`],
    ['Ventilation des Scopes 1 et 2 par gaz', Object.keys(inv.byGasScope12).length > 0, `${Object.keys(inv.byGasScope12).length} gaz`],
    ['Scope 2 en double reporting (location / market)', inv.scope2Location > 0, `${fmt(inv.scope2Location)} / ${fmt(inv.scope2Market)} t`],
    ['CO2 biogénique déclaré séparément', true, `${fmt(inv.biogenicT)} t`],
    ['Année de base et profil historique', base.results.length > 0, String(org.baseYear)],
    ['Source des PRG indiquée', true, org.gwpSet],
    ['Exclusions documentées et justifiées', org.exclusions.trim().length > 0, org.exclusions ? 'oui' : 'à compléter'],
    ['Piste d’audit : justificatifs rattachés', withEvidence >= 0.8, fmtPct(withEvidence)],
    ['Crédits carbone non soustraits des émissions brutes', true, `${fmt(org.offsetsTco2e)} t déclarées à part`],
    ['Scope 3 (optionnel, exigé par la CSRD si matériel)', inv.scope3 > 0, `${fmt(inv.scope3)} t`],
  ];

  const exportJson = () => downloadFile(`carbon-jar-${org.reportingYear}.json`, JSON.stringify(state, null, 2), 'application/json');

  return (
    <div className="stack">
      <PageHead
        eyebrow="Rapport"
        icon="shield"
        title={`Rapport GES ${org.reportingYear}`}
        intro="Rapport structuré selon les exigences de déclaration du GHG Protocol (informations requises et optionnelles). Imprimez-le en PDF pour le partager ou le transmettre à un vérificateur."
        actions={
          <>
            {!isEmbedded() && <button onClick={() => window.print()}><Icon name="printer" size={15} /> Imprimer / PDF</button>}
            <button onClick={exportJson}><Icon name="download" size={15} /> Sauvegarde JSON</button>
          </>
        }
      />

      <Card icon="checks" title="Liste de contrôle de conformité">
        <table>
          <tbody>
            {checks.map(([label, ok, detail]) => (
              <tr key={label}>
                <td style={{ width: 28 }}>{ok ? <Icon name="checkCircle" size={17} className="ok-ico" /> : <Icon name="alert" size={17} className="warn-ico" />}</td>
                <td>{label}</td>
                <td className="right muted">{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="1. Description de l’organisation et des périmètres">
        <table>
          <tbody>
            <tr><td>Organisation</td><td>{org.name}</td></tr>
            <tr><td>Période couverte</td><td>1er janvier – 31 décembre {org.reportingYear}</td></tr>
            <tr><td>Approche de consolidation</td><td>{approach[1]} — {approach[2]}</td></tr>
            <tr><td>Entités incluses</td><td>{state.entities.map((e) => e.name).join(', ')}</td></tr>
            <tr><td>Périmètre opérationnel</td><td>Scopes 1 et 2 complets ; Scope 3 : {categoriesOfScope(3).filter((c) => inv.byCategory[c.id]).map((c) => c.label.split('.')[0]).join(', ') || 'non couvert'}</td></tr>
            <tr><td>PRG utilisés</td><td>{GWP_SET_LABELS[org.gwpSet]}</td></tr>
            <tr><td>Exclusions</td><td>{org.exclusions || '—'}</td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="2. Émissions par scope (t CO2e)">
        <table>
          <thead>
            <tr><th>Poste</th><th className="num">{org.reportingYear}</th>{org.baseYear !== org.reportingYear && <th className="num">{org.baseYear} (base)</th>}{org.baseYear !== org.reportingYear && <th className="num">Évolution</th>}</tr>
          </thead>
          <tbody>
            {([
              ['Scope 1', inv.scope1, base.scope1],
              ['Scope 2 — location-based', inv.scope2Location, base.scope2Location],
              ['Scope 2 — market-based', inv.scope2Market, base.scope2Market],
              ['Scope 3', inv.scope3, base.scope3],
              ['Total (S2 location-based)', inv.totalLocation, base.totalLocation],
              ['Total (S2 market-based)', inv.totalMarket, base.totalMarket],
            ] as Array<[string, number, number]>).map(([l, v, b]) => (
              <tr key={l} className={l.startsWith('Total') ? 'total' : ''}>
                <td>{l}</td>
                <td className="num">{fmt(v)}</td>
                {org.baseYear !== org.reportingYear && <td className="num">{fmt(b)}</td>}
                {org.baseYear !== org.reportingYear && <td className="num">{b ? fmtPct((v - b) / b, 1) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid g2">
        <Card title="3. Scopes 1 et 2 par gaz">
          <table>
            <tbody>
              {Object.entries(inv.byGasScope12).map(([g, v]) => (
                <tr key={g}><td>{g === 'CO2e' ? 'CO2e (facteurs agrégés)' : g}</td><td className="num">{fmt(v)} t CO2e</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="4. Instruments market-based">
          <ul className="clean">
            {instruments.map((i) => (
              <li key={i}>{{ none: 'Aucun instrument — moyenne réseau (mix résiduel non disponible)', ppa: 'Contrat direct / PPA', eac: 'Garanties d’origine / RECs (annulés dans un registre)', supplier: 'Facteur spécifique du fournisseur', residual: 'Mix résiduel' }[i]}</li>
            ))}
          </ul>
          <p className="small muted">Méthode retenue pour le suivi des objectifs : {state.targets.map((t) => `${t.name} (${t.scope2Method}-based)`).join(' ; ') || '—'}</p>
        </Card>
      </div>

      <Card title="5. Détail par catégorie">
        <table>
          <thead><tr><th>Catégorie</th><th className="num">t CO2e</th><th className="num">MWh</th><th className="num">Coût ({org.currency})</th></tr></thead>
          <tbody>
            {([1, 2, 3] as Scope[]).flatMap((s) =>
              categoriesOfScope(s)
                .filter((c) => inv.byCategory[c.id])
                .map((c) => {
                  const rs = inv.results.filter((r) => r.category === c.id);
                  return (
                    <tr key={c.id}>
                      <td><ScopeBadge scope={s} /> {c.label}</td>
                      <td className="num">{fmt(inv.byCategory[c.id])}</td>
                      <td className="num">{fmt(rs.reduce((a, r) => a + r.energyKwh, 0) / 1000)}</td>
                      <td className="num">{fmt(rs.reduce((a, r) => a + r.cost, 0), 0)}</td>
                    </tr>
                  );
                }),
            )}
          </tbody>
        </table>
      </Card>

      <div className="grid g2">
        <Card title="6. Informations séparées et indicateurs">
          <table>
            <tbody>
              <tr><td>CO2 biogénique (poste mémo)</td><td className="num">{fmt(inv.biogenicT)} t</td></tr>
              <tr><td>Gaz hors Kyoto</td><td className="num">{fmt(inv.nonKyotoT)} t CO2e</td></tr>
              <tr><td>Crédits carbone achetés (non déduits)</td><td className="num">{fmt(org.offsetsTco2e)} t CO2e</td></tr>
              <tr><td>Intensité ({org.intensityMetricLabel})</td><td className="num">{intensityRatio(inv.totalLocation, metric) !== undefined ? `${fmt(intensityRatio(inv.totalLocation, metric), 4)} t CO2e/unité` : '—'}</td></tr>
              <tr><td>Énergie totale</td><td className="num">{fmt(inv.energyMWh)} MWh</td></tr>
              <tr><td>Dépenses associées</td><td className="num">{fmtMoney(inv.cost, org.currency)}</td></tr>
              <tr><td>Exposition carbone S1+S2 ({fmt(org.carbonPrice)} {org.currency}/t)</td><td className="num">{fmtMoney(carbonCostExposure(inv.scope1 + inv.scope2Location, org.carbonPrice), org.currency)}</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="7. Qualité des données">
          <table>
            <tbody>
              {([1, 2, 3, 4] as DataQuality[]).map((q) => (
                <tr key={q}>
                  <td>Niveau {q} — {['Mesure directe', 'Donnée facturée', 'Calcul équipement', 'Estimation'][q - 1]}</td>
                  <td className="num">{fmtPct(qualityShare(q))} des émissions</td>
                </tr>
              ))}
              <tr><td>Données avec justificatif</td><td className="num">{fmtPct(withEvidence)}</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="8. Profil historique (t CO2e)">
        <table>
          <thead><tr><th>Année</th><th className="num">Scope 1</th><th className="num">Scope 2 LB</th><th className="num">Scope 2 MB</th><th className="num">Scope 3</th><th className="num">Total LB</th></tr></thead>
          <tbody>
            {years.map((y) => {
              const i = inventoryFor(y);
              return (
                <tr key={y}>
                  <td>{y}{y === org.baseYear && ' (base)'}</td>
                  <td className="num">{fmt(i.scope1)}</td>
                  <td className="num">{fmt(i.scope2Location)}</td>
                  <td className="num">{fmt(i.scope2Market)}</td>
                  <td className="num">{fmt(i.scope3)}</td>
                  <td className="num">{fmt(i.totalLocation)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="9. Note méthodologique">
        <ul className="clean">
          <li>Calcul : Émissions = Donnée d’activité × Facteur d’émission ; agrégation en CO2e par les PRG ({org.gwpSet}).</li>
          <li>Combustibles : facteurs par défaut du GIEC 2006 appliqués aux PCI ; électricité : facteurs moyens nationaux (location-based) et instruments contractuels (market-based) selon la hiérarchie du Scope 2 Guidance.</li>
          <li>Fluides frigorigènes : bilan massique (charge initiale + recharges − charge finale) × PRG.</li>
          <li>Coûts : montants facturés lorsque disponibles, sinon estimés avec des prix unitaires par défaut ({fmtPct(inv.costEstimatedShare)} des coûts estimés).</li>
          <li>Sources des facteurs : {[...new Set(inv.results.map((r) => r.factor.source.split(' — ')[0]))].join(' ; ')}.</li>
          <li>Catégories couvertes : {[...new Set(inv.results.map((r) => getCategory(r.category).label))].length} catégories, {inv.results.length} données d’activité.</li>
        </ul>
      </Card>
    </div>
  );
}
