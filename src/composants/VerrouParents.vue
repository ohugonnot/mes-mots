<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ ouvrir: [] }>()

/** Un enfant de 5 ans n'y arrive pas par accident, un parent le fait exprès (P1). */
const SEUIL_APPUI_LONG_MS = 3000
/**
 * L'addition change à chaque ouverture, et l'ordre des réponses aussi. Une question figée
 * ne protégeait que d'un devineur aveugle : l'enfant verra ce geste des centaines de fois
 * au fil des années, et le code du projet a vocation à être public. Il faut résoudre
 * l'addition, pas se souvenir d'une position.
 */
const NOMBRE_DE_CHOIX = 6

function entierEntre(bas: number, haut: number): number {
  return bas + Math.floor(Math.random() * (haut - bas + 1))
}

function tirerLaQuestion() {
  const gauche = entierEntre(3, 9)
  const droite = entierEntre(3, 9)
  const somme = gauche + droite
  // Les leurres s'écartent de la somme d'au moins trois : à plus ou moins quatre, six
  // nombres tenaient dans un intervalle de six, et il fallait les discriminer à la volée.
  // La mère est dyslexique et tient souvent l'enfant d'une main pendant qu'elle répond.
  const leurres = new Set<number>()
  while (leurres.size < NOMBRE_DE_CHOIX - 1) {
    const ecart = entierEntre(3, 12) * (Math.random() < 0.5 ? -1 : 1)
    const candidat = somme + ecart
    if (candidat !== somme && candidat > 0) leurres.add(candidat)
  }
  const choix = [somme, ...leurres].sort(() => Math.random() - 0.5)
  return { gauche, droite, somme, choix }
}
/** Vingt secondes : un parent qui se trompe attend une fois, un enfant qui insiste renonce. */
const ATTENTE_APRES_ERREUR_MS = 20_000

const questionOuverte = ref(false)
/**
 * L'appui en cours se voit. Sans repère, la mère lâchait à deux secondes et demie sans
 * savoir si elle appuyait au bon endroit ou si l'application était cassée. Discret et posé
 * dans un coin : c'est l'écran de l'enfant, il ne doit rien y voir apparaître qui l'attire.
 */
const appuiEnCours = ref(false)
/** Ce qui vient de se passer, quand ça a échoué. Deux échecs muets d'affilée, sinon. */
const message = ref('')
let effacementDuMessage: ReturnType<typeof setTimeout> | null = null

function dire(texte: string, dureeMs: number) {
  message.value = texte
  if (effacementDuMessage) clearTimeout(effacementDuMessage)
  effacementDuMessage = setTimeout(() => (message.value = ''), dureeMs)
}
const question = ref(tirerLaQuestion())
let minuteur: ReturnType<typeof setTimeout> | null = null
/** Le doigt qui a lancé le compte, pour qu'un autre ne puisse ni le prolonger ni l'annuler. */
let pointeurEnCours: number | null = null
/**
 * Après une mauvaise réponse, le coin ne répond plus pendant un moment. Sans ce délai,
 * une réponse au hasard parmi six suffisait : cinquante tentatives automatisées ont
 * ouvert l'espace parents douze fois, la première au bout de six secondes.
 */
let verrouilleJusquA = 0

function commencerAppui(evenement: PointerEvent) {
  // Un deuxième doigt posé pendant le premier écrasait la référence du minuteur : celui du
  // premier doigt continuait, orphelin, et ouvrait la question trois secondes plus tard
  // même si les deux doigts étaient partis en trois cents millisecondes. Un enfant qui
  // tape à plusieurs doigts entrait donc par effleurement.
  if (pointeurEnCours !== null) return
  if (verrouilleJusquA > Date.now()) {
    const reste = Math.ceil((verrouilleJusquA - Date.now()) / 1000)
    dire(`Encore ${reste} seconde${reste > 1 ? 's' : ''} avant de réessayer.`, 2500)
    return
  }
  pointeurEnCours = evenement.pointerId
  appuiEnCours.value = true
  minuteur = setTimeout(() => {
    question.value = tirerLaQuestion()
    questionOuverte.value = true
    appuiEnCours.value = false
    minuteur = null
    pointeurEnCours = null
  }, SEUIL_APPUI_LONG_MS)
}

function annulerAppui(evenement: PointerEvent) {
  // seul le doigt qui a lancé le compte peut l'arrêter
  if (pointeurEnCours !== evenement.pointerId) return
  pointeurEnCours = null
  appuiEnCours.value = false
  if (minuteur === null) return
  clearTimeout(minuteur)
  minuteur = null
}

function repondre(valeur: number) {
  questionOuverte.value = false
  if (valeur === question.value.somme) {
    verrouilleJusquA = 0
    emit('ouvrir')
    return
  }
  verrouilleJusquA = Date.now() + ATTENTE_APRES_ERREUR_MS
  dire('Ce n\'est pas le bon compte. Réessayez dans 20 secondes.', 6000)
}
</script>

