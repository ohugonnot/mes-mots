/**
 * Faux élément audio. happy-dom ne lit aucun son, et un vrai MP3 rendrait les tests
 * lents et intermittents. Sert de sonde : ce qui a été créé, coupé, refusé.
 */
export class AudioFactice {
  static creees: AudioFactice[] = []
  static refuseDeJouer = false

  paused = false
  currentTime = 0
  volume = 1

  constructor(readonly src: string) {
    AudioFactice.creees.push(this)
  }

  play(): Promise<void> {
    return AudioFactice.refuseDeJouer
      ? Promise.reject(new Error('son introuvable'))
      : Promise.resolve()
  }

  pause(): void {
    this.paused = true
  }

  static reinitialiser(): void {
    AudioFactice.creees = []
    AudioFactice.refuseDeJouer = false
  }
}
