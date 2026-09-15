import { ref, type Ref } from 'vue'
import { decisionGlissement, leDoigtAGlisse } from '../domaine/glissement'

/** Durée de la glissade d'une page à l'autre (T8), partagée par les deux écrans. */
export const DUREE_GLISSADE_MS = 180

/**
 * Geste de glissement gauche-droite entre deux pages (T8), partagé par l'écran de l'enfant
 * et l'espace parents : seule `changerDePage`, qui décide si une page voisine existe et en
 * fait la page courante, diffère entre les deux écrans. `changerDePage` rend `false` sans
 * rien faire si le pas demandé n'a pas de voisine, pour que le bord ne s'anime pas.
 */
export function utiliserGlissementPage(
  conteneur: Ref<HTMLElement | null>,
  changerDePage: (pas: 1 | -1) => boolean,
) {
  const glissade = ref<'suivante' | 'precedente' | null>(null)
  /** Le doigt a glissé : la case sous lui renonce à parler, sinon chaque page tournée parlerait. */
  const appuiRenonce = ref(false)
  let poseDuDoigt: { x: number; y: number } | null = null
  let minuterieGlissade: number | null = null

  function deplacementDepuisLaPose(evenement: PointerEvent) {
    if (!poseDuDoigt) return null
    return {
      horizontalPx: evenement.clientX - poseDuDoigt.x,
      verticalPx: evenement.clientY - poseDuDoigt.y,
      largeurGrillePx: conteneur.value?.clientWidth ?? 0,
    }
  }

  function surPoseDuDoigt(evenement: PointerEvent) {
    poseDuDoigt = { x: evenement.clientX, y: evenement.clientY }
  }

  function surDeplacementDuDoigt(evenement: PointerEvent) {
    const deplacement = deplacementDepuisLaPose(evenement)
    if (deplacement && leDoigtAGlisse(deplacement)) appuiRenonce.value = true
  }

  /**
   * Le renoncement ne vaut que pour le geste qui vient de finir. La case, elle, a déjà lu
   * le drapeau : son `pointerup` passe avant celui de la grille qui la contient.
   */
  function terminerLeGeste() {
    poseDuDoigt = null
    appuiRenonce.value = false
  }

  function allerVersLaPage(pas: 1 | -1) {
    if (!changerDePage(pas)) return
    glissade.value = pas === 1 ? 'suivante' : 'precedente'
    if (minuterieGlissade !== null) window.clearTimeout(minuterieGlissade)
    minuterieGlissade = window.setTimeout(() => {
      glissade.value = null
    }, DUREE_GLISSADE_MS)
  }

  /**
   * La décision est prise au relâché, jamais en cours de route : changer de page sous le
   * doigt retirerait de l'écran la case qui doit encore renoncer à parler.
   * Le doigt qui sort de la grille compte comme un relâché, sinon un glissement ample ne
   * serait jamais entendu.
   */
  function surRelacheDuDoigt(evenement: PointerEvent) {
    const deplacement = deplacementDepuisLaPose(evenement)
    terminerLeGeste()
    if (!deplacement) return
    const decision = decisionGlissement(deplacement)
    if (decision === 'aucune') return
    allerVersLaPage(decision === 'page-suivante' ? 1 : -1)
  }

  function oublierGlissade() {
    if (minuterieGlissade !== null) window.clearTimeout(minuterieGlissade)
  }

  return {
    glissade,
    appuiRenonce,
    allerVersLaPage,
    surPoseDuDoigt,
    surDeplacementDuDoigt,
    surRelacheDuDoigt,
    terminerLeGeste,
    oublierGlissade,
  }
}
