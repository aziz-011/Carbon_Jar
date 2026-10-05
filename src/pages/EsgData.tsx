import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Callout, Card, Field, NumberInput, PageHead } from '../components/ui';
import { GRID_ZONES } from '../data/emissionFactors';
import type { EsgYear } from '../domain/types';
import { getSample } from '../lib/documents/ai';
import { ENV_EXTRA_FIELDS, GOVERNANCE_FIELDS, GOVERNANCE_PRACTICES, SOCIAL_FIELDS, buildExecutiveSummary } from '../lib/esgReport';
import { recommend } from '../lib/recommendations';
import { useStore } from '../state/store';

/** Saisie des indicateurs sociaux, de gouvernance et de la synthèse du rapport ESG. */
export function EsgData() {
  const { state, dispatch, inventoryFor, years } = useStore();
  const { org } = state;
  const [year, setYear] = useState(org.reportingYear);
  const esg = state.esg[year] ?? {};
  const patch = (p: Partial<EsgYear>) => dispatch({ type: 'esg', year, patch: p });
  const [aiAvailable, setAiAvailable] = useState(false);
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState<string>();

  useEffect(() => {
    getSample().then((s) => setAiAvailable(!!s));
  }, []);

  const inv = inventoryFor(year);
  const zone = state.entities[0]?.country ?? 'TN';
  const recos = recommend(inv, { gridFactor: GRID_ZONES.find((z) => z.code === zone)?.value ?? 0.58, country: zone });
  const auto = () => buildExecutiveSummary({ org: { ...org, reportingYear: year }, inv, base: inventoryFor(org.baseYear), recos, esg });

  const writeWithClaude = async () => {
    const sample = await getSample();
    if (!sample) return;
    setWriting(true);
    setAiError(undefined);
    try {
      const facts = auto();
      const { text } = await sample(
        `Rédige la synthèse exécutive (150 à 220 mots, en français, ton professionnel de cabinet de conseil, sans titre ni liste) du rapport ESG ${year} de « ${org.name} » (secteur : ${org.sector}). Utilise UNIQUEMENT les faits chiffrés suivants, sans en ajouter ni les modifier, et termine par une phrase sur les priorités d’action :\n\n${facts}`,
        { onText: ({ text }: { text: string }) => patch({ executiveSummary: text }) },
      );
      patch({ executiveSummary: text });
    } catch (e) {
      const code = (e as { code?: string }).code;
      setAiError(code === 'not_granted' ? 'Rédaction par Claude non autorisée.' : 'La rédaction n’a pas abouti ; réessayez plus tard.');
    } finally {
      setWriting(false);
    }
  };

  const num = (key: keyof EsgYear, label: string, unit: string, ref: string) => (
    <Field key={key} label={`${label} (${unit === 'TND' ? org.currency : unit})`} hint={ref}>
      <NumberInput value={esg[key] as number | undefined} onChange={(v) => patch({ [key]: v } as Partial<EsgYear>)} min={0} />
    </Field>
  );

  return (
    <div className="stack">
      <PageHead
        title="Données ESG"
        intro="Indicateurs sociaux et de gouvernance, compléments environnementaux et synthèse du rapport. Les émissions, l’énergie et les coûts proviennent automatiquement de l’inventaire."
        actions={
          <>
            <select id="esg-year" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année">
              {[...new Set([...years, year])].sort().map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <Link className="btn primary" to="/rapport-esg">Voir le rapport ESG →</Link>
          </>
        }
      />

      <Card title="Synthèse exécutive">
        <textarea id="esg-summary" rows={8} value={esg.executiveSummary ?? ''} onChange={(e) => patch({ executiveSummary: e.target.value })} placeholder="Laissez vide pour une synthèse générée automatiquement à partir des résultats." />
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={() => patch({ executiveSummary: auto() })}>Générer à partir des résultats</button>
          {aiAvailable && (
            <button onClick={writeWithClaude} disabled={writing}>
              {writing ? 'Rédaction…' : 'Rédiger avec Claude'}
            </button>
          )}
          <span className="small muted">Le texte reste modifiable ; il ne s’appuie que sur les chiffres calculés.</span>
        </div>
        {aiError && <Callout tone="warn">{aiError}</Callout>}
      </Card>

      <Card title="Social">
        <div className="form-grid">{SOCIAL_FIELDS.map((f) => num(f.key, f.label, f.unit, f.ref))}</div>
      </Card>

      <Card title="Environnement — compléments">
        <div className="form-grid">{ENV_EXTRA_FIELDS.map((f) => num(f.key, f.label, f.unit, f.ref))}</div>
        <p className="small muted" style={{ marginTop: 8 }}>Si laissés vides, l’eau et les déchets sont repris des données d’activité (factures SONEDE, bordereaux).</p>
      </Card>

      <Card title="Gouvernance">
        <div className="form-grid">{GOVERNANCE_FIELDS.map((f) => num(f.key, f.label, f.unit, f.ref))}</div>
        <div className="practices">
          {GOVERNANCE_PRACTICES.map((p) => (
            <label key={p.key} className="check">
              <input type="checkbox" checked={!!esg[p.key]} onChange={(e) => patch({ [p.key]: e.target.checked } as Partial<EsgYear>)} />
              {p.label} <span className="small muted">({p.ref})</span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Engagements et prochaines étapes">
        <textarea id="esg-commitments" rows={5} value={esg.commitments ?? ''} onChange={(e) => patch({ commitments: e.target.value })} placeholder="Ex. : audit énergétique ANME en 2026, installation photovoltaïque de 500 kWc, plan de mobilité…" />
      </Card>
    </div>
  );
}
