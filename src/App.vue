<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import GrilleCommunication from './composants/GrilleCommunication.vue'
import SilhouetteCommunication from './composants/SilhouetteCommunication.vue'
import VignetteCase from './composants/VignetteCase.vue'
import VerrouParents from './composants/VerrouParents.vue'
import EspaceParents from './composants/EspaceParents.vue'
import RappelSauvegarde from './composants/RappelSauvegarde.vue'
import BoutonContexte from './composants/BoutonContexte.vue'
import PlanchesAImprimer from './composants/PlanchesAImprimer.vue'
import ControlePagination from './composants/ControlePagination.vue'
import { CONFIGURATION_DEMO } from './domaine/plancheDemo'
import { livrerLesNouveautes } from './domaine/livraison'
import type { EntreeJournal } from './domaine/journal'
import {
  ajouterCase,
  ajouterCaseSurNouvellePage,
  appliquerMediaChoisi,
  basculerVisibilite,
  deplacerCase,
  echangerCases,
  caseParIdentifiant,
  contextePorteBouton,
  identifiantPersonnalise,
  identifiantsPersonnalises,
  changerFormeDeGrille,
  marquerModifiee,
  modifierCase,
  pagesAtteignables,
  restaurerCase,
  supprimerCase,
  fusionnerContextes,
  ajouterContexte,
  renommerContexte,
  changerImageDeContexte,
  imagePersonnaliseeDeContexte,
  supprimerContexte,
  restaurerContexte,
  voixDeCase,
  toutesLesPlanches,
  silhouetteEnGrille,
  type CaseCommunication,
  type Contexte,
  type ChampsModifiables,
  type Configuration,
  type FormeDeGrille,
  type Reglages,
  type MediaChoisi,
  type Planche,
} from './domaine/planche'
import { utiliserGlissementPage, DUREE_GLISSADE_MS } from './composables/glissementPage'
import {
  chargerConfiguration,
  demanderStockagePersistant,
  estInstallee,
  effacerImage,
  effacerSon,
  enregistrerConfiguration,
  purgerRessourcesOrphelines,
  effacerToutLeDepot,
  enregistrerImage,
  enregistrerSon,
  lireSon,
  ajouterAuJournal,
  lireLeJournalDuJour,
  purgerLeJournal,
  ConfigurationDepassee,
} from './domaine/depot'
import { restaurerRessourcesPersonnalisees } from './domaine/sauvegarde'
import { identifiantPersonnaliseDuChemin, replierSurLesMediasLivres } from './domaine/archive'
import { LecteurAudio } from './domaine/lecteurAudio'
import { evaluerAppui } from './domaine/protectionAppui'
import {
  ajouterALaPhrase,
  motDeLaPhrase,
  retirerLeDernierMot,
  type PhraseEnCours,
} from './domaine/phrase'
import { fermeteDe, volumeDe } from './domaine/reglages'

/** Vide jusqu'au chargement du dépôt : la configuration vient de la tablette. */
const configuration = ref<Configuration | null>(null)
const idContexteChoisi = ref<string | null>(null)
const idPageChoisie = ref<string | null>(null)
/** Dernière phrase prononcée, affichée dans la bande du haut (T3). */
const dernierePhrase = ref('')
/** La case dont on vient de dire le mot : la bande du haut montre son image à côté du
 *  texte, pour que l'enfant relie ce qu'il entend, ce qu'il voit écrit et ce qu'il a touché. */
const derniereCase = ref<CaseCommunication | null>(null)
/**
 * La phrase que l'enfant compose, quand le parent a allumé l'enchaînement. Elle garde les
 * cases touchées : la relire rejoue leur voix, celle de la famille comprise.
 */
const phrase = ref<PhraseEnCours>([])
const enchainement = computed(() => configuration.value?.reglages.enchainement === true)
/** Absent d'une archive plus ancienne que le réglage : on montre les cases, comme à la
 *  livraison. Le parent rallume les corps s'il les veut. */
const corpsAToucher = computed(() => configuration.value?.reglages.corpsAToucher === true)
/** Vrai pendant que la bande se relit. Un second appui coupe, il ne relance jamais. */
const litLaPhrase = ref(false)
const mode = ref<'enfant' | 'parents'>('enfant')

/**
 * Le nouveau service worker prend la main tout seul, mais la page affichée reste l'ancienne
 * jusqu'à un rechargement : il fallait donc charger deux fois pour voir une correction, et
 * l'écoute ne vivait que dans l'espace parents, absent de l'écran de l'enfant. Ici elle
 * commence au démarrage. `controller` n'existe pas à la toute première installation, qui
 * passerait sinon pour une mise à jour.
 */
const nouvelleVersionPrete = ref(false)
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    nouvelleVersionPrete.value = true
  })
}

/** B4 : s'affiche à la sortie de l'espace parents si des modifications restent sans sauvegarde. */
const rappelSauvegardeVisible = ref(false)
/** null tant que le système n'a pas répondu (D11) : rien à dire de faux à la famille. */
const stockagePersistant = ref<boolean | null>(null)

/**
 * Ce que l'enfant a demandé aujourd'hui, avec l'heure. Demandé par la mère, à sa condition :
 * effacé à minuit, sans statistique ni comptage. Relu à l'ouverture de l'espace parents,
 * jamais tenu à jour en continu : personne ne le regarde pendant que l'enfant parle.
 */
const journalDuJour = ref<EntreeJournal[]>([])
const rafraichirLeJournal = async () => {
  journalDuJour.value = await lireLeJournalDuJour()
}
const installee = ref(estInstallee())

/** Après ce temps sans un seul appui, l'enfant est ramené à son écran de départ (T6). */
const DELAI_RETOUR_MS = 30_000

const lecteur = new LecteurAudio()
/**
 * Temps mort propre à chaque case. Un temps mort commun rendrait muet l'enfant qui
 * enchaîne deux mots vite, alors que sa dextérité le lui permet largement.
 */
const derniereActivationParCase = new Map<string, number>()

let verrouEcran: WakeLockSentinel | null = null

/** Un contexte dont aucune page n'est atteignable n'a pas de bouton : L'enfant n'y trouverait rien. */
const contextes = computed(
  () => configuration.value?.contextes.filter(contextePorteBouton) ?? [],
)
const contexte = computed(
  () =>
    contextes.value.find((candidat) => candidat.id === idContexteChoisi.value) ??
    contextes.value[0] ??
    null,
)
/** Les pages qu'un contexte offre vraiment : une page dont rien n'est révélé est une impasse. */
const pages = computed(() => (contexte.value ? pagesAtteignables(contexte.value) : []))
const indexPage = computed(() => {
  const index = pages.value.findIndex((page) => page.id === idPageChoisie.value)
  return index === -1 ? 0 : index
})
const page = computed<Planche | null>(() => pages.value[indexPage.value] ?? null)

/**
 * La même planche, repliée quand la douleur se montre en cases : sa matrice de rangement est
 * de deux sur cinq, ce qui donnerait des cases hautes et étroites. Les appuis restent
 * adressés à `page`, la planche du dépôt : le repli ne change que la disposition, jamais les
 * mots ni leurs voix.
 */
