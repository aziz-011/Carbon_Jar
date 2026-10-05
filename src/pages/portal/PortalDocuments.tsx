import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { DropZone, Receipts, UploadQueue } from '../../components/upload';
import { Card, PageHead, ScopeBadge } from '../../components/ui';
import { getCategory } from '../../data/categories';
import { DOC_TYPE_ICON } from '../../data/docIcons';
import { SCOPE_INTROS, type DocumentRequest } from '../../data/documentRequests';
import { SAMPLE_DOCUMENTS } from '../../data/sampleDocuments';
import type { DocumentRecord, DocumentStatus, Scope } from '../../domain/types';
import { MONTHLY_REQUESTS, monthlyCoverage } from '../../lib/documents/checks';
import { DOC_TYPE_LABELS } from '../../lib/documents/parse';
import { fmt } from '../../lib/format';
import { collectionRate, requestProgress, type RequestProgress } from '../../lib/progress';
import { useStore } from '../../state/store';
import { ACCEPTED_FILES, useDocumentPipeline, type IncomingFile } from '../../state/usePipeline';

export const STATUS_PORTAL: Record<DocumentStatus, { label: string; short: string; badge: string; icon: 'checkCircle' | 'clock' | 'x' | 'alert' }> = {
  valide: { label: 'Intégré au bilan', short: 'Intégré', badge: 'ok', icon: 'checkCircle' },
  a_valider: { label: 'En vérification', short: 'En vérification', badge: 'warn', icon: 'clock' },
  rejete: { label: 'Écarté', short: 'Écarté', badge: 'neutral', icon: 'x' },
  erreur: { label: 'Illisible', short: 'Illisible', badge: 'danger', icon: 'alert' },
};

