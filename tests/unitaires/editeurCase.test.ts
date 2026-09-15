import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EditeurCase from '../../src/composants/EditeurCase.vue'
import { caseParIdentifiant } from '../../src/domaine/planche'
import { PLANCHE_DEMO } from '../../src/domaine/plancheDemo'

const redimensionnerImage = vi.hoisted(() => vi.fn())
vi.mock('../../src/domaine/image', () => ({ redimensionnerImage, COTE_VIGNETTE: 448 }))

const CHAMBRE = caseParIdentifiant(PLANCHE_DEMO, 'chambre')!

// jsdom n'a pas de synthèse vocale ; sans ce faux l'éditeur croit tourner sur un appareil
// muet et propose partout d'enregistrer une voix au lieu de faire écouter la sienne.
beforeEach(() => vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() }))

/** Simule le choix d'un fichier sur un input caché : `setValue` ne marche pas sur type=file. */
async function choisirFichier(ecran: ReturnType<typeof mount>, selecteur: string, fichier: File) {
  const entree = ecran.get(selecteur).element as HTMLInputElement
  Object.defineProperty(entree, 'files', { value: [fichier], configurable: true })
  await ecran.get(selecteur).trigger('change')
  await flushPromises()
}

describe('éditeur de case', () => {
  it('refuse un mot vide', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })
    await ecran.get('[data-champ-vocalization]').setValue('Une phrase')

    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.get('[data-erreur-label]').text()).toContain('obligatoire')
    expect(ecran.emitted('enregistrer')).toBeUndefined()
  })

  it('refuse un mot de plus de 14 caractères', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })
    await ecran.get('[data-champ-label]').setValue('UN MOT BEAUCOUP TROP LONG')
    await ecran.get('[data-champ-vocalization]').setValue('Une phrase')

    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.get('[data-erreur-label]').text()).toContain('14 caractères')
    expect(ecran.emitted('enregistrer')).toBeUndefined()
  })

  it('refuse une phrase prononcée vide', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })
    await ecran.get('[data-champ-label]').setValue('PROMENADE')

    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.get('[data-erreur-vocalization]').text()).toContain('obligatoire')
    expect(ecran.emitted('enregistrer')).toBeUndefined()
  })

  it('laisse passer un cas valide et émet les champs saisis', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })
    await ecran.get('[data-champ-label]').setValue('PROMENADE')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux me promener')
    await ecran.get('[data-champ-enchainement]').setValue('promener')

    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.find('[data-erreur-label]').exists()).toBe(false)
    expect(ecran.find('[data-erreur-vocalization]').exists()).toBe(false)
    expect(ecran.emitted('enregistrer')![0]![0]).toMatchObject({
      label: 'PROMENADE',
      vocalization: 'Je veux me promener',
      ext_mesmots_enchaine: 'promener',
    })
  })

  it('propose les huit familles de la palette, sans saisie libre de couleur', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })

    expect(ecran.findAll('[data-famille]')).toHaveLength(8)
    expect(ecran.find('input[type="color"]').exists()).toBe(false)
    expect(ecran.find('input[type="text"][data-couleur]').exists()).toBe(false)
  })

  it('pré-remplit les champs en modification', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    expect(ecran.get<HTMLInputElement>('[data-champ-label]').element.value).toBe('CHAMBRE')
    expect(ecran.get<HTMLInputElement>('[data-champ-vocalization]').element.value).toBe(
      'Ma chambre',
    )
  })

  it('ne propose la suppression qu en modification', () => {
    expect(
      mount(EditeurCase, { props: { caseExistante: null } })
        .find('[data-demander-suppression]')
        .exists(),
    ).toBe(false)
    expect(
      mount(EditeurCase, { props: { caseExistante: CHAMBRE } })
        .find('[data-demander-suppression]')
        .exists(),
    ).toBe(true)
  })

  it('la confirmation de suppression nomme la case et annonce ce qui va se passer', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-demander-suppression]').trigger('click')

    const confirmation = ecran.get('[data-confirmation-suppression]')
    expect(confirmation.text()).toContain('CHAMBRE')
    expect(confirmation.text()).toContain('sera supprimée')
    expect(confirmation.text()).toContain('emplacement restera vide')
    expect(confirmation.text()).toContain('aucune autre case ne bougera')
    expect(ecran.emitted('supprimer')).toBeUndefined()
  })

  it('émet supprimer seulement après confirmation', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-demander-suppression]').trigger('click')
    await ecran.get('[data-confirmer-suppression]').trigger('click')

    expect(ecran.emitted('supprimer')).toHaveLength(1)
  })

  it('émet fermer sur le bouton de fermeture sans enregistrer', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })

    await ecran.get('[data-fermer-editeur]').trigger('click')

    expect(ecran.emitted('fermer')).toHaveLength(1)
  })

  it('la croix ferme tout de suite quand rien n a été touché', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-fermer-editeur]').trigger('click')

    expect(ecran.emitted('fermer')).toHaveLength(1)
  })

  it('un appui à côté du panneau ferme aussi, tant que rien n a changé', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-editeur-case]').trigger('click')

    expect(ecran.emitted('fermer')).toHaveLength(1)
  })

  it('prévient avant de perdre une saisie, au lieu de fermer sans un mot', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })
    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter dans ma chambre')

    await ecran.get('[data-editeur-case]').trigger('click')

    expect(ecran.emitted('fermer')).toBeUndefined()
    expect(ecran.get('[data-confirmation-fermeture]').text()).toContain('ne seront pas gardés')

    await ecran.get('[data-confirmer-fermeture]').trigger('click')
    expect(ecran.emitted('fermer')).toHaveLength(1)
  })

  it('revenir à la modification referme l avertissement sans rien perdre', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })
    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter dans ma chambre')
    await ecran.get('[data-fermer-editeur]').trigger('click')

    await ecran.get('[data-annuler-fermeture]').trigger('click')

    expect(ecran.find('[data-confirmation-fermeture]').exists()).toBe(false)
    expect((ecran.get('[data-champ-vocalization]').element as HTMLInputElement).value).toBe(
      'Je veux monter dans ma chambre',
    )
  })

  it('la validation laisse passer une case sans photo ni son', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })
    await ecran.get('[data-champ-label]').setValue('PROMENADE')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux me promener')

    await ecran.get('[data-enregistrer-case]').trigger('click')

    const emission = ecran.emitted('enregistrer')![0]!
    expect(emission[1]).toEqual({ statut: 'inchange' })
    expect(emission[2]).toEqual({ statut: 'inchange' })
  })
})