const pageAMontrer = computed<Planche | null>(() =>
  page.value?.ext_mesmots_silhouette && !corpsAToucher.value
    ? silhouetteEnGrille(page.value)
    : page.value,
)

const conteneurGrille = ref<HTMLElement | null>(null)

let minuterieRetour: number | null = null

/**
 * Ramène l'enfant au contexte de départ et à sa première page atteignable. Les deux choix
 * remis à `null`, les valeurs par défaut reprennent : aucune case ne bouge, et s'il est
 * déjà chez lui il ne se passe rien.
 */
function retourAuDepart() {
  if (mode.value === 'parents') return
  idContexteChoisi.value = null
  idPageChoisie.value = null
  // la bande s'efface avec le reste : sans ça, l'enfant retrouvait le lendemain matin le
  // dernier mot de la veille, comme s'il venait de le dire
  dernierePhrase.value = ''
  derniereCase.value = null
  // la phrase en cours, elle, reste : trente secondes d'hésitation, c'est peu pour un
  // enfant qui cherche son deuxième mot, et aucune application du domaine ne fait
  // disparaître un message sur un délai. Il l'efface lui-même, avec la croix.
}

function oublierLeRetour() {
  if (minuterieRetour !== null) window.clearTimeout(minuterieRetour)
  minuterieRetour = null
}

/**
 * Le compteur repart à chaque geste de l'enfant. Il n'est pas réarmé après le retour
 * lui-même : il n'y a plus rien à ramener tant que personne ne touche l'écran.
 */
function rearmerRetour() {
  oublierLeRetour()
  if (mode.value === 'parents') return
  if (!configuration.value?.reglages.retourAutomatique) return
  minuterieRetour = window.setTimeout(retourAuDepart, DELAI_RETOUR_MS)
}

function choisirContexte(id: string) {
  idContexteChoisi.value = id
  // la page de départ du nouveau contexte, jamais l'index de l'ancien
  idPageChoisie.value = null
  rearmerRetour()
}

/** Change de page si la voisine existe. Pas de bouclage : L'enfant doit sentir le bord. */
function changerDePageEnfant(pas: 1 | -1): boolean {
  const voisine = pages.value[indexPage.value + pas]
  rearmerRetour()
  if (!voisine) return false
  idPageChoisie.value = voisine.id
  return true
}

const {
  glissade,
  appuiRenonce,
  allerVersLaPage,
  surPoseDuDoigt,
  surDeplacementDuDoigt,
  surRelacheDuDoigt,
  terminerLeGeste,
  oublierGlissade,
} = utiliserGlissementPage(conteneurGrille, changerDePageEnfant)

function surAppui(source: Planche, id: string, debutMs: number, finMs: number) {
  rearmerRetour()
  // le doigt a glissé : c'était un changement de page, pas une demande
  if (appuiRenonce.value) return
  const verdict = evaluerAppui(
    fermeteDe(configuration.value?.reglages.fermeteAppui ?? 'normal'),
    { debutMs, finMs },
    derniereActivationParCase.get(id) ?? null,
  )
  if (!verdict.active) return

  const contenu = caseParIdentifiant(source, id)
  if (!contenu) return

  derniereActivationParCase.set(id, finMs)
  dernierePhrase.value = contenu.vocalization
  derniereCase.value = contenu
  // Toutes les cases se posent, la planche « J'ai mal » comprise. L'exception qu'on avait
  // prévue pour elle vidait la bande de son écho : L'enfant touchait son ventre et plus
  // rien ne s'écrivait en haut, alors que c'est là que le parent relit ce qu'il a dit.
  if (enchainement.value) phrase.value = ajouterALaPhrase(phrase.value, contenu)
  // un mot demandé pendant la relecture l'interrompt : c'est lui qu'on vient de toucher
  litLaPhrase.value = false
  void jouerSon(contenu)
  // jamais attendu : le journal ne doit pas retarder d'une milliseconde le mot que
  // l'enfant vient de demander
  void ajouterAuJournal(contenu.label)
}

/** Un son personnalisé (P8) se lit dans le dépôt, pas à une URL : il n'existe pas de fichier. */
/**
 * Case dont le mot est en train d'être dit. Sert au retour visuel : L'enfant voit sa case
 * vivre tant qu'elle parle, ce qui lie le geste au son. La mère le demandait, et la
 * recherche consignée en BIBLE §9 va dans le même sens : l'attrait sensoriel est ce qui
 * fait qu'un enfant s'approprie l'outil au lieu de le subir.
 */
const idCaseQuiParle = ref<string | null>(null)
const caseAnimee = computed(() =>
  configuration.value?.reglages.animations ? idCaseQuiParle.value : null,
)

/**
 * Le rechargement attend que la tablette ne serve à personne : il couperait sinon un mot en
 * train d'être dit, effacerait une phrase en cours de composition, ou emporterait le
 * formulaire à moitié rempli d'un parent. Au repos il passe inaperçu.
 */
const tabletteAuRepos = computed(
  () =>
    mode.value === 'enfant' &&
    idCaseQuiParle.value === null &&
    !litLaPhrase.value &&
    phrase.value.length === 0,
)
watch([nouvelleVersionPrete, tabletteAuRepos], () => {
  if (nouvelleVersionPrete.value && tabletteAuRepos.value) location.reload()
})

/** `apres` sert à la relecture de la phrase : le mot suivant part quand celui-ci finit.
 *  Une coupure ne l'appelle jamais, `LecteurAudio` détache ses rappels, et la chaîne
 *  s'arrête donc d'elle-même. */
async function jouerSon(contenu: CaseCommunication, apres?: () => void) {
  const surFin = () => {
    if (idCaseQuiParle.value === contenu.id) idCaseQuiParle.value = null
    apres?.()
  }
  idCaseQuiParle.value = contenu.id
  const voix = voixDeCase(contenu)
  if (voix.genre === 'synthese') return lecteur.lireTexte(voix.texte, surFin)
  if (voix.genre === 'livre') return lecteur.jouer(`/sons/${voix.idSon}.mp3`, surFin)
  const son = await lireSon(voix.idSon)
  // une voix de la famille dont le blob a disparu laissait le mot muet : la tablette le lit
  if (son) lecteur.jouerBlob(son, surFin)
  else lecteur.lireTexte(contenu.vocalization, surFin)
}

/** Relit toute la phrase, voix par voix. Toucher la bande pendant qu'elle parle coupe. */
function direLaPhrase() {
  rearmerRetour()
  if (litLaPhrase.value) return arreterLaRelecture()
  if (phrase.value.length === 0) return
  litLaPhrase.value = true
  lireDepuis(0)
}

function lireDepuis(rang: number) {
  const contenu = phrase.value[rang]
  if (!contenu) {
    litLaPhrase.value = false
    return
  }
  void jouerSon(contenu, () => lireDepuis(rang + 1))
}

