#!/usr/bin/env bash
# Porte objective de la méthode (projet/METHODE.md). Tout doit être vert avant notation.
set -uo pipefail
cd "$(dirname "$0")"
echec=0
titre() { printf '\n=== %s ===\n' "$1"; }

# --cible : ne vérifier que ce qui a bougé (projet/METHODE.md, « Deux portes »). Les types
# et le hors-ligne restent entiers, ils coûtent dix secondes. La porte complète reste la
# règle avant une mise en ligne, un radar ou la clôture d'un lot.
mode="${1:-}"
cibles=""
specs=""
if [ "$mode" = "--cible" ]; then
  cibles=$( { git ls-files -m -o --exclude-standard -- src tests; git diff --name-only --cached --relative -- src tests; } | sort -u )
  if [ -z "$cibles" ]; then echo "rien n'a bougé sous src/ ni tests/, rien à cibler"; exit 0; fi
  echo "fichiers modifiés :"; printf '  %s\n' $cibles
  tout=0
  for f in $cibles; do
    case "$f" in
      tests/e2e/*.spec.ts) specs="$specs $(basename "$f" .spec.ts)" ;;
      tests/e2e/*) tout=1 ;;
      tests/*) ;;
      *)
        ligne=$(grep -v '^#' porte-cibles.txt | awk -v f="$f" -F'\t' 'index(f, $1) == 1 { print $2; exit }')
        if [ -z "$ligne" ] || [ "$ligne" = "*" ]; then tout=1; else specs="$specs $ligne"; fi ;;
    esac
  done
  if [ $tout -eq 1 ]; then specs="*"; else specs=$(printf '%s\n' $specs | sort -u | tr '\n' ' '); fi
fi

titre "Types"
./node_modules/.bin/vue-tsc --noEmit || echec=1

titre "Tests unitaires"
if [ "$mode" = "--cible" ]; then
  ./node_modules/.bin/vitest run --changed || echec=1
else
  ./node_modules/.bin/vitest run || echec=1
fi

titre "Build"
./node_modules/.bin/vite build || echec=1

titre "Outillage de test hors production"
if grep -rqE "data-derniere-phrase|__sonsJoues|playwright|vitest" dist/ 2>/dev/null; then
  echo "  ÉCHEC : outillage de test livré dans dist/"; echec=1
else
  echo "  ok, aucune sonde de test dans le bundle"
fi

titre "Tests de bout en bout"
if [ "$mode" = "--cible" ] && [ "$specs" != "*" ]; then
  if [ -z "$specs" ]; then
    echo "  aucun test de bout en bout rattaché aux fichiers modifiés"
  else
    echo "  ciblés : $specs"
    fichiers=""; for s in $specs; do fichiers="$fichiers tests/e2e/$s.spec.ts"; done
    ./node_modules/.bin/playwright test $fichiers --grep-invert @latence || echec=1
  fi
else
  ./node_modules/.bin/playwright test --grep-invert @latence || echec=1
fi

# Seul et machine au repos : une latence mesurée au milieu de seize navigateurs mesure
# l'ordonnanceur, pas l'application, et faisait rougir la porte au hasard.
if [ "$mode" != "--cible" ] || [ "$specs" = "*" ] || printf '%s' "$specs" | grep -q e1-grille; then
  titre "Latence (C4), mesurée seule"
  ./node_modules/.bin/playwright test --grep @latence --workers=1 || echec=1
fi

titre "Hors ligne (EG-01)"
node ./verifier-hors-ligne.mjs || echec=1

# Les mutations coûtent des minutes et ne bougent qu'avec le code. `--rapide` les saute,
# pour la boucle de travail ; la porte complète reste la règle en fin de lot.
if [ "$mode" = "--rapide" ]; then
  titre "Mutation : les tests savent-ils échouer ?"
  echo "  sautée (--rapide). À rejouer entière avant de clore un lot."
elif [ "$mode" = "--cible" ]; then
  titre "Mutation : les tests savent-ils échouer ? (fichiers modifiés seulement)"
  MUTATION_FICHIERS="$(printf '%s\n' $cibles | grep '^src/' | tr '\n' ' ')" ./mutation.sh || echec=1
else
  titre "Mutation : les tests savent-ils échouer ?"
  ./mutation.sh || echec=1
fi

if [ $echec -eq 0 ]; then printf '\nPORTE VERTE\n'; else printf '\nPORTE ROUGE\n'; fi
exit $echec
