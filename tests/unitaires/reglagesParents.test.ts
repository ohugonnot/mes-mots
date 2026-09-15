import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReglagesParents from '../../src/composants/ReglagesParents.vue'
import { REGLAGES_PAR_DEFAUT } from '../../src/domaine/planche'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'

const monter = (reglages = REGLAGES_PAR_DEFAUT) =>
  mount(ReglagesParents, { props: { configuration: { ...CONFIGURATION_DEMO, reglages } } })

describe('section des réglages (P9)', () => {
  it('montre le niveau en cours comme choisi, sans que le parent ait à deviner', () => {
    const ecran = monter({ ...REGLAGES_PAR_DEFAUT, volume: 100, fermeteAppui: 'assure' })

    expect((ecran.get('[data-volume="fort"]').element as HTMLInputElement).checked).toBe(true)
    expect((ecran.get('[data-fermete="assure"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('le raccourci pose directement son niveau, sans bouton appliquer', async () => {
    const ecran = monter()

    await ecran.get('[data-volume="bas"]').setValue()

    expect(ecran.emitted('reglerVolume')).toEqual([[40]])
  })

  it('la réglette affine entre les repères, et sa valeur se lit', async () => {
    const ecran = monter({ ...REGLAGES_PAR_DEFAUT, volume: 55 })

    expect(ecran.get('[data-volume-valeur]').text()).toBe('55 %')
    // aucun raccourci ne prétend être le niveau en cours entre deux repères
    expect(ecran.findAll('input[name="volume"]').filter((n) => (n.element as HTMLInputElement).checked)).toHaveLength(0)

    await ecran.get('[data-volume-reglette]').setValue('85')

    expect(ecran.emitted('reglerVolume')).toEqual([[85]])
  })

  it('montre la valeur pendant qu on glisse, sans l enregistrer', async () => {
    // sans ce suivi, le chiffre restait figé et on réglait le volume de la voix à l'aveugle
    const ecran = monter()
    const reglette = ecran.get('[data-volume-reglette]')

    ;(reglette.element as HTMLInputElement).value = '25'
    await reglette.trigger('input')

    expect(ecran.get('[data-volume-valeur]').text()).toBe('25 %')
    expect(ecran.emitted('reglerVolume')).toBeUndefined()
  })

  it('n enregistre qu au relâchement, pas à chaque cran du glissement', async () => {
    // chaque émission réécrit la configuration entière dans IndexedDB : un glissement de
    // bout en bout en déclenchait dix-huit, sur une tablette d'entrée de gamme
    const ecran = monter()
    const reglette = ecran.get('[data-volume-reglette]')

    for (const valeur of ['40', '55', '70', '85']) {
      ;(reglette.element as HTMLInputElement).value = valeur
      await reglette.trigger('input')
    }
    expect(ecran.emitted('reglerVolume')).toBeUndefined()

    await reglette.trigger('change')

    expect(ecran.emitted('reglerVolume')).toEqual([[85]])
  })

  it('émet la fermeté choisie', async () => {
    const ecran = monter()

    await ecran.get('[data-fermete="tres-assure"]').setValue()

    expect(ecran.emitted('reglerFermete')).toEqual([['tres-assure']])
  })

  it('explique en mots ce que la fermeté choisie change', () => {
    const ecran = monter({ ...REGLAGES_PAR_DEFAUT, fermeteAppui: 'tres-assure' })

    expect(ecran.get('[data-aide-fermete]').text()).toContain('vraiment appuyer')
  })

  it('garde le retour automatique, déplacé du pied vers les réglages', async () => {
    const ecran = monter()

    await ecran.get('[data-reglage-retour]').setValue(false)

    expect(ecran.emitted('reglerRetourAutomatique')).toEqual([[false]])
  })

  it('propose les deux corps à toucher, et les montre éteints à la livraison', async () => {
    const ecran = monter()

    // éteints depuis le 15 septembre : les corps dessinés faisaient peur à l'enfant
    expect((ecran.get('[data-reglage-corps]').element as HTMLInputElement).checked).toBe(false)
    await ecran.get('[data-reglage-corps]').setValue(true)

    expect(ecran.emitted('reglerCorpsAToucher')).toEqual([[true]])
  })
})

describe('la forme de la grille, telle que la mère la règle', () => {
  const compter = (ecran: ReturnType<typeof monter>, quoi: string, fois: number) =>
    Array.from({ length: fois }).reduce<Promise<unknown>>(
      (attente) => attente.then(() => ecran.get(quoi).trigger('click')),
      Promise.resolve(),
    )

  it('lit la grille en service au présent, et n offre rien à confirmer', () => {
    const ecran = monter()

    expect(ecran.get('[data-forme-valeur="colonnes"]').text()).toBe('4')
    expect(ecran.get('[data-forme-lecture]').text()).toBe("Aujourd'hui, chaque case fait environ 4,8 cm.")
    // pas de bouton gris qui refuse l'appui sans rien dire : au repos, une invite à la place
    expect(ecran.find('[data-forme-changer]').exists()).toBe(false)
    expect(ecran.get('[data-forme-invite]').text()).toContain('Changez les chiffres')
    expect(ecran.find('[data-forme-consequence]').exists()).toBe(false)
    expect(ecran.find('[data-forme-alerte]').exists()).toBe(false)
  })

  it('remet les compteurs au présent sur « Annuler », et range le bouton avec eux', async () => {
    const ecran = monter()

    await compter(ecran, '[data-forme-plus="colonnes"]', 1)
    expect(ecran.get('[data-forme-changer]').isVisible()).toBe(true)

    await ecran.get('[data-forme-annuler]').trigger('click')

    expect(ecran.get('[data-forme-valeur="colonnes"]').text()).toBe('4')
    expect(ecran.find('[data-forme-changer]').exists()).toBe(false)
    expect(ecran.find('[data-forme-invite]').exists()).toBe(true)
  })

  it('passe au futur dès qu un compteur bouge, et avertit quand la case devient trop petite', async () => {
    const ecran = monter()

    await compter(ecran, '[data-forme-plus="colonnes"]', 1)

    expect(ecran.get('[data-forme-valeur="colonnes"]').text()).toBe('5')
    // les deux côtés, parce qu'une colonne de moins élargit les cases sans les grandir en
    // hauteur : un seul chiffre restait immobile et donnait le réglage pour cassé
    expect(ecran.get('[data-forme-lecture]').text()).toBe(
      'Avec 5 colonnes et 4 lignes, chaque case fera environ 3,8 cm de large et 4,8 cm de haut.',
    )
    expect(ecran.find('[data-forme-alerte]').exists()).toBe(false)

    await compter(ecran, '[data-forme-plus="colonnes"]', 3)

    expect(ecran.get('[data-forme-lecture]').text()).toContain('environ 2,2 cm')
    expect(ecran.get('[data-forme-alerte]').text()).toContain('difficile à viser')
  })

  it('ne descend pas sous deux colonnes, où la grille n en serait plus une', async () => {
    const ecran = monter()

    await compter(ecran, '[data-forme-moins="colonnes"]', 3)

    expect(ecran.get('[data-forme-valeur="colonnes"]').text()).toBe('2')
    expect((ecran.get('[data-forme-moins="colonnes"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('ne monte pas au-dessus de huit lignes, où la case ne se vise plus', async () => {
    const ecran = monter()

    await compter(ecran, '[data-forme-plus="lignes"]', 5)

    expect(ecran.get('[data-forme-valeur="lignes"]').text()).toBe('8')
    expect((ecran.get('[data-forme-plus="lignes"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('dit ce que le changement coûtera, en mots posés et non en principe', async () => {
    const ecran = monter()

    await compter(ecran, '[data-forme-plus="colonnes"]', 1)
    expect(ecran.get('[data-forme-consequence]').text()).toBe(
      'Aucun mot ne changera de place.',
    )

    await compter(ecran, '[data-forme-moins="colonnes"]', 2)
    expect(ecran.get('[data-forme-consequence]').text()).toMatch(
      /^\d+ mots garderont leur place\. \d+ mots passeront sur 2 pages nouvelles, à la fin de leur contexte\.$/,
    )
  })

  it('émet la forme choisie, et rien tant qu elle est celle d aujourd hui', async () => {
    const ecran = monter()

    await compter(ecran, '[data-forme-moins="colonnes"]', 1)
    await ecran.get('[data-forme-changer]').trigger('click')

    expect(ecran.emitted('changerForme')).toEqual([[{ colonnes: 3, lignes: 4 }]])
  })

  it('garde la forme essayée quand un autre réglage change', async () => {
    // la forme en service est recalculée à chaque écriture : régler le volume au milieu du
    // choix remettait les compteurs à quatre colonnes sans rien dire
    const ecran = mount(ReglagesParents, {
      props: { configuration: { ...CONFIGURATION_DEMO, reglages: REGLAGES_PAR_DEFAUT } },
    })
    await compter(ecran, '[data-forme-moins="colonnes"]', 1)

    await ecran.setProps({
      configuration: { ...CONFIGURATION_DEMO, reglages: { ...REGLAGES_PAR_DEFAUT, volume: 40 } },
    })

    expect(ecran.get('[data-forme-valeur="colonnes"]').text()).toBe('3')
  })

  it('dessine la tablette à la forme choisie, pour que la mère voie des places', async () => {
    const ecran = monter()

    await compter(ecran, '[data-forme-moins="lignes"]', 1)

    expect(ecran.get('[data-forme-apercu]').findAll('.tablette-case')).toHaveLength(12)
  })
})
