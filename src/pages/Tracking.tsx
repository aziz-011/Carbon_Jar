import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FactorSelect } from '../components/FactorSelect';
import { Callout, Card, ConfirmButton, Field, NumberInput, PageHead, ProgressBar, Stat, cssVar, scopeColor } from '../components/ui';
import type { Budget, Scope } from '../domain/types';
import { fmt, fmtMoney, fmtPct, uid } from '../lib/format';
import { budgetStatus, budgetUnit, monthlySeries } from '../lib/tracking';
import { useStore } from '../state/store';

const LEVEL = { ok: ['ok', 'Dans le budget'], attention: ['warn', 'À surveiller'], depasse: ['danger', 'Dépassé'] } as const;

export function Tracking() {
  const { state, dispatch, inventoryFor, years, factorById } = useStore();
  const { org } = state;
  const [year, setYear] = useState(org.reportingYear);
  const inv = inventoryFor(year);
  const series = monthlySeries(inv.results, year);
  const dated = inv.results.filter((r) => r.activity.periodStart).length;
  const axis = cssVar('--muted', '#888');
  const grid = cssVar('--border', '#ddd');
  const budgets = state.budgets.filter((b) => b.year === year);
  const blank: Budget = { id: '', name: '', year, metric: 'quantity', factorIds: ['elec_TN'], limit: 0 };
  const [draft, setDraft] = useState<Budget>(blank);
  const unitOf = (id: string) => factorById.get(id)?.unit;

  const save = () => {
    if (!draft.name.trim() || !(draft.limit > 0)) return;
    dispatch({ type: 'budget:upsert', budget: { ...draft, id: draft.id || uid(), year: draft.year || year } });
    setDraft(blank);
  };

  const now = new Date();
  const elapsed = year === now.getFullYear() ? (now.getMonth() + now.getDate() / 31) / 12 : year < now.getFullYear() ? 1 : 0;

  return (
    <div className="stack">
      <PageHead
        eyebrow="Bilan carbone"
        icon="gauge"
        title="Suivi des consommations"
        intro="Consommé, restant et projection de fin d’année pour chaque budget, mis à jour dès qu’un document est validé ou qu’une donnée est saisie."
        actions={
          <select id="tr-year" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année">
            {[...new Set([...years, year])].sort().map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        }
      />

      <div className="grid g4">
        <Stat accent="main" label={`Émissions ${year}`} value={`${fmt(inv.totalLocation)} t CO2e`} sub={`S1 ${fmt(inv.scope1)} · S2 ${fmt(inv.scope2Location)} · S3 ${fmt(inv.scope3)}`} />
        <Stat label="Énergie" value={`${fmt(inv.energyMWh)} MWh`} />
        <Stat label="Dépenses" value={fmtMoney(inv.cost, org.currency)} />
        <Stat label="Données datées" value={`${dated} / ${inv.results.length}`} sub="les autres sont réparties sur l’année" />
      </div>

      <Card icon="gauge" title="Budgets">
        {budgets.length === 0 && <p className="muted">Aucun budget pour {year}. Ajoutez-en un ci-dessous (ex. kWh d’électricité, litres de gazole, t CO2e, dépenses).</p>}
        <div className="budgets">
          {budgets.map((b) => {
            const unit = budgetUnit(b, unitOf, org.currency);
            const st = budgetStatus(b, inv.results, unit);
            const [badge, label] = LEVEL[st.level];
            return (
              <div key={b.id} className="budget">
                <div className="budget-head">
                  <strong>{b.name}</strong>
                  <span className={`badge ${badge}`}>{label}</span>
                </div>
                <div className="budget-figures">
                  <div>
                    <span className="small muted">Consommé</span>
                    <b>{fmt(st.used)} {unit}</b>
                  </div>
                  <div>
                    <span className="small muted">Restant</span>
                    <b className={st.remaining < 0 ? 'neg' : ''}>{fmt(st.remaining)} {unit}</b>
                  </div>
                  <div>
                    <span className="small muted">Projection {year}</span>
                    <b>{st.coverage > 0 ? `${fmt(st.projected)} ${unit}` : '—'}</b>
                  </div>
                </div>
                <ProgressBar value={st.usedPct} color={st.level === 'depasse' ? 'var(--danger)' : st.level === 'attention' ? 'var(--warn)' : undefined} />
                <div className="small muted" style={{ marginTop: 4 }}>
                  {fmtPct(st.usedPct)} du budget de {fmt(b.limit)} {unit} · données sur {fmt(st.coverage * 12)} mois
                  {elapsed > 0 && elapsed < 1 ? ` · ${fmtPct(elapsed)} de l’année écoulée` : ''}
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <button className="ghost" onClick={() => setDraft(b)}>Modifier</button>
                  <ConfirmButton className="ghost danger" question="Supprimer ce budget ?" onConfirm={() => dispatch({ type: 'budget:delete', id: b.id })}>
                    Supprimer
                  </ConfirmButton>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid g2">
        <Card title={`Émissions mensuelles ${year} (t CO2e)`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={series}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => `${fmt(v, 2)} t CO2e`} />
              <Legend />
              <Bar dataKey="s1" name="Scope 1" stackId="a" fill={scopeColor(1)} isAnimationActive={false} />
              <Bar dataKey="s2" name="Scope 2" stackId="a" fill={scopeColor(2)} isAnimationActive={false} />
              <Bar dataKey="s3" name="Scope 3" stackId="a" fill={scopeColor(3)} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`Énergie et dépenses mensuelles ${year}`}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis yAxisId="e" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <YAxis yAxisId="c" orientation="right" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => fmt(v / 1000)} />
              <Tooltip formatter={(v: number, n: string) => (n === 'MWh' ? `${fmt(v, 1)} MWh` : fmtMoney(v, org.currency))} />
              <Legend />
              <Line yAxisId="e" dataKey="mwh" name="MWh" stroke={cssVar('--accent', '#1f7a5c')} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="c" dataKey="cost" name={`Dépenses (k${org.currency})`} stroke={cssVar('--s3', '#2f7fa8')} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      {dated < inv.results.length && (
        <Callout tone="info">Les données sans période (saisies annuelles) sont réparties uniformément sur les 12 mois. Les factures déposées dans « Documents » sont placées sur leur période réelle.</Callout>
      )}

      <Card title={draft.id ? `Modifier « ${draft.name} »` : 'Nouveau budget'}>
        <div className="form-grid">
          <Field label="Nom">
            <input id="bd-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Électricité STEG 2025" />
          </Field>
          <Field label="Mesure">
            <select id="bd-metric" value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value as Budget['metric'] })}>
              <option value="quantity">Quantité consommée (kWh, L, m³…)</option>
              <option value="emissions">Émissions (t CO2e)</option>
              <option value="energy">Énergie (MWh)</option>
              <option value="cost">Dépenses ({org.currency})</option>
            </select>
          </Field>
          {draft.metric === 'quantity' ? (
            <Field label="Source suivie" wide>
              <FactorSelect factors={[...factorById.values()]} value={draft.factorIds?.[0] ?? ''} onChange={(id) => setDraft({ ...draft, factorIds: id ? [id] : [] })} />
            </Field>
          ) : (
            <div className="row">
              {([1, 2, 3] as Scope[]).map((s) => (
                <label key={s} className="check">
                  <input
                    type="checkbox"
                    checked={draft.scopes?.includes(s) ?? false}
                    onChange={() => setDraft({ ...draft, scopes: draft.scopes?.includes(s) ? draft.scopes.filter((x) => x !== s) : [...(draft.scopes ?? []), s].sort() })}
                  />
                  Scope {s}
                </label>
              ))}
            </div>
          )}
          <Field label={`Plafond (${budgetUnit(draft, unitOf, org.currency)})`}>
            <NumberInput value={draft.limit || undefined} onChange={(v) => setDraft({ ...draft, limit: v ?? 0 })} min={0} />
          </Field>
          <Field label="Année">
            <NumberInput value={draft.year} onChange={(v) => setDraft({ ...draft, year: v ?? year })} />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={save} disabled={!draft.name.trim() || !(draft.limit > 0)}>{draft.id ? 'Enregistrer' : 'Ajouter le budget'}</button>
          {draft.id && <button onClick={() => setDraft(blank)}>Annuler</button>}
        </div>
      </Card>
    </div>
  );
}