/** Portail client : liste des documents demandés, organisée par scope, avec dépôt par rubrique. */
export function PortalDocuments() {
  const { state, dispatch } = useStore();
  const { org, entities } = state;
  const { aiAvailable, queue, receipts, clearReceipts, processFiles } = useDocumentPipeline();
  const [entityId, setEntityId] = useState(entities[0]?.id ?? '');
  const [params] = useSearchParams();
  const focus = params.get('r');
  const progress = requestProgress(state);
  const col = collectionRate(progress);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus) document.getElementById(`req-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  const upload = (files: IncomingFile[], r?: DocumentRequest) => {
    if (files.length === 0) return;
    // Le suivi du traitement est en haut de page : on y ramène le client.
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    processFiles(files, { entityId: entityId || entities[0]?.id || '', year: org.reportingYear, autoValidate: true, useAi: true, source: 'client', requestId: r?.id, hintType: r?.hint });
  };

  const toggleNa = (id: string) => {
    const na = state.portal.notApplicable;
    dispatch({ type: 'portal', patch: { notApplicable: na.includes(id) ? na.filter((x) => x !== id) : [...na, id] } });
  };

  return (
    <div className="stack">
      <PageHead
        eyebrow={`Étape 1 · ${fmt(col.done)}/${fmt(col.total)} rubriques fournies`}
        icon="upload"
        title="Documents à fournir"
        intro="Déposez vos documents dans la rubrique correspondante, ou tous ensemble ci-dessous. Chaque pièce est lue automatiquement, contrôlée, classée dans le bon scope (1, 2 ou 3), puis vérifiée par nos ingénieurs si besoin."
        actions={
          entities.length > 1 ? (
            <select id="portal-site" value={entityId} onChange={(e) => setEntityId(e.target.value)} aria-label="Site concerné">
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          ) : undefined
        }
      />

      <div ref={topRef} style={{ scrollMarginTop: 80 }}>
        <Card icon="sparkles" title="Déposer vos documents">
          <DropZone id="portal-quick-files" onFiles={(f) => upload(f)}>
            <button type="button" className="ghost" onClick={() => upload(SAMPLE_DOCUMENTS)}>
              <Icon name="sparkles" size={15} /> Essayer avec des exemples
            </button>
          </DropZone>
          <div className="reading-modes">
            <span><Icon name="file" size={14} /> PDF : lus automatiquement</span>
            <span><Icon name="table" size={14} /> Excel / CSV : chaque ligne classée (relevés de cartes carburant, extractions comptables)</span>
            <span><Icon name="eye" size={14} /> Photos et scans : {aiAvailable ? 'lus par Claude' : 'saisis par nos ingénieurs (lecture automatique sur claude.ai)'}</span>
          </div>
          <UploadQueue queue={queue} />
          <Receipts receipts={receipts} onClear={clearReceipts} />
        </Card>
      </div>

      {([1, 2, 3] as Scope[]).map((scope) => (
        <section key={scope} className="scope-section">
          <div className="scope-head">
            <ScopeBadge scope={scope} />
            <div>
              <h2>{SCOPE_INTROS[scope].title}</h2>
              <p>{SCOPE_INTROS[scope].text}</p>
            </div>
          </div>
          <div className="requests">
            {progress
              .filter((p) => p.request.scope === scope)
              .map((p) => (
                <RequestCard key={p.request.id} p={p} year={org.reportingYear} focused={focus === p.request.id} onFiles={(f) => upload(f, p.request)} onToggleNa={() => toggleNa(p.request.id)} />
              ))}
          </div>
        </section>
      ))}

      <MySubmissions />
    </div>
  );
}

function RequestCard({ p, year, focused, onFiles, onToggleNa }: { p: RequestProgress; year: number; focused: boolean; onFiles: (f: File[]) => void; onToggleNa: () => void }) {
  const { factorById } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const r = p.request;
  const status = { na: ['neutral', 'Non concerné'], missing: [r.required ? 'warn' : 'neutral', r.required ? 'À fournir' : 'Si concerné'], pending: ['info', 'Reçu'], integrated: ['ok', 'Intégré'] }[p.state];
  const monthly = MONTHLY_REQUESTS[r.id];
  const coverage = monthly && p.documents.length ? monthlyCoverage(p.documents, monthly, year) : undefined;
  return (
    <article
      id={`req-${r.id}`}
      className={`request ${p.state === 'na' ? 'na' : p.documents.length ? 'received' : ''} ${drag ? 'drag' : ''}`}
      style={focused ? { outline: '2px solid var(--accent)' } : undefined}
      onDragOver={(e) => {
        if (p.state === 'na') return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (p.state !== 'na') onFiles([...e.dataTransfer.files]);
      }}
    >
      <div className="request-top">
        <span className={`req-icon s${r.scope}`}>
          <Icon name={r.icon} size={21} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="request-head">
            <h3>{r.title}</h3>
            <span className={`badge ${status[0]}`}>{status[1]}</span>
          </div>
          <p>{r.description}</p>
        </div>
      </div>
      <p className="small"><strong>À fournir :</strong> {r.examples}</p>
      {coverage && (
        <div className={`coverage ${coverage.missing.length ? 'partial' : 'full'}`}>
          <div className="months" aria-label={`Mois couverts en ${year}`}>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={coverage.covered.includes(i) ? 'on' : ''} title={['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'][i]} />
            ))}
          </div>
          <span className="small">
            {coverage.missing.length === 0 ? `Les 12 mois de ${year} sont couverts.` : `Il manque ${coverage.missing.length} mois : ${coverage.missing.join(', ')}.`}
          </span>
        </div>
      )}
      {p.documents.length > 0 && (
        <div className="request-files">
          {p.documents.map((d) => {
            const st = STATUS_PORTAL[d.status];
            const line = d.extraction?.lines[0];
            const f = line?.factorId ? factorById.get(line.factorId) : undefined;
            return (
              <div key={d.id} className="file-line">
                <Icon name={d.extraction ? DOC_TYPE_ICON[d.extraction.docType] : 'file'} size={15} />
                <span className="name" title={d.name}>{d.name}</span>
                <span className={`badge ${st.badge}`} title={f ? `${st.label} · Scope ${getCategory(f.category).scope} — ${getCategory(f.category).label}` : st.label}>
                  <Icon name={st.icon} size={12} /> {st.short}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {drag && <div className="drop-hint"><Icon name="upload" size={18} /> Déposer dans « {r.title} »</div>}
      <div className="request-actions">
        {p.state !== 'na' && (
          <button className={p.documents.length ? '' : 'primary'} onClick={() => ref.current?.click()}>
            <Icon name="upload" size={15} /> {p.documents.length ? 'Ajouter' : 'Déposer'}
          </button>
        )}
        {p.documents.length === 0 && (
          <button className="ghost" onClick={onToggleNa}>
            {p.state === 'na' ? 'Je suis concerné' : 'Non concerné'}
          </button>
        )}
        <input
          ref={ref}
          id={`req-files-${r.id}`}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_FILES}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            onFiles(files);
          }}
        />
      </div>
    </article>
  );
}

/** Historique des envois du client, avec l'état de chaque pièce et une précision pour le cabinet. */
function MySubmissions() {
  const { state, dispatch } = useStore();
  const docs = state.documents.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const [open, setOpen] = useState<string>();
  if (docs.length === 0) return null;
  const note = (d: DocumentRecord, clientNote: string) => dispatch({ type: 'document:upsert', document: { ...d, clientNote: clientNote || undefined } });
  return (
    <Card icon="inbox" title={`Mes envois (${docs.length})`}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Document</th><th>Reconnu comme</th><th>État</th><th /></tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const st = STATUS_PORTAL[d.status];
              const alerts = (d.checks ?? []).filter((c) => c.level !== 'info');
              return (
                <tr key={d.id}>
                  <td style={{ minWidth: 200 }}>
                    <div className="doc-cell">
                      <span className="doc-icon"><Icon name={d.extraction ? DOC_TYPE_ICON[d.extraction.docType] : 'file'} size={16} /></span>
                      <div style={{ minWidth: 0 }}>
                        <strong className="small file-name">{d.name}</strong>
                        <div className="small muted">Envoyé le {new Date(d.uploadedAt).toLocaleDateString('fr-FR')}</div>
                        {d.clientNote && <div className="small"><Icon name="edit" size={12} /> {d.clientNote}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="small">
                    {d.extraction ? DOC_TYPE_LABELS[d.extraction.docType] : '—'}
                    {d.extraction?.periodStart && d.extraction.periodEnd && <div className="muted">{d.extraction.periodStart} → {d.extraction.periodEnd}</div>}
                  </td>
                  <td>
                    <span className={`badge ${st.badge}`}><Icon name={st.icon} size={12} /> {st.label}</span>
                    {d.status === 'a_valider' && alerts[0] && <div className="small muted" style={{ maxWidth: 320 }}>{alerts[0].message}</div>}
                  </td>
                  <td className="nowrap">
                    {open === d.id ? (
                      <form
                        className="row"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const v = (new FormData(e.currentTarget).get('note') as string) ?? '';
                          note(d, v.trim());
                          setOpen(undefined);
                        }}
                      >
                        <input name="note" id={`note-${d.id}`} defaultValue={d.clientNote ?? ''} placeholder="Ex. : compteur n°2, atelier B" style={{ width: 220 }} autoFocus />
                        <button className="primary">OK</button>
                      </form>
                    ) : (
                      <button className="ghost" onClick={() => setOpen(d.id)}>
                        <Icon name="edit" size={14} /> {d.clientNote ? 'Modifier la précision' : 'Ajouter une précision'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
