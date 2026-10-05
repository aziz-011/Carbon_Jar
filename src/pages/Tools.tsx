import { useState } from 'react';
import { FactorSelect } from '../components/FactorSelect';
import { Callout, Card, Field, Formula, NumberInput, PageHead, ScopeBadge } from '../components/ui';
import { getCategory } from '../data/categories';
import { GRID_ZONES } from '../data/emissionFactors';
import { REFRIGERANTS, refrigerantGwp } from '../data/gwp';
import type { GasKey } from '../domain/types';
import { baseYearRecalculation, carbonCostExposure, intensityRatio, perUnitEmissions, refrigerantMassBalance, sumGases } from '../lib/calc';
import { fmt, fmtMoney } from '../lib/format';
import { useStore } from '../state/store';

export function Tools() {
  return (
    <div className="stack">
      <PageHead title="Calculateurs" intro="Les formules du bilan carbone, prêtes à l’emploi : calcul d’émissions, bilan massique des fluides, double reporting Scope 2, consolidation, recalcul de l’année de base, intensité, conversions d’énergie." />
      <div className="grid g2">
        <QuickCalc />
        <Refrigerant />
        <Scope2Dual />
        <Consolidation />
        <BaseYear />
        <IntensityAndCost />
        <EnergyConverter />
      </div>
    </div>
  );
}