function arreterLaRelecture() {
  litLaPhrase.value = false
  lecteur.couper()
  // `couper` détache ses rappels, donc `surFin` ne part jamais : sans cette ligne la case
  // gardait son halo indéfiniment, et l'enfant lisait « je parle » sur une case muette
  idCaseQuiParle.value = null
}

function retirerLeDernier() {
  rearmerRetour()
  arreterLaRelecture()
  phrase.value = retirerLeDernierMot(phrase.value)
}

function viderLaPhrase() {
  rearmerRetour()
  arreterLaRelecture()
  phrase.value = []
}

async function garderEcranAllume() {
  // exigence EG-04. Absente sur iOS avant 16.4 : on continue sans, ce n'est pas bloquant.
  try {
    verrouEcran = await navigator.wakeLock?.request('screen')
  } catch {
    verrouEcran = null
  }
}

// le système relâche le verrou dès que la page passe en arrière-plan, il faut le reprendre
function reprendreVerrouEcran() {
  if (document.visibilityState === 'visible') void garderEcranAllume()
}

/** Applique le choix de photo puis de son (P4, P8) : composition pure, réutilisée par
 *  l'ajout, l'ajout sur nouvelle page et la modification. */
function avecMediaAppliques(
  configuration: Configuration,
  idPlanche: string,
  idCase: string,
  photo: MediaChoisi,
  son: MediaChoisi,
): Configuration {
  const avecPhoto = appliquerMediaChoisi(configuration, idPlanche, idCase, 'image_id', photo)
  return appliquerMediaChoisi(avecPhoto, idPlanche, idCase, 'sound_id', son)
}

/**
 * Relit l'identifiant que `ajouterCase`/`ajouterCaseSurNouvellePage` a choisi pour le mot :
 * à la création, la case n'existe pas encore au moment où le parent prend sa photo, donc son
 * identifiant n'est connu qu'après coup. On le relit ici dans le résultat plutôt que de
 * reproduire la règle de nommage de `identifiantDepuisMot`, qui pourrait changer sans qu'on
 * pense à mettre ce chemin à jour.
 */
function idCasePosee(
  configuration: Configuration,
  idPlanche: string,
  ligne: number,
  colonne: number,
): string | undefined {
  return toutesLesPlanches(configuration).find((p) => p.id === idPlanche)?.grid.order[ligne]?.[colonne] ?? undefined
}

/** Écrit ou efface le blob correspondant au choix du parent, une fois l'écran déjà à jour :
 *  la persistance du blob ne doit jamais retarder l'affichage. */
async function persisterMediaChoisi(champ: 'image_id' | 'sound_id', idCase: string, choix: MediaChoisi): Promise<void> {
  if (choix.statut === 'nouveau') {
    await (champ === 'image_id' ? enregistrerImage(idCase, choix.blob) : enregistrerSon(idCase, choix.blob))
  } else if (choix.statut === 'aucun') {
    await (champ === 'image_id' ? effacerImage(idCase) : effacerSon(idCase))
  }
}

/** Vrai si une autre case de la configuration réutilise encore cette référence personnalisée :
 *  protège les blobs si un mot supprimé puis recréé a repris le même identifiant (P3 + P4/P8),
 *  cas limite mais réel puisque `supprimerCase` libère l'identifiant pour un nouveau mot. */
function referenceEncoreUtilisee(configuration: Configuration, champ: 'image_id' | 'sound_id', idPerso: string): boolean {
  return toutesLesPlanches(configuration).some((planche) =>
    planche.buttons.some((bouton) => identifiantPersonnalise(bouton[champ]) === idPerso),
  )
}

/** Vide tant que tout passe. Un dépôt qui rejette laissait l'écran affirmer que le
 *  changement était gardé, alors qu'il disparaîtrait au rechargement (D13). */
const erreurEnregistrement = ref('')

/** Toute écriture du dépôt passe par ici, pour que l'échec se voie au lieu de finir en console. */
async function ecrireAuDepot(quoi: string, ecriture: () => Promise<void>): Promise<void> {
  try {
    await ecriture()
    erreurEnregistrement.value = ''
  } catch (cause) {
    console.error(`${quoi} : non enregistré`, cause)
    // Un autre onglet a écrit entre-temps : refaire le geste ne servirait à rien, et
    // insister effacerait son travail. On dit quoi faire, et ce n'est pas la même chose.
    erreurEnregistrement.value =
      cause instanceof ConfigurationDepassee
        ? cause.message
        : "Le dernier changement n'a pas pu être enregistré. Refaites-le. S'il échoue encore, redémarrez la tablette."
  }
}

async function surBasculer(idPlanche: string, idCase: string) {
  if (!configuration.value) return
  // toRaw : configuration.value est un proxy réactif, IndexedDB ne sait pas le cloner et
  // l'échec passait inaperçu, laissant la bascule affichée mais jamais enregistrée
  const suivante = marquerModifiee(basculerVisibilite(toRaw(configuration.value), idPlanche, idCase))
  configuration.value = suivante
  // une bascule perdue au rechargement serait un bug grave : on enregistre tout de suite
  await ecrireAuDepot('bascule', () => enregistrerConfiguration(suivante))
}

/** L'ordre compte : la vignette lit le dépôt dès que la référence `perso/…` paraît dans la
 *  configuration. Écrire le blob après l'affichage laissait la carte des parents vide jusqu'au
 *  rechargement suivant. Un échec d'écriture laisse donc l'écran sur l'état d'avant plutôt que
 *  sur une case qui pointe une photo absente (dette D13 : le dire à l'écran). */
async function appliquerAuDepotPuisAAffichage(
  suivante: Configuration,
  idCase: string | undefined,
  photo: MediaChoisi,
  son: MediaChoisi,
  echec: string,
) {
  await ecrireAuDepot(echec, async () => {
    if (idCase) {
      await persisterMediaChoisi('image_id', idCase, photo)
      await persisterMediaChoisi('sound_id', idCase, son)
    }
    configuration.value = suivante
    await enregistrerConfiguration(suivante)
  })
}

async function surModifier(
  idPlanche: string,
  idCase: string,
  champs: ChampsModifiables,
  photo: MediaChoisi,
  son: MediaChoisi,
) {
  if (!configuration.value) return
  const modifiee = modifierCase(toRaw(configuration.value), idPlanche, idCase, champs)
  const suivante = marquerModifiee(avecMediaAppliques(modifiee, idPlanche, idCase, photo, son))
  await appliquerAuDepotPuisAAffichage(suivante, idCase, photo, son, 'modification non enregistrée')
}

async function surAjouter(
  idPlanche: string,
  ligne: number,
  colonne: number,
  champs: ChampsModifiables,
  photo: MediaChoisi,
  son: MediaChoisi,
) {
  if (!configuration.value) return
  const posee = ajouterCase(toRaw(configuration.value), idPlanche, ligne, colonne, champs)
  const idCase = idCasePosee(posee, idPlanche, ligne, colonne)
  const suivante = marquerModifiee(idCase ? avecMediaAppliques(posee, idPlanche, idCase, photo, son) : posee)
  await appliquerAuDepotPuisAAffichage(suivante, idCase, photo, son, 'ajout non enregistré')
}

