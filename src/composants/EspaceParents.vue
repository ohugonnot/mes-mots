<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import EditeurCase from './EditeurCase.vue'
import VignetteCase from './VignetteCase.vue'
import SauvegardeParents from './SauvegardeParents.vue'
import RestaurationParents from './RestaurationParents.vue'
import ReglagesParents from './ReglagesParents.vue'
import {
  caseParIdentifiant,
  consequenceEcrite,
  consequencesDuChangementDeForme,
  contextePeutEntrer,
  CONTEXTES_MAXIMUM,
  contexteDuMemeNom,
  nouvellePageAtteignable,
  pageAtteignable,
  identifiantsPersonnalises,
  pageVierge,
  toutesLesPlanches,
  type CaseCommunication,
  type ChampsModifiables,
  type Configuration,
  type Contexte,
  type FormeDeGrille,
  type MediaChoisi,
  type Planche,
} from '../domaine/planche'
import { utiliserGlissementPage } from '../composables/glissementPage'
import { inventaireActuel } from '../domaine/archive'
import { redimensionnerImage } from '../domaine/image'
import { entreesParHeure, heureDe, type EntreeJournal } from '../domaine/journal'
import { utiliserPhotoDeCase } from '../composables/photoDeCase'
import { estimerStockage } from '../domaine/depot'
import { formaterTaille } from '../domaine/taille'

const VERSION = __VERSION_CONSTRUITE__

const effacementDemande = ref(false)
/**
 * Une page par question du parent, dans l'ordre où elle se pose : qu'est-ce qu'il peut dire,
 * son travail est-il à l'abri, comment la tablette se comporte-t-elle. Empilées sur une
 * seule page, les opérations rares et graves passaient sous le doigt du quotidien, et la
 * sauvegarde tombait sous la ligne de flottaison.
 */
const onglet = ref<'mots' | 'sauvegarde' | 'reglages'>('mots')
const etatMiseAJour = ref('')

/**
 * Recharge la page, ce qui est la seule façon de passer à la version que le service worker
 * vient d'installer. Proposé ici et jamais fait tout seul : un rechargement pendant que
 * L'enfant touche une case couperait le son et viderait la bande de phrase.
 */
function redemarrerMaintenant() {
  location.reload()
}

/**
 * Demande au service worker d'aller voir s'il existe une version plus récente. Sans réseau,
 * il n'y a rien à chercher et on le dit plutôt que de laisser un bouton sans effet.
 */
async function verifierMiseAJour() {
  if (!navigator.onLine) {
    etatMiseAJour.value = "Pas de connexion : la tablette se mettra à jour toute seule au prochain lancement connecté."
    return
  }
  etatMiseAJour.value = 'Recherche…'
  try {
    const enregistrement = await navigator.serviceWorker?.getRegistration()
    if (!enregistrement) {
      etatMiseAJour.value = "L'application n'est pas installée sur cet appareil : la page se recharge simplement."
      return
    }
    await enregistrement.update()
    // elle a pu prendre la main pendant l'attente : ne pas écraser « prête » par « déjà à jour »
    if (props.nouvelleVersionPrete) return
    etatMiseAJour.value =
      enregistrement.installing || enregistrement.waiting
        ? "Nouvelle version trouvée, elle s'installe."
        : 'Cette tablette a déjà la dernière version.'
  } catch {
    etatMiseAJour.value = "La vérification a échoué. Réessayez quand la connexion sera meilleure."
  }
}

/**
 * Case en cours de déplacement (P6), ou rien. Le parent choisit d'abord le mot, puis sa
 * nouvelle place : sur une tablette, le glissement se confondrait avec le changement de page.
 * La planche de départ voyage avec elle, parce que le parent peut changer de page entre les
 * deux gestes et poser le mot ailleurs.
 */
const deplacement = ref<{ contenu: CaseCommunication; idPlanche: string } | null>(null)

function poserLaCase(ligne: number, colonne: number) {
  if (!deplacement.value) return
  emit('deplacer', deplacement.value.idPlanche, deplacement.value.contenu.id, plancheChoisie.value.id, ligne, colonne)
  deplacement.value = null
}

/**
 * « Ajouter un mot » demande la place avant d'ouvrir l'éditeur, et jamais l'inverse : c'est
 * le parent qui choisit, et une case ne change plus de place ensuite. Frère du déplacement,
 * et exclusif de lui : les deux visent les mêmes cibles.
 */
const ajout = ref<'inactif' | 'choix' | 'plein'>('inactif')
/** Page où « Ajouter un mot » a amené le parent, tant qu'il y est encore. */
const pageDuSaut = ref<number | null>(null)
const aLibre = (planche: Planche) => planche.grid.order.some((ligne) => ligne.includes(null))
const aSaute = computed(() => pageDuSaut.value !== null && pageDuSaut.value === indexPageAffichee.value)
const invitationAjout = computed(() =>
  aSaute.value
    ? `Cette page était pleine. Voici la page ${indexPageAffichee.value + 1}, touchez la place du nouveau mot.`
    : 'Touchez la place du nouveau mot, sur cette page ou sur une autre.',
)

function commencerAjout() {
  deplacement.value = null
  pageDuSaut.value = null
  const libre = pagesAffichees.value.findIndex(aLibre)
  if (libre === -1) {
    ajout.value = 'plein'
    return
  }
  // la page sous les yeux est pleine : on l'amène sur la première qui a de la place plutôt
  // que de lui faire ouvrir les pages une à une pour en trouver
  if (!aLibre(plancheChoisie.value)) {
    indexPageChoisie.value = libre
    pageDuSaut.value = libre
  }
  ajout.value = 'choix'
}

function confirmerEffacement() {
  effacementDemande.value = false
  emit('toutEffacer')
}

/**
 * Forme en attente de confirmation. Agrandir part tout de suite, parce qu'aucun mot ne
 * bouge ; rétrécir passe par le bloc, parce que l'enfant devra réapprendre des places.
 */
const formeDemandee = ref<FormeDeGrille | null>(null)
/** Ce que les compteurs affichent, tant que la mère n'a rien confirmé. */
const formeEssayee = ref<FormeDeGrille | null>(null)
const consequenceDemandee = computed(() =>
  formeDemandee.value
    ? consequenceEcrite(consequencesDuChangementDeForme(props.configuration, formeDemandee.value), true)
    : null,
)

function surChangerForme(forme: FormeDeGrille) {
  if (consequencesDuChangementDeForme(props.configuration, forme).deplaces === 0) {
    emit('changerForme', forme)
    return
  }
  formeDemandee.value = forme
}

function renoncerAuChangementDeForme() {
  formeDemandee.value = null
  formeEssayee.value = null
}

function confirmerChangementDeForme() {
  const forme = formeDemandee.value
  formeDemandee.value = null
  if (forme) emit('changerForme', forme)
}

const props = defineProps<{
  configuration: Configuration
  stockagePersistant: boolean | null
  installee: boolean
  /** Une version plus récente a pris la main : seule la page affichée est encore l'ancienne. */
  nouvelleVersionPrete: boolean
  /** Ce que la dernière mise à jour a ajouté, à dire au parent : il n'a rien demandé et
   *  découvrirait sinon des mots nouveaux sans savoir d'où ils viennent. */
  nouveautes: string[]
  /** Ce que l'enfant a demandé aujourd'hui, avec l'heure. Vidé à minuit. */
  journal: EntreeJournal[]
  erreurEnregistrement: string
}>()
const emit = defineEmits<{
  reglerRetourAutomatique: [actif: boolean]
  reglerVolume: [pourcentage: number]
  reglerFermete: [cle: string]
  reglerAnimations: [actif: boolean]
  reglerEnchainement: [actif: boolean]
  reglerCorpsAToucher: [actif: boolean]
  changerForme: [forme: FormeDeGrille]
  basculer: [idPlanche: string, idCase: string]
  ajouter: [
    idPlanche: string,
    ligne: number,
    colonne: number,
    champs: ChampsModifiables,
    photo: MediaChoisi,
    son: MediaChoisi,
  ]
  ajouterSurNouvellePage: [
    idContexte: string,
    ligne: number,
    colonne: number,
    champs: ChampsModifiables,
    photo: MediaChoisi,
    son: MediaChoisi,
  ]
  modifier: [idPlanche: string, idCase: string, champs: ChampsModifiables, photo: MediaChoisi, son: MediaChoisi]
  supprimer: [idPlanche: string, idCase: string]
  ajouterContexte: [nom: string]
  renommerContexte: [idContexte: string, nom: string]
  imageDeContexte: [idContexte: string, image: Blob]
  supprimerContexte: [idContexte: string]
  restaurerContexte: [contexte: Contexte, rang: number]
  deplacer: [
    idPlancheDepart: string,
    idCase: string,
    idPlancheArrivee: string,
    ligne: number,
    colonne: number,
  ]
  echanger: [idPlancheA: string, idPremier: string, idPlancheB: string, idSecond: string]
  restaurer: [idPlanche: string, ligne: number, colonne: number, caseARestaurer: CaseCommunication]
  sauvegarder: [configuration: Configuration]
  toutEffacer: []
  restaurerSauvegarde: [configuration: Configuration, ressourcesPersonnalisees: Map<string, Uint8Array>]
  ajouterPlanches: [configuration: Configuration, ressourcesPersonnalisees: Map<string, Uint8Array>]
  /**
   * Photos et sons des cases supprimées et non annulées durant cette session (P4, P8) :
   * la pile d'annulation vit et meurt avec ce composant, donc c'est à sa fermeture, jamais
   * avant, que leur perte devient définitive. Effacer les blobs plus tôt casserait « Annuler ».
   */
  purgerSuppressions: [casesSupprimees: CaseCommunication[]]
  fermer: []
}>()

