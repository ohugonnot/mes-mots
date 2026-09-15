import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `modifieDepuisSauvegarde` (B4) n'existait pas avant le lot 4 : une configuration déjà
 * enregistrée sur la tablette d'une famille ne l'a pas. Isolé comme depotConnexion.test.ts,
 * parce qu'il faut remplacer le module `idb` en entier pour simuler ce dépôt.
 */
const configurationSansDrapeau = vi.hoisted(() => ({
  format: 'open-board-0.1' as const,
  contextes: [{ id: 'maison', name: 'Maison', pages: [] }],
  barre: { format: 'open-board-0.1' as const, id: 'barre', locale: 'fr', name: 'Barre', grid: { rows: 1, columns: 1, order: [[null]] }, buttons: [] },
  // forme d'avant le lot 4 : aucun champ modifieDepuisSauvegarde
  reglages: { retourAutomatique: true },
}))

vi.mock('idb', () => ({
  openDB: () =>
    Promise.resolve({
      get: (_magasin: string, cle: string) =>
        Promise.resolve(cle === 'configuration' ? configurationSansDrapeau : undefined),
      put: () => Promise.resolve(),
    }),
}))

describe('reprise d une configuration enregistrée avant le lot 4', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('complète modifieDepuisSauvegarde à false au lieu de planter', async () => {
    const { chargerConfiguration } = await import('../../src/domaine/depot')
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    const reprise = await chargerConfiguration(CONFIGURATION_DEMO)

    expect(reprise.reglages.modifieDepuisSauvegarde).toBe(false)
    // rien d'autre n'a bougé au passage
    expect(reprise.reglages.retourAutomatique).toBe(true)
    expect(reprise.contextes).toEqual(configurationSansDrapeau.contextes)
  })

  it('complète aussi les réglages arrivés avec P9, volume et fermeté', async () => {
    // même mécanisme, autre lot : une configuration d'avant P9 partirait sinon sur des
    // valeurs indéfinies, donc sur une tablette muette ou insensible à l'appui
    const { chargerConfiguration } = await import('../../src/domaine/depot')
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    const reprise = await chargerConfiguration(CONFIGURATION_DEMO)

    expect(reprise.reglages.volume).toBe(70)
    expect(reprise.reglages.fermeteAppui).toBe('normal')
  })
})
