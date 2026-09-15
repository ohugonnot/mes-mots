import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CaseCommunication from '../../src/composants/CaseCommunication.vue'

const lireImage = vi.hoisted(() => vi.fn())
vi.mock('../../src/domaine/depot', () => ({ lireImage }))

const contenu = { id: 'oui', label: 'OUI', vocalization: 'Oui' }
const carte = () => mount(CaseCommunication, { props: { contenu } })

describe('case de communication', () => {
  it('signale un appui posé puis relevé', async () => {
    const oui = carte()
    await oui.trigger('pointerdown')
    await oui.trigger('pointerup')

    expect(oui.emitted('appui')).toHaveLength(1)
  })

  it('garde son mot quand le doigt dérive hors de la case avant de se lever', async () => {
    // Un enfant dont la main dérive de quelques millimètres relâchait au-dessus de la case
    // voisine et n'obtenait pas le mauvais mot : il n'obtenait rien, sans savoir pourquoi.
    // C'est l'endroit du premier contact qui compte. Le balayage entre pages reste protégé
    // ailleurs, par `appuiRenonce`, qui exige un mouvement franchement horizontal.
    const oui = carte()
    await oui.trigger('pointerdown')
    await oui.trigger('pointerleave')
    await oui.trigger('pointerup')

    expect(oui.emitted('appui')).toHaveLength(1)
  })

  it('ne dit rien quand le système reprend le geste', async () => {
    // un appel qui arrive, une notification : le navigateur annule le pointeur
    const oui = carte()
    await oui.trigger('pointerdown')
    await oui.trigger('pointercancel')
    await oui.trigger('pointerup')

    expect(oui.emitted('appui')).toBeUndefined()
  })

  it('enfonce la carte pendant l appui et la relève ensuite', async () => {
    // exigence C6 : l'enfant doit voir que son geste a été pris
    const oui = carte()
    await oui.trigger('pointerdown')
    expect(oui.classes()).toContain('enfoncee')

    await oui.trigger('pointerup')
    expect(oui.classes()).not.toContain('enfoncee')
  })
})

