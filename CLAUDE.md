# Carbon Jar — consignes de travail

- Travailler directement sur la branche `main` : commit et push sur `main`, sans créer de branche.
- Après chaque modification : `npm run build`, copier `dist/index.html` vers `carbon-jar.html` (fichier ouvert par l'utilisateur), puis `npm run build:artifact`.
- Vérifications avant push : `npx tsc --noEmit -p .` et `npx vitest run`.
- Langue de l'interface et des messages de commit : français.
