import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Steps } from '../components/progress';
import { workflowSteps } from '../lib/progress';
import { Callout, Card, PageHead, ScopeBadge, Stat, Tabs, cssVar, scopeColor } from '../components/ui';
import { getCategory } from '../data/categories';
import type { CategoryId, Scope } from '../domain/types';
import { carbonCostExposure, intensityRatio } from '../lib/calc';
import { fmt, fmtMWh, fmtMoney, fmtPct, fmtT } from '../lib/format';
import { qualityAdvice } from '../lib/recommendations';
import { useStore } from '../state/store';

type Lens = 'emissions' | 'energy' | 'cost';

export function Dashboard() {
  const { state, inventory: inv, inventoryFor, years } = useStore();
  const { org } = state;
  const [lens, setLens] = useState<Lens>('emissions');
  const [method, setMethod] = useState<'location' | 'market'>('location');

  const s2 = method === 'location' ? inv.scope2Location : inv.scope2Market;
  const total = method === 'location' ? inv.totalLocation : inv.totalMarket;
  const metric = org.intensityMetric[org.reportingYear];
  const intensity = intensityRatio(total, metric);
  const base = inventoryFor(org.baseYear);
  const baseTotal = method === 'location' ? base.totalLocation : base.totalMarket;
  const delta = baseTotal > 0 && org.baseYear !== org.reportingYear ? (total - baseTotal) / baseTotal : undefined;

  const scopeValues: Record<Lens, Record<Scope, number>> = {
    emissions: { 1: inv.scope1, 2: s2, 3: inv.scope3 },
    energy: { 1: inv.energyByScope[1], 2: inv.energyByScope[2], 3: inv.energyByScope[3] },
    cost: inv.costByScope,
  };
  const lensUnit: Record<Lens, (v: number) => string> = {
    emissions: fmtT,
    energy: fmtMWh,
    cost: (v) => fmtMoney(v, org.currency),
  };
  const pieData = ([1, 2, 3] as Scope[]).map((s) => ({ name: `Scope ${s}`, scope: s, value: scopeValues[lens][s] })).filter((d) => d.value > 0);

  // Postes par catégorie selon l'angle choisi
  const catAgg = new Map<CategoryId, number>();
  for (const r of inv.results) {
    const v = lens === 'emissions' ? (method === 'market' ? r.kgCO2eMarket : r.kgCO2e) / 1000 : lens === 'energy' ? r.energyKwh / 1000 : r.cost;
    catAgg.set(r.category, (catAgg.get(r.category) ?? 0) + v);
  }
  const catData = [...catAgg.entries()]
    .map(([id, value]) => ({ id, name: getCategory(id).label.replace(/^\d+\.\s*/, ''), scope: getCategory(id).scope, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const trend = years.map((y) => {
    const i = inventoryFor(y);
    return { year: String(y), 'Scope 1': i.scope1, 'Scope 2': method === 'location' ? i.scope2Location : i.scope2Market, 'Scope 3': i.scope3 };
  });

  const topSources = [...inv.results].sort((a, b) => b.kgCO2e - a.kgCO2e).slice(0, 6);
  const advice = qualityAdvice(inv, { exclusions: org.exclusions, hasBaseYearData: base.results.length > 0, offsetsT: org.offsetsTco2e });
  const share = (v: number) => (total > 0 ? v / total : 0);
  const axis = cssVar('--muted', '#888');
  const grid = cssVar('--border', '#ddd');

  return (
    <div className="stack">
      <PageHead
        eyebrow="Vue d’ensemble"
        icon="dashboard"
        title={state.org.name}
        intro={`Empreinte carbone ${org.reportingYear} de ${org.name} — GHG Protocol, consolidation « ${
          { equity: 'part de capital', financial: 'contrôle financier', operational: 'contrôle opérationnel' }[org.consolidation]
        } », PRG ${org.gwpSet}.`}
        actions={
          <select value={method} onChange={(e) => setMethod(e.target.value as 'location' | 'market')} aria-label="Méthode Scope 2">
            <option value="location">Scope 2 : location-based</option>
            <option value="market">Scope 2 : market-based</option>
          </select>
        }
      />

      <Card
        icon="layers"
        title="Avancement du dossier"
        actions={
          <>
            <Link className="btn" to="/documents"><Icon name="checks" size={15} /> File de vérification</Link>
            <Link className="btn" to="/portail"><Icon name="eye" size={15} /> Portail du client</Link>
          </>
        }
      >
        <Steps steps={workflowSteps(state, inv)} />
      </Card>

      {state.documents.some((d) => d.status === 'a_valider') && (
        <Callout tone="attention" title="Documents en attente">
          {state.documents.filter((d) => d.status === 'a_valider').length} document(s) déposé(s) attendent votre vérification avant d’entrer dans l’inventaire. <Link to="/documents">Les vérifier →</Link>
        </Callout>
      )}

      {inv.results.length === 0 && (
        <Callout tone="info" title="Aucune donnée pour cette année">
          Commencez par <Link to="/documents">déposer les factures du client</Link> ou <Link to="/donnees">saisir vos données d’activité</Link>, ou chargez le jeu de démonstration depuis les <Link to="/parametres">paramètres</Link>.
        </Callout>
      )}

      <div className="grid g4">
        <Stat
          accent="main"
          icon="cloud" label="Émissions totales (S1+S2+S3)"
          value={fmtT(total)}
          sub={delta !== undefined ? <span className={delta <= 0 ? 'pos' : 'neg'}>{delta <= 0 ? '▼' : '▲'} {fmtPct(Math.abs(delta), 1)} vs {org.baseYear}</span> : `Scope 2 ${method === 'location' ? 'location' : 'market'}-based`}
        />
        <Stat icon="zap" label="Énergie consommée" value={fmtMWh(inv.energyMWh)} sub={`${fmt(inv.energyByScope[1])} MWh combustibles · ${fmt(inv.energyByScope[2])} MWh achetés`} />
        <Stat icon="briefcase" label="Dépenses associées" value={fmtMoney(inv.cost, org.currency)} sub={inv.costEstimatedShare > 0 ? `dont ${fmtPct(inv.costEstimatedShare)} estimés` : 'coûts réels saisis'} />
        <Stat
          icon="alert" label="Exposition au prix du carbone"
          value={fmtMoney(carbonCostExposure(inv.scope1 + s2, org.carbonPrice), org.currency)}
          sub={`S1+S2 × ${fmt(org.carbonPrice)} ${org.currency}/t`}
        />
      </div>

      <div className="grid g4">
        <Stat accent="s1" icon="flame" label="Scope 1 — directes" value={fmtT(inv.scope1)} sub={fmtPct(share(inv.scope1))} />
        <Stat accent="s2" icon="zap" label={`Scope 2 — énergie (${method === 'location' ? 'LB' : 'MB'})`} value={fmtT(s2)} sub={`${fmtPct(share(s2))} · ${method === 'location' ? 'MB' : 'LB'} : ${fmtT(method === 'location' ? inv.scope2Market : inv.scope2Location)}`} />
        <Stat accent="s3" icon="globe" label="Scope 3 — chaîne de valeur" value={fmtT(inv.scope3)} sub={fmtPct(share(inv.scope3))} />
        <Stat
          icon="gauge" label="Intensité carbone"
          value={intensity !== undefined ? fmt(intensity, 3) : '—'}
          sub={intensity !== undefined ? `t CO2e / ${org.intensityMetricLabel}` : <Link to="/parametres">Définir la métrique d’activité</Link>}
        />
      </div>


      <div className="grid g2">
        <Card icon="layers" title="Répartition par scope" actions={<Tabs value={lens} onChange={setLens} tabs={[['emissions', 'CO2e'], ['energy', 'Énergie'], ['cost', 'Coût']]} />}>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2} isAnimationActive={false}>
                  {pieData.map((d) => (
                    <Cell key={d.scope} fill={scopeColor(d.scope)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => lensUnit[lens](v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Aucune donnée.</p>
          )}
          {lens === 'emissions' && total > 0 && (
            <p className="small muted">
              Repère (industrie manufacturière et chimique) : Scope 1 = 10–30 %, Scope 2 = 5–20 %, Scope 3 = 50–90 %.
            </p>
          )}
        </Card>

        <Card icon="chart" title="Principaux postes">
          {catData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={catData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid horizontal={false} stroke={grid} />
                <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fill: axis, fontSize: 11 }} />
                <Tooltip formatter={(v: number) => lensUnit[lens](v)} />
                <Bar dataKey="value" name={lens === 'emissions' ? 't CO2e' : lens === 'energy' ? 'MWh' : org.currency} radius={[0, 4, 4, 0]}>
                  {catData.map((d) => (
                    <Cell key={d.id} fill={scopeColor(d.scope)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Aucune donnée.</p>
          )}
        </Card>
      </div>

      <div className="grid g2">
        <Card icon="chart" title="Évolution annuelle (t CO2e)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="year" tick={{ fill: axis, fontSize: 12 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmtT(v)} />
              <Legend />
              <Bar dataKey="Scope 1" stackId="a" fill={scopeColor(1)} />
              <Bar dataKey="Scope 2" stackId="a" fill={scopeColor(2)} />
              <Bar dataKey="Scope 3" stackId="a" fill={scopeColor(3)} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card icon="target" title="Sources les plus émettrices" actions={<Link to="/inventaire">Inventaire complet →</Link>}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Scope</th>
                  <th className="num">t CO2e</th>
                  <th className="num">Part</th>
                </tr>
              </thead>
              <tbody>
                {topSources.map((r) => (
                  <tr key={r.activity.id}>
                    <td>
                      {r.activity.description || r.factor.label}
                      <div className="small muted">{r.entity?.name}</div>
                    </td>
                    <td>
                      <ScopeBadge scope={r.scope} />
                    </td>
                    <td className="num">{fmt(r.kgCO2e / 1000)}</td>
                    <td className="num">{fmtPct(share(r.kgCO2e / 1000), 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid">
        <Card icon="shield" title="Qualité et conformité de l’inventaire">
          {advice.length === 0 && <p className="muted">Aucun point d’attention.</p>}
          {advice.map((a, i) => (
            <Callout key={i} tone={a.level === 'info' ? 'info' : a.level}>
              {a.message}
            </Callout>
          ))}
          {inv.biogenicT > 0 && <p className="small muted">CO2 biogénique (poste mémo, hors scopes) : {fmtT(inv.biogenicT)}.</p>}
        </Card>
      </div>
    </div>
  );
}
