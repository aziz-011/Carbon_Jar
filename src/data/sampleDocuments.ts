/**
 * Documents d'exemple (contenu fictif) au format des pièces tunisiennes courantes.
 * Ils servent à montrer la chaîne complète « téléversement → classement → inventaire »
 * et de jeux d'essai pour les tests. Ils ne contiennent aucune donnée réelle.
 */
export const SAMPLE_DOCUMENTS: Array<{ name: string; text: string }> = [
  {
    name: 'EXEMPLE_facture_STEG_electricite_avril_2025.txt',
    text: `SOCIÉTÉ TUNISIENNE DE L'ÉLECTRICITÉ ET DU GAZ (STEG)
FACTURE D'ÉLECTRICITÉ — Moyenne tension
Facture N° : 2025-04-778812
Date de facture : 05/05/2025
Client : Usine de Sfax
Période de consommation : du 01/04/2025 au 30/04/2025
Ancien index : 1 254 300   Nouvel index : 1 570 900
Énergie active consommée : 316 600 kWh
Prix unitaire : 0,291 DT/kWh
Redevance de puissance : 2 450,000 DT
Total HT : 94 580,600 DT
TVA 19 % : 17 970,314 DT
Net à payer : 112 550,914 DT`,
  },
  {
    name: 'EXEMPLE_facture_STEG_gaz_mars_2025.txt',
    text: `STEG — FACTURE GAZ NATUREL
Facture N° : G-2025-0332
Date de facture : 04/04/2025
Période : du 01/03/2025 au 31/03/2025
Consommation : 41 250 thermies
Net à payer : 3 712,500 DT`,
  },
  {
    name: 'EXEMPLE_ticket_Agil_gasoil.txt',
    text: `AGIL — Station Sfax Route de Tunis
TICKET N° 004512
Date : 18/04/2025 10:42
Produit : GASOIL 50 ppm
Quantité : 85,40 L
Prix : 2,205 DT/L
Montant : 188,307 DT
Véhicule : 145 TU 2231`,
  },
  {
    name: 'EXEMPLE_carte_grise_145TU2231.txt',
    text: `RÉPUBLIQUE TUNISIENNE — MINISTÈRE DU TRANSPORT
CERTIFICAT D'IMMATRICULATION (CARTE GRISE)
Numéro d'immatriculation : 145 TU 2231
Date de première mise en circulation : 12/03/2021
Marque : ISUZU
Type commercial : D-MAX
Genre : VU   Carrosserie : Camionnette
Énergie : GASOIL
Puissance fiscale : 9 CV
N° de série : MPATFS86JMT001234`,
  },
  {
    name: 'EXEMPLE_fiche_technique_ISUZU_DMAX.txt',
    text: `FICHE TECHNIQUE — ISUZU D-MAX 1.9 Ddi
Immatriculation : 145 TU 2231
Carburant : Gasoil
Consommation mixte (WLTP) : 8,1 l/100 km
Émissions de CO2 : 212 g/km`,
  },
  {
    name: 'EXEMPLE_facture_SONEDE_T1_2025.txt',
    text: `SONEDE — Facture eau potable
Facture N° : 77120
Période : du 01/01/2025 au 31/03/2025
Consommation : 1 240 m3
Net à payer : 1 980,450 DT`,
  },
  {
    name: 'EXEMPLE_billet_Tunisair_TUN_CDG.txt',
    text: `TUNISAIR — E-TICKET / ITINÉRAIRE
Billet N° : 199-2401234567
Vol TU 712  TUN - CDG  12/05/2025
Vol TU 713  CDG - TUN  16/05/2025
Montant total : 1 245,000 DT`,
  },
  {
    name: 'EXEMPLE_rapport_intervention_climatisation.txt',
    text: `RAPPORT D'INTERVENTION — CLIMATISATION
Contrôle d'étanchéité et recharge
Installation : Groupe froid atelier
Fluide frigorigène : R-404A
Charge nominale : 45 kg
Recharge effectuée : 9 kg
Date : 22/06/2025`,
  },
  {
    name: 'EXEMPLE_bordereau_dechets_BSD-2025-114.txt',
    text: `BORDEREAU DE SUIVI DES DÉCHETS N° : BSD-2025-114
Nature : Déchets industriels banals (DIB)
Quantité enlevée : 12,6 tonnes
Destination : Centre d'enfouissement technique
Date d'enlèvement : 30/06/2025`,
  },
];