// l'application entière écoute le changement de version, y compris sur l'écran de l'enfant :
// ici on n'en dit que ce que le parent doit lire
watch(
  () => props.nouvelleVersionPrete,
  (prete) => {
    if (prete) etatMiseAJour.value = 'Nouvelle version prête.'
  },
)

/** Un contexte par entrée, plus la barre : jamais un numéro de page, notion de développeur. */
const choixSelecteur = computed(() => [
  ...props.configuration.contextes.map((c) => ({ id: c.id, name: c.name })),
  { id: props.configuration.barre.id, name: props.configuration.barre.name },
])

const idContexteChoisi = ref(choixSelecteur.value[0]!.id)
/** La page de départ du contexte choisi, jamais celle du contexte précédent. */
watch(idContexteChoisi, () => {
  indexPageChoisie.value = 0
  // un formulaire ou une confirmation ouverts portaient sur le contexte d'avant
  formulaireContexte.value = null
  suppressionContexteDemandee.value = false
  // « il n'y a plus de place ici » parlait du contexte d'avant, pas de celui qu'on ouvre
  ajout.value = 'inactif'
  pageDuSaut.value = null
})

const contexteChoisi = computed(
  () => props.configuration.contextes.find((c) => c.id === idContexteChoisi.value) ?? null,
)

/** Supprimer le contexte affiché laisserait la liste sur un identifiant disparu, donc un
 *  panneau vide. On retombe sur le premier choix. */
watch(choixSelecteur, (choix) => {
  if (!choix.some((c) => c.id === idContexteChoisi.value)) idContexteChoisi.value = choix[0]!.id
})

/** Saisie du nom, à la création comme au renommage : un seul formulaire, deux intentions. */
const formulaireContexte = ref<{ mode: 'nouveau' | 'renommer'; nom: string; cible: string } | null>(null)
const suppressionContexteDemandee = ref(false)
const erreurContexte = ref('')
const erreurImageContexte = ref('')

/** L'image du bouton tel que l'enfant le voit : le parent choisit ce qu'il regarde. */
const { source: imageDuContexteChoisi, signalerEchec: echecImageContexte } = utiliserPhotoDeCase(
  computed(() => ({ image_id: contexteChoisi.value?.ext_mesmots_image })),
)

async function surChoixImageContexte(evenement: Event) {
  const entree = evenement.target as HTMLInputElement
  const fichier = entree.files?.[0]
  entree.value = '' // sinon reprendre exactement la même image ne redéclenche pas « change »
  if (!fichier || !contexteChoisi.value) return

  erreurImageContexte.value = ''
  try {
    emit('imageDeContexte', contexteChoisi.value.id, await redimensionnerImage(fichier))
  } catch (cause) {
    console.error('image de contexte illisible', cause)
    erreurImageContexte.value = "Cette image n'a pas pu être lue. Choisissez-en une autre."
  }
}

/** Contextes supprimés pendant cette session parents, rendus par « Annuler ». Le rang est
 *  gardé avec : remettre un contexte en queue déplacerait les boutons une seconde fois. */
const contextesSupprimes = ref<{ contexte: Contexte; rang: number }[]>([])
const contextesRattrapables = computed(() =>
  contextesSupprimes.value.filter(({ contexte }) => contextePeutEntrer(props.configuration, contexte)),
)
const dernierContexteSupprime = computed(() => contextesRattrapables.value.at(-1) ?? null)

/**
 * Les cases par mot écrit, pour poser la vignette devant chaque ligne de l'historique. Un
 * mot supprimé depuis n'en a plus : la ligne reste, sans image, plutôt que de disparaître.
 */
/**
 * L'impression est rendue par `PlanchesAImprimer`, monté avec la page : ici on ne fait
 * qu'ouvrir la fenêtre du navigateur. Rien à préparer, tout est déjà dans le document.
 */
function imprimerLesPlanches() {
  window.print()
}

const casesParMot = computed(
  () =>
    new Map(
      toutesLesPlanches(props.configuration)
        .flatMap((planche) => planche.buttons)
        .map((contenu) => [contenu.label, contenu]),
    ),
)

const journalParHeure = computed(() => entreesParHeure(props.journal))

/** Le journal arrive du plus récent au plus ancien : la tête est ce qu'il vient de dire. */
const dernierDit = computed(() => props.journal[0] ?? null)

/** Le bloc flottant n'existe que s'il a quelque chose à dire : sinon il masquerait une
 *  rangée de cartes pour rien. */
const unBandeauAAfficher = computed(
  () =>
    !!props.erreurEnregistrement ||
    !!messageAjout.value ||
    !!dernierContexteSupprime.value ||
    !!derniereSuppression.value,
)

const placeLibrePourUnContexte = computed(
  () => props.configuration.contextes.length < CONTEXTES_MAXIMUM,
)
const motsDuContexteChoisi = computed(() =>
  contexteChoisi.value ? contexteChoisi.value.pages.reduce((total, page) => total + page.buttons.length, 0) : 0,
)

function ouvrirFormulaireContexte(mode: 'nouveau' | 'renommer') {
  erreurContexte.value = ''
  formulaireContexte.value = {
    mode,
    nom: mode === 'renommer' ? (contexteChoisi.value?.name ?? '') : '',
    // la cible se fige à l'ouverture : le sélecteur reste actif sous le formulaire, et
    // relire le contexte affiché au moment de valider renommait celui d'à côté
    cible: contexteChoisi.value?.id ?? '',
  }
}

/** On crée un contexte pour le remplir : la liste s'y place dès qu'il existe. Son
 *  identifiant est calculé par le domaine, donc on le lit dans ce qui revient. */
let attendUnNouveauContexte = false
watch(
  () => props.configuration.contextes.length,
  (combien, avant) => {
    if (!attendUnNouveauContexte || combien <= avant) return
    attendUnNouveauContexte = false
    idContexteChoisi.value = props.configuration.contextes.at(-1)!.id
  },
)

function validerFormulaireContexte() {
  const saisie = formulaireContexte.value
  if (!saisie) return
  const nom = saisie.nom.trim()
  if (!nom) {
    erreurContexte.value = 'Donnez un nom à ce contexte.'
    return
  }
  // `cible` porte le contexte affiché même en création : ne l'exclure qu'au renommage,
  // sinon créer un second « Maison » depuis « Maison » passerait sans rien dire.
  const exclu = saisie.mode === 'renommer' ? saisie.cible : undefined
  const homonyme = contexteDuMemeNom(props.configuration, nom, exclu)
  if (homonyme) {
    erreurContexte.value = `« ${homonyme.name} » existe déjà. Donnez un autre nom, sinon les deux boutons se ressemblent et l'enfant ne les distingue pas.`
    return
  }
  if (saisie.mode === 'nouveau') {
    attendUnNouveauContexte = true
    emit('ajouterContexte', nom)
  } else if (saisie.cible) {
    emit('renommerContexte', saisie.cible, nom)
  }
  formulaireContexte.value = null
}

function confirmerSuppressionContexte() {
  const contexte = contexteChoisi.value
  if (!contexte) return
  const rang = props.configuration.contextes.findIndex((c) => c.id === contexte.id)
  contextesSupprimes.value = [...contextesSupprimes.value, { contexte, rang }]
  emit('supprimerContexte', contexte.id)
  suppressionContexteDemandee.value = false
}

function annulerSuppressionContexte() {
  const aRendre = dernierContexteSupprime.value
  if (!aRendre) return
  emit('restaurerContexte', aRendre.contexte, aRendre.rang)
  contextesSupprimes.value = contextesSupprimes.value.filter((s) => s !== aRendre)
}

/** Identifiant fictif de la page d'accueil vide : elle n'existe jamais dans les données. */
const PAGE_ACCUEIL_ID = '__page-accueil-vide__'

/**
 * Page d'accueil vide, entièrement faite de boutons « + ». Elle ne devient une vraie page
 * qu'au moment où un mot y est posé, et vient de `pageVierge` comme la page réellement
 * créée : la même règle à deux endroits ferait diverger l'aperçu et le résultat.
 */
function pageAccueilVide(contexte: Contexte): Planche {
  return pageVierge(contexte, PAGE_ACCUEIL_ID)!
}

/**
 * Deux différences assumées avec l'écran de l'enfant : ici toutes les pages du contexte
 * sont montrées, y compris celles où rien n'est révélé, sinon un parent ne pourrait jamais
 * aller remplir une page vide ; et la barre des mots essentiels n'a qu'une page, donc pas
 * de contrôle pour elle (`contexteChoisi` vaut alors `null`).
 */
const pagesAffichees = computed<Planche[]>(() => {
  if (!contexteChoisi.value) return [props.configuration.barre]
  return nouvellePageAtteignable(contexteChoisi.value)
    ? [...contexteChoisi.value.pages, pageAccueilVide(contexteChoisi.value)]
    : contexteChoisi.value.pages
})

/**
 * Index et non identifiant : contrairement à l'écran de l'enfant, la page d'accueil vide
 * change d'identité à chaque affichage (elle n'est jamais enregistrée). Poser un mot dessus
 * fait grandir `pagesAffichees` d'une page réelle en gardant le même index, ce qui ramène
 * naturellement le parent sur la page qu'il vient de créer.
 */
