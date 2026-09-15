import { describe, it, expect } from 'vitest'
import {
  ajouterALaPhrase,
  motDeLaPhrase,
  retirerLeDernierMot,
  MOTS_MAXIMUM,
  type PhraseEnCours,
} from '../../src/domaine/phrase'
import type { CaseCommunication } from '../../src/domaine/planche'

const mot = (id: string, enchaine?: string): CaseCommunication => ({
  id,
  label: id.toUpperCase(),
  vocalization: id,
  ...(enchaine === undefined ? {} : { ext_mesmots_enchaine: enchaine }),
})

const phraseDe = (...ids: string[]): PhraseEnCours => ids.map((id) => mot(id))

describe('la phrase en cours de composition', () => {
  it('empile les cases dans l ordre où l enfant les touche', () => {
    const phrase = ajouterALaPhrase(ajouterALaPhrase([], mot('maman')), mot('boire'))
    expect(phrase.map((contenu) => contenu.id)).toEqual(['maman', 'boire'])
  })

  it('accepte deux fois la même case', () => {
    const phrase = ajouterALaPhrase(ajouterALaPhrase([], mot('encore')), mot('encore'))
    expect(phrase).toHaveLength(2)
  })

  it('ne touche pas à la phrase qu on lui donne', () => {
    const depart = phraseDe('maman')
    ajouterALaPhrase(depart, mot('boire'))
    expect(depart).toHaveLength(1)
  })

  it('tient six mots, de quoi modéliser au-dessus du niveau de l enfant', () => {
    const pleine = phraseDe('un', 'deux', 'trois', 'quatre', 'cinq', 'six')
    expect(pleine).toHaveLength(MOTS_MAXIMUM)
  })

  it('refuse le septième mot sans faire partir le premier', () => {
    const pleine = phraseDe('un', 'deux', 'trois', 'quatre', 'cinq', 'six')
    const apres = ajouterALaPhrase(pleine, mot('sept'))
    expect(apres.map((contenu) => contenu.id)).toEqual(['un', 'deux', 'trois', 'quatre', 'cinq', 'six'])
  })

  it('retire le dernier mot, lui seul', () => {
    expect(retirerLeDernierMot(phraseDe('maman', 'boire')).map((c) => c.id)).toEqual(['maman'])
  })

  it('ne bronche pas quand on retire un mot d une phrase vide', () => {
    expect(retirerLeDernierMot([])).toEqual([])
  })
})

describe('le mot écrit sous le pictogramme', () => {
  it('prend le mot d enchaînement saisi par l adulte', () => {
    expect(motDeLaPhrase(mot('boire', 'biberon'))).toBe('biberon')
  })

  it('retombe sur le mot de la case quand l adulte n a rien saisi', () => {
    expect(motDeLaPhrase(mot('boire'))).toBe('BOIRE')
  })

  it('retombe aussi quand le champ ne contient que des espaces', () => {
    expect(motDeLaPhrase(mot('boire', '   '))).toBe('BOIRE')
  })
})