<template>
  <!-- `contextmenu` coupé : sur la tablette, l'appui de trois secondes ouvrait le menu du
       système, reculer, avancer, actualiser, et le parent ne pouvait plus entrer chez lui. -->
  <div
    class="coin-parents"
    data-coin-parents
    @pointerdown="commencerAppui"
    @pointerup="annulerAppui"
    @pointerleave="annulerAppui"
    @pointercancel="annulerAppui"
    @contextmenu.prevent
  >
    <!-- La barre se remplit pendant les trois secondes, dans l'angle : le parent voit que
         son doigt est au bon endroit et combien il reste. Elle n'existe que pendant l'appui,
         et l'enfant n'a aucune raison de poser le doigt là. -->
    <span v-if="appuiEnCours" class="progression" data-progression-appui aria-hidden="true"></span>
  </div>

  <!-- Deux échecs se passaient en silence : une mauvaise réponse, et l'attente qui suit.
       La mère en concluait que l'application était cassée. -->
  <p v-if="message" class="message-verrou" data-message-verrou role="status">{{ message }}</p>

  <div v-if="questionOuverte" class="question" data-question-parents>
    <p class="enonce" data-enonce>Combien font {{ question.gauche }} + {{ question.droite }} ?</p>
    <div class="choix">
      <button
        v-for="valeur in question.choix"
        :key="valeur"
        type="button"
        class="reponse"
        :data-reponse="valeur"
        @click="repondre(valeur)"
      >
        {{ valeur }}
      </button>
    </div>
    <button type="button" class="abandonner" data-abandonner-question @click="questionOuverte = false">
      Annuler
    </button>
  </div>
</template>

<style scoped>
.coin-parents {
  /* Toute la première rangée de l'écran, sur toute sa largeur : la bande de phrase et le
     bleu qui l'entoure. Cette rangée est inerte, aucune case n'y perd de surface tactile,
     et la zone s'arrête avant les boutons de contexte, qui appartiennent à l'enfant. La
     moitié gauche ne suffisait pas : le bleu y est mince, et un doigt qui vise l'angle
     tombe à côté. */
  /* `fixed` et non `absolute` : sur un écran large, l'application se centre et laisse des
     marges de chaque côté. Un doigt posé dans la marge, en haut, ne trouvait rien. La zone
     couvre maintenant toute la largeur de la fenêtre, marges comprises. */
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  /* la hauteur de la première rangée de l'écran, celle de la phrase : elle s'arrête net
     avant les boutons de contexte, qui appartiennent à l'enfant */
  height: 12dvh;
  /* invisible et posé sur le seul coin où l'enfant n'a jamais de case : la bande de
     phrase, qui est inerte. Aucune case ne perd donc de surface tactile. */
  touch-action: manipulation;
  /* l'appui long est notre geste d'entrée : le système ne doit ni sélectionner, ni proposer
     sa loupe, ni ouvrir son propre menu par-dessus */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  /* au-dessus de la bande de phrase, sinon l'appui long n'atteindrait jamais ce coin */
  z-index: 100;
}

/* Une barre qui se remplit, posée dans l'angle du coin, et rien d'autre : ni chiffre, ni
   texte, ni couleur vive. C'est l'écran de l'enfant. */
.progression {
  position: absolute;
  top: 6px;
  left: 6px;
  height: 6px;
  width: 0;
  border-radius: 3px;
  background: var(--encre);
  opacity: 0.55;
  animation: remplir-appui 3000ms linear forwards;
}

@keyframes remplir-appui {
  to {
    width: 40%;
  }
}

/* Posé en haut, là où le parent regarde déjà puisqu'il vient d'y appuyer. */
.message-verrou {
  position: fixed;
  z-index: 150;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 90%;
  margin: 0;
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--encre);
  color: var(--blanc);
  font-family: system-ui, sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
}

.question {
  position: fixed;
  inset: 0;
  /* les réponses touchaient les deux bords de l'écran, encoche comprise */
  padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px))
           max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  z-index: 200;
  display: grid;
  place-items: center;
  /* sans ça les trois rangées s'étirent sur toute la hauteur de l'écran, et la question,
     les réponses et le bouton d'abandon se retrouvent à des centaines de pixels d'écart */
  align-content: center;
  gap: 24px;
  background: rgba(18, 48, 79, 0.94);
  color: var(--blanc);
  text-align: center;
}

.enonce {
  font-size: 1.5rem;
  font-weight: 600;
}

/* Sans le retour à la ligne, six réponses d'au moins 64 px dépassent la largeur d'un petit
   téléphone : la rangée reste centrée, déborde des deux côtés, et le parent ne peut plus
   entrer dans son espace dès que la bonne réponse tombe au bord. */
.choix {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.reponse {
  min-width: 64px;
  min-height: 64px;
  padding: 8px 16px;
  border: 2px solid var(--blanc);
  border-radius: 12px;
  background: transparent;
  color: var(--blanc);
  font-size: 1.3rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.abandonner {
  padding: 10px 20px;
  border: none;
  border-radius: 12px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 1rem;
  cursor: pointer;
  touch-action: manipulation;
}
</style>