const indexPageChoisie = ref(0)
const indexPageAffichee = computed(() =>
  Math.min(Math.max(indexPageChoisie.value, 0), pagesAffichees.value.length - 1),
)
const plancheChoisie = computed(() => pagesAffichees.value[indexPageAffichee.value] ?? props.configuration.barre)
const rangDePage = computed(() => `Page ${indexPageAffichee.value + 1} sur ${pagesAffichees.value.length}`)

/** Change de page si la voisine existe. Même bord qu'à l'écran de l'enfant : pas de bouclage. */
function changerDePageParent(pas: 1 | -1): boolean {
  const prochain = indexPageAffichee.value + pas
  if (prochain < 0 || prochain >= pagesAffichees.value.length) return false
  indexPageChoisie.value = prochain
  return true
}

const conteneurGrilleParents = ref<HTMLElement | null>(null)
// `glissade` n'est pas repris : cet écran change de page sans animation, à dessein. Le
// glissement visible sert à l'enfant, qui apprend le modèle spatial ; un parent, non.
// `oublierGlissade` reste dû, le minuteur de la composable survivrait à la fermeture.
const {
  appuiRenonce,
  allerVersLaPage,
  surPoseDuDoigt,
  surDeplacementDuDoigt,
  surRelacheDuDoigt,
  terminerLeGeste,
  oublierGlissade,
} = utiliserGlissementPage(conteneurGrilleParents, changerDePageParent)

onUnmounted(oublierGlissade)

/** Repère pour le parent : cette page n'existe pas encore pour l'enfant. */
const pageMasqueeEntierement = computed(() => !pageAtteignable(plancheChoisie.value))

const REGLAGES_MENACES =
  "Le système peut effacer vos réglages s'il manque de place. Enregistrez une sauvegarde " +
  "et gardez le fichier ailleurs que sur la tablette."

/**
 * Le danger le plus probable n'est pas le manque de place, c'est le navigateur : iPhone et
 * iPad effacent les données des sites qu'on n'ouvre pas pendant une semaine, et n'exemptent
 * que les applications posées sur l'écran d'accueil. Le dire ici, où le parent travaille,
 * vaut mieux que de l'écrire dans un mail qu'il aura oublié.
 */
const PAS_INSTALLEE =
  "L'application n'est pas installée sur cet appareil. Posez-la sur l'écran d'accueil : " +
  "tant qu'elle reste dans le navigateur, iPhone et iPad effacent les données des sites " +
  "qu'on n'ouvre pas pendant une semaine. Enregistrez aussi une sauvegarde."

/**
 * On parcourt `grid.order`, jamais la liste des cases : ici il faut voir les masquées,
 * contrairement à GrilleCommunication qui les filtre.
 */
const emplacements = computed(() =>
  plancheChoisie.value.grid.order.flatMap((ligne, indexLigne) =>
    ligne.map((id, indexColonne) => ({
      cle: `${indexLigne}-${indexColonne}`,
      ligne: indexLigne,
      colonne: indexColonne,
      contenu: id === null ? null : (caseParIdentifiant(plancheChoisie.value, id) ?? null),
    })),
  ),
)

/**
 * L'état de la tablette en une ligne, à lire au téléphone. Pas de cloud, donc pas de
 * visibilité à distance : ce bloc est ce qui la remplace quand la famille appelle.
 */
const etat = computed(() => {
  const inventaire = inventaireActuel(props.configuration)
  const famille = identifiantsPersonnalises(props.configuration)
  return {
    mots: inventaire.cases,
    visibles: inventaire.casesRevelees,
    photos: famille.images.length,
    voix: famille.sons.length,
  }
})
/** « 1 photo », « 2 photos » : le pluriel câblé en dur donnait « 1 photos » à un parent. */
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const stockage = ref<{ utilise: number; quota: number } | null>(null)
onMounted(async () => {
  stockage.value = await estimerStockage()
})

/**
 * Sur le drapeau qui lève déjà le rappel à la fermeture, et non sur une date de sauvegarde
 * de plus à stocker et à migrer : la seule question du parent est « est-ce à l'abri ».
 */
const aSauvegarder = computed(() => props.configuration.reglages.modifieDepuisSauvegarde === true)
const verdictSauvegarde = computed(() =>
  aSauvegarder.value
    ? "Des changements n'ont pas encore été mis dans un fichier de sauvegarde."
    : "Rien n'a changé depuis votre dernière sauvegarde.",
)

const verdictStockage = computed(() => {
  if (!props.installee) return PAS_INSTALLEE
  if (props.stockagePersistant === true) return 'Le système garde vos réglages.'
  if (props.stockagePersistant === false) return REGLAGES_MENACES
  return 'Le système vérifie encore si vos réglages seront gardés.'
})

/** Case en cours d'édition, création si `caseExistante` est `null`. */
const edition = ref<{ caseExistante: CaseCommunication | null; ligne: number; colonne: number } | null>(
  null,
)
interface SuppressionAnnulable {
  idPlanche: string
  ligne: number
  colonne: number
  caseCommunication: CaseCommunication
}
/**
 * Pile des suppressions de la session, la plus récente en dernier. Un seul niveau
 * d'annulation ne rattrapait que la dernière : deux suppressions à la suite et la première
 * était perdue sans qu'aucun avertissement n'ait prévenu qu'il n'y aurait qu'une chance.
 */
const suppressionsAnnulables = ref<SuppressionAnnulable[]>([])

/**
 * Une suppression n'est rattrapable que tant que son emplacement est resté libre :
 * `restaurerCase` refuse d'écraser une case, et le bandeau promettait quand même. Un parent
 * qui supprimait un mot puis remplissait la place libérée voyait le bandeau disparaître
 * comme si l'annulation avait marché, et perdait le mot pour de bon. La promesse se calcule
 * donc sur l'état réel, elle ne peut plus mentir.
 */
const annulables = computed(() =>
  suppressionsAnnulables.value.filter(({ idPlanche, ligne, colonne, caseCommunication }) => {
    const planches = toutesLesPlanches(props.configuration)
    const emplacementLibre = planches.find((p) => p.id === idPlanche)?.grid.order[ligne]?.[colonne] === null
    // l'identifiant aussi, pas seulement la position : recréer un mot au même libellé le
    // reprend, et restaurer l'ancien donnerait deux cases sous le même identifiant
    const identifiantLibre = !planches.some((p) => p.buttons.some((c) => c.id === caseCommunication.id))
    return emplacementLibre && identifiantLibre
  }),
)
const derniereSuppression = computed(() => annulables.value.at(-1) ?? null)

function ouvrirEdition(contenu: CaseCommunication, ligne: number, colonne: number) {
  edition.value = { caseExistante: contenu, ligne, colonne }
}

function ouvrirAjout(ligne: number, colonne: number) {
  ajout.value = 'inactif'
  edition.value = { caseExistante: null, ligne, colonne }
}

function surClicCase(idCase: string) {
  // le doigt a glissé : c'était un changement de page, pas une demande de bascule
  if (appuiRenonce.value) return
  // un déplacement en cours : ce clic désigne la destination, pas une bascule
  if (deplacement.value) {
    if (deplacement.value.contenu.id !== idCase) {
      emit('echanger', deplacement.value.idPlanche, deplacement.value.contenu.id, plancheChoisie.value.id, idCase)
    }
    deplacement.value = null
    return
  }
  emit('basculer', plancheChoisie.value.id, idCase)
}

/**
 * Un mot posé ailleurs que sur la page de départ n'apparaît pas sur l'écran de l'enfant :
 * il faut tourner la page pour l'y trouver. La mère refermait l'espace parents, ne voyait
 * rien de neuf, et en concluait que son ajout avait échoué.
 */
const messageAjout = ref('')
let effacementDuMessage: ReturnType<typeof setTimeout> | null = null

function annoncerLAjout(mot: string) {
  const numeroDePage = indexPageAffichee.value + 1
  if (numeroDePage <= 1) return
  messageAjout.value = `${mot} est posé sur la page ${numeroDePage} : L'enfant le trouvera en tournant la page.`
  if (effacementDuMessage) clearTimeout(effacementDuMessage)
  effacementDuMessage = setTimeout(() => (messageAjout.value = ''), 12_000)
}

function surEnregistrerEdition(champs: ChampsModifiables, photo: MediaChoisi, son: MediaChoisi) {
  if (!edition.value) return
  const { caseExistante, ligne, colonne } = edition.value
  if (!caseExistante) annoncerLAjout(champs.label)
  if (caseExistante) {
    emit('modifier', plancheChoisie.value.id, caseExistante.id, champs, photo, son)
  } else if (plancheChoisie.value.id === PAGE_ACCUEIL_ID) {
    // une seule opération crée la page et y pose le mot, sinon des pages vides
    // s'empileraient sans que personne ne les remplisse jamais
    emit('ajouterSurNouvellePage', contexteChoisi.value!.id, ligne, colonne, champs, photo, son)
  } else {
    emit('ajouter', plancheChoisie.value.id, ligne, colonne, champs, photo, son)
  }
  edition.value = null
}

function surSupprimerEdition() {
  if (!edition.value?.caseExistante) return
  const { caseExistante, ligne, colonne } = edition.value
  suppressionsAnnulables.value = [
    ...suppressionsAnnulables.value,
    { idPlanche: plancheChoisie.value.id, ligne, colonne, caseCommunication: caseExistante },
  ]
  emit('supprimer', plancheChoisie.value.id, caseExistante.id)
  edition.value = null
}

