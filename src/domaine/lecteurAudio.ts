/**
 * Vrai si l'appareil sait lire un texte à voix haute. Faux sur une tablette sans moteur de
 * synthèse : l'éditeur le dit au parent plutôt que d'offrir un bouton sans effet.
 */
export function syntheseDisponible(): boolean {
  return typeof speechSynthesis !== 'undefined'
}

/**
 * Lecture d'une phrase. Un nouvel appui coupe la phrase en cours (exigence EF-03) :
 * les phrases ne s'accumulent jamais en file d'attente.
 */
export class LecteurAudio {
  private enCours: HTMLAudioElement | null = null
  private urlObjetEnCours: string | null = null
  /** P9. Appliqué au son suivant : le parent règle et réappuie pour juger, sans bouton. */
  private volume = 1
  /** Chrome ramasse une phrase de synthèse dont plus personne ne tient la référence, et son
   *  `onend` ne part alors jamais : la case resterait vivante après le mot. */
  private phraseEnCours: SpeechSynthesisUtterance | null = null

  reglerVolume(valeur: number): void {
    this.volume = Math.min(1, Math.max(0, valeur))
    if (this.enCours) this.enCours.volume = this.volume
  }

  /** `surFin` sert au retour visuel : la case reste vivante tant que le mot est dit. */
  jouer(source: string, surFin?: () => void): void {
    this.arreter()
    const audio = new Audio(source)
    audio.volume = this.volume
    if (surFin) audio.onended = surFin
    this.enCours = audio
    // une erreur de lecture ne doit jamais bloquer l'interface de l'enfant, mais un son
    // absent doit rester diagnosticable : sans cette trace la case est muette sans raison
    void audio.play().catch((cause) => console.error(`son illisible : ${source}`, cause))
  }

  /** Un son enregistré par la famille (P8) n'a pas d'URL propre : celle-ci ne sert qu'à cette lecture. */
  jouerBlob(son: Blob, surFin?: () => void): void {
    this.arreter()
    const url = URL.createObjectURL(son)
    this.urlObjetEnCours = url
    const audio = new Audio(url)
    audio.volume = this.volume
    if (surFin) audio.onended = surFin
    this.enCours = audio
    void audio.play().catch((cause) => {
      console.error('son personnalisé illisible', cause)
      // sinon l'URL vivrait jusqu'au prochain son, sur un appareil qui tourne toute la journée
      this.arreter()
    })
  }

  /**
   * Faute de son enregistré, la tablette lit le texte avec sa propre voix. Aucun fichier
   * n'en sort : c'est le texte qui voyage dans la sauvegarde, et l'autre appareil le relira
   * avec la sienne.
   */
  lireTexte(texte: string, surFin?: () => void): void {
    this.arreter()
    if (!syntheseDisponible()) {
      // sans cette sortie la case resterait allumée sur un appareil qui ne parle pas
      surFin?.()
      return
    }
    const phrase = new SpeechSynthesisUtterance(texte)
    phrase.lang = 'fr-FR'
    phrase.volume = this.volume
    const finir = () => {
      this.phraseEnCours = null
      surFin?.()
    }
    phrase.onend = finir
    // une voix française absente échoue au lieu de parler : sans ça la case ne s'éteint pas
    phrase.onerror = finir
    this.phraseEnCours = phrase
    speechSynthesis.speak(phrase)
  }

  /** Coupe ce qui parle. L'éditeur s'en sert en se fermant : la synthèse continuerait
   *  sinon de lire un texte dont le panneau a disparu. */
  couper(): void {
    this.arreter()
  }

  private arreter(): void {
    // libérée ici, seul point de sortie d'un son en cours : par une coupure ou par le suivant
    if (this.urlObjetEnCours) {
      URL.revokeObjectURL(this.urlObjetEnCours)
      this.urlObjetEnCours = null
    }
    if (this.phraseEnCours) {
      // `cancel` émet `end` : sans couper les rappels d'abord, la case qui vient d'être
      // touchée éteindrait son halo au lieu de celle qu'on interrompt
      this.phraseEnCours.onend = null
      this.phraseEnCours.onerror = null
      this.phraseEnCours = null
      speechSynthesis.cancel()
    }
    if (!this.enCours) return
    // le signal de fin ne doit pas partir pour un son coupé par le suivant : la case
    // éteindrait alors le retour visuel du mot en train d'être dit
    this.enCours.onended = null
    this.enCours.pause()
    this.enCours.currentTime = 0
    this.enCours = null
  }
}
