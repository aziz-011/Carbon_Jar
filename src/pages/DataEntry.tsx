import { useMemo, useState } from 'react';
import { FactorSelect } from '../components/FactorSelect';
import { Callout, Card, Field, NumberInput, PageHead, ScopeBadge, Tabs } from '../components/ui';
import { getCategory } from '../data/categories';
import type { Activity, DataQuality, MarketInstrument, Scope } from '../domain/types';
import { computeActivity } from '../lib/calc';
import { classify } from '../lib/classifier';
import { CSV_TEMPLATE, downloadFile, mapRows, parseCsv, type ImportedRow } from '../lib/csv';
import { fmt, fmtMoney, uid } from '../lib/format';
import { useStore } from '../state/store';

const QUALITY_LABELS: Record<DataQuality, string> = {
  1: '1 — Mesure directe (compteur dédié, capteur)',
  2: '2 — Donnée facturée (facture, bon de livraison)',
  3: '3 — Calcul à partir des équipements',
  4: '4 — Estimation / ratio sectoriel',
};

const INSTRUMENTS: Array<[MarketInstrument, string]> = [
  ['none', 'Aucun instrument (mix résiduel / moyenne réseau)'],
  ['ppa', 'Contrat direct / PPA (facteur du producteur)'],
  ['eac', 'Garantie d’origine / REC / I-REC (renouvelable)'],
  ['supplier', 'Facteur spécifique du fournisseur'],
  ['residual', 'Facteur du mix résiduel'],
];

export function DataEntry() {
  const [tab, setTab] = useState<'manual' | 'import'>('manual');
  return (
    <div className="stack">
      <PageHead
        title="Données d’activité"
        intro="Saisissez vos consommations (litres, kWh, kg, km, montants…). Chaque donnée est automatiquement classée dans le bon scope et convertie en émissions, énergie et coût : Émissions = Donnée d’activité × Facteur d’émission."
      />
      <Tabs value={tab} onChange={setTab} tabs={[['manual', 'Saisie manuelle'], ['import', 'Import CSV / Excel avec classification automatique']]} />
      {tab === 'manual' ? <ManualEntry /> : <ImportData onDone={() => setTab('manual')} />}
    </div>
  );
}

function emptyActivity(entityId: string, year: number): Activity {
  return { id: uid(), entityId, year, factorId: '', quantity: 0, quality: 2 };
}

