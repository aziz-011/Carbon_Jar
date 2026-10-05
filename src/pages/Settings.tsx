import { Callout, Card, Field, NumberInput, PageHead } from '../components/ui';
import { GWP_SET_LABELS } from '../data/gwp';
import type { GwpSet, Sector } from '../domain/types';
import { DEMO_STATE, EMPTY_STATE, useStore, type AppState } from '../state/store';

const SECTORS: Array<[Sector, string]> = [
  ['industrie', 'Industrie manufacturière'],
  ['chimie', 'Industrie chimique'],
  ['agroalimentaire', 'Agroalimentaire'],
  ['sante', 'Santé / hôpitaux'],
  ['universite', 'Université / enseignement'],
  ['services', 'Services / bureaux'],
  ['commerce', 'Commerce / distribution'],
  ['transport', 'Transport / logistique'],
  ['autre', 'Autre'],
];

export function Settings() {
  const { state, dispatch, years } = useStore();
  const { org } = state;
  const patch = (p: Partial<typeof org>) => dispatch({ type: 'org', patch: p });

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppState;
      if (!data.org || !Array.isArray(data.activities)) throw new Error('format');
      dispatch({ type: 'reset', state: { ...EMPTY_STATE, ...data } });
      alert('Données restaurées.');
    } catch {
      alert('Fichier invalide : utilisez une sauvegarde JSON exportée depuis la page Rapport.');
    }
  };

  const metricYears = [...new Set([...years, org.reportingYear, org.baseYear])].sort();

  return (
    <div className="stack">
      <PageHead title="Paramètres" intro="Organisation, période de reporting, année de base, PRG, devise et prix carbone. Les données sont enregistrées localement dans votre navigateur." />

      <Card title="Organisation">
        <div className="form-grid">
          <Field label="Nom">
            <input value={org.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label="Secteur">
            <select value={org.sector} onChange={(e) => patch({ sector: e.target.value as Sector })}>
              {SECTORS.map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Année de reporting">
            <NumberInput value={org.reportingYear} onChange={(v) => v && patch({ reportingYear: v })} />
          </Field>
          <Field label="Année de base" hint="Première année avec des données fiables">
            <NumberInput value={org.baseYear} onChange={(v) => v && patch({ baseYear: v })} />
          </Field>
          <Field label="PRG (source à déclarer)">
            <select value={org.gwpSet} onChange={(e) => patch({ gwpSet: e.target.value as GwpSet })}>
              {Object.entries(GWP_SET_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Devise" hint="Ex. €, MAD, TND, DZD, $, FCFA">
            <input value={org.currency} onChange={(e) => patch({ currency: e.target.value })} />
          </Field>
          <Field label={`Prix carbone interne (${org.currency}/t CO2e)`} hint="Sert à estimer l’exposition financière (ex. prix EU ETS)">
            <NumberInput value={org.carbonPrice} onChange={(v) => patch({ carbonPrice: v ?? 0 })} min={0} />
          </Field>
          <Field label="Crédits carbone achetés (t CO2e)" hint="Déclarés séparément, jamais soustraits">
            <NumberInput value={org.offsetsTco2e} onChange={(v) => patch({ offsetsTco2e: v ?? 0 })} min={0} />
          </Field>
          <Field label="Sources exclues et justification (principe d’exhaustivité)" wide>
            <textarea value={org.exclusions} onChange={(e) => patch({ exclusions: e.target.value })} />
          </Field>
        </div>
        <Callout tone="info">
          Les prix unitaires par défaut des facteurs sont exprimés dans la devise de l’organisation : ajustez-les dans « Facteurs d’émission » si vous n’utilisez pas l’euro, ou saisissez les coûts réels de vos factures.
        </Callout>
      </Card>

      <Card title="Métrique d’intensité">
        <div className="form-grid">
          <Field label="Unité d’activité" hint="Ex. tonne produite, M€ de CA, salarié, m², patient, étudiant">
            <input value={org.intensityMetricLabel} onChange={(e) => patch({ intensityMetricLabel: e.target.value })} />
          </Field>
          {metricYears.map((y) => (
            <Field key={y} label={`Valeur ${y}`}>
              <NumberInput value={org.intensityMetric[y]} onChange={(v) => patch({ intensityMetric: { ...org.intensityMetric, [y]: v ?? 0 } })} min={0} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Données">
        <div className="row">
          <label className="btn">
            ⬆ Restaurer une sauvegarde JSON
            <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
          <button onClick={() => confirm('Charger le jeu de démonstration (entreprise chimique) ? Les données actuelles seront remplacées.') && dispatch({ type: 'reset', state: DEMO_STATE })}>
            Charger la démonstration
          </button>
          <button className="danger" onClick={() => confirm('Effacer toutes les données et repartir de zéro ?') && dispatch({ type: 'reset', state: EMPTY_STATE })}>
            Repartir de zéro
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {state.activities.length} données d’activité · {state.entities.length} entités · {state.targets.length} objectifs · {state.customFactors.length} facteurs personnalisés.
        </p>
      </Card>
    </div>
  );
}
