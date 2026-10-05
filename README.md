# 🫙 Carbon Jar — Plateforme de comptabilité carbone

Carbon Jar sert à calculer le bilan carbone d’une organisation selon le **GHG Protocol**. Chaque donnée d’activité est exprimée de trois façons :

- **émissions** (t CO2e) ;
- **énergie** (MWh) ;
- **argent** (coûts, exposition au prix du carbone).

La plateforme classe aussi les données dans le bon **scope** et propose un **plan de réduction** chiffré.

Le contenu méthodologique (définitions, règles, formules, exemples) vient des documents de référence fournis :

- *GHG – Carbon accounting* ;
- *Résumé GHG Protocol* ;
- *Module de formation Scopes 1 et 2* ;
- *Rapport de synthèse – Le Protocole des gaz à effet de serre*.

## Démarrer

**Sans installation :** ouvrez `carbon-jar.html` (à la racine du dépôt) par double-clic dans votre navigateur. C’est l’application complète en un seul fichier.

> Le fichier `index.html` de la racine est la **source** de l’application : ouvert directement depuis le disque, il ne charge pas (le navigateur bloque `src/main.tsx`). Utilisez `carbon-jar.html`, `dist/index.html` ou le serveur de développement.

**Pour développer :**

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # tests du moteur de calcul et du classificateur
npm run build            # dist/index.html, un fichier unique qui s’ouvre aussi depuis le disque
npm run build:artifact   # version à publier comme Artifact claude.ai
```

Après une modification, régénérez le fichier prêt à ouvrir avec `npm run build && cp dist/index.html carbon-jar.html`.

Les données sont enregistrées dans le navigateur (localStorage). Il n’y a pas de serveur. Pour sauvegarder ou restaurer les données, utilisez un fichier JSON : l’export se fait depuis la page **Rapport** et l’import depuis la page **Paramètres**. Un jeu de démonstration (une entreprise chimique) est chargé au premier lancement.

## Deux espaces : portail client et cabinet

**Portail client** (`#/portail`) :
- **Documents à fournir** : rubriques classées par scope.
  - Scope 1 : gaz et combustibles, carburant, véhicules et kilométrage, climatisation.
  - Scope 2 : électricité.
  - Scope 3 : déplacements, eau, déchets, achats.
- **Dépôt** : chaque pièce est lue et classée automatiquement à son arrivée. Le client peut déclarer une rubrique « non concernée ».
- **Onglets progressifs** : ils s’ouvrent au fur et à mesure du dossier. « Mes résultats » s’active dès qu’une donnée est intégrée, « Ma flotte » dès qu’une carte grise est reconnue, « Mon rapport ESG » dès sa publication par le cabinet.
- **Empreinte & économies** : total de CO2 émis puis détail par scope et par poste ; dépenses liées aux émissions et coût carbone (prix interne en TND) ; gains annuels possibles (économies d’énergie + coût carbone évité) ; simulateur « si je réduis de X % » ; conseils adaptés au secteur de l’entreprise (industrie, chimie, agroalimentaire, santé, enseignement, services, commerce, transport).
- **Suivi** : avancement en 5 étapes (collecte → extraction → vérification → bilan carbone → rapport) et questionnaire social et gouvernance.

**Espace cabinet** (ingénieurs) :
- **Vue d’ensemble** du dossier.
- **File de vérification** des pièces incertaines.
- **Bilan carbone** : données d’activité, flotte, inventaire GES, suivi et budgets, plan de réduction, objectifs.
- **Rapport ESG** : rédaction puis publication sur le portail du client.
- **Portefeuille** de tous les clients.

## Version cabinet de conseil

