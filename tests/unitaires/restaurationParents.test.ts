import { describe, it, expect } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import RestaurationParents from '../../src/composants/RestaurationParents.vue'
import { construireArchive } from '../../src/domaine/archive'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'
import { ajouterContexte, type Configuration } from '../../src/domaine/planche'

function fichierDepuis(octets: Uint8Array, nom = 'sauvegarde.obz'): File {
  return new File([octets as Uint8Array<ArrayBuffer>], nom, { type: 'application/octet-stream' })
}

/** Le champ est masqué (P3/B3 réutilisent le même geste que E4) : on pose ses fichiers puis on déclenche `change` à la main. */
async function choisirFichier(ecran: VueWrapper, fichier: File): Promise<void> {
  const champ = ecran.get('[data-fichier-restauration]')
  Object.defineProperty(champ.element, 'files', { value: [fichier], configurable: true })
  await champ.trigger('change')
  await flushPromises()
}

describe('RestaurationParents', () => {
  it("affiche l aperçu comparatif d une archive valide, sans encore rien restaurer", async () => {
    const { octets } = construireArchive(CONFIGURATION_DEMO, new Map())
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })

    await choisirFichier(ecran, fichierDepuis(octets))

    expect(ecran.find('[data-apercu-restauration]').exists()).toBe(true)
    expect(ecran.get('[data-apercu-sauvegarde-contextes]').text()).toContain(
      String(CONFIGURATION_DEMO.contextes.length),
    )
    // le remplacement n'a pas encore eu lieu tant que le parent n'a pas confirmé
    expect(ecran.emitted('restaurer')).toBeUndefined()
  })

  it('Annuler referme l aperçu sans émettre restaurer', async () => {
    const { octets } = construireArchive(CONFIGURATION_DEMO, new Map())
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })
    await choisirFichier(ecran, fichierDepuis(octets))

    await ecran.get('[data-annuler-restauration]').trigger('click')

    expect(ecran.find('[data-apercu-restauration]').exists()).toBe(false)
    expect(ecran.emitted('restaurer')).toBeUndefined()
  })

  it('Remplacer émet restaurer avec la configuration de l archive, drapeau redescendu à false', async () => {
    const { octets } = construireArchive(CONFIGURATION_DEMO, new Map())
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })
    await choisirFichier(ecran, fichierDepuis(octets))

    await ecran.get('[data-confirmer-restauration]').trigger('click')

    const emise = ecran.emitted('restaurer')![0]![0] as Configuration
    expect(emise.contextes).toEqual(CONFIGURATION_DEMO.contextes)
    expect(emise.reglages.modifieDepuisSauvegarde).toBe(false)
    expect(ecran.find('[data-apercu-restauration]').exists()).toBe(false)
  })

  it("Remplacer émet aussi les ressources de l archive, photos et sons de la famille compris (P4, P8)", async () => {
    const ressources = new Map([['images/perso/maman', new TextEncoder().encode('photo de maman')]])
    const { octets } = construireArchive(CONFIGURATION_DEMO, ressources)
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })
    await choisirFichier(ecran, fichierDepuis(octets))

    await ecran.get('[data-confirmer-restauration]').trigger('click')

    const ressourcesEmises = ecran.emitted('restaurer')![0]![1] as Map<string, Uint8Array>
    expect(ressourcesEmises.get('images/perso/maman')).toEqual(ressources.get('images/perso/maman'))
  })

  it("un fichier qui n est pas une archive affiche le message d erreur de lireArchive, écran intact", async () => {
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })

    await choisirFichier(ecran, fichierDepuis(new TextEncoder().encode('pas une archive')))

    expect(ecran.get('[data-erreur-restauration]').text()).toMatch(/pas.*sauvegarde.*zip/i)
    expect(ecran.find('[data-apercu-restauration]').exists()).toBe(false)
    expect(ecran.emitted('restaurer')).toBeUndefined()
  })
})

describe('les photos et voix que le fichier n apporte pas (D17)', () => {
  /** Une configuration où MAMAN porte une photo et une voix de la famille. */
  const AVEC_MEDIAS_PERSO: Configuration = {
    ...CONFIGURATION_DEMO,
    contextes: CONFIGURATION_DEMO.contextes.map((contexte) => ({
      ...contexte,
      pages: contexte.pages.map((page) => ({
        ...page,
        buttons: page.buttons.map((bouton) =>
          bouton.id === 'maman'
            ? { ...bouton, image_id: 'perso/maman', sound_id: 'perso/maman' }
            : bouton,
        ),
      })),
    })),
  }

  it('prévient avant le remplacement, en disant combien il en manque', async () => {
    // archive construite sans les blobs : les références sont là, les fichiers non
    const { octets } = construireArchive(AVEC_MEDIAS_PERSO, new Map())
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })

    await choisirFichier(ecran, fichierDepuis(octets))

    const avertissement = ecran.get('[data-medias-manquants]').text()
    expect(avertissement).toContain('1 photo')
    expect(avertissement).toContain('1 voix enregistrée')
  })

  it('ne dit rien quand le fichier apporte tout ce qu il référence', async () => {
    const { octets } = construireArchive(CONFIGURATION_DEMO, new Map())
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })

    await choisirFichier(ecran, fichierDepuis(octets))

    expect(ecran.find('[data-medias-manquants]').exists()).toBe(false)
  })

  it("propose d ajouter les planches sans effacer, et nomme celles qui entrent", async () => {
    // le seul chemin pour livrer une planche à une tablette déjà en service : la graine ne
    // s'applique qu'au premier lancement, et remplacer effacerait le travail de la famille
    const avecEcole = ajouterContexte(CONFIGURATION_DEMO, 'École')
    const { octets } = construireArchive(avecEcole, new Map())
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })

    await choisirFichier(ecran, fichierDepuis(octets))

    expect(ecran.get('[data-ajout-possible]').text()).toContain('École')
    // les contextes déjà là ne peuvent pas entrer une seconde fois, et c'est dit
    expect(ecran.get('[data-ajout-refuse]').text()).toContain('Maison')

    await ecran.get('[data-confirmer-ajout]').trigger('click')

    const [configuration] = ecran.emitted('ajouterPlanches')![0] as [Configuration]
    expect(configuration.contextes.map((c) => c.name)).toContain('École')
    expect(ecran.emitted('restaurer')).toBeUndefined()
  })

  it("n offre pas d ajouter quand rien ne peut entrer, et n en dit rien", async () => {
    // L'avertissement ne parle que du bouton « Ajouter ». Affiché quand seul « Remplacer
    // tout » est offert, il disait en rouge et en gras d'un fichier parfaitement restaurable
    // qu'il « ne peut pas être ajouté » : on lisait « ne peut pas », et on annulait.
    const { octets } = construireArchive(CONFIGURATION_DEMO, new Map())
    const ecran = mount(RestaurationParents, { props: { configuration: CONFIGURATION_DEMO } })

    await choisirFichier(ecran, fichierDepuis(octets))

    expect(ecran.find('[data-confirmer-ajout]').exists()).toBe(false)
    expect(ecran.find('[data-ajout-refuse]').exists()).toBe(false)
    // et « Remplacer tout » garde le rouge du sans-retour, même seul chemin offert
    expect(ecran.get('[data-confirmer-restauration]').classes()).toContain('remplacer')
  })
})
