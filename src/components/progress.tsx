import type { WorkflowStep } from '../lib/progress';
import { Icon, type IconName } from './Icon';

const STEP_ICON: Record<string, IconName> = {
  collecte: 'upload',
  extraction: 'sparkles',
  verification: 'checks',
  bilan: 'chart',
  rapport: 'report',
};

/** Les étapes du dossier, de la collecte des documents au rapport publié. */
export function Steps({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="steps" aria-label="Avancement du dossier">
      {steps.map((s) => (
        <li key={s.id} className={`step ${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span className="step-dot">
            <Icon name={s.state === 'done' ? 'check' : STEP_ICON[s.id]} size={16} />
          </span>
          <div>
            <div className="step-title">{s.title}</div>
            <div className="step-sub">{s.sub}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Anneau de progression (0–1). */
export function ProgressRing({ value, label, size = 132 }: { value: number; label: string; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />
      </svg>
      <div className="ring-label">
        <b>{Math.round(v * 100)} %</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
