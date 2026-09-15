import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sources = resolve(__dirname, '../../src')

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = resolve(dossier, entree.name)
    if (entree.isDirectory()) return fichiers(chemin)
    return /\.(ts|vue)$/.test(entree.name) ? [chemin] : []
  })
}

/**
 * Le bug que `urlLivree` corrige ne se voit pas sur la tablette : elle sert l'application à
 * la racine du domaine, où une adresse en dur tombe juste. Il ne se voit que sur la démo
 * publique, servie sous `/mes-mots/`, et sous la forme d'une grille de cases vides ou d'une
 * sauvegarde qui déclare tout manquant. Aucun test ne peut l'attraper site par site, puisque
 * `BASE_URL` vaut « / » sous vitest : ce qui se vérifie, c'est qu'aucun appelant n'écrit
 * l'adresse lui-même. Le CSS échappe à la règle, Vite y réécrit `url(/…)` contre la base.
 */
describe('les ressources livrées ne se cherchent jamais à la racine du domaine', () => {
  it('aucune source ne fabrique une adresse de ressource à la main', () => {
    const fautifs = fichiers(sources).flatMap((chemin) =>
      readFileSync(chemin, 'utf8')
        .split('\n')
        .map((ligne, index) => ({ ligne, numero: index + 1 }))
        .filter(({ ligne }) => /[`'"]\/(images|sons|polices)\//.test(ligne) || /[`'"]\/\$\{/.test(ligne))
        .map(({ numero }) => `${chemin.slice(sources.length + 1)}:${numero}`),
    )
    expect(fautifs).toEqual([])
  })
})
