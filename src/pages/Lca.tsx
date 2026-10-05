import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon } from '../components/Icon';
import { Callout, Card, ConfirmButton, Field, PageHead, Stat, cssVar } from '../components/ui';
import type { LcaFlow, LcaPhase, LcaStage, LcaStudy } from '../domain/types';
import { fmt, fmtPct, uid } from '../lib/format';
import { LCA_PHASES, LCA_STAGES, QUALITY_LABEL, assessLca, emptyLca, findings, flowImpact, flowsFromInventory, isoChecks, PREFILL_SOURCE, sensitivity, type LcaAssessment } from '../lib/lca';
import { useStore } from '../state/store';

/** Teintes des étapes du cycle de vie (dégradé de bleus et de gris). */
export const STAGE_COLORS: Record<LcaStage, string> = { extraction: '#1e4e8c', fabrication: '#2f6aa8', transport: '#5b8fc7', utilisation: '#8fb3dc', fin_de_vie: '#a3aeba' };

/** Espace cabinet : conduite de l'ACV selon les 4 phases ISO 14040/14044. */
export function Lca() {
  const { state, dispatch, factorById, inventory } = useStore();
  const { org } = state;
  const study = state.lca ?? emptyLca(org);
  const [phase, setPhase] = useState<LcaPhase>('objectifs');
  const save = (patch: Partial<LcaStudy>) => dispatch({ type: 'lca', study: { ...study, ...patch } });
  const a = useMemo(() => assessLca(study, factorById, org.gwpSet), [study, factorById, org.gwpSet]);
  const validated = (p: LcaPhase) => study.validated.includes(p);
  const toggleValidated = (p: LcaPhase) => save({ validated: validated(p) ? study.validated.filter((x) => x !== p) : [...study.validated, p] });

  return (
    <div className="stack">
      <PageHead
        eyebrow="ISO 14040 / 14044"
        icon="recycle"
        title="Analyse de cycle de vie"
        intro="Empreinte d’un produit de l’extraction des matières premières à sa fin de vie, conduite en quatre phases. Les résultats publiés apparaissent dans le portail du client."
        actions={
          study.published ? (
            <button onClick={() => save({ published: false })}><Icon name="lock" size={15} /> Retirer du portail</button>
          ) : (
            <button className="primary" disabled={a.total <= 0} onClick={() => save({ published: true, publishedAt: new Date().toISOString() })}>
              <Icon name="send" size={15} /> Publier sur le portail
            </button>
          )
        }
      />

      {study.published && (
        <Callout tone="key">
          Résultats publiés sur le portail du client{study.publishedAt ? ` le ${new Date(study.publishedAt).toLocaleDateString('fr-FR')}` : ''}. <Link to="/portail/acv">Voir la page client →</Link>
        </Callout>
      )}

      <ol className="lca-phases" aria-label="Phases de l’ACV">
        {LCA_PHASES.map((p) => (
          <li key={p.id}>
            <button className={`${phase === p.id ? 'active' : ''} ${validated(p.id) ? 'done' : ''}`} onClick={() => setPhase(p.id)}>
              <span className="lca-phase-n">{validated(p.id) ? <Icon name="check" size={15} /> : p.n}</span>
              <span>
                <strong>{p.label}</strong>
                <small>{p.text}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <LifecycleStrip study={study} a={a} />

      {phase === 'objectifs' && <GoalPhase study={study} save={save} />}
      {phase === 'inventaire' && <InventoryPhase study={study} save={save} a={a} onPrefill={() => save({ flows: [...flowsFromInventory(inventory.results, study.annualUnits ?? 0), ...study.flows.filter((f) => f.source !== PREFILL_SOURCE)] })} />}
      {phase === 'impacts' && <ImpactPhase study={study} a={a} />}
      {phase === 'interpretation' && <InterpretationPhase study={study} save={save} a={a} />}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => toggleValidated(phase)} className={validated(phase) ? '' : 'primary'}>
          <Icon name={validated(phase) ? 'x' : 'checkCircle'} size={15} /> {validated(phase) ? 'Rouvrir la phase' : 'Valider la phase'}
        </button>
        {phase !== 'interpretation' && (
          <button onClick={() => setPhase(LCA_PHASES[LCA_PHASES.findIndex((p) => p.id === phase) + 1].id)}>
            Phase suivante <Icon name="arrowRight" size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Les 5 étapes du cycle de vie et leur contribution (kg CO2e par unité fonctionnelle). */
export function LifecycleStrip({ study, a }: { study: LcaStudy; a: LcaAssessment }) {
  const max = Math.max(...LCA_STAGES.map((s) => a.byStage[s.id]), 1);
  return (
    <div className="lifecycle" role="list" aria-label="Étapes du cycle de vie">
      {LCA_STAGES.map((s, i) => {
        const included = study.stages.includes(s.id);
        const v = a.byStage[s.id];
        return (
          <div key={s.id} role="listitem" className={`lc-stage ${included ? '' : 'excluded'}`}>
            <div className="lc-head">
              <span className="lc-icon" style={{ background: `color-mix(in srgb, ${STAGE_COLORS[s.id]} 16%, transparent)`, color: STAGE_COLORS[s.id] }}>
                <Icon name={s.icon} size={18} />
              </span>
              <span className="lc-n">{i + 1}</span>
            </div>
            <strong>{s.label}</strong>
            {included ? (
              <>
                <div className="lc-value">{fmt(v, v < 10 ? 1 : 0)} <small>kg CO2e</small></div>
                <div className="bar"><span style={{ width: `${(v / max) * 100}%`, background: STAGE_COLORS[s.id] }} /></div>
                <small className="muted">{a.total > 0 ? fmtPct(v / a.total) : '—'} du total</small>
              </>
            ) : (
              <small className="muted">Hors frontières</small>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────── Phase 1 ───────────────────────────────

function GoalPhase({ study, save }: { study: LcaStudy; save: (p: Partial<LcaStudy>) => void }) {
  const setBoundary = (b: LcaStudy['boundary']) => save({ boundary: b, stages: b === 'berceau_porte' ? ['extraction', 'fabrication'] : LCA_STAGES.map((s) => s.id) });
  return (
    <Card icon="target" title="1. Définition des objectifs et du périmètre">
      <div className="form-grid">
        <Field label="Produit ou service étudié" wide>
          <input value={study.product} onChange={(e) => save({ product: e.target.value })} placeholder="ex. : résine de revêtement" />
        </Field>
        <Field label="Unité fonctionnelle" wide hint="La fonction rendue, quantifiée : toutes les données sont rapportées à cette unité.">
          <input value={study.functionalUnit} onChange={(e) => save({ functionalUnit: e.target.value })} placeholder="ex. : 1 tonne de résine livrée et appliquée" />
        </Field>
        <Field label="Unités fonctionnelles par an" hint="Production annuelle, pour passer de l’unité au total annuel.">
          <input type="number" min={0} value={study.annualUnits ?? ''} onChange={(e) => save({ annualUnits: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
        <Field label="Frontières du système">
          <select value={study.boundary} onChange={(e) => setBoundary(e.target.value as LcaStudy['boundary'])}>
            <option value="berceau_tombe">Du berceau à la tombe (5 étapes)</option>
            <option value="berceau_porte">Du berceau à la porte de l’usine</option>
          </select>
        </Field>
        <Field label="Règle de coupure (%)" hint="Flux négligeables en dessous de ce seuil de contribution.">
          <input type="number" min={0} max={5} step={0.5} value={study.cutoffPct} onChange={(e) => save({ cutoffPct: Number(e.target.value) })} />
        </Field>
        <Field label="Objectif de l’étude" wide>
          <textarea rows={2} value={study.goal} onChange={(e) => save({ goal: e.target.value })} />
        </Field>
        <Field label="Public visé" wide>
          <input value={study.audience} onChange={(e) => save({ audience: e.target.value })} />
        </Field>
        <Field label="Règles d’allocation" wide>
          <input value={study.allocation} onChange={(e) => save({ allocation: e.target.value })} />
        </Field>
        <Field label="Méthode d’évaluation des impacts" wide>
          <input value={study.method} onChange={(e) => save({ method: e.target.value })} />
        </Field>
      </div>
      <h3 style={{ marginTop: 18 }}>Étapes incluses</h3>
      <div className="lca-stage-checks">
        {LCA_STAGES.map((s) => (
          <label key={s.id} className="check-card">
            <input
              type="checkbox"
              checked={study.stages.includes(s.id)}
              onChange={(e) => save({ stages: e.target.checked ? LCA_STAGES.map((x) => x.id).filter((x) => x === s.id || study.stages.includes(x)) : study.stages.filter((x) => x !== s.id) })}
            />
            <Icon name={s.icon} size={16} />
            <span>
              <strong>{s.label}</strong>
              <small className="muted">{s.text}</small>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────── Phase 2 ───────────────────────────────

function InventoryPhase({ study, save, a, onPrefill }: { study: LcaStudy; save: (p: Partial<LcaStudy>) => void; a: LcaAssessment; onPrefill: () => void }) {
  const { factors, factorById, state } = useStore();
  const setFlow = (id: string, patch: Partial<LcaFlow>) => save({ flows: study.flows.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const addFlow = (stage: LcaStage) => save({ flows: [...study.flows, { id: uid(), stage, description: '', quantity: 0, quality: 'calculee' }] });
  const removeFlow = (id: string) => save({ flows: study.flows.filter((f) => f.id !== id) });
  const sorted = useMemo(() => [...factors].sort((x, y) => x.label.localeCompare(y.label, 'fr')), [factors]);

  return (
    <Card
      icon="table"
      title="2. Inventaire des flux (par unité fonctionnelle)"
      actions={
        study.flows.length ? (
          <ConfirmButton question="Remplacer les flux issus du bilan ? Les flux ajoutés à la main sont conservés." onConfirm={onPrefill}>
            <Icon name="swap" size={15} /> Pré-remplir depuis le bilan {state.org.reportingYear}
          </ConfirmButton>
        ) : (
          <button className="primary" onClick={onPrefill} disabled={!(study.annualUnits && study.annualUnits > 0)}>
            <Icon name="swap" size={15} /> Pré-remplir depuis le bilan {state.org.reportingYear}
          </button>
        )
      }
    >
      <p className="small muted">
        Quantités de matières, d’énergie et de transport nécessaires pour {study.functionalUnit || 'une unité fonctionnelle'}. Le pré-remplissage divise les données d’activité du bilan par la production
        annuelle ({fmt(study.annualUnits ?? 0)}) ; les frais généraux (déplacements, trajets domicile-travail, ratios monétaires) sont exclus. Complétez les étapes aval (utilisation, fin de vie).
      </p>
      {LCA_STAGES.filter((s) => study.stages.includes(s.id)).map((s) => {
        const rows = study.flows.filter((f) => f.stage === s.id);
        return (
          <section key={s.id} className="lca-inv-stage">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 className="row" style={{ margin: 0 }}>
                <span className="lc-icon small" style={{ background: `color-mix(in srgb, ${STAGE_COLORS[s.id]} 16%, transparent)`, color: STAGE_COLORS[s.id] }}><Icon name={s.icon} size={15} /></span>
                {s.label}
              </h3>
              <span className="small"><strong>{fmt(a.byStage[s.id], 1)}</strong> kg CO2e</span>
            </div>
            <div className="table-wrap">
              <table className="lca-table">
                <thead>
                  <tr><th>Flux</th><th>Facteur d’émission</th><th className="num">Quantité / UF</th><th>Qualité</th><th className="num">kg CO2e</th><th /></tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="muted small">Aucun flux pour cette étape.</td></tr>
                  )}
                  {rows.map((f) => {
                    const imp = flowImpact(f, factorById, state.org.gwpSet);
                    return (
                      <tr key={f.id} className={f.avoided ? 'avoided' : ''}>
                        <td>
                          <input value={f.description} onChange={(e) => setFlow(f.id, { description: e.target.value })} placeholder="Description" aria-label="Description du flux" />
                          <label className="small row" style={{ gap: 6, marginTop: 4 }}>
                            <input type="checkbox" checked={!!f.avoided} onChange={(e) => setFlow(f.id, { avoided: e.target.checked })} /> bénéfice évité (module D)
                          </label>
                        </td>
                        <td>
                          <select
                            value={f.customFactor ? '__custom' : f.factorId ?? ''}
                            onChange={(e) =>
                              e.target.value === '__custom'
                                ? setFlow(f.id, { factorId: undefined, customFactor: { kgCO2ePerUnit: 0, unit: 'kg', source: 'Base ACV / EPD' } })
                                : setFlow(f.id, { factorId: e.target.value, customFactor: undefined })
                            }
                            aria-label="Facteur d’émission"
                          >
                            <option value="">— choisir —</option>
                            <option value="__custom">Facteur spécifique (EPD, base ACV)…</option>
                            {sorted.map((x) => (
                              <option key={x.id} value={x.id}>{x.label} ({x.unit})</option>
                            ))}
                          </select>
                          {f.customFactor && (
                            <div className="row small" style={{ marginTop: 4 }}>
                              <input type="number" step="any" style={{ width: 90 }} value={f.customFactor.kgCO2ePerUnit} onChange={(e) => setFlow(f.id, { customFactor: { ...f.customFactor!, kgCO2ePerUnit: Number(e.target.value) } })} aria-label="kg CO2e par unité" />
                              kg CO2e /
                              <input style={{ width: 60 }} value={f.customFactor.unit} onChange={(e) => setFlow(f.id, { customFactor: { ...f.customFactor!, unit: e.target.value } })} aria-label="Unité" />
                            </div>
                          )}
                        </td>
                        <td className="num">
                          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <input type="number" step="any" min={0} style={{ width: 100 }} value={f.quantity} onChange={(e) => setFlow(f.id, { quantity: Number(e.target.value) })} aria-label="Quantité par unité fonctionnelle" />
                            <span className="small muted">{imp.unit}</span>
                          </div>
                        </td>
                        <td>
                          <select value={f.quality} onChange={(e) => setFlow(f.id, { quality: e.target.value as LcaFlow['quality'] })} aria-label="Qualité de la donnée">
                            {(Object.keys(QUALITY_LABEL) as LcaFlow['quality'][]).map((q) => (
                              <option key={q} value={q}>{QUALITY_LABEL[q]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="num">{f.avoided ? <span className="pos">−{fmt(imp.kgCO2e, 1)}</span> : fmt(imp.kgCO2e, 1)}</td>
                        <td>
                          <button className="ghost" onClick={() => removeFlow(f.id)} aria-label="Supprimer le flux"><Icon name="x" size={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="ghost small" onClick={() => addFlow(s.id)}><Icon name="plus" size={14} /> Ajouter un flux</button>
          </section>
        );
      })}
    </Card>
  );
}

// ─────────────────────────────── Phase 3 ───────────────────────────────

function ImpactPhase({ study, a }: { study: LcaStudy; a: LcaAssessment }) {
  const data = LCA_STAGES.filter((s) => study.stages.includes(s.id)).map((s) => ({ id: s.id, name: s.short, kg: Math.round(a.byStage[s.id] * 10) / 10, kwh: Math.round(a.energyByStage[s.id]) }));
  const annual = study.annualUnits ? (a.total * study.annualUnits) / 1000 : undefined;
  const axis = cssVar('--muted', '#888');
  return (
    <>
      <div className="grid g4">
        <Stat accent="main" icon="cloud" label="Changement climatique" value={`${fmt(a.total, 0)} kg CO2e`} sub={`par ${study.functionalUnit || 'unité fonctionnelle'}`} />
        <Stat icon="zap" label="Énergie consommée" value={`${fmt(a.energyKwh, 0)} kWh`} sub="par unité fonctionnelle" />
        <Stat icon="droplet" label="Eau" value={`${fmt(a.waterM3, 2)} m³`} sub="par unité fonctionnelle" />
        <Stat icon="trash" label="Déchets" value={`${fmt(a.wasteKg, 0)} kg`} sub="production et fin de vie" />
      </div>
      <div className="grid g2">
        <Card icon="chart" title="3. Contribution des étapes (kg CO2e / UF)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid horizontal={false} stroke={cssVar('--border', '#ddd')} />
              <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: axis, fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `${fmt(v, 1)} kg CO2e`} />
              <Bar dataKey="kg" name="kg CO2e" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.id} fill={STAGE_COLORS[d.id]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {a.avoided > 0 && <p className="small muted">Bénéfices évités (module D), déclarés à part : <strong className="pos">−{fmt(a.avoided, 0)} kg CO2e</strong> par unité fonctionnelle.</p>}
          {annual !== undefined && <p className="small muted">Rapporté à la production annuelle ({fmt(study.annualUnits!)} unités) : <strong>{fmt(annual, 0)} t CO2e/an</strong>.</p>}
        </Card>
        <Card icon="target" title="Points chauds">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Flux</th><th>Étape</th><th className="num">kg CO2e</th><th className="num">Part</th></tr></thead>
              <tbody>
                {a.hotspots.slice(0, 8).map((h) => (
                  <tr key={h.flow.id}>
                    <td>{h.flow.description || h.label}<div className="small muted">{fmt(h.flow.quantity, 3)} {h.unit} × {fmt(h.kgPerUnit, 3)} kg CO2e/{h.unit}</div></td>
                    <td className="small">{LCA_STAGES.find((s) => s.id === h.flow.stage)!.short}</td>
                    <td className="num">{fmt(h.kgCO2e, 1)}</td>
                    <td className="num">{a.total ? fmtPct(h.kgCO2e / a.total) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card icon="table" title="Indicateurs par étape">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Étape</th><th className="num">kg CO2e</th><th className="num">Part</th><th className="num">Énergie (kWh)</th><th className="num">Flux</th></tr></thead>
            <tbody>
              {LCA_STAGES.filter((s) => study.stages.includes(s.id)).map((s) => (
                <tr key={s.id}>
                  <td><span className="dot" style={{ background: STAGE_COLORS[s.id] }} /> {s.label}</td>
                  <td className="num">{fmt(a.byStage[s.id], 1)}</td>
                  <td className="num">{a.total ? fmtPct(a.byStage[s.id] / a.total) : '—'}</td>
                  <td className="num">{fmt(a.energyByStage[s.id], 0)}</td>
                  <td className="num">{study.flows.filter((f) => f.stage === s.id && !f.avoided).length}</td>
                </tr>
              ))}
              <tr className="total"><td>Total</td><td className="num">{fmt(a.total, 1)}</td><td className="num">100 %</td><td className="num">{fmt(a.energyKwh, 0)}</td><td className="num">{study.flows.filter((f) => !f.avoided).length}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">Méthode : {study.method}</p>
      </Card>
    </>
  );
}

// ─────────────────────────────── Phase 4 ───────────────────────────────

function InterpretationPhase({ study, save, a }: { study: LcaStudy; save: (p: Partial<LcaStudy>) => void; a: LcaAssessment }) {
  const [draft, setDraft] = useState('');
  const checks = isoChecks(study, a);
  const auto = findings(study, a);
  return (
    <>
      <div className="grid g2">
        <Card icon="bulb" title="4. Constats (calculés)">
          {auto.length ? (
            <ul className="checklist">
              {auto.map((f) => (
                <li key={f}><Icon name="info" size={15} /> {f}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Renseignez l’inventaire pour obtenir les constats.</p>
          )}
          <h3 style={{ marginTop: 14 }}>Analyse de sensibilité (±20 %)</h3>
          <table>
            <tbody>
              {sensitivity(a).map((s) => (
                <tr key={s.impact.flow.id}><td>{s.impact.flow.description || s.impact.label}</td><td className="num">±{fmtPct(s.deltaPct, 1)} sur le total</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card icon="shield" title="Contrôles ISO 14044">
          <ul className="compliance">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? 'ok' : 'todo'}>
                {c.ok ? <Icon name="checkCircle" size={18} className="ok-ico" /> : <Icon name="alert" size={18} className="warn-ico" />}
                <div><strong>{c.label}</strong></div>
                <span className={`badge ${c.ok ? 'ok' : 'warn'}`}>{c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card icon="edit" title="Conclusions et recommandations (publiées au client)">
        <Field label="Conclusions" wide>
          <textarea rows={4} value={study.conclusions ?? ''} onChange={(e) => save({ conclusions: e.target.value })} placeholder="Principaux enseignements, limites de l’étude…" />
        </Field>
        <h3 style={{ marginTop: 14 }}>Recommandations</h3>
        <ol className="lca-reco-list">
          {study.recommendations.map((r, i) => (
            <li key={i}>
              <span>{r}</span>
              <button className="ghost" onClick={() => save({ recommendations: study.recommendations.filter((_, j) => j !== i) })} aria-label="Supprimer"><Icon name="x" size={14} /></button>
            </li>
          ))}
        </ol>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            save({ recommendations: [...study.recommendations, draft.trim()] });
            setDraft('');
          }}
        >
          <input style={{ flex: 1, minWidth: 220 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nouvelle recommandation" />
          <button type="submit"><Icon name="plus" size={15} /> Ajouter</button>
        </form>
      </Card>
    </>
  );
}
