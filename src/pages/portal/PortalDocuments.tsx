import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Card, PageHead, ScopeBadge } from '../../components/ui';
import { DOC_TYPE_ICON } from '../../data/docIcons';
import { SCOPE_INTROS, type DocumentRequest } from '../../data/documentRequests';
import { SAMPLE_DOCUMENTS } from '../../data/sampleDocuments';
import type { DocumentStatus, Scope } from '../../domain/types';
import { getCategory } from '../../data/categories';
import { collectionRate, requestProgress, type RequestProgress } from '../../lib/progress';
import { fmt } from '../../lib/format';
import { useStore } from '../../state/store';
import { useDocumentPipeline, type IncomingFile } from '../../state/usePipeline';

export const STATUS_PORTAL: Record<DocumentStatus, { label: string; short: string; badge: string; icon: 'checkCircle' | 'clock' | 'x' | 'alert' }> = {
  valide: { label: 'Intégré au bilan', short: 'Intégré', badge: 'ok', icon: 'checkCircle' },
  a_valider: { label: 'En vérification', short: 'En vérification', badge: 'warn', icon: 'clock' },
  rejete: { label: 'Écarté', short: 'Écarté', badge: 'neutral', icon: 'x' },
  erreur: { label: 'Illisible', short: 'Illisible', badge: 'danger', icon: 'alert' },
};

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,application/pdf,image/*,text/plain';

/** Portail client : liste des documents demandés, organisée par scope, avec dépôt par rubrique. */
export function PortalDocuments() {
  const { state, dispatch } = useStore();
  const { org, entities } = state;
  const { aiAvailable, queue, processFiles } = useDocumentPipeline();
  const [entityId, setEntityId] = useState(entities[0]?.id ?? '');
  const [params] = useSearchParams();
  const focus = params.get('r');
  const progress = requestProgress(state);
  const col = collectionRate(progress);

  useEffect(() => {
    if (focus) document.getElementById(`req-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  const upload = (files: IncomingFile[], r?: DocumentRequest) =>
    processFiles(files, { entityId: entityId || entities[0]?.id || '', year: org.reportingYear, autoValidate: true, useAi: true, source: 'client', requestId: r?.id, hintType: r?.hint });

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
        intro="Déposez vos documents dans la rubrique correspondante. Chaque pièce est lue automatiquement, classée dans le bon scope (1, 2 ou 3), puis vérifiée par nos ingénieurs. Vous pouvez déposer plusieurs fichiers à la fois."
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

      <Card icon="sparkles" title="Vous ne savez pas où classer un document ?">
        <QuickDrop onFiles={(f) => upload(f)} />
        <div className="row small" style={{ marginTop: 10 }}>
          <span className="muted">Déposez-le ici : il sera reconnu et rangé automatiquement. {aiAvailable ? 'Les scans et photos sont lus par Claude.' : 'Les PDF sont lus directement ; les scans seront saisis par le cabinet.'}</span>
          <span className="spacer" />
          <button className="ghost" onClick={() => upload(SAMPLE_DOCUMENTS)}>
            <Icon name="sparkles" size={15} /> Essayer avec des documents d’exemple
          </button>
        </div>
        {queue.length > 0 && (
          <ul className="clean small" style={{ marginTop: 10 }}>
            {queue.map((q) => (
              <li key={q.key}>
                <span className="spinner" aria-hidden /> {q.name} — {q.step}
              </li>
            ))}
          </ul>
        )}
      </Card>

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
                <RequestCard key={p.request.id} p={p} focused={focus === p.request.id} onFiles={(f) => upload(f, p.request)} onToggleNa={() => toggleNa(p.request.id)} />
              ))}
          </div>
        </section>
      ))}

      <p className="small muted">Les originaux restent attachés à chaque donnée du bilan comme pièces justificatives.</p>
    </div>
  );
}

function QuickDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`dropzone ${drag ? 'drag' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <Icon name="upload" size={28} />
      <strong>Glissez vos documents ici ou cliquez pour les choisir</strong>
      <span className="small muted">PDF, photos (JPG, PNG), TXT, CSV</span>
      <input
        ref={ref}
        id="portal-quick-files"
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          onFiles(files);
        }}
      />
    </div>
  );
}

function RequestCard({ p, focused, onFiles, onToggleNa }: { p: RequestProgress; focused: boolean; onFiles: (f: File[]) => void; onToggleNa: () => void }) {
  const { factorById } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const r = p.request;
  const state = { na: ['neutral', 'Non concerné'], missing: [r.required ? 'warn' : 'neutral', r.required ? 'À fournir' : 'Si concerné'], pending: ['info', 'Reçu'], integrated: ['ok', 'Intégré'] }[p.state];
  return (
    <article id={`req-${r.id}`} className={`request ${p.state === 'na' ? 'na' : p.documents.length ? 'received' : ''}`} style={focused ? { outline: '2px solid var(--accent)' } : undefined}>
      <div className="request-top">
        <span className={`req-icon s${r.scope}`}>
          <Icon name={r.icon} size={21} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="request-head">
            <h3>{r.title}</h3>
            <span className={`badge ${state[0]}`}>{state[1]}</span>
          </div>
          <p>{r.description}</p>
        </div>
      </div>
      <p className="small"><strong>À fournir :</strong> {r.examples}</p>
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
          accept={ACCEPT}
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
