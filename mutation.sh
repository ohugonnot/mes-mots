#!/usr/bin/env bash
# Casse volontairement le code et vérifie que les tests s'en aperçoivent.
# Un test qui reste vert sur du code cassé ne protège de rien.
#
# Une mutation par tâche nommée du backlog, pas une par fichier : à l'étape E1
# l'interruption audio avait pu disparaître entièrement sans qu'un contrôle ne bronche.
set -uo pipefail
cd "$(dirname "$0")"
echec=0

# Un serveur oublié sur le port servirait l'ancien code et la mutation passerait pour vue.
if ss -lptn 'sport = :4173' 2>/dev/null | grep -q LISTEN; then
  echo "  port 4173 déjà occupé, les mutations de bout en bout seraient faussées"
  exit 1
fi

# Le serveur est démarré UNE fois pour toute la série. Le laisser à Playwright lui faisait
# relancer build et serveur à chaque mutation, une trentaine de fois : c'était l'essentiel
# du temps de la porte. `vite preview` sert dist/ depuis le disque, donc une reconstruction
# en place suffit à lui faire servir le code muté.
./node_modules/.bin/vite build > /dev/null 2>&1
./node_modules/.bin/vite preview --port 4173 --strictPort > /dev/null 2>&1 &
serveur=$!
trap 'kill $serveur 2>/dev/null' EXIT
for _ in $(seq 60); do
  curl -sf -o /dev/null http://localhost:4173/ && break
  sleep 0.5
done

# Rejoue la porte qui surveille la tâche mutée : les tests unitaires, ou le bout en bout
# pour ce qui ne se voit qu'à l'écran (géométrie, propriétés CSS).
# `-x` et `--bail` arrêtent au premier rouge : un seul test qui tombe prouve déjà que la
# mutation est vue, jouer la suite entière ne renseigne sur rien.
# Les spécifications rattachées au fichier muté, d'après porte-cibles.txt. Rejouer la suite
# entière pour chaque mutation coûtait l'essentiel du temps de la porte : une quarantaine de
# secondes par mutation, une trentaine de fois. Une ligne « * » renvoie toute la suite.
cibles_de() {
  local ligne
  ligne=$(grep -v '^#' porte-cibles.txt | awk -v f="$1" -F'\t' 'index(f, $1) == 1 { print $2; exit }')
  [ -z "$ligne" ] || [ "$ligne" = "*" ] && return
  printf '%s' "$ligne"
}

porte_verte() {
  case "$1" in
    e2e)
      reconstruire=1
      # Sans ce garde-fou, une mutation qui ne compile pas laisse dist/ tel quel : la suite
      # rejoue l'ancien code, passe au vert, et le banc accuse les tests au lieu du motif.
      ./node_modules/.bin/vite build > /dev/null 2>&1 || return 2
      ./node_modules/.bin/playwright test $(cibles_de "$2") -x --workers=4 --grep-invert @latence > /dev/null 2>&1
      ;;
    *) ./node_modules/.bin/vitest run --bail=1 > /dev/null 2>&1 ;;
  esac
}
reconstruire=0

# Porte ciblée : MUTATION_FICHIERS liste les fichiers modifiés, séparés par des espaces.
# Une mutation qui vise un autre fichier est sautée et comptée. Sans la variable, tout joue.
sautees=0
muter() {
  local fichier="$1" ancien="$2" nouveau="$3" libelle="$4" porte="${5:-unitaires}"
  if [ -n "${MUTATION_FICHIERS:-}" ] && ! printf '%s\n' $MUTATION_FICHIERS | grep -qx "$fichier"; then
    sautees=$((sautees + 1)); return
  fi
  cp "$fichier" "$fichier.sauve"
  python3 -c "
import sys
from pathlib import Path
p = Path(sys.argv[1]); t = p.read_text()
assert sys.argv[2] in t, 'motif introuvable'
p.write_text(t.replace(sys.argv[2], sys.argv[3], 1))
" "$fichier" "$ancien" "$nouveau" 2>/dev/null || {
    echo "  $libelle : motif introuvable, mutation à mettre à jour"; mv "$fichier.sauve" "$fichier"; echec=1; return
  }
  porte_verte "$porte" "$fichier"; verdict=$?
  case $verdict in
    2) echo "  $libelle : la mutation ne compile pas, motif à revoir"; echec=1 ;;
    0) echo "  $libelle : ÉCHEC, tests verts sur code cassé"; echec=1 ;;
    *) echo "  $libelle : ok" ;;
  esac
  mv "$fichier.sauve" "$fichier"
}

# Lot 1 : une mutation par tâche du cœur
muter src/domaine/plancheDemo.ts \
  "vocalization: 'Boire'" \
  "vocalization: ''" \
  "C1 chaque case porte sa phrase"
muter src/styles/base.css \
  "--case-espacement: clamp(6px, min(1.75vw, 1.1vh), 14px);" \
  "--case-espacement: 2px;" \
  "C2 espacement entre cases" e2e
muter src/composants/CaseCommunication.vue \
  "flex: 0 0 var(--case-etiquette-hauteur);" \
  "flex: 0 0 70%;" \
  "C3 la photo garde les trois quarts de la case" e2e
muter src/App.vue \
  "  if (voix.genre === 'livre') return lecteur.jouer(urlLivree(\`sons/\${voix.idSon}.mp3\`), surFin)" \
  "  if (false) return lecteur.jouer(urlLivree(\`sons/\${voix.idSon}.mp3\`), surFin)" \
  "C4 lecture du son au toucher"
muter src/composants/CaseCommunication.vue \
  ':class="{ enfoncee, parle: props.parle }"' \
  ':class="{ enfoncee: false, parle: props.parle }"' \
  "C6 état enfoncé de la case"
muter src/composants/CaseCommunication.vue \
  "transform: translateY(var(--case-relief));" \
  "" \
  "C6 la case descend vraiment sur son ombre" e2e
muter src/styles/base.css \
  "* { transition-duration: 0ms !important; animation-duration: 0ms !important; }" \
  "" \
  "C6 respect de prefers-reduced-motion" e2e
muter src/App.vue \
  "  })
  void garderEcranAllume()" \
  "  })" \
  "C8 verrou d'écran demandé au démarrage"
muter src/domaine/protectionAppui.ts "duree < reglages.dureeAppuiMinimaleMs" "false" "C7 durée d'appui minimale"
muter src/domaine/protectionAppui.ts "appui.finMs - derniereActivationMs < reglages.delaiEntreActivationsMs" "false" "C7 délai entre activations"
# Le motif visait `@pointerleave`, retiré exprès : le doigt reste accroché à la case où il
# s'est posé, une main qui dérive de trois millimètres n'obtenait sinon rien du tout. Ce qui
# annule un appui aujourd'hui, c'est le système qui reprend le geste, un appel qui arrive.
muter src/composants/CaseCommunication.vue \
  '    @pointercancel="annulerAppui"
' \
  "" \
  "C7 un geste repris par le systeme ne dit pas le mot"
muter src/domaine/palette.ts "{ nom: 'Boissons et nourriture', fond: '#ffd25e', anneau: '#ffc93c' }," "{ nom: 'Boissons et nourriture', fond: '#c9a227', anneau: '#ffc93c' }," "garde-fou de contraste des étiquettes"