function annulerSuppression() {
  const aRendre = derniereSuppression.value
  if (!aRendre) return
  emit('restaurer', aRendre.idPlanche, aRendre.ligne, aRendre.colonne, aRendre.caseCommunication)
  suppressionsAnnulables.value = suppressionsAnnulables.value.filter((s) => s !== aRendre)
}

/**
 * Ce qui reste ici n'est plus rattrapable : la pile d'annulation disparaît avec le
 * composant, à App.vue d'effacer les blobs devenus orphelins (P4, P8). Effacer plus tôt,
 * dès la suppression elle-même, casserait « Annuler » : une case reviendrait sans photo
 * ni son.
 */
onUnmounted(() => {
  // les mots d'un contexte supprimé et non repris emportent leurs photos et leurs voix :
  // même purge que pour une case, une fois l'annulation devenue impossible
  const perdues = [
    ...suppressionsAnnulables.value.map((s) => s.caseCommunication),
    ...contextesSupprimes.value
      .filter(({ contexte }) => !props.configuration.contextes.some((e) => e.id === contexte.id))
      .flatMap(({ contexte }) => contexte.pages.flatMap((page) => page.buttons)),
  ]
  if (perdues.length > 0) emit('purgerSuppressions', perdues)
})
</script>

<template>
  <!-- Le nombre de colonnes est porté par la racine et non par la grille seule : la ligne de
       pagination et le repère de page s'alignent sur la même largeur qu'elle, sinon « Ajouter
       un mot » partait se coller au bord droit d'un écran large, loin de la grille. -->
  <div
    class="espace-parents"
    data-espace-parents
    :style="{ '--colonnes': plancheChoisie.grid.columns }"
  >
    <!-- Un seul bloc collé, et non trois éléments qui se posent chacun à une hauteur écrite en
         dur : la barre d'onglets ne fait pas la même hauteur à 390 et à 800 px, ses libellés
         passant sur deux lignes, et le bandeau qui devait se poser dessous ne pouvait pas
         connaître ce nombre. Ici il n'y a plus de nombre à connaître. -->
    <div class="tete-collee">
      <header class="entete">
        <h1>Espace parents</h1>
        <button type="button" class="terminer" data-fermer-parents @click="emit('fermer')">
          Terminé
        </button>
      </header>

      <nav class="onglets" data-onglets-parents>
        <button
          type="button"
          class="onglet"
          :class="{ actif: onglet === 'mots' }"
          :aria-pressed="onglet === 'mots'"
          data-onglet="mots"
          @click="onglet = 'mots'"
        >
          Les mots
        </button>
        <button
          type="button"
          class="onglet"
          :class="{ actif: onglet === 'sauvegarde' }"
          :aria-pressed="onglet === 'sauvegarde'"
          data-onglet="sauvegarde"
          @click="onglet = 'sauvegarde'"
        >
          Sauvegarde
        </button>
        <button
          type="button"
          class="onglet"
          :class="{ actif: onglet === 'reglages' }"
          :aria-pressed="onglet === 'reglages'"
          data-onglet="reglages"
          @click="onglet = 'reglages'"
        >
          Réglages
        </button>
      </nav>

      <!-- Dans le bloc collé, pas flottant : flottant au bas de la fenêtre il recouvrait les
           cibles qu'il désigne, et flottant en haut il recouvrait la barre d'onglets, si bien
           qu'un doigt visant « Réglages » tombait sur « Annuler ». Ici il descend avec elle,
           et ne peut plus la recouvrir. -->
      <template v-if="onglet === 'mots'">
        <div v-if="deplacement" class="bandeau-mode">
          <div class="bandeau-deplacement" data-bandeau-deplacement>
            <span>
              Touchez la place de {{ deplacement.contenu.label }}, sur cette page ou sur une
              autre. Sur un mot déjà posé, les deux échangent leur place ; personne d'autre ne
              bouge.
              <!-- La notice appelle « ne jamais déplacer un mot connu » la règle la plus
                   importante de l'application. Le bandeau, lui, rassurait. -->
              <strong v-if="!deplacement.contenu.hidden" data-avertissement-deplacement>
                Ce mot est déjà affiché : L'enfant le cherchera à son ancienne place.
              </strong>
            </span>
            <button type="button" data-annuler-deplacement @click="deplacement = null">
              Annuler
            </button>
          </div>
        </div>

        <!-- Même bandeau que le déplacement, et jamais les deux ensemble : pendant un ajout les
             actions des cartes sont voilées, donc « Déplacer » n'est plus touchable. -->
        <div v-if="ajout !== 'inactif'" class="bandeau-mode">
          <div class="bandeau-deplacement" data-bandeau-ajout>
            <span v-if="ajout === 'choix'" data-invitation-ajout>{{ invitationAjout }}</span>
            <span v-else data-plus-de-place>
              Il n'y a plus de place ici. Supprimez un mot pour en libérer une, ou choisissez un
              autre contexte.
            </span>
            <button type="button" data-annuler-ajout @click="ajout = 'inactif'">
              {{ ajout === 'choix' ? 'Annuler' : 'Fermer' }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <template v-if="onglet === 'mots'">

    <!-- Replié en tête des mots plutôt qu'en onglet : c'est le même sujet, et c'est le jour
         de crise que la mère l'ouvre. Demandé par elle, à sa condition : effacé à minuit,
         sans statistique ni comptage. Une liste de ce qu'il a dit, et rien d'autre. -->
    <details class="journal-depliant" data-onglet-historique>
      <!-- Fermé, il disait seulement son nom : rien n'indiquait s'il y avait quelque chose
           dedans. Il porte maintenant le dernier mot dit, donc il répond déjà à la question
           des jours ordinaires. Le dernier mot et pas un nombre : pas de comptage. -->
      <summary>
        Ce qu'il a dit aujourd'hui
        <span v-if="dernierDit" class="dernier-dit" data-dernier-dit>
          <span v-if="casesParMot.get(dernierDit.mot)" class="vignette-journal petite">
            <VignetteCase :contenu="casesParMot.get(dernierDit.mot)!" />
          </span>
          {{ dernierDit.mot }}
          <span class="heure">{{ heureDe(dernierDit.horodatage) }}</span>
        </span>
      </summary>
      <p v-if="!props.journal.length" class="aide" data-journal-vide>
        Rien encore aujourd'hui. La liste se vide toute seule chaque nuit.
      </p>
      <!-- Découpé par heure : c'est le seul repère que ces données portent, et sans lui la
           journée est un mur de lignes identiques qu'on ne traverse pas. Les heures
           descendent, donc l'ordre se montre au lieu d'être annoncé par une phrase. -->
      <div v-else class="journal" data-journal>
        <section v-for="heure in journalParHeure" :key="heure.libelle" class="heure-journal">
          <h3 data-heure-journal>{{ heure.libelle }}</h3>
          <ol>
            <!-- la vignette d'abord : toute l'application est faite d'images, la lectrice de
                 cette liste est dyslexique, et l'heure n'est que le détail qu'on vérifie après -->
            <li v-for="entree in heure.entrees" :key="entree.horodatage" data-entree-journal>
              <span v-if="casesParMot.get(entree.mot)" class="vignette-journal">
                <VignetteCase :contenu="casesParMot.get(entree.mot)!" />
              </span>
              <span class="mot-dit">{{ entree.mot }}</span>
              <span class="heure">{{ heureDe(entree.horodatage) }}</span>
            </li>
          </ol>
        </section>
      </div>
    </details>

    <label class="selecteur">
      Contexte à modifier
      <select v-model="idContexteChoisi" data-selecteur-planche>
        <option v-for="choix in choixSelecteur" :key="choix.id" :value="choix.id">
          {{ choix.name }}
        </option>
      </select>
    </label>

    <!-- Repliées : créer, renommer, supprimer un contexte ou changer son image sont des
         gestes rares, et empilés sur un téléphone ils repoussaient la grille des mots,
         qui est ce qu'on vient faire ici, sous la ligne de flottaison. -->
    <details class="repli-contexte" data-actions-contexte>
      <summary>Gérer les contextes</summary>
      <div v-if="!formulaireContexte" class="actions-contexte">
      <button
        v-if="placeLibrePourUnContexte"
        type="button"
        data-nouveau-contexte
        @click="ouvrirFormulaireContexte('nouveau')"
      >
        Nouveau contexte
      </button>
      <button
        v-if="contexteChoisi"
        type="button"
        data-renommer-contexte
        @click="ouvrirFormulaireContexte('renommer')"
      >
        Renommer
      </button>
      <button
        v-if="contexteChoisi && configuration.contextes.length > 1"
        type="button"
        data-supprimer-contexte
        @click="suppressionContexteDemandee = true"
      >
        Supprimer ce contexte
      </button>
      <!-- L'enfant ne lit pas : sans image, deux mondes ne se distinguent que par un mot
           écrit en haut de son écran. Les contextes livrés en ont une, ceux que la famille
           crée n'en ont aucune tant qu'elle n'en choisit pas. -->
      <label v-if="contexteChoisi" class="bouton-image-contexte">
        <img v-if="imageDuContexteChoisi" :src="imageDuContexteChoisi" alt="" @error="echecImageContexte" />
        {{ imageDuContexteChoisi ? "Changer l'image" : 'Ajouter une image' }}
        <input
          type="file"
          accept="image/*"
          class="entree-fichier-cachee"
          data-champ-image-contexte
          @change="surChoixImageContexte"
        />
      </label>
      <p v-if="erreurImageContexte" class="erreur-contexte" data-erreur-image-contexte>
        {{ erreurImageContexte }}
      </p>
        <p v-if="!placeLibrePourUnContexte" class="aide" data-contextes-au-max>
          {{ CONTEXTES_MAXIMUM }} contextes au maximum : au-delà, leurs boutons ne tiennent
          plus en haut de l'écran de l'enfant.
        </p>
      </div>

      <!-- dans le repli et non à sa place : le formulaire le remplaçait, ce qui refermait
           le repli à chaque validation et cachait l'image qu'on venait de choisir -->
      <div v-else class="formulaire-contexte" data-formulaire-contexte>
        <label class="selecteur">
          {{ formulaireContexte.mode === 'nouveau' ? 'Nom du nouveau contexte' : 'Nouveau nom' }}
          <input v-model="formulaireContexte.nom" type="text" data-champ-nom-contexte />
        </label>
        <p v-if="erreurContexte" class="erreur-contexte" data-erreur-contexte>{{ erreurContexte }}</p>
        <div class="boutons-contexte">
          <button type="button" data-annuler-formulaire-contexte @click="formulaireContexte = null">
            Annuler
          </button>
          <button type="button" class="principale" data-valider-contexte @click="validerFormulaireContexte">
            Enregistrer
          </button>
        </div>
      </div>
    </details>

    <div v-if="suppressionContexteDemandee && contexteChoisi" class="confirmation-contexte" data-confirmation-contexte>
      <p>
        {{ contexteChoisi.name }} et ses {{ pluriel(motsDuContexteChoisi, 'mot') }} seront supprimés,
        avec leurs photos et leurs voix. Les contextes suivants avanceront d'une place en
        haut de l'écran de l'enfant, qui devra réapprendre où ils sont.
      </p>
      <div class="boutons-contexte">
        <button
          type="button"
          class="principale"
          data-annuler-suppression-contexte
          @click="suppressionContexteDemandee = false"
        >
          Garder ce contexte
        </button>
        <button
          type="button"
          class="destructeur"
          data-confirmer-suppression-contexte
          @click="confirmerSuppressionContexte"
        >
          Supprimer quand même
        </button>
      </div>
    </div>

    <div class="ligne-pages">
      <!-- Pas le contrôle de l'enfant : il n'a pas de chiffre, parce qu'il ne lit pas. Le
         parent, lui, travaille sur une page précise et doit savoir laquelle. La flèche du
         bord garde sa place en devenant invisible, sinon le rang sauterait sous le doigt. -->
    <div v-if="pagesAffichees.length > 1" class="pagination-parents" data-pagination>
      <button
        type="button"
        class="page-fleche"
        :class="{ inutile: indexPageAffichee === 0 }"
        :disabled="indexPageAffichee === 0"
        data-page-precedente
        aria-label="Page précédente"
        @click="allerVersLaPage(-1)"
      >
        ◀
      </button>
      <span class="page-rang" data-rang-page>{{ rangDePage }}</span>
      <button
        type="button"
        class="page-fleche"
        :class="{ inutile: indexPageAffichee === pagesAffichees.length - 1 }"
        :disabled="indexPageAffichee === pagesAffichees.length - 1"
        data-page-suivante
        aria-label="Page suivante"
        @click="allerVersLaPage(1)"
      >
        ▶
      </button>
    </div>
      <!-- Le geste pour lequel cet écran existe, donc le seul bouton plein de la page. Le
           « + » sur une case vide reste : ce bouton ne remplace pas le chemin que la notice
           décrit, il le rend trouvable quand la page est pleine. -->
      <button type="button" class="ajouter-mot" data-ajouter-mot @click="commencerAjout">
        Ajouter un mot
      </button>
    </div>

    <p v-if="pageMasqueeEntierement" class="repere-invisible" data-repere-invisible>
      Cette page n'est pas encore visible pour l'enfant.
    </p>

    <div
      ref="conteneurGrilleParents"
      class="zone-grille-parents"
      @pointerdown="surPoseDuDoigt"
      @pointermove="surDeplacementDuDoigt"
      @pointerup="surRelacheDuDoigt"
      @pointerleave="surRelacheDuDoigt"
      @pointercancel="terminerLeGeste"
    >
      <div
        class="grille-parents"
        data-grille-parents
        :style="{ '--lignes': plancheChoisie.grid.rows }"
      >
        <template v-for="emplacement in emplacements" :key="emplacement.cle">
          <div v-if="emplacement.contenu" class="carte">
            <button
              type="button"
              class="case-parent"
              :class="{
                masquee: emplacement.contenu.hidden,
                'en-deplacement': deplacement?.contenu.id === emplacement.contenu.id,
                cible: !!deplacement && deplacement.contenu.id !== emplacement.contenu.id,
              }"
              :style="{
                '--fond-etiquette': emplacement.contenu.background_color ?? '#e8eef4',
                '--anneau-case': emplacement.contenu.border_color ?? '#94a3b8',
              }"
              :data-case-parent="emplacement.contenu.id"
              :data-etat="emplacement.contenu.hidden ? 'masqué' : 'affiché'"
              :aria-pressed="!emplacement.contenu.hidden"
              @click="surClicCase(emplacement.contenu.id)"
            >
              <VignetteCase :contenu="emplacement.contenu" />
              <span class="mot">{{ emplacement.contenu.label }}</span>
              <!-- Seule l'exception se commente : « affiché » sous quatorze cases sur seize
                   ne disait rien et alourdissait la grille. Le mot reste sur les masquées,
                   pour que le pointillé ne soit jamais la seule marque. -->
              <span v-if="emplacement.contenu.hidden" class="etat">masqué</span>
            </button>
            <!-- Pendant un déplacement ou un ajout, seules les destinations restent touchables.
                 La place des actions est gardée pour que la grille ne saute pas sous le doigt.
                 Sans l'ajout dans la condition, « Déplacer » restait sous le bandeau d'ajout :
                 le parent lisait « touchez la place du nouveau mot » et échangeait deux cases. -->
            <div class="actions-carte" :class="{ effacee: !!deplacement || ajout !== 'inactif' }">
              <button
                type="button"
                class="modifier"
                :data-modifier-case="emplacement.contenu.id"
                @click="ouvrirEdition(emplacement.contenu, emplacement.ligne, emplacement.colonne)"
              >
                Modifier
              </button>
              <button
                type="button"
                class="modifier"
                :data-deplacer-case="emplacement.contenu.id"
                @click="deplacement = { contenu: emplacement.contenu, idPlanche: plancheChoisie.id }"
              >
                Déplacer
              </button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="emplacement-libre"
            :class="{ cible: !!deplacement || ajout === 'choix' }"
            :data-ajouter-case="deplacement ? undefined : ''"
            :data-poser-ici="deplacement ? `${emplacement.ligne}-${emplacement.colonne}` : undefined"
            :aria-label="deplacement ? `Poser ${deplacement.contenu.label} ici` : 'Ajouter un mot ici'"
            @click="deplacement ? poserLaCase(emplacement.ligne, emplacement.colonne) : ouvrirAjout(emplacement.ligne, emplacement.colonne)"
          >
            {{ deplacement || ajout === 'choix' ? 'Poser ici' : '+' }}
          </button>
        </template>
      </div>
    </div>
    </template>

    <!-- v-show et non v-else : la sauvegarde et la restauration gardent leur état chez
         elles, et un aller-retour d'onglet effaçait le message disant qu'une archive est
         illisible, sans que le parent l'ait fermé. -->
    <section v-show="onglet === 'reglages'" class="pied" data-onglet-reglages>
      <ReglagesParents
        :configuration="props.configuration"
        @regler-retour-automatique="(actif: boolean) => emit('reglerRetourAutomatique', actif)"
        @regler-volume="(pourcentage: number) => emit('reglerVolume', pourcentage)"
        @regler-fermete="(cle: string) => emit('reglerFermete', cle)"
        @regler-animations="(actif: boolean) => emit('reglerAnimations', actif)"
        @regler-enchainement="(actif: boolean) => emit('reglerEnchainement', actif)"
        @regler-corps-a-toucher="(actif: boolean) => emit('reglerCorpsAToucher', actif)"
        v-model:forme-essayee="formeEssayee"
        @changer-forme="surChangerForme"
      />

      <!-- Même fenêtre que l'effacement : les deux gestes ont en commun de ne pas se
           reprendre d'un appui, et le parent reconnaît la forme de ce qui ne s'annule pas. -->
      <div v-if="formeDemandee && consequenceDemandee" class="voile-effacement">
        <div class="confirmation-effacement" data-confirmation-forme>
          <h3>
            Changer la grille pour {{ formeDemandee.colonnes }} colonnes et
            {{ formeDemandee.lignes }} lignes ?
          </h3>
          <p data-consequence-confirmation>
            {{ consequenceDemandee }} Aucun mot ne sera perdu. Faites d'abord une sauvegarde si
            vous voulez pouvoir revenir en arrière.
          </p>
          <div class="actions-effacement">
            <button type="button" class="secondaire" data-garder-forme @click="renoncerAuChangementDeForme">
              Garder la grille actuelle
            </button>
            <!-- Pas le rouge de l'effacement : ce geste ne perd aucun mot, et le texte
                 juste au-dessus le dit. -->
            <button type="button" data-confirmer-forme @click="confirmerChangementDeForme">
              Changer la grille
            </button>
          </div>
        </div>
      </div>

      <!-- Ce qui tourne, et non ce que la famille a mis dedans : la version est le seul
           renseignement que le parent vient lire ici. -->
      <section class="bloc">
        <h2>L'application</h2>
        <p v-if="props.nouveautes.length" class="verdict" data-nouveautes>
          La dernière mise à jour a ajouté {{ props.nouveautes.join(', ') }}. Rien de ce que vous
          aviez n'a été touché.
        </p>
        <!-- « quelle version tourne ? » doit se lire à l'écran : un cache de service worker a
             déjà servi une version périmée sans que rien ne le signale -->
        <p class="version" data-version>Version du {{ VERSION }}</p>
        <!-- La tablette se met à jour toute seule au lancement, quand elle a du réseau. Ce
             bouton sert à ne pas attendre, et surtout à savoir : sans lui, un parent qui a lu
             « c'est corrigé » n'a aucun moyen de vérifier qu'il a bien la version corrigée. -->
        <p class="ligne-maj">
          <button type="button" class="verifier-maj" data-verifier-maj @click="verifierMiseAJour">
            Vérifier les mises à jour
          </button>
          <span v-if="etatMiseAJour" class="etat-maj" data-etat-maj>{{ etatMiseAJour }}</span>
          <button
            v-if="nouvelleVersionPrete"
            type="button"
            class="bouton-contour"
            data-redemarrer-maj
            @click="redemarrerMaintenant"
          >
            Redémarrer maintenant
          </button>
        </p>
      </section>
    </section>

    <section v-show="onglet === 'sauvegarde'" class="pied" data-onglet-sauvegarde>
      <!-- L'inventaire avant les boutons : il dit ce qu'il y a à perdre, donc pourquoi
           enregistrer. -->
      <section class="bloc">
        <h2>Ce qu'il y a sur la tablette</h2>
        <p class="etat" data-etat-tablette>
          Sur cette tablette :
          <span data-etat-mots>{{ pluriel(etat.mots, 'mot') }}</span>, dont
          <span data-etat-visibles>{{ pluriel(etat.visibles, 'visible') }}</span> ·
          <span data-etat-photos>{{ pluriel(etat.photos, 'photo') }}</span> et
          <span data-etat-voix>{{ etat.voix }} voix</span> de la famille<template v-if="stockage">
            · <span data-etat-stockage>{{ formaterTaille(stockage.utilise) }} utilisés sur {{ formaterTaille(stockage.quota) }}</span></template>.
        </p>
        <p class="verdict" :class="{ alerte: aSauvegarder }" data-etat-sauvegarde>
          {{ verdictSauvegarde }}
        </p>
        <p class="verdict" :class="{ alerte: !props.installee }" data-verdict-stockage>
          {{ verdictStockage }}
        </p>
      </section>

      <!-- « Mettre à l'abri » et non « Sauvegarde » : l'onglet porte déjà ce nom, et deux
           titres identiques sur la même page ne repèrent plus rien. -->
      <section class="bloc">
        <h2>Mettre à l'abri</h2>
        <div class="actions-rares">
          <SauvegardeParents :configuration="props.configuration" @sauvegarder="(c) => emit('sauvegarder', c)" />
          <RestaurationParents
            :configuration="props.configuration"
            @restaurer="(c, r) => emit('restaurerSauvegarde', c, r)"
            @ajouter-planches="(c, r) => emit('ajouterPlanches', c, r)"
          />
        </div>
        <!-- Même famille de gestes que la sauvegarde : mettre à l'abri. Le papier est la
             parade classique le jour où la batterie est vide ou la tablette oubliée. -->
        <p class="ligne-maj">
          <button type="button" class="bouton-contour" data-imprimer-planches @click="imprimerLesPlanches">
            Imprimer les planches
          </button>
          <span class="etat-maj">Une feuille par page de mots, à plastifier pour le sac.</span>
        </p>
      </section>

      <!-- Dernier de la page, et seul de son bloc : effacer ne se rattrape pas, et un doigt
           qui vise « Restaurer » ne doit pas pouvoir le manquer de quelques pixels. -->
      <section class="bloc">
        <button
          v-if="!effacementDemande"
          type="button"
          class="bouton-contour rouge"
          data-demander-effacement
          @click="effacementDemande = true"
        >
          Effacer toute la configuration
        </button>

        <!-- Centrée à l'écran et non dépliée sous le bouton : ouverte en bas de page, la
             confirmation allongeait la page et ses deux boutons sortaient de la fenêtre,
             coupés en deux. Une décision sans retour ne se prend pas sur un bouton à moitié
             visible. Comme l'aperçu avant restauration, c'est une fenêtre. -->
        <div v-if="effacementDemande" class="voile-effacement">
          <div class="confirmation-effacement" data-confirmation-effacement>
            <h3>Effacer toute la configuration ?</h3>
            <p>
              Tout sera effacé : les mots ajoutés, les photos, les voix enregistrées et les
              réglages. La tablette repartira de la configuration d'origine, et rien ne pourra
              être récupéré. Faites d'abord une sauvegarde si vous voulez pouvoir revenir en arrière.
            </p>
            <div class="actions-effacement">
              <button type="button" class="secondaire" data-annuler-effacement @click="effacementDemande = false">
                Annuler
              </button>
              <button type="button" class="effacer" data-confirmer-effacement @click="confirmerEffacement">
                Effacer définitivement
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>

    <!-- Tous les autres messages au même endroit, flottant au bas de la fenêtre : posés dans
         le flux de la page, on ne les voyait qu'en ayant déjà descendu jusqu'à eux, alors
         qu'ils portent une annulation qui ne dure pas. Empilés, jamais superposés. -->
    <div v-if="unBandeauAAfficher" class="bandeaux">
      <p v-if="props.erreurEnregistrement" class="bandeau-erreur" data-erreur-enregistrement>
        {{ props.erreurEnregistrement }}
      </p>

      <p v-if="messageAjout" class="bandeau-suppression" data-message-ajout>{{ messageAjout }}</p>

      <div v-if="dernierContexteSupprime" class="bandeau-suppression" data-bandeau-contexte-supprime>
        <span>{{ dernierContexteSupprime.contexte.name }} a été supprimé.</span>
        <button type="button" data-annuler-contexte @click="annulerSuppressionContexte">Annuler</button>
      </div>

      <div v-if="derniereSuppression" class="bandeau-suppression" data-bandeau-suppression>
        <span>
          {{ derniereSuppression.caseCommunication.label }} a été supprimé.
          <template v-if="annulables.length > 1">
            {{ annulables.length }} suppressions peuvent encore être annulées,
            la plus récente d'abord.
          </template>
        </span>
        <button type="button" data-annuler-suppression @click="annulerSuppression">Annuler</button>
      </div>
    </div>

    <EditeurCase
      v-if="edition"
      :case-existante="edition.caseExistante"
      @enregistrer="surEnregistrerEdition"
      @supprimer="surSupprimerEdition"
      @fermer="edition = null"
    />
  </div>
