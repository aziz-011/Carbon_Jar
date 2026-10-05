import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import type { Scope } from '../domain/types';

export const SCOPE_COLORS: Record<Scope | 'memo', string> = {
  1: 'var(--s1)',
  2: 'var(--s2)',
  3: 'var(--s3)',
  memo: 'var(--memo)',
};

/** Couleurs résolues pour les graphiques SVG (les variables CSS ne sont pas toujours héritées). */
export function scopeColor(scope: Scope): string {
  if (typeof window === 'undefined') return '#888';
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--s${scope}`).trim();
  return v || ['#1e4e8c', '#5b8fc7', '#a3aeba'][scope - 1];
}

export function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function PageHead({ title, intro, actions, eyebrow, icon }: { title: string; intro?: ReactNode; actions?: ReactNode; eyebrow?: string; icon?: IconName }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && (
          <div className="eyebrow">
            {icon && <Icon name={icon} size={15} />}
            {eyebrow}
          </div>
        )}
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {actions && <div className="row no-print">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, icon }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; icon?: IconName }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <div className="card-title">
          {typeof title === 'string' ? (
            <h2>
              {icon && (
                <span className="title-icon">
                  <Icon name={icon} size={16} />
                </span>
              )}
              {title}
            </h2>
          ) : (
            title
          )}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, accent, icon }: { label: string; value: ReactNode; sub?: ReactNode; accent?: 's1' | 's2' | 's3' | 'main'; icon?: IconName }) {
  return (
    <div className={`card stat ${accent ? `accent-${accent}` : ''}`}>
      {icon && (
        <span className="stat-icon">
          <Icon name={icon} size={17} />
        </span>
      )}
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

export function ScopeBadge({ scope }: { scope: Scope | 'memo' | 'hors-inventaire' }) {
  if (scope === 'memo') return <span className="badge memo">Poste mémo</span>;
  if (scope === 'hors-inventaire') return <span className="badge memo">Hors scopes</span>;
  return <span className={`badge s${scope}`}>Scope {scope}</span>;
}

const CALLOUT_ICON: Record<string, IconName> = { info: 'info', warn: 'alert', attention: 'alert', key: 'checkCircle', critique: 'alert' };

export function Callout({ tone, title, children }: { tone: 'info' | 'warn' | 'key' | 'attention' | 'critique'; title?: string; children: ReactNode }) {
  return (
    <div className={`callout ${tone}`}>
      <Icon name={CALLOUT_ICON[tone]} size={17} />
      <div className="callout-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Formula({ label, formula, note }: { label: string; formula: string; note?: string }) {
  return (
    <div className="formula">
      <div className="lbl">{label}</div>
      <div className="f">{formula}</div>
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}

export function Field({ label, children, wide, hint }: { label: string; children: ReactNode; wide?: boolean; hint?: string }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  step,
  min,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value === undefined || Number.isNaN(value) ? '' : value}
      step={step ?? 'any'}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: Array<[T, string]> }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="bar" aria-valuenow={Math.round(pct)} role="progressbar">
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Empty({ children, icon = 'inbox' }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      {children}
    </div>
  );
}

/** Bouton à confirmation intégrée (les boîtes de dialogue natives sont bloquées dans les cadres intégrés). */
export function ConfirmButton({
  children,
  question,
  onConfirm,
  className,
  title,
}: {
  children: ReactNode;
  question: string;
  onConfirm: () => void;
  className?: string;
  title?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className={className} title={title} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={question}>
      <span className="small">{question}</span>
      <button
        className="danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        Confirmer
      </button>
      <button onClick={() => setAsking(false)}>Annuler</button>
    </span>
  );
}

/** Barre horizontale de répartition des émissions par scope. */
export function ScopeBar({ values }: { values: Record<1 | 2 | 3, number> }) {
  const total = values[1] + values[2] + values[3];
  if (total <= 0) return null;
  return (
    <div>
      <div className="scope-bar" role="img" aria-label="Répartition des émissions par scope">
        {([1, 2, 3] as const).map((s) => (values[s] > 0 ? <span key={s} style={{ width: `${(values[s] / total) * 100}%`, background: `var(--s${s})` }} /> : null))}
      </div>
      <div className="scope-legend">
        {([1, 2, 3] as const).map((s) => (
          <span key={s}>
            <i style={{ background: `var(--s${s})` }} />
            Scope {s} · {Math.round((values[s] / total) * 100)} %
          </span>
        ))}
      </div>
    </div>
  );
}
