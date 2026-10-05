import { useMemo, useState } from 'react';
import { Callout, Card, PageHead, ScopeBadge, Stat } from '../components/ui';
import { getCategory } from '../data/categories';
import { GRID_ZONES } from '../data/emissionFactors';
import { fmt, fmtMoney, fmtPct, fmtT } from '../lib/format';
import { qualityAdvice, recommend } from '../lib/recommendations';
import { useStore } from '../state/store';

const EFFORT_BADGE = { faible: 'ok', moyen: 'warn', élevé: 'danger' } as const;

export function Advice() {
  const { state, inventory: inv, inventoryFor } = useStore();
  const { org } = state;
  const mainZone = state.entities[0]?.country ?? 'FR';
  const gridFactor = GRID_ZONES.find((z) => z.code === mainZone)?.value ?? 0.46;
  const recos = useMemo(() => recommend(inv, { gridFactor }), [inv, gridFactor]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const advice = qualityAdvice(inv, { exclusions: org.exclusions, hasBaseYearData: inventoryFor(org.baseYear).results.length > 0, offsetsT: org.offsetsTco2e });

  const chosen = recos.filter((r) => selected.has(r.id));
  const sum = (f: (r: (typeof recos)[number]) => number) => chosen.reduce((s, r) => s + f(r), 0);
  const redLow = sum((r) => r.reductionT[0]);
  const redHigh = sum((r) => r.reductionT[1]);
  const savedLow = sum((r) => r.costSaved[0]);
  const savedHigh = sum((r) => r.costSaved[1]);
  const mwhLow = sum((r) => r.energySavedMWh[0]);
  const mwhHigh = sum((r) => r.energySavedMWh[1]);
  const overlaps = chosen.some((a, i) => chosen.some((b, j) => j > i && a.categories.some((c) => b.categories.includes(c))));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="stack">
      <PageHead
        title="Plan de réduction"
        intro={`Leviers de réduction adaptés à votre inventaire ${org.reportingYear}, classés par potentiel. Chaque levier est chiffré en émissions évitées, énergie économisée et gains financiers (fourchettes indicatives à confirmer par une étude de faisabilité).`}
      />

      <div className="grid g4">
        <Stat accent="main" label="Leviers sélectionnés" value={`${chosen.length} / ${recos.length}`} sub="Cochez les leviers pour simuler votre plan" />
        <Stat label="Émissions évitées" value={chosen.length ? `${fmt(redLow)}–${fmt(redHigh)} t` : '—'} sub={chosen.length && inv.totalLocation ? `${fmtPct(redLow / inv.totalLocation)} à ${fmtPct(redHigh / inv.totalLocation)} du total` : 'CO2e par an'} />
        <Stat label="Énergie économisée" value={chosen.length ? `${fmt(mwhLow)}–${fmt(mwhHigh)} MWh` : '—'} sub="par an" />
        <Stat label="Gains financiers" value={chosen.length ? `${fmtMoney(savedLow, org.currency)} – ${fmt(savedHigh, 0)}` : '—'} sub={`+ coût carbone évité : ${fmtMoney(((redLow + redHigh) / 2) * org.carbonPrice, org.currency)}`} />
      </div>
      {overlaps && (
        <Callout tone="warn">Certains leviers sélectionnés portent sur les mêmes postes : leurs effets ne s’additionnent pas intégralement (le total est un majorant).</Callout>
      )}

      {recos.length === 0 && <Callout tone="info">Saisissez des données d’activité pour obtenir des recommandations personnalisées.</Callout>}

      {recos.map((r) => (
        <Card key={r.id} className="reco">
          <div className="row">
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Inclure dans le plan" />
            <ScopeBadge scope={r.scope} />
            <h3 style={{ margin: 0 }}>{r.title}</h3>
            <span className="spacer" />
            <span className={`badge ${EFFORT_BADGE[r.effort]}`}>Effort {r.effort}</span>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>{r.description}</p>
          <div className="small muted">
            Postes concernés : {r.categories.map((c) => getCategory(c).label).join(', ')} — {fmtT(r.baselineT)}
          </div>
          <div className="metrics">
            <div>
              <span className="small muted">Émissions évitées / an</span>
              <b>
                {fmt(r.reductionT[0])} – {fmt(r.reductionT[1])} t CO2e
              </b>
            </div>
            <div>
              <span className="small muted">Énergie économisée / an</span>
              <b>{r.energySavedMWh[1] > 0 ? `${fmt(r.energySavedMWh[0])} – ${fmt(r.energySavedMWh[1])} MWh` : '—'}</b>
            </div>
            <div>
              <span className="small muted">Gain financier / an</span>
              <b>
                {r.costSaved[0] === 0 && r.costSaved[1] === 0
                  ? '—'
                  : r.costSaved[1] <= 0
                    ? `surcoût ≈ ${fmtMoney(-r.costSaved[0], org.currency)}`
                    : `${fmt(r.costSaved[0], 0)} – ${fmtMoney(r.costSaved[1], org.currency)}`}
              </b>
            </div>
          </div>
          <ul className="clean">
            {r.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {r.note && <p className="small muted" style={{ margin: 0 }}>ℹ️ {r.note}</p>}
        </Card>
      ))}

      <Card title="Améliorer la qualité de l’inventaire">
        {advice.map((a, i) => (
          <Callout key={i} tone={a.level === 'info' ? 'info' : a.level}>
            {a.message}
          </Callout>
        ))}
        <Callout tone="key" title="Rappels du GHG Protocol">
          Les réductions de l’inventaire se mesurent par rapport à l’année de base (recalculée si besoin). Les crédits de compensation sont déclarés séparément et ne sont jamais soustraits des émissions brutes. L’engagement de la direction est indispensable à la réussite du plan.
        </Callout>
      </Card>
    </div>
  );
}