async function surAjouterSurNouvellePage(
  idContexte: string,
  ligne: number,
  colonne: number,
  champs: ChampsModifiables,
  photo: MediaChoisi,
  son: MediaChoisi,
) {
  if (!configuration.value) return
  const posee = ajouterCaseSurNouvellePage(toRaw(configuration.value), idContexte, ligne, colonne, champs)
  const nouvellePage = posee.contextes.find((c) => c.id === idContexte)?.pages.at(-1)
  const idCase = nouvellePage ? idCasePosee(posee, nouvellePage.id, ligne, colonne) : undefined
  const suivante = marquerModifiee(
    nouvellePage && idCase ? avecMediaAppliques(posee, nouvellePage.id, idCase, photo, son) : posee,
  )
  await appliquerAuDepotPuisAAffichage(suivante, idCase, photo, son, 'nouvelle page non enregistrée')
}

/** Purge les blobs des cases supprimées et non annulées durant la session parents (P4, P8),
 *  sauf si leur identifiant a entre-temps été repris par une autre case (P3). */
async function surPurgerSuppressions(casesSupprimees: CaseCommunication[]) {
  if (!configuration.value) return
  const actuelle = toRaw(configuration.value)
  await Promise.all(
    casesSupprimees.flatMap((caseCommunication) => {
      const taches: Promise<void>[] = []
      const idImage = identifiantPersonnalise(caseCommunication.image_id)
      if (idImage && !referenceEncoreUtilisee(actuelle, 'image_id', idImage)) taches.push(effacerImage(idImage))
      const idSon = identifiantPersonnalise(caseCommunication.sound_id)
      if (idSon && !referenceEncoreUtilisee(actuelle, 'sound_id', idSon)) taches.push(effacerSon(idSon))
      return taches
    }),
  )
}

/** P6 : le parent a choisi le mot, puis sa nouvelle place, parfois sur une autre page.
 *  Aucune autre case ne bouge. */
async function surDeplacer(
  idPlancheDepart: string,
  idCase: string,
  idPlancheArrivee: string,
  ligne: number,
  colonne: number,
) {
  if (!configuration.value) return
  const suivante = marquerModifiee(
    deplacerCase(toRaw(configuration.value), idPlancheDepart, idCase, idPlancheArrivee, ligne, colonne),
  )
  configuration.value = suivante
  await ecrireAuDepot('déplacement', () => enregistrerConfiguration(suivante))
}

/** P6 : deux mots échangent leur place. La planche de la famille est souvent pleine, sans
 *  emplacement libre où poser quoi que ce soit. */
async function surEchanger(
  idPlancheA: string,
  idPremier: string,
  idPlancheB: string,
  idSecond: string,
) {
  if (!configuration.value) return
  const suivante = marquerModifiee(
    echangerCases(toRaw(configuration.value), idPlancheA, idPremier, idPlancheB, idSecond),
  )
  configuration.value = suivante
  await ecrireAuDepot('échange', () => enregistrerConfiguration(suivante))
}

/** Un contexte nouveau, renommé ou supprimé change la barre du haut de l'enfant : chacune de
 *  ces écritures est aussi grave qu'une bascule, donc elle passe par le même chemin. */
async function surAjouterContexte(nom: string) {
  if (!configuration.value) return
  const suivante = marquerModifiee(ajouterContexte(toRaw(configuration.value), nom))
  configuration.value = suivante
  await ecrireAuDepot('création du contexte', () => enregistrerConfiguration(suivante))
}

async function surRenommerContexte(idContexte: string, nom: string) {
  if (!configuration.value) return
  const suivante = marquerModifiee(renommerContexte(toRaw(configuration.value), idContexte, nom))
  configuration.value = suivante
  await ecrireAuDepot('renommage du contexte', () => enregistrerConfiguration(suivante))
}

/**
 * L'image d'un bouton de contexte. Le blob part d'abord, la référence ensuite : dans
 * l'autre sens, un rechargement tombant entre les deux montrerait un bouton qui pointe
 * une image absente.
 */
async function surImageDeContexte(idContexte: string, image: Blob) {
  if (!configuration.value) return
  const cle = identifiantPersonnalise(imagePersonnaliseeDeContexte(idContexte))!
  await ecrireAuDepot("image du contexte", async () => {
    await enregistrerImage(cle, image)
    const suivante = marquerModifiee(
      changerImageDeContexte(toRaw(configuration.value!), idContexte, imagePersonnaliseeDeContexte(idContexte)),
    )
    configuration.value = suivante
    await enregistrerConfiguration(suivante)
  })
}

async function surSupprimerContexte(idContexte: string) {
  if (!configuration.value) return
  const suivante = marquerModifiee(supprimerContexte(toRaw(configuration.value), idContexte))
  configuration.value = suivante
  await ecrireAuDepot('suppression du contexte', () => enregistrerConfiguration(suivante))
}

async function surRestaurerContexte(contexte: Contexte, rang: number) {
  if (!configuration.value) return
  const suivante = marquerModifiee(restaurerContexte(toRaw(configuration.value), contexte, rang))
  configuration.value = suivante
  await ecrireAuDepot('annulation de la suppression du contexte', () => enregistrerConfiguration(suivante))
}

async function surSupprimer(idPlanche: string, idCase: string) {
  if (!configuration.value) return
  const suivante = marquerModifiee(supprimerCase(toRaw(configuration.value), idPlanche, idCase))
  configuration.value = suivante
  await ecrireAuDepot('suppression', () => enregistrerConfiguration(suivante))
}

async function surRestaurer(
  idPlanche: string,
  ligne: number,
  colonne: number,
  caseARestaurer: CaseCommunication,
) {
  if (!configuration.value) return
  const suivante = marquerModifiee(
    restaurerCase(toRaw(configuration.value), idPlanche, ligne, colonne, caseARestaurer),
  )
  configuration.value = suivante
  await ecrireAuDepot('restauration', () => enregistrerConfiguration(suivante))
}

/** P9 : chaque réglage prend effet tout de suite, sans bouton « appliquer ». Le parent juge
 *  le résultat en réappuyant sur une case, au lieu de l'imaginer. */
async function surReglerReglages(champs: Partial<Reglages>) {
  if (!configuration.value) return
  const brute = toRaw(configuration.value)
  const suivante = marquerModifiee({ ...brute, reglages: { ...brute.reglages, ...champs } })
  configuration.value = suivante
  if (champs.volume !== undefined) lecteur.reglerVolume(volumeDe(champs.volume))
  await ecrireAuDepot('réglage', () => enregistrerConfiguration(suivante))
}

/**
 * Le seul geste de l'application qui déplace des mots. La configuration réécrite est ce qui
 * part au dépôt : réenregistrer `configuration.value` laisserait l'écran de l'enfant à
 * l'ancienne forme, et la mère croirait le changement fait.
 */
async function surChangerForme(forme: FormeDeGrille) {
  if (!configuration.value) return
  const suivante = marquerModifiee(changerFormeDeGrille(toRaw(configuration.value), forme))
  configuration.value = suivante
  await ecrireAuDepot('forme de la grille', () => enregistrerConfiguration(suivante))
}