function ManualEntry() {
  const { state, dispatch, factors, factorById } = useStore();
  const { org, entities } = state;
  const [draft, setDraft] = useState<Activity>(() => emptyActivity(entities[0]?.id ?? '', org.reportingYear));
  const [editing, setEditing] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<Scope | 0>(0);
  const [yearFilter, setYearFilter] = useState<number>(org.reportingYear);
  const [hint, setHint] = useState<string>();

  const factor = factorById.get(draft.factorId);
  const entity = entities.find((e) => e.id === draft.entityId);
  const preview = factor && draft.quantity > 0 ? computeActivity(draft, factor, entity, org) : undefined;
  const isScope2 = factor && getCategory(factor.category).scope === 2;

  const set = (patch: Partial<Activity>) => setDraft((d) => ({ ...d, ...patch }));

  const suggest = () => {
    const r = classify(draft.description ?? '', factors);
    if (r.best) {
      set({ factorId: r.best.factor.id });
      setHint(r.explanation);
    } else setHint(r.explanation);
  };

  const save = () => {
    if (!factor || !(draft.quantity > 0) || !draft.entityId) return;
    dispatch({ type: 'activity:upsert', activity: draft });
    setDraft({ ...emptyActivity(draft.entityId, draft.year) });
    setEditing(false);
    setHint(undefined);
  };

  const rows = useMemo(() => {
    const eMap = new Map(entities.map((e) => [e.id, e]));
    return state.activities
      .filter((a) => a.year === yearFilter)
      .map((a) => {
        const f = factorById.get(a.factorId);
        return f ? computeActivity(a, f, eMap.get(a.entityId), org) : undefined;
      })
      .filter((r): r is NonNullable<typeof r> => !!r && (scopeFilter === 0 || r.scope === scopeFilter))
      .sort((a, b) => a.scope - b.scope || b.kgCO2e - a.kgCO2e);
  }, [state.activities, yearFilter, scopeFilter, factorById, entities, org]);

  const years = [...new Set([...state.activities.map((a) => a.year), org.reportingYear])].sort();

  return (
    <>
      <Card title={editing ? 'Modifier une donnée' : 'Nouvelle donnée d’activité'}>
        <div className="form-grid">
          <Field label="Libellé (ex. « Facture gaz janvier »)" wide>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Décrivez la donnée puis cliquez sur « Classer automatiquement »" />
              <button type="button" onClick={suggest} className="nowrap">🧭 Classer automatiquement</button>
            </div>
          </Field>
          {hint && (
            <div className="wide">
              <Callout tone="info">{hint}</Callout>
            </div>
          )}
          <Field label="Source d’émission / facteur" wide>
            <FactorSelect factors={factors} value={draft.factorId} onChange={(id) => set({ factorId: id })} />
          </Field>
          <Field label={`Quantité${factor ? ` (${factor.unit})` : ''}`}>
            <NumberInput value={draft.quantity || undefined} onChange={(v) => set({ quantity: v ?? 0 })} min={0} />
          </Field>
          <Field label={`Coût réel (${org.currency})`} hint={factor?.defaultPrice !== undefined ? `Si vide : estimé à ${fmt(factor.defaultPrice, 3)} ${org.currency}/${factor.unit}` : undefined}>
            <NumberInput value={draft.cost} onChange={(v) => set({ cost: v })} min={0} />
          </Field>
          <Field label="Site / entité">
            <select value={draft.entityId} onChange={(e) => set({ entityId: e.target.value })}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Année">
            <NumberInput value={draft.year} onChange={(v) => set({ year: v ?? org.reportingYear })} />
          </Field>
          <Field label="Qualité de la donnée">
            <select value={draft.quality} onChange={(e) => set({ quality: Number(e.target.value) as DataQuality })}>
              {Object.entries(QUALITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Justificatif (piste d’audit)">
            <input value={draft.evidence ?? ''} onChange={(e) => set({ evidence: e.target.value })} placeholder="Facture n°…, relevé compteur…" />
          </Field>
          {isScope2 && (
            <>
              <Field label="Instrument contractuel (market-based)">
                <select value={draft.instrument ?? 'none'} onChange={(e) => set({ instrument: e.target.value as MarketInstrument })}>
                  {INSTRUMENTS.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              {draft.instrument && draft.instrument !== 'none' && (
                <Field label="Facteur contractuel (kg CO2e/kWh)" hint={draft.instrument === 'eac' ? 'Laisser vide = 0 (renouvelable)' : 'Obligatoire, sinon moyenne réseau'}>
                  <NumberInput value={draft.instrumentFactor} onChange={(v) => set({ instrumentFactor: v })} min={0} />
                </Field>
              )}
              <label className="check">
                <input type="checkbox" checked={!!draft.resold} onChange={(e) => set({ resold: e.target.checked })} />
                Énergie revendue à des utilisateurs finaux (→ Scope 3)
              </label>
            </>
          )}
        </div>

        {preview && (
          <div className="row" style={{ marginTop: 14, gap: 16 }}>
            <ScopeBadge scope={preview.scope} />
            <span className="muted">{getCategory(preview.category).label}</span>
            <strong>{fmt(preview.kgCO2e / 1000, 3)} t CO2e</strong>
            {preview.scope === 2 && preview.kgCO2eMarket !== preview.kgCO2e && <span>market-based : {fmt(preview.kgCO2eMarket / 1000, 3)} t</span>}
            {preview.energyKwh > 0 && <span>{fmt(preview.energyKwh / 1000)} MWh</span>}
            {preview.cost > 0 && <span>{fmtMoney(preview.cost, org.currency)}{preview.costEstimated ? ' (estimé)' : ''}</span>}
            {preview.biogenicKg > 0 && <span className="badge memo">CO2 biogénique : {fmt(preview.biogenicKg / 1000, 2)} t (mémo)</span>}
            {preview.nonKyotoKgCO2e > 0 && <span className="badge memo">Hors Kyoto : {fmt(preview.nonKyotoKgCO2e / 1000, 2)} t CO2e</span>}
            {preview.consolidationShare < 1 && <span className="badge warn">Consolidé à {fmt(preview.consolidationShare * 100)} %</span>}
          </div>
        )}
        {preview?.note && <p className="small muted" style={{ marginTop: 8 }}>{preview.note}</p>}

        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" onClick={save} disabled={!factor || !(draft.quantity > 0)}>
            {editing ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(false);
                setDraft(emptyActivity(draft.entityId, draft.year));
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </Card>

      <Card
        title={`Données saisies (${rows.length})`}
        actions={
          <>
            <select value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))} aria-label="Année">
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select value={scopeFilter} onChange={(e) => setScopeFilter(Number(e.target.value) as Scope | 0)} aria-label="Scope">
              <option value={0}>Tous les scopes</option>
              <option value={1}>Scope 1</option>
              <option value={2}>Scope 2</option>
              <option value={3}>Scope 3</option>
            </select>
          </>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Donnée</th>
                <th>Scope / catégorie</th>
                <th className="num">Quantité</th>
                <th className="num">t CO2e</th>
                <th className="num">MWh</th>
                <th className="num">Coût</th>
                <th>Qualité</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.activity.id}>
                  <td>
                    {r.activity.description || r.factor.label}
                    <div className="small muted">
                      {r.factor.label} · {r.entity?.name}
                      {r.activity.evidence ? ` · 📎 ${r.activity.evidence}` : ''}
                    </div>
                  </td>
                  <td>
                    <ScopeBadge scope={r.scope} />
                    {r.consolidationShare === 0 && <span className="badge neutral" title="Exclue par l’approche de consolidation retenue">hors périmètre</span>}
                    {r.consolidationShare > 0 && r.consolidationShare < 1 && <span className="badge warn">{fmt(r.consolidationShare * 100)} %</span>}
                    <div className="small muted">{getCategory(r.category).label}</div>
                  </td>
                  <td className="num">
                    {fmt(r.activity.quantity)} {r.factor.unit}
                  </td>
                  <td className="num">
                    {fmt(r.kgCO2e / 1000, 2)}
                    {r.scope === 2 && r.kgCO2eMarket !== r.kgCO2e && <div className="small muted">MB {fmt(r.kgCO2eMarket / 1000, 2)}</div>}
                  </td>
                  <td className="num">{r.energyKwh ? fmt(r.energyKwh / 1000) : '—'}</td>
                  <td className="num">
                    {r.cost ? fmt(r.cost, 0) : '—'}
                    {r.costEstimated && <div className="small muted">estimé</div>}
                  </td>
                  <td>
                    <span className={`badge ${r.activity.quality <= 2 ? 'ok' : r.activity.quality === 3 ? 'neutral' : 'warn'}`}>N{r.activity.quality}</span>
                  </td>
                  <td className="nowrap">
                    <button
                      className="ghost"
                      title="Modifier"
                      onClick={() => {
                        setDraft(r.activity);
                        setEditing(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      ✏️
                    </button>
                    <button className="ghost danger" title="Supprimer" onClick={() => dispatch({ type: 'activity:delete', id: r.activity.id })}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="empty">Aucune donnée pour ce filtre.</p>}
        </div>
      </Card>
    </>
  );
}

interface Proposal extends ImportedRow {
  factorId: string;
  confidence: number;
  explanation: string;
  include: boolean;
}

function ImportData({ onDone }: { onDone: () => void }) {
  const { state, dispatch, factors, factorById } = useStore();
  const { org, entities } = state;
  const [text, setText] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [entityId, setEntityId] = useState(entities[0]?.id ?? '');

  const analyse = (raw: string) => {
    const rows = mapRows(parseCsv(raw));
    setProposals(
      rows.map((r) => {
        const c = classify(r.description, factors, r.unit);
        return { ...r, factorId: c.best?.factor.id ?? '', confidence: c.confidence, explanation: c.explanation, include: !!c.best && r.quantity !== undefined };
      }),
    );
  };

  const onFile = async (file: File) => {
    const content = await file.text();
    setText(content);
    analyse(content);
  };

  const commit = () => {
    const findEntity = (site?: string) => (site ? entities.find((e) => e.name.toLowerCase().includes(site.toLowerCase()))?.id : undefined) ?? entityId;
    const acts: Activity[] = proposals
      .filter((p) => p.include && p.factorId && p.quantity !== undefined)
      .map((p) => ({
        id: uid(),
        entityId: findEntity(p.site),
        year: p.year ?? org.reportingYear,
        factorId: p.factorId,
        quantity: p.quantity!,
        cost: p.cost,
        description: p.description,
        evidence: p.evidence,
        quality: 2,
      }));
    dispatch({ type: 'activity:addMany', activities: acts });
    setProposals([]);
    setText('');
    onDone();
  };

  const update = (i: number, patch: Partial<Proposal>) => setProposals((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <>
      <Card title="1. Fournir les données">
        <p className="muted">
          Importez un fichier CSV (export Excel « CSV séparateur point-virgule ») ou collez directement vos lignes. Colonnes reconnues : <code>libellé</code>, <code>quantité</code>, <code>unité</code>, <code>coût</code>, <code>année</code>, <code>site</code>, <code>justificatif</code>. Chaque ligne est classée automatiquement dans le scope adéquat à partir de son libellé et de son unité.
        </p>
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="file" accept=".csv,.txt,.tsv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} style={{ maxWidth: 320 }} />
          <button onClick={() => downloadFile('modele-donnees-carbone.csv', CSV_TEMPLATE)}>⬇ Télécharger le modèle</button>
          <button
            onClick={() => {
              setText(CSV_TEMPLATE);
              analyse(CSV_TEMPLATE);
            }}
          >
            Essayer avec l’exemple
          </button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={CSV_TEMPLATE} className="mono" />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => analyse(text)} disabled={!text.trim()}>
            🧭 Analyser et classer
          </button>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <span>Site par défaut</span>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ width: 'auto' }}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {proposals.length > 0 && (
        <Card title={`2. Vérifier la classification (${proposals.filter((p) => p.include).length}/${proposals.length} lignes retenues)`} actions={<button className="primary" onClick={commit}>Importer</button>}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Ligne</th>
                  <th>Classement proposé</th>
                  <th className="num">Quantité</th>
                  <th className="num">t CO2e</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p, i) => {
                  const f = factorById.get(p.factorId);
                  const res = f && p.quantity ? computeActivity({ id: 'x', entityId, year: org.reportingYear, factorId: f.id, quantity: p.quantity, quality: 2 }, f, entities.find((e) => e.id === entityId), org) : undefined;
                  return (
                    <tr key={i}>
                      <td>
                        <input type="checkbox" checked={p.include} onChange={(e) => update(i, { include: e.target.checked })} />
                      </td>
                      <td style={{ minWidth: 180 }}>
                        <strong>{p.description}</strong>
                        <div className="small muted">
                          l.{p.line} · {p.unit ?? 'unité ?'}
                          {p.cost !== undefined ? ` · ${fmtMoney(p.cost, org.currency)}` : ''}
                        </div>
                      </td>
                      <td style={{ minWidth: 280 }}>
                        <FactorSelect factors={factors} value={p.factorId} onChange={(id) => update(i, { factorId: id, include: !!id && p.quantity !== undefined, confidence: 1 })} />
                        <div className="row small" style={{ marginTop: 4 }}>
                          {res && <ScopeBadge scope={res.scope} />}
                          <span className={`badge ${p.confidence >= 0.6 ? 'ok' : p.confidence > 0 ? 'warn' : 'danger'}`}>
                            confiance {Math.round(p.confidence * 100)} %
                          </span>
                          {f && p.unit && f.unit.toLowerCase().replace(' pcs', '') !== p.unit.toLowerCase() && <span className="badge warn">unité attendue : {f.unit}</span>}
                        </div>
                        <div className="small muted">{p.explanation}</div>
                      </td>
                      <td className="num">{p.quantity !== undefined ? fmt(p.quantity) : <span className="badge danger">manquante</span>}</td>
                      <td className="num">{res ? fmt(res.kgCO2e / 1000, 2) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