describe('photo de famille (P4)', () => {
  afterEach(() => {
    lireImage.mockReset()
    vi.restoreAllMocks()
  })

  it('affiche la photo rendue par le magasin, une fois chargée', async () => {
    const image = new Blob(['une photo'], { type: 'image/png' })
    lireImage.mockResolvedValue(image)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:maman')

    const ecran = mount(CaseCommunication, {
      props: { contenu: { id: 'maman', label: 'MAMAN', vocalization: 'maman', image_id: 'perso/maman' } },
    })
    await flushPromises()

    expect(lireImage).toHaveBeenCalledWith('maman')
    expect(ecran.get('img').attributes('src')).toBe('blob:maman')
  })

  it('retombe sur le mot repère quand la photo personnalisée manque du magasin', async () => {
    lireImage.mockResolvedValue(undefined)

    const ecran = mount(CaseCommunication, {
      props: { contenu: { id: 'maman', label: 'MAMAN', vocalization: 'maman', image_id: 'perso/maman' } },
    })
    await flushPromises()

    expect(ecran.find('img').exists()).toBe(false)
    expect(ecran.get('.mot-repere').text()).toBe('MAMAN')
  })

  it('n écrit pas le mot deux fois quand la case n a pas d image', () => {
    // MOI, OUI et NON n'ont aucun pictogramme : le mot s'affichait en grand ET dans la
    // bande, du bruit visuel pour un enfant qui ne lit pas.
    const ecran = mount(CaseCommunication, {
      props: { contenu: { id: 'oui', label: 'OUI', vocalization: 'Oui' } },
    })

    expect(ecran.get('.mot-repere').text()).toBe('OUI')
    expect(ecran.get('.etiquette').text()).toBe('')
  })

  it('garde le mot dans la bande dès qu une image occupe la case', () => {
    const ecran = mount(CaseCommunication, {
      props: { contenu: { id: 'chambre', label: 'CHAMBRE', vocalization: 'Ma chambre', image_id: 'pictos/chambre.svg' } },
    })

    expect(ecran.find('.mot-repere').exists()).toBe(false)
    expect(ecran.get('.etiquette').text()).toBe('CHAMBRE')
  })

  it("libère l'URL d'objet quand la case change de photo", async () => {
    const imageA = new Blob(['a'])
    const imageB = new Blob(['b'])
    lireImage.mockResolvedValueOnce(imageA).mockResolvedValueOnce(imageB)
    let appel = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => ['blob:a', 'blob:b'][appel++]!)
    const espionRevoke = vi.spyOn(URL, 'revokeObjectURL')

    const ecran = mount(CaseCommunication, {
      props: { contenu: { id: 'maman', label: 'MAMAN', vocalization: 'maman', image_id: 'perso/maman' } },
    })
    await flushPromises()
    expect(ecran.get('img').attributes('src')).toBe('blob:a')

    await ecran.setProps({
      contenu: { id: 'papa', label: 'PAPA', vocalization: 'papa', image_id: 'perso/papa' },
    })
    await flushPromises()

    expect(espionRevoke).toHaveBeenCalledWith('blob:a')
    expect(ecran.get('img').attributes('src')).toBe('blob:b')
  })

  it("libère l'URL d'objet au démontage", async () => {
    const image = new Blob(['une photo'])
    lireImage.mockResolvedValue(image)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:maman')
    const espionRevoke = vi.spyOn(URL, 'revokeObjectURL')

    const ecran = mount(CaseCommunication, {
      props: { contenu: { id: 'maman', label: 'MAMAN', vocalization: 'maman', image_id: 'perso/maman' } },
    })
    await flushPromises()

    ecran.unmount()

    expect(espionRevoke).toHaveBeenCalledWith('blob:maman')
  })

  it('affiche le pictogramme livré sans passer par le magasin', () => {
    const ecran = mount(CaseCommunication, {
      props: {
        contenu: { id: 'maman', label: 'MAMAN', vocalization: 'maman', image_id: 'pictos/maman.svg' },
      },
    })

    expect(ecran.get('img').attributes('src')).toBe('/images/pictos/maman.svg')
    expect(lireImage).not.toHaveBeenCalled()
  })

  it("retombe sur le mot repère quand le pictogramme de repli n'existe pas (D6)", async () => {
    // Le repli posé par « Retirer la photo » (P4) suit une convention de nommage, sans
    // garantie qu'un fichier existe vraiment à ce chemin pour toute case.
    const ecran = mount(CaseCommunication, {
      props: {
        contenu: { id: 'ballon', label: 'BALLON', vocalization: 'ballon', image_id: 'pictos/ballon.svg' },
      },
    })

    await ecran.get('img').trigger('error')

    expect(ecran.find('img').exists()).toBe(false)
    expect(ecran.get('.mot-repere').text()).toBe('BALLON')
  })
})

describe('la case vit pendant que son mot est dit', () => {
  it('respire et diffuse son halo tant qu elle parle', () => {
    const ecran = mount(CaseCommunication, { props: { contenu, parle: true } })

    expect(ecran.get('button').classes()).toContain('parle')
  })

  it('reste immobile quand elle ne parle pas', () => {
    const ecran = mount(CaseCommunication, { props: { contenu, parle: false } })

    expect(ecran.get('button').classes()).not.toContain('parle')
  })
})

describe('une photo de la famille garde ses proportions', () => {
  it('ne recadre jamais, ni une photo ni un pictogramme', () => {
    // Recadrer coupait le visage sur les bords : la photo garde ses proportions et occupe
    // tout l'emplacement que le mot laisse.
    for (const image of ['perso/oui', 'pictos/oui.svg']) {
      const ecran = mount(CaseCommunication, { props: { contenu: { ...contenu, image_id: image } } })

      expect(ecran.get('button').classes(), image).not.toContain('photo-pleine')
    }
  })
})
