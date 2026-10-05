import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Callout, Card, PageHead, ScopeBadge, ScopeBar } from '../../components/ui';
import { getCategory, SCOPE_LABELS } from '../../data/categories';
import { GRID_ZONES } from '../../data/emissionFactors';
import { SECTOR_LABELS, SECTOR_TIPS } from '../../data/sectorAdvice';
import { SOURCE_OF } from '../../data/sources';
import type { CategoryId, Scope } from '../../domain/types';
import { fmt, fmtMoney, fmtPct } from '../../lib/format';
import { recommend } from '../../lib/recommendations';
import { moneyView, reductionScenario } from '../../lib/savings';
import { fmtMass } from '../../lib/tracking';
import { useStore } from '../../state/store';

const SCOPE_ICON = { 1: 'flame', 2: 'zap', 3: 'globe' } as const;
const IMPACT_BADGE = { fort: 'ok', moyen: 'info', faible: 'neutral' } as const;

/** Portail client : empreinte totale et par scope, coût des émissions, gains possibles, conseils. */
export function PortalSavings() {
  const { state, inventory: inv } = useStore();
  const { org } = state;
  const cur = org.currency;
  const zone = state.entities[0]?.country ?? 'TN';
  const recos = recommend(inv, { gridFactor: GRID_ZONES.find((z) => z.code === zone)?.value ?? 0.58, country: zone });
  const money = moneyView(inv, recos, org.carbonPrice);
  const [pct, setPct] = useState(20);
  const scenario = reductionScenario(inv, pct, org.carbonPrice);
  const total = inv.totalLocation;
  const headcount = state.esg[org.reportingYear]?.headcount;
  const scopeT: Record<Scope, number> = { 1: inv.scope1, 2: inv.scope2Location, 3: inv.scope3 };
  const tips = SECTOR_TIPS[org.sector] ?? SECTOR_TIPS.autre;

  const sourcesOf = (scope: Scope) => {
    const m = new Map<CategoryId, { t: number; cost: number }>();
    for (const r of inv.results.filter((x) => x.scope === scope)) {
      const v = m.get(r.category) ?? { t: 0, cost: 0 };
      v.t += r.kgCO2e / 1000;
      v.cost += r.cost;
      m.set(r.category, v);
    }
    return [...m.entries()].sort((a, b) => b[1].t - a[1].t);
  };

  return (
    <div className="stack">
      <PageHead
        eyebrow={`Exercice ${org.reportingYear}`}
        icon="trendDown"
        title="Mon empreinte et mes économies"
        intro="Combien vous avez émis, ce que ces émissions vous coûtent, et ce que vous gagnerez en les réduisant, avec des conseils adaptés à votre activité."
      />

      {/* 1. Total */}
      <section className="hero savings-hero">
        <div>
          <div className="eyebrow">Total des émissions {org.reportingYear}</div>
          <div className="big-number">
            {fmt(total)} <span>t CO2e</span>
          </div>
          <p>
            Soit l’équivalent d’environ <strong>{fmt(total / 0.6, 0)}</strong> allers-retours Tunis–Paris en avion
            {headcount ? <> et <strong>{fmt(total / headcount, 1)} t CO2e par salarié</strong></> : null}.
          </p>
        </div>
        <div className="hero-side">
          <ScopeBar values={scopeT} />
        </div>
      </section>

      {/* 2. Détail par scope */}
      <div className="grid g3">
        {([1, 2, 3] as Scope[]).map((s) => {
          const src = sourcesOf(s);
          return (
            <Card key={s} className={`scope-card s${s}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className={`req-icon s${s}`}>
                  <Icon name={SCOPE_ICON[s]} size={20} />
                </span>
                <ScopeBadge scope={s} />
              </div>
              <h3 style={{ marginTop: 10 }}>{SCOPE_LABELS[s].title.split('—')[1].trim()}</h3>
              <div className="scope-figure">{fmtMass(scopeT[s] * 1000)}</div>
              <div className="small muted">{total ? fmtPct(scopeT[s] / total) : '—'} du total · {fmtMoney(money.spendByScope[s], cur)} dépensés</div>
              <ul className="mini-sources">
                {src.length === 0 && <li className="muted">Aucune donnée pour ce scope.</li>}
                {src.map(([cat, v]) => (
                  <li key={cat}>
                    <Icon name={SOURCE_OF[cat].icon} size={14} />
                    <span>{SOURCE_OF[cat].label}</span>
                    <b>{fmtMass(v.t * 1000)}</b>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* 3. Coûts */}
      <Card icon="briefcase" title="Ce que vous coûtent ces émissions">
        <div className="money-grid">
          <div className="money-tile">
            <span>Dépenses liées aux activités émettrices</span>
            <b>{fmtMoney(money.totalSpend, cur)}</b>
            <small>énergie, carburant, eau, achats… (factures intégrées)</small>
          </div>
          <div className="money-tile">
            <span>Coût par tonne émise</span>
            <b>{money.spendPerTonne !== undefined ? `${fmt(money.spendPerTonne, 0)} ${cur}/t` : '—'}</b>
            <small>dépenses ÷ émissions</small>
          </div>
          <div className="money-tile warn">
            <span>Coût carbone potentiel (Scopes 1 + 2)</span>
            <b>{fmtMoney(money.carbonCostScope12, cur)}</b>
            <small>à {fmt(org.carbonPrice)} {cur}/t CO2e — risque lié aux taxes et quotas carbone, et à l’ajustement carbone aux frontières de l’UE (MACF) pour les exportateurs</small>
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr><th>Scope</th><th className="num">Émissions</th><th className="num">Dépenses</th><th className="num">Coût carbone</th></tr>
          </thead>
          <tbody>
            {([1, 2, 3] as Scope[]).map((s) => (
              <tr key={s}>
                <td><ScopeBadge scope={s} /> {SCOPE_LABELS[s].short}</td>
                <td className="num">{fmtMass(scopeT[s] * 1000)}</td>
                <td className="num">{fmtMoney(money.spendByScope[s], cur)}</td>
                <td className="num">{fmtMoney(scopeT[s] * org.carbonPrice, cur)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="num">{fmtMass(total * 1000)}</td>
              <td className="num">{fmtMoney(money.totalSpend, cur)}</td>
              <td className="num">{fmtMoney(money.carbonCostTotal, cur)}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </Card>

      {/* 4. Gains */}
      <Card icon="trendDown" title="Ce que vous gagnerez en réduisant vos émissions">
        <div className="gain-banner">
          <div>
            <span>Gain annuel estimé avec nos recommandations</span>
            <b>
              {fmt(money.gains.total[0], 0)} à {fmtMoney(money.gains.total[1], cur)}
            </b>
            <small>
              {fmt(money.gains.energySaved[0], 0)}–{fmt(money.gains.energySaved[1], 0)} {cur} d’économies d’énergie + {fmt(money.gains.carbonAvoided[0], 0)}–{fmt(money.gains.carbonAvoided[1], 0)} {cur} de coût carbone évité
            </small>
          </div>
          <div>
            <span>Émissions évitées</span>
            <b>
              {fmt(money.gains.reductionT[0])} à {fmt(money.gains.reductionT[1])} t
            </b>
            <small>{total ? `${fmtPct(money.gains.reductionT[0] / total)} à ${fmtPct(money.gains.reductionT[1] / total)} de votre empreinte` : ''}</small>
          </div>
        </div>

        <div className="simulator">
          <label htmlFor="sim-pct">
            <strong>Simulateur :</strong> si je réduis mes émissions de <b className="sim-value">{pct} %</b>
          </label>
          <input id="sim-pct" type="range" min={5} max={60} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
          <div className="kv">
            <div><span>Émissions évitées</span><b>{fmt(scenario.avoidedT)} t CO2e</b></div>
            <div><span>Économies d’énergie</span><b>{fmtMoney(scenario.energySaved, cur)}</b></div>
            <div><span>Coût carbone évité</span><b>{fmtMoney(scenario.carbonSaved, cur)}</b></div>
            <div className="kv-accent"><span>Gain total par an</span><b>{fmtMoney(scenario.total, cur)}</b></div>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>Hypothèse : la baisse porte sur l’énergie et le carburant (Scopes 1 et 2), au prorata de vos dépenses actuelles.</p>
        </div>

        {recos.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr><th>Action prioritaire pour vous</th><th className="num">t CO2e évitées / an</th><th className="num">Gain / an</th></tr>
              </thead>
              <tbody>
                {recos.slice(0, 6).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="row" style={{ gap: 6 }}><ScopeBadge scope={r.scope} /><strong>{r.title}</strong></div>
                      <div className="small muted">{r.actions[0]}</div>
                    </td>
                    <td className="num">{fmt(r.reductionT[0])} – {fmt(r.reductionT[1])}</td>
                    <td className="num">
                      {fmtMoney(Math.max(0, r.costSaved[1]) + r.reductionT[1] * org.carbonPrice, cur)}
                      <div className="small muted">max.</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 5. Conseils sectoriels */}
      <Card icon="bulb" title={`Conseils pour votre activité : ${SECTOR_LABELS[org.sector] ?? 'entreprise'}`}>
        <p className="muted small">Directives adaptées à votre secteur, à mettre en œuvre avec l’accompagnement de nos ingénieurs.</p>
        <div className="tips">
          {tips.map((t) => (
            <article key={t.title} className="tip">
              <div className="tip-head">
                <span className={`req-icon s${t.scope}`}>
                  <Icon name={t.icon} size={19} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3>{t.title}</h3>
                  <div className="row" style={{ gap: 6 }}>
                    <ScopeBadge scope={t.scope} />
                    <span className={`badge ${IMPACT_BADGE[t.impact]}`}>Impact {t.impact}</span>
                    <span className="badge neutral">{t.horizon}</span>
                  </div>
                </div>
              </div>
              <p className="small">{t.why}</p>
              <ul className="checklist">
                {t.actions.map((a) => (
                  <li key={a}>
                    <Icon name="check" size={14} /> {a}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <Callout tone="key" title="Notre conseil">
          Commencez par les actions « court terme » : elles financent souvent les investissements suivants (solaire, électrification, renouvellement des équipements).
          {recos[0] && ` Pour vous, la priorité chiffrée est : ${recos[0].title.toLowerCase()} (${getCategory(recos[0].categories[0]).label.toLowerCase()}).`}
        </Callout>
      </Card>
    </div>
  );
}
