<script setup lang="ts">
import { computed } from 'vue'
import type { Contexte } from '../domaine/planche'
import { utiliserPhotoDeCase } from '../composables/photoDeCase'

const props = defineProps<{ contexte: Contexte; actif: boolean }>()
const emit = defineEmits<{ choisir: [] }>()

// Même lecture que pour la photo d'une case : le parent peut poser ici une vraie photo,
// gardée dans le dépôt, et pas seulement un pictogramme livré.
const { source, signalerEchec } = utiliserPhotoDeCase(
  computed(() => ({ image_id: props.contexte.ext_mesmots_image })),
)
</script>

<template>
  <!-- L'image seule quand il y en a une : l'enfant ne lit pas, et à trois contextes le nom
       n'avait plus la place que pour « M… », ce qui n'apprend rien à personne. Le nom reste
       pour un contexte sans image, et le nom complet est toujours là pour un lecteur d'écran. -->
  <button
    class="contexte"
    :class="{ actif: props.actif }"
    type="button"
    :aria-label="props.contexte.name"
    :data-contexte="props.contexte.id"
    @click="emit('choisir')"
  >
    <img v-if="source" :src="source" alt="" draggable="false" @error="signalerEchec" />
    <span v-else class="nom-contexte">{{ props.contexte.name }}</span>
  </button>
</template>

<style scoped>
.contexte {
  display: flex;
  align-items: center;
  gap: 8px;
  /* plafonné comme la flèche de page : sur une tablette haute, 78 % de la rangée donnait un
     bouton de 106 x 80 qui rivalisait avec les cases de vocabulaire */
  height: min(78%, 64px);
  padding: 0 clamp(8px, 2.5cqw, 20px);
  /* le nom tient sur une ligne, quitte à se laisser tronquer : sur un écran étroit l'image
     le poussait à la ligne et le bouton mangeait la place de la pagination */
  min-width: 0;
  white-space: nowrap;
  border: var(--case-anneau) solid var(--encre);
  border-radius: var(--case-rayon);
  background: var(--blanc);
  color: var(--encre);
  font-family: inherit;
  font-size: clamp(0.85rem, min(2.4vw, 2.2vh), 1.3rem);
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

/* le contexte courant est marqué en plein : le même vocabulaire visuel que les cases */
.contexte.actif {
  background: var(--encre);
  color: var(--blanc);
}

/* Carrée comme un pictogramme : une photo panoramique posée par la famille prenait sinon
   toute la barre à elle seule. `contain` la montre entière dans son carré. */
.contexte img {
  flex-shrink: 0;
  height: 82%;
  aspect-ratio: 1;
  object-fit: contain;
}

.nom-contexte {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
