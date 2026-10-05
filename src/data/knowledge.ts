/**
 * Base de connaissances extraite des documents de référence :
 *  - « GHG – Carbon accounting » (GHG Protocol, CSRD, comptabilité carbone, scopes, ACV) ;
 *  - « Résumé GHG Protocol » (chapitres 1 à 11 et annexes du Corporate Standard) ;
 *  - « Module de formation — Scopes 1 et 2 selon le GHG Protocol » ;
 *  - « Rapport de synthèse — Le Protocole des gaz à effet de serre ».
 */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'formula'; label: string; formula: string; note?: string }
  | { kind: 'callout'; tone: 'info' | 'warn' | 'key'; title?: string; text: string }
  | { kind: 'h'; text: string };

export interface Section {
  id: string;
  title: string;
  group: 'Fondamentaux' | 'Périmètres & scopes' | 'Calcul & données' | 'Pilotage & reporting' | 'Réglementation & méthodes';
  summary: string;
  blocks: Block[];
}

export const KNOWLEDGE: Section[] = [
  {
    id: 'ghg-protocol',
    title: 'Le GHG Protocol',
    group: 'Fondamentaux',
    summary: 'Le cadre de référence mondial pour mesurer, gérer et déclarer les émissions de GES.',
    blocks: [
      { kind: 'p', text: 'Le Greenhouse Gas Protocol (GHG Protocol) est un partenariat multi-acteurs lancé en 1998 par le World Resources Institute (WRI) et le World Business Council for Sustainable Development (WBCSD), associant entreprises, ONG, gouvernements et institutions académiques. C’est le référentiel le plus utilisé au monde pour mesurer et gérer les émissions de gaz à effet de serre (GES).' },
      { kind: 'h', text: 'Pourquoi est-il la norme mondiale ?' },
      { kind: 'list', items: [
        'Utilisé par des milliers d’entreprises à travers le monde.',
        'Base de nombreux programmes nationaux et internationaux de déclaration des émissions.',
        'Méthodologies claires permettant de comparer les performances environnementales.',
        'Reconnu par les investisseurs, les autorités réglementaires et les agences de notation ESG.',
        'Socle méthodologique de CDP, GRI 305, ISO 14064-1, SBTi et de la CSRD / ESRS E1.',
      ] },
      { kind: 'h', text: 'Les principales normes' },
      { kind: 'table', head: ['Norme', 'Objet'], rows: [
        ['Corporate Accounting and Reporting Standard (2004)', 'Règles de construction d’un inventaire d’entreprise (Scopes 1, 2 et 3).'],
        ['Scope 2 Guidance (2015)', 'Amendement précisant la comptabilisation de l’électricité, de la chaleur, de la vapeur et du froid achetés.'],
        ['Scope 3 Standard', 'Émissions indirectes de toute la chaîne de valeur (15 catégories).'],
        ['Product Standard', 'Émissions d’un produit sur son cycle de vie.'],
      ] },
      { kind: 'h', text: 'Objectifs du standard' },
      { kind: 'list', ordered: true, items: [
        'Aider les entreprises à préparer un inventaire représentant une image fidèle et juste de leurs émissions.',
        'Simplifier et réduire les coûts de compilation d’un inventaire.',
        'Fournir des informations stratégiques pour gérer et réduire les émissions.',
        'Faciliter la participation aux programmes de GES volontaires ou obligatoires.',
        'Accroître la cohérence et la transparence du reporting entre entreprises et programmes.',
      ] },
      { kind: 'h', text: 'Gaz couverts' },
      { kind: 'table', head: ['Gaz', 'Formule', 'Sources typiques'], rows: [
        ['Dioxyde de carbone', 'CO2', 'Combustion, procédés'],
        ['Méthane', 'CH4', 'Fuites de gaz, décharges, fermentation'],
        ['Protoxyde d’azote', 'N2O', 'Combustion, engrais, procédés chimiques'],
        ['Hydrofluorocarbures', 'HFC', 'Climatisation, réfrigération'],
        ['Perfluorocarbures', 'PFC', 'Aluminium, semi-conducteurs'],
        ['Hexafluorure de soufre', 'SF6', 'Appareillages électriques'],
        ['Trifluorure d’azote', 'NF3', 'Électronique'],
      ] },
      { kind: 'callout', tone: 'info', text: 'Les gaz hors Kyoto (CFC, HCFC comme le R-22, NOx) ne sont pas inclus dans les scopes mais peuvent faire l’objet d’un reporting séparé. Chaque gaz est converti en CO2 équivalent (CO2e) grâce à son PRG, dont la source (rapport du GIEC) doit être déclarée.' },
    ],
  },
  {
    id: 'carbon-accounting',
    title: 'La comptabilité carbone',
    group: 'Fondamentaux',
    summary: 'Mesurer, calculer, suivre et déclarer les émissions — comme une comptabilité financière, mais en CO2e.',
    blocks: [
      { kind: 'p', text: 'La comptabilité carbone est le processus qui consiste à mesurer, calculer, suivre et déclarer les émissions de GES d’une organisation. Au lieu de suivre des flux monétaires, elle suit des flux d’émissions.' },
      { kind: 'h', text: 'Les 5 étapes' },
      { kind: 'list', ordered: true, items: [
        'Définir le périmètre organisationnel : filiales, installations et activités prises en compte.',
        'Collecter les données d’activité : gaz naturel, électricité, carburants, transport, achats de matières premières.',
        'Appliquer les facteurs d’émission : ex. 1 000 litres de gazole × facteur d’émission = émissions de CO2e.',
        'Classer les émissions en Scope 1, Scope 2 et Scope 3.',
        'Déclarer et faire vérifier les résultats (rapport de durabilité, auditeur externe).',
      ] },
      { kind: 'h', text: 'Pourquoi est-elle stratégique ?' },
      { kind: 'list', items: [
        'Réduire les coûts grâce à une meilleure efficacité énergétique.',
        'Répondre aux exigences environnementales des clients.',
        'Accéder à des financements durables.',
        'Gérer les risques liés au changement climatique (prix de l’énergie, tarification carbone).',
        'Atteindre les objectifs de neutralité carbone.',
      ] },
      { kind: 'h', text: 'De la mesure à la décision' },
      { kind: 'list', items: [
        'L’inventaire (mesure) produit des données ventilées par scope, par source et par gaz.',
        'Le reporting (communication) les traduit pour les investisseurs, régulateurs, clients et auditeurs.',
        'La stratégie climat (décision) fixe les objectifs et priorise les investissements de décarbonation.',
      ] },
      { kind: 'callout', tone: 'key', text: 'Une donnée d’inventaire non fiable fausse toute la chaîne : la rigueur méthodologique conditionne la qualité du reporting et la pertinence des décisions.' },
    ],
  },
  {
    id: 'principles',
    title: 'Les 5 principes fondamentaux',
    group: 'Fondamentaux',
    summary: 'Pertinence, exhaustivité, cohérence, transparence, exactitude : les critères de l’auditeur.',
    blocks: [
      { kind: 'p', text: 'Dérivés des pratiques comptables financières, ces principes guident toute la démarche. Ce sont les critères sur lesquels un vérificateur externe évalue la qualité d’un inventaire.' },
      { kind: 'table', head: ['Principe', 'Définition opérationnelle'], rows: [
        ['Pertinence', 'L’inventaire reflète le profil réel d’émissions et la réalité économique de l’entreprise, et répond aux besoins de décision.'],
        ['Exhaustivité', 'Toutes les sources du périmètre sont comptabilisées ; toute exclusion est justifiée et divulguée.'],
        ['Cohérence (permanence)', 'Méthodes stables dans le temps ; tout changement de périmètre, de méthode ou de donnée est documenté.'],
        ['Transparence', 'Hypothèses, sources et méthodes documentées de façon traçable (piste d’audit).'],
        ['Exactitude', 'Ni surestimation ni sous-estimation systématique ; incertitudes réduites autant que possible.'],
      ] },
      { kind: 'callout', tone: 'warn', text: 'Omettre une source Scope 1 matérielle sans justification viole l’exhaustivité ; publier un total CO2e sans détail par gaz viole la transparence.' },
      { kind: 'h', text: 'Notions clés' },
      { kind: 'list', items: [
        'Piste d’audit : documentation permettant à un tiers de vérifier l’origine des données et de recréer les calculs.',
        'Seuil de matérialité : utilisé par les vérificateurs pour juger si une omission ou une erreur est significative.',
      ] },
    ],
  },
  {
    id: 'business-goals',
    title: 'Objectifs commerciaux de l’inventaire',
    group: 'Fondamentaux',
    summary: 'Gestion des risques, reporting, conformité, marchés carbone, reconnaissance des actions précoces.',
    blocks: [
      { kind: 'table', head: ['Objectif commercial', 'Bénéfice stratégique'], rows: [
        ['Gestion des risques et opportunités', 'Identifier l’exposition aux réglementations et améliorer l’efficacité énergétique.'],
        ['Reporting public / programmes volontaires', 'Réputation, relations avec les investisseurs, registres.'],
        ['Programmes obligatoires', 'Conformité aux exigences gouvernementales.'],
        ['Marchés de GES', 'Systèmes d’échange de quotas (cap-and-trade), taxes carbone.'],
        ['Reconnaissance d’actions précoces', 'Faire valider des réductions volontaires avant l’entrée en vigueur de lois.'],
      ] },
      { kind: 'p', text: 'Exposition au risque GES : risque financier lié au coût potentiel des émissions dans le cadre de nouvelles politiques climatiques. La plateforme l’estime par : émissions × prix carbone interne.' },
      { kind: 'h', text: 'Études de cas' },
      { kind: 'list', items: [
        'IBM : à Austin (Texas), un contrat de 5,25 millions de kWh d’énergie éolienne a réduit l’inventaire du site de 4 100 t CO2/an ; ses achats d’énergie verte ont évité 31 550 t CO2 en un an.',
        'Tata Steel : suivi d’un indicateur d’intensité t CO2e / t d’acier brut pour garantir sa compétitivité sur les marchés internationaux.',
      ] },
      { kind: 'callout', tone: 'info', text: 'Approche modulaire : les données peuvent être agrégées ou désagrégées par installation, pays ou unité commerciale.' },
    ],
  },
  {
    id: 'org-boundary',
    title: 'Périmètre organisationnel',
    group: 'Périmètres & scopes',
    summary: 'Part de capital, contrôle financier ou contrôle opérationnel : quelles entités consolider ?',
    blocks: [
      { kind: 'p', text: 'Avant de comptabiliser la moindre émission, l’entreprise définit quelles entités du groupe (filiales, coentreprises, sociétés affiliées) sont incluses dans l’inventaire et à quelle hauteur.' },
      { kind: 'table', head: ['Approche', 'Règle', 'Cas type'], rows: [
        ['Part de capital (equity share)', 'Émissions au prorata de la participation économique.', 'Coentreprises multi-partenaires (JV pétrolières, minières).'],
        ['Contrôle financier', '100 % des entités dont on dirige les politiques financières et opérationnelles (périmètre IFRS).', 'Groupes cotés avec filiales majoritaires.'],
        ['Contrôle opérationnel', '100 % des opérations dont on détient l’autorité de mettre en œuvre les politiques d’exploitation.', 'Sites exploités sous bail, tolling, contrat de gestion.'],
      ] },
      { kind: 'formula', label: 'Part consolidée (approche part de capital)', formula: 'Émissions consolidées = Émissions de l’entité × % de participation' },
      { kind: 'formula', label: 'Approches par le contrôle', formula: 'Émissions consolidées = Émissions de l’entité × (1 si contrôle, 0 sinon)' },
      { kind: 'h', text: 'Avantages et limites' },
      { kind: 'list', items: [
        'Part de capital : cohérente avec la mise en équivalence ; exige l’accès aux données des participations minoritaires.',
        'Contrôle financier : aligné sur la consolidation comptable (souvent exigé par la CSRD) ; peut exclure des sites gérés sans contrôle financier (franchises).',
        'Contrôle opérationnel : couvre le périmètre où l’entreprise a le plus de leviers d’action ; peut diverger du périmètre financier.',
      ] },
      { kind: 'callout', tone: 'key', title: 'Cas Holland Industries', text: 'Pour une coentreprise détenue à 50 % (BGB), Holland Industries déclare 50 % des émissions en part de capital, mais 0 % en contrôle opérationnel si le partenaire détient seul la licence d’exploitation. En cas de contrôle financier conjoint, on applique la part de capital.' },
      { kind: 'callout', tone: 'warn', text: 'Le choix doit être documenté et appliqué uniformément dans le temps. Un changement d’approche est un événement structurel qui déclenche le recalcul de l’année de base. Si l’entreprise détient 100 % de ses opérations, le choix n’a aucun impact.' },
    ],
  },
  {
    id: 'scopes',
    title: 'Les 3 scopes et la classification',
    group: 'Périmètres & scopes',
    summary: 'Qui contrôle la source ? Est-ce un achat d’énergie ? — la logique de classement.',
    blocks: [
      { kind: 'table', head: ['Scope', 'Nature', 'Contenu'], rows: [
        ['Scope 1', 'Émissions directes', 'Sources détenues ou contrôlées : combustion fixe, combustion mobile, procédés, émissions fugitives.'],
        ['Scope 2', 'Indirectes liées à l’énergie', 'Production de l’électricité, chaleur, vapeur ou froid achetés et consommés.'],
        ['Scope 3', 'Autres indirectes', 'Reste de la chaîne de valeur, amont et aval : achats, transport, déplacements, usage et fin de vie des produits.'],
      ] },
      { kind: 'h', text: 'Logique de classification' },
      { kind: 'list', items: [
        'L’entreprise possède ou contrôle physiquement la source (chaudière, véhicule, équipement, fuite) → Scope 1.',
        'L’émission provient de la production d’une énergie achetée à un tiers (électricité, chaleur, vapeur, froid) → Scope 2.',
        'L’émission a lieu chez un tiers (fournisseur, client, transporteur), sans que l’énergie achetée en soit la cause → Scope 3.',
      ] },
      { kind: 'h', text: 'Frontières et cas particuliers' },
      { kind: 'list', items: [
        'La combustion d’un carburant dans un équipement de l’entreprise est toujours Scope 1 ; son extraction et son raffinage relèvent du Scope 3 (cat. 3).',
        'Électricité autoproduite (cogénération) : Scope 1 pour le combustible consommé, pas Scope 2.',
        'Électricité achetée puis revendue à des utilisateurs finaux : exclue du Scope 2, déclarée en Scope 3.',
        'Véhicule thermique détenu → Scope 1 ; véhicule électrique détenu → Scope 2 (électricité de recharge).',
        'CO2 de la biomasse → poste mémo hors scopes ; le CH4 et le N2O de cette combustion restent en Scope 1.',
        'Actifs loués : sous contrôle opérationnel, un bien loué dont on assure la gestion entre dans l’inventaire.',
        'Pertes en ligne (T&D) : émissions liées à l’électricité perdue dans le réseau.',
      ] },
      { kind: 'h', text: 'Exemple d’une entreprise chimique' },
      { kind: 'table', head: ['Activité', 'Scope'], rows: [
        ['Combustion de gaz naturel dans les chaudières', 'Scope 1'],
        ['Réactions chimiques générant des émissions', 'Scope 1'],
        ['Électricité achetée', 'Scope 2'],
        ['Achat de matières premières', 'Scope 3'],
        ['Déplacements domicile-travail des employés', 'Scope 3'],
        ['Transport assuré par un prestataire externe', 'Scope 3'],
        ['Utilisation et fin de vie des produits vendus', 'Scope 3'],
      ] },
      { kind: 'h', text: 'Répartition typique (industrie manufacturière et chimique)' },
      { kind: 'table', head: ['Scope', 'Part des émissions'], rows: [['Scope 1', '10 à 30 %'], ['Scope 2', '5 à 20 %'], ['Scope 3', '50 à 90 %']] },
      { kind: 'callout', tone: 'key', text: 'Le système des scopes évite le double comptage : le Scope 1 du producteur d’électricité devient le Scope 2 de l’acheteur. Les Scopes 1 et 2 doivent obligatoirement être déclarés séparément ; le Scope 3 est optionnel dans le Corporate Standard mais encouragé.' },
    ],
  },
  {
    id: 'scope1',
    title: 'Scope 1 — Émissions directes',
    group: 'Périmètres & scopes',
    summary: 'Combustion fixe, combustion mobile, émissions fugitives, procédés industriels.',
    blocks: [
      { kind: 'table', head: ['Catégorie', 'Définition', 'Sources de données', 'Défis de collecte'], rows: [
        ['Combustion fixe', 'Chaudières, fours, turbines, groupes électrogènes, chauffage.', 'Factures et bons de livraison, compteurs gaz, fiches techniques.', 'Répartition entre équipements d’un même compteur ; facteurs spécifiques au combustible.'],
        ['Combustion mobile', 'Véhicules et engins détenus : camions, voitures, chariots élévateurs, engins.', 'Registres de flotte, cartes carburant, kilométrage × consommation moyenne.', 'Distinguer thermique (S1) et électrique (S2) ; ne pas oublier les engins non immatriculés.'],
        ['Émissions fugitives', 'Fuites de fluides frigorigènes (HFC), SF6, méthane.', 'Registres de recharge, bilans frigorifiques.', 'PRG 1 000 à 10 000 fois celui du CO2 ; traçabilité de la maintenance sous-traitée.'],
        ['Procédés industriels', 'Réactions physiques ou chimiques : calcination, fermentation, électrolyse.', 'Bilans matière × facteurs de procédé ; mesure continue (CEMS).', 'Facteurs spécifiques rares ; confusion possible avec la combustion fixe.'],
      ] },
      { kind: 'formula', label: 'Bilan massique des fluides frigorigènes', formula: 'Quantité fuitée = Charge initiale + Recharges − Charge finale', note: 'Émissions (kg CO2e) = Quantité fuitée (kg) × PRG du fluide' },
      { kind: 'h', text: 'Exemples sectoriels' },
      { kind: 'table', head: ['Secteur', 'Combustion fixe', 'Combustion mobile', 'Fugitives', 'Procédés'], rows: [
        ['Industrie manufacturière', 'Gaz naturel des chaudières', 'Chariots élévateurs thermiques', 'Fluides des systèmes de refroidissement', '—'],
        ['Agroalimentaire', 'Fours, cuiseurs', 'Groupes électrogènes mobiles', 'Chambres froides, entrepôts frigorifiques', 'Fermentation'],
        ['Santé / hôpitaux', 'Chauffage, générateurs de secours', 'Ambulances détenues', 'CVC des blocs opératoires', '—'],
        ['Universités', 'Chauffage des campus', 'Véhicules de service', 'Climatisation des centres de données', '—'],
        ['Services / bureaux', 'Chauffage des locaux', 'Véhicules de fonction thermiques', 'Climatisation bureaux et data centers', '—'],
      ] },
      { kind: 'callout', tone: 'warn', text: 'Aucun seuil de matérialité n’est fixé pour l’inclusion d’une source Scope 1 : l’exhaustivité prime. Les générateurs de secours (essais réglementaires compris) sont souvent oubliés.' },
      { kind: 'callout', tone: 'info', text: 'Biogénique : le CO2 issu de biomasse ou de biocarburants est déclaré dans un poste mémo distinct. Un biogaz acheté via un instrument contractuel non conforme aux critères de qualité est comptabilisé comme du gaz naturel.' },
    ],
  },
  {
    id: 'scope2',
    title: 'Scope 2 — Énergie achetée',
    group: 'Périmètres & scopes',
    summary: 'Location-based vs market-based, hiérarchie des instruments, double reporting obligatoire.',
    blocks: [
      { kind: 'table', head: ['Flux', 'Description'], rows: [
        ['Électricité achetée', 'Importée du réseau ou d’un tiers pour la consommation propre.'],
        ['Chaleur achetée', 'Réseau de chaleur urbain, chaufferie tierce.'],
        ['Vapeur achetée', 'Vapeur industrielle produite par un tiers.'],
        ['Froid acheté', 'Réseau de froid urbain, groupe frigorifique tiers.'],
      ] },
      { kind: 'formula', label: 'Méthode location-based', formula: 'Émissions = kWh consommés × Facteur moyen du réseau de la zone', note: 'Reflète la réalité physique moyenne du mix local.' },
      { kind: 'formula', label: 'Méthode market-based', formula: 'Émissions = kWh consommés × Facteur de l’instrument contractuel', note: 'Reflète les choix d’approvisionnement réels, y compris l’énergie renouvelable.' },
      { kind: 'h', text: 'Hiérarchie des instruments (market-based)' },
      { kind: 'list', ordered: true, items: [
        'Contrats directs avec attribut d’émission spécifique (contrat bilatéral, PPA physique).',
        'Certificats d’attributs énergétiques : garanties d’origine (Europe), RECs (Amérique du Nord), I-RECs.',
        'Facteur d’émission spécifique au fournisseur.',
        'Facteur du mix résiduel de la zone.',
        'Facteur moyen du réseau, en dernier recours.',
      ] },
      { kind: 'callout', tone: 'info', title: 'Critères de qualité', text: 'Le Scope 2 Guidance fixe 8 critères : l’instrument porte l’attribut d’émission de l’électricité produite, n’est revendiqué qu’une seule fois, est délivré dans le même marché que la consommation, et doit être annulé dans un registre. À défaut, on descend dans la hiérarchie.' },
      { kind: 'callout', tone: 'key', title: 'Double reporting', text: 'Publier les deux totaux (location-based et market-based) côte à côte est une exigence, pas une option. L’entreprise choisit l’une des deux méthodes pour suivre ses objectifs internes.' },
      { kind: 'h', text: 'Pertes en ligne' },
      { kind: 'p', text: 'L’annexe A du Corporate Standard distingue le facteur d’émission à la production (EFG) du facteur à la consommation (EFC), qui intègre les pertes de transport et distribution (T&D). L’autoconsommation relève du Scope 2, la revente aux utilisateurs finaux du Scope 3, le trading d’informations optionnelles.' },
      { kind: 'formula', label: 'Facteur à la consommation (annexe A)', formula: 'EFC = EFG ÷ (1 − taux de pertes T&D)' },
    ],
  },
  {
    id: 'scope3',
    title: 'Scope 3 — Chaîne de valeur',
    group: 'Périmètres & scopes',
    summary: 'Les 15 catégories amont et aval — souvent 50 à 90 % de l’empreinte.',
    blocks: [
      { kind: 'p', text: 'Le Scope 3 regroupe toutes les autres émissions indirectes produites tout au long de la chaîne de valeur. Il représente généralement la part la plus importante des émissions.' },
      { kind: 'table', head: ['Amont (upstream)', 'Aval (downstream)'], rows: [
        ['1. Biens et services achetés', '9. Transport et distribution aval'],
        ['2. Biens d’équipement', '10. Transformation des produits vendus'],
        ['3. Activités liées aux combustibles et à l’énergie', '11. Utilisation des produits vendus'],
        ['4. Transport et distribution amont', '12. Fin de vie des produits vendus'],
        ['5. Déchets générés', '13. Actifs loués (aval)'],
        ['6. Déplacements professionnels', '14. Franchises'],
        ['7. Déplacements domicile-travail', '15. Investissements'],
        ['8. Actifs loués (amont)', ''],
      ] },
      { kind: 'list', items: [
        'Industrie manufacturière : les émissions de fabrication de l’acier acheté sont du Scope 3.',
        'Industrie chimique : les émissions de production des matières pétrochimiques achetées sont du Scope 3.',
      ] },
      { kind: 'formula', label: 'Approche physique', formula: 'Émissions = Quantité achetée (kg, t) × Facteur d’émission du matériau' },
      { kind: 'formula', label: 'Approche monétaire (spend-based)', formula: 'Émissions = Montant dépensé × Ratio monétaire (kg CO2e / TND ou €)', note: 'Moins précise ; à remplacer progressivement par des données fournisseurs.' },
    ],
  },
  {
    id: 'calculation',
    title: 'Calcul des émissions',
    group: 'Calcul & données',
    summary: 'Identifier, choisir la méthode, collecter, calculer, consolider.',
    blocks: [
      { kind: 'formula', label: 'Formule fondamentale', formula: 'Émissions = Donnée d’activité × Facteur d’émission' },
      { kind: 'formula', label: 'Conversion en CO2 équivalent', formula: 'CO2e = Σ (masse de chaque gaz × PRG du gaz)', note: 'Ex. PRG AR5 : CO2 = 1, CH4 = 28, N2O = 265, SF6 = 23 500.' },
      { kind: 'formula', label: 'Combustibles (méthode GIEC)', formula: 'Émissions = Quantité × PCI × Facteur (kg/TJ) par gaz' },
      { kind: 'h', text: 'Les 5 étapes' },
      { kind: 'list', ordered: true, items: [
        'Identifier les sources : combustion fixe, mobile, procédés, fugitives.',
        'Choisir l’approche de calcul : en général facteurs d’émission × données d’activité, plutôt que mesure directe.',
        'Collecter les données et choisir les facteurs d’émission.',
        'Appliquer les outils de calcul (outils sectoriels et transversaux du GHG Protocol).',
        'Remonter les données au niveau corporatif (approche centralisée ou décentralisée).',
      ] },
      { kind: 'callout', tone: 'info', text: 'L’approche centralisée (données brutes envoyées au siège) limite les erreurs de calcul mais demande plus de travail au centre.' },
      { kind: 'h', text: 'Définitions' },
      { kind: 'list', items: [
        'Donnée d’activité : mesure quantitative d’une activité émettrice (litres, kWh, tonnes, km).',
        'Facteur d’émission : ratio reliant les émissions à une unité d’activité (ex. kg CO2e par litre de gazole).',
      ] },
    ],
  },
  {
    id: 'data-quality',
    title: 'Qualité des données et facteurs d’émission',
    group: 'Calcul & données',
    summary: 'Hiérarchie de la mesure directe à l’estimation ; sources ADEME, DEFRA, EPA, GIEC, IEA.',
    blocks: [
      { kind: 'h', text: 'Hiérarchie de qualité des données' },
      { kind: 'table', head: ['Niveau', 'Type de donnée'], rows: [
        ['1', 'Mesure directe continue sur site (compteurs dédiés, capteurs).'],
        ['2', 'Données facturées (factures d’énergie, bons de livraison).'],
        ['3', 'Données calculées à partir des équipements (puissance, rendement, durée de fonctionnement).'],
        ['4', 'Estimations par ratios sectoriels ou proxys — dernier recours, documentées comme telles.'],
      ] },
      { kind: 'h', text: 'Sources de facteurs d’émission' },
      { kind: 'table', head: ['Source', 'Portée'], rows: [
        ['GHG Protocol Calculation Tools', 'Outils intersectoriels et sectoriels, facteurs par défaut.'],
        ['ADEME — Base Carbone / Base Empreinte', 'Référence France et zone francophone.'],
        ['DEFRA — conversion factors', 'Référence britannique, mise à jour annuelle.'],
        ['US EPA — Emission Factors Hub / eGRID', 'Référence américaine, électricité par région.'],
        ['IPCC Guidelines', 'Référence internationale par défaut.'],
        ['IEA — Emissions Factors', 'Facteurs électriques par pays.'],
      ] },
      { kind: 'callout', tone: 'key', text: 'Ordre de préférence : facteur spécifique au site ou au fournisseur → facteur national officiel → facteur générique GHG Protocol / GIEC.' },
      { kind: 'h', text: 'Système de gestion de la qualité' },
      { kind: 'list', items: [
        'Quatre composants : méthodes, données, systèmes d’inventaire, documentation.',
        'Recouper compteurs et factures ; vérifier la cohérence des facteurs entre sites.',
        'Contrôler les erreurs de transcription, de conversion d’unités et de formules de tableur.',
        'Incertitude scientifique (compréhension des processus) vs incertitude d’estimation (données, facteurs).',
        'Documenter toute hypothèse (facteur de substitution, extrapolation) ; aucun seuil ne permet d’exclure une source pertinente.',
      ] },
    ],
  },
  {
    id: 'base-year',
    title: 'Année de base et recalcul',
    group: 'Pilotage & reporting',
    summary: 'Comparer « des pommes avec des pommes » malgré fusions, acquisitions et cessions.',
    blocks: [
      { kind: 'p', text: 'L’année de base est la première année pour laquelle des données fiables sont disponibles (année unique ou moyenne pluriannuelle). Elle sert de point de comparaison pour les objectifs.' },
      { kind: 'h', text: 'Recalcul nécessaire' },
      { kind: 'list', items: [
        'Changements structurels significatifs : fusions, acquisitions, cessions, externalisation / internalisation.',
        'Changements de méthodologie ou de facteurs d’émission.',
        'Découverte d’erreurs significatives.',
      ] },
      { kind: 'h', text: 'Pas de recalcul' },
      { kind: 'list', items: [
        'Croissance ou déclin organique (nouvelle usine construite, fermeture d’activité).',
        'Acquisition d’une installation qui n’existait pas pendant l’année de base.',
      ] },
      { kind: 'formula', label: 'Test de signification', formula: '|Changement| ÷ Émissions de l’année de base ≥ Seuil  ⇒  recalcul', note: 'Seuil défini par l’entreprise ; le California Climate Action Registry utilise 10 %.' },
      { kind: 'formula', label: 'Recalcul pour acquisition', formula: 'Année de base ajustée = Base + Émissions de l’entité acquise (sur l’année de base) − Émissions cédées' },
    ],
  },
  {
    id: 'targets',
    title: 'Objectifs de réduction',
    group: 'Pilotage & reporting',
    summary: 'Absolu ou intensité, année de base fixe ou glissante, place des compensations.',
    blocks: [
      { kind: 'list', ordered: true, items: [
        'Choisir le type : absolu (réduction totale) ou intensité (réduction par unité).',
        'Définir les limites : gaz, géographies, scopes.',
        'Choisir l’année de base : fixe ou glissante.',
        'Définir la période : courte ou longue.',
        'Décider si les crédits externes (offsets) comptent pour l’objectif.',
      ] },
      { kind: 'formula', label: 'Ratio d’intensité', formula: 'Intensité = Émissions de GES ÷ Métrique d’activité', note: 'Ex. t CO2e / t de produit, t CO2e / M€ de chiffre d’affaires.' },
      { kind: 'formula', label: 'Trajectoire linéaire', formula: 'Cible(année) = Base − (Base × %réduction) × (année − année de base) ÷ (année cible − année de base)' },
      { kind: 'formula', label: 'Avancement', formula: 'Réduction réalisée = (Base − Actuel) ÷ Base' },
      { kind: 'callout', tone: 'info', text: 'Cible absolue : ex. −20 % de t CO2e. Cible d’intensité : ex. −10 % de CO2 par tonne de produit, reflète l’efficacité même en période de croissance. Référence SBTi 1,5 °C : au moins −4,2 % par an (linéaire) sur les Scopes 1 et 2.' },
      { kind: 'callout', tone: 'key', text: 'L’engagement de la haute direction est indispensable. Une année de base glissante (comparaison à l’année précédente) est utile en cas d’acquisitions fréquentes.' },
    ],
  },
  {
    id: 'offsets',
    title: 'Réductions et compensations',
    group: 'Pilotage & reporting',
    summary: 'Ne jamais soustraire les crédits carbone des émissions brutes.',
    blocks: [
      { kind: 'table', head: ['', 'Réductions de l’inventaire', 'Réductions de projet (offsets)'], rows: [
        ['Référence', 'Année de base (recalculée)', 'Scénario de référence hypothétique (baseline)'],
        ['Calcul', 'Inventaire actuel vs année de base', 'Émissions du projet vs ce qui se serait passé sans lui'],
        ['Exigences', 'Cohérence méthodologique', 'Additionnalité, absence de fuites, permanence'],
      ] },
      { kind: 'list', items: [
        'Additionnalité : la réduction n’aurait pas eu lieu sans le projet.',
        'Fuites : augmentation des émissions ailleurs à cause du projet.',
        'Réversibilité : le carbone séquestré (forêts) peut être relâché (incendie).',
      ] },
      { kind: 'callout', tone: 'warn', text: 'Les émissions brutes sont déclarées indépendamment de tout achat ou vente de crédits. Les crédits sont déclarés séparément, jamais soustraits des Scopes 1 et 2.' },
      { kind: 'p', text: 'Carbone séquestré (annexe B) : pour les industries de la biomasse, les variations de stocks de carbone (végétation, sols, produits bois) sont déclarées séparément des scopes, en informations optionnelles.' },
    ],
  },
  {
    id: 'reporting',
    title: 'Reporting et vérification',
    group: 'Pilotage & reporting',
    summary: 'Informations requises vs optionnelles, piste d’audit, matérialité, assurance.',
    blocks: [
      { kind: 'h', text: 'Informations requises' },
      { kind: 'list', items: [
        'Description des périmètres organisationnel (approche de consolidation) et opérationnel ; période couverte.',
        'Émissions Scope 1 et Scope 2 séparées, en t CO2e et par gaz.',
        'Scope 2 en double reporting : location-based et market-based, avec les instruments utilisés.',
        'Émissions biogéniques déclarées séparément.',
        'Année de base, profil historique et politique de recalcul.',
        'Source des PRG ; exclusions justifiées ; changements de méthode.',
      ] },
      { kind: 'h', text: 'Informations optionnelles' },
      { kind: 'list', items: ['Émissions du Scope 3.', 'Indicateurs de ratio (intensité).', 'Compensations (offsets) achetées ou vendues.', 'Gaz hors Kyoto, carbone séquestré.'] },
      { kind: 'h', text: 'Documentation pour l’audit' },
      { kind: 'list', items: [
        'Piste d’audit reliant chaque donnée publiée à sa source primaire (facture, compteur, contrat).',
        'Contrats et certificats justifiant les instruments market-based.',
        'Fiches de calcul : donnée d’activité, facteur appliqué et sa source.',
        'Note méthodologique : périmètres, hypothèses, limites.',
      ] },
      { kind: 'h', text: 'Vérification' },
      { kind: 'list', items: [
        'Objectif : accroître la confiance des parties prenantes et de la direction.',
        'Écart matériel : erreur ou omission qui influence les décisions ; seuil courant de 5 % des émissions totales.',
        'Processus : évaluation des risques, périmètre de travail, visites de sites, examen des données et systèmes.',
        'Assurance interne : personnel indépendant du processus de reporting.',
        'Norme ISO 14064-3 ; la CSRD impose une assurance limitée, avec transition vers une assurance raisonnable.',
      ] },
    ],
  },
  {
    id: 'csrd',
    title: 'La CSRD',
    group: 'Réglementation & méthodes',
    summary: 'Directive européenne de reporting de durabilité : double matérialité et vérification obligatoire.',
    blocks: [
      { kind: 'p', text: 'La Corporate Sustainability Reporting Directive impose aux entreprises de publier des informations détaillées sur leurs impacts environnementaux, sociaux et de gouvernance (ESG). Elle remplace et élargit la NFRD.' },
      { kind: 'h', text: 'Pourquoi ?' },
      { kind: 'list', items: ['Rapports peu homogènes et incomplets.', 'Manque de comparabilité.', 'Risques de greenwashing.'] },
      { kind: 'h', text: 'Entreprises concernées' },
      { kind: 'list', items: [
        'Grandes entreprises remplissant au moins 2 critères sur 3 : > 250 salariés, > 50 M€ de chiffre d’affaires, > 25 M€ de total de bilan.',
        'La plupart des sociétés cotées sur un marché réglementé de l’UE.',
        'Certaines entreprises non européennes réalisant un chiffre d’affaires important dans l’UE.',
      ] },
      { kind: 'h', text: 'Nouveautés' },
      { kind: 'list', ordered: true, items: [
        'Exigences de reporting ESG plus détaillées (normes ESRS, dont ESRS E1 Climat).',
        'Vérification obligatoire par un organisme indépendant.',
        'Format numérique standardisé.',
        'Double matérialité : impact des enjeux de durabilité sur la performance financière, et impact de l’entreprise sur la société et l’environnement.',
      ] },
      { kind: 'callout', tone: 'key', text: 'Dans le cadre de la CSRD, les entreprises publient leurs émissions de GES des Scopes 1, 2 et 3 (lorsque pertinent), sur la base des principes du GHG Protocol.' },
    ],
  },
  {
    id: 'lca',
    title: 'Analyse du cycle de vie (ACV)',
    group: 'Réglementation & méthodes',
    summary: 'Les impacts d’un produit « du berceau à la tombe » (ISO 14040/14044).',
    blocks: [
      { kind: 'p', text: 'L’ACV évalue les impacts environnementaux d’un produit, service ou procédé sur l’ensemble de son cycle de vie. Au-delà des GES, elle couvre l’eau, les ressources, la pollution de l’air et de l’eau, les déchets et les écosystèmes.' },
      { kind: 'h', text: 'Étapes du cycle de vie' },
      { kind: 'list', ordered: true, items: [
        'Extraction des matières premières (pétrole, minerai, bois).',
        'Transformation et fabrication.',
        'Transport et distribution.',
        'Utilisation (énergie, maintenance, durée de vie).',
        'Fin de vie (réemploi, recyclage, valorisation énergétique, décharge).',
      ] },
      { kind: 'h', text: 'Les 4 phases (ISO 14040/14044)' },
      { kind: 'list', ordered: true, items: ['Définition des objectifs et du périmètre.', 'Inventaire des flux (matières, énergie, émissions).', 'Évaluation des impacts.', 'Interprétation et recommandations.'] },
      { kind: 'table', head: ['Comptabilité carbone', 'ACV'], rows: [['Émissions de GES d’une organisation', 'Impacts multiples d’un produit sur tout son cycle de vie']] },
      { kind: 'callout', tone: 'info', text: '« Cradle to grave » : du berceau à la tombe. « Cradle to cradle » : les matériaux sont réutilisés pour fabriquer de nouveaux produits.' },
    ],
  },
  {
    id: 'programs',
    title: 'Programmes de GES',
    group: 'Réglementation & méthodes',
    summary: 'EU ETS, CCAR, Climate Savers : exigences variables selon les programmes.',
    blocks: [
      { kind: 'p', text: 'L’annexe C du Corporate Standard compare les programmes volontaires et obligatoires : registre de Californie (CCAR), système d’échange de quotas de l’UE (EU ETS), Climate Savers du WWF, directive IPPC. Ils varient selon les scopes requis, l’année de base imposée et les exigences de vérification.' },
      { kind: 'p', text: 'Les marchés carbone (cap-and-trade) et taxes carbone donnent un prix aux émissions : c’est le fondement du prix carbone interne utilisé par la plateforme pour estimer l’exposition financière.' },
    ],
  },
];

