import { useEffect, useMemo, useRef, useState } from 'react';
import { FactorSelect } from '../components/FactorSelect';
import { Callout, Card, ConfirmButton, Field, NumberInput, PageHead, ScopeBadge, Stat, Tabs } from '../components/ui';
import { getCategory } from '../data/categories';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';
import type { DocType, DocumentRecord, DocumentStatus, Extraction, ExtractedLine, VehicleEnergy } from '../domain/types';
import { computeActivity } from '../lib/calc';
import { aiExtract, aiImageSupport, getSample } from '../lib/documents/ai';
import { checkLines, extractionToActivities, mergeVehicle } from '../lib/documents/commit';
import { DOC_TYPE_LABELS, detectDocType, parseDocument } from '../lib/documents/parse';
import { isImage, isPdf, readDocumentText, renderPdfFirstPage } from '../lib/documents/read';
import { deleteFile, loadFile, saveFile } from '../lib/fileStore';
import { fmt, fmtMoney, uid } from '../lib/format';
import { fmtMass, formulaText } from '../lib/tracking';
import { useStore } from '../state/store';

const STATUS_LABEL: Record<DocumentStatus, string> = { a_valider: 'À valider', valide: 'Validé', rejete: 'Rejeté', erreur: 'Erreur' };
const STATUS_BADGE: Record<DocumentStatus, string> = { a_valider: 'warn', valide: 'ok', rejete: 'neutral', erreur: 'danger' };
const AUTO_THRESHOLD = 0.8;

type Filter = DocumentStatus | 'tous';

