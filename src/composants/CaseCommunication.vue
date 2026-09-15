<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CaseCommunication } from '../domaine/planche'
import { utiliserPhotoDeCase } from '../composables/photoDeCase'

const props = defineProps<{ contenu: CaseCommunication; parle?: boolean }>()
const emit = defineEmits<{ appui: [debutMs: number, finMs: number] }>()

const enfoncee = ref(false)
const debutAppuiMs = ref(0)

const couleurs = computed(() => ({
  '--fond-etiquette': props.contenu.background_color ?? '#e8eef4',
  '--anneau': props.contenu.border_color ?? '#94a3b8',
}))

const { source: srcImage, photoDeFamille, signalerEchec: surErreurImage } = utiliserPhotoDeCase(
  computed(() => props.contenu),
)


/**
 * Le doigt reste accroché à la case où il s'est posé, même s'il en sort. Un enfant dont la
 * main dérive de quelques millimètres relâchait au-dessus de la case voisine, et n'obtenait
 * pas le mauvais mot : il n'obtenait rien. C'est l'endroit du premier contact qui compte.
 * Le glissement entre pages reste protégé ailleurs, par `appuiRenonce`, qui exige un
 * mouvement franchement horizontal.
 */
function commencerAppui(evenement: PointerEvent) {
  // La prise du pointeur n'est qu'un confort : un identifiant que le navigateur ne
  // connaît pas la fait échouer, et l'appui doit se poursuivre quand même.
  try {
    ;(evenement.currentTarget as HTMLElement).setPointerCapture?.(evenement.pointerId)
  } catch {
    /* pointeur déjà relâché, ou geste synthétique */
  }
  enfoncee.value = true
  debutAppuiMs.value = performance.now()
}

function terminerAppui() {
  if (!enfoncee.value) return
  enfoncee.value = false
  emit('appui', debutAppuiMs.value, performance.now())
}

function annulerAppui() {
  enfoncee.value = false
}
</script>

<template>
  <button
    class="case"
    :class="{ enfoncee, parle: props.parle }"
    :style="couleurs"
    type="button"
    :aria-label="props.contenu.vocalization"
    :data-case="props.contenu.id"
    @pointerdown="commencerAppui"
    @pointerup="terminerAppui"
    @pointercancel="annulerAppui"
  >
    <span class="illustration">
      <!-- draggable="false" : sans lui le navigateur démarre son propre glisser-déposer
           de l'image, annule le pointeur, et le glissement entre pages meurt (T8) -->
      <img
        v-if="srcImage"
        :src="srcImage"
        :class="{ photo: photoDeFamille }"
        alt=""
        draggable="false"
        @error="surErreurImage"
      />
      <span v-else class="mot-repere" aria-hidden="true">{{ props.contenu.label }}</span>
    </span>
    <!-- Sans image, le mot occupe déjà toute la case : la bande garde sa couleur et sa
         hauteur, qui tiennent la géométrie, mais ne répète pas ce qui est écrit au-dessus. -->
    <span class="etiquette">{{ srcImage ? props.contenu.label : '' }}</span>
  </button>
</template>