async function surReglerRetourAutomatique(actif: boolean) {
  if (!configuration.value) return
  const brute = toRaw(configuration.value)
  const suivante = marquerModifiee({
    ...brute,
    reglages: { ...brute.reglages, retourAutomatique: actif },
  })
  configuration.value = suivante
  await ecrireAuDepot('réglage', () => enregistrerConfiguration(suivante))
}

function ouvrirEspaceParents() {
  mode.value = 'parents'
  // un parent qui remplit un formulaire ne doit pas voir l'écran changer sous ses doigts
  oublierLeRetour()
  void rafraichirLeJournal()
}

/** B2 : le téléchargement a déjà eu lieu dans SauvegardeParents, il ne reste qu'à persister le drapeau. */
async function surSauvegarder(configurationSauvegardee: Configuration) {
  configuration.value = configurationSauvegardee
  await ecrireAuDepot('drapeau de sauvegarde', () => enregistrerConfiguration(configurationSauvegardee))
}

/**
 * B3 : la configuration restaurée peut ne plus contenir les contextes ou pages en cours,
 * on revient donc au départ comme au premier chargement. L'écran de l'enfant se recompose
 * avec la configuration importée.
 *
 * Les photos et sons personnalisés de l'archive sont réécrits dans leurs magasins avant
 * l'affichage : sans ça, restaurer sur une tablette neuve rendrait les mots muets et sans
 * visage, exactement ce que la sauvegarde existe pour éviter.
 */
/**
 * Ajouter des planches sans toucher au reste. La graine ne s'applique qu'au premier
 * lancement, et remplacer effacerait le travail de la famille : c'est le seul chemin pour
 * lui livrer une planche toute faite une fois sa tablette en service.
 */
async function surAjouterPlanches(
  configurationApportee: Configuration,
  ressourcesPersonnalisees: Map<string, Uint8Array>,
) {
  if (!configuration.value) return
  const fusion = fusionnerContextes(toRaw(configuration.value), configurationApportee)
  if (fusion.ajoutes.length === 0) return

  // seuls les médias des contextes réellement ajoutés : écrire les autres remplirait le
  // dépôt de blobs que plus aucun mot ne réclame. L'image du bouton compte comme les
  // autres, sinon le contexte arrive et l'enfant ne reconnaît pas son monde.
  const idsAjoutes = new Set(
    fusion.ajoutes.flatMap((contexte) => [
      identifiantPersonnalise(contexte.ext_mesmots_image),
      ...contexte.pages.flatMap((page) =>
        page.buttons.flatMap((contenu) => [
          identifiantPersonnalise(contenu.image_id),
          identifiantPersonnalise(contenu.sound_id),
        ]),
      ),
    ]).filter((id): id is string => !!id),
  )
  const aEcrire = new Map(
    [...ressourcesPersonnalisees].filter(([chemin]) => {
      const id = identifiantPersonnaliseDuChemin(chemin)
      return !!id && idsAjoutes.has(id)
    }),
  )

  const suivante = marquerModifiee(fusion.configuration)
  await ecrireAuDepot('ajout de planches', async () => {
    await restaurerRessourcesPersonnalisees(aEcrire)
    configuration.value = suivante
    await enregistrerConfiguration(suivante)
  })
}

async function surRestaurerSauvegarde(
  configurationRestauree: Configuration,
  ressourcesPersonnalisees: Map<string, Uint8Array>,
) {
  // Une écriture de photo ou de voix qui échoue remonte désormais jusqu'ici : la
  // restauration s'arrête alors avant d'afficher une configuration à moitié servie, et le
  // parent le lit à l'écran au lieu de découvrir des mots muets plus tard.
  // Ce que le fichier n'apporte pas retombe sur le média livré : la purge qui suit efface
  // les blobs correspondants, et une référence conservée pointerait alors dans le vide.
  const restauree = replierSurLesMediasLivres(configurationRestauree, ressourcesPersonnalisees)
  await ecrireAuDepot('restauration de la sauvegarde', async () => {
    await restaurerRessourcesPersonnalisees(ressourcesPersonnalisees)
    // On garde ce que l'archive a réellement apporté, pas ce que la configuration référence :
    // un blob local référencé mais absent du fichier aurait fait illusion, la photo d'un autre
    // mot ou d'une autre époque à la place d'un repli honnête. Et ce qui n'est plus référencé
    // par personne partirait sinon pour toujours, restauration après restauration.
    const apportes = [...ressourcesPersonnalisees.keys()]
    const idsApportes = (prefixe: string) =>
      apportes.filter((c) => c.startsWith(prefixe)).map(identifiantPersonnaliseDuChemin).filter((id): id is string => !!id)
    await purgerRessourcesOrphelines(idsApportes('images/'), idsApportes('sons/'))
    configuration.value = restauree
    idContexteChoisi.value = null
    idPageChoisie.value = null
    mode.value = 'enfant'
    await enregistrerConfiguration(restauree)
  })
}

/** B4 : non contournable silencieusement, mais jamais bloquant, un parent doit pouvoir sortir quand même. */
function surFermerEspaceParents() {
  if (configuration.value?.reglages.modifieDepuisSauvegarde) {
    rappelSauvegardeVisible.value = true
  } else {
    mode.value = 'enfant'
  }
}

function surRappelPlusTard() {
  rappelSauvegardeVisible.value = false
  mode.value = 'enfant'
}

async function surRappelSauvegarder(configurationSauvegardee: Configuration) {
  configuration.value = configurationSauvegardee
  rappelSauvegardeVisible.value = false
  mode.value = 'enfant'
  await ecrireAuDepot('drapeau de sauvegarde', () => enregistrerConfiguration(configurationSauvegardee))
}

/** P10 : le parent a confirmé deux fois. La tablette repart de la graine, comme au premier
 *  jour, y compris pour les photos et les voix. */
async function surToutEffacer() {
  await ecrireAuDepot('effacement complet', async () => {
    await effacerToutLeDepot()
    configuration.value = await chargerConfiguration(CONFIGURATION_DEMO)
    idContexteChoisi.value = null
    idPageChoisie.value = null
    // on reste dans l'espace parents : le geste suivant est presque toujours « restaurer ma
    // sauvegarde », et refermer obligeait à refaire l'appui long puis l'addition, au moment
    // le plus angoissant du parcours
    journalDuJour.value = []
  })
}

/**
 * Ce que la mise à jour vient d'apporter, à dire au parent une fois. La graine ne s'applique
 * qu'au premier lancement : sans cette livraison, une planche ajoutée au code n'atteindrait
 * jamais une tablette en service, et la restaurer par un fichier effacerait son travail.
 */
const nouveautes = ref<string[]>([])

