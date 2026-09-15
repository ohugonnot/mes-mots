import { describe, it, expect } from 'vitest'
import {
  decisionGlissement,
  leDoigtAGlisse,
  GLISSEMENT_MINIMAL_PX,
  PART_CHANGEMENT_PAGE,
} from '../../src/domaine/glissement'

/** Largeur de la grille sur la tablette de l'enfant : le seuil de page en est une part. */
const LARGEUR = 800
const SEUIL_PAGE = LARGEUR * PART_CHANGEMENT_PAGE

const deplacement = (horizontalPx: number, verticalPx = 0, largeurGrillePx = LARGEUR) => ({
  horizontalPx,
  verticalPx,
  largeurGrillePx,
})

describe('le doigt a glissé', () => {
  it('assène le seuil à 16 px', () => {
    // Trop bas, un vrai appui qui tremble rendrait l'enfant muet ; trop haut, chaque
    // changement de page prononcerait un mot au hasard.
    expect(GLISSEMENT_MINIMAL_PX).toBe(16)
  })

  it('laisse parler un appui immobile ou tremblant', () => {
    expect(leDoigtAGlisse(deplacement(0))).toBe(false)
    expect(leDoigtAGlisse(deplacement(9, 9))).toBe(false)
    expect(leDoigtAGlisse(deplacement(16))).toBe(false)
  })

  it('fait renoncer la case sur un glissement horizontal franc, dans les deux sens', () => {
    expect(leDoigtAGlisse(deplacement(17))).toBe(true)
    expect(leDoigtAGlisse(deplacement(-17))).toBe(true)
    expect(leDoigtAGlisse(deplacement(140))).toBe(true)
  })

  it('laisse parler une main qui descend, même franchement', () => {
    // Le tremblement d'une main de cinq ans dépasse vite 16 px vers le bas. La case
    // renonçait alors à parler pour protéger un changement de page que ce geste ne peut
    // pas déclencher : L'enfant appuyait, et rien ne sortait.
    expect(leDoigtAGlisse(deplacement(0, 17))).toBe(false)
    expect(leDoigtAGlisse(deplacement(0, 200))).toBe(false)
    expect(leDoigtAGlisse(deplacement(20, 40))).toBe(false)
  })

  it('renonce exactement quand le geste peut tourner la page, jamais autrement', () => {
    // les deux fonctions partagent la même dominance : ce qui fait taire la case est
    // exactement ce qui peut faire tourner la page, à la distance près
    const grille = 800
    for (const [h, v] of [[300, 10], [-300, 10], [300, 200], [10, 300], [0, 300], [-40, 100]] as const) {
      const d = { horizontalPx: h, verticalPx: v, largeurGrillePx: grille }
      if (decisionGlissement(d) !== 'aucune') expect(leDoigtAGlisse(d), `${h},${v}`).toBe(true)
    }
  })
})

describe('décision de changement de page', () => {
  it('assène le seuil à 15 % de la largeur de la grille', () => {
    expect(PART_CHANGEMENT_PAGE).toBe(0.15)
  })

  it('ne décide rien sous le seuil, même sur un long geste vertical', () => {
    expect(decisionGlissement(deplacement(SEUIL_PAGE - 1))).toBe('aucune')
    expect(decisionGlissement(deplacement(0, 400))).toBe('aucune')
  })

  it('va vers la page suivante quand le doigt part à gauche', () => {
    expect(decisionGlissement(deplacement(-SEUIL_PAGE))).toBe('page-suivante')
  })

  it('va vers la page précédente quand le doigt part à droite', () => {
    expect(decisionGlissement(deplacement(SEUIL_PAGE))).toBe('page-precedente')
  })

  it('accepte une diagonale approximative, refuse un geste surtout vertical', () => {
    // le geste d'un enfant de 5 ans n'est pas une horizontale parfaite
    expect(decisionGlissement(deplacement(-200, 90))).toBe('page-suivante')
    expect(decisionGlissement(deplacement(-200, 100))).toBe('page-suivante')
    expect(decisionGlissement(deplacement(-200, 101))).toBe('aucune')
  })

  it('ne dépend pas de la vitesse : un geste lent ne se distingue pas d un rapide', () => {
    // aucun paramètre de temps n'entre dans la décision, un glissement appliqué doit marcher
    expect(decisionGlissement(deplacement(-300))).toBe('page-suivante')
  })

  it('suit la largeur de la grille, pas une valeur en pixels figée', () => {
    expect(decisionGlissement(deplacement(-70, 0, 800))).toBe('aucune')
    expect(decisionGlissement(deplacement(-70, 0, 400))).toBe('page-suivante')
  })

  it('ne décide rien tant que la grille n est pas mesurée', () => {
    // un seuil nul ferait tourner la page au premier pixel parcouru
    expect(decisionGlissement(deplacement(-1, 0, 0))).toBe('aucune')
  })
})