muter src/composants/CaseCommunication.vue \
  ".illustration img {
  position: absolute;
  inset: 0;" \
  ".illustration img {
  position: static;" \
  "C3 l'image tient dans son cadre" e2e

# Lot 1bis : une mutation par tâche corrigée
muter src/composants/GrilleCommunication.vue \
  "grid-template-rows: repeat(var(--lignes), 1fr);" \
  "grid-template-rows: repeat(var(--lignes), minmax(3.5cm, 1fr));" \
  "R1 la grille rétrécit au lieu d'être rognée" e2e
muter src/App.vue \
  "derniereActivationParCase.get(id) ?? null" \
  "derniereActivationParCase.values().next().value ?? null" \
  "R2 temps mort propre à chaque case"
muter src/domaine/lecteurAudio.ts \
  "    this.arreter()
    const audio" \
  "    const audio" \
  "R3 interruption de la phrase en cours"
muter src/domaine/plancheDemo.ts \
  "ext_mesmots_enchaine: 'Loki', hidden: true" \
  "ext_mesmots_enchaine: 'Loki'" \
  "R4 les 8 cases masquées le restent"
muter src/domaine/lecteurAudio.ts \
  "console.error(\`son illisible : \${source}\`, cause)" \
  "undefined" \
  "R5 trace d'un son illisible"
muter src/App.vue \
  "document.addEventListener('visibilitychange', reprendreVerrouEcran)" \
  "void reprendreVerrouEcran" \
  "R6 reprise du verrou d'écran"
muter src/composants/CaseCommunication.vue \
  "touch-action: manipulation;" \
  "touch-action: auto;" \
  "R7 double appui neutralisé sur la case" e2e
muter src/domaine/plancheDemo.ts \
  "['maman', 'papa', 'moi', 'doudou']," \
  "['papa', 'maman', 'moi', 'doudou']," \
  "R8 invariant de position sur les rectangles" e2e
muter src/composants/CaseCommunication.vue \
  '{{ props.contenu.label }}</span>' \
  '{{ props.contenu.label.charAt(0) }}</span>' \
  "R9 repère distinct par case"
muter src/composants/GrilleCommunication.vue \
  'v-if="emplacement.contenu && !emplacement.contenu.hidden"' \
  'v-if="emplacement.contenu"' \
  "R10 filtre des cases masquées"

# Lot 1ter : corrections du deuxième radar
muter src/composants/CaseCommunication.vue \
  "  background: var(--fond-etiquette);
  color: var(--encre);" \
  "  background: var(--fond-etiquette);
  color: var(--anneau);" \
  "V1 lisibilité du mot-repère" e2e
muter src/composants/CaseCommunication.vue \
  "  --ombre-relief: color-mix(in srgb, var(--anneau) 55%, #000);" \
  "  --ombre-relief: color-mix(in srgb, var(--anneau) 72%, #000);" \
  "V5 l'ombre détache la carte du ciel" e2e

# Lot 2 : structure de l'écran
muter src/App.vue \
  "dernierePhrase.value = contenu.vocalization" \
  "void contenu" \
  "T3 la bande du haut montre la phrase prononcée" e2e
muter src/domaine/plancheDemo.ts \
  "order: [['aide', 'encore', 'fini', null, null]]," \
  "order: [[null, null, null, null, null]]," \
  "T4 la barre garde ses cinq emplacements réservés"
muter src/App.vue \
  "configuration.value?.contextes.filter(contextePorteBouton)" \
  "configuration.value?.contextes" \
  "T5 un contexte vide n'a pas de bouton" e2e

# Lot 2 : persistance
muter src/domaine/depot.ts \
  "    if (enregistree) return reprendre(enregistree)" \
  "    if (enregistree) return graine" \
  "T1 la planche vient du dépôt et non du code" e2e
muter src/domaine/depot.ts \
  "await navigator.storage?.persist?.()" \
  "false" \
  "T2 stockage persistant demandé au système" e2e

# Ergonomie sur petit écran
muter src/styles/base.css \
  "clamp(6px, min(1.75vw, 1.1vh), 14px)" \
  "14px" \
  "M1 la géométrie se resserre au lieu de manger les cases" e2e
# La place laissée à l'encoche (M2) n'a pas de mutation : le navigateur des tests n'a pas
# d'encoche, env() y vaut zéro, aucun test ne peut distinguer la règle de son absence.
# Vérifié à la main, et inscrit comme tel dans le backlog.

# Lot 3 : espace parents
muter src/composants/VerrouParents.vue \
  "const SEUIL_APPUI_LONG_MS = 3000" \
  "const SEUIL_APPUI_LONG_MS = 0" \
  "P1 le seuil de 3 secondes protège l'accès parents" e2e
muter src/domaine/planche.ts \
  "c.id === idCase ? { ...c, hidden: !(c.hidden ?? false) } : c," \
  "c.id === idCase ? { ...c, hidden: undefined } : c," \
  "P5 la bascule écrit toujours hidden en booléen explicite"
muter src/domaine/planche.ts \
  "  const plancheBasculee: Planche = {
    ...planche," \
  "  const plancheBasculee: Planche = {
    ...planche,
    grid: { ...planche.grid, order: [...planche.grid.order].reverse() }," \
  "P5 la bascule ne touche jamais grid.order"
muter src/composants/EspaceParents.vue \
  "  grid-template-rows: repeat(var(--lignes), 150px);
  gap: 10px;
  align-content: start;" \
  "  grid-template-rows: repeat(var(--lignes), minmax(80px, auto));
  gap: 10px;
  flex: 1;" \
  "P5 une carte ne dépend pas du nombre de rangées de la planche" e2e
muter src/composants/EspaceParents.vue \
  ".case-parent.masquee {
  border-style: dashed;
  background: #dfe4e9;" \
  ".case-parent.masquee {
  border-style: dashed;
  opacity: 0.45;" \
  "P5 l'état masqué reste lisible pour le parent" e2e
muter src/composants/EspaceParents.vue \
  "if (props.stockagePersistant === true) return 'Le système garde vos réglages.'" \
  "if (props.stockagePersistant === true) return ''" \
  "D11 le verdict du stockage persistant s'affiche"

# Lot 3 : ajouter, modifier, supprimer une case (P3, P7)
muter src/domaine/planche.ts \
  "if (!planche || planche.grid.order[ligne]?.[colonne] !== null) return configuration" \
  "if (!planche) return configuration" \
  "P3 ajouterCase refuse un emplacement déjà occupé"
muter src/domaine/planche.ts \
  "order: planche.grid.order.map((ligne) => ligne.map((id) => (id === idCase ? null : id)))," \
  "order: planche.grid.order," \
  "P3 supprimerCase remet l'emplacement à null"
muter src/domaine/planche.ts \
  "return placerCaseALaPosition(configuration, idPlanche, ligne, colonne, caseARestaurer)" \
  "return configuration" \
  "P3 l'annulation de suppression remet la case à sa position"
muter src/domaine/planche.ts \
  "buttons: planche.buttons.map((c) => (c.id === idCase ? { ...c, ...champs } : c))," \
  "buttons: planche.buttons.map((c) => (c.id === idCase ? { ...c, ...champs, hidden: true } : c))," \
  "P7 modifierCase ne touche jamais sound_id ni hidden"
muter src/composants/EditeurCase.vue \
  "if (mot.length === 0) erreurLabel.value = 'Le mot écrit sur la case est obligatoire.'" \
  "if (false) erreurLabel.value = 'Le mot écrit sur la case est obligatoire.'" \
  "P7 la validation du mot obligatoire"

# Lot 2 : pages, pagination et glissement (T6, T7, T8)
muter src/App.vue \
  "const DELAI_RETOUR_MS = 30_000" \
  "const DELAI_RETOUR_MS = 600_000" \
  "T6 le retour automatique tombe à 30 secondes" e2e
muter src/App.vue \
  "  if (!configuration.value?.reglages.retourAutomatique) return" \
  "" \
  "T6 le réglage désactive vraiment le retour" e2e
muter src/App.vue \
  'v-if="pages.length > 1"' \
  'v-if="pages.length > 0"' \
  "T7 pas de contrôle de page quand une seule page est atteignable" e2e
muter src/domaine/glissement.ts \
  "export const GLISSEMENT_MINIMAL_PX = 16" \
  "export const GLISSEMENT_MINIMAL_PX = 9999" \
  "T8 un glissement ne fait pas parler la case sous le doigt" e2e
muter src/domaine/glissement.ts \
  "export const PART_CHANGEMENT_PAGE = 0.15" \
  "export const PART_CHANGEMENT_PAGE = 0.9" \
  "T8 le seuil de changement de page vaut 15 % de la grille" e2e
muter src/domaine/depot.ts \
  "    contextes: ancienne.planches.map(contexteDUnePage)," \
  "    contextes: ancienne.planches.map((planche) => contexteDUnePage({ ...planche, buttons: planche.buttons.filter((c) => c.hidden !== true) }))," \
  "la migration v2 vers v3 ne perd aucune case"

# Lot 3 : la page d'accueil vide, créée à la demande
muter src/domaine/planche.ts \
  "c.id === idContexte ? { ...c, pages: [...c.pages, nouvellePage] } : c," \
  "c.id === idContexte ? { ...c, pages: [nouvellePage] } : c," \
  "la nouvelle page s'ajoute en fin de liste, jamais en remplacement"
muter src/domaine/planche.ts \
  "  while (pris.has(\`\${idContexte}-p\${suffixe}\`)) suffixe++" \
  "  while (false) suffixe++" \
  "l'identifiant de la nouvelle page ne réutilise jamais un identifiant déjà pris"
muter src/composants/EspaceParents.vue \
  "...props.configuration.contextes.map((c) => ({ id: c.id, name: c.name }))," \
  "...props.configuration.contextes.flatMap((c) => c.pages.map((p) => ({ id: p.id, name: c.name })))," \
  "le sélecteur ne liste que les contextes, jamais leurs pages"
muter src/composants/EspaceParents.vue \
  "const pageMasqueeEntierement = computed(() => !pageAtteignable(plancheChoisie.value))" \
  "const pageMasqueeEntierement = computed(() => false)" \
  "le repère « pas encore visible » s'affiche sur une page sans case révélée" e2e

muter src/domaine/planche.ts \
  "  return derniere !== undefined && pageAtteignable(derniere)" \
  "  return true" \
  "on ne peut pas enchaîner deux pages vides"

# Ergonomie sur écran large
muter src/composants/EspaceParents.vue \
  "  flex: 1;
  min-width: 0;
  max-width: var(--largeur-grille);" \
  "  max-width: var(--largeur-grille);" \
  "la grille des parents occupe la largeur disponible" e2e

# Lot 4 : sauvegarde et restauration
muter src/domaine/archive.ts \
  "if (brut.hidden !== undefined) contenu.hidden = brut.hidden as boolean" \
  "if (false) contenu.hidden = brut.hidden as boolean" \
  "B5 l'aller-retour garde hidden"
muter src/domaine/archive.ts \
  "pages: contexte.pages.map((page) => page.id)," \
  "pages: contexte.pages.map((page) => page.id).reverse()," \
  "B5 l'aller-retour garde l'ordre des pages d'un contexte"
muter src/domaine/archive.ts \
  "casesRevelees: cases.filter((contenu) => contenu.hidden !== true).length," \
  "casesRevelees: cases.length," \
  "B2 l'inventaire ne compte pas les cases masquées comme révélées"
muter src/domaine/archive.ts \
  "if (!Array.isArray(manifeste.ext_mesmots_contextes) || typeof manifeste.ext_mesmots_barre !== 'string') {" \
  "if (false) {" \
  "B3 la lecture refuse une archive sans nos extensions"

# Radar E4 : les trois défauts critiques trouvés en adversarial
muter src/domaine/depot.ts \
  "return JSON.parse(JSON.stringify(configuration)) as Configuration" \
  "return configuration" \
  "R-E4 une écriture ne part jamais avec un proxy réactif" e2e
muter src/composants/VerrouParents.vue \
  "  if (pointeurEnCours !== null) return" \
  "" \
  "R-E4 un effleurement à deux doigts n'ouvre pas le verrou"
muter src/composants/VerrouParents.vue \
  "  verrouilleJusquA = Date.now() + ATTENTE_APRES_ERREUR_MS" \
  "  verrouilleJusquA = 0" \
  "R-E4 une mauvaise réponse rend le coin inerte"
muter src/composants/EspaceParents.vue \
  "  suppressionsAnnulables.value = suppressionsAnnulables.value.filter((s) => s !== aRendre)" \
  "  suppressionsAnnulables.value = []" \
  "R-E4 plusieurs suppressions se rattrapent, pas seulement la dernière" e2e
muter src/composants/EspaceParents.vue \
  "    const emplacementLibre = planches.find((p) => p.id === idPlanche)?.grid.order[ligne]?.[colonne] === null" \
  "    const emplacementLibre = true" \
  "R-E4 une annulation ne promet jamais un emplacement repris" e2e
muter src/composants/VerrouParents.vue \
  "    question.value = tirerLaQuestion()" \
  "" \
  "R-E4 l'addition change à chaque ouverture"
muter src/domaine/depot.ts \
  "    connexion = null
    throw cause" \
  "    throw cause" \
  "R-E4 une ouverture ratée ne condamne pas la session"

# Lot 4 : compte rendu, confirmation avant remplacement, rappel de sauvegarde (B2, B3, B4)
muter src/composants/SauvegardeParents.vue \
  '<span data-cr-mots-visibles>{{ compteRendu.inventaire.casesRevelees }}</span>' \
  '<span data-cr-mots-visibles>{{ compteRendu.inventaire.cases }}</span>' \
  "B2 le compte rendu affiche les mots visibles, pas le total"
muter src/composants/RestaurationParents.vue \
  "    apercu.value = { configuration: lue.configuration, inventaire: lue.inventaire, ressources: lue.ressources }" \
  "    emit('restaurer', marquerSauvegardee(lue.configuration), lue.ressources)" \
  "B3 le remplacement attend la confirmation du parent"
muter src/domaine/planche.ts \
  "return { ...configuration, reglages: { ...configuration.reglages, modifieDepuisSauvegarde: true } }" \
  "return { ...configuration, reglages: { ...configuration.reglages, modifieDepuisSauvegarde: false } }" \
  "B4 toute écriture lève le drapeau de modification"
muter src/App.vue \
  "if (configuration.value?.reglages.modifieDepuisSauvegarde) {" \
  "if (false) {" \
  "B4 le rappel de sauvegarde s'affiche à la sortie" e2e

# Lot 3 : stockage des photos et sons de la famille (P4, P8)
muter src/domaine/planche.ts \
  "return reference?.startsWith(PREFIXE_PERSO) ? reference.slice(PREFIXE_PERSO.length) : undefined" \
  "return undefined" \
  "une référence perso/ n'est jamais servie depuis /images/ ou /sons/ comme les autres"
# Réécrite le 11 septembre : la ligne visée avait disparu de planche.ts, et la mutation avait
# été supprimée plutôt que repointée (D24). Le MP3 livré n'est pas un état par défaut où l'on
# reviendrait : renoncer à sa voix enregistrée laisse le mot au texte, pas à la voix d'usine.
muter src/domaine/planche.ts \
  "  const reference = choix.statut === 'nouveau' ? \`\${PREFIXE_PERSO}\${idCase}\` : undefined" \
  "  const reference = choix.statut === 'nouveau' ? \`\${PREFIXE_PERSO}\${idCase}\` : sonLivre(idCase)" \
  "V2 renoncer au son ne ramene pas le MP3 livre"
muter src/composables/photoDeCase.ts \
  "URL.revokeObjectURL(urlPersonnalisee.value)" \
  "undefined" \
  "l'URL d'objet de la photo personnalisée est bien libérée"
muter src/App.vue \
  "await restaurerRessourcesPersonnalisees(ressourcesPersonnalisees)" \
  "void ressourcesPersonnalisees" \
  "la restauration réécrit les photos et sons personnalisés dans leurs magasins" e2e
muter src/domaine/depot.ts \
  "      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config')" \
  "      if (db.objectStoreNames.contains('config')) db.deleteObjectStore('config')
      db.createObjectStore('config')" \
  "la montée de version 2 vers 4 ne perd pas une configuration déjà enregistrée"

# Lot 3 : capture d'une photo et d'un son (P4, P8)
muter src/domaine/image.ts \
  "{ imageOrientation: 'from-image' }" \
  "{}" \
  "P4 imageOrientation retiré, la photo se poserait couchée"
muter src/domaine/image.ts \
  "  canevas.width = largeur
  canevas.height = hauteur" \
  "  canevas.width = image.width
  canevas.height = image.height" \
  "P4 la photo est bien redimensionnée à la taille de la vignette"
# P4, A9 et A11 sont retires : ils gardaient la regle « retirer la photo ou la voix
# ramene le pictogramme et le MP3 livres ». L editeur en a decide autrement depuis,
# deux reponses et non trois : retirer l image laisse le mot en grand, retirer la voix
# laisse la tablette lire le texte. La regle gardee n existe plus, la mutation non plus.
muter src/App.vue \
  "  configuration.value = suivante
  await ecrireAuDepot('suppression', () => enregistrerConfiguration(suivante))
}" \
  "  configuration.value = suivante
  await effacerImage(idCase)
  await effacerSon(idCase)
  await ecrireAuDepot('suppression', () => enregistrerConfiguration(suivante))
}" \
  "P4/P8 les blobs ne sont effacés qu une fois l annulation impossible, jamais avant" e2e