function QuickCalc() {
  const { factors, factorById, state } = useStore();
  const [id, setId] = useState('diesel_vehicle');
  const [qty, setQty] = useState<number | undefined>(1000);
  const f = factorById.get(id);
  const u = f ? perUnitEmissions(f, state.org.gwpSet) : undefined;
  const total = u && qty ? sumGases(u.byGas) * qty : 0;
  return (
    <Card title="Calcul d’émissions">
      <Formula label="Formule" formula="Émissions = Donnée d’activité × Facteur d’émission" />
      <div className="form-grid">
        <Field label="Source" wide>
          <FactorSelect factors={factors} value={id} onChange={setId} />
        </Field>
        <Field label={`Quantité (${f?.unit ?? ''})`}>
          <NumberInput value={qty} onChange={setQty} min={0} />
        </Field>
      </div>
      {f && u && (
        <div style={{ marginTop: 12 }}>
          <div className="row">
            <ScopeBadge scope={getCategory(f.category).scope} />
            <span className="small">{getCategory(f.category).label}</span>
          </div>
          <p style={{ margin: '8px 0' }}>
            Facteur : <strong>{fmt(sumGases(u.byGas), 4)} kg CO2e / {f.unit}</strong> → <strong>{fmt(total / 1000, 3)} t CO2e</strong>
          </p>
          <table className="small">
            <tbody>
              {(Object.entries(u.byGas) as Array<[GasKey, number]>).map(([g, v]) => (
                <tr key={g}>
                  <td>{g}</td>
                  <td className="num">{fmt(v * (qty ?? 0), 2)} kg CO2e</td>
                </tr>
              ))}
              {u.biogenic > 0 && (
                <tr>
                  <td>CO2 biogénique (mémo)</td>
                  <td className="num">{fmt(u.biogenic * (qty ?? 0), 2)} kg</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="small muted">Source : {f.source}</p>
        </div>
      )}
    </Card>
  );
}

function Refrigerant() {
  const { state } = useStore();
  const [fluid, setFluid] = useState('R-410A');
  const [initial, setInitial] = useState<number | undefined>(50);
  const [recharges, setRecharges] = useState<number | undefined>(8);
  const [final, setFinal] = useState<number | undefined>(50);
  const [retired, setRetired] = useState<number | undefined>();
  const [added, setAdded] = useState<number | undefined>();
  const leaked = refrigerantMassBalance({ initialStock: initial ?? 0, recharges: recharges ?? 0, finalStock: final ?? 0, retiredCapacity: retired, newCapacity: added });
  const gwp = refrigerantGwp(fluid, state.org.gwpSet);
  const r = REFRIGERANTS.find((x) => x.id === fluid);
  return (
    <Card title="Bilan massique des fluides frigorigènes">
      <Formula label="Formule" formula="Fuite = Charge initiale + Recharges − Charge finale (+ capacité retirée − capacité neuve)" note="Émissions = Fuite (kg) × PRG du fluide" />
      <div className="form-grid">
        <Field label="Fluide">
          <select value={fluid} onChange={(e) => setFluid(e.target.value)}>
            {REFRIGERANTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Charge initiale (kg)"><NumberInput value={initial} onChange={setInitial} min={0} /></Field>
        <Field label="Recharges de l’année (kg)"><NumberInput value={recharges} onChange={setRecharges} min={0} /></Field>
        <Field label="Charge finale (kg)"><NumberInput value={final} onChange={setFinal} min={0} /></Field>
        <Field label="Capacité des équipements retirés (kg)"><NumberInput value={retired} onChange={setRetired} min={0} /></Field>
        <Field label="Capacité des équipements neufs (kg)"><NumberInput value={added} onChange={setAdded} min={0} /></Field>
      </div>
      <p style={{ marginTop: 12 }}>
        Fuite : <strong>{fmt(leaked, 2)} kg</strong> × PRG {fmt(gwp)} ({state.org.gwpSet}) = <strong>{fmt((leaked * gwp) / 1000, 2)} t CO2e</strong>
      </p>
      {r?.note && <Callout tone="info">{r.note}</Callout>}
    </Card>
  );
}

function Scope2Dual() {
  const [kwh, setKwh] = useState<number | undefined>(1000000);
  const [zone, setZone] = useState('TN');
  const [share, setShare] = useState<number | undefined>(60);
  const [instFactor, setInstFactor] = useState<number | undefined>(0);
  const [residual, setResidual] = useState<number | undefined>();
  const grid = GRID_ZONES.find((z) => z.code === zone)?.value ?? 0;
  const k = kwh ?? 0;
  const covered = (k * (share ?? 0)) / 100;
  const lb = (k * grid) / 1000;
  const mb = (covered * (instFactor ?? 0) + (k - covered) * (residual ?? grid)) / 1000;
  return (
    <Card title="Scope 2 — double reporting">
      <Formula label="Location-based" formula="kWh × facteur moyen du réseau" />
      <Formula label="Market-based" formula="kWh couverts × facteur de l’instrument + kWh restants × mix résiduel" />
      <div className="form-grid">
        <Field label="Consommation (kWh)"><NumberInput value={kwh} onChange={setKwh} min={0} /></Field>
        <Field label="Réseau">
          <select value={zone} onChange={(e) => setZone(e.target.value)}>
            {GRID_ZONES.map((z) => (
              <option key={z.code} value={z.code}>
                {z.name} ({z.value})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Part couverte par PPA / GO (%)"><NumberInput value={share} onChange={setShare} min={0} /></Field>
        <Field label="Facteur de l’instrument (kg/kWh)"><NumberInput value={instFactor} onChange={setInstFactor} min={0} /></Field>
        <Field label="Mix résiduel (kg/kWh)" hint="Vide = moyenne réseau (dernier recours)"><NumberInput value={residual} onChange={setResidual} min={0} /></Field>
      </div>
      <table style={{ marginTop: 12 }}>
        <tbody>
          <tr className="total"><td>Location-based</td><td className="num">{fmt(lb, 2)} t CO2e</td></tr>
          <tr className="total"><td>Market-based</td><td className="num">{fmt(mb, 2)} t CO2e</td></tr>
        </tbody>
      </table>
    </Card>
  );
}

function Consolidation() {
  const [em, setEm] = useState<number | undefined>(10000);
  const [eq, setEq] = useState<number | undefined>(50);
  const [fin, setFin] = useState(false);
  const [op, setOp] = useState(false);
  const e = em ?? 0;
  return (
    <Card title="Consolidation d’une entité">
      <Formula label="Part de capital" formula="Émissions × % de participation" />
      <Formula label="Contrôle" formula="Émissions × (100 % si contrôle, sinon 0 %)" />
      <div className="form-grid">
        <Field label="Émissions de l’entité (t CO2e)"><NumberInput value={em} onChange={setEm} min={0} /></Field>
        <Field label="Participation (%)"><NumberInput value={eq} onChange={setEq} min={0} /></Field>
        <label className="check"><input type="checkbox" checked={fin} onChange={(x) => setFin(x.target.checked)} /> Contrôle financier</label>
        <label className="check"><input type="checkbox" checked={op} onChange={(x) => setOp(x.target.checked)} /> Contrôle opérationnel</label>
      </div>
      <table style={{ marginTop: 12 }}>
        <tbody>
          <tr><td>Part de capital</td><td className="num">{fmt((e * (eq ?? 0)) / 100)} t</td></tr>
          <tr><td>Contrôle financier</td><td className="num">{fmt(fin ? e : 0)} t</td></tr>
          <tr><td>Contrôle opérationnel</td><td className="num">{fmt(op ? e : 0)} t</td></tr>
        </tbody>
      </table>
    </Card>
  );
}

function BaseYear() {
  const [base, setBase] = useState<number | undefined>(10000);
  const [acq, setAcq] = useState<number | undefined>(800);
  const [div, setDiv] = useState<number | undefined>(0);
  const [meth, setMeth] = useState<number | undefined>(0);
  const [th, setTh] = useState<number | undefined>(5);
  const r = baseYearRecalculation({ baseYearEmissions: base ?? 0, acquiredEmissions: acq ?? 0, divestedEmissions: div ?? 0, methodologyDelta: meth ?? 0, thresholdPct: th ?? 5 });
  return (
    <Card title="Recalcul de l’année de base">
      <Formula label="Test de signification" formula="Σ |changements| ÷ émissions de base ≥ seuil ⇒ recalcul" note="Croissance organique (nouvelle usine construite) : pas de recalcul." />
      <div className="form-grid">
        <Field label="Émissions de l’année de base (t)"><NumberInput value={base} onChange={setBase} min={0} /></Field>
        <Field label="Entités acquises (émissions sur l’année de base)"><NumberInput value={acq} onChange={setAcq} min={0} /></Field>
        <Field label="Entités cédées (émissions sur l’année de base)"><NumberInput value={div} onChange={setDiv} min={0} /></Field>
        <Field label="Correction méthode / erreur (± t)"><NumberInput value={meth} onChange={setMeth} /></Field>
        <Field label="Seuil de signification (%)" hint="Ex. 5 % ; 10 % pour le CCAR"><NumberInput value={th} onChange={setTh} min={0} /></Field>
      </div>
      <Callout tone={r.recalculate ? 'warn' : 'key'} title={r.recalculate ? 'Recalcul nécessaire' : 'Pas de recalcul nécessaire'}>
        Changement : {fmt(r.changePct, 1)} % de l’année de base.{' '}
        {r.recalculate && `Année de base ajustée : ${fmt(r.adjustedBase)} t CO2e.`}
      </Callout>
    </Card>
  );
}

function IntensityAndCost() {
  const { state } = useStore();
  const [em, setEm] = useState<number | undefined>(5000);
  const [metric, setMetric] = useState<number | undefined>(12000);
  const [price, setPrice] = useState<number | undefined>(state.org.carbonPrice);
  const ratio = intensityRatio(em ?? 0, metric);
  return (
    <Card title="Intensité et coût du carbone">
      <Formula label="Ratio d’intensité" formula="Émissions ÷ métrique d’activité (t produites, CA, salariés, m²)" />
      <Formula label="Exposition financière" formula="Émissions × prix du carbone" />
      <div className="form-grid">
        <Field label="Émissions (t CO2e)"><NumberInput value={em} onChange={setEm} min={0} /></Field>
        <Field label="Métrique d’activité"><NumberInput value={metric} onChange={setMetric} min={0} /></Field>
        <Field label={`Prix carbone (${state.org.currency}/t)`}><NumberInput value={price} onChange={setPrice} min={0} /></Field>
      </div>
      <table style={{ marginTop: 12 }}>
        <tbody>
          <tr><td>Intensité</td><td className="num">{ratio !== undefined ? `${fmt(ratio, 4)} t CO2e / unité` : '—'}</td></tr>
          <tr><td>Coût carbone potentiel</td><td className="num">{fmtMoney(carbonCostExposure(em ?? 0, price ?? 0), state.org.currency)}</td></tr>
        </tbody>
      </table>
    </Card>
  );
}

/** Facteurs de conversion vers le kWh. */
const ENERGY_UNITS: Array<[string, number]> = [
  ['kWh', 1],
  ['MWh', 1000],
  ['GWh', 1e6],
  ['GJ', 277.778],
  ['MJ', 0.277778],
  ['tep (tonne équivalent pétrole)', 11630],
  ['therm', 29.3071],
  ['MMBtu', 293.071],
  ['L gazole (PCI)', 10.03],
  ['L essence (PCI)', 9.17],
  ['L GPL (PCI)', 7.08],
  ['m³ gaz naturel (PCS)', 10.5],
  ['kWh PCS → kWh PCI', 0.9],
];

function EnergyConverter() {
  const [val, setVal] = useState<number | undefined>(1);
  const [from, setFrom] = useState('tep (tonne équivalent pétrole)');
  const kwh = (val ?? 0) * (ENERGY_UNITS.find(([u]) => u === from)?.[1] ?? 1);
  return (
    <Card title="Conversions d’énergie">
      <div className="form-grid">
        <Field label="Valeur"><NumberInput value={val} onChange={setVal} /></Field>
        <Field label="Unité">
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {ENERGY_UNITS.map(([u]) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
      </div>
      <table style={{ marginTop: 12 }}>
        <tbody>
          <tr><td>kWh</td><td className="num">{fmt(kwh, 2)}</td></tr>
          <tr><td>MWh</td><td className="num">{fmt(kwh / 1000, 4)}</td></tr>
          <tr><td>GJ</td><td className="num">{fmt(kwh / 277.778, 4)}</td></tr>
          <tr><td>tep</td><td className="num">{fmt(kwh / 11630, 5)}</td></tr>
        </tbody>
      </table>
    </Card>
  );
}
