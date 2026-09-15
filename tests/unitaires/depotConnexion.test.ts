import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * La connexion à IndexedDB est gardée en mémoire pour raccourcir la fenêtre pendant
 * laquelle un onglet fermé aussitôt perd une modification. Le prix de cette optimisation,
 * signalé par le radar : une promesse rejetée retenue condamnerait toute la session, alors
 * qu'avant, chaque écriture rouvrant, un échec passager ne coûtait qu'une écriture.
 * Ces tests vivent à part parce qu'ils remplacent le module `idb` en entier.
 */
const ouvertures = vi.hoisted(() => ({ appels: 0, echouerLaPremiere: false }))

vi.mock('idb', () => ({
  openDB: () => {
    ouvertures.appels += 1
    if (ouvertures.echouerLaPremiere && ouvertures.appels === 1) {
      return Promise.reject(new Error('stockage indisponible'))
    }
    return Promise.resolve({
      get: () => Promise.resolve(undefined),
      put: () => Promise.resolve(),
      // l'écriture passe par une transaction depuis D15 : elle lit le numéro d'écriture
      // et le repose dans le même souffle, pour qu'aucun autre onglet ne s'y glisse
      transaction: () => ({
        objectStore: () => ({ get: () => Promise.resolve(undefined), put: () => Promise.resolve() }),
        abort: () => {},
        done: Promise.resolve(),
      }),
    })
  },
}))

describe('connexion au dépôt', () => {
  beforeEach(async () => {
    ouvertures.appels = 0
    ouvertures.echouerLaPremiere = false
    vi.resetModules()
  })

  it('ne rouvre pas la base à chaque écriture', async () => {
    const { enregistrerConfiguration } = await import('../../src/domaine/depot')
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    await enregistrerConfiguration(CONFIGURATION_DEMO)
    await enregistrerConfiguration(CONFIGURATION_DEMO)
    await enregistrerConfiguration(CONFIGURATION_DEMO)

    expect(ouvertures.appels).toBe(1)
  })

  it('repart à neuf après une ouverture ratée, au lieu de condamner la session', async () => {
    ouvertures.echouerLaPremiere = true
    const { enregistrerConfiguration } = await import('../../src/domaine/depot')
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    await expect(enregistrerConfiguration(CONFIGURATION_DEMO)).rejects.toThrow()
    // la tentative suivante doit rouvrir, pas resservir la promesse rejetée
    await expect(enregistrerConfiguration(CONFIGURATION_DEMO)).resolves.toBeUndefined()
    expect(ouvertures.appels).toBe(2)
  })
})
