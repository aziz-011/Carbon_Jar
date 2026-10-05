import type { Activity, DocType, DocumentRecord, ExtractedLine, Extraction, Vehicle } from '../domain/types';

/**
 * Pièces justificatives fictives de l'exercice 2025 du client de démonstration, telles qu'elles
 * auraient été déposées sur le portail puis vérifiées par le cabinet : factures STEG mensuelles
 * (électricité, gaz), relevés de cartes carburant par véhicule, cartes grises, registres de fluides,
 * factures SONEDE, bordereaux de déchets, billets d'avion et extraction des achats.
 * Chaque pièce porte ses données d'activité (piste d'audit complète).
 */

const YEAR = 2025;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (m: number) => new Date(Date.UTC(YEAR, m + 1, 0)).getUTCDate();
const iso = (m: number, d: number) => `${YEAR}-${pad(m + 1)}-${pad(d)}`;
const r = (v: number, dec = 0) => Math.round(v * 10 ** dec) / 10 ** dec;
/** Répartit un total selon des poids, en gardant la somme exacte. */
function split(total: number, weights: number[], dec = 0): number[] {
  const s = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => r((total * w) / s, dec));
  out[out.length - 1] = r(total - out.slice(0, -1).reduce((a, b) => a + b, 0), dec);
  return out;
}

/** Profils saisonniers : climatisation l'été pour l'électricité, chauffage l'hiver pour le gaz. */
const ELEC_SEASON = [0.9, 0.86, 0.9, 0.93, 1.0, 1.12, 1.22, 1.24, 1.1, 0.97, 0.89, 0.87];
const GAS_SEASON = [1.12, 1.08, 1.02, 0.97, 0.94, 0.92, 0.9, 0.9, 0.96, 1.02, 1.07, 1.1];
const FUEL_SEASON = [0.95, 0.93, 1.02, 1.0, 1.04, 1.03, 0.96, 0.84, 1.05, 1.06, 1.05, 1.07];

export const DEMO_FLEET: Vehicle[] = [
  { id: 'v1', plate: '210 TU 4512', make: 'IVECO', model: 'Eurocargo 120E25', energy: 'gasoil', fiscalPower: 18, firstRegistration: '2019-03-14', consumptionL100: 22, co2gkm: 590, annualKm: 62000, entityId: 'usine', documentIds: [] },
  { id: 'v4', plate: '197 TU 6630', make: 'MAN', model: 'TGM 18.250', energy: 'gasoil', fiscalPower: 20, firstRegistration: '2017-09-02', consumptionL100: 25, co2gkm: 670, annualKm: 50000, entityId: 'usine', documentIds: [] },
  { id: 'v5', plate: '224 TU 1185', make: 'ISUZU', model: 'NPR 75', energy: 'gasoil', fiscalPower: 12, firstRegistration: '2021-06-21', consumptionL100: 14, co2gkm: 375, annualKm: 73500, entityId: 'usine', documentIds: [] },
  { id: 'v2', plate: '188 TU 903', make: 'RENAULT', model: 'Master L2H2', energy: 'gasoil', fiscalPower: 10, firstRegistration: '2016-11-08', consumptionL100: 9.5, co2gkm: 250, annualKm: 41000, entityId: 'usine', documentIds: [] },
  { id: 'v3', plate: '231 TU 77', make: 'PEUGEOT', model: '308 PureTech 130', energy: 'essence', fiscalPower: 7, firstRegistration: '2022-01-17', consumptionL100: 6.4, co2gkm: 146, annualKm: 23000, entityId: 'siege', documentIds: [] },
];

interface Built {
  documents: DocumentRecord[];
  activities: Activity[];
  vehicles: Vehicle[];
}

