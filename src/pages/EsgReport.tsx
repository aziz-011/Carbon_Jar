import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, XAxis, YAxis } from 'recharts';
import { Icon, type IconName } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { Callout, PageHead } from '../components/ui';
import { categoriesOfScope, getCategory } from '../data/categories';
import { GRID_ZONES } from '../data/emissionFactors';
import { GWP_SET_LABELS } from '../data/gwp';
import { SOURCE_OF } from '../data/sources';
import type { CategoryId, DataQuality, EsgYear, Scope } from '../domain/types';
import { carbonCostExposure, factorKgCO2ePerUnit, intensityRatio, netZeroPath, targetProgress, trajectoryYears } from '../lib/calc';
import { downloadFile, isEmbedded } from '../lib/csv';
import { DOC_TYPE_LABELS } from '../lib/documents/parse';
import { FRAMEWORK_MAP, GOVERNANCE_FIELDS, GOVERNANCE_PRACTICES, SOCIAL_FIELDS, buildExecutiveSummary } from '../lib/esgReport';
import { fmt, fmtMoney, fmtPct } from '../lib/format';
import { recommend } from '../lib/recommendations';
import { useStore } from '../state/store';
import { APPROACHES } from './Boundary';

/** Couleurs du document imprimé (indépendantes du thème de l'écran). */
const PAPER = { s1: '#1e4e8c', s2: '#5b8fc7', s3: '#a3aeba', ink: '#2b2f2d', muted: '#666b68', rule: '#e7dfce', forest: '#1e3a5f', emerald: '#059669' };
const SCOPE_FILL: Record<Scope, string> = { 1: PAPER.s1, 2: PAPER.s2, 3: PAPER.s3 };

const SECTOR_LABELS: Record<string, string> = {
  industrie: 'Industrie manufacturière',
  chimie: 'Industrie chimique',
  agroalimentaire: 'Agroalimentaire',
  sante: 'Santé',
  universite: 'Enseignement supérieur',
  services: 'Services',
  commerce: 'Commerce et distribution',
  transport: 'Transport et logistique',
  autre: 'Autre',
};

const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">';