export function Documents() {
  const { state, dispatch, factors, factorById } = useStore();
  const { org, entities, documents } = state;
  const [entityId, setEntityId] = useState(entities[0]?.id ?? '');
  const [year, setYear] = useState(org.reportingYear);
  const [autoValidate, setAutoValidate] = useState(true);
  const [useAi, setUseAi] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiImages, setAiImages] = useState(false);
  const [queue, setQueue] = useState<Array<{ name: string; step: string }>>([]);
  const [filter, setFilter] = useState<Filter>('a_valider');
  const [openId, setOpenId] = useState<string>();
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getSample().then((s) => alive && setAiAvailable(!!s));
    aiImageSupport().then((i) => alive && setAiImages(!!i));
    return () => {
      alive = false;
    };
  }, []);

  const entity = entities.find((e) => e.id === entityId) ?? entities[0];
  const country = entity?.country ?? 'TN';

  /** Valide un document si l'extraction est complète et suffisamment sûre. */
  const tryAutoValidate = (doc: DocumentRecord, e: Extraction): boolean => {
    if (!autoValidate || e.confidence < AUTO_THRESHOLD) return false;
    const checks = checkLines(e, factorById);
    const vehicleOnly = (e.docType === 'carte_grise' || e.docType === 'fiche_vehicule') && !!e.vehicle?.plate;
    if (!vehicleOnly && (checks.length === 0 || checks.some((c) => !c.ok))) return false;
    validate(doc, e);
    return true;
  };

  const validate = (doc: DocumentRecord, e: Extraction) => {
    const vehicle = mergeVehicle(state.vehicles, e, doc);
    const activities = extractionToActivities(doc, e, factorById, vehicle);
    dispatch({ type: 'document:upsert', document: { ...doc, extraction: e } });
    dispatch({ type: 'document:validate', documentId: doc.id, activities, vehicle });
  };

  const analyse = async (file: File | undefined, doc: DocumentRecord, text: string, scanned: boolean, wantAi: boolean): Promise<Extraction> => {
    if (wantAi && aiAvailable) {
      let image: Blob | undefined;
      if (file && isImage(file) && aiImages) image = file;
      else if (file && isPdf(file) && scanned && aiImages) image = await renderPdfFirstPage(await file.arrayBuffer());
      if (text.trim() || image) {
        try {
          return await aiExtract({ text, filename: doc.name, image, factors, country });
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code === 'not_granted' || code === 'sampling_disabled') setAiAvailable(false);
          // Repli sur l'analyse locale du texte.
        }
      }
    }
    if (text.trim()) return parseDocument(text, doc.name, factors, country);
    const guess = detectDocType('', doc.name);
    return {
      docType: guess.type,
      method: 'manuel',
      lines: [],
      confidence: 0,
      warnings: [scanned ? 'Document scanné ou image : le texte n’a pas pu être lu sur cet appareil. Saisissez les valeurs (ou ouvrez la plateforme sur claude.ai pour une lecture automatique).' : 'Aucun texte lisible : saisissez les valeurs.'],
    };
  };

  const processFiles = async (files: File[] | Array<{ name: string; text: string }>) => {
    for (const f of files) {
      const isFile = f instanceof File;
      const name = f.name;
      setQueue((q) => [...q, { name, step: 'Lecture…' }]);
      const step = (s: string) => setQueue((q) => q.map((x) => (x.name === name ? { ...x, step: s } : x)));
      const doc: DocumentRecord = {
        id: uid(),
        name,
        size: isFile ? f.size : f.text.length,
        mime: isFile ? f.type || 'application/octet-stream' : 'text/plain',
        uploadedAt: new Date().toISOString(),
        entityId: entity?.id ?? '',
        year,
        status: 'a_valider',
        activityIds: [],
        sample: !isFile,
      };
      try {
        const file = isFile ? f : new File([f.text], name, { type: 'text/plain' });
        await saveFile(doc.id, file);
        const { text, scanned } = isFile ? await readDocumentText(f) : { text: f.text, scanned: false };
        step(useAi && aiAvailable ? 'Lecture par Claude…' : 'Analyse…');
        const extraction = await analyse(file, doc, text, scanned, useAi);
        const full = { ...doc, text, extraction };
        dispatch({ type: 'document:upsert', document: full });
        tryAutoValidate(full, extraction);
      } catch (err) {
        dispatch({ type: 'document:upsert', document: { ...doc, status: 'erreur', error: err instanceof Error ? err.message : 'Lecture impossible' } });
      } finally {
        setQueue((q) => q.filter((x) => x.name !== name));
      }
    }
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { a_valider: 0, valide: 0, rejete: 0, erreur: 0, tous: documents.length };
    for (const d of documents) c[d.status]++;
    return c;
  }, [documents]);

  const list = documents.filter((d) => filter === 'tous' || d.status === filter).slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const open = documents.find((d) => d.id === openId);

  const docEmissions = (d: DocumentRecord) =>
    state.activities
      .filter((a) => a.documentId === d.id)
      .reduce((s, a) => {
        const f = factorById.get(a.factorId);
        return f ? s + computeActivity(a, f, entities.find((e) => e.id === a.entityId), org).kgCO2e : s;
      }, 0);

  return (
    <div className="stack">
      <PageHead
        title="Documents"
        intro="Déposez les factures (STEG, carburant, gaz, eau), tickets, cartes grises, fiches techniques, billets ou bordereaux. Chaque pièce est lue, classée dans le bon scope et convertie en émissions ; elle reste attachée à la donnée comme justificatif."
      />

      <div className="grid g4">
        <Stat accent="main" label="Documents" value={fmt(documents.length)} sub={`${counts.valide} validés`} />
        <Stat label="À valider" value={fmt(counts.a_valider)} sub="vérification nécessaire" />
        <Stat label="Émissions justifiées" value={fmtMass(documents.reduce((s, d) => s + docEmissions(d), 0))} sub="issues des documents validés" />
        <Stat label="Lecture automatique" value={aiAvailable ? 'Claude' : 'Texte'} sub={aiAvailable ? (aiImages ? 'PDF, scans et photos' : 'PDF et textes') : 'PDF avec texte, TXT, CSV'} />
      </div>

      <Card title="Déposer des documents">
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <Field label="Site / entité">
            <select id="doc-entity" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Année par défaut" hint="Remplacée par la période lue sur le document">
            <NumberInput value={year} onChange={(v) => setYear(v ?? org.reportingYear)} />
          </Field>
          <label className="check">
            <input id="doc-auto" type="checkbox" checked={autoValidate} onChange={(e) => setAutoValidate(e.target.checked)} />
            Valider automatiquement les documents sûrs (confiance ≥ {AUTO_THRESHOLD * 100} %)
          </label>
          {aiAvailable && (
            <label className="check">
              <input id="doc-ai" type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
              Lecture par Claude (utilise votre compte Claude)
            </label>
          )}
        </div>
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            processFiles([...e.dataTransfer.files]);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <strong>Glissez vos fichiers ici ou cliquez pour les choisir</strong>
          <span className="small muted">PDF, images (JPG, PNG), TXT, CSV — plusieurs fichiers à la fois</span>
          <input
            ref={inputRef}
            id="doc-files"
            type="file"
            multiple
            hidden
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,application/pdf,image/*,text/plain"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              processFiles(files);
            }}
          />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={() => processFiles(SAMPLE_DOCUMENTS)}>Charger 9 documents d’exemple</button>
          <span className="small muted">Facture STEG, ticket Agil, carte grise, fiche technique, SONEDE, billet Tunisair, climatisation, déchets (contenu fictif).</span>
        </div>
        {!aiAvailable && (
          <p className="small muted" style={{ marginTop: 8 }}>
            Sur cet appareil, le texte des PDF est lu directement. Les scans et photos sont lus automatiquement lorsque la plateforme est ouverte sur claude.ai ; ici, leurs valeurs sont à saisir.
          </p>
        )}
        {queue.length > 0 && (
          <ul className="clean small" style={{ marginTop: 10 }}>
            {queue.map((q) => (
              <li key={q.name}>
                <span className="spinner" aria-hidden /> {q.name} — {q.step}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && <ReviewPanel key={open.id} doc={open} onClose={() => setOpenId(undefined)} onValidate={validate} reanalyse={analyse} country={country} aiAvailable={aiAvailable && useAi} />}

      <Card
        title="Pièces"
        actions={
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              ['a_valider', `À valider (${counts.a_valider})`],
              ['valide', `Validés (${counts.valide})`],
              ['rejete', `Rejetés (${counts.rejete})`],
              ['erreur', `Erreurs (${counts.erreur})`],
              ['tous', `Tous (${counts.tous})`],
            ]}
          />
        }
      >
        {list.length === 0 ? (
          <p className="empty">{documents.length === 0 ? 'Aucun document. Déposez vos premières factures ci-dessus ou chargez les exemples.' : 'Aucun document dans cette catégorie.'}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Classement</th>
                  <th className="num">Quantité lue</th>
                  <th className="num">Émissions</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const e = d.extraction;
                  const first = e?.lines[0];
                  const f = first?.factorId ? factorById.get(first.factorId) : undefined;
                  return (
                    <tr key={d.id}>
                      <td style={{ minWidth: 200 }}>
                        <button className="linklike" onClick={() => setOpenId(d.id)}>{d.name}</button>
                        <div className="small muted">
                          {[e?.supplier, e?.documentNumber && `n° ${e.documentNumber}`, e?.periodStart && e?.periodEnd ? `${e.periodStart} → ${e.periodEnd}` : e?.date, d.sample && 'exemple'].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="small">
                        {e ? DOC_TYPE_LABELS[e.docType] : '—'}
                        {e && <div className="muted">{e.method === 'ia' ? 'lu par Claude' : e.method === 'texte' ? 'analyse du texte' : 'saisie manuelle'}</div>}
                      </td>
                      <td>
                        {f ? (
                          <>
                            <ScopeBadge scope={getCategory(f.category).scope} />
                            <div className="small muted">{getCategory(f.category).label}</div>
                          </>
                        ) : e?.vehicle?.plate ? (
                          <span className="badge neutral">Flotte · {e.vehicle.plate}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">
                        {first?.quantity !== undefined ? `${fmt(first.quantity)} ${first.unit ?? f?.unit ?? ''}` : '—'}
                        {e && e.lines.length > 1 && <div className="small muted">+ {e.lines.length - 1} ligne(s)</div>}
                      </td>
                      <td className="num">{d.status === 'valide' ? fmtMass(docEmissions(d)) : '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                        {e && d.status === 'a_valider' && <div className="small muted">confiance {Math.round(e.confidence * 100)} %</div>}
                      </td>
                      <td className="nowrap">
                        <button className="ghost" onClick={() => setOpenId(d.id)} title="Vérifier">
                          {d.status === 'a_valider' ? 'Vérifier' : 'Ouvrir'}
                        </button>
                        <ConfirmButton
                          className="ghost danger"
                          title="Supprimer"
                          question="Supprimer le document et ses données ?"
                          onConfirm={() => {
                            deleteFile(d.id);
                            dispatch({ type: 'document:delete', id: d.id });
                          }}
                        >
                          🗑
                        </ConfirmButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const ENERGY_LABELS: Record<VehicleEnergy, string> = { gasoil: 'Gasoil', essence: 'Essence', gpl: 'GPL', electrique: 'Électrique', hybride: 'Hybride', autre: 'Autre' };

function ReviewPanel({
  doc,
  onClose,
  onValidate,
  reanalyse,
  aiAvailable,
}: {
  doc: DocumentRecord;
  onClose: () => void;
  onValidate: (doc: DocumentRecord, e: Extraction) => void;
  reanalyse: (file: File | undefined, doc: DocumentRecord, text: string, scanned: boolean, wantAi: boolean) => Promise<Extraction>;
  country: string;
  aiAvailable: boolean;
}) {
  const { state, dispatch, factors, factorById } = useStore();
  const { org, entities } = state;
  const [e, setE] = useState<Extraction>(doc.extraction ?? { docType: 'autre', method: 'manuel', lines: [], confidence: 0, warnings: [] });
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const locked = doc.status === 'valide';
  const entity = entities.find((x) => x.id === doc.entityId);
  const checks = checkLines(e, factorById);
  const canValidate = (checks.length > 0 && checks.every((c) => c.ok)) || (!!e.vehicle?.plate && e.lines.length === 0);

  const set = (patch: Partial<Extraction>) => setE((x) => ({ ...x, ...patch, method: x.method === 'ia' || x.method === 'texte' ? x.method : 'manuel' }));
  const setLine = (i: number, patch: Partial<ExtractedLine>) => set({ lines: e.lines.map((l, j) => (j === i ? { ...l, ...patch, confidence: 1 } : l)) });

  const rerun = async (wantAi: boolean) => {
    setBusy(true);
    try {
      const blob = await loadFile(doc.id);
      const file = blob ? new File([blob], doc.name, { type: doc.mime }) : undefined;
      let text = doc.text ?? '';
      let scanned = false;
      if (file && !text) ({ text, scanned } = await readDocumentText(file));
      const next = await reanalyse(file, doc, text, scanned, wantAi);
      setE(next);
      dispatch({ type: 'document:upsert', document: { ...doc, text, extraction: next } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={panelRef} style={{ scrollMarginTop: 16 }}>
    <Card
      className="review"
      title={<h2>{doc.name}</h2>}
      actions={
        <>
          <span className={`badge ${STATUS_BADGE[doc.status]}`}>{STATUS_LABEL[doc.status]}</span>
          <button className="ghost" onClick={onClose} aria-label="Fermer">✕</button>
        </>
      }
    >
      <div className="review-grid">
        <DocPreview doc={doc} />
        <div className="stack" style={{ minWidth: 0 }}>
          {e.warnings.map((w, i) => (
            <Callout key={i} tone="warn">{w}</Callout>
          ))}
          <div className="form-grid">
            <Field label="Type de document">
              <select id="rv-type" disabled={locked} value={e.docType} onChange={(x) => set({ docType: x.target.value as DocType })}>
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Fournisseur">
              <input id="rv-supplier" disabled={locked} value={e.supplier ?? ''} onChange={(x) => set({ supplier: x.target.value || undefined })} />
            </Field>
            <Field label="N° de document">
              <input id="rv-number" disabled={locked} value={e.documentNumber ?? ''} onChange={(x) => set({ documentNumber: x.target.value || undefined })} />
            </Field>
            <Field label="Date">
              <input id="rv-date" type="date" disabled={locked} value={e.date ?? ''} onChange={(x) => set({ date: x.target.value || undefined })} />
            </Field>
            <Field label="Période — début">
              <input id="rv-start" type="date" disabled={locked} value={e.periodStart ?? ''} onChange={(x) => set({ periodStart: x.target.value || undefined })} />
            </Field>
            <Field label="Période — fin">
              <input id="rv-end" type="date" disabled={locked} value={e.periodEnd ?? ''} onChange={(x) => set({ periodEnd: x.target.value || undefined })} />
            </Field>
            <Field label={`Montant total (${org.currency})`}>
              <NumberInput value={e.totalAmount} onChange={(v) => set({ totalAmount: v })} />
            </Field>
          </div>

          {(e.vehicle || e.docType === 'carte_grise' || e.docType === 'fiche_vehicule') && (
            <div>
              <h3>Véhicule</h3>
              <div className="form-grid">
                <Field label="Immatriculation">
                  <input id="rv-plate" disabled={locked} value={e.vehicle?.plate ?? ''} onChange={(x) => set({ vehicle: { ...e.vehicle, plate: x.target.value.toUpperCase() || undefined } })} placeholder="123 TU 4567" />
                </Field>
                <Field label="Énergie">
                  <select id="rv-energy" disabled={locked} value={e.vehicle?.energy ?? ''} onChange={(x) => set({ vehicle: { ...e.vehicle, energy: (x.target.value || undefined) as VehicleEnergy | undefined } })}>
                    <option value="">—</option>
                    {Object.entries(ENERGY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Marque / modèle">
                  <input id="rv-model" disabled={locked} value={[e.vehicle?.make, e.vehicle?.model].filter(Boolean).join(' ')} onChange={(x) => {
                    const [make, ...rest] = x.target.value.split(' ');
                    set({ vehicle: { ...e.vehicle, make: make || undefined, model: rest.join(' ') || undefined } });
                  }} />
                </Field>
                <Field label="Consommation (L/100 km)">
                  <NumberInput value={e.vehicle?.consumptionL100} onChange={(v) => set({ vehicle: { ...e.vehicle, consumptionL100: v } })} />
                </Field>
                <Field label="CO2 homologué (g/km)">
                  <NumberInput value={e.vehicle?.co2gkm} onChange={(v) => set({ vehicle: { ...e.vehicle, co2gkm: v } })} />
                </Field>
              </div>
            </div>
          )}

          <div>
            <div className="row">
              <h3 style={{ margin: 0 }}>Consommations à comptabiliser</h3>
              <span className="spacer" />
              {!locked && (
                <button onClick={() => set({ lines: [...e.lines, { description: DOC_TYPE_LABELS[e.docType], confidence: 1 }] })}>+ Ligne</button>
              )}
            </div>
            {e.lines.length === 0 && <p className="small muted">{e.vehicle?.plate ? 'Document de flotte : le véhicule sera ajouté au registre.' : 'Aucune ligne : ajoutez la consommation lue sur le document.'}</p>}
            {e.lines.map((l, i) => {
              const c = checks[i];
              const f = c?.factor;
              const res =
                c?.ok && f
                  ? computeActivity({ id: 'p', entityId: doc.entityId, year: doc.year, factorId: f.id, quantity: c.quantity!, quality: 2 }, f, entity, org)
                  : undefined;
              return (
                <div key={i} className="line-card">
                  <div className="form-grid">
                    <Field label="Libellé" wide>
                      <input id={`rv-l${i}-desc`} disabled={locked} value={l.description} onChange={(x) => setLine(i, { description: x.target.value })} />
                    </Field>
                    <Field label="Source d’émission" wide>
                      {locked ? <input disabled value={f?.label ?? ''} /> : <FactorSelect factors={factors} value={l.factorId ?? ''} onChange={(id) => setLine(i, { factorId: id || undefined, unit: factorById.get(id)?.unit ?? l.unit })} />}
                    </Field>
                    <Field label="Quantité">
                      <NumberInput value={l.quantity} onChange={(v) => setLine(i, { quantity: v })} />
                    </Field>
                    <Field label="Unité lue">
                      <input id={`rv-l${i}-unit`} disabled={locked} value={l.unit ?? ''} onChange={(x) => setLine(i, { unit: x.target.value || undefined })} />
                    </Field>
                    <Field label={`Montant (${org.currency})`}>
                      <NumberInput value={l.amount} onChange={(v) => setLine(i, { amount: v })} />
                    </Field>
                  </div>
                  <div className="row small" style={{ marginTop: 6 }}>
                    {f && <ScopeBadge scope={getCategory(f.category).scope} />}
                    {f && <span className="muted">{getCategory(f.category).label}</span>}
                    {l.confidence < 1 && <span className={`badge ${l.confidence >= 0.8 ? 'ok' : 'warn'}`}>confiance {Math.round(l.confidence * 100)} %</span>}
                    {c && !c.ok && <span className="badge danger">{c.problem}</span>}
                    {c?.note && <span className="muted">{c.note}</span>}
                    <span className="spacer" />
                    {!locked && <button className="ghost danger" onClick={() => set({ lines: e.lines.filter((_, j) => j !== i) })}>Retirer</button>}
                  </div>
                  {res && <div className="formula-line">{formulaText(res, org.gwpSet)}</div>}
                </div>
              );
            })}
          </div>

          <div className="row">
            {locked ? (
              <>
                <span className="small muted">Validé : {doc.activityIds.length} donnée(s) dans l’inventaire.</span>
                <span className="spacer" />
                <button onClick={() => dispatch({ type: 'document:reopen', documentId: doc.id })}>Rouvrir pour corriger</button>
              </>
            ) : (
              <>
                <button className="primary" disabled={!canValidate} onClick={() => { onValidate(doc, { ...e, confidence: 1 }); onClose(); }}>
                  Valider et ajouter à l’inventaire
                </button>
                <button onClick={() => dispatch({ type: 'document:upsert', document: { ...doc, extraction: e } })}>Enregistrer</button>
                <button disabled={busy} onClick={() => rerun(false)}>Relire le texte</button>
                {aiAvailable && <button disabled={busy} onClick={() => rerun(true)}>{busy ? 'Lecture…' : 'Relire avec Claude'}</button>}
                <span className="spacer" />
                <button className="ghost" onClick={() => { dispatch({ type: 'document:upsert', document: { ...doc, extraction: e, status: 'rejete' } }); onClose(); }}>Rejeter</button>
              </>
            )}
          </div>
          {e.totalAmount !== undefined && <p className="small muted">Montant total lu : {fmtMoney(e.totalAmount, e.currency ?? org.currency)}</p>}
        </div>
      </div>
    </Card>
    </div>
  );
}

/** Aperçu du document original : image, première page du PDF, ou texte. */
function DocPreview({ doc }: { doc: DocumentRecord }) {
  const [url, setUrl] = useState<string>();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let revoke: string | undefined;
    let alive = true;
    (async () => {
      const blob = await loadFile(doc.id);
      if (!alive) return;
      if (!blob) return setMissing(true);
      let shown: Blob | undefined;
      if (isImage({ name: doc.name, type: doc.mime })) shown = blob;
      else if (isPdf({ name: doc.name, type: doc.mime })) shown = await renderPdfFirstPage(await blob.arrayBuffer(), 1.2).catch(() => undefined);
      if (shown && alive) {
        revoke = URL.createObjectURL(shown);
        setUrl(revoke);
      }
    })();
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [doc.id, doc.name, doc.mime]);

  return (
    <div className="doc-preview">
      {url ? <img src={url} alt={`Aperçu de ${doc.name}`} /> : doc.text ? <pre>{doc.text}</pre> : <p className="small muted">{missing ? 'Fichier original non disponible sur ce navigateur.' : 'Chargement de l’aperçu…'}</p>}
    </div>
  );
}
