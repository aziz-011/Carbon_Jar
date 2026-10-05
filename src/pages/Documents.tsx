import { useEffect, useMemo, useRef, useState } from 'react';
import { FactorSelect } from '../components/FactorSelect';
import { Icon } from '../components/Icon';
import { Callout, Card, ConfirmButton, Empty, Field, NumberInput, PageHead, ScopeBadge, Stat, Tabs } from '../components/ui';
import { DropZone, Receipts, UploadQueue } from '../components/upload';
import { getCategory } from '../data/categories';
import { DOC_TYPE_ICON } from '../data/docIcons';
import { DOCUMENT_REQUESTS } from '../data/documentRequests';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';
import type { DocType, DocumentRecord, DocumentStatus, Extraction, ExtractedLine, VehicleEnergy } from '../domain/types';
import { computeActivity } from '../lib/calc';
import { checkLines } from '../lib/documents/commit';
import { DOC_TYPE_LABELS } from '../lib/documents/parse';
import { isImage, isPdf, readDocumentText, renderPdfFirstPage } from '../lib/documents/read';
import { deleteFile, loadFile } from '../lib/fileStore';
import { fmt, fmtMoney } from '../lib/format';
import { fmtMass, formulaText } from '../lib/tracking';
import { useStore } from '../state/store';
import { AUTO_THRESHOLD, useDocumentPipeline } from '../state/usePipeline';

export const STATUS_LABEL: Record<DocumentStatus, string> = { a_valider: 'À vérifier', valide: 'Intégré au bilan', rejete: 'Rejeté', erreur: 'Erreur de lecture' };
export const STATUS_BADGE: Record<DocumentStatus, string> = { a_valider: 'warn', valide: 'ok', rejete: 'neutral', erreur: 'danger' };

type Filter = DocumentStatus | 'tous';