</template>

<style scoped>
/* Fond sobre et gris, à l'opposé du ciel dégradé de l'enfant : un adulte doit reconnaître
   cet écran au premier regard. */
.espace-parents {
  /* La largeur de la grille, partagée par tout ce qui doit s'aligner dessus. Plafonnée parce
     que sur un écran de 1920 px une carte faisait 470 sur 84, un rectangle plat qui ne
     ressemble plus à une case : cet écran est le miroir de celui de l'enfant. */
  --largeur-grille: calc(var(--colonnes) * 200px + (var(--colonnes) - 1) * 10px);
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 20px 20px;
  overflow: auto;
  background: #eef1f4;
  color: var(--encre);
  font-family: system-ui, sans-serif;
}

/* Collé en haut : la page des réglages fait 1 378 px dans le téléphone de la mère, haut de
   844, et le parent qui venait de sauvegarder devait remonter chercher la sortie, ou l'onglet
   suivant. Un seul « Terminé » et une seule barre d'onglets, toujours au même endroit, plutôt
   qu'un doublon en bas. Le fond est celui de la page : la gouttière de 16 px entre le titre et
   les onglets laisserait sinon défiler le contenu au travers. */
.tete-collee {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Débord horizontal seulement, pour étendre le fond dans le rembourrage du conteneur. */
  margin: 0 -20px;
  padding: 0 20px;
  background: #eef1f4;
}

.entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* Débord horizontal seulement. Une marge haute négative remontait tout ce qui suit de 20 px
     alors que `sticky` reposait l'en-tête à sa place : il mangeait le bord haut des onglets,
     qui paraissaient rognés. C'est le conteneur qui n'a plus de marge en haut. */
  margin: 0 -20px 0;
  padding: 12px 20px;
  background: #eef1f4;
  border-bottom: 1px solid #c7ccd1;
}

.entete h1 {
  margin: 0;
  font-size: 1.4rem;
}

.terminer {
  min-height: 48px;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: var(--encre);
  color: var(--blanc);
  font-size: 1rem;
  cursor: pointer;
  touch-action: manipulation;
}

/* Tout ce qu'on lit dans « Les mots » tient dans la colonne de la grille, déjà plafonnée et
   centrée. Sans ça, sur un écran de PC, une ligne du journal faisait 1560 px : le mot à
   gauche, son heure à l'autre bout, et l'œil traversait du vide entre les deux. */
.journal-depliant,
.selecteur,
.repli-contexte {
  width: 100%;
  max-width: var(--largeur-grille);
  margin-inline: auto;
}

.selecteur {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.95rem;
  font-weight: 600;
}

.selecteur select,
.selecteur input[type='text'] {
  min-height: 44px;
  padding: 8px;
  font-size: 1rem;
}

.selecteur input[type='text'] {
  border: 2px solid #c7ccd1;
  border-radius: 8px;
  touch-action: manipulation;
}

