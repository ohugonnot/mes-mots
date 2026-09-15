import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { identifiantPersonnalise, type CaseCommunication } from '../domaine/planche'
import { lireImage } from '../domaine/depot'

/**
 * L'image à montrer pour une case : le pictogramme livré, ou la photo de famille lue dans
 * le dépôt. Partagé par l'écran de l'enfant, la carte de l'espace parents et l'éditeur,
 * parce qu'un parent doit voir exactement ce que voit l'enfant, y compris la photo qu'il
 * vient de poser.
 *
 * `signalerEchec` sert au repli quand le fichier pointé n'existe pas (dette D6) : le
 * pictogramme que « Retirer la photo » repose n'existe pas forcément pour toutes les cases.
 */
export function utiliserPhotoDeCase(contenu: Ref<Pick<CaseCommunication, 'image_id'>>) {
  const referenceImage = computed(() => contenu.value.image_id)
  const urlPersonnalisee = ref<string | null>(null)
  const echecChargement = ref(false)
  // une lecture encore en vol au démontage créait une URL que plus rien ne libérait
  let actif = true

  function liberer() {
    if (!urlPersonnalisee.value) return
    URL.revokeObjectURL(urlPersonnalisee.value)
    urlPersonnalisee.value = null
  }

  const source = computed(() => {
    if (echecChargement.value) return null
    const idPerso = identifiantPersonnalise(referenceImage.value)
    if (idPerso) return urlPersonnalisee.value
    return referenceImage.value ? `/images/${referenceImage.value}` : null
  })

  // On suit la case, pas sa seule référence : remplacer la photo d'un mot garde la même
  // référence `perso/<id>`, et la vignette restait alors sur l'image lue la première fois.
  // Chaque modification produit une nouvelle case, ce qui suffit à déclencher la relecture.
  watch(
    contenu,
    async () => {
      echecChargement.value = false
      liberer()
      const idPerso = identifiantPersonnalise(referenceImage.value)
      if (!idPerso) return
      const image = await lireImage(idPerso)
      // la case a pu changer de photo pendant la lecture : ne pas poser une image périmée
      if (!actif || identifiantPersonnalise(referenceImage.value) !== idPerso) return
      if (image) urlPersonnalisee.value = URL.createObjectURL(image)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    actif = false
    liberer()
  })

  /**
   * Vrai quand ce qu'on montre est une photo de la famille, et non un pictogramme livré. Les
   * deux ne se cadrent pas de la même façon : un pictogramme est dessiné avec sa marge et se
   * lit en entier, une photo est un morceau du monde dont l'essentiel est au milieu.
   */
  const photoDeFamille = computed(
    () => !echecChargement.value && identifiantPersonnalise(referenceImage.value) !== undefined,
  )

  return { source, photoDeFamille, signalerEchec: () => (echecChargement.value = true) }
}
