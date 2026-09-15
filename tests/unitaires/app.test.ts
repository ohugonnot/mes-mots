import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import App from '../../src/App.vue'
import { AudioFactice } from './audioFactice'

const demanderVerrou = vi.fn()

/** L'écran attend sa planche du dépôt : monter ne suffit plus, il faut l'attendre. */
async function monter(): Promise<VueWrapper> {
  const ecran = mount(App)
  await vi.waitFor(() => expect(ecran.find('[data-case]').exists()).toBe(true))
  return ecran
}

async function appuyer(ecran: VueWrapper, id: string): Promise<void> {
  const carte = ecran.get(`[data-case="${id}"]`)
  await carte.trigger('pointerdown')
  await carte.trigger('pointerup')
}

describe('écran de communication', () => {
  beforeEach(() => {
    AudioFactice.reinitialiser()
    vi.stubGlobal('Audio', AudioFactice)
    demanderVerrou.mockReset().mockResolvedValue({ release: vi.fn() })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: demanderVerrou },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('trois appuis très rapprochés sur trois cases donnent trois phrases', async () => {
    // Le temps mort est propre à chaque case. Un temps mort commun rendait l'enfant muet
    // dès qu'il enchaînait, alors que sa dextérité dépasse largement le besoin.
    const ecran = await monter()

    await appuyer(ecran, 'maman')
    await appuyer(ecran, 'boire')
    await appuyer(ecran, 'oui')

    expect(AudioFactice.creees.map((a) => a.src)).toEqual([
      '/sons/maman.mp3',
      '/sons/boire.mp3',
      '/sons/oui.mp3',
    ])
  })

  it('deux appuis très rapprochés sur la même case n en jouent qu un', async () => {
    const ecran = await monter()

    await appuyer(ecran, 'oui')
    await appuyer(ecran, 'oui')

    expect(AudioFactice.creees).toHaveLength(1)
  })

  it('demande le verrou d écran au démarrage', async () => {
    await monter()

    expect(demanderVerrou).toHaveBeenCalledWith('screen')
  })

  it('reprend le verrou d écran au retour d arrière-plan', async () => {
    // le système relâche le verrou dès que la page passe en arrière-plan : sans reprise,
    // la tablette s'éteint après le premier aller-retour vers une autre application
    await monter()
    demanderVerrou.mockClear()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(demanderVerrou).toHaveBeenCalledWith('screen')
  })
})

describe('mise à jour de la version', () => {
  let recharger: ReturnType<typeof vi.fn>

  /**
   * Le service worker qui vient de prendre la main, et le rechargement qu'on surveille.
   * Sans `controller`, c'est la toute première installation : personne n'avait la main avant.
   */
  function armerLeServiceWorker(controller: object | null = {}): EventTarget {
    const bus = new EventTarget()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller,
        addEventListener: (nom: string, ecouteur: EventListener) => bus.addEventListener(nom, ecouteur),
        getRegistration: async () => null,
      },
      configurable: true,
    })
    return bus
  }

  beforeEach(() => {
    AudioFactice.reinitialiser()
    vi.stubGlobal('Audio', AudioFactice)
    demanderVerrou.mockReset().mockResolvedValue({ release: vi.fn() })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: demanderVerrou },
      configurable: true,
    })
    recharger = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: recharger },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recharge la tablette au repos, pour ne pas demander deux chargements à la famille', async () => {
    // Le nouveau service worker prend la main, mais la page affichée reste l'ancienne :
    // sans ce rechargement il fallait charger deux fois pour voir une correction.
    const bus = armerLeServiceWorker()
    await monter()

    bus.dispatchEvent(new Event('controllerchange'))
    await vi.waitFor(() => expect(recharger).toHaveBeenCalled())
  })

  it('ne recharge pas pendant que l enfant parle', async () => {
    // Un rechargement en pleine phrase couperait le son sous son doigt.
    const bus = armerLeServiceWorker()
    const ecran = await monter()
    await appuyer(ecran, 'maman')

    bus.dispatchEvent(new Event('controllerchange'))
    await ecran.vm.$nextTick()

    expect(recharger).not.toHaveBeenCalled()
  })

  it('ne prend pas la premiere installation pour une mise à jour', async () => {
    // Au tout premier chargement, le service worker prend la main sans que personne ne l'ait
    // eue avant : recharger là recharge une page qui vient de s'ouvrir.
    const bus = armerLeServiceWorker(null)
    const ecran = await monter()

    bus.dispatchEvent(new Event('controllerchange'))
    await ecran.vm.$nextTick()

    expect(recharger).not.toHaveBeenCalled()
  })
})
