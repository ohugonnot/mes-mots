/**
 * Protection contre les appuis involontaires (exigence EF-05).
 * Fonction pure pour rester testable sans horloge réelle ni DOM.
 */

export interface ReglagesAppui {
  /** Durée pendant laquelle le doigt doit rester posé. 0 = activation immédiate. */
  dureeAppuiMinimaleMs: number
  /** Temps mort après une activation, pendant lequel rien ne se déclenche. */
  delaiEntreActivationsMs: number
}

export const REGLAGES_APPUI_PAR_DEFAUT: ReglagesAppui = {
  dureeAppuiMinimaleMs: 0,
  delaiEntreActivationsMs: 300,
}

export interface Appui {
  debutMs: number
  finMs: number
}

export interface VerdictAppui {
  active: boolean
}

export function evaluerAppui(
  reglages: ReglagesAppui,
  appui: Appui,
  derniereActivationMs: number | null,
): VerdictAppui {
  const duree = appui.finMs - appui.debutMs
  if (duree < reglages.dureeAppuiMinimaleMs) {
    return { active: false }
  }
  if (
    derniereActivationMs !== null &&
    appui.finMs - derniereActivationMs < reglages.delaiEntreActivationsMs
  ) {
    return { active: false }
  }
  return { active: true }
}