/** Espace cabinet : file de vérification des documents déposés par le client ou le cabinet. */
export function Documents() {
  const { state, dispatch, factorById } = useStore();
  const { org, entities, documents } = state;
  const { aiAvailable, aiImages, queue, receipts, clearReceipts, processFiles, validate, validateMany, analyse } = useDocumentPipeline();
  const [bulkInfo, setBulkInfo] = useState<string>();
  const [entityId, setEntityId] = useState(entities[0]?.id ?? '');
  const [year, setYear] = useState(org.reportingYear);
  const [autoValidate, setAutoValidate] = useState(true);
  const [useAi, setUseAi] = useState(true);
  const [filter, setFilter] = useState<Filter>(documents.some((d) => d.status === 'a_valider') ? 'a_valider' : 'tous');
  const [openId, setOpenId] = useState<string>();
  const entity = entities.find((e) => e.id === entityId) ?? entities[0];
  const run = (files: Parameters<typeof processFiles>[0]) =>
    processFiles(files, { entityId: entity?.id ?? '', year, autoValidate, useAi, source: 'cabinet' });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { a_valider: 0, valide: 0, rejete: 0, erreur: 0, tous: documents.length };
    for (const d of documents) c[d.status]++;
    return c;
  }, [documents]);

  const list = documents.filter((d) => filter === 'tous' || d.status === filter).slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const open = documents.find((d) => d.id === openId);
  const fromClient = documents.filter((d) => d.source === 'client').length;

  const docEmissions = (d: DocumentRecord) =>
    state.activities
      .filter((a) => a.documentId === d.id)
      .reduce((s, a) => {
        const f = factorById.get(a.factorId);
        return f ? s + computeActivity(a, f, entities.find((e) => e.id === a.entityId), org).kgCO2e : s;
      }, 0);

  const hintFor = (d: DocumentRecord): DocType | undefined => DOCUMENT_REQUESTS.find((r) => r.id === d.requestId)?.hint;

  return (
    <div className="stack">
      <PageHead
        eyebrow="Traitement"
        icon="checks"
        title="File de vérification"
        intro="Les pièces déposées par le client sur son portail (ou par le cabinet) sont lues et classées automatiquement. Vérifiez les extractions incertaines, corrigez si besoin, puis intégrez-les au bilan."
      />

      <div className="grid g4">
        <Stat accent="main" icon="inbox" label="Pièces reçues" value={fmt(documents.length)} sub={`${fromClient} via le portail client`} />
        <Stat icon="clock" label="À vérifier" value={fmt(counts.a_valider)} sub="extractions incertaines" />
        <Stat icon="checkCircle" label="Intégrées au bilan" value={fmt(counts.valide)} sub={fmtMass(documents.reduce((s, d) => s + docEmissions(d), 0))} />
        <Stat icon="sparkles" label="Lecture automatique" value={aiAvailable ? 'Claude' : 'Texte'} sub={aiAvailable ? (aiImages ? 'PDF, scans et photos' : 'PDF et textes') : 'PDF avec texte, TXT, CSV'} />
      </div>

      {open && (
        <ReviewPanel
          key={open.id}
          doc={open}
          onClose={() => setOpenId(undefined)}
          onValidate={validate}
          reanalyse={(file, doc, text, scanned, wantAi) => analyse({ file, doc, text, scanned, wantAi, hintType: hintFor(doc) })}
          aiAvailable={aiAvailable && useAi}
        />
      )}

      <Card
        icon="file"
        title="Pièces"
        actions={
          <>
          {counts.a_valider > 0 && (
            <button
              onClick={() => {
                const n = validateMany(documents.filter((d) => d.status === 'a_valider'));
                setBulkInfo(n ? `${n} pièce(s) intégrée(s) au bilan.` : 'Aucune pièce complète et sans alerte : ouvrez chaque pièce pour la vérifier.');
              }}
            >
              <Icon name="checks" size={15} /> Intégrer les pièces sans alerte
            </button>
          )}
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              ['a_valider', `À vérifier (${counts.a_valider})`],
              ['valide', `Intégrées (${counts.valide})`],
              ['rejete', `Rejetées (${counts.rejete})`],
              ['erreur', `Erreurs (${counts.erreur})`],
              ['tous', `Toutes (${counts.tous})`],
            ]}
          />
          </>
        }
      >
        {bulkInfo && <Callout tone="key">{bulkInfo}</Callout>}
        {list.length === 0 ? (
          <Empty icon={documents.length === 0 ? 'inbox' : 'checkCircle'}>
            {documents.length === 0 ? 'Aucune pièce reçue. Le client dépose ses documents depuis son portail, ou ajoutez-les ci-dessous.' : filter === 'a_valider' ? 'Rien à vérifier : toutes les pièces sont traitées.' : 'Aucune pièce dans cette catégorie.'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
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
                      <td style={{ minWidth: 240 }}>
                        <div className="doc-cell">
                          <span className="doc-icon"><Icon name={e ? DOC_TYPE_ICON[e.docType] : 'file'} size={17} /></span>
                          <div style={{ minWidth: 0 }}>
                            <button className="linklike" onClick={() => setOpenId(d.id)}>{d.name}</button>
                            <div className="small muted">
                              {[e ? DOC_TYPE_LABELS[e.docType] : undefined, e?.supplier, e?.documentNumber && `n° ${e.documentNumber}`, e?.periodStart && e?.periodEnd ? `${e.periodStart} → ${e.periodEnd}` : e?.date].filter(Boolean).join(' · ')}
                            </div>
                            <div className="row small" style={{ marginTop: 3, gap: 6 }}>
                              <span className={`badge ${d.source === 'client' ? 'info' : 'neutral'}`}>{d.source === 'client' ? 'Portail client' : 'Cabinet'}</span>
                              {e && <span className="badge neutral">{e.method === 'ia' ? 'lu par Claude' : e.method === 'texte' ? 'extraction automatique' : 'saisie manuelle'}</span>}
                              {d.sample && <span className="badge neutral">exemple</span>}
                            </div>
                            {d.clientNote && <div className="small" style={{ marginTop: 3 }}><Icon name="edit" size={12} /> Client : {d.clientNote}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {f ? (
                          <>
                            <ScopeBadge scope={getCategory(f.category).scope} />
                            <div className="small muted">{getCategory(f.category).label}</div>
                          </>
                        ) : e?.vehicle?.plate ? (
                          <span className="badge neutral"><Icon name="car" size={13} /> {e.vehicle.plate}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">
                        {first?.quantity !== undefined ? `${fmt(first.quantity, Math.abs(first.quantity) < 100 ? 3 : 0)} ${first.unit ?? f?.unit ?? ''}` : '—'}
                        {e && e.lines.length > 1 && <div className="small muted">+ {e.lines.length - 1} ligne(s)</div>}
                      </td>
                      <td className="num">{d.status === 'valide' ? fmtMass(docEmissions(d)) : '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                        {e && d.status === 'a_valider' && <div className="small muted">confiance {Math.round(e.confidence * 100)} %</div>}
                        {(d.checks ?? []).filter((c) => c.level !== 'info').slice(0, 1).map((c) => (
                          <div key={c.code} className={`small ${c.level === 'bloquant' ? 'neg' : 'muted'}`} style={{ maxWidth: 260 }}>
                            <Icon name="alert" size={12} /> {c.message}
                          </div>
                        ))}
                      </td>
                      <td className="nowrap">
                        <button className={d.status === 'a_valider' ? 'primary' : ''} onClick={() => setOpenId(d.id)}>
                          <Icon name={d.status === 'a_valider' ? 'checks' : 'eye'} size={15} />
                          {d.status === 'a_valider' ? 'Vérifier' : 'Ouvrir'}
                        </button>
                        <ConfirmButton
                          className="ghost danger icon-btn"
                          title="Supprimer"
                          question="Supprimer la pièce et ses données ?"
                          onConfirm={() => {
                            deleteFile(d.id);
                            dispatch({ type: 'document:delete', id: d.id });
                          }}
                        >
                          <Icon name="trash" size={16} />
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

      <Card icon="upload" title="Ajouter des pièces (cabinet)">
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
            Intégrer automatiquement les extractions sûres (confiance ≥ {AUTO_THRESHOLD * 100} %)
          </label>
          {aiAvailable && (
            <label className="check">
              <input id="doc-ai" type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
              Lecture par Claude (utilise votre compte Claude)
            </label>
          )}
        </div>
        <DropZone id="doc-files" onFiles={(f) => run(f)}>
          <button type="button" className="ghost" onClick={() => run(SAMPLE_DOCUMENTS)}>
            <Icon name="sparkles" size={15} /> 9 documents d’exemple
          </button>
        </DropZone>
        <UploadQueue queue={queue} />
        <Receipts receipts={receipts} onClear={clearReceipts} />
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
          {doc.clientNote && (
            <Callout tone="info" title="Précision du client">{doc.clientNote}</Callout>
          )}
          {(doc.checks ?? []).length > 0 && (
            <div>
              <h3>Contrôles de cohérence</h3>
              <div className="checks-list">
                {doc.checks!.map((c, i) => (
                  <div key={i} className={`check-item ${c.level}`}>
                    <Icon name={c.level === 'info' ? 'info' : 'alert'} size={15} />
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