/* « Ajouter un mot » à droite du rang de page : c'est la même ligne de commande, au-dessus
   de la grille qu'elle vise. Il reste seul quand le contexte n'a qu'une page. */
.ligne-pages {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: var(--largeur-grille);
  margin-inline: auto;
}

.ajouter-mot {
  min-height: 48px;
  margin-left: auto;
  padding: 10px 18px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--encre);
  color: var(--blanc);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.pagination-parents {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: 56px;
}

.page-fleche {
  min-width: 48px;
  min-height: 48px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 1rem;
  cursor: pointer;
  touch-action: manipulation;
}

/* Invisible mais toujours là : sans sa place, le rang de page se décalerait d'une page à
   l'autre, et c'est le seul repère écrit de cette ligne. */
.page-fleche.inutile {
  visibility: hidden;
}

.page-rang {
  font-size: 0.95rem;
  font-weight: 600;
}

.reglage {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  font-weight: 600;
}

.reglage input {
  width: 24px;
  height: 24px;
}

/* Même amande que le bandeau de suppression : un repère d'information, pas un état masqué. */
.repere-invisible {
  width: 100%;
  max-width: var(--largeur-grille);
  margin-inline: auto;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fff3cd;
  color: var(--encre);
  font-size: 0.9rem;
  font-weight: 600;
}

.zone-grille-parents {
  flex: 1;
  display: flex;
  /* Pas de min-height: 0 : il laissait la grille déborder de sa zone au lieu de pousser
     le pied, qui recouvrait la dernière rangée sur un écran de 1000 px de haut. Les
     rangées sont fixes, la zone n'a plus besoin de relayer une hauteur. */
  /* pan-y et non none : cette page défile, un parent sur téléphone doit pouvoir la faire
     défiler en glissant sur la grille. Le glissement horizontal reste à nous, le vertical
     au navigateur, qui nous annule alors le pointeur. Sur l'écran de l'enfant, qui ne
     défile pas, none reste la bonne valeur. */
  touch-action: pan-y;
}

.grille-parents {
  display: grid;
  /* Élément d'un conteneur flex en ligne : sans cette part, la grille se dimensionne sur
     son contenu et les colonnes en 1fr ne s'étirent plus. Sur un écran large elle se
     recroquevillait sur un tiers de la largeur. */
  flex: 1;
  min-width: 0;
  max-width: var(--largeur-grille);
  margin-inline: auto;
  /* minmax(0, …) et non minmax(120px, …) : sur le téléphone de la mère, quatre colonnes de
     120 px réclamaient 510 px pour 350 disponibles, et la dernière carte sortait de l'écran
     avec son bouton « Modifier ». Le miroir de la grille de l'enfant garde son nombre de
     colonnes, les cartes rétrécissent. */
  grid-template-columns: repeat(var(--colonnes), minmax(0, 1fr));
  /* Hauteur de rangée fixe, et la grille ne s'étire pas : la barre des mots essentiels
     n'a qu'une seule rangée, qui prenait alors toute la hauteur libre et donnait trois
     cartes géantes. Une carte a la même taille quel que soit le nombre de rangées. */
  /* 150 et non 120 : la vignette a grandi les cartes, et le bouton « Modifier » d'une
     rangée passait sous la carte de la suivante, vu sur une capture à 1600 px */
  grid-template-rows: repeat(var(--lignes), 150px);
  gap: 10px;
  align-content: start;
}

