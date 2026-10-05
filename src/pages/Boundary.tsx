import { useState } from 'react';
import { Callout, Card, ConfirmButton, NumberInput, PageHead } from '../components/ui';
import { GRID_ZONES } from '../data/emissionFactors';
import type { ConsolidationApproach, Entity } from '../domain/types';
import { computeInventory, consolidationShare } from '../lib/calc';
import { fmt, uid } from '../lib/format';
import { useStore } from '../state/store';

export const APPROACHES: Array<[ConsolidationApproach, string, string]> = [
  ['equity', 'Part de capital', 'Émissions au prorata de la participation économique. Typique des coentreprises multi-partenaires.'],
  ['financial', 'Contrôle financier', '100 % des entités consolidées en intégration globale (périmètre IFRS). Aligné sur la CSRD.'],
  ['operational', 'Contrôle opérationnel', '100 % des opérations dont l’entreprise définit les politiques d’exploitation. Plus de leviers d’action.'],
];

export function Boundary() {
  const { state, dispatch, factors } = useStore();
  const { org, entities } = state;
  const [draft, setDraft] = useState<Entity>({ id: '', name: '', equityShare: 100, financialControl: true, operationalControl: true, country: 'FR' });

  const compare = APPROACHES.map(([id, label]) => {
    const inv = computeInventory(state.activities, factors, entities, { gwpSet: org.gwpSet, consolidation: id }, org.reportingYear);
    return { id, label, inv };
  });

  const save = () => {
    if (!draft.name.trim()) return;
    dispatch({ type: 'entity:upsert', entity: { ...draft, id: draft.id || uid() } });
    setDraft({ id: '', name: '', equityShare: 100, financialControl: true, operationalControl: true, country: 'FR' });
  };

  return (
    <div className="stack">
      <PageHead
        title="Périmètre organisationnel"
        intro="Définissez les entités (filiales, sites, coentreprises) et l’approche de consolidation. Le choix doit être documenté et appliqué de manière constante ; un changement d’approche déclenche le recalcul de l’année de base."
      />

      <Card title="Approche de consolidation">
        <div className="grid g3">
          {APPROACHES.map(([id, label, desc]) => (
            <label key={id} className="card" style={{ cursor: 'pointer', borderColor: org.consolidation === id ? 'var(--accent)' : undefined }}>
              <div className="row">
                <input type="radio" name="approach" checked={org.consolidation === id} onChange={() => dispatch({ type: 'org', patch: { consolidation: id } })} />
                <strong>{label}</strong>
              </div>
              <p className="small muted" style={{ margin: '6px 0 0' }}>{desc}</p>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Entités du périmètre">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entité</th>
                <th>Pays (réseau électrique)</th>
                <th className="num">Part de capital</th>
                <th>Contrôle financier</th>
                <th>Contrôle opérationnel</th>
                <th className="num">Part consolidée</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{GRID_ZONES.find((z) => z.code === e.country)?.name ?? e.country}</td>
                  <td className="num">{fmt(e.equityShare)} %</td>
                  <td>{e.financialControl ? '✔︎' : '—'}</td>
                  <td>{e.operationalControl ? '✔︎' : '—'}</td>
                  <td className="num">
                    <strong>{fmt(consolidationShare(e, org.consolidation) * 100)} %</strong>
                  </td>
                  <td className="nowrap">
                    <button className="ghost" onClick={() => setDraft(e)} title="Modifier">✏️</button>
                    <ConfirmButton className="ghost danger" title="Supprimer" question="Supprimer l’entité et ses données ?" onConfirm={() => dispatch({ type: 'entity:delete', id: e.id })}>
                      🗑
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 16 }}>{draft.id ? 'Modifier l’entité' : 'Ajouter une entité'}</h3>
        <div className="form-grid">
          <label className="field">
            <span>Nom</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Usine, filiale, coentreprise…" />
          </label>
          <label className="field">
            <span>Pays</span>
            <select value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })}>
              {GRID_ZONES.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Part de capital (%)</span>
            <NumberInput value={draft.equityShare} onChange={(v) => setDraft({ ...draft, equityShare: v ?? 0 })} min={0} />
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.financialControl} onChange={(e) => setDraft({ ...draft, financialControl: e.target.checked })} /> Contrôle financier
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.operationalControl} onChange={(e) => setDraft({ ...draft, operationalControl: e.target.checked })} /> Contrôle opérationnel
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={save} disabled={!draft.name.trim()}>
            {draft.id ? 'Enregistrer' : 'Ajouter'}
          </button>
          {draft.id && <button onClick={() => setDraft({ id: '', name: '', equityShare: 100, financialControl: true, operationalControl: true, country: 'FR' })}>Annuler</button>}
        </div>
      </Card>

      <Card title={`Impact de l’approche sur l’inventaire ${org.reportingYear} (t CO2e)`}>
        <table>
          <thead>
            <tr>
              <th>Approche</th>
              <th className="num">Scope 1</th>
              <th className="num">Scope 2 (LB)</th>
              <th className="num">Scope 3</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {compare.map(({ id, label, inv }) => (
              <tr key={id} className={id === org.consolidation ? 'total' : ''}>
                <td>
                  {label} {id === org.consolidation && <span className="badge ok">retenue</span>}
                </td>
                <td className="num">{fmt(inv.scope1)}</td>
                <td className="num">{fmt(inv.scope2Location)}</td>
                <td className="num">{fmt(inv.scope3)}</td>
                <td className="num">{fmt(inv.totalLocation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Callout tone="info" title="Cas Holland Industries">
          Pour une coentreprise détenue à 50 %, on déclare 50 % de ses émissions en part de capital, mais 0 % en contrôle opérationnel si le partenaire détient seul la licence d’exploitation. En cas de contrôle financier conjoint, appliquer la part de capital à cette entité. Si l’entreprise détient 100 % de ses opérations, l’approche n’a pas d’impact.
        </Callout>
      </Card>
    </div>
  );
}
