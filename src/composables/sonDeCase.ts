import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { identifiantPersonnalise, type CaseCommunication } from '../domaine/planche'
import { lireSon } from '../domaine/depot'

/**
 * Le son à faire écouter pour une case : le MP3 livré, ou la voix de la famille lue dans le
 * dépôt. Même discipline que `utiliserPhotoDeCase`, et pour la même raison : un parent doit
 * pouvoir entendre ce que la tablette dira, avant de décider s'il le refait.
 */
export function utiliserSonDeCase(contenu: Ref<Pick<CaseCommunication, 'sound_id'> | null>) {
  const referenceSon = computed(() => contenu.value?.sound_id)
  const urlPersonnalisee = ref<string | null>(null)
  // une lecture encore en vol au démontage créait une URL que plus rien ne libérait
  let actif = true

  function liberer() {
    if (!urlPersonnalisee.value) return
    URL.revokeObjectURL(urlPersonnalisee.value)
    urlPersonnalisee.value = null
  }

  const source = computed(() => {
    const idPerso = identifiantPersonnalise(referenceSon.value)
    if (idPerso) return urlPersonnalisee.value
    return referenceSon.value ? `/sons/${referenceSon.value}.mp3` : null
  })

  // on suit la case entière : remplacer la voix d'un mot garde la même référence `perso/<id>`
  watch(
    contenu,
    async () => {
      liberer()
      const idPerso = identifiantPersonnalise(referenceSon.value)
      if (!idPerso) return
      const son = await lireSon(idPerso)
      if (!actif || identifiantPersonnalise(referenceSon.value) !== idPerso) return
      if (son) urlPersonnalisee.value = URL.createObjectURL(son)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    actif = false
    liberer()
  })

  return { source }
}
