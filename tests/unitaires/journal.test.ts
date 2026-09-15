import { describe, it, expect } from 'vitest'
import {
  entreesDuJour,
  entreesParHeure,
  entreesPerimees,
  heureDe,
  type EntreeJournal,
} from '../../src/domaine/journal'

const le = (jour: number, heure: number, minute: number, mot: string): EntreeJournal => ({
  horodatage: new Date(2026, 8, jour, heure, minute).getTime(),
  mot,
})

describe('le journal de la journée', () => {
  const maintenant = new Date(2026, 8, 9, 18, 0).getTime()
  const entrees = [le(9, 8, 12, 'MAMAN'), le(8, 19, 30, 'BOIRE'), le(9, 7, 5, 'DOUDOU'), le(10, 6, 0, 'PAPA')]

  it('ne garde que le jour en cours, et rend le plus récent en premier', () => {
    // la mère a posé l'effacement à minuit comme condition : rien ne s'accumule sur l'enfant.
    // Et ce qu'il vient de demander se lit en haut, sans dérouler toute la journée.
    expect(entreesDuJour(entrees, maintenant).map((e) => e.mot)).toEqual(['MAMAN', 'DOUDOU'])
  })

  it('nomme comme périmé tout ce qui n est pas du jour, hier comme demain', () => {
    // demain aussi : une tablette dont l'horloge a avancé puis reculé laisserait sinon des
    // entrées que plus aucun jour ne montrerait, et qui ne partiraient jamais
    expect(entreesPerimees(entrees, maintenant).map((e) => e.mot)).toEqual(['BOIRE', 'PAPA'])
  })

  it('remet dans l ordre des heures ce qui arrive en désordre', () => {
    const desordre = [le(9, 8, 0, 'MAMAN'), le(9, 17, 0, 'FINI'), le(9, 12, 30, 'MANGER')]

    expect(entreesDuJour(desordre, maintenant).map((e) => e.mot)).toEqual(['FINI', 'MANGER', 'MAMAN'])
  })

  it('rend une liste vide plutôt que rien quand la journée n a rien vu', () => {
    expect(entreesDuJour([], maintenant)).toEqual([])
    expect(entreesDuJour([le(8, 10, 0, 'BOIRE')], maintenant)).toEqual([])
  })

  it('regroupe la journée par heure, dans l ordre où elle arrive', () => {
    // ce qui se traverse, ce sont les heures : vingt lignes identiques ne se parcourent pas
    const journee = entreesDuJour(
      [le(9, 17, 12, 'MANGER'), le(9, 17, 3, 'MANGER'), le(9, 8, 40, 'MAMAN'), le(9, 8, 5, 'BOIRE')],
      maintenant,
    )

    expect(entreesParHeure(journee).map((h) => [h.libelle, h.entrees.map((e) => e.mot)])).toEqual([
      ['Vers 17\u00a0h', ['MANGER', 'MANGER']],
      ['Vers 8\u00a0h', ['MAMAN', 'BOIRE']],
    ])
  })

  it('dit midi et minuit au lieu de les chiffrer', () => {
    const libelles = entreesParHeure([le(9, 12, 5, 'MANGER'), le(9, 0, 30, 'DOUDOU')]).map(
      (h) => h.libelle,
    )

    expect(libelles).toEqual(['Vers midi', 'Vers minuit'])
  })

  it('ne compte rien : un groupe dit quand, jamais combien', () => {
    // la condition posée par la mère. Le regroupement ne doit pas la contourner en douce.
    const groupe = entreesParHeure([le(9, 17, 12, 'MANGER'), le(9, 17, 3, 'MANGER')])[0]!

    expect(Object.keys(groupe).sort()).toEqual(['entrees', 'libelle'])
    expect(groupe.libelle).not.toMatch(/\d+ fois|\bx\s?\d/)
  })

  it('écrit l heure comme une horloge, deux chiffres de chaque côté', () => {
    expect(heureDe(new Date(2026, 8, 9, 8, 5).getTime())).toBe('08:05')
    expect(heureDe(new Date(2026, 8, 9, 18, 45).getTime())).toBe('18:45')
    expect(heureDe(new Date(2026, 8, 9, 0, 0).getTime())).toBe('00:00')
  })
})
