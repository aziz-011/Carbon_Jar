import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon } from '../../components/Icon';
import { Callout, Card, PageHead, ScopeBadge, ScopeBar, Stat, cssVar, scopeColor } from '../../components/ui';
import { getCategory } from '../../data/categories';
import { SOURCE_OF } from '../../data/sources';
import type { CategoryId } from '../../domain/types';
import { intensityRatio } from '../../lib/calc';
import { fmt, fmtMoney, fmtPct } from '../../lib/format';
import { fmtMass, monthlySeries } from '../../lib/tracking';
import { useStore } from '../../state/store';

/** Portail client : résultats calculés en direct à partir des documents intégrés. */
export function PortalResults() {
  const { state, inventory: inv } = useStore();
  const { org } = state;
  const pending = state.documents.filter((d) => d.status === 'a_valider').length;
  const series = monthlySeries(inv.results, org.reportingYear);
  const total = inv.totalLocation;
  const intensity = intensityRatio(total, org.intensityMetric[org.reportingYear]);

  const bySource = new Map<CategoryId, { t: number; mwh: number; cost: number }>();
  for (const r of inv.results) {
    const v = bySource.get(r.category) ?? { t: 0, mwh: 0, cost: 0 };
    v.t += r.kgCO2e / 1000;
    v.mwh += r.energyKwh / 1000;
    v.cost += r.cost;
    bySource.set(r.category, v);
  }
  const sources = [...bySource.entries()].filter(([, v]) => v.t > 0).sort((a, b) => b[1].t - a[1].t);
  const max = sources[0]?.[1].t ?? 1;
  const axis = cssVar('--muted', '#888');

  return (
    <div className="stack">
      <PageHead
        eyebrow={`Exercice ${org.reportingYear}`}
        icon="chart"
        title="Mes résultats"
        intro="Votre empreinte carbone calculée à partir des documents intégrés au bilan, selon le GHG Protocol. Elle se met à jour à chaque nouveau document."
      />
      {pending > 0 && <Callout tone="info" title="Résultats provisoires">{pending} document(s) sont en cours de vérification par nos ingénieurs et seront ajoutés dès validation.</Callout>}

      <div className="grid g4">
        <Stat accent="main" icon="cloud" label="Émissions totales" value={`${fmt(total)} t CO2e`} sub={intensity !== undefined ? `${fmt(intensity, 3)} t par ${org.intensityMetricLabel}` : undefined} />
        <Stat accent="s1" icon="flame" label="Scope 1 · directes" value={fmtMass(inv.scope1 * 1000)} sub={total ? fmtPct(inv.scope1 / total) : undefined} />
        <Stat accent="s2" icon="zap" label="Scope 2 · électricité" value={fmtMass(inv.scope2Location * 1000)} sub={total ? fmtPct(inv.scope2Location / total) : undefined} />
        <Stat accent="s3" icon="globe" label="Scope 3 · indirectes" value={fmtMass(inv.scope3 * 1000)} sub={total ? fmtPct(inv.scope3 / total) : undefined} />
      </div>

      <Card icon="layers" title="Répartition par scope">
        <ScopeBar values={{ 1: inv.scope1, 2: inv.scope2Location, 3: inv.scope3 }} />
      </Card>

      <div className="grid g2">
        <Card icon="target" title="D’où viennent vos émissions">
          <div className="source-list">
            {sources.map(([cat, v]) => {
              const c = getCategory(cat);
              return (
                <div key={cat} className="source-row">
                  <span className={`req-icon s${c.scope}`} style={{ width: 36, height: 36 }}>
                    <Icon name={SOURCE_OF[cat].icon} size={17} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <strong>{SOURCE_OF[cat].label}</strong>
                      <ScopeBadge scope={c.scope} />
                    </div>
                    <div className="bar"><span style={{ width: `${(v.t / max) * 100}%`, background: `var(--s${c.scope})` }} /></div>
                  </div>
                  <div className="right">
                    <strong>{fmtMass(v.t * 1000)}</strong>
                    <div className="small muted">{total ? fmtPct(v.t / total, 1) : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card icon="chart" title="Évolution mensuelle (t CO2e)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={series}>
              <CartesianGrid vertical={false} stroke={cssVar('--border', '#ddd')} />
              <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => `${fmt(v, 2)} t CO2e`} />
              <Legend />
              <Bar dataKey="s1" name="Scope 1" stackId="a" fill={scopeColor(1)} isAnimationActive={false} />
              <Bar dataKey="s2" name="Scope 2" stackId="a" fill={scopeColor(2)} isAnimationActive={false} />
              <Bar dataKey="s3" name="Scope 3" stackId="a" fill={scopeColor(3)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card icon="zap" title="Énergie et dépenses">
        <div className="kv">
          <div><span>Énergie consommée</span><b>{fmt(inv.energyMWh)} MWh</b></div>
          <div><span>dont combustibles</span><b>{fmt(inv.energyByScope[1])} MWh</b></div>
          <div><span>dont électricité et réseaux</span><b>{fmt(inv.energyByScope[2])} MWh</b></div>
          <div><span>Dépenses associées</span><b>{fmtMoney(inv.cost, org.currency)}</b></div>
        </div>
      </Card>
    </div>
  );
}
