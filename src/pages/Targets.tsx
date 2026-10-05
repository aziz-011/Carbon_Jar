import { Icon } from '../components/Icon';
import { useState } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { Callout, Card, NumberInput, PageHead, ProgressBar, cssVar } from '../components/ui';
import type { Scope, Target } from '../domain/types';
import { SBTI_ANNUAL_RATE_15C, targetProgress, targetTrajectory, type Inventory } from '../lib/calc';
import { fmt, fmtPct, uid } from '../lib/format';
import { useStore } from '../state/store';

function valueOf(inv: Inventory, t: Target, metric: number | undefined): number | undefined {
  const s2 = t.scope2Method === 'location' ? inv.scope2Location : inv.scope2Market;
  const abs = (t.scopes.includes(1) ? inv.scope1 : 0) + (t.scopes.includes(2) ? s2 : 0) + (t.scopes.includes(3) ? inv.scope3 : 0);
  if (t.type === 'absolute') return abs;
  return metric && metric > 0 ? abs / metric : undefined;
}

export function Targets() {
  const { state, dispatch, inventoryFor, years } = useStore();
  const { org } = state;
  const blank: Target = { id: '', name: '', type: 'absolute', scopes: [1, 2], baseYear: org.baseYear, targetYear: org.baseYear + 6, reductionPct: 42, scope2Method: 'market' };
  const [draft, setDraft] = useState<Target>(blank);

  const save = () => {
    if (!draft.name.trim()) return;
    dispatch({ type: 'target:upsert', target: { ...draft, id: draft.id || uid() } });
    setDraft(blank);
  };

  const toggleScope = (s: Scope) =>
    setDraft((d) => ({ ...d, scopes: d.scopes.includes(s) ? d.scopes.filter((x) => x !== s) : [...d.scopes, s].sort() }));

  return (
    <div className="stack">
      <PageHead
        eyebrow="Bilan carbone"
        icon="target"
        title="Objectifs & trajectoire"
        intro="Fixez des objectifs absolus (réduction du tonnage total) ou d’intensité (par unité d’activité), suivez votre trajectoire par rapport à l’année de base. Les crédits carbone ne sont jamais soustraits des émissions."
      />

      {state.targets.length === 0 && <Callout tone="info">Aucun objectif défini. Ajoutez-en un ci-dessous.</Callout>}

      {state.targets.map((t) => {
        const unit = t.type === 'absolute' ? 't CO2e' : `t CO2e / ${org.intensityMetricLabel}`;
        const base = valueOf(inventoryFor(t.baseYear), t, org.intensityMetric[t.baseYear]);
        const current = valueOf(inventoryFor(org.reportingYear), t, org.intensityMetric[org.reportingYear]);
        if (base === undefined || base <= 0) {
          return (
            <Card key={t.id} title={t.name}>
              <Callout tone="warn">
                Pas de données exploitables pour l’année de base {t.baseYear}
                {t.type === 'intensity' ? ' (ou métrique d’activité manquante dans les paramètres)' : ''}.
              </Callout>
            </Card>
          );
        }
        const traj = targetTrajectory(base, t.baseYear, t.targetYear, t.reductionPct);
        const prog = current !== undefined ? targetProgress(base, current, t.reductionPct) : undefined;
        const expectedNow = traj.points.find((p) => p.year === org.reportingYear)?.value;
        const onTrack = current !== undefined && expectedNow !== undefined ? current <= expectedNow : undefined;
        const data = [...new Set([...traj.points.map((p) => p.year), ...years])]
          .sort()
          .map((y) => ({
            year: y,
            trajectoire: traj.points.find((p) => p.year === y)?.value,
            réel: y >= t.baseYear ? valueOf(inventoryFor(y), t, org.intensityMetric[y]) : undefined,
          }))
          .map((d) => ({ ...d, réel: d.réel && d.réel > 0 ? d.réel : undefined }));

        return (
          <Card
            key={t.id}
            title={t.name}
            actions={
              <>
                <span className="badge neutral">{t.type === 'absolute' ? 'Absolu' : 'Intensité'}</span>
                <span className="badge neutral">Scopes {t.scopes.join('+')}</span>
                {t.scopes.includes(2) && <span className="badge neutral">S2 {t.scope2Method === 'location' ? 'location' : 'market'}-based</span>}
                <button className="ghost" onClick={() => setDraft(t)}><Icon name="edit" size={16} /></button>
                <button className="ghost danger" onClick={() => dispatch({ type: 'target:delete', id: t.id })}><Icon name="trash" size={16} /></button>
              </>
            }
          >
            <div className="grid g2">
              <div>
                <table>
                  <tbody>
                    <tr><td>Année de base {t.baseYear}</td><td className="num">{fmt(base, 3)} {unit}</td></tr>
                    <tr><td>Cible {t.targetYear} (−{fmt(t.reductionPct)} %)</td><td className="num">{fmt(traj.target, 3)} {unit}</td></tr>
                    <tr><td>Réel {org.reportingYear}</td><td className="num">{current !== undefined ? `${fmt(current, 3)} ${unit}` : '—'}</td></tr>
                    <tr><td>Trajectoire attendue {org.reportingYear}</td><td className="num">{expectedNow !== undefined ? `${fmt(expectedNow, 3)} ${unit}` : '—'}</td></tr>
                    <tr>
                      <td>Rythme annuel requis</td>
                      <td className="num">
                        {fmt(traj.annualRatePct, 1)} %/an{' '}
                        {t.type === 'absolute' && (
                          <span className={`badge ${traj.annualRatePct >= SBTI_ANNUAL_RATE_15C ? 'ok' : 'warn'}`}>
                            {traj.annualRatePct >= SBTI_ANNUAL_RATE_15C ? 'aligné 1,5 °C' : `< ${SBTI_ANNUAL_RATE_15C} %/an SBTi`}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {prog && (
                  <div style={{ marginTop: 12 }}>
                    <div className="row small">
                      <span>Réduction réalisée : <strong>{fmtPct(prog.achievedPct / 100, 1)}</strong> sur {fmt(t.reductionPct)} % visés</span>
                      <span className="spacer" />
                      {onTrack !== undefined && <span className={`badge ${onTrack ? 'ok' : 'danger'}`}>{onTrack ? 'Sur la trajectoire' : 'En retard sur la trajectoire'}</span>}
                    </div>
                    <ProgressBar value={prog.progress} color={onTrack === false ? 'var(--danger)' : undefined} />
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data}>
                  <CartesianGrid vertical={false} stroke={cssVar('--border', '#ddd')} />
                  <XAxis dataKey="year" tick={{ fill: cssVar('--muted', '#888'), fontSize: 11 }} />
                  <YAxis tick={{ fill: cssVar('--muted', '#888'), fontSize: 11 }} tickFormatter={(v) => fmt(v)} domain={[0, 'auto']} />
                  <Tooltip formatter={(v: number) => `${fmt(v, 3)} ${unit}`} />
                  <Legend />
                  <Line type="linear" dataKey="trajectoire" stroke={cssVar('--emerald', '#059669')} strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls />
                  <Scatter dataKey="réel" fill={cssVar('--chart-red', '#d62828')} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      })}

      <Card title={draft.id ? 'Modifier l’objectif' : 'Nouvel objectif'}>
        <div className="form-grid">
          <label className="field wide">
            <span>Intitulé</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex. : Réduire de 42 % les émissions Scopes 1+2 d’ici 2030" />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Target['type'] })}>
              <option value="absolute">Absolu (t CO2e)</option>
              <option value="intensity">Intensité (t CO2e / {org.intensityMetricLabel})</option>
            </select>
          </label>
          <label className="field">
            <span>Année de base</span>
            <NumberInput value={draft.baseYear} onChange={(v) => setDraft({ ...draft, baseYear: v ?? org.baseYear })} />
          </label>
          <label className="field">
            <span>Année cible</span>
            <NumberInput value={draft.targetYear} onChange={(v) => setDraft({ ...draft, targetYear: v ?? draft.baseYear + 5 })} />
          </label>
          <label className="field">
            <span>Réduction visée (%)</span>
            <NumberInput value={draft.reductionPct} onChange={(v) => setDraft({ ...draft, reductionPct: v ?? 0 })} min={0} />
          </label>
          <label className="field">
            <span>Méthode Scope 2</span>
            <select value={draft.scope2Method} onChange={(e) => setDraft({ ...draft, scope2Method: e.target.value as Target['scope2Method'] })}>
              <option value="market">Market-based</option>
              <option value="location">Location-based</option>
            </select>
          </label>
          <div className="row">
            {([1, 2, 3] as Scope[]).map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={draft.scopes.includes(s)} onChange={() => toggleScope(s)} /> Scope {s}
              </label>
            ))}
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Rythme implicite : {fmt(draft.reductionPct / Math.max(1, draft.targetYear - draft.baseYear), 1)} %/an — référence SBTi 1,5 °C : ≥ {SBTI_ANNUAL_RATE_15C} %/an sur les Scopes 1 et 2.
        </p>
        <div className="row">
          <button className="primary" onClick={save} disabled={!draft.name.trim() || draft.scopes.length === 0}>
            {draft.id ? 'Enregistrer' : 'Ajouter l’objectif'}
          </button>
          {draft.id && <button onClick={() => setDraft(blank)}>Annuler</button>}
        </div>
      </Card>
    </div>
  );
}
