import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { ExportPanel } from './ExportPanel';

type NavItem = [to: string, label: string, badge?: number];

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state, workspace, wsDispatch, storageError } = useStore();
  const loc = useLocation();
  const navigate = useNavigate();
  const pending = state.documents.filter((d) => d.status === 'a_valider').length;

  const NAV: Array<{ group: string; items: NavItem[] }> = [
    { group: 'Pilotage', items: [['/', 'Tableau de bord'], ['/suivi', 'Suivi des consommations'], ['/conseils', 'Plan de réduction'], ['/objectifs', 'Objectifs']] },
    { group: 'Collecte', items: [['/documents', 'Documents', pending], ['/donnees', 'Données d’activité'], ['/flotte', 'Flotte'], ['/classification', 'Classer en scopes']] },
    { group: 'Rapports', items: [['/rapport-esg', 'Rapport ESG'], ['/esg', 'Données ESG'], ['/inventaire', 'Inventaire GES'], ['/rapport', 'Conformité GHG']] },
    { group: 'Dossier', items: [['/clients', 'Clients'], ['/perimetre', 'Périmètre'], ['/parametres', 'Paramètres']] },
    { group: 'Référentiel', items: [['/outils', 'Calculateurs'], ['/facteurs', 'Facteurs d’émission'], ['/guide', 'Guide GHG Protocol']] },
  ];

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden>CJ</span>
          <div>
            Carbon Jar
            <small>{workspace.firmName}</small>
          </div>
        </div>
        <label className="client-switch">
          <span>Dossier client</span>
          <select
            id="client-switch"
            value={workspace.activeId}
            onChange={(e) => {
              if (e.target.value === '__new') {
                navigate('/clients');
                return;
              }
              wsDispatch({ type: 'client:select', id: e.target.value });
            }}
          >
            {workspace.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.state.org.name} · {c.state.org.reportingYear}
              </option>
            ))}
            <option value="__new">+ Nouveau client…</option>
          </select>
        </label>
        <nav className="nav" onClick={() => setOpen(false)}>
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map(([to, label, badge]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive || (to === '/guide' && loc.pathname.startsWith('/guide')) ? 'active' : '')}>
                  {label}
                  {badge ? <span className="nav-badge">{badge}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="content">
        <div className="mobile-bar">
          <button className="ghost" aria-label="Menu" onClick={() => setOpen(true)}>☰</button>
          <strong>{state.org.name}</strong>
        </div>
        <main className="main">
          {storageError && (
            <div className="callout warn no-print">
              <strong>Enregistrement impossible</strong>
              Le stockage du navigateur est plein ou bloqué : vos dernières modifications ne seront pas conservées. Sauvegardez vos dossiers depuis la page Clients.
            </div>
          )}
          {children}
        </main>
        <ExportPanel />
      </div>
    </div>
  );
}