/* Un « + » visible et cliquable : les emplacements libres cessent d'être invisibles (P3). */
.emplacement-libre {
  display: grid;
  place-items: center;
  min-height: 44px;
  border: 2px dashed #adb5bd;
  border-radius: 8px;
  background: transparent;
  color: #495057;
  font-size: 1.5rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

/* La case et le bouton Modifier sont deux boutons frères, jamais l'un dans l'autre : un
   bouton imbriqué est invalide en HTML, et un geste ambigu ferait basculer par erreur. */
.carte {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* le mot se mesure à sa carte : sur un téléphone, CHAMBRE et DOUDOU touchaient les bords */
  container-type: inline-size;
}

.carte .mot {
  font-size: min(0.95rem, 13cqw);
  line-height: 1.1;
  overflow-wrap: anywhere;
}

/* Adultes seulement ici, les 3,5 cm de l'enfant ne s'appliquent pas, mais on reste
   largement au-dessus des 44 px de cible tactile. */
.case-parent {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  /* L'anneau et la bande du mot prennent les couleurs de l'enfant : cet écran est le miroir
     du sien, et treize cartes blanches identiques ne lui ressemblaient pas. La mère choisit
     une couleur dans l'éditeur sans en voir le résultat ailleurs que sur la tablette. */
  border: 2px solid var(--anneau-case, var(--encre));
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.carte .mot {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--fond-etiquette, transparent);
}

/* Des légendes et non des boutons cadrés : deux cadres sous chacune des seize cartes
   faisaient trente-deux boîtes identiques où rien ne ressortait, alors que le cadre qui
   compte est celui de la carte. La cible garde ses 44 px et sa place au pixel, le doigt
   habitué vise au même endroit. Le fond n'apparaît qu'à l'appui, pour que le geste réponde. */
.modifier {
  /* Un contour et un fond, comme avant les trois pages : allégés en simple texte pour ne
     laisser qu'un seul poids plein par page, les deux gestes les plus fréquents de l'écran
     ne se lisaient plus comme des boutons. Le seul plein reste « Ajouter un mot ». */
  min-height: 44px;
  border: 1px solid var(--encre);
  border-radius: 6px;
  background: var(--blanc);
  color: var(--encre);
  /* 0,8 rem et pas plus : à 0,85 « Déplacer » passe sur deux lignes dans une carte de quatre
     colonnes, la ligne de légendes grandit de 5,7 px et la carte rétrécit d'autant, ce que le
     test de taille égale des cartes attrape. Mesuré. */
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.modifier:active {
  background: #dfe4e9;
}

/* La couleur seule ne distingue jamais les deux états : le mot « masqué »/« affiché » le fait.
   Un fond gris et non une opacité : à 45 % d'opacité l'encre ne donnait plus que 2,61:1 sur
   blanc, sous les 4,5:1 de WCAG, sur l'écran où un parent doit justement lire ce qui est
   caché. Le gris tient 10,51:1, mesuré par `rapportDeContraste`. */
.case-parent.masquee {
  border-style: dashed;
  background: #dfe4e9;
}

/* En pastille sur la carte, hors de son flux : mesuré, la ligne d'état faisait dépasser le
   contenu de 5,7 px hors de la rangée de 150 px, et le dépassement mangeait l'écart avec la
   rangée du dessous. Le dépassement existait avant, sur toutes les cartes à la fois, donc
   aucune mesure ne le voyait. Le fond presque blanc garde le mot lisible s'il touche la
   vignette. Sélecteur ancré sur la case : nu, il attrapait aussi la ligne d'inventaire de
   « Ce qu'il y a sur la tablette », qui partait se coller en haut de la fenêtre. */
.case-parent .etat {
  position: absolute;
  top: 4px;
  right: 6px;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.85);
  font-size: 0.7rem;
  font-weight: 600;
}

.effacer {
  min-height: 48px;
  padding: 10px 16px;
  border: 2px solid #8c1d18;
  border-radius: 8px;
  background: transparent;
  color: #8c1d18;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

/* Même registre que l'aperçu de restauration : un voile, un panneau centré, et le panneau
   défile lui-même si la fenêtre est courte, sans jamais laisser un bouton hors de l'écran. */
.voile-effacement {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(18, 48, 79, 0.75);
  overflow: auto;
}

.confirmation-effacement {
  width: min(520px, 100%);
  max-height: 100%;
  padding: 20px;
  border-radius: 12px;
  background: #eef1f4;
  overflow: auto;
}

.confirmation-effacement h3 {
  margin: 0 0 10px;
  font-size: 1.1rem;
}

.confirmation-effacement p {
  margin: 0 0 10px;
}

.actions-effacement {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.actions-effacement button {
  flex: 1;
  min-height: 48px;
  min-width: 8rem;
  padding: 10px 16px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

/* Le rouge plein sur le seul bouton sans retour, et il vient après la règle commune des
   deux boutons, sinon il se fait écraser et les deux se ressemblent. */
/* Plein, comme le bouton d'effacement et pour la même raison : la règle commune des deux
   boutons est plus spécifique qu'une classe seule, et les deux se ressemblaient. */
.actions-effacement [data-confirmer-forme] {
  background: var(--encre);
  color: var(--blanc);
}

.actions-effacement [data-confirmer-effacement] {
  border-color: #8c1d18;
  background: #b3261e;
  color: var(--blanc);
}

.actions-carte {
  display: flex;
  gap: 6px;
}

/* Sur un téléphone, la carte tombe à 80 px de large : « Modifier » et « Déplacer » côte à
   côte s'y chevauchaient et sortaient de leur colonne. Empilés, chacun garde toute la
   largeur de la carte et sa cible tactile ; la rangée s'allonge d'autant. */
@media (max-width: 560px) {
  .actions-carte {
    flex-direction: column;
  }

  .grille-parents {
    grid-template-rows: repeat(var(--lignes), 210px);
  }
}

.actions-carte .modifier {
  flex: 1;
  /* sans ça, le texte impose sa largeur au bouton, qui déborde de sa colonne */
  min-width: 0;
}

/* Une cible de dépôt se voit : sans ça le parent cherche où poser, et un emplacement libre
   ressemble à un trou plutôt qu'à une place qui l'attend. */
.emplacement-libre.cible {
  border-style: solid;
  border-color: var(--encre);
  background: #dbe6f3;
  color: var(--encre);
  font-size: 0.95rem;
  font-weight: 600;
}

/* Deux onglets larges, pas deux libellés fins : cet écran se touche au doigt, souvent
   debout, une tablette dans l'autre main. */
.onglets {
  display: flex;
  gap: 8px;
}

.onglet {
  flex: 1;
  min-height: 52px;
  padding: 10px 16px;
  border: 2px solid #c7ccd1;
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.onglet.actif {
  border-color: var(--encre);
  background: var(--encre);
  color: var(--blanc);
}

/* La case qu'on déplace se distingue de toutes les autres : sans ce repère, le parent ne
   sait plus laquelle il a prise, et le bandeau est loin sur un téléphone. */
.carte .en-deplacement {
  outline: 4px solid var(--encre);
  outline-offset: 2px;
}

/* Pendant un déplacement, les autres mots sont des destinations : sans ce repère, la mère
   prenait un mot puis ne voyait plus rien à toucher, la grille étant pleine. */
.carte .case-parent.cible {
  outline: 3px dashed var(--encre);
  outline-offset: 2px;
}

/* Retirées du flux, et non seulement rendues invisibles : voilées, elles laissaient sous
   chaque carte une bande vide de 48 px, si bien qu'une case faisait 102 px là où
   l'emplacement libre d'à côté en faisait 150. Pendant un déplacement toutes les cellules
   sont des cibles, celles qui tiennent un mot comprises, puisqu'on peut y échanger : elles
   doivent donc avoir la même taille. */
.actions-carte.effacee {
  display: none;
}

/* Fermé, il ne coûte qu'une ligne ; ouvert, il rend les quatre actions telles quelles.
   `display: flex` sur un summary lui fait perdre son triangle : le titre paraissait alors
   ouvrir une section vide, et c'était le seul chemin vers les contextes. */
.repli-contexte summary {
  min-height: 44px;
  display: list-item;
  list-style-position: inside;
  padding: 10px 0;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.repli-contexte[open] summary {
  margin-bottom: 8px;
}

.actions-contexte,
.boutons-contexte {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* Les classes de l'éditeur de case ne traversent pas jusqu'ici : sans ces règles les
   boutons revenaient à l'apparence par défaut du navigateur, sous la cible tactile de 44 px. */
.actions-contexte button,
.boutons-contexte button {
  min-height: 44px;
  padding: 8px 16px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.boutons-contexte .principale {
  border-color: var(--encre);
  background: var(--encre);
  color: var(--blanc);
}

/* Supprimer un contexte efface un monde entier avec ses photos et ses voix : le bouton le
   dit, comme celui qui supprime une seule case. */
.boutons-contexte .destructeur {
  border-color: #8c1d18;
  color: #8c1d18;
}

/* Un label et non un bouton : l'entrée fichier vit dedans, cachée. Il porte l'image que
   L'enfant voit, pour que le parent sache ce qu'il remplace. */
.bouton-image-contexte {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 4px 16px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.bouton-image-contexte img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.entree-fichier-cachee {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.formulaire-contexte,
.confirmation-contexte {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
}

.confirmation-contexte p {
  margin: 0;
}

.erreur-contexte {
  margin: 0;
  color: #b3261e;
  font-weight: 600;
}

/* Le bloc flottant : il ne prend de place que s'il a quelque chose à dire, il reste au bas
   de la fenêtre quel que soit le défilement, et il empile ses messages au lieu de les
   superposer. La marge du bas laisse voir la dernière rangée de cartes derrière lui. */
.bandeaux {
  position: fixed;
  z-index: 5;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* le contenu du dessous reste atteignable entre deux bandeaux */
  pointer-events: none;
}

/* Rien à écrire ici : le bandeau est une rangée du bloc collé, donc il descend avec les
   onglets au lieu de venir se poser par-dessus à une hauteur devinée. */

.bandeau-mode > * {
  box-shadow: 0 6px 18px rgba(18, 48, 79, 0.28);
}

.bandeaux > * {
  pointer-events: auto;
  box-shadow: 0 6px 18px rgba(18, 48, 79, 0.28);
}

.bandeau-deplacement {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--encre);
  color: var(--blanc);
  font-weight: 600;
}

.bandeau-deplacement button {
  min-height: 44px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-weight: 600;
  cursor: pointer;
}

.bandeau-erreur {
  margin: 0;
  padding: 12px 14px;
  border: 2px solid #b3261e;
  border-radius: 8px;
  background: #fdecea;
  color: #8c1d18;
  font-weight: 600;
}

.bandeau-suppression {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fff3cd;
  color: var(--encre);
  font-weight: 600;
}

.bandeau-suppression button {
  min-height: 44px;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: var(--encre);
  color: var(--blanc);
  font-size: 0.95rem;
  cursor: pointer;
  touch-action: manipulation;
}

/* Onglet des opérations rares : il commence en haut de la page comme la grille, et non
   plus collé en bas de l'écran des mots, où il recouvrait la dernière rangée. */
.pied {
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-size: 0.95rem;
}

.pied h2 {
  margin: 0 0 6px;
  font-size: 1.2rem;
}

.pied .verdict,
.pied .etat {
  margin: 0 0 8px;
}

.pied .version {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.75;
}

/* Le risque de perte totale ne se lit pas en gris au milieu d'un paragraphe : tant que
   l'application n'est pas posée sur l'écran d'accueil, iOS peut tout effacer au bout d'une
   semaine. C'est le seul avertissement de cet écran qui annonce une perte irréversible. */
.verdict.alerte {
  padding: 10px 12px;
  border-left: 4px solid #8c1d18;
  border-radius: 4px;
  background: #fdecea;
  color: #8c1d18;
  font-weight: 600;
}

/* Fermé, il ne coûte qu'une ligne au-dessus des mots, et cette ligne porte le dernier mot dit
   à son bout. `display: flex` fait perdre au summary son triangle, redessiné juste dessous :
   en `list-item`, le dernier mot passait à la ligne au-dessus du titre. */
.journal-depliant summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}

.journal-depliant summary::-webkit-details-marker {
  display: none;
}

.journal-depliant summary::before {
  content: '▶';
  font-size: 0.7rem;
}

.journal-depliant[open] summary::before {
  content: '▼';
}

/* Pas de hauteur bornée ici : elle créait un défilement dans le défilement de la page, sans
   rien pour marquer la frontière, et dès dix entrées. Un doigt partait dans la liste ou dans
   la page selon dix pixels. Le repli est déjà le contenant, et si elle ouvre le journal,
   c'est le journal qu'elle veut voir. */
.journal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.heure-journal h3 {
  margin: 0 0 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4b5563;
}

.heure-journal ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.journal li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #dfe4e9;
  font-size: 0.95rem;
}

/* L'heure part à la fin de la ligne : le mot et son dessin se lisent d'abord. */
.mot-dit {
  flex: 1;
}

/* le filet sépare deux mots, pas une heure du titre de la suivante */
.heure-journal li:last-child {
  border-bottom: none;
}

/* Assez grande pour reconnaître le dessin, assez petite pour que la liste reste une liste.
   `VignetteCase` impose 44 px de haut à son image : sans la contrainte, elle débordait de
   son cadre et faisait grandir la ligne. */
.vignette-journal {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}

.vignette-journal :deep(.vignette) {
  height: 100%;
  object-fit: contain;
}

.journal-depliant .heure {
  color: #4b5563;
  font-size: 0.85rem;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

/* Le dernier mot dit, sur la ligne repliée. `inline-flex` et non `flex` : le résumé garde son
   triangle tant qu'il reste un `list-item`. */
.dernier-dit {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-weight: 400;
}

.vignette-journal.petite {
  width: 24px;
  height: 24px;
}

/* Chaque geste rare a son bloc, séparé du suivant par un filet : sans cette séparation
   « Vérifier les mises à jour » et « Effacer toute la configuration » se lisaient comme
   deux lignes de la même liste. */
.bloc {
  padding-top: 16px;
  border-top: 1px solid #c7ccd1;
}

/* le premier ouvre la page : un filet au-dessus le collerait aux onglets */
.bloc:first-child {
  padding-top: 0;
  border-top: none;
}

.actions-rares {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

/* Même écart que celui qui sépare les deux boutons du dessus. Sans lui, le bord haut
   d'« Imprimer les planches » touchait exactement le bord bas d'« Enregistrer une
   sauvegarde » : deux contours collés se lisent comme un seul bloc mal dessiné. */
.actions-rares + .ligne-maj {
  margin-top: 16px;
}

.ligne-maj {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  flex-wrap: wrap;
}

/* Le poids d'une action dit ce qu'elle fait au travail de la famille : contour pour ce qui
   agit et se rattrape, lien souligné pour ce qui ne fait que lire, rouge pour le sans-retour.
   Le seul plein de la page est « Terminé », dans l'en-tête. */
.bouton-contour {
  min-height: 48px;
  padding: 10px 16px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

/* Pleine largeur et seul de son bloc : un doigt qui vise « Restaurer » ne doit pas tomber
   dessus, et une fois visé il ne doit pas se manquer de quelques pixels. */
.bouton-contour.rouge {
  display: block;
  width: 100%;
  border-color: #8c1d18;
  color: #8c1d18;
}

.verifier-maj {
  min-height: 44px;
  padding: 8px 4px;
  border: none;
  background: none;
  color: var(--encre);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}

.etat-maj {
  font-size: 0.85rem;
  color: #4b5563;
}

</style>
