import { useEffect, useRef, useState } from 'react';
import type { ExportRequest } from '../lib/csv';

/**
 * Panneau d'export utilisé lorsque les téléchargements sont bloqués (cadre intégré) :
 * affiche le contenu du fichier avec un bouton « Copier ».
 */
export function ExportPanel() {
  const [req, setReq] = useState<ExportRequest>();
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onExport = (e: Event) => {
      setReq((e as CustomEvent<ExportRequest>).detail);
      setCopied(false);
    };
    window.addEventListener('carbonjar:export', onExport);
    return () => window.removeEventListener('carbonjar:export', onExport);
  }, []);

  if (!req) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(req.content);
      setCopied(true);
    } catch {
      area.current?.select();
    }
  };

  return (
    <div className="export-backdrop" onClick={() => setReq(undefined)}>
      <div className="card export-panel" role="dialog" aria-label={`Export ${req.filename}`} onClick={(e) => e.stopPropagation()}>
        <div className="card-title">
          <h2>{req.filename}</h2>
          <button className="ghost" aria-label="Fermer" onClick={() => setReq(undefined)}>✕</button>
        </div>
        <p className="small muted">
          Les téléchargements sont bloqués dans cette vue. Copiez le contenu puis collez-le dans un fichier « {req.filename} » (ou dans Excel pour un CSV).
        </p>
        <textarea id="export-content" ref={area} readOnly value={req.content} className="mono" rows={12} onFocus={(e) => e.target.select()} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={copy}>{copied ? 'Copié' : 'Copier le contenu'}</button>
          <button onClick={() => setReq(undefined)}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
