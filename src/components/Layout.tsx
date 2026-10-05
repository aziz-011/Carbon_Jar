import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { collectionRate, portalTabs, requestProgress } from '../lib/progress';
import { useStore } from '../state/store';
import { ExportPanel } from './ExportPanel';
import { Icon, type IconName } from './Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: number | string;
  soft?: boolean;
  locked?: boolean;
  hidden?: boolean;
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state, workspace, wsDispatch, inventory, storageError } = useStore();
  const loc = useLocation();
  const navigate = useNavigate();
  const portal = loc.pathname.startsWith('/portail');
  const pending = state.documents.filter((d) => d.status === 'a_valider' || d.status === 'erreur').length;
  const tabs = portalTabs(state, inventory);
  const missing = collectionRate(requestProgress(state)).missingRequired.length;

  const cabinetNav: Array<{ group: string; items: NavItem[] }> = [
    {
      group: 'Pilotage',
      items: [
        { to: '/', label: 'Vue d’ensemble', icon: 'dashboard' },
        { to: '/clients', label: 'Clients', icon: 'briefcase', badge: workspace.clients.length, soft: true },
      ],
    },
    {
      group: 'Traitement des données',
      items: [
        { to: '/documents', label: 'File de vérification', icon: 'checks', badge: pending || undefined },
        { to: '/donnees', label: 'Données d’activité', icon: 'table' },
        { to: '/flotte', label: 'Flotte', icon: 'car', badge: state.vehicles.length || undefined, soft: true },
        { to: '/classification', label: 'Classer en scopes', icon: 'layers' },
      ],
    },
    {
      group: 'Bilan carbone',
      items: [
        { to: '/inventaire', label: 'Inventaire GES', icon: 'cloud' },
        { to: '/suivi', label: 'Suivi & budgets', icon: 'gauge' },
        { to: '/conseils', label: 'Plan de réduction', icon: 'trendDown' },
        { to: '/objectifs', label: 'Objectifs', icon: 'target' },
      ],
    },
    {
      group: 'Rapport',
      items: [
        { to: '/esg', label: 'Données ESG', icon: 'users' },
        { to: '/rapport-esg', label: 'Rapport ESG', icon: 'report', badge: state.portal.reportPublished ? 'publié' : undefined, soft: true },
        { to: '/rapport', label: 'Conformité GHG', icon: 'shield' },
      ],
    },
    {
      group: 'Configuration',
      items: [
        { to: '/perimetre', label: 'Périmètre', icon: 'building' },
        { to: '/parametres', label: 'Paramètres', icon: 'sliders' },
        { to: '/facteurs', label: 'Facteurs d’émission', icon: 'calculator' },
        { to: '/outils', label: 'Calculateurs', icon: 'calculator' },
        { to: '/guide', label: 'Guide GHG Protocol', icon: 'book' },
      ],
    },
  ];

  const portalNav: Array<{ group: string; items: NavItem[] }> = [
    {
      group: 'Mon bilan carbone',
      items: [
        { to: '/portail', label: 'Accueil', icon: 'dashboard' },
        { to: '/portail/documents', label: 'Documents à fournir', icon: 'upload', badge: missing || undefined },
        { to: '/portail/resultats', label: 'Mes résultats', icon: 'chart', locked: !tabs.results },
        { to: '/portail/flotte', label: 'Ma flotte', icon: 'car', hidden: !tabs.fleet, badge: state.vehicles.length, soft: true },
        { to: '/portail/questionnaire', label: 'Questionnaire ESG', icon: 'users' },
        { to: '/portail/rapport', label: 'Mon rapport ESG', icon: 'report', locked: !tabs.report },
      ],
    },
  ];

  const nav = portal ? portalNav : cabinetNav;
  const current = nav.flatMap((g) => g.items).find((i) => (i.to === '/' || i.to === '/portail' ? loc.pathname === i.to : loc.pathname.startsWith(i.to)));

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <Icon name="leaf" size={20} />
          </span>
          <div>
            <div className="brand-name">Carbon Jar</div>
            <small>{portal ? 'Espace client' : workspace.firmName}</small>
          </div>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Espace">
          <Link to="/" className={portal ? '' : 'active'} role="tab" aria-selected={!portal}>
            <Icon name="briefcase" size={14} /> Cabinet
          </Link>
          <Link to="/portail" className={portal ? 'active' : ''} role="tab" aria-selected={portal}>
            <Icon name="user" size={14} /> Client
          </Link>
        </div>

        <label className="client-switch">
          <span>{portal ? 'Client' : 'Dossier client'}</span>
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
            {!portal && <option value="__new">+ Nouveau client…</option>}
          </select>
        </label>

        <nav className="nav" onClick={() => setOpen(false)}>
          {nav.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items
                .filter((i) => !i.hidden)
                .map((i) =>
                  i.locked ? (
                    <span key={i.to} className="locked" title="Disponible plus tard dans le dossier">
                      <Icon name={i.icon} size={17} />
                      {i.label}
                      <Icon name="lock" size={13} className="lock-ico" />
                    </span>
                  ) : (
                    <NavLink key={i.to} to={i.to} end={i.to === '/' || i.to === '/portail'}>
                      <Icon name={i.icon} size={17} />
                      {i.label}
                      {i.badge !== undefined && <span className={`nav-badge ${i.soft ? 'soft' : ''}`}>{i.badge}</span>}
                    </NavLink>
                  ),
                )}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">{portal ? `Dossier suivi par ${workspace.firmName}` : 'GHG Protocol · GRI · ESRS'}</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="content">
        <header className="topbar no-print">
          <button className="ghost menu-btn icon-btn" aria-label="Menu" onClick={() => setOpen(true)}>
            <Icon name="menu" size={20} />
          </button>
          <div className="crumbs">
            <span>{portal ? 'Portail client' : 'Cabinet'}</span>
            <Icon name="arrowRight" size={13} />
            <strong>{state.org.name}</strong>
            {current && (
              <>
                <Icon name="arrowRight" size={13} />
                <span className="nowrap">{current.label}</span>
              </>
            )}
          </div>
          <span className="spacer" />
          <span className="chip">
            <Icon name="clock" size={13} /> Exercice {state.org.reportingYear}
          </span>
          {portal ? (
            <Link className="btn" to="/">
              <Icon name="briefcase" size={15} /> <span className="hide-sm">Espace cabinet</span>
            </Link>
          ) : (
            <Link className="btn" to="/portail">
              <Icon name="eye" size={15} /> <span className="hide-sm">Voir le portail client</span>
            </Link>
          )}
        </header>
        <main className="main">
          {storageError && (
            <div className="callout warn no-print">
              <Icon name="alert" size={17} />
              <div className="callout-body">
                <strong>Enregistrement impossible</strong>
                Le stockage du navigateur est plein ou bloqué : vos dernières modifications ne seront pas conservées. Sauvegardez vos dossiers depuis la page Clients.
              </div>
            </div>
          )}
          {children}
        </main>
        <ExportPanel />
      </div>
    </div>
  );
}