describe('éditeur de case, la photo (P4)', () => {
  afterEach(() => {
    redimensionnerImage.mockReset()
    vi.restoreAllMocks()
  })

  const fichierPhoto = () => new File(['une photo'], 'photo.jpg', { type: 'image/jpeg' })

  it('montre laquelle des deux images la case porte', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    expect((ecran.get('[data-image="image"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('le mot en grand se choisit, même sur un mot que l application illustre', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-image="aucune"]').setValue()
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.emitted('enregistrer')![0]![1]).toEqual({ statut: 'aucun' })
  })

  it('choisir une photo dans la galerie la redimensionne et l émet comme nouvelle', async () => {
    const vignette = new Blob(['vignette'], { type: 'image/jpeg' })
    redimensionnerImage.mockResolvedValue(vignette)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vignette')
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })
    const fichier = fichierPhoto()

    await choisirFichier(ecran, '[data-champ-photo-galerie]', fichier)

    expect(redimensionnerImage).toHaveBeenCalledWith(fichier)
    expect(ecran.get('[data-apercu-photo]').attributes('src')).toBe('blob:vignette')

    await ecran.get('[data-champ-label]').setValue('CHAMBRE')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter')
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.emitted('enregistrer')![0]![1]).toEqual({ statut: 'nouveau', blob: vignette })
  })

  it('une photo illisible affiche un message en français et laisse l éditeur utilisable', async () => {
    redimensionnerImage.mockRejectedValue(new DOMException('mauvais format', 'InvalidStateError'))
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await choisirFichier(ecran, '[data-champ-photo-appareil]', fichierPhoto())

    expect(ecran.get('[data-erreur-photo]').text()).toContain('pas pu être lue')
    expect(ecran.find('[data-editeur-case]').exists()).toBe(true)
    expect(ecran.find('[data-apercu-photo]').exists()).toBe(false)
  })

  it('choisir le mot en grand efface la photo de la famille et l émet', async () => {
    const ecran = mount(EditeurCase, {
      props: { caseExistante: { ...CHAMBRE, image_id: 'perso/chambre' } },
    })
    expect(ecran.find('[data-image-actuelle]').exists()).toBe(true)

    await ecran.get('[data-image="aucune"]').setValue()

    // aucun repli vers le pictogramme livré : remplacer, c'est remplacer
    expect(ecran.find('[data-image-actuelle]').exists()).toBe(false)
    await ecran.get('[data-champ-label]').setValue('CHAMBRE')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter')
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.emitted('enregistrer')![0]![1]).toEqual({ statut: 'aucun' })
  })
})

