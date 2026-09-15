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

- **Deux runs Playwright en parallèle se détruisent** : ils partagent `test-results/`.
- **Le serveur d'aperçu sert `dist/`, pas les sources** : reconstruire avant de mesurer,
  sinon on juge l'ancien code. Tuer par le port :
  `ss -lptn 'sport = :4173' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`
- **`npm install` se bloque ici** : `npm install --ignore-scripts`.
- **Un proxy réactif Vue n'entre pas dans IndexedDB** : `toRaw()` avant toute écriture,
  l'échec part sinon en rejet silencieux.
- **Recharger la page juste après un clic teste une course**, pas un comportement :
  attendre la persistance (`expect.poll` sur le magasin) avant `page.reload()`.
- **`setPointerCapture` jette sur un pointeur synthétique** (tests) et interrompt le
  gestionnaire : l'entourer d'un `try`.
- **Ne jamais éditer `mutation.sh` pendant qu'il tourne** : bash relit le script au fil de
  l'exécution, une insertion décale tout ce qui suit le point de lecture.
- **`muter` ne remplace que la première occurrence** : un motif qui apparaît deux fois mute
  l'autre endroit en silence. L'ancrer sur une ligne voisine unique.
- **Chercher un `.sauve` oublié avant tout `git add`** : `mutation.sh` restaure par copie,
  et un arrêt en plein vol laisse le fichier de secours sur place.
- **Dans un `<script setup>`, un `watch` évalue sa source tout de suite** : il doit être
  écrit après les refs qu'il lit, sinon l'initialisation jette.
- **Un élément flex passe devant avec le seul `z-index`** : son `z-index` crée un contexte
  d'empilement même en `position: static`. Ajouter `position: relative` ne sert à rien, et le
  motif de mutation qui viserait cette position ne rougirait jamais.

## Le banc de mutation

`./mutation.sh` casse le code volontairement, motif par motif, et vérifie qu'un test rougit à
chaque fois. Un motif qui survit désigne un test décoratif. `porte-cibles.txt` dit quelles
spécifications rejouer pour quel fichier source, et `MUTATION_FICHIERS="a b"` restreint la
passe aux fichiers nommés.
