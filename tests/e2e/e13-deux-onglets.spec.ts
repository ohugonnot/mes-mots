import { test, expect } from '@playwright/test'
import { fermerEspaceParents, ouvrirEspaceParents } from './verrou'

/**
 * D15 : deux onglets ouverts sur la même tablette partaient chacun de leur copie en mémoire,
 * et le second écrasait le travail du premier sans que rien ne le dise. Le cas est rare sur
 * la tablette dédiée de l'enfant, mais réel sur l'ordinateur d'un parent qui essaie.
 */
test.describe('E13 : deux onglets ouverts sur la même tablette', () => {
  test('le second refuse d écraser le travail du premier, et dit quoi faire', async ({ context }) => {
    const premier = await context.newPage()
    await premier.goto('/')
    await expect(premier.locator('[data-case]')).toHaveCount(13)

    const second = await context.newPage()
    await second.goto('/')
    await expect(second.locator('[data-case]')).toHaveCount(13)

    // le premier onglet révèle LOKI et l'enregistre
    await ouvrirEspaceParents(premier)
    await premier.locator('[data-case-parent="loki"]').click()
    await fermerEspaceParents(premier)
    await expect(premier.locator('[data-case="loki"]')).toHaveCount(1)

    // le second, qui n'en sait rien, tente d'enregistrer sa propre version
    await ouvrirEspaceParents(second)
    await second.locator('[data-case-parent="venum"]').click()

    await expect(second.locator('[data-erreur-enregistrement]')).toContainText('ouverte ailleurs')
    await expect(second.locator('[data-erreur-enregistrement]')).toContainText('Rechargez la page')

    // et le travail du premier onglet est intact dans le dépôt
    await premier.reload()
    await expect(premier.locator('[data-case="loki"]')).toHaveCount(1)
    await expect(premier.locator('[data-case="venum"]')).toHaveCount(0)
  })

  test('un rechargement remet le second onglet au niveau, et il écrit de nouveau', async ({ context }) => {
    const premier = await context.newPage()
    await premier.goto('/')
    await expect(premier.locator('[data-case]')).toHaveCount(13)
    const second = await context.newPage()
    await second.goto('/')
    await expect(second.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(premier)
    await premier.locator('[data-case-parent="loki"]').click()
    await fermerEspaceParents(premier)

    await second.reload()
    await expect(second.locator('[data-case="loki"]')).toHaveCount(1)
    await ouvrirEspaceParents(second)
    await second.locator('[data-case-parent="venum"]').click()

    await expect(second.locator('[data-erreur-enregistrement]')).toHaveCount(0)
    await fermerEspaceParents(second)
    await expect(second.locator('[data-case="venum"]')).toHaveCount(1)
    await expect(second.locator('[data-case="loki"]')).toHaveCount(1)
  })
})
