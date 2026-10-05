import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Callout, Card, ConfirmButton, Field, NumberInput, PageHead, Stat } from '../components/ui';
import type { Activity, Vehicle, VehicleEnergy } from '../domain/types';
import { computeActivity } from '../lib/calc';
import { FUEL_FACTOR } from '../lib/documents/parse';
import { fmt, fmtMoney, uid } from '../lib/format';
import { fmtMass } from '../lib/tracking';
import { useStore } from '../state/store';

const ENERGY_LABELS: Record<VehicleEnergy, string> = { gasoil: 'Gasoil', essence: 'Essence', gpl: 'GPL', electrique: 'Électrique', hybride: 'Hybride', autre: 'Autre' };

/**
 * Registre de la flotte : véhicules issus des cartes grises et fiches techniques,
 * carburant réel (tickets, cartes carburant) et estimation par le kilométrage.
 */
export function Fleet() {
  const { state, dispatch, factorById } = useStore();
  const { org, entities, vehicles } = state;
  const year = org.reportingYear;
  const blank: Vehicle = { id: '', plate: '', energy: 'gasoil', entityId: entities[0]?.id ?? '', documentIds: [] };
  const [draft, setDraft] = useState<Vehicle>(blank);

  const rows = vehicles.map((v) => {
    const acts = state.activities.filter((a) => a.vehicleId === v.id && a.year === year);
    const measured = acts.filter((a) => a.quality <= 2);
    const estimated = acts.filter((a) => a.quality > 2);
    const results = acts.map((a) => {
      const f = factorById.get(a.factorId);
      return f ? computeActivity(a, f, entities.find((e) => e.id === a.entityId), org) : undefined;
    });
    const litres = measured.reduce((s, a) => s + a.quantity, 0) + estimated.reduce((s, a) => s + a.quantity, 0);
    const kg = results.reduce((s, r) => s + (r?.kgCO2e ?? 0), 0);
    const cost = results.reduce((s, r) => s + (r?.cost ?? 0), 0);
    const estimate = v.annualKm && v.consumptionL100 ? (v.annualKm * v.consumptionL100) / 100 : undefined;
    return { v, measured, estimated, litres, kg, cost, estimate };
  });

  const totalKg = rows.reduce((s, r) => s + r.kg, 0);
  const totalL = rows.reduce((s, r) => s + r.litres, 0);

  const estimateActivity = (r: (typeof rows)[number]) => {
    const factorId = FUEL_FACTOR[r.v.energy];
    if (!factorId || !r.estimate) return;
    const existing = r.estimated[0];
    const activity: Activity = {
      id: existing?.id ?? uid(),
      entityId: r.v.entityId,
      year,
      factorId,
      quantity: Math.round(r.estimate * 100) / 100,
      description: `Estimation carburant ${r.v.plate} (${fmt(r.v.annualKm)} km × ${fmt(r.v.consumptionL100)} L/100 km)`,
      quality: 3,
      evidence: 'Kilométrage déclaré × consommation de la fiche technique',
      vehicleId: r.v.id,
    };
    dispatch({ type: 'activity:upsert', activity });
  };

  const save = () => {
    if (!draft.plate.trim()) return;
    dispatch({ type: 'vehicle:upsert', vehicle: { ...draft, id: draft.id || uid(), plate: draft.plate.toUpperCase().trim() } });
    setDraft(blank);
  };

  return (
    <div className="stack">
      <PageHead
        eyebrow="Scope 1 · combustion mobile"
        icon="car"
        title="Flotte de véhicules"
        intro={`Registre alimenté par les cartes grises et fiches techniques déposées dans « Documents ». Les véhicules détenus ou contrôlés relèvent du Scope 1 (thermiques) ou du Scope 2 (électriques). Année ${year}.`}
      />
      <div className="grid g4">
        <Stat accent="s1" label="Véhicules" value={fmt(vehicles.length)} sub={`${vehicles.filter((v) => v.energy === 'electrique').length} électrique(s)`} />
        <Stat label="Carburant comptabilisé" value={`${fmt(totalL)} L`} sub="tickets, cartes carburant, estimations" />
        <Stat label="Émissions de la flotte" value={fmtMass(totalKg)} sub="rattachées aux véhicules" />
        <Stat label="Coût carburant" value={fmtMoney(rows.reduce((s, r) => s + r.cost, 0), org.currency)} />
      </div>

      <Card icon="car" title="Véhicules">
        {vehicles.length === 0 ? (
          <p className="empty">Aucun véhicule. Déposez une carte grise dans « Documents » ou ajoutez un véhicule ci-dessous.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Énergie</th>
                  <th className="num">Conso. / CO2</th>
                  <th className="num">Carburant réel</th>
                  <th className="num">Estimation km</th>
                  <th className="num">Émissions</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.v.id}>
                    <td>
                      <strong className="mono">{r.v.plate}</strong>
                      <div className="small muted">
                        {[r.v.make, r.v.model].filter(Boolean).join(' ') || '—'}
                        {r.v.fiscalPower ? ` · ${r.v.fiscalPower} CV` : ''}
                        {r.v.firstRegistration ? ` · MEC ${r.v.firstRegistration}` : ''}
                        {r.v.documentIds.length ? ` · ${r.v.documentIds.length} doc.` : ''}
                      </div>
                    </td>
                    <td>{ENERGY_LABELS[r.v.energy]}</td>
                    <td className="num">
                      {r.v.consumptionL100 ? `${fmt(r.v.consumptionL100)} ${r.v.energy === 'electrique' ? 'kWh' : 'L'}/100` : '—'}
                      {r.v.co2gkm ? <div className="small muted">{r.v.co2gkm} g/km</div> : null}
                    </td>
                    <td className="num">{r.measured.length ? `${fmt(r.measured.reduce((s, a) => s + a.quantity, 0))} L` : '—'}</td>
                    <td className="num">
                      {r.estimate ? `${fmt(r.estimate)} L` : '—'}
                      {r.v.annualKm ? <div className="small muted">{fmt(r.v.annualKm)} km/an</div> : null}
                    </td>
                    <td className="num">{r.kg ? fmtMass(r.kg) : '—'}</td>
                    <td className="nowrap">
                      {r.estimate && FUEL_FACTOR[r.v.energy] && r.measured.length === 0 && (
                        <button className="ghost" onClick={() => estimateActivity(r)} title="Ajouter l’estimation à l’inventaire">
                          {r.estimated.length ? 'Mettre à jour' : 'Estimer'}
                        </button>
                      )}
                      <button className="ghost" onClick={() => setDraft(r.v)} title="Modifier"><Icon name="edit" size={16} /></button>
                      <ConfirmButton className="ghost danger" title="Supprimer" question="Retirer ce véhicule du registre ?" onConfirm={() => dispatch({ type: 'vehicle:delete', id: r.v.id })}>
                        <Icon name="trash" size={16} />
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Callout tone="info">
          Le carburant réel (tickets et relevés de carte carburant) prime toujours. L’estimation « kilométrage × consommation » n’est proposée que pour un véhicule sans carburant justifié, en qualité de donnée niveau 3, pour éviter tout double comptage.
        </Callout>
      </Card>

      <Card title={draft.id ? `Modifier ${draft.plate}` : 'Ajouter un véhicule'}>
        <div className="form-grid">
          <Field label="Immatriculation">
            <input id="fl-plate" value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} placeholder="123 TU 4567" />
          </Field>
          <Field label="Énergie">
            <select id="fl-energy" value={draft.energy} onChange={(e) => setDraft({ ...draft, energy: e.target.value as VehicleEnergy })}>
              {Object.entries(ENERGY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Marque">
            <input id="fl-make" value={draft.make ?? ''} onChange={(e) => setDraft({ ...draft, make: e.target.value || undefined })} />
          </Field>
          <Field label="Modèle">
            <input id="fl-model" value={draft.model ?? ''} onChange={(e) => setDraft({ ...draft, model: e.target.value || undefined })} />
          </Field>
          <Field label="Consommation (L ou kWh /100 km)">
            <NumberInput value={draft.consumptionL100} onChange={(v) => setDraft({ ...draft, consumptionL100: v })} min={0} />
          </Field>
          <Field label="Kilométrage annuel">
            <NumberInput value={draft.annualKm} onChange={(v) => setDraft({ ...draft, annualKm: v })} min={0} />
          </Field>
          <Field label="Site">
            <select id="fl-site" value={draft.entityId} onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={save} disabled={!draft.plate.trim()}>{draft.id ? 'Enregistrer' : 'Ajouter'}</button>
          {draft.id && <button onClick={() => setDraft(blank)}>Annuler</button>}
        </div>
      </Card>
    </div>
  );
}
