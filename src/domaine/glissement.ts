/**
 * Décision du glissement entre pages (T8). Fonction pure : le geste se vérifie ici, sur
 * ses seuils, plutôt qu'au navigateur où il dépendrait du pas de la souris de test.
 *
 * Le profil de l'enfant dit qu'il déverrouille déjà une tablette par glissement : le geste
 * est acquis, il doit être généreux et rapide, pas défensif. D'où l'absence de toute
 * condition de vitesse, un glissement lent et appliqué doit marcher.
 */

/** Au-delà, la case sous le doigt renonce à parler : c'est un glissement, pas un appui. */
export const GLISSEMENT_MINIMAL_PX = 16
/** Part de la largeur de la grille à parcourir pour changer de page. */
export const PART_CHANGEMENT_PAGE = 0.15
/** Le déplacement horizontal doit valoir ce multiple du vertical, pour qu'une diagonale passe. */
export const DOMINANCE_HORIZONTALE = 2

export interface Deplacement {
  /** Depuis le point de pose. Négatif vers la gauche. */
  horizontalPx: number
  verticalPx: number
  largeurGrillePx: number
}

export type DecisionGlissement = 'aucune' | 'page-suivante' | 'page-precedente'

/**
 * Un vrai appui tremble de quelques pixels : le seuil est bas mais non nul, sinon le
 * moindre micro-mouvement rendrait l'enfant muet.
 *
 * La dominance horizontale est exigée ici comme dans `decisionGlissement` : sans elle, un
 * doigt qui descendait de 17 px, ce qui est le tremblement normal d'une main de cinq ans,
 * renonçait à parler pour protéger un changement de page que ce geste ne peut pas
 * déclencher. La case restait muette sans que rien ne l'explique.
 */
export function leDoigtAGlisse(deplacement: Deplacement): boolean {
  const { horizontalPx, verticalPx } = deplacement
  if (Math.hypot(horizontalPx, verticalPx) <= GLISSEMENT_MINIMAL_PX) return false
  return Math.abs(horizontalPx) >= DOMINANCE_HORIZONTALE * Math.abs(verticalPx)
}

export function decisionGlissement(deplacement: Deplacement): DecisionGlissement {
  const { horizontalPx, verticalPx, largeurGrillePx } = deplacement
  // une grille pas encore mesurée donnerait un seuil nul, donc un changement de page au
  // premier pixel parcouru
  if (largeurGrillePx <= 0) return 'aucune'
  if (Math.abs(horizontalPx) < largeurGrillePx * PART_CHANGEMENT_PAGE) return 'aucune'
  if (Math.abs(horizontalPx) < DOMINANCE_HORIZONTALE * Math.abs(verticalPx)) return 'aucune'
  return horizontalPx < 0 ? 'page-suivante' : 'page-precedente'
}
