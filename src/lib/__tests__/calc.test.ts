import { describe, expect, it } from 'vitest';
import { DEFAULT_FACTORS } from '../../data/emissionFactors';
import { refrigerantGwp } from '../../data/gwp';
import type { Activity, Entity } from '../../domain/types';
import {
  baseYearRecalculation,
  computeActivity,
  computeInventory,
  consolidationShare,
  factorKgCO2ePerUnit,
  intensityRatio,
  refrigerantMassBalance,
  targetProgress,
  targetTrajectory,
} from '../calc';

const F = new Map(DEFAULT_FACTORS.map((f) => [f.id, f]));
const org = { gwpSet: 'AR5' as const, consolidation: 'operational' as const };
const site: Entity = { id: 's', name: 'Site', equityShare: 100, financialControl: true, operationalControl: true, country: 'FR' };
const act = (factorId: string, quantity: number, extra: Partial<Activity> = {}): Activity => ({
  id: factorId, entityId: 's', year: 2025, factorId, quantity, quality: 2, ...extra,
});

describe('facteurs d’émission', () => {
  it('ont des identifiants uniques', () => {
    expect(new Set(DEFAULT_FACTORS.map((f) => f.id)).size).toBe(DEFAULT_FACTORS.length);
  });

  it('gazole routier ≈ 2,68 kg CO2e/L (GIEC 2006)', () => {
    expect(factorKgCO2ePerUnit(F.get('diesel_vehicle')!, 'AR5')).toBeCloseTo(2.69, 1);
  });

  it('gaz naturel ≈ 0,182 kg CO2e/kWh PCS', () => {
    expect(factorKgCO2ePerUnit(F.get('ng_kwh')!, 'AR5')).toBeCloseTo(0.182, 2);
  });
});

describe('PRG', () => {
  it('calcule les mélanges comme moyenne pondérée', () => {
    expect(refrigerantGwp('R-410A', 'AR5')).toBeCloseTo(1923.5, 1);
    expect(refrigerantGwp('R-404A', 'AR5')).toBeCloseTo(3942.8, 1);
    expect(refrigerantGwp('R-407C', 'AR5')).toBeCloseTo(1624.2, 1);
  });
});

describe('computeActivity', () => {
  it('Émissions = donnée d’activité × facteur d’émission, ventilées par gaz', () => {
    const r = computeActivity(act('diesel_vehicle', 1000), F.get('diesel_vehicle')!, site, org);
    expect(r.scope).toBe(1);
    expect(r.category).toBe('S1_MOBILE');
    expect(r.byGas.CO2).toBeCloseTo(2675, 0);
    expect(r.byGas.CH4! + r.byGas.N2O!).toBeGreaterThan(0);
    expect(r.energyKwh).toBeCloseTo(10030, 0);
    expect(r.cost).toBeCloseTo(1700, 0);
    expect(r.costEstimated).toBe(true);
  });

  it('fuite de 10 kg de R-410A = 10 × PRG, rangée en HFC', () => {
    const r = computeActivity(act('refrigerant_R-410A', 10), F.get('refrigerant_R-410A')!, site, org);
    expect(r.kgCO2e).toBeCloseTo(19235, 0);
    expect(r.byGas.HFC).toBeCloseTo(19235, 0);
  });

  it('R-22 (hors Kyoto) est déclaré à part, hors scopes', () => {
    const r = computeActivity(act('refrigerant_R-22', 2), F.get('refrigerant_R-22')!, site, org);
    expect(r.kgCO2e).toBe(0);
    expect(r.nonKyotoKgCO2e).toBeCloseTo(3520, 0);
  });

  it('biomasse : CO2 biogénique en poste mémo, CH4/N2O en Scope 1', () => {
    const r = computeActivity(act('wood_pellets', 1000), F.get('wood_pellets')!, site, org);
    expect(r.byGas.CO2).toBeUndefined();
    expect(r.biogenicKg).toBeCloseTo(1904, 0);
    expect(r.kgCO2e).toBeGreaterThan(0);
  });

  it('Scope 2 : location-based et market-based (GO = 0)', () => {
    const r = computeActivity(act('elec_FR', 100000, { instrument: 'eac' }), F.get('elec_FR')!, site, org);
    expect(r.kgCO2e).toBeCloseTo(5200, 0);
    expect(r.kgCO2eMarket).toBe(0);
  });

  it('Scope 2 : facteur fournisseur manquant → moyenne réseau en dernier recours', () => {
    const r = computeActivity(act('elec_FR', 1000, { instrument: 'supplier' }), F.get('elec_FR')!, site, org);
    expect(r.kgCO2eMarket).toBeCloseTo(r.kgCO2e, 6);
    expect(r.note).toMatch(/dernier recours/);
  });

  it('électricité revendue → Scope 3 cat. 3', () => {
    const r = computeActivity(act('elec_FR', 1000, { resold: true }), F.get('elec_FR')!, site, org);
    expect(r.scope).toBe(3);
    expect(r.category).toBe('S3_C3');
  });

  it('le coût saisi prime sur le prix par défaut', () => {
    const r = computeActivity(act('elec_FR', 1000, { cost: 123 }), F.get('elec_FR')!, site, org);
    expect(r.cost).toBe(123);
    expect(r.costEstimated).toBe(false);
  });
});

