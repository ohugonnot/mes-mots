import { expect, type Page } from '@playwright/test'

/**
 * Angle haut gauche du coin protégé, dans le bleu qui borde la bande de phrase. Mesuré et non
 * écrit en dur : sur un écran large l'application se centre, et le coin n'est plus au bord de
 * la fenêtre. Pas le centre : la zone couvre toute la rangée et passe derrière ce que l'enfant
 * touche, donc en enchaînement son centre tombe sur les mots posés, qui répondent les premiers.
 */
export async function presserLeCoin(page: Page, dureeMs: number): Promise<void> {
  const coin = (await page.locator('[data-coin-parents]').boundingBox())!
  await page.mouse.move(coin.x + 8, coin.y + 8)
  await page.mouse.down()
  await page.waitForTimeout(dureeMs)
}

/**
 * Résout l'addition affichée au lieu de cliquer une valeur en dur : l'énoncé et l'ordre des
 * réponses changent à chaque ouverture, précisément pour qu'aucune position ne se mémorise.
 * Un test qui viserait « 12 » testerait donc l'ancienne version.
 */
export async function repondreALaQuestion(page: Page): Promise<void> {
  const enonce = await page.locator('[data-enonce]').textContent()
  const [gauche, droite] = enonce!.match(/\d+/g)!.map(Number)
  await page.locator(`[data-reponse="${gauche! + droite!}"]`).click()
}

/** Tient le coin 3 s, résout l'addition, et rend la main sur l'espace parents ouvert. */
export async function ouvrirEspaceParents(page: Page): Promise<void> {
  await presserLeCoin(page, 3100)
  await expect(page.locator('[data-question-parents]')).toBeVisible()
  await page.mouse.up()
  await repondreALaQuestion(page)
  await expect(page.locator('[data-espace-parents]')).toBeVisible()
}

/**
 * Ferme l'espace parents. Toute modification lève le rappel de sauvegarde (B4), qui
 * s'interpose alors à la place de l'écran de l'enfant : les tests qui ne portent pas sur
 * ce rappel le referment ici par « Plus tard » pour revenir à l'enfant sans le tester.
 */
export async function fermerEspaceParents(page: Page): Promise<void> {
  await page.locator('[data-fermer-parents]').click()
  await page.locator('[data-rappel-sauvegarde], [data-case]').first().waitFor()
  if (await page.locator('[data-rappel-sauvegarde]').count()) {
    await page.locator('[data-plus-tard]').click()
  }
}

/**
 * Passe sur « Sauvegarde » : l'inventaire de la tablette, enregistrer, restaurer, imprimer,
 * et l'effacement total. Tout ce qui touche au fichier de sauvegarde vit là.
 */
export async function ouvrirOngletSauvegarde(page: Page): Promise<void> {
  await page.locator('[data-onglet="sauvegarde"]').click()
  await expect(page.locator('[data-onglet-sauvegarde]')).toBeVisible()
}

/** Passe sur « Réglages » : volume, appui, écran de l'enfant, forme de la grille, version. */
export async function ouvrirOngletReglages(page: Page): Promise<void> {
  await page.locator('[data-onglet="reglages"]').click()
  await expect(page.locator('[data-onglet-reglages]')).toBeVisible()
}

/**
 * Déplie « Gérer les contextes » dans l'espace parents. Ces quatre actions sont rares et
 * vivent repliées : empilées, elles repoussaient la grille des mots hors de l'écran d'un
 * téléphone. Sans effet si le repli est déjà ouvert.
 */
export async function ouvrirGestionContextes(page: Page): Promise<void> {
  const repli = page.locator('[data-actions-contexte]')
  if (await repli.evaluate((n) => (n as HTMLDetailsElement).open)) return
  await repli.locator('summary').click()
  await expect(page.locator('[data-nouveau-contexte], [data-renommer-contexte]').first()).toBeVisible()
}

/**
 * Rallume les deux corps à toucher de « J'ai mal », éteints à la livraison depuis qu'ils ont
 * fait peur à l'enfant. Écrit dans IndexedDB et recharge, comme e15-enchainement allume le
 * sien : le chemin du parent est vérifié dans son propre test, et les autres n'ont pas à
 * payer trois secondes d'appui long chacun.
 */
export async function allumerLeCorpsAToucher(page: Page): Promise<void> {
  await page.locator('[data-case], [data-silhouette]').first().waitFor()
  await page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ko(requete.error)
    })
    const magasin = base.transaction('config', 'readwrite').objectStore('config')
    const configuration = await new Promise<{ reglages: Record<string, unknown> }>((ok) => {
      const lecture = magasin.get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
    })
    configuration.reglages.corpsAToucher = true
    await new Promise<void>((ok) => {
      const ecriture = magasin.put(configuration, 'configuration')
      ecriture.onsuccess = () => ok()
    })
  })
  await page.reload()
}

/** Déplie le journal en tête des mots : ce que l'enfant a dit aujourd'hui, avec l'heure. */
export async function deplierLeJournal(page: Page): Promise<void> {
  const repli = page.locator('[data-onglet-historique]')
  if (await repli.evaluate((n) => (n as HTMLDetailsElement).open)) return
  await repli.locator('summary').click()
  await expect(page.locator('[data-journal], [data-journal-vide]').first()).toBeVisible()
}

/**
 * Les réglages tels qu'IndexedDB les porte. Recharger la page juste après un clic teste une
 * course, pas un comportement : l'écriture est asynchrone, et la page relit alors l'ancienne
 * valeur. On attend donc la persistance avant de recharger.
 */
export async function reglagesPersistes(page: Page): Promise<Record<string, unknown>> {
  const configuration = await configurationPersistee(page)
  return (configuration.reglages as Record<string, unknown>) ?? {}
}

/** La configuration entière telle qu'IndexedDB la porte, pour ce qui ne vit pas dans les
 *  réglages : la forme des grilles, par exemple, est écrite page par page. */
export async function configurationPersistee(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ko(requete.error)
    })
    return new Promise<Record<string, unknown>>((ok) => {
      const lecture = base.transaction('config').objectStore('config').get('configuration')
      lecture.onsuccess = () => ok((lecture.result as Record<string, unknown>) ?? {})
      lecture.onerror = () => ok({})
    })
  })
}