describe('éditeur de case, le son (P8)', () => {
  const ORIGINAL_MEDIA_RECORDER = globalThis.MediaRecorder

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    globalThis.MediaRecorder = ORIGINAL_MEDIA_RECORDER
  })

  function stubMediaRecorder() {
    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported() {
          return true
        }
      },
    )
  }

  function stubMicro(erreur: DOMException | null) {
    const obtenirFlux = erreur ? vi.fn().mockRejectedValue(erreur) : vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: obtenirFlux },
      configurable: true,
    })
    return obtenirFlux
  }

  it('la permission micro refusée affiche un message et laisse l éditeur utilisable', async () => {
    stubMediaRecorder()
    stubMicro(new DOMException('refusé', 'NotAllowedError'))
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()

    expect(ecran.get('[data-erreur-son]').text()).toContain('refusé')
    expect(ecran.find('[data-editeur-case]').exists()).toBe(true)
  })

  it('aucun micro disponible affiche un message distinct', async () => {
    stubMediaRecorder()
    stubMicro(new DOMException('absent', 'NotFoundError'))
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()

    expect(ecran.get('[data-erreur-son]').text()).toContain('Aucun micro')
  })

  it('MediaRecorder absent du navigateur affiche un message sans jamais appeler le micro', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const obtenirFlux = stubMicro(null)
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()

    expect(ecran.get('[data-erreur-son]').text()).toContain("n'est pas possible")
    expect(obtenirFlux).not.toHaveBeenCalled()
  })

  it('montre laquelle des deux voix parle aujourd hui', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    expect((ecran.get('[data-voix="enregistree"]').element as HTMLInputElement).checked).toBe(true)
    // un mot créé de zéro n'a aucune voix à remettre : le choix reste fermé
    const vierge = mount(EditeurCase, { props: { caseExistante: null } })
    expect((vierge.get('[data-voix="enregistree"]').element as HTMLInputElement).disabled).toBe(true)
    expect((vierge.get('[data-voix="texte"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('renoncer à la voix de la famille émet un son absent, sans rappeler le fichier livré', async () => {
    const ecran = mount(EditeurCase, {
      props: { caseExistante: { ...CHAMBRE, sound_id: 'perso/chambre' } },
    })

    await ecran.get('[data-voix="texte"]').setValue()
    await ecran.get('[data-champ-label]').setValue('CHAMBRE')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter')
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.emitted('enregistrer')![0]![2]).toEqual({ statut: 'aucun' })
  })
})

/** Enregistreur fabriqué : retient les options de construction et sait s'arrêter. */
function stubEnregistreurQuiMarche() {
  const options: MediaRecorderOptions[] = []
  const arrets: number[] = []
  class Faux {
    static isTypeSupported() {
      return true
    }
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    state: 'inactive' | 'recording' = 'inactive'
    constructor(_flux: MediaStream, opts: MediaRecorderOptions) {
      options.push(opts)
    }
    start() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      arrets.push(Date.now())
      // comme le vrai : onstop arrive plus tard, et c'est dans cet intervalle qu'un second
      // appui rappelait stop() sur un enregistreur déjà arrêté
      void Promise.resolve().then(() => {
        this.ondataavailable?.({ data: new Blob(['son'], { type: 'audio/webm' }) })
        this.onstop?.()
      })
    }
  }
  vi.stubGlobal('MediaRecorder', Faux)
  const piste = { stop: vi.fn() }
  const obtenirFlux = vi.fn().mockResolvedValue({ getTracks: () => [piste] })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: obtenirFlux },
    configurable: true,
  })
  return { options, arrets, piste, obtenirFlux }
}

