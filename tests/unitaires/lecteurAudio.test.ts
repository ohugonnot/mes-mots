import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LecteurAudio } from '../../src/domaine/lecteurAudio'
import { AudioFactice } from './audioFactice'

describe('lecteur audio', () => {
  beforeEach(() => {
    AudioFactice.reinitialiser()
    vi.stubGlobal('Audio', AudioFactice)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('joue le son demandé', () => {
    new LecteurAudio().jouer('/sons/oui.mp3')
    expect(AudioFactice.creees.map((a) => a.src)).toEqual(['/sons/oui.mp3'])
  })

  it('coupe la phrase en cours quand une nouvelle commence', () => {
    // exigence EF-03. C'est le cœur du confort d'usage : l'enfant qui change d'avis
    // entend son nouveau mot tout de suite, il n'attend pas la fin du précédent.
    const lecteur = new LecteurAudio()
    lecteur.jouer('/sons/oui.mp3')
    lecteur.jouer('/sons/non.mp3')

    const [premier, second] = AudioFactice.creees as [AudioFactice, AudioFactice]
    expect(premier.paused).toBe(true)
    expect(second.paused).toBe(false)
  })

  it('rembobine la phrase coupée, sinon elle reprendrait en son milieu', () => {
    const lecteur = new LecteurAudio()
    lecteur.jouer('/sons/oui.mp3')
    AudioFactice.creees[0]!.currentTime = 1.4
    lecteur.jouer('/sons/non.mp3')

    expect(AudioFactice.creees[0]!.currentTime).toBe(0)
  })

  it('laisse une trace en console quand le son est illisible', async () => {
    AudioFactice.refuseDeJouer = true
    const trace = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    new LecteurAudio().jouer('/sons/absent.mp3')

    await vi.waitFor(() => expect(trace).toHaveBeenCalled())
    expect(String(trace.mock.calls[0]![0])).toContain('/sons/absent.mp3')
  })
})

describe('lecteur audio, son personnalisé de la famille (P8)', () => {
  beforeEach(() => {
    AudioFactice.reinitialiser()
    vi.stubGlobal('Audio', AudioFactice)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('joue un blob par une URL d objet', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:son-famille')

    new LecteurAudio().jouerBlob(new Blob(['un son']))

    expect(AudioFactice.creees.map((a) => a.src)).toEqual(['blob:son-famille'])
  })

  it("libère l'URL d'objet quand une nouvelle lecture coupe la précédente", () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b')
    const espionRevoke = vi.spyOn(URL, 'revokeObjectURL')

    const lecteur = new LecteurAudio()
    lecteur.jouerBlob(new Blob(['a']))
    lecteur.jouerBlob(new Blob(['b']))

    expect(espionRevoke).toHaveBeenCalledWith('blob:a')
  })

  it("libère l'URL d'objet quand un son livré coupe un son personnalisé", () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:a')
    const espionRevoke = vi.spyOn(URL, 'revokeObjectURL')

    const lecteur = new LecteurAudio()
    lecteur.jouerBlob(new Blob(['a']))
    lecteur.jouer('/sons/oui.mp3')

    expect(espionRevoke).toHaveBeenCalledWith('blob:a')
  })
})

describe('le volume choisi par le parent (P9)', () => {
  beforeEach(() => {
    AudioFactice.reinitialiser()
    vi.stubGlobal('Audio', AudioFactice)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('s applique au son suivant, sans bouton appliquer', () => {
    const lecteur = new LecteurAudio()

    lecteur.reglerVolume(0.4)
    lecteur.jouer('/sons/maman.mp3')

    expect(AudioFactice.creees.at(-1)!.volume).toBe(0.4)
  })

  it('s applique aussi à la voix enregistrée par la famille', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voix')
    const lecteur = new LecteurAudio()

    lecteur.reglerVolume(0.4)
    lecteur.jouerBlob(new Blob(['voix']))

    expect(AudioFactice.creees.at(-1)!.volume).toBe(0.4)
  })

  it('rattrape le son déjà en cours, pour que le parent entende son réglage tout de suite', () => {
    const lecteur = new LecteurAudio()
    lecteur.jouer('/sons/maman.mp3')

    lecteur.reglerVolume(0.4)

    expect(AudioFactice.creees.at(-1)!.volume).toBe(0.4)
  })

  it('refuse une valeur hors bornes plutôt que de rendre la tablette muette', () => {
    const lecteur = new LecteurAudio()

    lecteur.reglerVolume(-3)
    lecteur.jouer('/sons/maman.mp3')

    expect(AudioFactice.creees.at(-1)!.volume).toBe(0)
  })
})

/** La phrase telle que le lecteur la manipule : les rappels du DOM réclament un évènement
 *  que personne ne lit ici, et le test n'a pas à en fabriquer un. */
type PhraseFactice = {
  text: string
  lang: string
  volume: number
  onend: (() => void) | null
  onerror: (() => void) | null
}

/** Synthèse fabriquée : retient ce qu'on lui demande de dire et les coupures. */
function syntheseFactice() {
  const dites: PhraseFactice[] = []
  const coupures: string[] = []
  return {
    dites,
    coupures,
    speak: (phrase: SpeechSynthesisUtterance) => dites.push(phrase as unknown as PhraseFactice),
    cancel: () => coupures.push('coupée'),
  }
}

describe('la voix de la tablette, faute de son enregistré', () => {
  let synthese: ReturnType<typeof syntheseFactice>

  beforeEach(() => {
    AudioFactice.reinitialiser()
    vi.stubGlobal('Audio', AudioFactice)
    synthese = syntheseFactice()
    vi.stubGlobal('speechSynthesis', synthese)
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      lang = ''
      volume = 1
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(public text: string) {}
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lit le texte en français, au volume réglé', () => {
    const lecteur = new LecteurAudio()
    lecteur.reglerVolume(0.4)

    lecteur.lireTexte("C'est moi l'enfant")

    expect(synthese.dites).toHaveLength(1)
    expect(synthese.dites[0]!.text).toBe("C'est moi l'enfant")
    expect(synthese.dites[0]!.lang).toBe('fr-FR')
    expect(synthese.dites[0]!.volume).toBe(0.4)
  })

  it('un mot enregistré coupe le texte en cours de lecture', () => {
    const lecteur = new LecteurAudio()
    lecteur.lireTexte('La promenade')

    lecteur.jouer('/sons/oui.mp3')

    expect(synthese.coupures).toHaveLength(1)
  })

  it('la coupure ne fait pas croire que le mot est fini', () => {
    // `cancel` émet `end` : sans couper le rappel, le halo de la case qu'on vient de
    // toucher s'éteindrait à la place de celui qu'on interrompt
    const lecteur = new LecteurAudio()
    const fins: string[] = []
    lecteur.lireTexte('La promenade', () => fins.push('promenade'))

    lecteur.lireTexte('La voiture', () => fins.push('voiture'))
    synthese.dites[0]!.onend?.()

    expect(fins).toEqual([])
  })

  it('une voix française absente compte comme une fin, sinon la case reste allumée', () => {
    const lecteur = new LecteurAudio()
    const fins: string[] = []
    lecteur.lireTexte('La promenade', () => fins.push('fin'))

    synthese.dites[0]!.onerror?.()

    expect(fins).toEqual(['fin'])
  })

  it('sur un appareil sans synthèse, rend la main au lieu de laisser la case vivante', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    const fins: string[] = []

    new LecteurAudio().lireTexte('La promenade', () => fins.push('fin'))

    expect(fins).toEqual(['fin'])
  })
})
