// Planche-contact des captures, pour les relire d'un coup d'œil au lieu d'ouvrir 46 fichiers.
// Outil de travail, pas une pièce de la notice.
import { chromium } from '@playwright/test'
import { readdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ici = dirname(fileURLToPath(import.meta.url))
const dossier = resolve(ici, 'captures')
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.png')).sort()
const parPlanche = 16

const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1400, height: 1100 } })

for (let debut = 0, n = 1; debut < fichiers.length; debut += parPlanche, n += 1) {
  const lot = fichiers.slice(debut, debut + parPlanche)
  // Écrit à côté des images : une page `about:blank` n'a pas le droit de lire un `file://`.
  const provisoire = resolve(dossier, '_planche.html')
  writeFileSync(
    provisoire,
    `<style>
      body { margin:0; background:#222; color:#fff; font:12px sans-serif;
             display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:6px }
      figure { margin:0; background:#333; padding:4px; display:flex; flex-direction:column }
      img { width:100%; height:220px; object-fit:contain; background:#111 }
      figcaption { padding-top:3px }
    </style>
    ${lot.map((f) => `<figure><img src="${f}"><figcaption>${f}</figcaption></figure>`).join('')}`,
  )
  await page.goto(`file://${provisoire}`, { waitUntil: 'networkidle' })
  unlinkSync(provisoire)
  await page.screenshot({ path: resolve(ici, `planche-contact-${n}.png`), fullPage: true })
}

await navigateur.close()