onMounted(async () => {
  const chargee = await chargerConfiguration(CONFIGURATION_DEMO)
  const livraison = livrerLesNouveautes(chargee, CONFIGURATION_DEMO)
  nouveautes.value = livraison.ajoutes
  configuration.value = livraison.configuration
  // la mémoire des livraisons ne vaut que si elle survit au rechargement, sinon tout
  // recommencerait à chaque lancement
  if (livraison.configuration !== chargee) {
    await ecrireAuDepot('mise à jour du vocabulaire livré', () =>
      enregistrerConfiguration(livraison.configuration),
    )
  }
  // Balayage des blobs qu'aucun mot ne réclame plus. Une suppression dont l'effacement a
  // échoué, ou un onglet fermé avant la fin d'une session parents, en laissait pour
  // toujours : ici il n'y a aucune annulation en attente, tout orphelin est un vrai déchet.
  lecteur.reglerVolume(volumeDe(configuration.value.reglages.volume))
  const perso = identifiantsPersonnalises(configuration.value)
  void purgerRessourcesOrphelines(perso.images, perso.sons)
  // « effacée à minuit » est la condition que la mère a posée en demandant ce journal. Une
  // tablette éteinte à minuit ne peut pas s'y réveiller : la purge se fait au démarrage.
  void purgerLeJournal().then(() => rafraichirLeJournal())
  // ne jamais attendre cette promesse ici : la grille de l'enfant ne doit rien perdre de sa réactivité
  demanderStockagePersistant().then((accorde) => {
    stockagePersistant.value = accorde
  })
  void garderEcranAllume()
  document.addEventListener('visibilitychange', reprendreVerrouEcran)
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', reprendreVerrouEcran)
  void verrouEcran?.release()
  oublierLeRetour()
  oublierGlissade()
})
</script>

<template>
  <template v-if="mode === 'parents' && configuration">
    <EspaceParents
      :configuration="configuration"
      :stockage-persistant="stockagePersistant"
      :installee="installee"
      :nouvelle-version-prete="nouvelleVersionPrete"
      :nouveautes="nouveautes"
      :journal="journalDuJour"
      :erreur-enregistrement="erreurEnregistrement"
      @regler-retour-automatique="surReglerRetourAutomatique"
      @basculer="surBasculer"
      @modifier="surModifier"
      @ajouter="surAjouter"
      @ajouter-sur-nouvelle-page="surAjouterSurNouvellePage"
      @supprimer="surSupprimer"
      @restaurer="surRestaurer"
      @sauvegarder="surSauvegarder"
      @restaurer-sauvegarde="surRestaurerSauvegarde"
      @ajouter-planches="surAjouterPlanches"
      @purger-suppressions="surPurgerSuppressions"
      @ajouter-contexte="surAjouterContexte"
      @renommer-contexte="surRenommerContexte"
      @image-de-contexte="surImageDeContexte"
      @supprimer-contexte="surSupprimerContexte"
      @restaurer-contexte="surRestaurerContexte"
      @deplacer="surDeplacer"
      @echanger="surEchanger"
      @regler-volume="(pourcentage: number) => surReglerReglages({ volume: pourcentage })"
      @regler-fermete="(cle: string) => surReglerReglages({ fermeteAppui: cle })"
      @regler-animations="(actif: boolean) => surReglerReglages({ animations: actif })"
      @regler-enchainement="(actif: boolean) => surReglerReglages({ enchainement: actif })"
      @regler-corps-a-toucher="(actif: boolean) => surReglerReglages({ corpsAToucher: actif })"
      @changer-forme="surChangerForme"
      @tout-effacer="surToutEffacer"
      @fermer="surFermerEspaceParents"
    />
    <RappelSauvegarde
      v-if="rappelSauvegardeVisible"
      :configuration="configuration"
      @sauvegarder="surRappelSauvegarder"
      @plus-tard="surRappelPlusTard"
    />
  </template>

  <template v-else>
    <!--
      Les quatre bandes de la disposition arrêtée dans BIBLE.md §5, à hauteurs fixes.
      Réserver la place de la phrase et des mots essentiels dès maintenant est l'idée
      centrale du projet : le jour où la famille les active, pas un pixel de la grille ne
      bouge, et l'enfant ne perd pas la mémoire de ses gestes.
    -->
    <!-- L'appui long est le geste d'entrée des parents, et il n'y a rien à copier sur cet
         écran : le menu du navigateur n'y a rien à faire. Il reste disponible dans l'espace
         parents, où un parent colle parfois un texte. -->
    <main class="ecran" data-ecran @contextmenu.prevent>
      <!-- L'effet karaoké : le mot se remplit d'encre pendant que la tablette le dit. Comme
           le halo de la case, il répond au geste de l'enfant et lie ce qu'il entend à ce
           qu'il voit écrit. Il suit le même réglage, et s'éteint avec lui. -->
      <!-- La zone d'entrée des parents couvre toute la moitié gauche de la première rangée,
           le bleu autour de la bande compris : c'est la rangée de la phrase, inerte, et elle
           s'arrête net avant les boutons de contexte, que l'enfant utilise. -->
      <VerrouParents @ouvrir="ouvrirEspaceParents" />

      <div class="bande-phrase" :class="{ composee: enchainement }" data-bande-phrase>
        <template v-if="enchainement">
          <!-- Toute la suite de mots est une seule cible : viser entre deux pictogrammes ne
               doit pas rater la relecture. -->
          <button
            type="button"
            class="mots-poses"
            data-mots-poses
            :disabled="phrase.length === 0"
            aria-label="Relire toute la phrase"
            @click="direLaPhrase"
          >
            <span v-for="(motPose, rang) in phrase" :key="rang" class="mot-pose" data-mot-pose>
              <span class="mot-ecrit">{{ motDeLaPhrase(motPose) }}</span>
              <span class="vignette-phrase">
                <VignetteCase :contenu="motPose" />
              </span>
            </span>
          </button>
          <div class="gestes-phrase">
            <button
              type="button"
              data-retirer-mot
              :disabled="phrase.length === 0"
              aria-label="Retirer le dernier mot"
              @click="retirerLeDernier"
            >
              ←
            </button>
            <button
              type="button"
              data-vider-phrase
              :disabled="phrase.length === 0"
              aria-label="Effacer toute la phrase"
              @click="viderLaPhrase"
            >
              ✕
            </button>
          </div>
        </template>

        <template v-else>
          <span
            v-if="derniereCase"
            :key="derniereCase.id"
            class="vignette-phrase"
            :class="{ surgit: !!caseAnimee }"
            data-vignette-phrase
          >
            <VignetteCase :contenu="derniereCase" />
          </span>
          <span :key="dernierePhrase" :class="{ dite: !!caseAnimee }" data-phrase-dite>{{ dernierePhrase }}</span>
        </template>
      </div>

      <nav class="contextes" data-contextes>
        <BoutonContexte
          v-for="candidat in contextes"
          :key="candidat.id"
          :contexte="candidat"
          :actif="candidat.id === contexte?.id"
          @choisir="choisirContexte(candidat.id)"
        />

        <!--
          Le contrôle de page vit ici, dans une zone de largeur fixe réservée dès
          maintenant : la bande des contextes fait 8 % de l'écran, la grille 62 %, et tout
          pixel pris à la grille rétrécirait les seize cases. La zone est réservée même
          vide, pour que l'apparition du contrôle ne déplace aucun bouton de contexte.
        -->
        <div class="pagination" data-pagination>
          <ControlePagination
            v-if="pages.length > 1"
            :pages="pages"
            :index-page="indexPage"
            @precedente="allerVersLaPage(-1)"
            @suivante="allerVersLaPage(1)"
          />
        </div>
      </nav>

      <div
        ref="conteneurGrille"
        class="zone-grille"
        :class="{ 'glisse-suivante': glissade === 'suivante', 'glisse-precedente': glissade === 'precedente' }"
        :style="{ '--duree-glissade': `${DUREE_GLISSADE_MS}ms` }"
        :data-zone-grille="glissade ?? 'repos'"
        @pointerdown="surPoseDuDoigt"
        @pointermove="surDeplacementDuDoigt"
        @pointerup="surRelacheDuDoigt"
        @pointerleave="surRelacheDuDoigt"
        @pointercancel="terminerLeGeste"
      >
        <!-- Une planche se montre en grille, sauf celle de la douleur, qui se montre comme
             deux corps à toucher : on montre où on a mal, on ne le choisit pas dans une
             liste. Le reste ne change pas, ce sont les mêmes cases avec les mêmes voix.
             Le parent peut la ramener en grille : un corps dessiné effraie certains enfants,
             et les dix mots y sont les mêmes, à la même place, avec leur pictogramme. -->
        <SilhouetteCommunication
          v-if="page?.ext_mesmots_silhouette && corpsAToucher"
          :planche="page"
          :id-case-qui-parle="caseAnimee"
          @appui-sur-case="(id, debut, fin) => surAppui(page!, id, debut, fin)"
        />
        <GrilleCommunication
          v-else-if="pageAMontrer"
          :planche="pageAMontrer"
          repere="contexte"
          :id-case-qui-parle="caseAnimee"
          @appui-sur-case="(id, debut, fin) => surAppui(page!, id, debut, fin)"
        />
      </div>

      <GrilleCommunication
        v-if="configuration"
        :planche="configuration.barre"
        repere="barre"
        :id-case-qui-parle="caseAnimee"
        @appui-sur-case="(id, debut, fin) => surAppui(configuration!.barre, id, debut, fin)"
      />
      <div v-else></div>
    </main>
  </template>

  <!-- Monté avec la page et jamais au clic, dans les deux modes : les photos de la famille
       sont des URL de blob, qui ne s'impriment que si l'image est déjà dans le document au
       moment où le navigateur compose les pages. Invisible à l'écran. -->
  <PlanchesAImprimer v-if="configuration" :configuration="configuration" />
