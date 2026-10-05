import { Icon } from '../../components/Icon';
import { Card, Empty, PageHead } from '../../components/ui';
import { computeActivity } from '../../lib/calc';
import { fmt } from '../../lib/format';
import { fmtMass } from '../../lib/tracking';
import { useStore } from '../../state/store';

const ENERGY: Record<string, string> = { gasoil: 'Gasoil', essence: 'Essence', gpl: 'GPL', electrique: 'Électrique', hybride: 'Hybride', autre: '—' };

/** Portail client : véhicules reconnus à partir des cartes grises et des tickets. */
export function PortalFleet() {
  const { state, factorById } = useStore();
  const { org, vehicles, entities } = state;
  const rows = vehicles.map((v) => {
    const acts = state.activities.filter((a) => a.vehicleId === v.id && a.year === org.reportingYear);
    const kg = acts.reduce((s, a) => {
      const f = factorById.get(a.factorId);
      return f ? s + computeActivity(a, f, entities.find((e) => e.id === a.entityId), org).kgCO2e : s;
    }, 0);
    return { v, litres: acts.reduce((s, a) => s + a.quantity, 0), kg };
  });
  return (
    <div className="stack">
      <PageHead eyebrow="Scope 1 · combustion mobile" icon="car" title="Ma flotte" intro="Véhicules reconnus à partir de vos cartes grises, fiches techniques et tickets de carburant." />
      <Card icon="truck" title={`${vehicles.length} véhicule(s)`}>
        {rows.length === 0 ? (
          <Empty icon="car">Déposez vos cartes grises dans « Documents à fournir ».</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Véhicule</th><th>Énergie</th><th className="num">Carburant</th><th className="num">Émissions</th></tr>
              </thead>
              <tbody>
                {rows.map(({ v, litres, kg }) => (
                  <tr key={v.id}>
                    <td>
                      <div className="doc-cell">
                        <span className="doc-icon"><Icon name="car" size={16} /></span>
                        <div>
                          <strong className="mono">{v.plate}</strong>
                          <div className="small muted">{[v.make, v.model].filter(Boolean).join(' ') || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{ENERGY[v.energy]}</td>
                    <td className="num">{litres ? `${fmt(litres)} L` : '—'}</td>
                    <td className="num">{kg ? fmtMass(kg) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
