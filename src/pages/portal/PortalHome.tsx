import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ProgressRing, Steps } from '../../components/progress';
import { Card, ScopeBadge, ScopeBar, Stat } from '../../components/ui';
import { DOC_TYPE_ICON } from '../../data/docIcons';
import { fmt, fmtMoney } from '../../lib/format';
import { collectionRate, requestProgress, workflowSteps } from '../../lib/progress';
import { fmtMass } from '../../lib/tracking';
import { useStore } from '../../state/store';
import { GRID_ZONES } from '../../data/emissionFactors';
import { recommend } from '../../lib/recommendations';
import { moneyView } from '../../lib/savings';
import { STATUS_PORTAL } from './PortalDocuments';

/** Accueil du portail client : avancement du dossier, documents à fournir, résultats en direct. */
export function PortalHome() {
  const { state, inventory: inv, workspace } = useStore();
  const { org, portal } = state;
  const progress = requestProgress(state);
  const col = collectionRate(progress);
  const steps = workflowSteps(state, inv);
  const recent = state.documents.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 5);
  const missing = progress.filter((p) => p.state === 'missing');
  const zone = state.entities[0]?.country ?? 'TN';
  const money = moneyView(inv, recommend(inv, { gridFactor: GRID_ZONES.find((z) => z.code === zone)?.value ?? 0.58, country: zone }), org.carbonPrice);

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <div className="eyebrow">Espace client · bilan carbone {org.reportingYear}</div>
          <h1>Bonjour, {org.name}</h1>
          <p>
            {portal.message?.trim() ||
              `${workspace.firmName} établit votre bilan carbone et votre rapport ESG. Déposez vos documents : ils sont lus et classés automatiquement dans le bon scope, puis vérifiés par nos ingénieurs.`}
          </p>
          <div className="row">
            <Link className="btn primary" to="/portail/documents">
              <Icon name="upload" size={16} /> Déposer mes documents
            </Link>
            {inv.results.length > 0 && (
              <Link className="btn" to="/portail/economies">
                <Icon name="trendDown" size={16} /> Mes économies possibles
              </Link>
            )}
          </div>
        </div>
        <ProgressRing value={col.rate} label="documents fournis" />
      </section>

      <Card icon="layers" title="Avancement de votre dossier">
        <Steps steps={steps} />
      </Card>

      <div className="grid g2">
        <Card icon="checks" title="À fournir" actions={<Link to="/portail/documents">Tout voir</Link>}>
          {missing.length === 0 ? (
            <p className="muted">Toutes les rubriques sont fournies ou déclarées non concernées. Merci !</p>
          ) : (
            <div className="todo-list">
              {missing.map((p) => (
                <Link key={p.request.id} to={`/portail/documents?r=${p.request.id}`} className="todo-item">
                  <span className={`req-icon s${p.request.scope}`} style={{ width: 34, height: 34 }}>
                    <Icon name={p.request.icon} size={17} />
                  </span>
                  <span className="grow">
                    <strong>{p.request.title}</strong>
                    <div className="small muted">{p.request.examples}</div>
                  </span>
                  {p.request.required ? <span className="badge warn">Requis</span> : <span className="badge neutral">Si concerné</span>}
                  <Icon name="arrowRight" size={16} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card icon="inbox" title="Derniers documents reçus">
          {recent.length === 0 ? (
            <p className="muted">Aucun document pour l’instant.</p>
          ) : (
            <div className="todo-list">
              {recent.map((d) => {
                const st = STATUS_PORTAL[d.status];
                return (
                  <div key={d.id} className="todo-item">
                    <span className="doc-icon"><Icon name={d.extraction ? DOC_TYPE_ICON[d.extraction.docType] : 'file'} size={16} /></span>
                    <span className="grow">
                      <strong className="small" style={{ overflowWrap: 'anywhere' }}>{d.name}</strong>
                      <div className="small muted">{new Date(d.uploadedAt).toLocaleDateString('fr-FR')}</div>
                    </span>
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {inv.results.length > 0 && (
        <Card icon="cloud" title={`Votre empreinte ${org.reportingYear} en direct`} actions={<Link to="/portail/resultats">Détail des résultats</Link>}>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Stat accent="main" icon="cloud" label="Émissions" value={`${fmt(inv.totalLocation)} t CO2e`} />
            <Stat accent="s1" icon="flame" label="Scope 1" value={fmtMass(inv.scope1 * 1000)} />
            <Stat accent="s2" icon="zap" label="Scope 2" value={fmtMass(inv.scope2Location * 1000)} />
            <Stat accent="s3" icon="globe" label="Scope 3" value={fmtMass(inv.scope3 * 1000)} />
          </div>
          <ScopeBar values={{ 1: inv.scope1, 2: inv.scope2Location, 3: inv.scope3 }} />
          <p className="small muted" style={{ marginTop: 10 }}>
            Énergie : {fmt(inv.energyMWh)} MWh · Dépenses associées : {fmtMoney(inv.cost, org.currency)}. Ces chiffres se mettent à jour à chaque document intégré.
          </p>
          <Link to="/portail/economies" className="todo-item gain-teaser">
            <span className="req-icon esg"><Icon name="trendDown" size={18} /></span>
            <span className="grow">
              <strong>Jusqu’à {fmtMoney(money.gains.total[1], org.currency)} de gains par an</strong>
              <div className="small muted">en réduisant vos émissions de {fmt(money.gains.reductionT[0])} à {fmt(money.gains.reductionT[1])} t CO2e — voir les conseils pour votre activité</div>
            </span>
            <Icon name="arrowRight" size={16} />
          </Link>
        </Card>
      )}

      <Card icon="info" title="Comment vos documents sont classés">
        <div className="grid g3">
          {([1, 2, 3] as const).map((s) => (
            <div key={s}>
              <ScopeBadge scope={s} />
              <p className="small" style={{ marginTop: 6 }}>
                {s === 1 && 'Ce que vous brûlez ou laissez fuir vous-même : gaz et fioul des chaudières, carburant des véhicules, recharges de climatisation.'}
                {s === 2 && 'L’électricité achetée (factures STEG), ainsi que la chaleur ou le froid achetés.'}
                {s === 3 && 'Les émissions chez vos partenaires : déplacements en avion ou en train, eau, déchets, achats.'}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