describe('consolidation (cas Holland Industries)', () => {
  const jv: Entity = { id: 'jv', name: 'BGB', equityShare: 50, financialControl: false, operationalControl: false, country: 'FR' };
  it('part de capital : 50 %', () => expect(consolidationShare(jv, 'equity')).toBe(0.5));
  it('contrôle opérationnel : 0 %', () => expect(consolidationShare(jv, 'operational')).toBe(0));
  it('contrôle financier : 0 %', () => expect(consolidationShare(jv, 'financial')).toBe(0));
  it('appliquée aux émissions', () => {
    const r = computeActivity({ ...act('ng_kwh', 1000), entityId: 'jv' }, F.get('ng_kwh')!, jv, { gwpSet: 'AR5', consolidation: 'equity' });
    const full = computeActivity(act('ng_kwh', 1000), F.get('ng_kwh')!, site, org);
    expect(r.kgCO2e).toBeCloseTo(full.kgCO2e / 2, 6);
  });
});

describe('inventaire', () => {
  it('agrège par scope, gaz, énergie et coût', () => {
    const inv = computeInventory(
      [act('ng_kwh', 100000), act('elec_FR', 100000, { id: 'e' } as Partial<Activity>), act('flight_short', 1000, { id: 'f' } as Partial<Activity>)],
      DEFAULT_FACTORS, [site], org, 2025,
    );
    expect(inv.scope1).toBeCloseTo(18.2, 0);
    expect(inv.scope2Location).toBeCloseTo(5.2, 1);
    expect(inv.scope3).toBeCloseTo(0.258, 3);
    expect(inv.totalLocation).toBeCloseTo(inv.scope1 + inv.scope2Location + inv.scope3, 6);
    expect(inv.energyMWh).toBeCloseTo(200, 0);
    expect(inv.byGasScope12.CO2e).toBeCloseTo(5.2, 1);
  });

  it('filtre par année', () => {
    const inv = computeInventory([act('ng_kwh', 1000, { year: 2024 })], DEFAULT_FACTORS, [site], org, 2025);
    expect(inv.results).toHaveLength(0);
  });
});

describe('formules de pilotage', () => {
  it('bilan massique des fluides', () => {
    expect(refrigerantMassBalance({ initialStock: 100, recharges: 15, finalStock: 105 })).toBe(10);
    expect(refrigerantMassBalance({ initialStock: 10, recharges: 0, finalStock: 20 })).toBe(0);
  });

  it('ratio d’intensité', () => {
    expect(intensityRatio(1000, 500)).toBe(2);
    expect(intensityRatio(1000, 0)).toBeUndefined();
  });

  it('recalcul de l’année de base au-delà du seuil', () => {
    const r = baseYearRecalculation({ baseYearEmissions: 1000, acquiredEmissions: 120, divestedEmissions: 0, methodologyDelta: 0, thresholdPct: 10 });
    expect(r.recalculate).toBe(true);
    expect(r.adjustedBase).toBe(1120);
    expect(baseYearRecalculation({ baseYearEmissions: 1000, acquiredEmissions: 50, divestedEmissions: 0, methodologyDelta: 0, thresholdPct: 10 }).recalculate).toBe(false);
  });

  it('trajectoire et avancement', () => {
    const t = targetTrajectory(1000, 2020, 2030, 50);
    expect(t.target).toBe(500);
    expect(t.points).toHaveLength(11);
    expect(t.points[5].value).toBe(750);
    expect(targetProgress(1000, 800, 50).progress).toBeCloseTo(0.4);
  });
});
