/**
 * Vérifie EG-01 : l'application fonctionne sans réseau.
 *
 * Hors du lanceur Playwright, parce que context.setOffline coupe la navigation avant que
 * le service worker puisse répondre, et que l'interception de routes ne se comporte pas
 * de la même façon. Ici on fait la seule chose vraiment fidèle : on arrête le serveur.
 */
import { chromium } from '@playwright/test'
import { execSync, spawn } from 'node:child_process'

const PORT = 4199
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))

const serveur = spawn('./node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
})
await attendre(4000)

const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 800, height: 1280 } })
// sonde d'observation des sons, injectée par le test : l'application n'expose rien
await page.addInitScript(() => {
  const Origine = window.Audio
  window.__sonsJoues = []
  window.Audio = function (src) {
    window.__sonsJoues.push(src)
    return new Origine(src)
  }
})
let echec = null

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' })
  await page.waitForFunction(
    async () => {
      if (!navigator.serviceWorker.controller) return false
      for (const nom of await caches.keys()) {
        if (await (await caches.open(nom)).match('/sons/boire.mp3')) return true
      }
      return false
    },
    undefined,
    { timeout: 20000 },
  )

  process.kill(-serveur.pid)
  await attendre(1500)

  await page.reload({ waitUntil: 'load' })

  const cases = await page.locator('[data-case]').count()
  if (cases !== 13) echec = `grille absente hors ligne : ${cases} cases au lieu de 13`

  await page.locator('[data-case="boire"]').click()
  await page.waitForTimeout(300)
  const sons = await page.evaluate(() => window.__sonsJoues)
  if (sons.length !== 1 || !sons[0].endsWith('/sons/boire.mp3')) {
    echec ??= `son non déclenché hors ligne : ${JSON.stringify(sons)}`
  }

  const son = await page.evaluate(async () => {
    const r = await fetch('/sons/boire.mp3')
    return { ok: r.ok, taille: (await r.blob()).size }
  })
  if (!son.ok || son.taille < 1000) echec ??= `audio indisponible hors ligne : ${JSON.stringify(son)}`
} catch (e) {
  echec = String(e).split('\n')[0]
} finally {
  await navigateur.close()
  try { process.kill(-serveur.pid) } catch { /* déjà arrêté */ }
  try { execSync(`ss -lptn 'sport = :${PORT}' | grep -oP 'pid=\\K[0-9]+' | head -1 | xargs -r kill`) } catch { /* rien à tuer */ }
}

if (echec) {
  console.log(`  hors ligne : ÉCHEC, ${echec}`)
  process.exit(1)
}
console.log('  hors ligne : ok, grille et son servis serveur arrêté')