export function buildDemoDocuments(): Built {
  const documents: DocumentRecord[] = [];
  const activities: Activity[] = [];
  const vehicles = DEMO_FLEET.map((v) => ({ ...v, documentIds: [] as string[] }));
  let n = 0;

  interface LineSpec extends ExtractedLine {
    factorId: string;
    quantity: number;
    vehicleId?: string;
  }
  const add = (spec: {
    name: string;
    docType: DocType;
    requestId: string;
    entityId: string;
    supplier: string;
    number: string;
    date: string;
    start?: string;
    end?: string;
    lines: LineSpec[];
    text: string;
    vehicle?: Extraction['vehicle'];
    vehicleId?: string;
    mime?: string;
    note?: string;
    quality?: Activity['quality'];
  }) => {
    const id = `demo-doc-${++n}`;
    const totalAmount = spec.lines.reduce((s, l) => s + (l.amount ?? 0), 0) || undefined;
    const extraction: Extraction = {
      docType: spec.docType,
      method: spec.mime?.startsWith('image/') ? 'ia' : 'texte',
      supplier: spec.supplier,
      documentNumber: spec.number,
      date: spec.date,
      periodStart: spec.start,
      periodEnd: spec.end,
      totalAmount: totalAmount && r(totalAmount, 3),
      currency: 'TND',
      lines: spec.lines.map(({ vehicleId: _v, ...l }) => l),
      vehicle: spec.vehicle,
      confidence: 0.94,
      warnings: [],
    };
    const ids: string[] = [];
    for (const l of spec.lines) {
      const aid = `${id}-a${ids.length + 1}`;
      ids.push(aid);
      activities.push({
        id: aid,
        year: YEAR,
        entityId: spec.entityId,
        factorId: l.factorId,
        quantity: l.quantity,
        cost: l.amount,
        description: `${l.description} — ${spec.supplier}`,
        quality: spec.quality ?? 2,
        evidence: `${spec.supplier} n° ${spec.number} — ${spec.name}`,
        periodStart: l.periodStart ?? spec.start,
        periodEnd: l.periodEnd ?? spec.end,
        documentId: id,
        vehicleId: l.vehicleId,
      });
    }
    const uploaded = new Date(Date.parse(`${spec.date}T09:00:00Z`) + 6 * 86_400_000);
    documents.push({
      id,
      name: spec.name,
      size: 48_000 + ((n * 7919) % 160_000),
      mime: spec.mime ?? 'application/pdf',
      uploadedAt: (uploaded.getTime() > Date.now() ? new Date() : uploaded).toISOString(),
      entityId: spec.entityId,
      year: YEAR,
      status: 'valide',
      text: spec.text,
      extraction,
      activityIds: ids,
      vehicleId: spec.vehicleId,
      sample: true,
      source: 'client',
      requestId: spec.requestId,
      checks: [],
      clientNote: spec.note,
    });
    if (spec.vehicleId) vehicles.find((v) => v.id === spec.vehicleId)?.documentIds.push(id);
    return id;
  };

  // ── Scope 2 : électricité STEG moyenne tension (usine), mensuelle ──
  const elecUsine = split(3_648_000, ELEC_SEASON);
  elecUsine.forEach((kwh, m) => {
    const posts = split(kwh, [0.46, 0.17, 0.12, 0.25]);
    const amount = r(kwh * 0.298, 3);
    add({
      name: `STEG_MT_Usine-Sfax_${YEAR}-${pad(m + 1)}.pdf`,
      docType: 'facture_electricite',
      requestId: 'electricite',
      entityId: 'usine',
      supplier: 'STEG',
      number: `MT-0451-${YEAR}${pad(m + 1)}`,
      date: iso(m === 11 ? 11 : m + 1, m === 11 ? 31 : 8),
      start: iso(m, 1),
      end: iso(m, lastDay(m)),
      lines: [{ description: 'Énergie active — moyenne tension', quantity: kwh, unit: 'kWh', amount, factorId: 'elec_TN', confidence: 0.97 }],
      text: `STEG — Société Tunisienne de l'Électricité et du Gaz\nFacture moyenne tension n° MT-0451-${YEAR}${pad(m + 1)}\nClient : ChimieDémo Tunisie SA — Usine de Sfax, Route de Gabès km 6\nPériode : 01/${pad(m + 1)}/${YEAR} au ${lastDay(m)}/${pad(m + 1)}/${YEAR} (${MONTHS[m]} ${YEAR})\nÉnergie active — Jour : ${posts[0]} kWh | Pointe : ${posts[1]} kWh | Soir : ${posts[2]} kWh | Nuit : ${posts[3]} kWh\nTotal énergie active : ${kwh} kWh\nMontant TTC : ${amount.toFixed(3)} DT`,
    });
  });

  // ── Scope 2 : électricité STEG basse tension (siège), bimestrielle ──
  split(220_000, [0.9, 0.92, 1.08, 1.22, 0.98, 0.9]).forEach((kwh, i) => {
    const m0 = i * 2;
    const amount = r(kwh * 0.336, 3);
    add({
      name: `STEG_BT_Siege-Tunis_${YEAR}-B${i + 1}.pdf`,
      docType: 'facture_electricite',
      requestId: 'electricite',
      entityId: 'siege',
      supplier: 'STEG',
      number: `BT-7720-${YEAR}${pad(i + 1)}`,
      date: iso(Math.min(m0 + 2, 11), m0 + 2 > 11 ? 31 : 10),
      start: iso(m0, 1),
      end: iso(m0 + 1, lastDay(m0 + 1)),
      lines: [{ description: 'Énergie active — basse tension', quantity: kwh, unit: 'kWh', amount, factorId: 'elec_TN', confidence: 0.96 }],
      text: `STEG — Facture basse tension n° BT-7720-${YEAR}${pad(i + 1)}\nSiège social, Les Berges du Lac, Tunis\nPériode : ${MONTHS[m0]} – ${MONTHS[m0 + 1]} ${YEAR}\nConsommation : ${kwh} kWh\nNet à payer : ${amount.toFixed(3)} DT`,
    });
  });

  // ── Scope 1 : gaz naturel STEG (chaudières vapeur), mensuel ──
  split(4_992_000, GAS_SEASON).forEach((kwh, m) => {
    const amount = r(kwh * 0.0904, 3);
    add({
      name: `STEG_Gaz_Usine-Sfax_${YEAR}-${pad(m + 1)}.pdf`,
      docType: 'facture_gaz',
      requestId: 'combustibles',
      entityId: 'usine',
      supplier: 'STEG',
      number: `GN-3307-${YEAR}${pad(m + 1)}`,
      date: iso(m === 11 ? 11 : m + 1, m === 11 ? 31 : 12),
      start: iso(m, 1),
      end: iso(m, lastDay(m)),
      lines: [{ description: 'Gaz naturel — chaudières vapeur', quantity: kwh, unit: 'kWh PCS', amount, factorId: 'ng_kwh', confidence: 0.95 }],
      text: `STEG — Facture gaz naturel n° GN-3307-${YEAR}${pad(m + 1)}\nUsine de Sfax — poste de détente HP\nPériode : ${MONTHS[m]} ${YEAR}\nVolume : ${r(kwh / 10.6)} Nm3 — PCS 10,6 kWh/Nm3\nÉnergie : ${kwh} kWh PCS\nMontant TTC : ${amount.toFixed(3)} DT`,
    });
  });

  // ── Scope 1 : GPL des chariots élévateurs, livraisons trimestrielles ──
  split(6_500, [1.02, 0.98, 0.94, 1.06]).forEach((l, q) => {
    const amount = r(l * 1.5, 3);
    add({
      name: `Livraison_GPL_Chariots_T${q + 1}-${YEAR}.pdf`,
      docType: 'facture_gaz',
      requestId: 'combustibles',
      entityId: 'usine',
      supplier: 'Total Énergies Tunisie',
      number: `GPL-${YEAR}-${410 + q}`,
      date: iso(q * 3 + 2, 20),
      start: iso(q * 3, 1),
      end: iso(q * 3 + 2, lastDay(q * 3 + 2)),
      lines: [{ description: 'GPL carburation — chariots élévateurs', quantity: l, unit: 'L', amount, factorId: 'lpg_forklift', confidence: 0.92 }],
      text: `Bon de livraison GPL — trimestre ${q + 1} ${YEAR}\nUsine de Sfax — 8 chariots élévateurs\nQuantité livrée : ${l} litres\nMontant : ${amount.toFixed(3)} DT`,
    });
  });

  // ── Scope 1 : gasoil du groupe électrogène ──
  add({
    name: `Livraison_Gasoil_Groupe-electrogene_${YEAR}.pdf`,
    docType: 'facture_carburant',
    requestId: 'combustibles',
    entityId: 'usine',
    supplier: 'Agil',
    number: `AG-GE-${YEAR}-07`,
    date: iso(6, 15),
    start: iso(0, 1),
    end: iso(11, 31),
    lines: [{ description: 'Gasoil — groupe électrogène (essais et secours)', quantity: 1_800, unit: 'L', amount: 3_969, factorId: 'generator_diesel', confidence: 0.9 }],
    text: `Agil — Facture n° AG-GE-${YEAR}-07\nLivraison gasoil en cuve, groupe électrogène 800 kVA\nQuantité : 1 800 L — Prix : 2,205 DT/L\nTotal : 3 969,000 DT`,
    note: 'Une seule livraison sur l’année : la cuve couvre les essais mensuels.',
  });

  // ── Scope 1 : relevés mensuels des cartes carburant, une ligne par véhicule ──
  const perVehicle = vehicles.map((v) => ({ v, litres: split(r(((v.annualKm ?? 0) * (v.consumptionL100 ?? 0)) / 100), FUEL_SEASON, 1) }));
  for (let m = 0; m < 12; m++) {
    const lines: LineSpec[] = perVehicle.map(({ v, litres }) => {
      const diesel = v.energy === 'gasoil';
      const price = diesel ? 2.205 : 2.525;
      return {
        description: `${diesel ? 'Gasoil' : 'Essence sans plomb'} — ${v.make} ${v.model} (${v.plate})`,
        quantity: litres[m],
        unit: 'L',
        amount: r(litres[m] * price, 3),
        factorId: diesel ? 'diesel_vehicle' : 'petrol_vehicle',
        confidence: 0.96,
        plate: v.plate,
        periodStart: iso(m, 1),
        periodEnd: iso(m, lastDay(m)),
        vehicleId: v.id,
      };
    });
    const rows = lines.map((l) => `${l.plate};${l.description.split(' — ')[0]};${String(l.quantity).replace('.', ',')};${l.amount!.toFixed(3).replace('.', ',')}`);
    add({
      name: `Releve_Cartes-Agil_${YEAR}-${pad(m + 1)}.xlsx`,
      docType: 'facture_carburant',
      requestId: 'carburant',
      entityId: 'usine',
      supplier: 'Agil — cartes carburant',
      number: `RLV-${YEAR}${pad(m + 1)}`,
      date: iso(m === 11 ? 11 : m + 1, m === 11 ? 31 : 5),
      start: iso(m, 1),
      end: iso(m, lastDay(m)),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lines,
      text: `Relevé des cartes carburant — ${MONTHS[m]} ${YEAR}\nImmatriculation;Produit;Litres;Montant TND\n${rows.join('\n')}`,
    });
  }

  // ── Scope 1 : cartes grises de la flotte ──
  for (const v of vehicles) {
    add({
      name: `Carte-grise_${v.plate.replace(/\s+/g, '-')}.jpg`,
      docType: 'carte_grise',
      requestId: 'vehicules',
      entityId: v.entityId,
      supplier: 'Ministère du Transport',
      number: v.plate,
      date: v.firstRegistration ?? iso(0, 1),
      mime: 'image/jpeg',
      lines: [],
      vehicle: { plate: v.plate, make: v.make, model: v.model, energy: v.energy, fiscalPower: v.fiscalPower, firstRegistration: v.firstRegistration, consumptionL100: v.consumptionL100, co2gkm: v.co2gkm },
      vehicleId: v.id,
      text: `Certificat d'immatriculation — ${v.plate}\nMarque : ${v.make} — Type : ${v.model}\nÉnergie : ${v.energy} — Puissance fiscale : ${v.fiscalPower} CV\nDate de 1re mise en circulation : ${v.firstRegistration}`,
    });
  }

  // ── Scope 1 : fluides frigorigènes ──
  add({
    name: `Rapport-intervention_Groupe-froid_R404A_${YEAR}.pdf`,
    docType: 'registre_fluides',
    requestId: 'climatisation',
    entityId: 'usine',
    supplier: 'Froid Industriel du Sud',
    number: `FIS-${YEAR}-118`,
    date: iso(6, 24),
    start: iso(0, 1),
    end: iso(11, 31),
    lines: [{ description: 'Recharge groupe froid R-404A (fuite)', quantity: 9, unit: 'kg', amount: 1_350, factorId: 'refrigerant_R-404A', confidence: 0.93 }],
    text: `Rapport d'intervention n° FIS-${YEAR}-118\nGroupe froid de la salle de stockage — fluide R-404A\nCharge nominale : 45 kg — Quantité rechargée : 9 kg\nCause : fuite sur raccord, réparée`,
  });
  add({
    name: `Registre-fluides_Climatisation-siege_${YEAR}.pdf`,
    docType: 'registre_fluides',
    requestId: 'climatisation',
    entityId: 'siege',
    supplier: 'Clim Services Tunis',
    number: `CST-${YEAR}-042`,
    date: iso(7, 5),
    start: iso(0, 1),
    end: iso(11, 31),
    lines: [{ description: 'Recharge climatisation bureaux R-410A', quantity: 4, unit: 'kg', amount: 520, factorId: 'refrigerant_R-410A', confidence: 0.93 }],
    text: `Registre des fluides frigorigènes — siège\nSplits et VRV — fluide R-410A\nRecharge ${YEAR} : 4 kg`,
  });

  // ── Scope 3 : eau SONEDE, trimestrielle ──
  split(18_500, [0.92, 1.0, 1.14, 0.94]).forEach((m3, q) => {
    const amount = r(m3 * 1.52, 3);
    add({
      name: `SONEDE_Usine-Sfax_T${q + 1}-${YEAR}.pdf`,
      docType: 'facture_eau',
      requestId: 'eau',
      entityId: 'usine',
      supplier: 'SONEDE',
      number: `SD-${YEAR}-${880 + q}`,
      date: iso(q * 3 + 2, 28),
      start: iso(q * 3, 1),
      end: iso(q * 3 + 2, lastDay(q * 3 + 2)),
      lines: [{ description: 'Eau potable', quantity: m3, unit: 'm³', amount, factorId: 'water', confidence: 0.95 }],
      text: `SONEDE — Facture n° SD-${YEAR}-${880 + q}\nTrimestre ${q + 1} ${YEAR}\nConsommation : ${m3} m3\nMontant : ${amount.toFixed(3)} DT`,
    });
  });

  // ── Scope 3 : déchets, bordereaux trimestriels ──
  const landfill = split(87, [1, 1, 1, 1]);
  const recycled = split(53, [0.9, 1, 1.05, 1.05]);
  for (let q = 0; q < 4; q++) {
    add({
      name: `Bordereaux-dechets_T${q + 1}-${YEAR}.pdf`,
      docType: 'bordereau_dechets',
      requestId: 'dechets',
      entityId: 'usine',
      supplier: 'ANGed — collecteur agréé',
      number: `BSD-${YEAR}-${q + 1}`,
      date: iso(q * 3 + 2, 30),
      start: iso(q * 3, 1),
      end: iso(q * 3 + 2, lastDay(q * 3 + 2)),
      lines: [
        { description: 'Déchets industriels banals — décharge contrôlée', quantity: landfill[q], unit: 't', amount: r(landfill[q] * 95, 3), factorId: 'waste_landfill', confidence: 0.92 },
        { description: 'Cartons, plastiques et métaux — recyclage', quantity: recycled[q], unit: 't', amount: r(recycled[q] * 40, 3), factorId: 'waste_recycling', confidence: 0.92 },
      ],
      text: `Bordereaux de suivi des déchets — trimestre ${q + 1} ${YEAR}\nDIB en décharge : ${landfill[q]} t\nRecyclage : ${recycled[q]} t`,
    });
  }

  // ── Scope 3 : déplacements professionnels (agence de voyage) ──
  const trips = [
    { m: 1, route: 'Tunis – Paris – Tunis', pkm: 3_000, pax: 14, nights: 32 },
    { m: 4, route: 'Tunis – Milan – Tunis', pkm: 1_800, pax: 26, nights: 40 },
    { m: 8, route: 'Tunis – Francfort – Tunis', pkm: 3_400, pax: 12, nights: 30 },
    { m: 10, route: 'Tunis – Istanbul – Tunis', pkm: 3_300, pax: 6, nights: 18 },
  ];
  trips.forEach((t, i) => {
    const pkm = t.pkm * t.pax;
    add({
      name: `Agence-voyage_Facture_${YEAR}-${pad(t.m + 1)}.pdf`,
      docType: 'billet_transport',
      requestId: 'deplacements',
      entityId: 'siege',
      supplier: 'Voyages Carthage',
      number: `VC-${YEAR}-${305 + i}`,
      date: iso(t.m, 18),
      start: iso(t.m, 1),
      end: iso(t.m, lastDay(t.m)),
      lines: [
        { description: `Vols ${t.route} (${t.pax} passagers)`, quantity: pkm, unit: 'p.km', amount: r(t.pax * 1_150, 3), factorId: 'flight_medium', confidence: 0.9 },
        { description: 'Nuitées d’hôtel', quantity: t.nights, unit: 'nuit', amount: r(t.nights * 260, 3), factorId: 'hotel_night', confidence: 0.9 },
      ],
      text: `Voyages Carthage — Facture n° VC-${YEAR}-${305 + i}\n${t.route} — ${t.pax} billets (classe économique)\nDistance aller-retour : ${t.pkm} km\nHébergement : ${t.nights} nuitées`,
    });
  });

  // ── Scope 3 : extraction des achats (ERP) ──
  add({
    name: `Extraction-achats-ERP_${YEAR}.xlsx`,
    docType: 'facture_achat',
    requestId: 'achats',
    entityId: 'usine',
    supplier: 'ERP — service achats',
    number: `ACH-${YEAR}`,
    date: iso(11, 31),
    start: iso(0, 1),
    end: iso(11, 31),
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    quality: 3,
    lines: [
      { description: 'Matières premières pétrochimiques', quantity: 2_016_000, unit: 'kg', amount: 5_846_400, factorId: 'petrochem', confidence: 0.88 },
      { description: 'Acier (cuves, tuyauterie)', quantity: 120_000, unit: 'kg', amount: 540_000, factorId: 'steel', confidence: 0.88 },
      { description: 'Emballages carton', quantity: 85_000, unit: 'kg', amount: 212_500, factorId: 'paper', confidence: 0.86 },
    ],
    text: `Extraction des achats ${YEAR} — top fournisseurs\nFamille;Quantité;Unité;Montant TND\nPétrochimie;2016000;kg;5846400\nAcier;120000;kg;540000\nCarton;85000;kg;212500`,
    note: 'Les achats de moins de 5 000 DT ne sont pas inclus dans l’extraction.',
  });

  return { documents, activities, vehicles };
}