muter src/composants/EspaceParents.vue \
  "              <VignetteCase :contenu=\"emplacement.contenu\" />" \
  "" \
  "P4 le parent voit la photo posée, il ne la devine pas" e2e
# Radar E5 : ce que le testeur adversarial a trouvé sur la sauvegarde
muter src/domaine/sauvegarde.ts \
  "  if (!type.startsWith(attendu)) throw new Error" \
  "  if (false) throw new Error" \
  "R-E5 une page HTML ne passe jamais pour une image"
muter src/domaine/planche.ts \
  "    images: retenir([
      ...cases.map((c) => c.image_id)," \
  "    images: retenir([" \
  "R-E5 les photos encore utilisées ne sont jamais purgées"
# Photos et sons, ce que la discussion du 8 septembre a fixé
muter src/domaine/image.ts \
  "  const hauteur = Math.max(1, Math.round(image.height * facteur))" \
  "  const hauteur = largeur" \
  "P4 une photo garde ses proportions, jamais un visage écrasé"
muter src/composants/EditeurCase.vue \
  "{ mimeType: format, audioBitsPerSecond: 32_000 }" \
  "{ mimeType: format }" \
  "P8 le son s'enregistre au débit de la parole, pas à celui par défaut"
muter src/composants/EditeurCase.vue \
  "  minuteurEnregistrement = window.setTimeout(arreterEnregistrement, DUREE_ENREGISTREMENT_MAXIMALE_MS)" \
  "" \
  "P8 un enregistrement oublié s'arrête tout seul"
muter src/domaine/archive.ts \
  "        if (cumul > TAILLE_DECOMPRESSEE_MAXIMALE) throw new Error('archive trop volumineuse')" \
  "" \
  "R-E5 une archive piégée est refusée avant de figer la tablette"
muter src/domaine/archive.ts \
  "  if (manifeste.format !== FORMAT_OBF) {" \
  "  if (false) {" \
  "R-E5 un format inconnu est refusé au lieu d'être deviné"
muter src/composants/EspaceParents.vue \
  "  --largeur-grille: calc(var(--colonnes) * 200px + (var(--colonnes) - 1) * 10px);" \
  "  --largeur-grille: none;" \
  "les cartes des parents gardent une proportion de case sur grand écran" e2e
muter src/composants/EspaceParents.vue \
  "    visibles: inventaire.casesRevelees," \
  "    visibles: inventaire.cases," \
  "le bloc d'état dit le vrai nombre de mots visibles"
muter src/composants/EditeurCase.vue \
  "const texteChangeSansVoix = computed(
  () =>
    !!props.caseExistante &&" \
  "const texteChangeSansVoix = computed(
  () =>
    false &&" \
  "P8 le texte reecrit sans la voix qui suit, l editeur previent le parent"
muter src/domaine/taille.ts \
  "  if (octets >= Go) return \`\${virgule(octets / Go)} Go\`" \
  "" \
  "une taille en gigas se dit en gigas, pas en mégas sans unité"
muter src/composants/EspaceParents.vue \
  "  grid-template-rows: repeat(var(--lignes), 150px);" \
  "  grid-template-rows: repeat(var(--lignes), 120px);" \
  "les cartes des parents ne se chevauchent pas" e2e
muter src/composants/EspaceParents.vue \
  "  flex: 1;
  display: flex;
  /* Pas de min-height: 0" \
  "  flex: 1;
  display: flex;
  min-height: 0;
  /* Pas de min-height: 0" \
  "le pied de l'espace parents ne recouvre pas la dernière rangée" e2e
# Revue en aveugle des médias, 8 septembre
muter src/domaine/planche.ts \
  "  if (tousLesIdentifiants(configuration).has(caseAPlacer.id)) return configuration" \
  "" \
  "une case ne se pose jamais sous un identifiant déjà pris ailleurs"
muter src/domaine/planche.ts \
  "  return mediasLivres.get(idCase)?.sound_id" \
  "  return idCase" \
  "P8 un mot de la famille n'a pas de MP3 livré, retirer sa voix ne laisse rien derrière"
muter src/composants/EditeurCase.vue \
  "  if (demarrageEnCours) return
  demarrageEnCours = true" \
  "  demarrageEnCours = true" \
  "P8 deux appuis rapides n'ouvrent qu'un seul micro"
muter src/composants/EditeurCase.vue \
  "  flux?.getTracks().forEach((piste) => piste.stop())" \
  "" \
  "P8 le micro est vraiment relâché à l'arrêt"
muter src/composants/EditeurCase.vue \
  "  if (enregistreur?.state === 'recording') enregistreur.stop()" \
  "  enregistreur?.stop()" \
  "P8 un second arrêt ne rappelle pas stop sur un enregistreur arrêté"
muter src/composants/EditeurCase.vue \
  "    !litLeTexte.value &&
    !nouveauSon.value &&" \
  "    !nouveauSon.value &&" \
  "P8 le coup de coude se tait des que la tablette lit le texte"
muter src/composables/photoDeCase.ts \
  "      if (!actif || identifiantPersonnalise(referenceImage.value) !== idPerso) return" \
  "      if (identifiantPersonnalise(referenceImage.value) !== idPerso) return" \
  "aucune URL d'objet n'est créée pour un composant déjà démonté"
muter src/composants/EspaceParents.vue \
  "    return emplacementLibre && identifiantLibre" \
  "    return emplacementLibre" \
  "une annulation ne promet pas une case dont l'identifiant a été repris"
muter src/composants/EspaceParents.vue \
  "const pluriel = (n: number, mot: string) => \`\${n} \${mot}\${n > 1 ? 's' : ''}\`" \
  "const pluriel = (n: number, mot: string) => \`\${n} \${mot}s\`" \
  "le bloc d'état accorde ses pluriels"
muter src/domaine/depot.ts \
  "        await db.delete(magasin, cle)
        effaces += 1" \
  "        effaces += 1" \
  "la purge des orphelins efface vraiment"
muter src/domaine/planche.ts \
  "  return mediasLivres.get(idCase)?.image_id" \
  "  return \`pictos/\${idCase}.svg\`" \
  "P4 retirer la photo d'un mot de la famille ne fabrique pas une référence vers un fichier absent"
muter src/composants/EditeurCase.vue \
  "    if (!monte) {
      arreterLesPistes()
      return
    }" \
  "" \
  "P8 onstop après le démontage ne crée aucune URL d'objet"

muter src/composables/photoDeCase.ts \
  "    contenu," \
  "    referenceImage," \
  "P4 remplacer la photo d'un mot relit le dépôt, la référence ne changeant pas" e2e

muter src/domaine/palette.ts \
  "  return { background_color: famille.fond, border_color: famille.anneau }" \
  "  return { background_color: famille.fond, border_color: famille.fond }" \
  "D14 la graine tire ses couleurs de la palette, anneau compris"

muter src/App.vue \
  "        : \"Le dernier changement n'a pas pu être enregistré. Refaites-le. S'il échoue encore, redémarrez la tablette.\"" \
  "        : ''" \
  "D13 un enregistrement en échec le dit à l'écran" e2e

muter src/domaine/depot.ts \
  "  const db = await ouvrir()
  await db.put(magasin, blob, idCase)" \
  "  try {
    const db = await ouvrir()
    await db.put(magasin, blob, idCase)
  } catch {
    return
  }" \
  "M1 l'écriture d'une photo ou d'une voix n'avale pas son erreur"
muter src/composants/EditeurCase.vue \
  "  if (!monte) {
    arreterLesPistes()
    return
  }
" \
  "" \
  "M2 la permission accordée après la fermeture ne démarre aucun enregistrement"
muter src/composants/EditeurCase.vue \
  "    const vignette = await redimensionnerImage(fichier)
    if (choix !== dernierChoixPhoto) return" \
  "    const vignette = await redimensionnerImage(fichier)" \
  "M3 c'est la dernière photo choisie qui reste, pas la plus lente"

muter src/domaine/archive.ts \
  "  return extension ? \`\${sansExtension(chemin)}.\${extension}\` : chemin" \
  "  return chemin" \
  "D16 un enregistrement porte dans l'archive l'extension de son vrai format"
muter src/domaine/sauvegarde.ts \
  "new Blob([octets as Uint8Array<ArrayBuffer>], { type: typeDesOctets(octets) })" \
  "new Blob([octets as Uint8Array<ArrayBuffer>])" \
  "D18 le type d'un blob revient avec lui à la restauration"
muter src/domaine/archive.ts \
  "  return {
    images: manquants.filter((reference) => reference.startsWith('images/')).length,
    sons: manquants.filter((reference) => reference.startsWith('sons/')).length,
  }" \
  "  return { images: 0, sons: 0 }" \
  "D17 l'aperçu de restauration annonce les médias absents du fichier"

muter src/domaine/archive.ts \
  "    if (!idPerso || apportes.has(\`\${magasin}/\${idPerso}\`)) return reference
    return livre(idPerso)" \
  "    return reference" \
  "R1 un média absent du fichier retombe sur celui livré, comme l'aperçu le promet"
muter src/App.vue \
  "  const perso = identifiantsPersonnalises(configuration.value)
  void purgerRessourcesOrphelines(perso.images, perso.sons)" \
  "" \
  "R2 les blobs orphelins sont balayés au démarrage" e2e

muter src/composants/EspaceParents.vue \
  "        v-if=\"!effacementDemande\"" \
  "        v-if=\"false\"" \
  "P10 l'effacement complet demande confirmation avant d'effacer" e2e
muter src/domaine/depot.ts \
  "  await Promise.all([db.clear('config'), db.clear('images'), db.clear('sons'), db.clear('journal')])" \
  "  await db.clear('config')" \
  "P10 l'effacement emporte aussi les photos et les voix" e2e

muter src/composants/EditeurCase.vue \
  "  if (!type?.startsWith('audio/')) {" \
  "  if (false) {" \
  "A8 un fichier qui n'est pas un son est refusé, quel que soit son nom"
muter src/composants/EditeurCase.vue \
  "  if (fichier.size > POIDS_SON_MAXIMAL) {" \
  "  if (false) {" \
  "A8 un fichier trop lourd pour un mot est refusé"

muter src/composables/sonDeCase.ts \
  "    return referenceSon.value ? urlLivree(\`sons/\${referenceSon.value}.mp3\`) : null" \
  "    return null" \
  "A11 le parent peut écouter la voix livrée avant de la refaire"

muter src/domaine/planche.ts \
  "  if (arrivee.grid.order[ligne]?.[colonne] !== null) return configuration" \
  "" \
  "P6 déplacer une case refuse un emplacement occupé"
muter src/domaine/planche.ts \
  "        if (indexLigne === origine.ligne && indexColonne === origine.colonne) return null" \
  "        if (false) return null" \
  "P6 la place quittée est vraiment liberée"
muter src/composants/EspaceParents.vue \
  "  emit('deplacer', deplacement.value.idPlanche, deplacement.value.contenu.id, plancheChoisie.value.id, ligne, colonne)" \
  "" \
  "P6 poser la case l'emmene vraiment a sa nouvelle place" e2e

muter src/domaine/reglages.ts \
  "  FERMETES.find((niveau) => niveau.cle === cle) ?? FERMETES[0]!" \
  "  FERMETES[0]!" \
  "P9 la fermete choisie est celle qui s'applique" e2e
muter src/domaine/reglages.ts \
  "    largeur: (largeur - espacement * (colonnes + 1)) / colonnes / pxParCm," \
  "    largeur: (largeur - espacement * colonnes) / colonnes / pxParCm," \
  "P9 la taille de case lue en centimetres compte tous les espacements en largeur"
muter src/domaine/reglages.ts \
  "    hauteur: (hauteur * partGrille - espacement * (lignes + 1)) / lignes / pxParCm," \
  "    hauteur: (hauteur * partGrille - espacement * lignes) / lignes / pxParCm," \
  "P9 la taille de case lue en centimetres compte tous les espacements en hauteur"
# Ancré sur la ligne du dessus : `jouerBlob` porte les deux mêmes lignes, et `muter` ne
# remplace que la première occurrence, donc le motif nu mutait l'autre méthode.
muter src/domaine/lecteurAudio.ts \
  "    const audio = new Audio(source)
    audio.volume = this.volume" \
  "    const audio = new Audio(source)" \
  "P9 le volume choisi s'applique a la lecture"
muter src/domaine/depot.ts \
  "  const reglages = {
    ...REGLAGES_PAR_DEFAUT,
    ...configuration.reglages," \
  "  const reglages = {
    ...configuration.reglages," \
  "P9 un reglage arrive apres coup recoit sa valeur par defaut"

muter src/composants/GrilleCommunication.vue \
  "        :parle=\"props.idCaseQuiParle === emplacement.contenu.id\"" \
  "        :parle=\"false\"" \
  "la case vit pendant que son mot est dit" e2e
muter src/App.vue \
  "  configuration.value?.reglages.animations ? idCaseQuiParle.value : null," \
  "  idCaseQuiParle.value," \
  "le reglage eteint vraiment l'animation de la case" e2e

muter src/App.vue \
  "<span :key=\"dernierePhrase\" :class=\"{ dite: !!caseAnimee }\" data-phrase-dite>" \
  "<span :key=\"dernierePhrase\" :class=\"{ dite: false }\" data-phrase-dite>" \
  "le mot se remplit d'encre pendant que la tablette le dit" e2e

muter src/App.vue \
  "  derniereCase.value = contenu" \
  "" \
  "l'image du mot rejoint le texte dans la bande du haut" e2e

muter src/composants/CaseCommunication.vue \
  "  object-fit: contain;" \
  "  object-fit: cover;" \
  "une photo n'est jamais recadree, elle garde ses proportions" e2e

muter src/composants/EspaceParents.vue \
  "      emit('echanger', deplacement.value.idPlanche, deplacement.value.contenu.id, plancheChoisie.value.id, idCase)" \
  "" \
  "P6 toucher un autre mot echange les deux places" e2e

muter src/composants/EspaceParents.vue \
  "  if (!navigator.onLine) {" \
  "  if (false) {" \
  "le bouton de mise a jour dit quoi faire hors ligne"

# Lot 9 : l'enchaînement des mots (POC), projet/PLAN-ENCHAINEMENT.md
muter src/domaine/phrase.ts \
  "if (phrase.length >= MOTS_MAXIMUM) return phrase" \
  "if (false) return phrase" \
  "N1 la bande s arrete a six mots"
muter src/domaine/phrase.ts \
  "return contenu.ext_mesmots_enchaine?.trim() || contenu.label" \
  "return contenu.label" \
  "N2 le mot d enchainement saisi par l adulte l emporte"
muter src/domaine/planche.ts \
  "  enchainement: false," \
  "  enchainement: true," \
  "N3 l enchainement est eteint a la livraison" e2e
muter src/App.vue \
  "  if (enchainement.value) phrase.value = ajouterALaPhrase(phrase.value, contenu)" \
  "  void 0" \
  "N4 la case touchee se pose dans la bande" e2e
muter src/App.vue \
  "  void jouerSon(contenu, () => lireDepuis(rang + 1))" \
  "  void jouerSon(contenu)" \
  "N5 la relecture enchaine les voix jusqu au bout" e2e
muter src/App.vue \
  "  if (litLaPhrase.value) return arreterLaRelecture()" \
  "  if (false) return arreterLaRelecture()" \
  "N6 un second appui coupe la relecture" e2e
muter src/App.vue \
  "  phrase.value = retirerLeDernierMot(phrase.value)" \
  "  void 0" \
  "N7 la fleche retire le dernier mot" e2e
muter src/App.vue \
  "  arreterLaRelecture()
  phrase.value = []" \
  "  arreterLaRelecture()" \
  "N8 la croix vide la bande" e2e
muter src/App.vue \
  "  litLaPhrase.value = false
  void jouerSon(contenu)" \
  "  void jouerSon(contenu)" \
  "N10 un mot demande pendant la relecture l interrompt" e2e
muter src/domaine/archive.ts \
  "      ...REGLAGES_PAR_DEFAUT," \
  "" \
  "N11 une archive ancienne recoit le reglage eteint"
muter src/App.vue \
  "  idCaseQuiParle.value = null
}

function retirerLeDernier()" \
  "}

function retirerLeDernier()" \
  "N12 couper la relecture eteint la case qui parlait" e2e
# Pas de mutation sur les deux garde-fous de mise en page de la bande (`minmax(0, 1fr)`,
# l'image en absolu) : mesuré sur deux moteurs et quatre formats, les retirer ne déplace pas
# un pixel. Ils protègent d'un défaut que le code d'aujourd'hui n'a plus, aucun test ne peut
# les défendre.
# La zone ne se retire plus de la bande, elle passe dessous : c'est le contraire qu'il faut
# garder, que les commandes de l'enfant restent devant elle et que les deux blancs restent
# aux parents. Sans ce relief, l'appui du parent porte partout et l'enfant ne peut plus
# effacer ; sans les blancs, le parent est dehors, ce qui est arrivé le 11 septembre.
muter src/App.vue \
  ".mots-poses,
.gestes-phrase {
  z-index: 101;" \
  ".mots-poses,
.gestes-phrase {
  z-index: auto;" \
  "N9 les commandes de l enfant passent devant la zone des parents" e2e


# Lot 8 : la voix de la tablette, et la mise en page à trois largeurs
muter src/domaine/planche.ts \
  "if (contenu.sound_id) return { genre: 'livre', idSon: contenu.sound_id }" \
  "if (false) return { genre: 'livre', idSon: contenu.sound_id }" \
  "V1 un MP3 livré garde la parole"
muter src/composants/EditeurCase.vue \
  "  intentionSon.value === 'aucun' ? undefined : props.caseExistante?.sound_id," \
  "  props.caseExistante?.sound_id," \
  "V2 renoncer a la voix laisse la tablette lire le texte"
muter src/domaine/lecteurAudio.ts \
  "      speechSynthesis.cancel()" \
  "      void 0" \
  "V3 un nouveau mot coupe le texte en cours de lecture"
muter src/domaine/lecteurAudio.ts \
  "    phrase.onerror = finir" \
  "    phrase.onerror = null" \
  "V4 une voix absente éteint quand même la case"
muter src/App.vue \
  "  max-width: calc(100dvh * 0.625);" \
  "  max-width: none;" \
  "V5 la forme de tablette debout sur un écran large" e2e
muter src/composants/ControlePagination.vue \
  "  height: min(78%, 64px);" \
  "  height: 78%;" \
  "V6 la fleche de page ne grossit pas avec l ecran" e2e
muter src/composants/BoutonContexte.vue \
  "  height: min(78%, 64px);" \
  "  height: 78%;" \
  "V7 le bouton de contexte ne grossit pas avec l ecran" e2e

# Lot forme de grille : le seul réglage qui déplace des mots, voir projet/PLAN-FORME-GRILLE.md
muter src/domaine/planche.ts \
  "      const tientEncore = indexLigne < forme.lignes && indexColonne < forme.colonnes" \
  "      const tientEncore = indexLigne < forme.lignes && indexColonne <= forme.colonnes" \
  "F1 un mot de la colonne coupee n'est pas annonce comme garde"
muter src/domaine/planche.ts \
  "          if (contenu) ramasses.push(contenu)" \
  "          if (contenu && contenu.hidden !== true) ramasses.push(contenu)" \
  "F2 un mot masque de la colonne coupee est ramasse comme les autres"
muter src/domaine/planche.ts \
  "      return { ...contexte, pages: [...pages, ...nouvelles] }" \
  "      return { ...contexte, pages: [...nouvelles, ...pages] }" \
  "F3 la page nouvelle s'ajoute en fin de contexte"
muter src/composants/ReglagesParents.vue \
  "  () => coteDeCaseEnCm(forme.value.colonnes, forme.value.lignes) < COTE_DE_CASE_MINIMUM_CM," \
  "  () => coteDeCaseEnCm(forme.value.colonnes, forme.value.lignes) < 0," \
  "F4 la case trop petite pour un doigt d'enfant est signalee"
muter src/composants/ReglagesParents.vue \
  "  () => \`\${formeActuelle.value.colonnes}x\${formeActuelle.value.lignes}\`," \
  "  formeActuelle," \
  "F6 un autre reglage n'efface pas la forme en cours de choix"
muter src/App.vue \
  "  const suivante = marquerModifiee(changerFormeDeGrille(toRaw(configuration.value), forme))" \
  "  const suivante = marquerModifiee(toRaw(configuration.value))" \
  "F5 la grille reecrite est bien celle qui part au depot" e2e

muter src/domaine/planche.ts \
  "          if (contenu) ramasses.push(contenu)" \
  "          if (contenu) ramasses.push({ ...contenu, image_id: undefined, sound_id: undefined })" \
  "F7 un mot deplace emporte sa photo et sa voix"
muter src/domaine/planche.ts \
  "  const pages = pagesCreees === 1 ? 'une page nouvelle' : \`\${pagesCreees} pages nouvelles\`" \
  "  const pages = 'une page nouvelle'" \
  "F8 le nombre de pages annonce est celui qui sera cree"
# Pas de motif sur le garde-fou `forme.lignes < 1` : le retirer fait boucler l'appel sans
# fin, et vitest ne peut pas interrompre une boucle synchrone. Le banc resterait suspendu au
# lieu de rougir. Le test « ne fait rien plutot que de geler sur une sauvegarde abimee » est
# la garde, et il tomberait par suspension : mesure prise a la main, sortie 124 sur timeout 15.
muter src/composants/ReglagesParents.vue \
  "              :disabled=\"forme[axe.cle] >= FORME_MAXIMUM\"" \
  "              :disabled=\"forme[axe.cle] > FORME_MAXIMUM\"" \
  "F10 le compteur s eteint a huit"
# Pas de motif sur le `Math.max(FORME_MINIMUM, ...)` du compteur : les liaisons `disabled`
# bornent avant lui, aucun clic ne l'atteint, et un clic sur un bouton eteint n'est meme pas
# dispatche en test. Mesure : la mutation reste verte. La borne reste dans le calcul, c'est
# elle qui porte la regle, l'attribut `disabled` ne fait que la montrer.

# Le redemarrage propose apres une mise a jour, 10 septembre
muter src/App.vue \
  "    nouvelleVersionPrete.value = true" \
  "    nouvelleVersionPrete.value = false" \
  "M1 le redemarrage est propose des que la version prend la main"
muter src/App.vue \
  "if (navigator.serviceWorker?.controller) {" \
  "if (navigator.serviceWorker) {" \
  "M2 la premiere installation ne passe pas pour une mise a jour"
muter src/composants/EspaceParents.vue \
  "    if (props.nouvelleVersionPrete) return" \
  "" \
  "M3 une version arrivee pendant la recherche n est pas annoncee deja a jour"

# Le haut du corps remesure sur la planche « J'ai mal », 11 septembre
muter src/domaine/silhouette.ts \
  "    cou: [{ gauche: 29.2, haut: 13, largeur: 41.6, hauteur: 4.4 }]," \
  "    cou: [{ gauche: 38.3, haut: 18.5, largeur: 23.3, hauteur: 5.1 }]," \
  "V1 le cou est pose sur le cou du dessin et non sur les clavicules" e2e
muter src/domaine/silhouette.ts \
  "    tete: [{ gauche: 29.2, haut: 0.8, largeur: 40, hauteur: 12.1, ronde: true }]," \
  "    tete: [{ gauche: 29.2, haut: 0.8, largeur: 40, hauteur: 17.6, ronde: true }]," \
  "V2 la tete s arrete au menton et ne descend pas sur les epaules"
muter src/domaine/silhouette.ts \
  "    ventre: [{ gauche: 29.2, haut: 17.5, largeur: 41.6, hauteur: 29.5 }]," \
  "    ventre: [{ gauche: 29.2, haut: 23.7, largeur: 41.6, hauteur: 23.3 }]," \
  "V3 le ventre part de la ligne des epaules, le haut du torse repond" e2e

# L'espace parents réorganisé en trois pages, 11 septembre
muter src/composants/EspaceParents.vue \
  "  if (!aLibre(plancheChoisie.value)) {" \
  "  if (false) {" \
  "R1 « Ajouter un mot » amene sur une page qui a de la place"
muter src/composants/EspaceParents.vue \
  "  const libre = pagesAffichees.value.findIndex(aLibre)
  if (libre === -1) {" \
  "  const libre = pagesAffichees.value.findIndex(aLibre)
  if (false) {" \
  "R2 la grille pleine partout le dit au lieu d ouvrir un mode sans cible"
muter src/composants/EspaceParents.vue \
  "  ajout.value = 'inactif'
  edition.value = { caseExistante: null, ligne, colonne }" \
  "  edition.value = { caseExistante: null, ligne, colonne }" \
  "R3 poser le mot referme le mode de choix de place"
muter src/composants/EspaceParents.vue \
  "const aSauvegarder = computed(() => props.configuration.reglages.modifieDepuisSauvegarde === true)" \
  "const aSauvegarder = computed(() => false)" \
  "R4 l etat dit si le travail est dans un fichier de sauvegarde"
muter src/composants/EspaceParents.vue \
  ".case-parent .etat {
  position: absolute;" \
  ".etat {
  position: absolute;" \
  "R5 la pastille des cartes n emporte pas la ligne d inventaire" e2e
muter src/composants/ReglagesParents.vue \
  "      <p v-if=\"!formeChangee\" class=\"aide\" data-forme-invite>" \
  "      <p v-if=\"false\" class=\"aide\" data-forme-invite>" \
  "R6 au repos, une invite remplace le bouton de forme grise"
muter src/composants/ReglagesParents.vue \
  "@click=\"formeEssayee = null\"" \
  "@click=\"formeEssayee = formeEssayee\"" \
  "R7 « Annuler » remet les compteurs au present"
muter src/composants/EspaceParents.vue \
  ":class=\"{ effacee: !!deplacement || ajout !== 'inactif' }\"" \
  ":class=\"{ effacee: !!deplacement }\"" \
  "R8 pendant un ajout, « Deplacer » n est plus touchable"
muter src/composants/EspaceParents.vue \
  ".actions-carte.effacee {
  display: none;" \
  ".actions-carte.effacee {
  visibility: hidden;" \
  "D27 pendant un deplacement toutes les cellules ont la meme hauteur" e2e
muter src/composants/EspaceParents.vue \
  "  ajout.value = 'inactif'
  pageDuSaut.value = null
})" \
  "})" \
  "R9 changer de contexte efface « plus de place »"
# Remplace la mutation de `.bandeau-mode` : le bandeau n'a plus de position à lui, il est une
# rangée du bloc collé et ne peut plus recouvrir les onglets. Ce qui se casse encore, c'est le
# bloc lui-même, qui emporterait la barre d'onglets hors de l'écran d'un téléphone.
muter src/composants/EspaceParents.vue \
  ".tete-collee {
  position: sticky;" \
  ".tete-collee {
  position: static;" \
  "D25 la barre d onglets reste atteignable au bas des reglages" e2e
muter src/composants/CaseCommunication.vue \
  ".illustration img.photo {
  object-fit: cover;" \
  ".illustration img.photo {
  object-fit: contain;" \
  "D29 une photo de famille remplit sa case" e2e

# Sept fichiers avaient des tests sans qu'aucun motif ne prouve qu'ils mordent. Les voici,
# du plus grave au moins grave : ce qui touche aux données de la famille d'abord.

# livraison.ts porte EG-10 : une mise à jour ajoute, elle ne reprend ni ne remplace rien.
muter src/domaine/livraison.ts \
  "configuration.ext_mesmots_livraisons ?? livraisonsSupposees(configuration, graine)," \
  "configuration.ext_mesmots_livraisons ?? []," \
  "D30 une tablette en service ne revoit pas ce qu elle a supprime"
muter src/domaine/livraison.ts \
  "if (planche.grid.order[position.ligne]?.[position.colonne] !== null) return planche" \
  "if (planche.grid.order[position.ligne]?.[position.colonne] === null) return planche" \
  "D31 un mot livre ne se pose que sur une place libre"
muter src/domaine/livraison.ts \
  "      !present.ext_mesmots_image && contexteGraine.ext_mesmots_image" \
  "      contexteGraine.ext_mesmots_image && contexteGraine.ext_mesmots_image" \
  "D32 l image d un contexte livre ne remplace jamais celle de la famille"

# La sauvegarde faite depuis le rappel doit rendre la configuration marquée, sinon le rappel
# revient au lancement suivant et la mère apprend à le refermer sans le lire.
muter src/composants/RappelSauvegarde.vue \
  "emit('sauvegarder', configurationSauvegardee)" \
  "emit('sauvegarder', props.configuration)" \
  "D33 le rappel de sauvegarde ne revient pas apres avoir sauvegarde" e2e

# journal.ts : le plus récent en haut, l'effacement à minuit, les deux conditions de la mère.
muter src/domaine/journal.ts \
  ".sort((a, b) => b.horodatage - a.horodatage)" \
  ".sort((a, b) => a.horodatage - b.horodatage)" \
  "D34 le journal met en haut ce qu il vient de demander"
muter src/domaine/journal.ts \
  "unJour(entree.horodatage) !== jour" \
  "unJour(entree.horodatage) === jour" \
  "D35 le journal efface ce qui n est pas du jour"
muter src/domaine/journal.ts \
  "if (heure === 0) return 'Vers minuit'" \
  "if (heure === 24) return 'Vers minuit'" \
  "D36 minuit se dit au lieu de se chiffrer"

# Le papier est le miroir de l'écran : un mot caché y laisse sa place vide, une planche sans
# mot révélé ne sort pas. Sans ça l'enfant cherche sur la table ce qu'il n'a pas sur l'écran.
muter src/composants/PlanchesAImprimer.vue \
  "planche.buttons.some((contenu) => !contenu.hidden)" \
  "planche.buttons.some((contenu) => !!contenu)" \
  "D37 aucune feuille imprimee sans un seul mot revele" e2e
muter src/composants/PlanchesAImprimer.vue \
  "contenu: contenu && !contenu.hidden ? contenu : null," \
  "contenu: contenu ? contenu : null," \
  "D38 un mot cache laisse sa place vide sur le papier" e2e
muter src/composants/PlanchesAImprimer.vue \
  "  .dessin :deep(.vignette) {
    height: 100%;
  }" \
  "  .dessin :deep(.vignette) {
    height: 44px;
  }" \
  "D51 le dessin remplit sa case sur le papier, il n y reste pas en timbre" e2e

# T8 : le glissement tourne la page, et la case sous le doigt renonce à parler.
muter src/composables/glissementPage.ts \
  "if (deplacement && leDoigtAGlisse(deplacement)) appuiRenonce.value = true" \
  "if (deplacement && leDoigtAGlisse(deplacement)) appuiRenonce.value = false" \
  "D39 une page tournee au doigt ne fait pas parler la case" e2e
muter src/composables/glissementPage.ts \
  "allerVersLaPage(decision === 'page-suivante' ? 1 : -1)" \
  "allerVersLaPage(decision === 'page-suivante' ? -1 : 1)" \
  "D40 le glissement va du bon cote" e2e

# « J'ai mal » : le doigt reste accroché à la zone où il s'est posé, et le cadre reste carré
# au dessin, sinon les régions se décollent du corps.
muter src/composants/SilhouetteCommunication.vue \
  "if (enfoncee.value !== cle) return" \
  "if (enfoncee.value === cle) return" \
  "D41 une zone du corps relachee dit son mot" e2e
muter src/composants/SilhouetteCommunication.vue \
  "  aspect-ratio: 240 / 500;" \
  "  aspect-ratio: 1 / 1;" \
  "D42 les regions restent posees sur le corps" e2e

# La vignette d'une carte parent est bornée en hauteur : sans borne, elle grandit les cartes
# et « Modifier » passe sous la carte suivante, hors d'atteinte.
muter src/composants/VignetteCase.vue \
  "  height: 44px;" \
  "  height: 144px;" \
  "D43 la vignette ne fait pas grandir les cartes des parents" e2e

# D21 : deux contextes du même nom donnent à l'enfant deux boutons qu'il ne distingue pas.
muter src/domaine/planche.ts \
  "  if (contexteDuMemeNom(configuration, propre)) return configuration" \
  "  if (contexteDuMemeNom(configuration, '')) return configuration" \
  "D44 deux contextes ne portent jamais le meme nom"
muter src/domaine/planche.ts \
  "  const reduit = enIdentifiant(nom)" \
  "  const reduit = nom" \
  "D45 un nom de contexte se compare sans accent ni casse"

# « J'ai mal » se montre en corps ou en cases, au choix du parent. Livré en cases : les deux
# corps dessinés faisaient peur à l'enfant.
muter src/domaine/planche.ts \
  "  corpsAToucher: false,
}" \
  "  corpsAToucher: true,
}" \
  "D46 le corps a toucher est livre eteint"
muter src/App.vue \
  'v-if="page?.ext_mesmots_silhouette && corpsAToucher"' \
  'v-if="page?.ext_mesmots_silhouette"' \
  "D47 le reglage eteint rend la douleur en cases" e2e
muter src/domaine/planche.ts \
  "const COLONNES_DOULEUR = 4" \
  "const COLONNES_DOULEUR = 5" \
  "D48 la douleur en cases se replie sur quatre colonnes, pas sur sa matrice de rangement"
muter src/domaine/planche.ts \
  "  const lignes = Math.max(1, Math.ceil(ids.length / COLONNES_DOULEUR))" \
  "  const lignes = 1" \
  "D49 aucun mot de douleur ne disparait faute de rangee"

# La démo publique est servie sous un préfixe. Une adresse écrite à la racine y rend une
# grille de cases vides, muette, sans la moindre erreur visible.
muter src/domaine/planche.ts \
  "  return import.meta.env.BASE_URL + chemin" \
  "  return '/' + chemin" \
  "D50 les pictogrammes et les voix se cherchent sous l adresse de l application"

# Le même piège, un appelant plus loin : la sauvegarde va chercher chaque ressource livrée
# par le réseau. Sous un préfixe, elle les déclare toutes manquantes et l'archive part vide.
muter src/domaine/sauvegarde.ts \
  "  const reponse = await fetch(urlLivree(chemin))" \
  "  const reponse = await fetch(\`/\${chemin}\`)" \
  "D52 la sauvegarde ramasse les ressources sous l adresse de l application"

# Une mutation vérifiée en bout en bout laisse dist/ construit depuis le code cassé.
# Sans cette reconstruction, la capture d'écran suivante montre la mutation, pas le code.
if [ $sautees -gt 0 ]; then echo "  $sautees mutations sautées, hors des fichiers modifiés"; fi
if [ $reconstruire -eq 1 ]; then
  ./node_modules/.bin/vite build > /dev/null 2>&1 || { echo "  reconstruction de dist/ en échec"; echec=1; }
fi

exit $echec
