import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VerrouParents from '../../src/composants/VerrouParents.vue'


/**
 * Lit l'addition affichée et rend la bonne réponse, ou une mauvaise. L'énoncé et l'ordre
 * des boutons changent à chaque ouverture : un test qui viserait une valeur en dur
 * testerait l'ancienne version, celle dont la position du bon bouton se mémorisait.
 */
function sommeAffichee(verrou: ReturnType<typeof mount>): number {
  const [gauche, droite] = verrou.get('[data-enonce]').text().match(/\d+/g)!.map(Number)
  return gauche! + droite!
}

function mauvaiseReponse(verrou: ReturnType<typeof mount>): string {
  const somme = sommeAffichee(verrou)
  const valeurs = verrou.findAll('[data-reponse]').map((b) => Number(b.text()))
  return String(valeurs.find((v) => v !== somme))
}

describe('verrou parents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('un appui plus court que 3 s ne fait rien', async () => {
    const verrou = mount(VerrouParents)

    await verrou.get('[data-coin-parents]').trigger('pointerdown')
    vi.advanceTimersByTime(2999)
    await verrou.get('[data-coin-parents]').trigger('pointerup')
    vi.advanceTimersByTime(1)

    expect(verrou.find('[data-question-parents]').exists()).toBe(false)
  })

  it('un appui de 3 s ouvre la question', async () => {
    const verrou = mount(VerrouParents)

    await verrou.get('[data-coin-parents]').trigger('pointerdown')
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()

    expect(verrou.find('[data-question-parents]').exists()).toBe(true)
  })

  it('le doigt qui glisse hors du coin annule le compte', async () => {
    const verrou = mount(VerrouParents)

    await verrou.get('[data-coin-parents]').trigger('pointerdown')
    vi.advanceTimersByTime(1000)
    await verrou.get('[data-coin-parents]').trigger('pointerleave')
    vi.advanceTimersByTime(3000)

    expect(verrou.find('[data-question-parents]').exists()).toBe(false)
  })

  it('une mauvaise réponse referme la question sans émettre ouvrir', async () => {
    const verrou = mount(VerrouParents)
    await verrou.get('[data-coin-parents]').trigger('pointerdown')
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()

    await verrou.get(`[data-reponse="${mauvaiseReponse(verrou)}"]`).trigger('click')

    expect(verrou.find('[data-question-parents]').exists()).toBe(false)
    expect(verrou.emitted('ouvrir')).toBeUndefined()
  })

  it('la bonne réponse émet ouvrir', async () => {
    const verrou = mount(VerrouParents)
    await verrou.get('[data-coin-parents]').trigger('pointerdown')
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()

    await verrou.get(`[data-reponse="${sommeAffichee(verrou)}"]`).trigger('click')

    expect(verrou.emitted('ouvrir')).toHaveLength(1)
  })

  it('le bouton annuler referme la question sans émettre ouvrir', async () => {
    const verrou = mount(VerrouParents)
    await verrou.get('[data-coin-parents]').trigger('pointerdown')
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()

    await verrou.get('[data-abandonner-question]').trigger('click')

    expect(verrou.find('[data-question-parents]').exists()).toBe(false)
    expect(verrou.emitted('ouvrir')).toBeUndefined()
  })
})

