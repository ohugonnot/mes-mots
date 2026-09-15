import { describe, it, expect } from 'vitest'
import {
  evaluerAppui,
  REGLAGES_APPUI_PAR_DEFAUT,
  type ReglagesAppui,
} from '../../src/domaine/protectionAppui'

const sansProtection: ReglagesAppui = { dureeAppuiMinimaleMs: 0, delaiEntreActivationsMs: 0 }

describe('protection contre les appuis involontaires', () => {
  it('laisse passer un appui quand aucune protection n est réglée', () => {
    expect(evaluerAppui(sansProtection, { debutMs: 0, finMs: 10 }, null).active).toBe(true)
  })

  it('refuse un appui plus court que la durée minimale', () => {
    const reglages = { ...sansProtection, dureeAppuiMinimaleMs: 400 }
    expect(evaluerAppui(reglages, { debutMs: 1000, finMs: 1300 }, null).active).toBe(false)
  })

  it('accepte un appui qui atteint exactement la durée minimale', () => {
    const reglages = { ...sansProtection, dureeAppuiMinimaleMs: 400 }
    expect(evaluerAppui(reglages, { debutMs: 1000, finMs: 1400 }, null).active).toBe(true)
  })

  it('refuse une seconde activation trop rapprochée', () => {
    const reglages = { ...sansProtection, delaiEntreActivationsMs: 300 }
    expect(evaluerAppui(reglages, { debutMs: 1000, finMs: 1100 }, 1000).active).toBe(false)
  })

  it('accepte une seconde activation une fois le délai écoulé', () => {
    const reglages = { ...sansProtection, delaiEntreActivationsMs: 300 }
    expect(evaluerAppui(reglages, { debutMs: 1000, finMs: 1300 }, 1000).active).toBe(true)
  })

  it('neutralise un balayage de la main, plusieurs appuis très brefs à la suite', () => {
    const reglages: ReglagesAppui = { dureeAppuiMinimaleMs: 200, delaiEntreActivationsMs: 500 }
    const balayage = [
      { debutMs: 0, finMs: 40 },
      { debutMs: 45, finMs: 90 },
      { debutMs: 95, finMs: 130 },
    ]
    const acceptes = balayage.filter((a) => evaluerAppui(reglages, a, null).active)
    expect(acceptes).toHaveLength(0)
  })

  it('a des réglages par défaut qui ne gênent pas un enfant à l aise avec la tablette', () => {
    // Les valeurs, pas un ordre de grandeur : à 3 s le temps mort rendrait muet l'enfant
    // qui insiste, et la porte ne s'en apercevait pas.
    expect(REGLAGES_APPUI_PAR_DEFAUT.dureeAppuiMinimaleMs).toBe(0)
    expect(REGLAGES_APPUI_PAR_DEFAUT.delaiEntreActivationsMs).toBe(300)
  })
})