- **Clients** : un dossier par client (sites, documents, inventaire, flotte, budgets, objectifs, rapport). Sauvegarde et restauration de tous les dossiers en JSON.
- **Documents** : dépôt de factures (STEG électricité et gaz, carburant, SONEDE), tickets, cartes grises, fiches techniques, billets d’avion, bordereaux de déchets, rapports de climatisation.
  - PDF avec texte : lus dans le navigateur (pdf.js), sans envoi externe.
  - Scans et photos : lus par Claude lorsque la plateforme est ouverte sur claude.ai (capacité `sample`) ; sinon, saisie assistée.
  - Chaque pièce est reconnue (type, fournisseur, numéro, période, montant, quantités, immatriculation), classée dans le bon scope, puis validée automatiquement si la confiance dépasse 80 %, ou placée dans la file « À valider ».
  - Chaque donnée garde le lien vers sa pièce (piste d’audit).
  - Réception : glisser-déposer sur chaque demande, prise de photo sur téléphone, suivi étape par étape (réception, lecture, extraction, contrôles, classement) et accusé de réception. Les fichiers vides, trop lourds (> 25 Mo) ou d’un format non pris en charge sont refusés, et un fichier déjà reçu est signalé.
  - Tableaux Excel / CSV (relevés de cartes carburant, exports comptables) : détection des colonnes, une ligne par véhicule et par carburant, lignes « Total » ignorées, véhicules inconnus ajoutés à la flotte.
  - Factures STEG : somme des postes horaires (jour, pointe, soir, nuit), index × coefficient, dates écrites en toutes lettres, conversion MWh / GJ / thermies.
  - Contrôles de cohérence : doublon, période déjà couverte, prix unitaire atypique, consommation atypique par rapport aux autres mois, pièce hors exercice, date future. Une pièce avec alerte n’est jamais intégrée automatiquement.
  - Le portail indique au client les mois de factures manquants. Le client peut aussi ajouter une précision sur une pièce.
- **Flotte** : registre alimenté par les cartes grises et fiches techniques ; carburant réel ou estimation kilométrage × consommation.
- **Suivi** : consommé, restant et projection de fin d’année par budget (kWh, litres, t CO2e, TND) et répartition mensuelle selon les périodes des factures.
- **Rapport ESG** : couverture, synthèse exécutive, périmètre, méthodologie, environnement (scopes, catégories, gaz, énergie, évolution, intensité, eau, déchets, objectifs, plan d’action), social, gouvernance, engagements, annexes (correspondance GRI / ESRS, facteurs utilisés, pièces justificatives). Export HTML et impression PDF.
- **Vérification des calculs** : chaque donnée affiche son calcul, par exemple `1 460 kWh × 0,58 kg CO2e/kWh = 846,8 kg CO2e`.

## Fonctionnalités

| Module | Rôle |
|---|---|
| **Tableau de bord** | Émissions S1/S2/S3, énergie, dépenses, exposition au prix du carbone, intensité, évolution par rapport à l’année de base, principaux postes. Vue CO2e / énergie / coût. |
| **Données d’activité** | Saisie manuelle avec aperçu immédiat, ou import CSV/Excel avec **classification automatique** en scopes (mots-clés et règles de frontière). Qualité de la donnée (niveaux 1 à 4) et justificatif pour la piste d’audit. |
| **Classer en scopes** | Assistant pas à pas fondé sur la logique « qui contrôle la source ? est-ce de l’énergie achetée ? ». Il traite les cas particuliers : véhicule électrique, biomasse, énergie revendue, gaz hors Kyoto, actifs loués. |
| **Inventaire GES** | Résultats par scope et catégorie, ventilation par gaz, double reporting du Scope 2 (location-based / market-based), postes mémo, détail par site, export CSV. |
| **Périmètre organisationnel** | Entités et approches de consolidation (part de capital, contrôle financier, contrôle opérationnel), avec une comparaison de leur impact. |
| **Objectifs & trajectoire** | Cibles absolues ou d’intensité, trajectoire linéaire, avancement, comparaison avec la référence SBTi de 4,2 %/an. |
| **Plan de réduction** | Leviers adaptés à l’inventaire et chiffrés en t CO2e, MWh et gains financiers, avec un simulateur de plan. |
| **Rapport & conformité** | Liste de contrôle des informations requises par le GHG Protocol et rapport imprimable en PDF. |
| **Calculateurs** | Calcul d’émissions, bilan massique des fluides frigorigènes, Scope 2 en double reporting, consolidation, recalcul de l’année de base, intensité, coût carbone, conversions d’énergie. |
| **Facteurs d’émission** | Base par défaut (GIEC 2006, ADEME, DEFRA, IEA). Les valeurs peuvent être surchargées et des facteurs spécifiques ajoutés. Tables des PRG AR5/AR6. |
| **Guide** | 17 fiches tirées des documents : principes, périmètres, scopes, Scope 2, qualité des données, année de base, objectifs, compensations, reporting, CSRD, ACV, glossaire. |

