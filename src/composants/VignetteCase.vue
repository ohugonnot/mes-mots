<script setup lang="ts">
import { computed } from 'vue'
import type { CaseCommunication } from '../domaine/planche'
import { utiliserPhotoDeCase } from '../composables/photoDeCase'

/**
 * L'image d'une case, en petit. Un composant plutôt qu'un appel direct au composable :
 * celui-ci gère une URL d'objet et ne peut donc pas se prêter à une boucle de cartes.
 */
const props = defineProps<{ contenu: CaseCommunication }>()
const { source, signalerEchec } = utiliserPhotoDeCase(computed(() => props.contenu))
</script>

<template>
  <img
    v-if="source"
    class="vignette"
    :src="source"
    alt=""
    draggable="false"
    data-vignette
    @error="signalerEchec"
  />
</template>

<style scoped>
.vignette {
  width: 100%;
  height: 44px;
  object-fit: contain;
}
</style>
