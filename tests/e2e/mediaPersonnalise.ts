import type { Page } from '@playwright/test'

/**
 * Écrit une photo ou un son de la famille (P4, P8) directement dans les magasins, et pose
 * la référence `perso/<idCase>` sur la case visée : il n'existe pas encore d'appareil photo
 * ni de micro dans l'éditeur, ce lot pose le stockage, pas la capture.
 */
async function ecrireRessourcePersonnalisee(
  page: Page,
  magasin: 'images' | 'sons',
  champ: 'image_id' | 'sound_id',
  idCase: string,
  base64: string,
  type: string,
): Promise<void> {
  await page.evaluate(
    async ({ magasin, champ, idCase, base64, type }) => {
      const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const base = await new Promise<IDBDatabase>((resolve, reject) => {
        const requete = indexedDB.open('mes-mots')
        requete.onsuccess = () => resolve(requete.result)
        requete.onerror = () => reject(requete.error)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = base.transaction(magasin, 'readwrite')
        transaction.objectStore(magasin).put(new Blob([octets], { type }), idCase)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = base.transaction('config', 'readwrite')
        const magasinConfig = transaction.objectStore('config')
        const lecture = magasinConfig.get('configuration')
        lecture.onsuccess = () => {
          const config = lecture.result as {
            contextes: { pages: { buttons: { id: string; [cle: string]: unknown }[] }[] }[]
          }
          const bouton = config.contextes
            .flatMap((c) => c.pages)
            .flatMap((p) => p.buttons)
            .find((b) => b.id === idCase)
          if (bouton) bouton[champ] = `perso/${idCase}`
          magasinConfig.put(config, 'configuration')
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      base.close()
    },
    { magasin, champ, idCase, base64, type },
  )
}

/** Pixel PNG transparent minimal : suffisant pour vérifier stockage, affichage et géométrie. */
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

export function ajouterPhotoPersonnalisee(page: Page, idCase: string): Promise<void> {
  return ecrireRessourcePersonnalisee(page, 'images', 'image_id', idCase, PIXEL_PNG_BASE64, 'image/png')
}

/** Un seul octet : ces tests ne décodent jamais réellement le son, seuls stockage et référence comptent. */
export function ajouterSonPersonnalise(page: Page, idCase: string): Promise<void> {
  return ecrireRessourcePersonnalisee(page, 'sons', 'sound_id', idCase, 'AA==', 'audio/webm')
}

function ressourcePersonnaliseeExiste(page: Page, magasin: 'images' | 'sons', idCase: string): Promise<boolean> {
  return page.evaluate(
    ({ magasin, id }) =>
      new Promise<boolean>((resolve) => {
        const requete = indexedDB.open('mes-mots')
        requete.onsuccess = () => {
          const transaction = requete.result.transaction(magasin)
          const lecture = transaction.objectStore(magasin).get(id)
          lecture.onsuccess = () => resolve(lecture.result !== undefined)
          lecture.onerror = () => resolve(false)
        }
        requete.onerror = () => resolve(false)
      }),
    { magasin, id: idCase },
  )
}

export function sonPersonnaliseExiste(page: Page, idCase: string): Promise<boolean> {
  return ressourcePersonnaliseeExiste(page, 'sons', idCase)
}

export function imagePersonnaliseeExiste(page: Page, idCase: string): Promise<boolean> {
  return ressourcePersonnaliseeExiste(page, 'images', idCase)
}
