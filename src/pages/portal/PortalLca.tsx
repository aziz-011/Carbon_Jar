import { Icon } from '../../components/Icon';
import { Card, Empty, PageHead } from '../../components/ui';
import { fmt, fmtPct } from '../../lib/format';
import { LCA_STAGES, assessLca } from '../../lib/lca';
import { useStore } from '../../state/store';
import { LifecycleStrip } from '../Lca';

/** Portail client : résultat de l'analyse de cycle de vie du produit, publié par le cabinet. */
export function PortalLca() {
  const { state, factorById, workspace } = useStore();
  const study = state.lca;
  if (!study?.published) {
    return (
      <div className="stack">
        <PageHead eyebrow="Analyse de cycle de vie" icon="recycle" title="Cycle de vie de votre produit" />
        <Empty icon="recycle">{workspace.firmName} réalise l’analyse de cycle de vie de votre produit. Les résultats s’afficheront ici dès leur publication.</Empty>
      </div>
    );
  }
  const a = assessLca(study, factorById, state.org.gwpSet);
  const annual = study.annualUnits ? (a.total * study.annualUnits) / 1000 : undefined;
  const top = [...LCA_STAGES].filter((s) => study.stages.includes(s.id)).sort((x, y) => a.byStage[y.id] - a.byStage[x.id])[0];
  const kmCar = a.total / 0.193; // voiture thermique moyenne, kg CO2e/km

  return (
    <div className="stack">
      <section className="hero lca-hero">
        <div>
          <div className="eyebrow">Analyse de cycle de vie · ISO 14040 / 14044</div>
          <h1>{study.product}</h1>
          <p>
            Empreinte carbone pour <strong>{study.functionalUnit}</strong>, de l’extraction des matières premières {study.boundary === 'berceau_tombe' ? 'jusqu’à la fin de vie' : 'jusqu’à la sortie de l’usine'}.
          </p>
          <div className="row">
            <span className="badge info"><Icon name="layers" size={12} /> {study.stages.length} étapes du cycle de vie</span>
            <span className="badge ok"><Icon name="checkCircle" size={12} /> Étude vérifiée par {workspace.firmName}</span>
          </div>
        </div>
        <div className="lca-total">
          <span>Empreinte du produit</span>
          <b>{fmt(a.total, 0)}</b>
          <small>kg CO2e par unité</small>
        </div>
      </section>

      <Card icon="recycle" title="Les étapes du cycle de vie">
        <LifecycleStrip study={study} a={a} />
        <p className="small muted" style={{ marginTop: 12 }}>
          L’étape « {top.label} » pèse le plus : {fmtPct(a.byStage[top.id] / a.total)} de l’empreinte de votre produit.
        </p>
      </Card>

      <div className="grid g4">
        <div className="card stat">
          <span className="label">Sur une année</span>
          <span className="value">{annual !== undefined ? `${fmt(annual, 0)} t CO2e` : '—'}</span>
          <span className="sub">{study.annualUnits ? `pour ${fmt(study.annualUnits)} unités produites` : 'production annuelle non renseignée'}</span>
        </div>
        <div className="card stat">
          <span className="label">Énergie</span>
          <span className="value">{fmt(a.energyKwh, 0)} kWh</span>
          <span className="sub">par unité, sur tout le cycle</span>
        </div>
        <div className="card stat">
          <span className="label">Équivalent</span>
          <span className="value">{fmt(kmCar, 0)} km</span>
          <span className="sub">parcourus en voiture thermique</span>
        </div>
        <div className="card stat">
          <span className="label">Recyclage en fin de vie</span>
          <span className="value pos">{a.avoided > 0 ? `−${fmt(a.avoided, 0)} kg` : '—'}</span>
          <span className="sub">CO2e évités, comptés à part</span>
        </div>
      </div>

      <div className="grid g2">
        <Card icon="bulb" title="Ce qu’il faut retenir">
          {study.conclusions ? <p>{study.conclusions}</p> : <p className="muted">Synthèse en cours de rédaction.</p>}
        </Card>
        <Card icon="trendDown" title="Nos recommandations">
          {study.recommendations.length ? (
            <ol className="lca-reco-list readonly">
              {study.recommendations.map((r, i) => (
                <li key={i}><span>{r}</span></li>
              ))}
            </ol>
          ) : (
            <p className="muted">Recommandations en cours de rédaction.</p>
          )}
        </Card>
      </div>

      <Card icon="book" title="Méthode">
        <ul className="clean small">
          <li><strong>Unité fonctionnelle :</strong> {study.functionalUnit}.</li>
          <li><strong>Frontières :</strong> {study.boundary === 'berceau_tombe' ? 'du berceau à la tombe' : 'du berceau à la porte'} — {LCA_STAGES.filter((s) => study.stages.includes(s.id)).map((s) => s.short.toLowerCase()).join(', ')}.</li>
          <li><strong>Phases ISO 14040/14044 :</strong> objectifs et périmètre, inventaire des flux ({study.flows.length} flux), évaluation des impacts, interprétation.</li>
          <li><strong>Indicateur :</strong> {study.method}</li>
          <li><strong>Qualité des données :</strong> {fmtPct(1 - a.estimatedShare)} des émissions reposent sur des données mesurées ou calculées.</li>
        </ul>
      </Card>
    </div>
  );
}
