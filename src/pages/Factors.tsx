import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Callout, Card, Field, NumberInput, PageHead, ScopeBadge } from '../components/ui';
import { CATEGORIES, getCategory } from '../data/categories';
import { DEFAULT_FACTORS } from '../data/emissionFactors';
import { GWP_BASE, REFRIGERANTS, refrigerantGwp } from '../data/gwp';
import type { CategoryId, EmissionFactor, Scope } from '../domain/types';
import { normalize } from '../lib/classifier';
import { factorKgCO2ePerUnit } from '../lib/calc';
import { fmt, uid } from '../lib/format';
import { useStore } from '../state/store';

const DEFAULT_IDS = new Set(DEFAULT_FACTORS.map((f) => f.id));

export function Factors() {
  const { state, dispatch, factors } = useStore();
  const { org } = state;
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope | 0>(0);
  const [edit, setEdit] = useState<EmissionFactor>();
  const [editValue, setEditValue] = useState<number | undefined>();

  const list = factors.filter((f) => (scope === 0 || getCategory(f.category).scope === scope) && (!q || normalize(`${f.label} ${f.source} ${(f.keywords ?? []).join(' ')}`).includes(normalize(q))));
  const overridden = new Set(state.customFactors.map((f) => f.id));

  const startEdit = (f: EmissionFactor) => {
    setEdit({ ...f });
    setEditValue(factorKgCO2ePerUnit(f, org.gwpSet));
  };
  const startNew = () => {
    setEdit({ id: `custom_${uid()}`, label: '', category: 'S3_C1', unit: 'kg', co2e: 0, source: 'Facteur spécifique (fournisseur / site)', custom: true, keywords: [] });
    setEditValue(0);
  };

  const save = () => {
    if (!edit || !edit.label.trim()) return;
    const original = factors.find((f) => f.id === edit.id);
    const unchanged = original && editValue !== undefined && Math.abs(factorKgCO2ePerUnit(original, org.gwpSet) - editValue) < 1e-12;
    const factor: EmissionFactor = unchanged
      ? { ...edit, custom: true }
      : { ...edit, gases: undefined, refrigerant: undefined, co2e: editValue ?? 0, custom: true };
    dispatch({ type: 'factor:upsert', factor });
    setEdit(undefined);
  };

  return (
    <div className="stack">
      <PageHead
        eyebrow="Référentiel"
        icon="calculator"
        title="Facteurs d’émission"
        intro="Base de facteurs par défaut (GIEC, ADEME, DEFRA, IEA). Ordre de préférence : facteur spécifique au site ou au fournisseur → facteur national officiel → facteur générique. Remplacez les valeurs indicatives par vos facteurs officiels."
        actions={<button className="primary" onClick={startNew}>+ Nouveau facteur</button>}
      />

      {edit && (
        <Card title={DEFAULT_IDS.has(edit.id) ? `Surcharger : ${edit.label}` : edit.label ? `Modifier : ${edit.label}` : 'Nouveau facteur'}>
          <div className="form-grid">
            <Field label="Libellé" wide>
              <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            </Field>
            <Field label="Catégorie (détermine le scope)">
              <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as CategoryId })}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    Scope {c.scope} · {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unité d’activité">
              <input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} />
            </Field>
            <Field label={`Facteur (kg CO2e / ${edit.unit})`}>
              <NumberInput value={editValue} onChange={setEditValue} min={0} />
            </Field>
            <Field label="Énergie (kWh / unité)">
              <NumberInput value={edit.energyKwhPerUnit} onChange={(v) => setEdit({ ...edit, energyKwhPerUnit: v })} min={0} />
            </Field>
            <Field label={`Prix par défaut (${org.currency} / unité)`}>
              <NumberInput value={edit.defaultPrice} onChange={(v) => setEdit({ ...edit, defaultPrice: v })} min={0} />
            </Field>
            <Field label="Source" wide>
              <input value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} />
            </Field>
            <Field label="Mots-clés pour la classification automatique (séparés par des virgules)" wide>
              <input value={(edit.keywords ?? []).join(', ')} onChange={(e) => setEdit({ ...edit, keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </Field>
          </div>
          {edit.gases && <Callout tone="info">Modifier la valeur du facteur remplace la ventilation par gaz par une valeur agrégée en CO2e.</Callout>}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={save} disabled={!edit.label.trim()}>Enregistrer</button>
            <button onClick={() => setEdit(undefined)}>Annuler</button>
          </div>
        </Card>
      )}

      <Card
        title={`${list.length} facteurs`}
        actions={
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" style={{ width: 200 }} />
            <select value={scope} onChange={(e) => setScope(Number(e.target.value) as Scope | 0)}>
              <option value={0}>Tous les scopes</option>
              <option value={1}>Scope 1</option>
              <option value={2}>Scope 2</option>
              <option value={3}>Scope 3</option>
            </select>
          </>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Facteur</th>
                <th>Scope</th>
                <th className="num">kg CO2e / unité</th>
                <th className="num">kWh / unité</th>
                <th className="num">Prix défaut</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.label}
                    {overridden.has(f.id) && <span className="badge warn" style={{ marginLeft: 6 }}>{DEFAULT_IDS.has(f.id) ? 'surchargé' : 'personnalisé'}</span>}
                    <div className="small muted">{getCategory(f.category).label}</div>
                  </td>
                  <td><ScopeBadge scope={getCategory(f.category).scope} /></td>
                  <td className="num">
                    {fmt(factorKgCO2ePerUnit(f, org.gwpSet), 4)} <span className="muted small">/{f.unit}</span>
                    {f.biogenicCO2 ? <div className="small muted">+ {fmt(f.biogenicCO2, 3)} biogénique</div> : null}
                  </td>
                  <td className="num">{f.energyKwhPerUnit ? fmt(f.energyKwhPerUnit, 2) : '—'}</td>
                  <td className="num">{f.defaultPrice !== undefined ? fmt(f.defaultPrice, 3) : '—'}</td>
                  <td className="small muted" style={{ maxWidth: 260 }}>{f.source}</td>
                  <td className="nowrap">
                    <button className="ghost" onClick={() => startEdit(f)} title="Modifier"><Icon name="edit" size={16} /></button>
                    {overridden.has(f.id) && (
                      <button className="ghost" onClick={() => dispatch({ type: 'factor:delete', id: f.id })} title={DEFAULT_IDS.has(f.id) ? 'Revenir à la valeur par défaut' : 'Supprimer'}>
                        {DEFAULT_IDS.has(f.id) ? <Icon name="swap" size={16} /> : <Icon name="trash" size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2">
        <Card icon="flame" title="PRG des gaz (100 ans)">
          <table>
            <thead><tr><th>Gaz</th><th className="num">AR5</th><th className="num">AR6</th></tr></thead>
            <tbody>
              {Object.entries(GWP_BASE).map(([g, v]) => (
                <tr key={g}><td>{g}</td><td className="num">{fmt(v.AR5)}</td><td className="num">{fmt(v.AR6)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card icon="snowflake" title="PRG des fluides frigorigènes">
          <table>
            <thead><tr><th>Fluide</th><th className="num">AR5</th><th className="num">AR6</th></tr></thead>
            <tbody>
              {REFRIGERANTS.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="num">{fmt(refrigerantGwp(r.id, 'AR5'))}</td>
                  <td className="num">{fmt(refrigerantGwp(r.id, 'AR6'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">Mélanges : moyenne des PRG des composants pondérée par leur fraction massique.</p>
        </Card>
      </div>
    </div>
  );
}
