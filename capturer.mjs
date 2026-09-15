/**
 * Balayage de captures : chaque écran, à chaque largeur qui compte. Écrit dans un dossier
 * et n'assertionne rien : c'est un outil de revue visuelle, le garde-fou automatique est
 * dans les tests. Vécu : une grille recroquevillée sur un tiers de la largeur avait
 * échappé à trois captures, toutes prises en portrait étroit.
 *
 * Usage : node capturer.mjs [url] [dossier]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const url = process.argv[2] ?? 'http://localhost:4180/'
const dossier = process.argv[3] ?? '/tmp/captures-mesmots'
const TAILLES = [
  ['tablette', 800, 1280],
  ['telephone', 412, 915],
  ['portable', 1440, 900],
  ['large', 1920, 1080],
  ['court', 1024, 600],
]

async function ouvrirLesParents(page) {
  await page.mouse.move(28, 28)
  await page.mouse.down()
  await page.waitForTimeout(3100)
  await page.mouse.up()
  await page.locator('[data-reponse="12"]').click()
  await page.locator('[data-espace-parents]').waitFor()
}

await mkdir(dossier, { recursive: true })
const navigateur = await chromium.launch()
for (const [nom, largeur, hauteur] of TAILLES) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } })
  await page.goto(url)
  await page.locator('[data-case="maman"]').waitFor()
  // laisser les pictogrammes se peindre, sinon la capture montre des cadres vides
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${dossier}/${nom}-enfant.png` })

  await ouvrirLesParents(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${dossier}/${nom}-parents.png` })

  await page.locator('[data-modifier-case="maman"]').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${dossier}/${nom}-editeur.png` })

  console.log(`${nom} ${largeur}x${hauteur} : 3 captures`)
  await page.close()
}
await navigateur.close()
console.log(`captures dans ${dossier}`)