</template>

<style scoped>
.ecran {
  position: relative;
  height: 100%;
  display: grid;
  /* Encoche et barre de gestes (dette D9). Sans ça la barre des mots essentiels se glisse
     sous la barre de gestes du téléphone, et l'enfant appuie à côté sans comprendre
     pourquoi rien ne parle. La valeur de repli garde la règle valide là où env() manque. */
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
           env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  /* hauteurs de BIBLE.md §5. Elles ne dépendent pas de ce qui est révélé : c'est ce qui
     garantit qu'une révélation ne déplace jamais une case. */
  grid-template-rows: 12% 8% 1fr 18%;
  /* Plus large que haute, la fenêtre étalait les cases en barres, et la grille et la barre
     des mots essentiels prenaient chacune leur largeur : deux blocs décalés au milieu du
     vide. L'application garde ici la forme d'une tablette debout et se centre. En portrait
     la règle ne mord jamais, 100dvh × 0,625 dépassant toujours la largeur. */
  max-width: calc(100dvh * 0.625);
  margin-inline: auto;
}

/* L'image du mot rejoint le texte dans la bande, et surgit quand la tablette parle : le
   geste, le son, l'image et le mot écrit arrivent ensemble. */
.vignette-phrase {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: clamp(32px, 7vh, 64px);
  height: clamp(32px, 7vh, 64px);
}

.vignette-phrase :deep(.vignette) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.vignette-phrase.surgit {
  animation: surgir 320ms ease-out;
}

@keyframes surgir {
  from { transform: scale(0.4) rotate(-8deg); opacity: 0; }
  60% { transform: scale(1.12) rotate(2deg); }
  to { transform: scale(1) rotate(0); opacity: 1; }
}

/* Même parti pris que le halo de la case : l'image continue d'arriver avec le mot, mais par
   un fondu, sans le bond ni la rotation qui sont ce que le réglage veut voir disparaître. */
@media (prefers-reduced-motion: reduce) {
  .vignette-phrase.surgit {
    animation: surgir-sobre 320ms ease-out !important;
  }
}