describe('enregistrement borné à la source (P8)', () => {
  const ORIGINAL_MEDIA_RECORDER = globalThis.MediaRecorder


  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    globalThis.MediaRecorder = ORIGINAL_MEDIA_RECORDER
  })

  it('demande 32 kbit/s, le débit de la parole, et non celui par défaut du navigateur', async () => {
    // Sans le préciser, Chrome enregistre à 128 kbit/s : une phrase de trois secondes
    // pèse quatre fois plus, sur un appareil dont on ne maîtrise pas la place.
    const { options } = stubEnregistreurQuiMarche()
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()

    expect(options[0]?.audioBitsPerSecond).toBe(32_000)
  })

  it('s arrête tout seul au bout de quinze secondes, un enregistrement oublié ne tourne pas', async () => {
    const { arrets } = stubEnregistreurQuiMarche()
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()
    expect(arrets).toHaveLength(0)

    vi.advanceTimersByTime(14_999)
    expect(arrets).toHaveLength(0)

    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(arrets).toHaveLength(1)
  })

  it('un arrêt manuel n est pas suivi d un second arrêt par le minuteur', async () => {
    const { arrets } = stubEnregistreurQuiMarche()
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()
    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(20_000)

    expect(arrets).toHaveLength(1)
  })
})

describe('ce que la tablette dira quand aucun enregistrement ne parle', () => {
  it('l annonce à la création, où rien n a encore été enregistré', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: null } })

    expect(ecran.get('[data-voix-tablette]').text()).toContain('lira le texte')
    expect(ecran.find('[data-ecouter-texte]').exists()).toBe(true)
  })

  it('se tait pour un mot qui a déjà un son livré', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    expect(ecran.find('[data-voix-tablette]').exists()).toBe(false)
  })

  it('se tait pour un mot dont la famille a enregistré la voix', () => {
    const ecran = mount(EditeurCase, {
      props: { caseExistante: { ...CHAMBRE, sound_id: 'perso/chambre' } },
    })

    expect(ecran.find('[data-voix-tablette]').exists()).toBe(false)
  })

  it('propose de passer à la voix de la tablette, et l émet comme un son absent', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-voix="texte"]').setValue()
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.emitted('enregistrer')![0]![2]).toEqual({ statut: 'aucun' })
  })

  it('dit son impuissance sur un appareil qui ne sait pas lire un texte', () => {
    vi.stubGlobal('speechSynthesis', undefined)

    const ecran = mount(EditeurCase, { props: { caseExistante: null } })

    expect(ecran.find('[data-ecouter-texte]').exists()).toBe(false)
    expect(ecran.get('[data-sans-synthese]').text()).toContain('Enregistrez votre voix')
  })
})

describe('le texte réécrit alors qu un enregistrement parle encore', () => {
  it('prévient que la tablette dira toujours l ancien mot', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })
    expect(ecran.find('[data-texte-sans-voix]').exists()).toBe(false)

    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter dans ma chambre')

    expect(ecran.get('[data-texte-sans-voix]').text()).toContain('toujours cet enregistrement')
  })

  it('se tait dès que la tablette lit le texte', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })
    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter dans ma chambre')

    await ecran.get('[data-voix="texte"]').setValue()

    expect(ecran.find('[data-texte-sans-voix]').exists()).toBe(false)
  })
})


describe('l enregistreur ne se laisse pas bousculer (revue en aveugle)', () => {
  const ORIGINAL_MEDIA_RECORDER = globalThis.MediaRecorder
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    globalThis.MediaRecorder = ORIGINAL_MEDIA_RECORDER
  })

  it('deux appuis rapides pendant l attente de la permission n ouvrent qu un seul micro', async () => {
    const { piste } = stubEnregistreurQuiMarche()
    // la permission reste en attente entre les deux appuis : attendre entre eux rendait le
    // second appui inoffensif, le bouton étant déjà passé en « Arrêter », et le test vert
    // même sans la garde
    let donnerLaPermission = (_flux: unknown) => {}
    const permission = new Promise((resoudre) => {
      donnerLaPermission = resoudre
    })
    const obtenirFlux = vi.fn().mockReturnValue(permission)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: obtenirFlux },
      configurable: true,
    })
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    const bouton = ecran.get('[data-bouton-enregistrer-son]')
    bouton.trigger('click')
    bouton.trigger('click')
    donnerLaPermission({ getTracks: () => [piste] })
    await flushPromises()

    expect(obtenirFlux).toHaveBeenCalledTimes(1)
  })

  it('relâche vraiment le micro à l arrêt, pas seulement l enregistreur', async () => {
    // tous les doubles rendaient une liste de pistes vide : rien ne prouvait que le matériel
    // était libéré, et la mutation qui retirait piste.stop() restait verte
    const { piste } = stubEnregistreurQuiMarche()
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()
    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()

    expect(piste.stop).toHaveBeenCalledTimes(1)
  })

  it('fermer l éditeur en plein enregistrement relâche le micro et désarme le minuteur', async () => {
    const { piste, arrets } = stubEnregistreurQuiMarche()
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()
    ecran.unmount()
    expect(piste.stop).toHaveBeenCalledTimes(1)
    expect(arrets).toHaveLength(1)

    vi.advanceTimersByTime(20_000)
    expect(arrets, 'le minuteur ne doit plus rappeler stop après le démontage').toHaveLength(1)
  })

  it('un second arrêt avant onstop ne rappelle pas stop sur un enregistreur arrêté', async () => {
    const { arrets } = stubEnregistreurQuiMarche()
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()
    // deux appuis sans rien attendre entre eux : onstop n'a pas encore eu lieu au second
    const bouton = ecran.get('[data-bouton-enregistrer-son]')
    void bouton.trigger('click')
    void bouton.trigger('click')
    await flushPromises()

    expect(arrets).toHaveLength(1)
  })

  it('le micro occupé par une autre application a son propre message', async () => {
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true } })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('occupé', 'NotReadableError')) },
      configurable: true,
    })
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()

    expect(ecran.get('[data-erreur-son]').text()).toContain('déjà utilisé par une autre application')
  })
})