/** Glossaire synthétique. */
export const GLOSSARY: Array<[string, string]> = [
  ['CO2e', 'Équivalent CO2 : unité commune permettant d’agréger différents gaz selon leur PRG.'],
  ['PRG / GWP', 'Pouvoir de réchauffement global d’un gaz relativement au CO2 sur 100 ans.'],
  ['Donnée d’activité', 'Mesure d’une activité émettrice : kWh, litres, km, tonnes.'],
  ['Facteur d’émission', 'Quantité de GES émise par unité d’activité.'],
  ['Émissions fugitives', 'Rejets non intentionnels : fuites de fluides frigorigènes, de méthane.'],
  ['Location-based', 'Méthode Scope 2 fondée sur le facteur moyen du réseau local.'],
  ['Market-based', 'Méthode Scope 2 fondée sur les instruments contractuels de l’entreprise.'],
  ['Mix résiduel', 'Mix électrique d’une zone dont on a retiré l’électricité déjà revendiquée par certificats.'],
  ['GO / REC / I-REC', 'Certificats d’attributs énergétiques attestant une production renouvelable.'],
  ['PPA', 'Power Purchase Agreement : contrat long terme avec un producteur d’électricité.'],
  ['Piste d’audit', 'Documentation permettant de retracer et recalculer chaque donnée publiée.'],
  ['Additionnalité', 'Preuve qu’une réduction n’aurait pas eu lieu sans le projet.'],
  ['Double matérialité', 'Principe CSRD : impacts financiers subis et impacts causés sur l’environnement et la société.'],
  ['T&D', 'Pertes de transport et distribution d’électricité sur le réseau.'],
  ['CEMS', 'Système de mesure en continu des émissions à la cheminée.'],
];
