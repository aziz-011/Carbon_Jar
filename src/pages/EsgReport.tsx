import { useRef, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { PageHead } from '../components/ui';
import { categoriesOfScope, getCategory } from '../data/categories';
import { GRID_ZONES } from '../data/emissionFactors';
import { GWP_SET_LABELS } from '../data/gwp';
import type { DataQuality, EsgYear, Scope } from '../domain/types';
import { carbonCostExposure, factorKgCO2ePerUnit, intensityRatio, targetProgress } from '../lib/calc';
import { downloadFile, isEmbedded } from '../lib/csv';
import { DOC_TYPE_LABELS } from '../lib/documents/parse';
import { FRAMEWORK_MAP, GOVERNANCE_FIELDS, GOVERNANCE_PRACTICES, SOCIAL_FIELDS, buildExecutiveSummary } from '../lib/esgReport';
import { fmt, fmtMoney, fmtPct } from '../lib/format';
import { recommend } from '../lib/recommendations';
import { useStore } from '../state/store';
import { APPROACHES } from './Boundary';

/** Couleurs fixes du document (le rapport est toujours imprimé sur fond blanc). */
const PAPER = { s1: '#c4502a', s2: '#c99000', s3: '#2b6f93', ink: '#1b2420', muted: '#5f6b66', rule: '#d9dfdc', accent: '#1f6b52' };
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

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="rpt-section">
      <h2>
        <span className="rpt-num">{n}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rpt-kpi">
      <span className="rpt-kpi-label">{label}</span>
      <span className="rpt-kpi-value">{value}</span>
      {sub && <span className="rpt-kpi-sub">{sub}</span>}
    </div>
  );
}