describe('un mot de la famille n a pas de MP3 livré derrière sa voix', () => {
  const motFamille = { ...CHAMBRE, id: 'ballon', label: 'BALLON', sound_id: 'perso/ballon' }

  it('la voix de la tablette prend le relais, quel que soit le mot', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: motFamille } })

    await ecran.get('[data-voix="texte"]').setValue()

    expect(ecran.get('[data-voix-tablette]').text()).toContain('lira le texte')
  })

  it('revenir sur son choix pendant la modification rend la voix que le mot avait', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })
    await ecran.get('[data-voix="texte"]').setValue()

    await ecran.get('[data-voix="enregistree"]').setValue()

    expect(ecran.get('[data-lecture-son-actuel]').attributes('src')).toBe('/sons/chambre.mp3')
  })
})


describe('fermer l éditeur en pleine prise de voix ne laisse rien derrière', () => {
  const ORIGINAL_MEDIA_RECORDER = globalThis.MediaRecorder
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    globalThis.MediaRecorder = ORIGINAL_MEDIA_RECORDER
  })

  it('n crée aucune URL d objet quand onstop arrive après le démontage', async () => {
    // Le radar : L'enfant réclame, la mère ferme l'éditeur pendant l'enregistrement ; onstop
    // arrivait ensuite et créait une URL que plus personne ne libérait, pour toute la session.
    stubEnregistreurQuiMarche()
    const creer = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fantome')
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    await flushPromises()
    ecran.unmount()
    await flushPromises()

    expect(creer).not.toHaveBeenCalled()
  })
})

describe('les constats du radar des médias', () => {
  const ORIGINAL_MEDIA_RECORDER = globalThis.MediaRecorder
  afterEach(() => {
    redimensionnerImage.mockReset()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    globalThis.MediaRecorder = ORIGINAL_MEDIA_RECORDER
  })

  it('la permission accordée après la fermeture de l éditeur coupe le micro sans rien enregistrer', async () => {
    // Le cas déjà couvert est celui du flux qui existe au démontage. Ici il n'existe pas
    // encore : le micro s'ouvrait après coup sur un composant détruit et tournait quinze
    // secondes, sans rien à l'écran pour l'arrêter.
    const { piste, options } = stubEnregistreurQuiMarche()
    let donnerLaPermission = (_flux: unknown) => {}
    const permission = new Promise((resoudre) => {
      donnerLaPermission = resoudre
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => permission },
      configurable: true,
    })
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await ecran.get('[data-bouton-enregistrer-son]').trigger('click')
    ecran.unmount()
    donnerLaPermission({ getTracks: () => [piste] })
    await flushPromises()

    expect(options, 'un enregistreur a été créé après la fermeture').toHaveLength(0)
    expect(piste.stop).toHaveBeenCalled()
  })

  it('deux photos choisies coup sur coup : celle que le parent a choisie en dernier reste', async () => {
    // La photo prise à l'appareil est plus lourde à décoder que celle de la galerie : elle
    // finissait après et écrasait le choix suivant du parent.
    const appareil = new Blob(['appareil'], { type: 'image/jpeg' })
    const galerie = new Blob(['galerie'], { type: 'image/jpeg' })
    let terminerLAppareil = (_vignette: Blob) => {}
    redimensionnerImage
      .mockReturnValueOnce(
        new Promise<Blob>((resoudre) => {
          terminerLAppareil = resoudre
        }),
      )
      .mockResolvedValueOnce(galerie)
    vi.spyOn(URL, 'createObjectURL').mockImplementation((source) =>
      source === galerie ? 'blob:galerie' : 'blob:appareil',
    )
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await choisirFichier(ecran, '[data-champ-photo-appareil]', new File(['a'], 'a.jpg'))
    await choisirFichier(ecran, '[data-champ-photo-galerie]', new File(['g'], 'g.jpg'))
    terminerLAppareil(appareil)
    await flushPromises()

    expect(ecran.get('[data-apercu-photo]').attributes('src')).toBe('blob:galerie')
    await ecran.get('[data-champ-label]').setValue('CHAMBRE')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux monter')
    await ecran.get('[data-enregistrer-case]').trigger('click')
    expect(ecran.emitted('enregistrer')![0]![1]).toEqual({ statut: 'nouveau', blob: galerie })
  })
})

