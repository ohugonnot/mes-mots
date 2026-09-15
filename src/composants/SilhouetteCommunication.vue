<script setup lang="ts">
import { computed, ref } from 'vue'
import { caseParIdentifiant, type CaseCommunication, type Planche } from '../domaine/planche'
import { COTES, IMAGE_DU_COTE, regionsDe, type CoteSilhouette } from '../domaine/silhouette'

const props = defineProps<{ planche: Planche; idCaseQuiParle?: string | null }>()
const emit = defineEmits<{ appuiSurCase: [id: string, debutMs: number, finMs: number] }>()

/**
 * Les mots révélés de la planche, dans l'ordre de la matrice comme partout ailleurs : même
 * si le dessin décide de leur place, c'est `grid.order` qui dit lesquels existent.
 */
const mots = computed(() =>
  props.planche.grid.order
    .flat()
    .flatMap((id) => (id === null ? [] : [caseParIdentifiant(props.planche, id)]))
    .filter((contenu): contenu is CaseCommunication => !!contenu && !contenu.hidden),
)

/** Les régions à poser sur un corps : un mot peut en occuper deux, la main gauche et la droite. */
function regionsDuCote(cote: CoteSilhouette) {
  return mots.value.flatMap((contenu) =>
    regionsDe(cote, contenu.ext_mesmots_zone).map((region, rang) => ({
      cle: `${cote}-${contenu.id}-${rang}`,
      contenu,
      region,
    })),
  )
}

const debutAppuiMs = ref(0)
const enfoncee = ref<string | null>(null)

/**
 * Le doigt reste accroché à la zone où il s'est posé, même s'il en sort. Les régions
 * épousent le dessin, donc certaines sont petites : le cou fait sept millimètres de haut.
 * Sans cette prise, un doigt qui ripe de trois pixels obtenait le silence, sur l'écran fait
 * pour un moment où l'enfant a mal et où sa main est la moins sûre. C'est l'endroit du
 * premier contact qui compte, comme sur une case de la grille.
 */
function commencerAppui(evenement: PointerEvent, cle: string) {
  // La prise du pointeur n'est qu'un confort : un identifiant que le navigateur ne
  // connaît pas la fait échouer, et l'appui doit se poursuivre quand même.
  try {
    ;(evenement.currentTarget as HTMLElement).setPointerCapture?.(evenement.pointerId)
  } catch {
    /* pointeur déjà relâché, ou geste synthétique */
  }
  enfoncee.value = cle
  debutAppuiMs.value = performance.now()
}

function terminerAppui(cle: string, id: string) {
  if (enfoncee.value !== cle) return
  enfoncee.value = null
  emit('appuiSurCase', id, debutAppuiMs.value, performance.now())
}
</script>

<template>
  <div class="silhouette" data-silhouette>
    <figure v-for="cote in COTES" :key="cote" class="corps">
      <img :src="IMAGE_DU_COTE[cote]" alt="" draggable="false" :data-corps="cote" />
      <!-- Les régions sont posées en pourcentage sur une image carrée : elles restent au
           même endroit du corps quelle que soit la taille de l'écran, ce qui est la même
           promesse qu'une case qui ne bouge jamais de sa colonne. -->
      <button
        v-for="zone in regionsDuCote(cote)"
        :key="zone.cle"
        type="button"
        class="region"
        :class="{ ronde: zone.region.ronde, parle: props.idCaseQuiParle === zone.contenu.id }"
        :style="{
          left: `${zone.region.gauche}%`,
          top: `${zone.region.haut}%`,
          width: `${zone.region.largeur}%`,
          height: `${zone.region.hauteur}%`,
          // la couleur de la famille, comme sur une case : le retour au doigt est le même
          '--anneau': zone.contenu.border_color,
        }"
        :aria-label="zone.contenu.vocalization"
        :data-region="zone.contenu.id"
        @pointerdown="commencerAppui($event, zone.cle)"
        @pointerup="terminerAppui(zone.cle, zone.contenu.id)"
        @pointercancel="enfoncee = null"
      ></button>
    </figure>
  </div>
</template>

<style scoped>
.silhouette {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--case-espacement);
  height: 100%;
  padding: var(--case-espacement);
  /* les deux corps se dimensionnent sur cette zone, pas sur la fenêtre : c'est ce qui permet
     au carré de tenir compte de la hauteur autant que de la largeur */
  container-type: size;
}

/**
 * Le cadre doit rester exactement carré, comme le dessin : c'est de lui que les régions
 * tirent leurs pourcentages, et un cadre plus haut que large les décalerait du corps.
 * On prend donc le plus grand carré qui tienne à la fois dans la moitié de la largeur et
 * dans toute la hauteur. Le premier `width` sert de repli là où `cqw` n'existe pas.
 */
.corps {
  position: relative;
  margin: 0;
  width: 45%;
  width: min(48cqw, 48cqh);
  aspect-ratio: 240 / 500;
}

.corps img {
  display: block;
  width: 100%;
  height: 100%;
}

/* Les zones se montrent à l'ouverture de la planche, puis s'effacent. Sans ce premier
   coup d'œil, l'enfant arrive devant deux dessins plats après avoir quitté des cartes en
   relief : rien ne lui dit que ce corps se touche, et un essai au mauvais endroit ne lui
   apprend pas que c'est l'endroit qui est faux. C'est ce que fait Snap Scene, l'outil de
   référence pour les communicants émergents, dont l'option « Fade Out » des zones est le
   comportement livré par défaut. Ensuite le dessin reste lisible, comme il doit l'être. */
.region {
  position: absolute;
  padding: 0;
  border: 3px solid transparent;
  /* largement arrondi : un membre se cerne mieux par une gélule que par une boîte, et
     l'ensemble ressemble moins à un calque de repérage posé sur le dessin */
  border-radius: 18px;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  animation: montrer-les-zones 2600ms ease-out;
}

/* Le contour seul, sans remplissage : posé sur le corps il rosissait, posé sur le ciel il
   virait au gris-mauve, et deux corps nus se retrouvaient barbouillés de rectangles de
   couleurs différentes selon ce qu'ils recouvraient. Le trait suffit à dire « ici ». */
@keyframes montrer-les-zones {
  0%,
  55% {
    border-color: var(--anneau, #e8837a);
  }
  100% {
    border-color: transparent;
  }
}

.region.ronde {
  border-radius: 50%;
}

/* Le même retour que sur une case : la région répond au doigt et reste allumée le temps que
   le mot est dit. */
.region:active,
.region.parle {
  border-color: var(--anneau, #e8837a);
  background: color-mix(in srgb, var(--anneau, #e8837a) 28%, transparent);
}

/* Ni fondu ni disparition ici : les zones restent posées, discrètes, en permanence. Ce
   réglage est souvent activé pour des profils qui ont justement besoin que rien ne change
   tout seul, et un repère stable leur sert mieux qu'un repère qui s'efface. */
@media (prefers-reduced-motion: reduce) {
  .region {
    animation: none;
    border-color: color-mix(in srgb, var(--anneau, #e8837a) 55%, transparent);
  }

  .region.parle {
    background: color-mix(in srgb, var(--anneau, #e8837a) 40%, transparent);
  }
}
</style>