@keyframes surgir-sobre {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Le remplissage part du gris pâle vers l'encre, de gauche à droite. `background-clip: text`
   peint le texte lui-même : rien ne se déplace, la bande garde exactement sa hauteur. */
.bande-phrase .dite {
  background-image: linear-gradient(to right, var(--encre) 50%, #b8c2cc 50%);
  background-size: 200% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: remplir 900ms linear forwards;
}

@keyframes remplir {
  to { background-position: 0 0; }
}

/* Mode enchaînement. Les mots posés s'alignent à gauche et grandissent vers la droite,
   comme une phrase qu'on écrit, et les deux gestes d'effacement restent au bout, loin des
   cases. */
.bande-phrase.composee {
  justify-content: flex-start;
  gap: var(--case-espacement);
  /* Un blanc de chaque côté, où le parent appuie pour entrer chez lui. La zone d'entrée
     couvre toute la rangée et passe derrière ce que l'enfant touche : ces deux bandes sont
     donc les seuls endroits de la bande où son appui de trois secondes porte. Symétriques
     parce qu'une seule à droite ne se devinait pas, et qu'on l'a cherchée. */
  padding: 6px var(--coin-parents-largeur);
}

/*
 * Les mots se partagent la largeur au lieu de s'aligner à taille fixe : deux mots posés
 * sont deux grands pictogrammes, six sont six petits, et rien ne sort jamais du cadre.
 * Une rangée à taille fixe faisait disparaître les premiers mots sur un téléphone, sans
 * rien dire, ce que l'enfant qui ne lit pas ne pouvait pas rattraper.
 */
/* Au-dessus de la zone d'entrée des parents, qui couvre toute la rangée : ce que l'enfant
   touche passe devant, le reste de la rangée reste au parent. Sans `position` : un élément
   flex dont le `z-index` n'est pas `auto` crée son contexte d'empilement même en `static`,
   et ces deux-là sont les enfants directs de la bande. */
.mots-poses,
.gestes-phrase {
  z-index: 101;
}

.mots-poses {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 4px;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.mots-poses:disabled {
  cursor: default;
}

/* Deux lignes : la phrase en mots au-dessus, les pictogrammes dessous. Les mots alignés
   sur une même ligne se lisent comme une phrase, ce que des étiquettes éparpillées sous
   chaque image ne font pas, et le pictogramme reste la traduction que l'enfant lit. */
.mot-pose {
  flex: 1 1 0;
  /* borné : un seul mot posé ne doit pas devenir une affiche en travers de la bande */
  max-width: clamp(44px, 11vh, 116px);
  display: grid;
  /* `minmax(0, 1fr)` : garde-fou du jour où l'enveloppe reprendrait un `aspect-ratio`, qui
     ferait de sa hauteur le minimum de la piste et écraserait le mot à zéro. Sans lui, la
     bande se dessine à l'identique aujourd'hui, aucun test ne peut donc le défendre. */
  grid-template-rows: auto minmax(0, 1fr);
  align-items: center;
  justify-items: center;
  gap: 2px;
  min-width: 0;
  height: 100%;
}

/* Aucun `aspect-ratio` ici, et c'est le point : l'enveloppe épouse exactement la place que
   la grille lui donne, et l'`object-fit: contain` déjà posé sur l'image la dessine dedans
   sans la déformer. Deux essais avant celui-ci. Une taille déduite de la hauteur ne
   rétrécissait pas quand les mots se serraient, et les visages se recouvraient à cinq mots.
   Déduite de la largeur, le carré débordait par le bas et l'image se coupait sur trente
   pixels, `max-height` ne mordant pas sur une largeur imposée. */
.bande-phrase.composee .vignette-phrase {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

/* Posée en absolu, l'image ne peut occuper que la place réellement accordée : en hauteur
   relative, Chromium résolvait le pourcentage contre la piste avant son dernier calcul et
   rendait 110 px dans une enveloppe de 78. Les moteurs d'aujourd'hui s'en passent (mesuré),
   on la garde pour ceux, plus vieux, des tablettes de la famille. */
.bande-phrase.composee .vignette-phrase :deep(.vignette) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Une case sans image (MOI, LOKI et VENUM attendent leur photo de famille) laissait un
   trou dans la bande. Son mot prend alors toute la place, comme il le fait déjà sur la
   case de la grille. */
.mot-pose:not(:has(.vignette)) {
  grid-template-rows: 1fr;
  align-content: center;
}

.mot-pose:not(:has(.vignette)) .vignette-phrase {
  display: none;
}

.mot-pose:not(:has(.vignette)) .mot-ecrit {
  font-size: clamp(0.7rem, min(2.2vw, 2.6vh), 1.3rem);
  text-transform: uppercase;
}

.mot-ecrit {
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(0.7rem, min(1.8vw, 1.7vh), 0.95rem);
  font-weight: 600;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gestes-phrase {
  flex-shrink: 0;
  display: flex;
  /* un doigt qui vise la flèche et glisse effaçait les six mots d'un coup. L'espacement
     des cases, mais jamais moins de douze pixels : son plancher tombe à 6,8 px sur le
     téléphone de la mère, et c'est là que le geste est le plus serré. */
  gap: max(12px, var(--case-espacement));
  height: 100%;
}

/* Aussi hauts que la bande le permet : ce sont des cibles pour un doigt de cinq ans, pas
   des boutons d'interface d'adulte. */
.gestes-phrase button {
  width: clamp(44px, 7vh, 64px);
  height: 100%;
  /* le trait du contrôle de pagination, l'autre commande de cet écran qui appartient à
     L'enfant : un filet gris pâle tombait à 1,4:1 sur le blanc de la bande */
  border: var(--case-anneau) solid var(--encre);
  border-radius: var(--case-rayon);
  background: var(--blanc);
  color: var(--encre);
  font-size: clamp(1.1rem, 3vh, 1.8rem);
  line-height: 1;
  cursor: pointer;
}

.gestes-phrase button:disabled {
  opacity: 0.35;
  cursor: default;
}

.bande-phrase {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: var(--case-espacement) var(--case-espacement) 0;
  padding: 0 12px;
  border-radius: var(--case-rayon);
  background: var(--blanc);
  color: var(--encre);
  font-size: clamp(1rem, min(3.2vw, 3vh), 2rem);
  font-weight: 600;
  text-align: center;
  overflow: hidden;
}

.contextes {
  display: flex;
  align-items: center;
  gap: var(--case-espacement);
  padding: 0 var(--case-espacement);
  overflow: hidden;
  /* les boutons se mesurent à cette rangée, pas à la fenêtre : l'application se centre sur
     un écran large, la rangée est alors bien plus étroite que lui */
  container-type: inline-size;
}

/* Largeur réservée dès aujourd'hui, comme le sont les emplacements des cases masquées :
   le jour où une deuxième page devient atteignable, aucun bouton de contexte ne bouge.
   Elle tient deux flèches et jusqu'à trois pastilles. */
.pagination {
  /* La place reste réservée, pour qu'une deuxième page qui devient atteignable ne déplace
     aucun bouton de contexte. Mais elle vaut 200 px sur une tablette et moins sur un écran
     étroit : en dur, elle prenait la moitié de la barre et les noms se réduisaient à « M ».
     Sans rétrécissement (`0 0`) : avec cinq contextes, la place promise se faisait écraser
     de 200 à 119 px et les boutons reculaient de 112 px en changeant de contexte. Et elle
     tient le contrôle entier, flèches comprises : 250 px sur une tablette, mesurés. */
  flex: 0 0 min(260px, 32%);
  /* le contrôle ne déborde jamais de la place promise, quel que soit le nombre de pages :
     sinon il repousserait les boutons de contexte, que l'enfant a appris à leur place */
  overflow: hidden;
  /* le contrôle se mesure à cette place, pas à la fenêtre : sur un téléphone il n'y tient
     qu'en laissant tomber ses pastilles */
  container-type: inline-size;
  /* la zone existe même vide, sinon Playwright ni l'oeil ne verraient la place réservée */
  height: 100%;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.zone-grille {
  /* la zone occupe la rangée de la grille sans lui prendre un pixel : c'est la grille
     qu'elle contient qui garde ses 62 % */
  min-height: 0;
  /* sans ça le navigateur peut confisquer le glissement horizontal pour son propre geste
     de retour arrière, et la page ne tournerait jamais */
  touch-action: none;
}

/* La page arrive en translation depuis le bord d'où vient le geste. Le
   prefers-reduced-motion global du projet en supprime la durée. */
.zone-grille.glisse-suivante {
  animation: entrer-par-la-droite var(--duree-glissade) ease-out;
}

.zone-grille.glisse-precedente {
  animation: entrer-par-la-gauche var(--duree-glissade) ease-out;
}

/* pendant la glissade la grille n'écoute plus le doigt : une case serait touchable à une
   position fausse. Et c'est le seul moment où il faut masquer ce qui dépasse : la page
   entrante arrive de l'extérieur du cadre. Le reste du temps la zone laisse passer, sinon
   elle coupe le halo des cases du haut et du bas. */
.zone-grille.glisse-suivante,
.zone-grille.glisse-precedente {
  pointer-events: none;
  overflow: hidden;
}

@keyframes entrer-par-la-droite {
  from { transform: translateX(100%); }
}

@keyframes entrer-par-la-gauche {
  from { transform: translateX(-100%); }
}
</style>
