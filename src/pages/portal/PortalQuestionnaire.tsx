import { Card, Field, NumberInput, PageHead, ProgressBar } from '../../components/ui';
import type { EsgYear } from '../../domain/types';
import { ENV_EXTRA_FIELDS, GOVERNANCE_FIELDS, GOVERNANCE_PRACTICES, SOCIAL_FIELDS } from '../../lib/esgReport';
import { useStore } from '../../state/store';

const NUM_FIELDS = [...SOCIAL_FIELDS, ...ENV_EXTRA_FIELDS, ...GOVERNANCE_FIELDS];

/** Portail client : questionnaire social et gouvernance pour le rapport ESG. */
export function PortalQuestionnaire() {
  const { state, dispatch } = useStore();
  const { org } = state;
  const year = org.reportingYear;
  const esg: EsgYear = state.esg[year] ?? {};
  const patch = (p: Partial<EsgYear>) => dispatch({ type: 'esg', year, patch: p });
  const answered = NUM_FIELDS.filter((f) => esg[f.key] !== undefined).length + GOVERNANCE_PRACTICES.filter((p) => esg[p.key] !== undefined).length;
  const total = NUM_FIELDS.length + GOVERNANCE_PRACTICES.length;

  const num = (f: (typeof NUM_FIELDS)[number]) => (
    <Field key={f.key} label={`${f.label} (${f.unit === 'TND' ? org.currency : f.unit})`}>
      <NumberInput value={esg[f.key] as number | undefined} onChange={(v) => patch({ [f.key]: v } as Partial<EsgYear>)} min={0} />
    </Field>
  );

  return (
    <div className="stack">
      <PageHead
        eyebrow={`Rapport ESG ${year}`}
        icon="users"
        title="Questionnaire social et gouvernance"
        intro="Ces informations complètent votre bilan carbone dans le rapport ESG. Répondez à ce que vous connaissez ; vos réponses sont enregistrées au fur et à mesure."
      />
      <Card icon="checks" title={`${answered} réponse(s) sur ${total}`}>
        <ProgressBar value={total ? answered / total : 0} />
      </Card>
      <Card icon="users" title="Vos équipes">
        <div className="form-grid">{SOCIAL_FIELDS.map(num)}</div>
      </Card>
      <Card icon="droplet" title="Eau et déchets">
        <div className="form-grid">{ENV_EXTRA_FIELDS.map(num)}</div>
      </Card>
      <Card icon="shield" title="Gouvernance et éthique">
        <div className="form-grid">{GOVERNANCE_FIELDS.map(num)}</div>
        <div className="practices">
          {GOVERNANCE_PRACTICES.map((p) => (
            <label key={p.key} className="check">
              <input type="checkbox" checked={!!esg[p.key]} onChange={(e) => patch({ [p.key]: e.target.checked } as Partial<EsgYear>)} />
              {p.label}
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