describe('l éditeur montre ce que l enfant voit (A9)', () => {
  it('affiche le pictogramme livré d un mot qui n a pas de photo de famille', () => {
    // l'éditeur annonçait « Pas de photo » sur un mot que l'enfant voit pourtant illustré
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    expect(ecran.get('[data-image-actuelle] [data-vignette]').attributes('src')).toBe(
      '/images/pictos/chambre.svg',
    )
  })

  it('dit ce que verra l enfant quand le mot n a aucune image', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: { ...CHAMBRE, image_id: undefined } } })

    expect(ecran.find('[data-image-actuelle]').exists()).toBe(false)
    expect((ecran.get('[data-image="aucune"]').element as HTMLInputElement).checked).toBe(true)
  })
})

describe('poser un fichier son fait ailleurs (A8)', () => {
  const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0])

  function fichierSon(octets: Uint8Array, nom = 'voix.mp3'): File {
    return new File([octets as Uint8Array<ArrayBuffer>], nom, { type: 'audio/mpeg' })
  }

  afterEach(() => vi.restoreAllMocks())

  it('accepte un son et le propose à l écoute avant d enregistrer', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voix')
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await choisirFichier(ecran, '[data-champ-son-fichier]', fichierSon(MP3))

    expect(ecran.get('[data-lecture-son]').attributes('src')).toBe('blob:voix')
    await ecran.get('[data-enregistrer-case]').trigger('click')
    expect(ecran.emitted('enregistrer')![0]![2]).toEqual({ statut: 'nouveau', blob: expect.any(Blob) })
  })

  it('refuse un fichier qui n est pas un son, quel que soit son nom', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await choisirFichier(ecran, '[data-champ-son-fichier]', fichierSon(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'piege.mp3'))

    expect(ecran.get('[data-erreur-son]').text()).toContain("n'est pas un son")
    expect(ecran.find('[data-lecture-son]').exists()).toBe(false)
  })

  it('refuse un fichier trop lourd pour un mot, en disant son poids', async () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    await choisirFichier(ecran, '[data-champ-son-fichier]', fichierSon(new Uint8Array(3 * 1024 * 1024)))

    expect(ecran.get('[data-erreur-son]').text()).toContain('3,0 Mo')
    expect(ecran.find('[data-lecture-son]').exists()).toBe(false)
  })
})

describe('écouter ce que la tablette dira (lecteur du son actuel)', () => {
  it('fait entendre le MP3 livré d un mot qu on n a pas encore touché', () => {
    const ecran = mount(EditeurCase, { props: { caseExistante: CHAMBRE } })

    expect(ecran.get('[data-lecture-son-actuel]').attributes('src')).toBe('/sons/chambre.mp3')
  })

  it('ne propose rien à écouter pour un mot qui n a aucune voix', () => {
    const ecran = mount(EditeurCase, {
      props: { caseExistante: { ...CHAMBRE, sound_id: undefined } },
    })

    expect(ecran.find('[data-lecture-son-actuel]').exists()).toBe(false)
    expect(ecran.find('[data-voix-tablette]').exists()).toBe(true)
  })
})
