import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Callout, Card, ConfirmButton, Field, PageHead, Stat } from '../components/ui';
import type { Sector } from '../domain/types';
import { computeInventory } from '../lib/calc';
import { downloadFile } from '../lib/csv';
import { fmt, uid } from '../lib/format';
import { emptyState, mergeFactors, useStore, type Workspace } from '../state/store';

const SECTORS: Array<[Sector, string]> = [
  ['industrie', 'Industrie manufacturière'],
  ['chimie', 'Industrie chimique'],
  ['agroalimentaire', 'Agroalimentaire'],
  ['sante', 'Santé'],
  ['universite', 'Enseignement'],
  ['services', 'Services / bureaux'],
  ['commerce', 'Commerce / distribution'],
  ['transport', 'Transport / logistique'],
  ['autre', 'Autre'],
];

/** Portefeuille clients du cabinet : un espace de données par client. */
export function Clients() {
  const { workspace, wsDispatch } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [sector, setSector] = useState<Sector>('industrie');
  const [message, setMessage] = useState<{ tone: 'key' | 'critique'; text: string }>();

  const rows = workspace.clients.map((c) => {
    const s = c.state;
    const inv = computeInventory(s.activities, mergeFactors(s.customFactors), s.entities, s.org, s.org.reportingYear);
    return {
      c,
      inv,
      pending: s.documents.filter((d) => d.status === 'a_valider').length,
      docs: s.documents.length,
      hasEsg: !!s.esg[s.org.reportingYear]?.headcount,
    };
  });

  const add = () => {
    if (!name.trim()) return;
    const state = emptyState(name.trim());
    state.org.sector = sector;
    wsDispatch({ type: 'client:add', client: { id: uid(), createdAt: new Date().toISOString(), state }, select: true });
    setName('');
    navigate('/documents');
  };

  const importWorkspace = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Workspace;
      if (!Array.isArray(data.clients) || !data.clients.length) throw new Error('format');
      wsDispatch({ type: 'workspace:reset', workspace: { ...data, activeId: data.clients.some((c) => c.id === data.activeId) ? data.activeId : data.clients[0].id } });
      setMessage({ tone: 'key', text: `${data.clients.length} client(s) restauré(s).` });
    } catch {
      setMessage({ tone: 'critique', text: 'Fichier invalide : utilisez une sauvegarde exportée depuis cette page.' });
    }
  };

  return (
    <div className="stack">
      <PageHead
        title="Clients"
        intro="Chaque client dispose de son propre espace : sites, documents, inventaire, flotte, budgets, objectifs et rapport ESG. Sélectionnez un client pour travailler sur son dossier."
      />

      <div className="grid g3">
        <Stat accent="main" label="Clients" value={fmt(workspace.clients.length)} />
        <Stat label="Documents à valider" value={fmt(rows.reduce((s, r) => s + r.pending, 0))} sub="tous clients confondus" />
        <Stat label="Émissions suivies" value={`${fmt(rows.reduce((s, r) => s + r.inv.totalLocation, 0))} t CO2e`} sub="dernier exercice de chaque client" />
      </div>

      <Card title="Portefeuille">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th className="num">Exercice</th>
                <th className="num">Émissions</th>
                <th className="num">Documents</th>
                <th>Avancement</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, inv, pending, docs, hasEsg }) => {
                const active = c.id === workspace.activeId;
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.state.org.name}</strong> {active && <span className="badge ok">dossier ouvert</span>}
                      <div className="small muted">{SECTORS.find(([k]) => k === c.state.org.sector)?.[1]} · {c.state.entities.length} site(s)</div>
                    </td>
                    <td className="num">{c.state.org.reportingYear}</td>
                    <td className="num">{fmt(inv.totalLocation)} t</td>
                    <td className="num">
                      {docs}
                      {pending > 0 && <div className="small"><span className="badge warn">{pending} à valider</span></div>}
                    </td>
                    <td className="small">
                      <div>{inv.results.length ? '✓ inventaire' : '○ inventaire'}</div>
                      <div>{hasEsg ? '✓ données ESG' : '○ données ESG'}</div>
                    </td>
                    <td className="nowrap">
                      <button
                        className={active ? '' : 'primary'}
                        onClick={() => {
                          wsDispatch({ type: 'client:select', id: c.id });
                          navigate('/');
                        }}
                      >
                        Ouvrir
                      </button>
                      <ConfirmButton className="ghost danger" title="Supprimer" question={`Supprimer le dossier « ${c.state.org.name} » ?`} onConfirm={() => wsDispatch({ type: 'client:delete', id: c.id })}>
                        🗑
                      </ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Nouveau client">
          <div className="form-grid">
            <Field label="Raison sociale">
              <input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Société Industrielle de Sousse" onKeyDown={(e) => e.key === 'Enter' && add()} />
            </Field>
            <Field label="Secteur">
              <select id="cl-sector" value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
                {SECTORS.map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={add} disabled={!name.trim()}>Créer le dossier et déposer les documents</button>
          </div>
        </Card>

        <Card title="Cabinet et sauvegarde">
          <Field label="Nom du cabinet (affiché sur les rapports)">
            <input id="cl-firm" value={workspace.firmName} onChange={(e) => wsDispatch({ type: 'firm', name: e.target.value })} />
          </Field>
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={() => downloadFile(`carbon-jar-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(workspace), 'application/json')}>Sauvegarder tous les dossiers (JSON)</button>
            <label className="btn">
              Restaurer une sauvegarde
              <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importWorkspace(e.target.files[0])} />
            </label>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Les données sont enregistrées dans ce navigateur. Sauvegardez régulièrement le fichier JSON pour les conserver ou les transférer sur un autre poste. Les fichiers originaux (PDF, photos) restent sur ce navigateur.
          </p>
          {message && <Callout tone={message.tone}>{message.text}</Callout>}
        </Card>
      </div>
    </div>
  );
}