describe('verrou parents, ce que le radar a trouvé', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('un effleurement à deux doigts n ouvre rien', async () => {
    // Mesuré par un testeur adversarial : deux doigts posés à 100 ms d'intervalle et
    // relâchés en 300 ms ouvraient la question 3 s plus tard, parce que le minuteur du
    // premier doigt continuait, orphelin, après avoir été déréférencé par le second.
    const verrou = mount(VerrouParents)
    const coin = verrou.get('[data-coin-parents]')

    await coin.trigger('pointerdown', { pointerId: 1 })
    vi.advanceTimersByTime(100)
    await coin.trigger('pointerdown', { pointerId: 2 })
    vi.advanceTimersByTime(105)
    await coin.trigger('pointerup', { pointerId: 1 })
    vi.advanceTimersByTime(101)
    await coin.trigger('pointerup', { pointerId: 2 })

    vi.advanceTimersByTime(5000)
    await verrou.vm.$nextTick()

    expect(verrou.find('[data-question-parents]').exists()).toBe(false)
  })

  it('une mauvaise réponse rend le coin inerte un moment', async () => {
    // Sans ce délai, cinquante tentatives automatisées ouvraient l'espace parents douze
    // fois, la première au bout de six secondes : une réponse au hasard suffisait.
    const verrou = mount(VerrouParents)
    const coin = verrou.get('[data-coin-parents]')

    await coin.trigger('pointerdown', { pointerId: 1 })
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()
    await coin.trigger('pointerup', { pointerId: 1 })
    await verrou.get(`[data-reponse="${mauvaiseReponse(verrou)}"]`).trigger('click')

    // deuxième tentative immédiate : le coin ne répond plus
    await coin.trigger('pointerdown', { pointerId: 1 })
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()
    expect(verrou.find('[data-question-parents]').exists()).toBe(false)

    // vingt secondes plus tard, le parent peut réessayer
    await coin.trigger('pointerup', { pointerId: 1 })
    vi.advanceTimersByTime(20_000)
    await coin.trigger('pointerdown', { pointerId: 1 })
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()
    expect(verrou.find('[data-question-parents]').exists()).toBe(true)
  })

  it('six réponses au lieu de quatre, une chance sur six et non sur quatre', async () => {
    const verrou = mount(VerrouParents)

    await verrou.get('[data-coin-parents]').trigger('pointerdown', { pointerId: 1 })
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()

    expect(verrou.findAll('[data-reponse]')).toHaveLength(6)
  })
})

describe('la question ne se mémorise pas', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const ouvrir = async () => {
    const verrou = mount(VerrouParents)
    await verrou.get('[data-coin-parents]').trigger('pointerdown', { pointerId: 1 })
    vi.advanceTimersByTime(3000)
    await verrou.vm.$nextTick()
    return verrou
  }

  it('l addition change d une ouverture à l autre, sur le même écran', async () => {
    // Le radar : la question était figée, réponse toujours 12, toujours le quatrième
    // bouton. Un enfant qui voit le geste des centaines de fois le reproduit sans compter,
    // et le code du projet a vocation à être public.
    // Le même composant est rouvert trente fois, et non remonté : un tirage fait une seule
    // fois à la construction paraîtrait varier alors qu'il ne changerait jamais pour la
    // famille, qui ne recharge pas l'application entre deux visites.
    const verrou = mount(VerrouParents)
    const coin = verrou.get('[data-coin-parents]')
    const enonces = new Set<string>()

    for (let i = 0; i < 30; i++) {
      await coin.trigger('pointerdown', { pointerId: 1 })
      vi.advanceTimersByTime(3000)
      await verrou.vm.$nextTick()
      enonces.add(verrou.get('[data-enonce]').text())
      await coin.trigger('pointerup', { pointerId: 1 })
      await verrou.get('[data-abandonner-question]').trigger('click')
    }

    expect(enonces.size, 'trente ouvertures, un seul énoncé').toBeGreaterThan(3)
  })

  it('la bonne réponse ne tombe pas toujours au même rang', async () => {
    const rangs = new Set<number>()
    for (let i = 0; i < 30; i++) {
      const verrou = await ouvrir()
      const somme = sommeAffichee(verrou)
      rangs.add(verrou.findAll('[data-reponse]').findIndex((b) => Number(b.text()) === somme))
    }

    expect(rangs.size, 'la bonne réponse est toujours au même rang').toBeGreaterThan(2)
  })

  it('une seule réponse est juste', async () => {
    const verrou = await ouvrir()
    const somme = sommeAffichee(verrou)
    const justes = verrou.findAll('[data-reponse]').filter((b) => Number(b.text()) === somme)

    expect(justes).toHaveLength(1)
  })
})
