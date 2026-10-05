import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../state/store';
import { ExportPanel } from './ExportPanel';

const NAV: Array<{ group: string; items: Array<[string, string, string]> }> = [
  { group: 'Pilotage', items: [['/', '📊', 'Tableau de bord'], ['/conseils', '💡', 'Plan de réduction'], ['/objectifs', '🎯', 'Objectifs & trajectoire']] },
  {
    group: 'Inventaire',
    items: [
      ['/donnees', '📝', 'Données d’activité'],
      ['/classification', '🧭', 'Classer en scopes'],
      ['/inventaire', '🧾', 'Inventaire GES'],
      ['/perimetre', '🏢', 'Périmètre organisationnel'],
      ['/rapport', '📄', 'Rapport & conformité'],
    ],
  },
  { group: 'Référentiel', items: [['/outils', '🧮', 'Calculateurs'], ['/facteurs', '🔢', 'Facteurs d’émission'], ['/guide', '📚', 'Guide GHG Protocol']] },
  { group: 'Configuration', items: [['/parametres', '⚙️', 'Paramètres']] },
];

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state } = useStore();
  const loc = useLocation();
  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">
          <span style={{ fontSize: 26 }}>🫙</span>
          <div>
            Carbon Jar
            <small>{state.org.name} · {state.org.reportingYear}</small>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map(([to, ico, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive || (to === '/guide' && loc.pathname.startsWith('/guide')) ? 'active' : '')}>
                  <span className="ico">{ico}</span>
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div>
        <div className="mobile-bar">
          <button className="ghost" aria-label="Menu" onClick={() => setOpen(true)}>☰</button>
          <strong>🫙 Carbon Jar</strong>
        </div>
        <main className="main">{children}</main>
        <ExportPanel />
      </div>
    </div>
  );
}
