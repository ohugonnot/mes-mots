// Rend notice.html en PDF. Le navigateur de Playwright sait imprimer, aucune librairie de
// PDF n'entre au dépôt : c'est l'arbitrage déjà pris pour les planches à imprimer (D20).
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

const ici = dirname(fileURLToPath(import.meta.url))
const source = resolve(ici, 'notice.html')
// Le dépôt de travail range la notice avec les autres documents de la famille ; le dépôt
// public n'a pas ce dossier et la publie dans `docs/`. Le repère est le texte source, jamais
// le PDF : celui-ci peut traîner n'importe où, lui ne vit que dans le dépôt de travail.
const aCoteDesDocuments = resolve(ici, '../../projet/NOTICE-FAMILLE.md')
const sortie = existsSync(aCoteDesDocuments)
  ? resolve(aCoteDesDocuments, '../NOTICE-FAMILLE.pdf')
  : resolve(ici, '../docs/notice-famille.pdf')

mkdirSync(dirname(sortie), { recursive: true })

const navigateur = await chromium.launch()
const page = await navigateur.newPage()
await page.goto(`file://${source}`, { waitUntil: 'networkidle' })
// Sans ça les règles d'impression ne s'appliquent pas et la page sort à la taille de l'écran.
await page.emulateMedia({ media: 'print' })
await page.pdf({
  path: sortie,
  format: 'A4',
  printBackground: true,
  // Les marges sont dans la feuille de style, pour que l'en-tête de page puisse s'y poser.
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
})
await navigateur.close()
console.log(sortie)
