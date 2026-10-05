import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ProgressRing } from '../../components/progress';
import { Card, Empty, PageHead } from '../../components/ui';
import type { DataQuality } from '../../domain/types';
import { complianceChecks } from '../../lib/compliance';
import { fmtPct } from '../../lib/format';
import { useStore } from '../../state/store';

const QUALITY: Array<[DataQuality, string, string]> = [
  [1, 'Mesure directe', 'compteurs, analyseurs en continu'],
  [2, 'Donnée facturée', 'factures, relevés, registres'],
  [3, 'Calcul à partir des équipements', 'kilométrage × consommation, extractions d’achats'],
  [4, 'Estimation', 'enquêtes, ratios monétaires'],
];

const STANDARDS: Array<[string, string]> = [
  ['GHG Protocol — Corporate Standard', 'Méthode de référence pour le calcul et la déclaration des Scopes 1, 2 et 3.'],
  ['GHG Protocol — Scope 2 Guidance', 'Double calcul de l’électricité : réseau (location-based) et contrats (market-based).'],
  ['ISO 14064-1', 'Norme internationale de quantification des émissions d’une organisation, compatible avec ce bilan.'],
  ['GRI 305 — Émissions', 'Indicateurs 305-1 à 305-5 repris dans votre rapport ESG.'],
  ['ESRS E1 (CSRD)', 'Informations climat attendues par vos clients et partenaires européens.'],
];

/** Portail client : conformité du bilan aux exigences de déclaration du GHG Protocol. */
export function PortalCompliance() {
  const { state, inventory: inv, inventoryFor, workspace } = useStore();
  const { org } = state;
  const checks = complianceChecks(state, inv, inventoryFor(org.baseYear));
  const required = checks.filter((c) => !c.optional);
  const met = required.filter((c) => c.ok).length;
  const todo = checks.filter((c) => !c.ok);
  const total = inv.totalLocation;
  const share = (q: DataQuality) => (total ? inv.results.filter((r) => r.activity.quality === q).reduce((s, r) => s + r.kgCO2e / 1000, 0) / total : 0);
  const withEvidence = inv.results.length ? inv.results.filter((r) => r.activity.evidence).length / inv.results.length : 0;

  if (inv.results.length === 0) {
    return (
      <div className="stack">
        <PageHead eyebrow={`Exercice ${org.reportingYear}`} icon="shield" title="Conformité aux exigences" />
        <Empty icon="shield">La vérification de conformité s’affichera dès que vos premiers documents seront intégrés au bilan.</Empty>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <div className="eyebrow">Conformité · bilan carbone {org.reportingYear}</div>
          <h1>Conformité aux exigences</h1>
          <p>
            {met === required.length
              ? `Votre bilan respecte les ${required.length} exigences de déclaration du GHG Protocol. Il peut être présenté à un vérificateur externe, à vos clients ou à vos financeurs.`
              : `${met} exigence(s) sur ${required.length} sont satisfaites. ${workspace.firmName} complète les points restants avec vous avant la publication du rapport.`}
          </p>
          <div className="row">
            <span className="badge ok"><Icon name="checks" size={12} /> {fmtPct(withEvidence)} des données justifiées par une pièce</span>
            {inv.scope3 > 0 && <span className="badge ok"><Icon name="globe" size={12} /> Scope 3 couvert</span>}
          </div>
        </div>
        <ProgressRing value={required.length ? met / required.length : 0} label="exigences satisfaites" />
      </section>

      {todo.length > 0 && (
        <Card icon="alert" title="Points à compléter">
          <ul className="compliance">
            {todo.map((c) => (
              <li key={c.id} className="todo">
                <Icon name="alert" size={18} className="warn-ico" />
                <div>
                  <strong>{c.label}</strong>
                  <div className="small">{c.todo ?? c.why}</div>
                </div>
                <Link className="btn" to="/portail/documents">Déposer</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card icon="shield" title="Exigences du GHG Protocol">
        <ul className="compliance">
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? 'ok' : 'todo'}>
              {c.ok ? <Icon name="checkCircle" size={18} className="ok-ico" /> : <Icon name="alert" size={18} className="warn-ico" />}
              <div>
                <strong>{c.label}</strong>
                {c.optional && <span className="badge neutral small" style={{ marginLeft: 6 }}>facultatif</span>}
                <div className="small muted">{c.why}</div>
              </div>
              <span className={`badge ${c.ok ? 'ok' : 'warn'}`}>{c.detail}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid g2">
        <Card icon="gauge" title="Qualité de vos données">
          <p className="small muted">Part des émissions selon l’origine de la donnée : plus elle est mesurée ou facturée, plus le bilan est fiable.</p>
          <div className="quality-bars">
            {QUALITY.map(([q, label, ex]) => (
              <div key={q}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span><strong>{label}</strong> <span className="small muted">· {ex}</span></span>
                  <strong>{fmtPct(share(q))}</strong>
                </div>
                <div className="bar"><span className={`q${q}`} style={{ width: `${Math.round(share(q) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card icon="book" title="Référentiels couverts">
          <ul className="compliance">
            {STANDARDS.map(([name, text]) => (
              <li key={name} className="ok">
                <Icon name="checkCircle" size={18} className="ok-ico" />
                <div>
                  <strong>{name}</strong>
                  <div className="small muted">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
