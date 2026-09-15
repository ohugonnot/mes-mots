# Mes mots

Application de communication par pictogrammes pour un enfant qui ne parle pas et ne lit pas
encore. Le seul bug vraiment grave est une perte de configuration : les mots, photos et voix
enregistrés par la famille sont irremplaçables, et il n'existe pas de sauvegarde automatique.

Deux invariants ne se discutent jamais : **une case ne change jamais de place** (l'enfant
apprend par la position), et **la latence entre le doigt et le son reste minimale**.

Des commentaires renvoient à des documents de conception sous `projet/`. Ils sont restés dans
le dépôt de travail de la famille, qui n'est pas publié : ce sont des notes de décision, pas
du code, et elles parlent d'un enfant précis. Le pourquoi qui compte est recopié sur place,
dans le commentaire lui-même.

## Vérifier, sans noyer le contexte

```bash
npm run typecheck 2>&1 | tail -3
npx vitest run 2>&1 | grep -E "Tests |Test Files|× " | head -4
npx playwright test 2>&1 | grep -E "passed|failed" | tail -2
```

Cibler le test concerné plutôt que la porte entière : `npx vitest run tests/unitaires/X.test.ts`,
`npx playwright test --project=tablette e9-rendu`. La porte complète prend deux minutes et ne
se lance qu'avant une mise en ligne.

En cas d'échec seulement, demander le détail :
`npx playwright test 2>&1 | grep -A10 "^  1) " | head -16`

## Pièges de ce dépôt

@CLAUDE.pieges.md

## Le banc de mutation

`./mutation.sh` casse le code volontairement, motif par motif, et vérifie qu'un test rougit à
chaque fois. Un motif qui survit désigne un test décoratif. `porte-cibles.txt` dit quelles
spécifications rejouer pour quel fichier source, et `MUTATION_FICHIERS="a b"` restreint la
passe aux fichiers nommés.