## Formules implémentées (`src/lib/calc.ts`)

- `Émissions = Donnée d’activité × Facteur d’émission`
- `CO2e = Σ (masse du gaz × PRG)` (AR5 ou AR6 au choix)
- Combustibles : `Quantité × PCI × facteur GIEC (kg/TJ)` pour le CO2, le CH4 et le N2O
- Fluides frigorigènes : `Fuite = charge initiale + recharges − charge finale (+ capacité retirée − capacité neuve)`. Le PRG d’un mélange est la moyenne des PRG de ses composants, pondérée par leur masse.
- Scope 2 location-based : `kWh × facteur réseau`
- Scope 2 market-based : facteur choisi selon la hiérarchie PPA > GO/REC > fournisseur > mix résiduel > moyenne réseau
- Consolidation : `× % de capital`, ou `× 1/0` selon le contrôle
- Intensité : `Émissions ÷ métrique d’activité`
- Exposition financière : `Émissions × prix du carbone`
- Recalcul de l’année de base : déclenché quand `Σ|changements| ÷ base ≥ seuil`
- Trajectoire de réduction linéaire et calcul de l’avancement

Règles du GHG Protocol appliquées :

- le CO2 biogénique est déclaré hors scopes ;
- les gaz hors Kyoto (comme le R-22) sont déclarés à part ;
- l’électricité revendue passe en Scope 3 ;
- les crédits carbone ne sont jamais soustraits des émissions.

## Structure

```
src/
  domain/types.ts         Modèle de données (activités, facteurs, entités, objectifs)
  data/                   Catégories, PRG, facteurs d’émission, base de connaissances, démo
  lib/calc.ts             Moteur de calcul de l’inventaire
  lib/classifier.ts       Classification automatique et arbre de décision des scopes
  lib/recommendations.ts  Leviers de réduction et conseils sur la qualité
  lib/csv.ts              Import et export CSV
  state/store.tsx         État de l’application et persistance
  pages/                  Une page par module
  components/             Composants d’interface
```

## Paramétrage Tunisie

- Devise par défaut : **TND** ; prix carbone interne par défaut : 270 TND/t CO2e.
- Électricité du réseau tunisien (STEG) : **0,58 kg CO2e/kWh** (valeur fournie par l’organisation).
- Prix unitaires indicatifs en TND (gazole 2,205 TND/L, essence 2,525 TND/L, électricité 0,30 TND/kWh…), à remplacer par vos factures.
- Ratios monétaires du Scope 3 convertis en kg CO2e/TND (1 € ≈ 3,4 TND).
- Conseils adaptés au contexte local : gisement solaire, autoproduction (loi n° 2015-12), accompagnement de l’ANME.

> ⚠️ Les facteurs d’émission fournis sont des valeurs par défaut documentées, en particulier les facteurs électriques par pays et les ratios monétaires. Avant toute publication officielle, remplacez-les par les facteurs officiels de votre pays ou de vos fournisseurs dans la page **Facteurs d’émission**.
