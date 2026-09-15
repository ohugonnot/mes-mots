/**
 * Fausse implémentation d'`idb`, magasins et montée de version compris. happy-dom, utilisé
 * par ce projet pour les tests unitaires, n'implémente pas IndexedDB : impossible d'y tester
 * le dépôt contre une vraie base, comme le font déjà depotConnexion.test.ts et
 * depotMigrationDrapeau.test.ts en remplaçant `idb` entièrement.
 */
export interface EtatBaseFactice {
  version: number
  stores: Map<string, Map<string, unknown>>
  /** Simule un dépôt indisponible : la prochaine ouverture échoue au lieu de réussir. */
  panne: boolean
}

interface DBFactice {
  objectStoreNames: { contains: (nom: string) => boolean }
  createObjectStore: (nom: string) => void
  deleteObjectStore: (nom: string) => void
}

function magasin(etat: EtatBaseFactice, nom: string): Map<string, unknown> {
  let contenu = etat.stores.get(nom)
  if (!contenu) {
    contenu = new Map()
    etat.stores.set(nom, contenu)
  }
  return contenu
}

/**
 * `upgrade` n'est rejoué que si la version demandée dépasse celle déjà connue de l'état
 * factice : comme la vraie IndexedDB, une base déjà à jour ne repasse jamais par `upgrade`.
 */
export function openDBFactice(etat: EtatBaseFactice) {
  return (_nom: string, version: number, options?: { upgrade?: (db: DBFactice) => void }) => {
    if (etat.panne) return Promise.reject(new Error('stockage indisponible'))
    if (etat.version < version) {
      options?.upgrade?.({
        objectStoreNames: { contains: (nom) => etat.stores.has(nom) },
        createObjectStore: (nom) => void magasin(etat, nom),
        deleteObjectStore: (nom) => etat.stores.delete(nom),
      })
      etat.version = version
    }
    return Promise.resolve({
      get: (nomMagasin: string, cle: string) => Promise.resolve(magasin(etat, nomMagasin).get(cle)),
      put: (nomMagasin: string, valeur: unknown, cle: string) => {
        magasin(etat, nomMagasin).set(cle, valeur)
        return Promise.resolve()
      },
      delete: (nomMagasin: string, cle: string) => {
        magasin(etat, nomMagasin).delete(cle)
        return Promise.resolve()
      },
      getAllKeys: (nomMagasin: string) => Promise.resolve([...magasin(etat, nomMagasin).keys()]),
    })
  }
}
