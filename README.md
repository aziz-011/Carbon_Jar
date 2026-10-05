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

> ⚠️ Les facteurs d’émission fournis sont des valeurs par défaut documentées, en particulier les facteurs électriques par pays et les ratios monétaires. Avant toute publication officielle, remplacez-les par les facteurs officiels de votre pays ou de vos fournisseurs dans la page **Facteurs d’émission**.
