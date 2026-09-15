import { describe, it, expect, vi } from 'vitest'

/**
 * Le volume s'enregistrait sous le nom de son niveau avant que la réglette existe. La
 * tablette de la famille porte donc « fort » là où le code attend un nombre : sans reprise,
 * la réglette partirait au milieu et le volume changerait tout seul sous leur oreille.
 * Fichier à part, comme les autres migrations : le module `idb` est remplacé en entier.
 */
const configurationVolumeNomme = vi.hoisted(() => ({
  format: 'open-board-0.1' as const,
  contextes: [{ id: 'maison', name: 'Maison', pages: [] }],
  barre: { format: 'open-board-0.1' as const, id: 'barre', locale: 'fr', name: 'Barre', grid: { rows: 1, columns: 1, order: [[null]] }, buttons: [] },
  reglages: { retourAutomatique: true, modifieDepuisSauvegarde: false, volume: 'fort', fermeteAppui: 'assure', animations: true },
}))

vi.mock('idb', () => ({
  openDB: () =>
    Promise.resolve({
      get: (_magasin: string, cle: string) =>
        Promise.resolve(cle === 'configuration' ? configurationVolumeNomme : undefined),
      put: () => Promise.resolve(),
    }),
}))

describe('reprise d une configuration enregistrée avant la réglette de volume', () => {
  it('rend le pourcentage du niveau nommé, sans toucher au reste des réglages', async () => {
    const { chargerConfiguration } = await import('../../src/domaine/depot')
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    const reprise = await chargerConfiguration(CONFIGURATION_DEMO)

    expect(reprise.reglages.volume).toBe(100)
    expect(reprise.reglages.fermeteAppui).toBe('assure')
    expect(reprise.contextes).toEqual(configurationVolumeNomme.contextes)
  })
})
