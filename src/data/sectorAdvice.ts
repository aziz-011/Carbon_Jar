import type { IconName } from '../components/Icon';
import type { Scope, Sector } from '../domain/types';

/**
 * Directives de réduction propres à chaque type d'entreprise, présentées au client
 * en complément des leviers calculés à partir de ses propres données.
 */
export interface SectorTip {
  title: string;
  scope: Scope;
  icon: IconName;
  why: string;
  actions: string[];
  impact: 'fort' | 'moyen' | 'faible';
  /** Délai de mise en œuvre indicatif. */
  horizon: 'court terme' | 'moyen terme' | 'long terme';
}

export const SECTOR_LABELS: Record<Sector, string> = {
  industrie: 'Industrie manufacturière',
  chimie: 'Industrie chimique',
  agroalimentaire: 'Agroalimentaire',
  sante: 'Santé / établissement de soins',
  universite: 'Enseignement / université',
  services: 'Services / bureaux',
  commerce: 'Commerce / distribution',
  transport: 'Transport / logistique',
  autre: 'Entreprise',
};

const COMMON: SectorTip[] = [
  {
    title: 'Mesurer et suivre l’énergie chaque mois',
    scope: 2,
    icon: 'gauge',
    why: 'On ne réduit bien que ce que l’on mesure : un suivi mensuel des factures révèle vite les dérives.',
    actions: ['Déposer chaque facture STEG dès réception sur le portail.', 'Désigner un référent énergie dans l’entreprise.', 'Fixer un budget annuel en kWh et en dinars.'],
    impact: 'moyen',
    horizon: 'court terme',
  },
  {
    title: 'Produire votre électricité solaire',
    scope: 2,
    icon: 'zap',
    why: 'Avec 1 600 à 1 800 kWh produits par kWc et par an en Tunisie, le photovoltaïque en autoconsommation est rentable en quelques années.',
    actions: ['Faire étudier vos toitures et parkings.', 'Se renseigner sur le cadre de l’autoproduction (loi n° 2015-12) et l’accompagnement de l’ANME.'],
    impact: 'fort',
    horizon: 'moyen terme',
  },
];