function Section({ n, title, pillar, children }: { n: number; title: string; pillar?: { label: string; icon: IconName }; children: ReactNode }) {
  return (
    <section className="rpt-section">
      <h2>
        <span className="rpt-num">{String(n).padStart(2, '0')}</span>
        {title}
        {pillar && (
          <span className="rpt-pillar">
            <Icon name={pillar.icon} size={14} /> {pillar.label}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, main }: { label: string; value: string; sub?: string; main?: boolean }) {
  return (
    <div className={`rpt-kpi ${main ? 'main' : ''}`}>
      <span className="rpt-kpi-label">{label}</span>
      <span className="rpt-kpi-value">{value}</span>
      {sub && <span className="rpt-kpi-sub">{sub}</span>}
    </div>
  );
}

/** Page « Rapport ESG » de l'espace cabinet : aperçu, publication sur le portail, export. */
export function EsgReport() {
  return <EsgReportView mode="cabinet" />;
}

/**
 * Rapport ESG complet. En mode « cabinet », il peut être publié sur le portail du client ;
 * en mode « client », il est consulté et téléchargé tel que publié.
 */
export function EsgReportView({ mode }: { mode: 'cabinet' | 'client' }) {
  const { state, dispatch, workspace, inventory: inv, inventoryFor, years, factorById } = useStore();
  const { org, portal } = state;
  const year = org.reportingYear;
  const ref = useRef<HTMLDivElement>(null);
  const base = inventoryFor(org.baseYear);
  const esg: EsgYear = state.esg[year] ?? {};
  const zone = state.entities[0]?.country ?? 'TN';
  const recos = recommend(inv, { gridFactor: GRID_ZONES.find((z) => z.code === zone)?.value ?? 0.58, country: zone });
  const summary = esg.executiveSummary?.trim() || buildExecutiveSummary({ org, inv, base, recos, esg });
  const total = inv.totalLocation;
  const share = (v: number) => (total > 0 ? fmtPct(v / total, 1) : '—');
  const intensity = intensityRatio(total, org.intensityMetric[year]);
  const delta = base.totalLocation > 0 && org.baseYear !== year ? (total - base.totalLocation) / base.totalLocation : undefined;
  const approach = APPROACHES.find(([id]) => id === org.consolidation)!;
  const validatedDocs = state.documents.filter((d) => d.status === 'valide');
  const docCoverage = inv.results.length ? inv.results.filter((r) => r.activity.documentId || r.activity.evidence).length / inv.results.length : 0;
  const qualityShare = (q: DataQuality) => (total ? inv.results.filter((r) => r.activity.quality === q).reduce((s, r) => s + r.kgCO2e / 1000, 0) / total : 0);
  const usedFactors = [...new Map(inv.results.map((r) => [r.factor.id, r.factor])).values()];
  const water = esg.waterM3 ?? inv.results.filter((r) => r.factor.id === 'water').reduce((s, r) => s + r.activity.quantity, 0);
  const wasteT = esg.wasteTonnes ?? inv.results.filter((r) => r.category === 'S3_C5').reduce((s, r) => s + r.activity.quantity, 0);
  const scopes: Record<Scope, number> = { 1: inv.scope1, 2: inv.scope2Location, 3: inv.scope3 };
  const baseInv = inventoryFor(org.baseYear);
  const trend = trajectoryYears(years).map((y) => {
    const i = inventoryFor(y);
    const m = i.results.length > 0;
    return { year: String(y), 'Scope 1': m ? i.scope1 : undefined, 'Scope 2': m ? i.scope2Location : undefined, 'Scope 3': m ? i.scope3 : undefined, 'Trajectoire Net Zero 2050': netZeroPath(baseInv.totalLocation, org.baseYear, y) };
  });
  const measuredYears = years.filter((y) => inventoryFor(y).results.length > 0).length;
  const energyRows = [...new Map(inv.results.filter((r) => r.energyKwh > 0).map((r) => [r.factor.id, r.factor])).values()]
    .map((f) => {
      const rs = inv.results.filter((r) => r.factor.id === f.id);
      return { f, mwh: rs.reduce((s, r) => s + r.energyKwh, 0) / 1000, cost: rs.reduce((s, r) => s + r.cost, 0), t: rs.reduce((s, r) => s + r.kgCO2e, 0) / 1000 };
    })
    .sort((a, b) => b.mwh - a.mwh);
  const topCats = (Object.entries(inv.byCategory) as Array<[CategoryId, number]>).sort((a, b) => b[1] - a[1]);
  const generated = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const potLow = recos.reduce((s, r) => s + r.reductionT[0], 0);
  const potHigh = recos.reduce((s, r) => s + r.reductionT[1], 0);

  const keyPoints = [
    `${fmt(total)} t CO2e émises en ${year}${delta !== undefined ? `, soit ${delta <= 0 ? '−' : '+'}${fmtPct(Math.abs(delta), 1)} par rapport à ${org.baseYear}` : ''}.`,
    topCats[0] ? `Premier poste : ${SOURCE_OF[topCats[0][0]].label.toLowerCase()} (${share(topCats[0][1])} du total).` : undefined,
    `Scopes 1 et 2 (périmètre directement maîtrisé) : ${fmt(inv.scope1 + inv.scope2Location)} t CO2e.`,
    recos.length ? `Potentiel de réduction identifié : ${fmt(potLow)} à ${fmt(potHigh)} t CO2e par an.` : undefined,
    `${fmtPct(docCoverage)} des données sont rattachées à une pièce justificative.`,
  ].filter(Boolean) as string[];

  const exportHtml = () => {
    if (!ref.current) return;
    const css = [...document.styleSheets]
      .map((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport ESG ${year} — ${org.name}</title>${FONT_LINK}<style>${css}\nbody{background:#f3eee3;margin:0;padding:24px 0}.rpt{margin:0 auto}@media print{body{padding:0;background:#fff}}</style></head><body>${ref.current.outerHTML}</body></html>`;
    downloadFile(`Rapport-ESG-${year}-${org.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.html`, html, 'text/html;charset=utf-8');
  };

  let n = 0;
  const next = () => ++n;

  return (
    <div className="stack">
      <PageHead
        eyebrow={mode === 'cabinet' ? 'Rapport' : `Exercice ${year}`}
        icon="report"
        title={mode === 'cabinet' ? 'Rapport ESG' : 'Mon rapport ESG'}
        intro={
          mode === 'cabinet'
            ? 'Rapport généré à partir de l’inventaire, des pièces validées et des données ESG. Complétez la synthèse dans « Données ESG », puis publiez-le sur le portail du client.'
            : `Rapport établi par ${workspace.firmName}${portal.publishedAt ? `, publié le ${new Date(portal.publishedAt).toLocaleDateString('fr-FR')}` : ''}.`
        }
        actions={
          <>
            {mode === 'cabinet' && (
              <button
                className={portal.reportPublished ? '' : 'primary'}
                onClick={() => dispatch({ type: 'portal', patch: { reportPublished: !portal.reportPublished, publishedAt: portal.reportPublished ? portal.publishedAt : new Date().toISOString() } })}
              >
                <Icon name={portal.reportPublished ? 'lock' : 'send'} size={15} />
                {portal.reportPublished ? 'Retirer du portail' : 'Publier sur le portail client'}
              </button>
            )}
            {!isEmbedded() && (
              <button onClick={() => window.print()}>
                <Icon name="printer" size={15} /> Imprimer / PDF
              </button>
            )}
            <button className={mode === 'client' ? 'primary' : ''} onClick={exportHtml}>
              <Icon name="download" size={15} /> Télécharger
            </button>
          </>
        }
      />
      {mode === 'cabinet' && (
        <Callout tone={portal.reportPublished ? 'key' : 'info'}>
          {portal.reportPublished
            ? `Publié sur le portail du client${portal.publishedAt ? ` le ${new Date(portal.publishedAt).toLocaleDateString('fr-FR')}` : ''} : le client voit la version actuelle.`
            : 'Non publié : le client voit « rapport en préparation » sur son portail.'}{' '}
          {mode === 'cabinet' && <Link to="/esg">Compléter la synthèse et les données ESG →</Link>}
        </Callout>
      )}

      <div className="rpt-scroll">
        <div className="rpt" ref={ref}>
          <header className="rpt-cover">
            <div className="rpt-cover-top">
              <span className="firm">
                <LogoMark size={34} />
                {workspace.firmName}
              </span>
              <span>Rapport de durabilité</span>
            </div>
            <div className="rpt-cover-main">
              <div className="rpt-eyebrow">Bilan carbone &amp; indicateurs ESG · Exercice {year}</div>
              <h1>Rapport ESG {year}</h1>
              <div className="rpt-client">{org.name}</div>
              <p>Émissions de gaz à effet de serre (Scopes 1, 2 et 3), énergie, indicateurs environnementaux, sociaux et de gouvernance, et plan de réduction.</p>
            </div>
            <dl className="rpt-cover-meta">
              <div><dt>Référentiels</dt><dd>GHG Protocol · GRI · ESRS</dd></div>
              <div><dt>Période</dt><dd>1er janv. – 31 déc. {year}</dd></div>
              <div><dt>Secteur</dt><dd>{SECTOR_LABELS[org.sector] ?? org.sector}</dd></div>
              <div><dt>Édition</dt><dd>{generated}</dd></div>
            </dl>
          </header>

          <div className="rpt-body">
            <div className="rpt-toc">
              <div>
                <h2>Sommaire</h2>
                <ol>
                  <li>Synthèse exécutive</li>
                  <li>Organisation et périmètre</li>
                  <li>Méthodologie</li>
                  <li>Environnement</li>
                  <li>Social</li>
                  <li>Gouvernance</li>
                  <li>Engagements</li>
                  <li>Annexes</li>
                </ol>
              </div>
              <div className="rpt-keypoints">
                <h3>Points clés</h3>
                <ul>
                  {keyPoints.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            </div>

            <Section n={next()} title="Synthèse exécutive">
              <div className="rpt-kpis">
                <Kpi main label="Émissions totales" value={`${fmt(total)} t CO2e`} sub={delta !== undefined ? `${delta <= 0 ? '−' : '+'}${fmtPct(Math.abs(delta), 1)} vs ${org.baseYear}` : 'Scope 2 location-based'} />
                <Kpi label="Scope 1 · directes" value={`${fmt(inv.scope1)} t`} sub={share(inv.scope1)} />
                <Kpi label="Scope 2 · énergie" value={`${fmt(inv.scope2Location)} t`} sub={`market-based : ${fmt(inv.scope2Market)} t`} />
                <Kpi label="Scope 3 · chaîne de valeur" value={`${fmt(inv.scope3)} t`} sub={share(inv.scope3)} />
                <Kpi label="Énergie consommée" value={`${fmt(inv.energyMWh)} MWh`} sub={fmtMoney(inv.cost, org.currency)} />
                <Kpi label="Intensité carbone" value={intensity !== undefined ? fmt(intensity, 3) : '—'} sub={`t CO2e / ${org.intensityMetricLabel}`} />
              </div>
              <ScopeBarPaper values={scopes} />
              <p className="rpt-lead">{summary}</p>
            </Section>

            <Section n={next()} title="Organisation et périmètre">
              <p>
                Le rapport couvre <strong>{org.name}</strong> ({(SECTOR_LABELS[org.sector] ?? org.sector).toLowerCase()}) pour l’exercice {year}. Le périmètre organisationnel suit l’approche du <strong>{approach[1].toLowerCase()}</strong> : {approach[2].charAt(0).toLowerCase() + approach[2].slice(1)}
              </p>
              <table className="rpt-table">
                <thead>
                  <tr><th>Entité</th><th>Pays</th><th className="num">Part de capital</th><th className="num">Part consolidée</th></tr>
                </thead>
                <tbody>
                  {state.entities.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td>{GRID_ZONES.find((z) => z.code === e.country)?.name ?? e.country}</td>
                      <td className="num">{fmt(e.equityShare)} %</td>
                      <td className="num">{org.consolidation === 'equity' ? `${fmt(e.equityShare)} %` : (org.consolidation === 'financial' ? e.financialControl : e.operationalControl) ? '100 %' : '0 %'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="rpt-note">Périmètre opérationnel : Scopes 1 et 2 complets ; Scope 3 : {categoriesOfScope(3).filter((c) => inv.byCategory[c.id]).map((c) => c.label.split('.')[0]).join(', ') || 'non couvert'}. Exclusions : {org.exclusions || 'aucune'}.</p>
            </Section>

            <Section n={next()} title="Méthodologie">
              <p>
                L’inventaire suit le <strong>GHG Protocol Corporate Standard</strong> et le Scope 2 Guidance. Chaque émission est calculée par <em>Émissions = Donnée d’activité × Facteur d’émission</em>, puis convertie en CO2 équivalent avec les PRG du {GWP_SET_LABELS[org.gwpSet]}. Les données proviennent des pièces transmises par {org.name} (factures, tickets, cartes grises…), lues automatiquement puis vérifiées par les ingénieurs de {workspace.firmName}. Le Scope 2 est présenté selon les méthodes location-based et market-based ; le CO2 biogénique et les gaz hors Kyoto sont déclarés à part.
              </p>
              <table className="rpt-table">
                <tbody>
                  <tr><td>Données d’activité</td><td className="num">{inv.results.length}</td></tr>
                  <tr><td>Pièces justificatives intégrées</td><td className="num">{validatedDocs.length}</td></tr>
                  <tr><td>Données rattachées à un justificatif</td><td className="num">{fmtPct(docCoverage)}</td></tr>
                  {([1, 2, 3, 4] as DataQuality[]).map((q) => (
                    <tr key={q}><td>Qualité niveau {q} — {['mesure directe', 'donnée facturée', 'calcul à partir des équipements', 'estimation'][q - 1]}</td><td className="num">{fmtPct(qualityShare(q))} des émissions</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section n={next()} title="Environnement" pillar={{ label: 'Pilier E', icon: 'leaf' }}>
              <h3>4.1 Émissions par scope</h3>
              <table className="rpt-table">
                <thead><tr><th>Scope</th><th className="num">t CO2e</th><th className="num">Part</th></tr></thead>
                <tbody>
                  <tr><td>Scope 1 — émissions directes</td><td className="num">{fmt(inv.scope1)}</td><td className="num">{share(inv.scope1)}</td></tr>
                  <tr><td>Scope 2 — énergie achetée (location-based)</td><td className="num">{fmt(inv.scope2Location)}</td><td className="num">{share(inv.scope2Location)}</td></tr>
                  <tr className="rpt-sub"><td>Scope 2 — market-based</td><td className="num">{fmt(inv.scope2Market)}</td><td /></tr>
                  <tr><td>Scope 3 — chaîne de valeur</td><td className="num">{fmt(inv.scope3)}</td><td className="num">{share(inv.scope3)}</td></tr>
                  <tr className="rpt-total"><td>Total</td><td className="num">{fmt(total)}</td><td className="num">100 %</td></tr>
                  <tr className="rpt-sub"><td>CO2 biogénique (hors scopes)</td><td className="num">{fmt(inv.biogenicT)}</td><td /></tr>
                </tbody>
              </table>

              <h3>4.2 Principaux postes d’émission</h3>
              <table className="rpt-table">
                <thead><tr><th>Poste</th><th>Catégorie GHG Protocol</th><th className="num">t CO2e</th><th className="num">Part</th></tr></thead>
                <tbody>
                  {topCats.map(([id, t]) => {
                    const c = getCategory(id);
                    return (
                      <tr key={id}><td>{SOURCE_OF[id].label}</td><td>Scope {c.scope} · {c.label}</td><td className="num">{fmt(t)}</td><td className="num">{share(t)}</td></tr>
                    );
                  })}
                </tbody>
              </table>

              <h3>4.3 Scopes 1 et 2 par gaz</h3>
              <table className="rpt-table">
                <tbody>
                  {Object.entries(inv.byGasScope12).map(([g, v]) => (
                    <tr key={g}><td>{g === 'CO2e' ? 'CO2e (facteurs électriques agrégés)' : g}</td><td className="num">{fmt(v)} t CO2e</td></tr>
                  ))}
                </tbody>
              </table>

              <h3>4.4 Énergie et dépenses</h3>
              <table className="rpt-table">
                <thead><tr><th>Source d’énergie</th><th className="num">MWh</th><th className="num">t CO2e</th><th className="num">Dépenses ({org.currency})</th></tr></thead>
                <tbody>
                  {energyRows.map((r) => (
                    <tr key={r.f.id}><td>{r.f.label}</td><td className="num">{fmt(r.mwh)}</td><td className="num">{fmt(r.t)}</td><td className="num">{fmt(r.cost, 0)}</td></tr>
                  ))}
                  <tr className="rpt-total"><td>Total</td><td className="num">{fmt(inv.energyMWh)}</td><td className="num">{fmt(energyRows.reduce((s, r) => s + r.t, 0))}</td><td className="num">{fmt(energyRows.reduce((s, r) => s + r.cost, 0), 0)}</td></tr>
                </tbody>
              </table>
              <p className="rpt-note">Exposition au prix du carbone (Scopes 1 et 2 × {fmt(org.carbonPrice)} {org.currency}/t) : {fmtMoney(carbonCostExposure(inv.scope1 + inv.scope2Location, org.carbonPrice), org.currency)}.</p>

              <h3>4.5 Évolution</h3>
              {measuredYears > 1 ? (
                <ComposedChart width={560} height={220} data={trend}>
                  <CartesianGrid vertical={false} stroke={PAPER.rule} />
                  <XAxis dataKey="year" tick={{ fill: PAPER.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: PAPER.muted, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: PAPER.ink }} />
                  <Bar dataKey="Scope 1" stackId="a" fill={SCOPE_FILL[1]} isAnimationActive={false} />
                  <Bar dataKey="Scope 2" stackId="a" fill={SCOPE_FILL[2]} isAnimationActive={false} />
                  <Bar dataKey="Scope 3" stackId="a" fill={SCOPE_FILL[3]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Line type="linear" dataKey="Trajectoire Net Zero 2050" stroke={PAPER.emerald} strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
                </ComposedChart>
              ) : (
                <p className="rpt-note">Premier exercice mesuré : il constitue l’année de référence.</p>
              )}

              <h3>4.6 Intensité carbone</h3>
              <p>{intensity !== undefined ? `${fmt(intensity, 4)} t CO2e par ${org.intensityMetricLabel} (${fmt(org.intensityMetric[year])} en ${year}).` : 'Métrique d’activité non renseignée.'}</p>

              <h3>4.7 Eau, déchets et flotte</h3>
              <table className="rpt-table">
                <tbody>
                  <tr><td>Consommation d’eau</td><td className="num">{water ? `${fmt(water)} m³` : '—'}</td></tr>
                  <tr><td>Déchets générés</td><td className="num">{wasteT ? `${fmt(wasteT)} t` : '—'}</td></tr>
                  {esg.wasteRecycledPct !== undefined && <tr><td>Part des déchets valorisés</td><td className="num">{fmt(esg.wasteRecycledPct)} %</td></tr>}
                  <tr><td>Véhicules de la flotte</td><td className="num">{state.vehicles.length}</td></tr>
                </tbody>
              </table>

              <h3>4.8 Objectifs de réduction</h3>
              {state.targets.length === 0 ? (
                <p className="rpt-note">Aucun objectif formalisé à ce jour.</p>
              ) : (
                <table className="rpt-table">
                  <thead><tr><th>Objectif</th><th>Périmètre</th><th className="num">Réduction visée</th><th className="num">Réalisé</th></tr></thead>
                  <tbody>
                    {state.targets.map((t) => {
                      const val = (i: typeof inv, y: number) => {
                        const abs = (t.scopes.includes(1) ? i.scope1 : 0) + (t.scopes.includes(2) ? (t.scope2Method === 'market' ? i.scope2Market : i.scope2Location) : 0) + (t.scopes.includes(3) ? i.scope3 : 0);
                        return t.type === 'absolute' ? abs : intensityRatio(abs, org.intensityMetric[y]);
                      };
                      const b = val(inventoryFor(t.baseYear), t.baseYear);
                      const c = val(inv, year);
                      const done = b && c !== undefined ? targetProgress(b, c, t.reductionPct).achievedPct : undefined;
                      return (
                        <tr key={t.id}>
                          <td>{t.name}</td>
                          <td>Scopes {t.scopes.join('+')} · {t.type === 'absolute' ? 'absolu' : 'intensité'}</td>
                          <td className="num">−{fmt(t.reductionPct)} % ({t.baseYear}→{t.targetYear})</td>
                          <td className="num">{done !== undefined ? `${done >= 0 ? '−' : '+'}${fmt(Math.abs(done), 1)} %` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <h3>4.9 Plan de réduction</h3>
              <div className="rpt-actions">
                {recos.slice(0, 6).map((r) => (
                  <div key={r.id} className="rpt-action">
                    <b>{r.title}</b>
                    <div className="rpt-note">Scope {r.scope} · {r.actions[0]}</div>
                    <span className="gain">
                      −{fmt(r.reductionT[0])} à −{fmt(r.reductionT[1])} t CO2e/an{r.costSaved[1] > 0 ? ` · jusqu’à ${fmt(r.costSaved[1], 0)} ${org.currency}/an` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <p className="rpt-note">Potentiels indicatifs à confirmer par une étude de faisabilité ; les leviers portant sur un même poste ne s’additionnent pas intégralement.</p>
            </Section>

            <Section n={next()} title="Social" pillar={{ label: 'Pilier S', icon: 'users' }}>
              <IndicatorTable rows={SOCIAL_FIELDS} esg={esg} currency={org.currency} />
            </Section>

            <Section n={next()} title="Gouvernance" pillar={{ label: 'Pilier G', icon: 'shield' }}>
              <IndicatorTable rows={GOVERNANCE_FIELDS} esg={esg} currency={org.currency} />
              <table className="rpt-table">
                <thead><tr><th>Pratique</th><th>Référence</th><th>Statut</th></tr></thead>
                <tbody>
                  {GOVERNANCE_PRACTICES.map((p) => (
                    <tr key={p.key}>
                      <td>{p.label}</td>
                      <td className="rpt-ref">{p.ref}</td>
                      <td>{esg[p.key] ? <span className="rpt-yes"><Icon name="checkCircle" size={14} /> En place</span> : <span className="rpt-no">À mettre en place</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section n={next()} title="Engagements et prochaines étapes">
              {esg.commitments?.trim() ? (
                esg.commitments.split('\n').filter(Boolean).map((l, i) => <p key={i}>{l}</p>)
              ) : (
                <ul>
                  {recos.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      <strong>{r.title}</strong> — {r.actions[0]}
                    </li>
                  ))}
                  <li>Fiabiliser la collecte : rattacher chaque donnée à sa pièce justificative et réduire la part des estimations.</li>
                </ul>
              )}
            </Section>

            <Section n={next()} title="Annexes">
              <h3>A. Correspondance GRI / ESRS</h3>
              <table className="rpt-table">
                <thead><tr><th>Thème</th><th>GRI</th><th>ESRS</th><th>Section</th></tr></thead>
                <tbody>
                  {FRAMEWORK_MAP.map((m) => (
                    <tr key={m.topic}><td>{m.topic}</td><td className="rpt-ref">{m.gri}</td><td className="rpt-ref">{m.esrs}</td><td>{m.section}</td></tr>
                  ))}
                </tbody>
              </table>

              <h3>B. Facteurs d’émission utilisés</h3>
              <table className="rpt-table">
                <thead><tr><th>Source</th><th className="num">Facteur</th><th>Origine</th></tr></thead>
                <tbody>
                  {usedFactors.map((f) => (
                    <tr key={f.id}>
                      <td>{f.label}</td>
                      <td className="num">{fmt(factorKgCO2ePerUnit(f, org.gwpSet), 4)} kg CO2e/{f.unit}</td>
                      <td className="rpt-src">{factorById.get(f.id)?.source ?? f.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>C. Pièces justificatives</h3>
              {validatedDocs.length === 0 ? (
                <p className="rpt-note">Données issues de saisies et d’imports ; aucune pièce téléversée.</p>
              ) : (
                <table className="rpt-table">
                  <thead><tr><th>Document</th><th>Type</th><th>Référence</th><th>Période</th></tr></thead>
                  <tbody>
                    {validatedDocs.map((d) => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td>{d.extraction ? DOC_TYPE_LABELS[d.extraction.docType] : '—'}</td>
                        <td>{[d.extraction?.supplier, d.extraction?.documentNumber].filter(Boolean).join(' ') || '—'}</td>
                        <td>{d.extraction?.periodStart && d.extraction?.periodEnd ? `${d.extraction.periodStart} → ${d.extraction.periodEnd}` : d.extraction?.date ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          <footer className="rpt-footer">
            <span>{workspace.firmName} · Rapport ESG {year} · {org.name}</span>
            <span>GHG Protocol · {GWP_SET_LABELS[org.gwpSet]} · édité le {generated}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

function ScopeBarPaper({ values }: { values: Record<Scope, number> }) {
  const total = values[1] + values[2] + values[3];
  if (total <= 0) return null;
  return (
    <div className="rpt-scopebar">
      <div className="bar-track">
        {([1, 2, 3] as Scope[]).map((s) =>
          values[s] > 0 ? (
            <span key={s} style={{ width: `${(values[s] / total) * 100}%`, background: SCOPE_FILL[s] }}>
              {values[s] / total >= 0.08 ? `${Math.round((values[s] / total) * 100)} %` : ''}
            </span>
          ) : null,
        )}
      </div>
      <div className="legend">
        {([1, 2, 3] as Scope[]).map((s) => (
          <span key={s}>
            <i style={{ background: SCOPE_FILL[s] }} />
            Scope {s} — {fmt(values[s])} t CO2e
          </span>
        ))}
      </div>
    </div>
  );
}

function IndicatorTable({ rows, esg, currency }: { rows: Array<{ key: keyof EsgYear; label: string; unit: string; ref: string }>; esg: EsgYear; currency: string }) {
  return (
    <table className="rpt-table">
      <thead><tr><th>Indicateur</th><th>Référence</th><th className="num">Valeur</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          const v = esg[r.key] as number | undefined;
          return (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="rpt-ref">{r.ref}</td>
              <td className="num">{v !== undefined ? `${fmt(v)} ${r.unit === 'TND' ? currency : r.unit}` : <span className="rpt-no">non renseigné</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