<style scoped>
.case {
  position: relative;
  display: flex;
  flex-direction: column;
  /* le mot se mesure à sa case et non à la fenêtre : deux écrans de même largeur peuvent
     donner des cases très différentes selon le nombre de colonnes */
  container-type: inline-size;
  padding: 0;
  /* posé sur la case et pas sur body : cette propriété ne s'hérite pas, sur body elle ne
     protège rien du double appui qui zoome */
  touch-action: manipulation;
  border: var(--case-anneau) solid var(--anneau);
  border-radius: var(--case-rayon);
  background: var(--blanc);
  overflow: hidden;
  cursor: pointer;
  font-family: inherit;
  /* Ombre dure sans flou : la case a une épaisseur, comme un jouet.
     box-shadow et transform ne provoquent aucun reflow, la grille ne bouge donc jamais.
     C'est elle, et pas l'anneau, qui détache la carte du ciel : le mélange est calculé
     pour tenir les 3:1 de la BIBLE §6 sur les huit familles, l'anneau plafonne à 1,05:1. */
  --ombre-relief: color-mix(in srgb, var(--anneau) 55%, #000);
  box-shadow: 0 var(--case-relief) 0 var(--ombre-relief);
  transition: transform var(--duree-retour-visuel) ease-out,
              box-shadow var(--duree-retour-visuel) ease-out;
}

/* La case vit tant que son mot est dit : elle grandit et pousse un anneau de sa propre
   couleur vers l'extérieur. Le halo est l'ombre de la case elle-même et non celle d'un
   enfant, sinon le `overflow: hidden` au-dessus le rogne entièrement, ce qui le rendait
   invisible. Rien ne se déplace, ni elle ni ses voisines : seuls `transform` et `box-shadow`
   sont animés, la grille ne bouge pas d'un pixel. C'est le seul mouvement de l'écran de
   l'enfant, et il répond toujours à son geste, jamais de son propre chef. */
.case.parle {
  /* au-dessus de ses voisines le temps que l'anneau la traverse */
  z-index: 1;
  /* une seule vague, pas une boucle : c'est une récompense qui répond à l'appui, et un
     cycle qui repart sur un mot d'une seconde donne l'impression d'un écran qui bégaie */
  animation: parle 700ms ease-out;
}

/* « Réduire les animations » ramenait toutes nos durées à zéro, et la case ne répondait plus
   du tout : l'enfant perdait le lien entre son geste et le mot. On lève la règle globale pour
   ce seul retour, qui répond à son doigt et ne part jamais tout seul. Ce qui gêne dans ce
   réglage, c'est ce qui grossit et se déplace : l'anneau reste, la case ne bouge plus. */
@media (prefers-reduced-motion: reduce) {
  .case.parle {
    animation: parle-sobre 700ms ease-out !important;
  }
}

@keyframes parle-sobre {
  0% {
    box-shadow: 0 var(--case-relief) 0 var(--ombre-relief),
                0 0 0 0 var(--anneau),
                0 0 0 16px color-mix(in srgb, var(--anneau) 30%, transparent);
  }
  50% {
    box-shadow: 0 var(--case-relief) 0 var(--ombre-relief),
                0 0 0 16px color-mix(in srgb, var(--anneau) 55%, transparent),
                0 0 0 32px color-mix(in srgb, var(--anneau) 10%, transparent);
  }
  100% {
    box-shadow: 0 var(--case-relief) 0 var(--ombre-relief),
                0 0 0 24px transparent,
                0 0 0 32px transparent;
  }
}

/* Deux anneaux décalés : la case pousse une vague unique au moment où elle prend la parole. */
@keyframes parle {
  0% {
    transform: scale(1);
    box-shadow: 0 var(--case-relief) 0 var(--ombre-relief),
                0 0 0 0 var(--anneau),
                0 0 0 16px color-mix(in srgb, var(--anneau) 30%, transparent);
  }
  50% {
    transform: scale(1.06);
    box-shadow: 0 var(--case-relief) 0 var(--ombre-relief),
                0 0 0 16px color-mix(in srgb, var(--anneau) 55%, transparent),
                0 0 0 32px color-mix(in srgb, var(--anneau) 10%, transparent);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 var(--case-relief) 0 var(--ombre-relief),
                0 0 0 32px color-mix(in srgb, var(--anneau) 0%, transparent),
                0 0 0 32px color-mix(in srgb, var(--anneau) 0%, transparent);
  }
}

/* La case descend réellement sur son ombre : un objet qu'on enfonce, pas un état qui change. */
.case.enfoncee {
  transform: translateY(var(--case-relief));
  box-shadow: 0 0 0 var(--ombre-relief);
}

.case:focus-visible {
  outline: 4px solid var(--encre);
  outline-offset: 3px;
}

.illustration {
  flex: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  min-height: 0;
  /* repère de position pour l'image : sans lui sa hauteur en pourcentage se résout
     contre une hauteur indéfinie, elle repasse en auto et déborde de son cadre */
  position: relative;
}

.illustration img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* Aucune marge : la mère veut les images aussi grandes que possible, et un pictogramme
     ARASAAC porte déjà la sienne dans son dessin. `contain` garantit qu'il reste entier. */
  padding: 0;
  object-fit: contain;
}

/* Une photo de famille remplit la case, quitte à perdre ses bords. Elle arrive au format de
   l'appareil, jamais à celui de la case, et `contain` lui laissait deux bandes blanches. On
   ne rogne pas au moment de l'import : la case change de proportions avec la forme de la
   grille, et une photo découpée pour quatre colonnes retrouverait ses bandes à cinq. */
.illustration img.photo {
  object-fit: cover;
}

/* Repère provisoire des cases sans photo. Le mot entier plutôt qu'une initiale : MAMAN,
   MANGER et MOI donnaient trois « M » impossibles à distinguer. Disparaît avec P4.
   En encre et pas en couleur d'anneau : l'anneau soleil ne donnait que 1,54:1 sur le
   blanc de la carte, sur le plus gros texte de l'écran. */
.mot-repere {
  padding: 0 6px;
  color: var(--encre);
  /* borné par la largeur de la case : en paysage sur un téléphone, MOI, OUI et NON
     n'affichaient plus que leur initiale, ce qui est précisément le contraire du repli
     prévu pour un mot sans image */
  font-size: min(clamp(0.9rem, 3.4vw, 2rem), 26cqw);
  font-weight: 600;
  line-height: 1.1;
  text-align: center;
  overflow-wrap: anywhere;
}

/* Bande pastel : le texte n'est jamais posé sur la photo, dont le contraste est imprévisible.
   Chaque pastel donne au moins 7,7:1 avec l'encre, le 7:1 exigé est tenu de justesse et
   par dessein. */
.etiquette {
  flex: 0 0 var(--case-etiquette-hauteur);
  /* sans ça, le texte impose sa hauteur et le bandeau grossit jusqu'à 39 % de la case sur
     un écran court, ce qui vole la place de la photo */
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 2px 6px;
  background: var(--fond-etiquette);
  color: var(--encre);
  /* min() borne la police par la hauteur autant que par la largeur : sans elle le mot
     était coupé net dès que l'écran passait sous 830 px de haut. La borne en `cqw` vient
     de la case elle-même : PROMENADE et TABLETTE se faisaient rogner sur les écrans où la
     case est étroite, et un mot coupé ne se reconnaît plus. */
  font-size: min(clamp(0.75rem, min(2.7vw, 2.2vh), 1.5rem), max(0.7rem, 11cqw));
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.05;
  /* Le mot rétrécit avec la carte au lieu d'être tronqué : en paysage sur un téléphone,
     MAMAN devenait MAMA. Le plancher de 0,75 rem ne tient pas sur une carte de 53 px. */
  @media (orientation: landscape) {
    font-size: min(2.2vh, 1.5rem, max(0.7rem, 11cqw));
  }
}
</style>