export const SECTOR_TIPS: Record<Sector, SectorTip[]> = {
  industrie: [
    { title: 'Récupérer la chaleur des procédés', scope: 1, icon: 'flame', why: 'Fours, compresseurs et groupes froid rejettent une chaleur réutilisable pour préchauffer l’eau ou l’air.', actions: ['Installer des échangeurs sur les fumées et les compresseurs.', 'Calorifuger les réseaux de vapeur et réparer les purgeurs.'], impact: 'fort', horizon: 'moyen terme' },
    { title: 'Moteurs et air comprimé efficaces', scope: 2, icon: 'zap', why: 'Les moteurs représentent souvent plus de la moitié de l’électricité d’une usine ; l’air comprimé fuit jusqu’à 30 %.', actions: ['Équiper les moteurs de variateurs de vitesse.', 'Faire une campagne de détection des fuites d’air comprimé.', 'Couper les machines à vide en dehors de la production.'], impact: 'fort', horizon: 'court terme' },
    { title: 'Acheter des matières moins carbonées', scope: 3, icon: 'cart', why: 'Les matières premières pèsent souvent plus que l’énergie dans l’empreinte totale.', actions: ['Privilégier l’acier et l’aluminium recyclés.', 'Demander aux fournisseurs leur empreinte carbone.', 'Réduire les chutes et rebuts de fabrication.'], impact: 'fort', horizon: 'moyen terme' },
    ...COMMON,
  ],
  chimie: [
    { title: 'Optimiser chaudières et vapeur', scope: 1, icon: 'flame', why: 'La vapeur est le premier poste énergétique des sites chimiques.', actions: ['Régler la combustion (analyse annuelle).', 'Récupérer les condensats et la chaleur des purges.', 'Calorifuger vannes et brides.'], impact: 'fort', horizon: 'court terme' },
    { title: 'Réduire les émissions des réactions', scope: 1, icon: 'factory', why: 'Certaines réactions émettent du CO2 ou du N2O (acide nitrique, adipique).', actions: ['Installer des catalyseurs de destruction du N2O.', 'Optimiser les rendements de réaction pour limiter les sous-produits.'], impact: 'fort', horizon: 'long terme' },
    { title: 'Matières premières et solvants', scope: 3, icon: 'cart', why: 'Les intrants pétrochimiques représentent souvent la moitié de l’empreinte.', actions: ['Recycler et régénérer les solvants.', 'Étudier des matières biosourcées.', 'Engager les fournisseurs sur leurs émissions.'], impact: 'fort', horizon: 'moyen terme' },
    ...COMMON,
  ],
  agroalimentaire: [
    { title: 'Maîtriser le froid et ses fuites', scope: 1, icon: 'snowflake', why: 'Les fluides frigorigènes (R-404A) ont un pouvoir de réchauffement des milliers de fois supérieur au CO2.', actions: ['Contrôler l’étanchéité des installations chaque trimestre.', 'Passer aux fluides naturels (CO2, propane) lors du renouvellement.', 'Fermer portes et rideaux des chambres froides.'], impact: 'fort', horizon: 'moyen terme' },
    { title: 'Chauffer et cuire plus efficacement', scope: 1, icon: 'flame', why: 'Fours, cuiseurs et nettoyage consomment beaucoup de gaz.', actions: ['Récupérer la chaleur des groupes froid pour l’eau chaude.', 'Isoler les cuves et réseaux d’eau chaude.'], impact: 'moyen', horizon: 'court terme' },
    { title: 'Réduire le gaspillage et les emballages', scope: 3, icon: 'recycle', why: 'Chaque produit perdu porte toute l’empreinte de sa fabrication.', actions: ['Suivre les pertes par ligne de production.', 'Valoriser les déchets organiques (compost, méthanisation).', 'Alléger les emballages plastiques.'], impact: 'moyen', horizon: 'court terme' },
    ...COMMON,
  ],
  sante: [
    { title: 'Climatisation et ventilation des blocs', scope: 2, icon: 'snowflake', why: 'Le traitement d’air fonctionne en continu et pèse lourd sur la facture électrique.', actions: ['Réduire les débits la nuit dans les zones non critiques.', 'Entretenir filtres et échangeurs.', 'Suivre les fuites de fluides des climatiseurs.'], impact: 'fort', horizon: 'court terme' },
    { title: 'Gaz anesthésiques et groupes de secours', scope: 1, icon: 'shield', why: 'Certains gaz médicaux ont un fort pouvoir de réchauffement ; les groupes électrogènes brûlent du gazole.', actions: ['Privilégier les gaz à faible impact et les circuits fermés.', 'Optimiser les essais réglementaires des groupes.'], impact: 'moyen', horizon: 'moyen terme' },
    { title: 'Achats et déchets de soins', scope: 3, icon: 'cart', why: 'Médicaments, consommables et déchets représentent la majorité de l’empreinte d’un établissement.', actions: ['Trier rigoureusement les déchets (DASRI vs déchets ordinaires).', 'Préférer le réutilisable stérilisable quand c’est possible.'], impact: 'moyen', horizon: 'moyen terme' },
    ...COMMON,
  ],
  universite: [
    { title: 'Bâtiments et salles de cours', scope: 2, icon: 'building', why: 'Éclairage et climatisation de grands volumes souvent inoccupés.', actions: ['Passer en LED avec détection de présence.', 'Programmer la climatisation selon l’emploi du temps.'], impact: 'fort', horizon: 'court terme' },
    { title: 'Mobilité des étudiants et du personnel', scope: 3, icon: 'car', why: 'Les trajets quotidiens forment souvent le premier poste d’un campus.', actions: ['Négocier des navettes et abonnements de transport.', 'Organiser le covoiturage.', 'Développer les cours à distance quand c’est pertinent.'], impact: 'fort', horizon: 'moyen terme' },
    { title: 'Numérique et data centers', scope: 2, icon: 'zap', why: 'Les serveurs de recherche fonctionnent jour et nuit.', actions: ['Mutualiser les serveurs.', 'Allonger la durée de vie des ordinateurs.'], impact: 'moyen', horizon: 'moyen terme' },
    ...COMMON,
  ],
  services: [
    { title: 'Bureaux sobres en énergie', scope: 2, icon: 'building', why: 'Climatisation, éclairage et informatique font l’essentiel de la consommation.', actions: ['Régler la climatisation à 26 °C en été.', 'Éteindre postes et écrans le soir.', 'Passer l’éclairage en LED.'], impact: 'moyen', horizon: 'court terme' },
    { title: 'Déplacements professionnels', scope: 3, icon: 'plane', why: 'Un aller-retour Tunis–Paris en avion émet environ 0,6 t CO2e par passager.', actions: ['Privilégier la visioconférence.', 'Regrouper les déplacements.', 'Voyager en classe économique.'], impact: 'fort', horizon: 'court terme' },
    { title: 'Matériel informatique', scope: 3, icon: 'briefcase', why: 'La fabrication d’un ordinateur portable émet environ 150 kg CO2e.', actions: ['Garder le matériel 5 ans ou plus.', 'Acheter du reconditionné.'], impact: 'moyen', horizon: 'moyen terme' },
    ...COMMON,
  ],
  commerce: [
    { title: 'Froid commercial', scope: 1, icon: 'snowflake', why: 'Vitrines et chambres froides : fuites de fluides et forte consommation.', actions: ['Fermer les meubles froids (portes vitrées).', 'Contrôler les fuites et passer aux fluides naturels.'], impact: 'fort', horizon: 'moyen terme' },
    { title: 'Éclairage et climatisation des magasins', scope: 2, icon: 'zap', why: 'Les surfaces de vente sont éclairées et climatisées de longues heures.', actions: ['LED et gestion horaire de l’éclairage.', 'Rideaux d’air et réglage des consignes.'], impact: 'moyen', horizon: 'court terme' },
    { title: 'Logistique et livraisons', scope: 3, icon: 'truck', why: 'Le transport des marchandises pèse dans l’empreinte.', actions: ['Mutualiser et remplir les camions.', 'Optimiser les tournées.'], impact: 'moyen', horizon: 'court terme' },
    ...COMMON,
  ],
  transport: [
    { title: 'Éco-conduite et suivi de la consommation', scope: 1, icon: 'fuel', why: 'La conduite peut faire varier la consommation de 10 à 15 %.', actions: ['Former les chauffeurs à l’éco-conduite.', 'Suivre la consommation par véhicule (cartes carburant).', 'Brider la vitesse maximale.'], impact: 'fort', horizon: 'court terme' },
    { title: 'Optimiser les tournées et le remplissage', scope: 1, icon: 'truck', why: 'Chaque kilomètre à vide est une émission sans valeur.', actions: ['Logiciel d’optimisation des tournées.', 'Réduire les retours à vide.'], impact: 'fort', horizon: 'court terme' },
    { title: 'Renouveler la flotte', scope: 1, icon: 'car', why: 'Les véhicules récents ou électriques consomment beaucoup moins.', actions: ['Électrifier les véhicules urbains.', 'Entretenir pneus et moteurs régulièrement.'], impact: 'fort', horizon: 'long terme' },
    ...COMMON,
  ],
  autre: [
    { title: 'Réduire l’énergie des bâtiments', scope: 2, icon: 'building', why: 'Climatisation et éclairage sont les premiers postes de la plupart des entreprises.', actions: ['LED et détecteurs de présence.', 'Réglage et entretien de la climatisation.'], impact: 'moyen', horizon: 'court terme' },
    { title: 'Optimiser vos véhicules', scope: 1, icon: 'car', why: 'Le carburant est souvent le premier poste direct.', actions: ['Éco-conduite et suivi des consommations.', 'Véhicules plus sobres au renouvellement.'], impact: 'moyen', horizon: 'moyen terme' },
    ...COMMON,
  ],
};