export function EsgReport() {
  const { state, workspace, inventory: inv, inventoryFor, years, factorById } = useStore();
  const { org } = state;
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
  const pie = ([1, 2, 3] as Scope[]).map((s) => ({ name: `Scope ${s}`, scope: s, value: s === 1 ? inv.scope1 : s === 2 ? inv.scope2Location : inv.scope3 })).filter((d) => d.value > 0);
  const trend = years.map((y) => {
    const i = inventoryFor(y);
    return { year: String(y), 'Scope 1': i.scope1, 'Scope 2': i.scope2Location, 'Scope 3': i.scope3 };
  });
  const energyRows = [...new Map(inv.results.filter((r) => r.energyKwh > 0).map((r) => [r.factor.id, r.factor])).values()].map((f) => {
    const rs = inv.results.filter((r) => r.factor.id === f.id);
    return { f, mwh: rs.reduce((s, r) => s + r.energyKwh, 0) / 1000, cost: rs.reduce((s, r) => s + r.cost, 0), t: rs.reduce((s, r) => s + r.kgCO2e, 0) / 1000 };
  }).sort((a, b) => b.mwh - a.mwh);
  const generated = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

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
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport ESG ${year} — ${org.name}</title><style>${css}\nbody{background:#fff;margin:0}.rpt{margin:0 auto}</style></head><body>${ref.current.outerHTML}</body></html>`;
    downloadFile(`Rapport-ESG-${year}-${org.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.html`, html, 'text/html;charset=utf-8');
  };

  let n = 0;
  const num = () => String(++n);

  return (
    <div className="stack">
      <PageHead
        title="Rapport ESG"
        intro="Rapport complet généré à partir de l’inventaire, des documents validés et des données ESG. Complétez la synthèse et les indicateurs sociaux dans « Données ESG »."
        actions={
          <>
            {!isEmbedded() && <button onClick={() => window.print()}>Imprimer / PDF</button>}
            <button className="primary" onClick={exportHtml}>Télécharger le rapport (HTML)</button>
          </>
        }
      />

      <div className="rpt-scroll">
        <div className="rpt" ref={ref}>
          {/* ───── Couverture ───── */}
          <header className="rpt-cover">
            <div className="rpt-cover-top">{workspace.firmName}</div>
            <div className="rpt-cover-main">
              <div className="rpt-eyebrow">Rapport de durabilité · Exercice {year}</div>
              <h1>Rapport ESG {year}</h1>
              <div className="rpt-client">{org.name}</div>
              <p>Bilan des émissions de gaz à effet de serre, indicateurs environnementaux, sociaux et de gouvernance.</p>
            </div>
            <dl className="rpt-cover-meta">
              <div><dt>Référentiels</dt><dd>GHG Protocol Corporate Standard · GRI · ESRS (CSRD)</dd></div>
              <div><dt>Période</dt><dd>1er janvier – 31 décembre {year}</dd></div>
              <div><dt>Secteur</dt><dd>{SECTOR_LABELS[org.sector] ?? org.sector}</dd></div>
              <div><dt>Édité le</dt><dd>{generated}</dd></div>
            </dl>
          </header>

          <nav className="rpt-toc">
            <h2>Sommaire</h2>
            <ol>
              <li>Synthèse exécutive</li>
              <li>Organisation et périmètre</li>
              <li>Méthodologie</li>
              <li>Environnement</li>
              <li>Social</li>
              <li>Gouvernance</li>
              <li>Engagements et prochaines étapes</li>
              <li>Annexes</li>
            </ol>
          </nav>

          <Section n={num()} title="Synthèse exécutive">
            <div className="rpt-kpis">
              <Kpi label="Émissions totales" value={`${fmt(total)} t CO2e`} sub={delta !== undefined ? `${delta <= 0 ? '−' : '+'}${fmtPct(Math.abs(delta), 1)} vs ${org.baseYear}` : 'Scope 2 location-based'} />
              <Kpi label="Scope 1" value={`${fmt(inv.scope1)} t`} sub={share(inv.scope1)} />
              <Kpi label="Scope 2" value={`${fmt(inv.scope2Location)} t`} sub={`market-based : ${fmt(inv.scope2Market)} t`} />
              <Kpi label="Scope 3" value={`${fmt(inv.scope3)} t`} sub={share(inv.scope3)} />
              <Kpi label="Énergie" value={`${fmt(inv.energyMWh)} MWh`} sub={fmtMoney(inv.cost, org.currency)} />
              <Kpi label="Intensité" value={intensity !== undefined ? fmt(intensity, 3) : '—'} sub={`t CO2e / ${org.intensityMetricLabel}`} />
            </div>
            <p className="rpt-lead">{summary}</p>
          </Section>

          <Section n={num()} title="Organisation et périmètre">
            <p>
              Le présent rapport couvre {org.name}, entreprise du secteur « {(SECTOR_LABELS[org.sector] ?? org.sector).toLowerCase()} », pour l’exercice {year}. Le périmètre organisationnel est établi selon l’approche du <strong>{approach[1].toLowerCase()}</strong> : {approach[2].charAt(0).toLowerCase() + approach[2].slice(1)}
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

          <Section n={num()} title="Méthodologie">
            <p>
              L’inventaire est établi selon le <strong>GHG Protocol Corporate Accounting and Reporting Standard</strong> et le Scope 2 Guidance. Chaque émission est calculée par la relation <em>Émissions = Donnée d’activité × Facteur d’émission</em>, puis convertie en CO2 équivalent avec les pouvoirs de réchauffement global du {GWP_SET_LABELS[org.gwpSet]}. Le Scope 2 est présenté selon les deux méthodes (location-based et market-based). Le CO2 biogénique et les gaz hors Kyoto sont déclarés séparément.
            </p>
            <table className="rpt-table">
              <tbody>
                <tr><td>Données d’activité</td><td className="num">{inv.results.length}</td></tr>
                <tr><td>Pièces justificatives validées (factures, cartes grises…)</td><td className="num">{validatedDocs.length}</td></tr>
                <tr><td>Données rattachées à un justificatif</td><td className="num">{fmtPct(docCoverage)}</td></tr>
                {([1, 2, 3, 4] as DataQuality[]).map((q) => (
                  <tr key={q}><td>Qualité niveau {q} — {['mesure directe', 'donnée facturée', 'calcul à partir des équipements', 'estimation'][q - 1]}</td><td className="num">{fmtPct(qualityShare(q))} des émissions</td></tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section n={num()} title="Environnement">
            <h3>4.1 Émissions de gaz à effet de serre par scope</h3>
            <div className="rpt-split">
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
              {pie.length > 0 && (
                <PieChart width={260} height={220}>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2} isAnimationActive={false}>
                    {pie.map((d) => <Cell key={d.scope} fill={SCOPE_FILL[d.scope]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ color: PAPER.ink, fontSize: 12 }} />
                </PieChart>
              )}
            </div>

            <h3>4.2 Détail par catégorie</h3>
            <table className="rpt-table">
              <thead><tr><th>Catégorie</th><th>Scope</th><th className="num">t CO2e</th><th className="num">Part</th></tr></thead>
              <tbody>
                {Object.entries(inv.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, t]) => {
                    const c = getCategory(id as never);
                    return (
                      <tr key={id}><td>{c.label}</td><td>Scope {c.scope}</td><td className="num">{fmt(t)}</td><td className="num">{share(t)}</td></tr>
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
            {trend.length > 1 ? (
              <BarChart width={560} height={220} data={trend}>
                <CartesianGrid vertical={false} stroke={PAPER.rule} />
                <XAxis dataKey="year" tick={{ fill: PAPER.muted, fontSize: 11 }} />
                <YAxis tick={{ fill: PAPER.muted, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Scope 1" stackId="a" fill={PAPER.s1} isAnimationActive={false} />
                <Bar dataKey="Scope 2" stackId="a" fill={PAPER.s2} isAnimationActive={false} />
                <Bar dataKey="Scope 3" stackId="a" fill={PAPER.s3} isAnimationActive={false} />
              </BarChart>
            ) : (
              <p className="rpt-note">Premier exercice mesuré : il constitue l’année de référence.</p>
            )}

            <h3>4.6 Intensité carbone</h3>
            <p>{intensity !== undefined ? `${fmt(intensity, 4)} t CO2e par ${org.intensityMetricLabel} (${fmt(org.intensityMetric[year])} ${org.intensityMetricLabel}s en ${year}).` : 'Métrique d’activité non renseignée.'}</p>

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
            <table className="rpt-table">
              <thead><tr><th>Levier</th><th>Scope</th><th className="num">t CO2e évitées / an</th><th className="num">Gain / an ({org.currency})</th></tr></thead>
              <tbody>
                {recos.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>Scope {r.scope}</td>
                    <td className="num">{fmt(r.reductionT[0])} – {fmt(r.reductionT[1])}</td>
                    <td className="num">{r.costSaved[1] > 0 ? `jusqu’à ${fmt(r.costSaved[1], 0)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rpt-note">Potentiels indicatifs à confirmer par une étude de faisabilité ; les leviers portant sur un même poste ne s’additionnent pas intégralement.</p>
          </Section>

          <Section n={num()} title="Social">
            <IndicatorTable rows={SOCIAL_FIELDS} esg={esg} currency={org.currency} />
          </Section>

          <Section n={num()} title="Gouvernance">
            <IndicatorTable rows={GOVERNANCE_FIELDS} esg={esg} currency={org.currency} />
            <table className="rpt-table">
              <thead><tr><th>Pratique</th><th>Référence</th><th>Statut</th></tr></thead>
              <tbody>
                {GOVERNANCE_PRACTICES.map((p) => (
                  <tr key={p.key}>
                    <td>{p.label}</td>
                    <td className="rpt-ref">{p.ref}</td>
                    <td>{esg[p.key] ? <span className="rpt-yes">En place</span> : <span className="rpt-no">Non renseigné / à mettre en place</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section n={num()} title="Engagements et prochaines étapes">
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

          <Section n={num()} title="Annexes">
            <h3>A. Table de correspondance GRI / ESRS</h3>
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

          <footer className="rpt-footer">
            Rapport préparé par {workspace.firmName} pour {org.name} · GHG Protocol · {GWP_SET_LABELS[org.gwpSet]} · édité le {generated}
          </footer>
        </div>
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

