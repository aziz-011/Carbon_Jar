import { useRef, useState, type ReactNode } from 'react';
import { DOC_TYPE_ICON } from '../data/docIcons';
import { ACCEPTED_FILES, MAX_FILE_MB, PIPELINE_STEPS, type QueueItem, type Receipt } from '../state/usePipeline';
import { Icon, type IconName } from './Icon';
import { ScopeBadge } from './ui';

/** Zone de dépôt : glisser-déposer, sélection de fichiers et, sur téléphone, prise de photo. */
export function DropZone({ onFiles, id, compact, children }: { onFiles: (files: File[]) => void; id: string; compact?: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`dropzone ${drag ? 'drag' : ''} ${compact ? 'compact' : ''}`}
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
      <Icon name="upload" size={compact ? 22 : 30} />
      <strong>{drag ? 'Déposez vos fichiers' : 'Glissez vos documents ici ou cliquez pour les choisir'}</strong>
      <span className="small muted">PDF, photos (JPG, PNG), Excel ou CSV · jusqu’à {MAX_FILE_MB} Mo par fichier · plusieurs fichiers à la fois</span>
      <div className="row" style={{ justifyContent: 'center', marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ghost" onClick={() => cam.current?.click()}>
          <Icon name="eye" size={15} /> Prendre en photo
        </button>
        {children}
      </div>
      <input
        ref={ref}
        id={id}
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
      <input
        ref={cam}
        id={`${id}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          onFiles(files);
        }}
      />
    </div>
  );
}

/** Fichiers en cours de traitement, avec l'étape atteinte. */
export function UploadQueue({ queue }: { queue: QueueItem[] }) {
  if (queue.length === 0) return null;
  return (
    <div className="upload-queue" aria-live="polite">
      {queue.map((q) => (
        <div key={q.key} className="upload-item">
          <span className="spinner" aria-hidden />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong className="small file-name">{q.name}</strong>
              <span className="small muted">{q.label}…</span>
            </div>
            <div className="step-track" aria-hidden>
              {PIPELINE_STEPS.map((s, i) => (
                <span key={s} className={i < q.step ? 'done' : i === q.step ? 'current' : ''} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const OUTCOME: Record<Receipt['outcome'], { label: string; badge: string; icon: IconName }> = {
  integre: { label: 'Intégré au bilan', badge: 'ok', icon: 'checkCircle' },
  a_verifier: { label: 'En vérification', badge: 'warn', icon: 'clock' },
  doublon: { label: 'Déjà reçu', badge: 'info', icon: 'layers' },
  refuse: { label: 'Refusé', badge: 'danger', icon: 'x' },
  erreur: { label: 'Illisible', badge: 'danger', icon: 'alert' },
};

/** Accusé de réception des fichiers déposés pendant la session. */
export function Receipts({ receipts, onClear }: { receipts: Receipt[]; onClear: () => void }) {
  if (receipts.length === 0) return null;
  const n = (o: Receipt['outcome']) => receipts.filter((r) => r.outcome === o).length;
  return (
    <section className="receipts" aria-live="polite">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="inbox" size={17} /> Accusé de réception
        </h3>
        <div className="row small">
          {n('integre') > 0 && <span className="badge ok">{n('integre')} intégré(s)</span>}
          {n('a_verifier') > 0 && <span className="badge warn">{n('a_verifier')} en vérification</span>}
          {n('doublon') > 0 && <span className="badge info">{n('doublon')} déjà reçu(s)</span>}
          {n('refuse') + n('erreur') > 0 && <span className="badge danger">{n('refuse') + n('erreur')} refusé(s)</span>}
          <button className="ghost small" onClick={onClear}>Effacer</button>
        </div>
      </div>
      <ul>
        {receipts.map((r) => {
          const o = OUTCOME[r.outcome];
          return (
            <li key={r.key} className={`receipt ${r.outcome}`}>
              <span className="doc-icon"><Icon name={r.docType ? DOC_TYPE_ICON[r.docType] : 'file'} size={16} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 6 }}>
                  <strong className="file-name">{r.name}</strong>
                  {r.scopes.map((s) => (
                    <ScopeBadge key={s} scope={s} />
                  ))}
                </div>
                <div className="small">{r.summary}</div>
                {r.reason && <div className="small muted">{r.reason}</div>}
              </div>
              <span className={`badge ${o.badge}`}>
                <Icon name={o.icon} size={12} /> {o.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
