import { CATEGORIES } from '../data/categories';
import type { EmissionFactor, Scope } from '../domain/types';

/** Liste déroulante des facteurs d'émission, groupés par scope et catégorie. */
export function FactorSelect({
  factors,
  value,
  onChange,
  scope,
}: {
  factors: EmissionFactor[];
  value: string;
  onChange: (id: string) => void;
  scope?: Scope;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Choisir une source d’émission —</option>
      {CATEGORIES.filter((c) => !scope || c.scope === scope).map((c) => {
        const fs = factors.filter((f) => f.category === c.id);
        if (fs.length === 0) return null;
        return (
          <optgroup key={c.id} label={`Scope ${c.scope} · ${c.label}`}>
            {fs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} ({f.unit}){f.custom ? ' ★' : ''}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
