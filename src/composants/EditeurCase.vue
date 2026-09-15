<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  type CaseCommunication,
  type ChampsModifiables,
  type MediaChoisi,
} from '../domaine/planche'
import { PALETTE } from '../domaine/palette'
import { redimensionnerImage } from '../domaine/image'
import { typeDesOctets } from '../domaine/archive'
import { formaterTaille } from '../domaine/taille'
import VignetteCase from './VignetteCase.vue'
import { utiliserSonDeCase } from '../composables/sonDeCase'
import { LecteurAudio, syntheseDisponible } from '../domaine/lecteurAudio'

const props = defineProps<{ caseExistante: CaseCommunication | null }>()
const emit = defineEmits<{
  enregistrer: [champs: ChampsModifiables, photo: MediaChoisi, son: MediaChoisi]
  supprimer: []
  fermer: []
}>()

const LONGUEUR_MOT_MAXIMALE = 14

const label = ref(props.caseExistante?.label ?? '')
const vocalization = ref(props.caseExistante?.vocalization ?? '')
const extMesmotsEnchaine = ref(props.caseExistante?.ext_mesmots_enchaine ?? '')
const familleChoisie = ref(
  PALETTE.find((f) => f.anneau === props.caseExistante?.border_color)?.nom ?? PALETTE[0]!.nom,
)

/** Rien de saisi ne se perd sans un mot : fermer d'un appui à côté est un geste facile à
 *  faire sans le vouloir, et une prise au micro ne se refait pas toujours. */
const familleInitiale = PALETTE.find((f) => f.anneau === props.caseExistante?.border_color)?.nom ?? PALETTE[0]!.nom
const confirmationFermeture = ref(false)

const modifie = computed(() => {
  if (mediaPhotoChoisi().statut !== 'inchange' || mediaSonChoisi().statut !== 'inchange') return true
  if (etatEnregistreur.value !== 'repos') return true
  const existante = props.caseExistante
  if (!existante) return !!label.value.trim() || !!vocalization.value.trim()
  return (
    label.value !== existante.label ||
    vocalization.value !== existante.vocalization ||
    extMesmotsEnchaine.value !== (existante.ext_mesmots_enchaine ?? '') ||
    familleChoisie.value !== familleInitiale
  )
})

function demanderFermeture() {
  if (modifie.value) confirmationFermeture.value = true
  else emit('fermer')
}

const erreurLabel = ref('')
const erreurVocalization = ref('')
const confirmationSuppression = ref(false)

// --- Photo (P4) ------------------------------------------------------------
// L'éditeur ne parle pas au dépôt lui-même : il délègue l'affichage de la photo déjà posée
// au composant de vignette, qui la lit.

const nouvellePhoto = ref<Blob | null>(null)
const urlApercuNouvellePhoto = ref<string | null>(null)
/** Ce que le parent a demandé pour l'image, comme pour la voix : rien, ou n'avoir aucune
 *  image et laisser le mot s'afficher en grand. */
const intentionPhoto = ref<'inchange' | 'aucun'>('inchange')
const erreurPhoto = ref('')

/** L'image que la case portera, hors photo en attente de validation. */
const referenceImagePrevue = computed(() =>
  intentionPhoto.value === 'aucun' ? undefined : props.caseExistante?.image_id,
)

const imageChoisie = computed<'image' | 'aucune'>({
  get() {
    if (nouvellePhoto.value) return 'image'
    return referenceImagePrevue.value ? 'image' : 'aucune'
  },
  set(valeur) {
    if (valeur === 'aucune') retirerLImage()
    else intentionPhoto.value = 'inchange'
  },
})

/** Une image existe-t-elle à remettre : celle du mot, ou celle qu'on vient de choisir. */
const imageDisponible = computed(() => !!nouvellePhoto.value || !!props.caseExistante?.image_id)

function libererApercuPhoto() {
  if (!urlApercuNouvellePhoto.value) return
  URL.revokeObjectURL(urlApercuNouvellePhoto.value)
  urlApercuNouvellePhoto.value = null
}

/** Numéro du dernier choix de photo. Se raviser aussitôt lançait deux redimensionnements,
 *  et c'est le plus lent qui gagnait : la photo prise à l'appareil, plus lourde à décoder,
 *  écrasait celle choisie ensuite dans la galerie. */
let dernierChoixPhoto = 0

async function surChoixPhoto(evenement: Event) {
  const entree = evenement.target as HTMLInputElement
  const fichier = entree.files?.[0]
  entree.value = '' // sinon reprendre exactement la même photo ne redéclenche pas « change »
  if (!fichier) return

  const choix = ++dernierChoixPhoto
  erreurPhoto.value = ''
  try {
    const vignette = await redimensionnerImage(fichier)
    if (choix !== dernierChoixPhoto) return
    libererApercuPhoto()
    nouvellePhoto.value = vignette
    urlApercuNouvellePhoto.value = URL.createObjectURL(vignette)
    intentionPhoto.value = 'inchange'
  } catch (cause) {
    if (choix !== dernierChoixPhoto) return
    console.error('photo illisible', cause)
    erreurPhoto.value = "Cette photo n'a pas pu être lue. Choisissez-en une autre."
  }
}

function retirerLImage() {
  libererApercuPhoto()
  nouvellePhoto.value = null
  intentionPhoto.value = 'aucun'
}

function mediaPhotoChoisi(): MediaChoisi {
  if (nouvellePhoto.value) return { statut: 'nouveau', blob: nouvellePhoto.value }
  if (intentionPhoto.value === 'inchange') return { statut: 'inchange' }
  return { statut: intentionPhoto.value }
}

// --- Son (P8) ----------------------------------------------------------------

type EtatEnregistreur = 'repos' | 'enregistrement' | 'ecoute'
/** Le format se demande, il ne se devine pas (BIBLE.md) : ordre de préférence testé à l'exécution. */
const FORMATS_SON = ['audio/webm;codecs=opus', 'audio/mp4']

const etatEnregistreur = ref<EtatEnregistreur>('repos')

/** Deux mégaoctets : trois secondes de parole en pèsent quelques dizaines de kilo. Au-delà,
 *  c'est une chanson ou un enregistrement entier, posé sur une tablette dont la place est
 *  comptée et que la famille emporte partout. */
const POIDS_SON_MAXIMAL = 2 * 1024 * 1024

/**
 * Poser un fichier son fait ailleurs, à côté de l'enregistrement au micro. Le flux
 * d'échange du projet le réclame : la mère envoie sa sauvegarde, le pÃ¨re corrige depuis son
 * ordinateur, où il n'a personne devant un micro mais un fichier de synthèse sous la main.
 */
async function surChoixSon(evenement: Event) {
  const entree = evenement.target as HTMLInputElement
  const fichier = entree.files?.[0]
  entree.value = ''
  if (!fichier) return

  erreurSon.value = ''
  if (fichier.size > POIDS_SON_MAXIMAL) {
    erreurSon.value = `Ce fichier pèse ${formaterTaille(fichier.size)}, c'est trop pour un mot. Raccourcissez-le, ou exportez-le plus léger.`
    return
  }
  // le vrai format se lit dans les octets : une extension ne prouve rien, et un fichier qui
  // n'est pas de l'audio rendrait la case muette sans que personne ne s'en aperçoive
  const octets = new Uint8Array(await fichier.arrayBuffer())
  const type = typeDesOctets(octets)
  if (!type?.startsWith('audio/')) {
    erreurSon.value = "Ce fichier n'est pas un son que la tablette sait lire. Choisissez un MP3, un M4A ou un WebM."
    return
  }

  libererApercuSon()
  nouveauSon.value = new Blob([octets], { type })
  urlEcouteSon.value = URL.createObjectURL(nouveauSon.value)
  intentionSon.value = 'inchange'
  etatEnregistreur.value = 'ecoute'
}
const nouveauSon = ref<Blob | null>(null)
const urlEcouteSon = ref<string | null>(null)
/** Ce que le parent a demandé pour la voix : rien, revenir au MP3 livré, ou n'avoir aucun
 *  son et laisser la tablette lire le texte. Un seul état, parce que deux booléens
 *  pouvaient se contredire. */
const intentionSon = ref<'inchange' | 'aucun'>('inchange')

/** Le son que la case portera, hors enregistrement en cours d'écoute. Rien signifie que la
 *  tablette lira le texte. */
const referenceSonPrevue = computed(() =>
  intentionSon.value === 'aucun' ? undefined : props.caseExistante?.sound_id,
)

/**
 * Qui parlera pour ce mot. Deux réponses, pas trois : les MP3 livrés avec l'application sont
 * des fichiers posés d'avance, pas une catégorie que le parent aurait à distinguer.
 */
type VoixPossible = 'enregistree' | 'texte'

/** Une voix existe-t-elle à remettre : celle du mot, ou celle qu'on vient de poser. */
const voixEnregistreeDisponible = computed(() => !!nouveauSon.value || !!props.caseExistante?.sound_id)

const voixChoisie = computed<VoixPossible>({
  get() {
    if (nouveauSon.value) return 'enregistree'
    return referenceSonPrevue.value ? 'enregistree' : 'texte'
  },
  set(valeur) {
    if (valeur === 'texte') retirerLaVoix()
    // « inchange » remet la voix que le mot avait, la sienne ou celle livrée avec
    // l'application. Le bouton est désactivé quand il n'y en a aucune à remettre.
    else intentionSon.value = 'inchange'
  },
})

/** Vrai quand aucun enregistrement ne parlera pour ce mot : c'est alors la tablette qui lit. */
const litLeTexte = computed(() => voixChoisie.value === 'texte')

/**
 * La case telle qu'elle sera après enregistrement, pour que l'aperçu montre exactement ce
 * que l'enfant verra : le pictogramme livré compte autant que la photo de la famille, et
 * l'éditeur annonçait « Pas de photo » sur un mot que l'enfant voit illustré. Photo retirée,
 * l'aperçu passe au pictogramme livré, ce qui est bien ce qui reprendra sa place.
 */
const caseApresEnregistrement = computed(() => {
  const existante = props.caseExistante
  if (!existante) return null
  return {
    ...existante,
    image_id: referenceImagePrevue.value,
    sound_id: referenceSonPrevue.value,
  }
})

/** Ce que la tablette dira si le parent enregistre maintenant : le MP3 livré, sa voix déjà
 *  posée, ou celle qui reprendrait la place s'il retire la sienne. */
const { source: urlSonActuel } = utiliserSonDeCase(caseApresEnregistrement)
/**
 * Le parent a réécrit le texte alors qu'un enregistrement parlera : la tablette dira encore
 * l'ancien mot. C'est exactement ce qui est arrivé à la mère, qui a écrit « C'est moi
 * l'enfant » et entendu « Moi ». On ne peut pas le deviner à la lecture, on le dit ici.
 */
const texteChangeSansVoix = computed(
  () =>
    !!props.caseExistante &&
    !litLeTexte.value &&
    !nouveauSon.value &&
    vocalization.value.trim() !== props.caseExistante.vocalization,
)

/** L'éditeur fait entendre la voix de la tablette comme il fait entendre un MP3 : le parent
 *  juge sur ce qu'il entend, pas sur une promesse. */
const lecteurApercu = new LecteurAudio()
function ecouterLeTexte() {
  lecteurApercu.lireTexte(vocalization.value.trim())
}
const erreurSon = ref('')

/** Quinze secondes : une phrase de communication en dure une à trois, et un enregistrement
 *  oublié tournerait sinon jusqu'à ce que la tablette manque de place. */
const DUREE_ENREGISTREMENT_MAXIMALE_MS = 15_000

let minuteurEnregistrement: number | null = null
/** Vrai entre le clic et le vrai début de capture : deux appuis rapides pendant l'attente
 *  de la permission ouvraient deux flux micro, et le premier ne se refermait plus. */
let demarrageEnCours = false
/** Faux dès le démontage : onstop arrive après, et créait une URL que plus rien ne libérait
 *  quand un parent fermait l'éditeur en pleine prise de voix, l'enfant réclamant. */
let monte = true
let enregistreur: MediaRecorder | null = null
let flux: MediaStream | null = null
let morceaux: Blob[] = []

function libererApercuSon() {
  if (!urlEcouteSon.value) return
  URL.revokeObjectURL(urlEcouteSon.value)
  urlEcouteSon.value = null
}

function formatSonSupporte(): string | null {
  return FORMATS_SON.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

function arreterLesPistes() {
  flux?.getTracks().forEach((piste) => piste.stop())
  flux = null
}

async function demarrerEnregistrement() {
  erreurSon.value = ''
  if (typeof MediaRecorder === 'undefined') {
    erreurSon.value = "L'enregistrement d'un son n'est pas possible sur cet appareil."
    return
  }
  const format = formatSonSupporte()
  if (!format) {
    erreurSon.value = "Aucun format d'enregistrement compatible n'a été trouvé sur cet appareil."
    return
  }

  if (demarrageEnCours) return
  demarrageEnCours = true
  try {
    flux = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (cause) {
    // NotFoundError : aucun micro. NotReadableError : le micro est pris par une autre
    // application, et dire au parent d'aller dans les réglages ne l'aiderait pas. Le reste
    // se lit comme un refus de permission, qu'il comprend et peut lever.
    const nom = cause instanceof DOMException ? cause.name : ''
    erreurSon.value =
      nom === 'NotFoundError' || nom === 'DevicesNotFoundError'
        ? "Aucun micro n'a été trouvé sur cet appareil."
        : nom === 'NotReadableError' || nom === 'TrackStartError'
          ? 'Le micro est déjà utilisé par une autre application. Fermez-la, puis réessayez.'
          : "L'accès au micro a été refusé. Autorisez le micro dans les réglages du navigateur pour enregistrer un son."
    demarrageEnCours = false
    return
  }
  demarrageEnCours = false
  // L'éditeur a pu être fermé pendant que la boîte de permission du système attendait :
  // sans cette sortie, le micro s'ouvrait sur un composant détruit et tournait quinze
  // secondes, sans rien à l'écran pour l'arrêter.
  if (!monte) {
    arreterLesPistes()
    return
  }

  morceaux = []
  // 32 kbit/s : le débit de référence de la parole en Opus, transparent à l'oreille. Sans
  // le préciser, le navigateur enregistre à 128 et une phrase de trois secondes pèse
  // quatre fois plus, sur un appareil dont on ne maîtrise ni la place ni le contenu.
  enregistreur = new MediaRecorder(flux, { mimeType: format, audioBitsPerSecond: 32_000 })
  enregistreur.ondataavailable = (evenement: BlobEvent) => {
    if (evenement.data.size > 0) morceaux.push(evenement.data)
  }
  enregistreur.onstop = () => {
    if (!monte) {
      arreterLesPistes()
      return
    }
    libererApercuSon()
    nouveauSon.value = new Blob(morceaux, { type: format })
    urlEcouteSon.value = URL.createObjectURL(nouveauSon.value)
    intentionSon.value = 'inchange'
    arreterLesPistes()
    etatEnregistreur.value = 'ecoute'
  }
  enregistreur.start()
  // Un enregistrement oublié tournerait indéfiniment. Une phrase de communication dure une
  // à trois secondes, quinze laissent toute la marge voulue sans piéger personne.
  minuteurEnregistrement = window.setTimeout(arreterEnregistrement, DUREE_ENREGISTREMENT_MAXIMALE_MS)
  etatEnregistreur.value = 'enregistrement'
}

function arreterEnregistrement() {
  if (minuteurEnregistrement !== null) {
    clearTimeout(minuteurEnregistrement)
    minuteurEnregistrement = null
  }
  // un second appui avant l'évènement onstop rappelait stop() sur un enregistreur déjà
  // arrêté, ce qui lève une exception : on ne s'arrête que si l'on enregistre encore
  if (enregistreur?.state === 'recording') enregistreur.stop()
}

/** Un seul bouton qui démarre puis arrête, comme Proloquo2Go et CoughDrop (BIBLE.md). */
function surBoutonEnregistrer() {
  if (etatEnregistreur.value === 'enregistrement') arreterEnregistrement()
  else void demarrerEnregistrement()
}

function recommencerEnregistrement() {
  libererApercuSon()
  nouveauSon.value = null
  etatEnregistreur.value = 'repos'
}

function retirerLaVoix() {
  libererApercuSon()
  nouveauSon.value = null
  intentionSon.value = 'aucun'
  etatEnregistreur.value = 'repos'
}

function mediaSonChoisi(): MediaChoisi {
  if (nouveauSon.value) return { statut: 'nouveau', blob: nouveauSon.value }
  if (intentionSon.value === 'inchange') return { statut: 'inchange' }
  return { statut: intentionSon.value }
}

onUnmounted(() => {
  monte = false
  lecteurApercu.couper()
  // par arreterEnregistrement et non stop() : fermer l'éditeur en plein enregistrement
  // laissait le minuteur de quinze secondes armé, qui rappelait stop() après coup
  arreterEnregistrement()
  arreterLesPistes()
  libererApercuPhoto()
  libererApercuSon()
})

// --- Validation et enregistrement -------------------------------------------

function enregistrer() {
  const mot = label.value.trim()
  erreurLabel.value = ''
  erreurVocalization.value = ''

  if (mot.length === 0) erreurLabel.value = 'Le mot écrit sur la case est obligatoire.'
  else if (mot.length > LONGUEUR_MOT_MAXIMALE) {
    erreurLabel.value = `Le mot ne peut pas dépasser ${LONGUEUR_MOT_MAXIMALE} caractères.`
  }
  if (vocalization.value.trim().length === 0) {
    // sinon la case resterait muette au toucher : la même exigence que C1
    erreurVocalization.value = 'Le texte affiché est obligatoire.'
  }
  if (erreurLabel.value || erreurVocalization.value) return

  const famille = PALETTE.find((f) => f.nom === familleChoisie.value) ?? PALETTE[0]!
  emit(
    'enregistrer',
    {
      label: mot,
      vocalization: vocalization.value.trim(),
      ext_mesmots_enchaine: extMesmotsEnchaine.value.trim(),
      background_color: famille.fond,
      border_color: famille.anneau,
    },
    mediaPhotoChoisi(),
    mediaSonChoisi(),
  )
}
</script>

<template>
  <div class="editeur-case" data-editeur-case @click.self="demanderFermeture">
    <div class="panneau">
      <div class="entete">
        <h2>{{ props.caseExistante ? 'Modifier ce mot' : 'Ajouter un mot' }}</h2>
        <button
          type="button"
          class="fermer"
          aria-label="Fermer"
          data-fermer-editeur
          @click="demanderFermeture"
        >
          ✕
        </button>
      </div>

      <div v-if="confirmationFermeture" class="confirmation avertissement" data-confirmation-fermeture>
        <p>Vos changements ne seront pas gardés si vous fermez maintenant.</p>
        <div class="actions">
          <button
            type="button"
            class="secondaire"
            data-confirmer-fermeture
            @click="emit('fermer')"
          >
            Fermer sans garder
          </button>
          <!-- le geste sûr est celui qui saute aux yeux : on ferme par accident, on ne
               continue pas à modifier par accident -->
          <button
            type="button"
            class="principale"
            data-annuler-fermeture
            @click="confirmationFermeture = false"
          >
            Continuer à modifier
          </button>
        </div>
      </div>

      <div class="colonnes">
      <section class="colonne">
      <h3>Ce que l'enfant voit</h3>
      <label class="champ">
        Le mot écrit sur la case
        <input v-model="label" type="text" :maxlength="LONGUEUR_MOT_MAXIMALE" data-champ-label />
      </label>
      <p v-if="erreurLabel" class="erreur" data-erreur-label>{{ erreurLabel }}</p>

      <!-- Même forme que la voix : une question, deux réponses, et celle qui vaut se lit
           sans rien toucher. Les pictogrammes livrés sont des images posées d'avance, pas
           une catégorie que le parent aurait à distinguer. -->
      <fieldset class="voix">
        <legend>Que montre cette case ?</legend>

        <div class="option">
          <input
            id="image-oui"
            v-model="imageChoisie"
            type="radio"
            value="image"
            :disabled="!imageDisponible"
            data-image="image"
          />
          <label for="image-oui">Une image</label>
          <div class="detail">
            <!-- On montre la photo, on ne se contente pas de dire qu'il y en a une : un
                 parent qui ne voit pas ce qu'il a posé la reprend pour rien. -->
            <div v-if="urlApercuNouvellePhoto" class="apercu-photo">
              <img :src="urlApercuNouvellePhoto" alt="" data-apercu-photo />
            </div>
            <div
              v-else-if="caseApresEnregistrement?.image_id"
              class="apercu-photo"
              data-image-actuelle
            >
              <VignetteCase :contenu="caseApresEnregistrement" />
            </div>
            <div class="boutons-fichier">
              <label class="bouton-fichier">
                Prendre une photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  class="entree-fichier-cachee"
                  data-champ-photo-appareil
                  @change="surChoixPhoto"
                />
              </label>
              <label class="bouton-fichier">
                Choisir une photo
                <input
                  type="file"
                  accept="image/*"
                  class="entree-fichier-cachee"
                  data-champ-photo-galerie
                  @change="surChoixPhoto"
                />
              </label>
            </div>
          </div>
        </div>

        <div class="option">
          <input
            id="image-non"
            v-model="imageChoisie"
            type="radio"
            value="aucune"
            data-image="aucune"
          />
          <label for="image-non">Le mot en grand, sans image</label>
        </div>

        <p v-if="erreurPhoto" class="erreur" data-erreur-photo>{{ erreurPhoto }}</p>
      </fieldset>

      <fieldset class="palette">
        <legend>Couleur de la case</legend>
        <!-- Une ligne de pastilles à la forme des cases plutôt qu'une liste de huit lignes :
             le parent choisit sur la couleur, pas sur le nom, et le panneau tenait sinon sur
             deux écrans de tablette. Le nom de la famille choisie reste écrit dessous. -->
        <div class="rangee-couleurs">
          <label v-for="famille in PALETTE" :key="famille.nom" class="famille">
            <input
              v-model="familleChoisie"
              type="radio"
              name="famille"
              :value="famille.nom"
              :aria-label="famille.nom"
              :data-famille="famille.nom"
            />
            <span
              class="pastille"
              :style="{ background: famille.fond, borderColor: famille.anneau }"
              aria-hidden="true"
            ></span>
          </label>
        </div>
        <p class="famille-choisie" data-famille-choisie>{{ familleChoisie }}</p>
      </fieldset>
      </section>

      <section class="colonne">
      <h3>Ce que l'enfant entend</h3>
      <label class="champ">
        Le texte affiché en haut de l'écran
        <input v-model="vocalization" type="text" data-champ-vocalization />
      </label>
      <p v-if="erreurVocalization" class="erreur" data-erreur-vocalization>{{ erreurVocalization }}</p>

      <!-- Une seule question, et sa réponse se lit sans rien toucher. Trois boutons gris de
           même poids ne disaient jamais quelle voix parlait aujourd'hui. -->
      <fieldset class="voix">
        <legend>Qui parle pour ce mot ?</legend>

        <div class="option">
          <input
            id="voix-enregistree"
            v-model="voixChoisie"
            type="radio"
            value="enregistree"
            :disabled="!voixEnregistreeDisponible"
            data-voix="enregistree"
          />
          <label for="voix-enregistree">Une voix enregistrée</label>
          <div class="detail">
            <!-- On fait entendre, on ne se contente pas de dire qu'il y a un son : un parent
                 qui ne peut pas écouter ce que la tablette dira le réenregistre pour rien. -->
            <audio
              v-if="etatEnregistreur === 'ecoute'"
              controls
              :src="urlEcouteSon!"
              data-lecture-son
            ></audio>
            <audio
              v-else-if="voixChoisie === 'enregistree' && urlSonActuel"
              controls
              :src="urlSonActuel"
              data-lecture-son-actuel
            ></audio>
            <button
              v-if="etatEnregistreur === 'ecoute'"
              type="button"
              class="secondaire"
              data-recommencer-son
              @click="recommencerEnregistrement"
            >
              Recommencer
            </button>
            <template v-else>
              <button
                type="button"
                class="secondaire"
                data-bouton-enregistrer-son
                @click="surBoutonEnregistrer"
              >
                {{ etatEnregistreur === 'enregistrement' ? "Arrêter l'enregistrement" : 'Enregistrer au micro' }}
              </button>
              <label v-if="etatEnregistreur === 'repos'" class="bouton-fichier">
                Choisir un fichier
                <input
                  type="file"
                  accept="audio/*"
                  class="entree-fichier-cachee"
                  data-champ-son-fichier
                  @change="surChoixSon"
                />
              </label>
            </template>
          </div>
        </div>

        <div class="option">
          <input
            id="voix-texte"
            v-model="voixChoisie"
            type="radio"
            value="texte"
            data-voix="texte"
          />
          <label for="voix-texte">La tablette lit le texte</label>
          <div v-if="litLeTexte" class="detail">
            <!-- Une voix de synthèse ne se juge pas sur sa description : on la fait entendre. -->
            <button
              v-if="syntheseDisponible()"
              type="button"
              class="secondaire"
              data-ecouter-texte
              @click="ecouterLeTexte"
            >
              Écouter
            </button>
            <p v-else class="aide coude" data-sans-synthese>
              Cet appareil ne sait pas lire un texte. Enregistrez votre voix pour ce mot.
            </p>
          </div>
        </div>

        <p v-if="litLeTexte && syntheseDisponible()" class="aide" data-voix-tablette>
          La tablette lira le texte avec sa propre voix.
        </p>
        <p v-if="texteChangeSansVoix" class="aide coude" data-texte-sans-voix>
          Vous avez changé le texte, mais c'est toujours cet enregistrement que la tablette
          dira. Enregistrez votre voix, ou faites-lui lire le texte.
        </p>
        <p v-if="erreurSon" class="erreur" data-erreur-son>{{ erreurSon }}</p>
      </fieldset>

      </section>
      </div>

      <details class="repli">
        <summary>Enchaîner ce mot avec un autre</summary>
        <label class="champ">
          Le mot utilisé pour enchaîner deux cases
          <input v-model="extMesmotsEnchaine" type="text" data-champ-enchainement />
        </label>
        <p class="aide">
          Sert à empiler plusieurs mots dans une phrase plus tard, sans avoir à tout ressaisir.
        </p>
      </details>



      <div class="actions">
        <button type="button" class="principale" data-enregistrer-case @click="enregistrer">
          Enregistrer
        </button>
      </div>

      <div v-if="props.caseExistante" class="zone-suppression">
        <button
          v-if="!confirmationSuppression"
          type="button"
          class="supprimer"
          data-demander-suppression
          @click="confirmationSuppression = true"
        >
          Supprimer cette case
        </button>
        <div v-else class="confirmation" data-confirmation-suppression>
          <p>
            {{ props.caseExistante.label }} sera supprimée. Son emplacement restera vide et
            aucune autre case ne bougera.
          </p>
          <div class="actions">
            <button
              type="button"
              class="secondaire"
              data-annuler-demande-suppression
              @click="confirmationSuppression = false"
            >
              Annuler
            </button>
            <button
              type="button"
              class="supprimer"
              data-confirmer-suppression
              @click="emit('supprimer')"
            >
              Confirmer la suppression
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Registre sobre de l'espace parents, pas celui de l'enfant : fond plein, pas de dégradé de ciel. */
.editeur-case {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(18, 48, 79, 0.75);
  /* c'est le panneau qui défile, pas le voile : sinon la barre d'action se collait au bas
     de la fenêtre et traversait le formulaire en son milieu, coupant en deux la palette de
     couleurs ou le choix de la photo selon la taille de l'écran */
  overflow: hidden;
}

.panneau {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(760px, 100%);
  max-height: 100%;
  overflow: auto;
  padding: 20px;
  border-radius: 12px;
  background: #eef1f4;
  color: var(--encre);
  font-family: system-ui, sans-serif;
}

.panneau h2 {
  margin: 0;
  font-size: 1.2rem;
}

.entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fermer {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--encre);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}

.fermer:hover {
  background: #dfe5ea;
}

.colonnes {
  display: grid;
  gap: 12px 20px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

/* Deux questions, pas six champs de même poids : ce que l'enfant voit, ce qu'il entend. */
.colonne h3 {
  margin: 0;
  font-size: 1.05rem;
}

.repli {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #c7ccd1;
  border-radius: 8px;
  padding: 8px 10px;
}

.repli summary {
  min-height: 32px;
  padding: 6px 0;
  font-weight: 600;
  cursor: pointer;
}

.repli .champ {
  margin-top: 8px;
}

.colonne {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.champ {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.95rem;
  font-weight: 600;
}

.champ input[type='text'] {
  min-height: 48px;
  padding: 8px 12px;
  border: 2px solid #c7ccd1;
  border-radius: 8px;
  font-size: 1rem;
  touch-action: manipulation;
}

.erreur {
  margin: 6px 0 0;
  color: #b3261e;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Une marge négative posait la ligne d'aide sur la bordure du champ au-dessus. Elle garde
   ses distances, y compris là où le conteneur n'espace pas, comme dans le repli. */
.aide {
  margin: 6px 0 0;
  color: #4b5563;
  font-size: 0.85rem;
}

.aide.coude {
  color: var(--encre);
  font-weight: 600;
}

.champ-media {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid #c7ccd1;
  border-radius: 8px;
}

.etiquette-champ {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.rangee-photo {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.apercu-photo {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  border: 2px solid #c7ccd1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--blanc);
}

.apercu-photo img,
.apercu-photo :deep(.vignette) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}


.boutons-fichier {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.bouton-fichier {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #dfe4e9;
  color: var(--encre);
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  touch-action: manipulation;
}

/* Ni display:none ni visibility:hidden : sur Safari un champ ainsi masqué n'ouvre alors ni
   la galerie ni l'appareil photo. Il reste dans le document, rendu invisible autrement. */
.entree-fichier-cachee {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  overflow: hidden;
}

.voix {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 10px;
  border: 1px solid #c7ccd1;
  border-radius: 8px;
}

.voix legend {
  padding: 0 4px;
  font-size: 0.95rem;
  font-weight: 600;
}

/* La réponse choisie se voit d'un coup d'œil : c'est ce qui manquait quand trois boutons
   gris de même poids proposaient trois voix sans dire laquelle parlait. */
.option {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px 10px;
  min-height: 48px;
  padding: 8px 10px;
  border: 2px solid #c7ccd1;
  border-radius: 8px;
  background: #f7f9fb;
}

.option:has(input:checked) {
  border-color: var(--encre);
  background: var(--blanc);
}

.option input[type='radio'] {
  width: 22px;
  height: 22px;
  accent-color: var(--encre);
}

.option label {
  font-size: 1rem;
  font-weight: 600;
}

.option input:disabled + label {
  color: #6b7280;
  font-weight: 400;
}

.option .detail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  grid-column: 1 / -1;
}

.option .detail audio {
  width: 100%;
}


.boutons-son {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ecoute-son {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ecoute-son audio {
  flex: 1;
  min-height: 40px;
}

.palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 10px;
  border: 1px solid #c7ccd1;
  border-radius: 8px;
}

.rangee-couleurs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.famille-choisie {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.palette legend {
  padding: 0 4px;
  font-size: 0.95rem;
  font-weight: 600;
}

.famille {
  display: grid;
  place-items: center;
  min-height: 48px;
  touch-action: manipulation;
}

.famille input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

/* Anneau épais, et non trois pixels : « Oui » partage son fond avec « Actions » et « Non »
   avec « Personnes », seul l'anneau les sépare. Trop fin, deux options paraissaient
   identiques et le parent ne pouvait pas choisir. */
.pastille {
  width: 56px;
  height: 44px;
  border: 7px solid;
  border-radius: 10px;
}

.famille input:checked + .pastille {
  outline: 3px solid var(--encre);
  outline-offset: 3px;
}

.famille input:focus-visible + .pastille {
  outline: 3px dashed var(--encre);
  outline-offset: 3px;
}

/* Collée au bas du panneau : « Enregistrer » se trouvait à trois cents pixels sous le pli
   sur un téléphone, il fallait dérouler une fenêtre et demie pour valider un mot. Les
   marges négatives la font courir d'un bord à l'autre du panneau, et l'ombre la détache du
   formulaire qui défile derrière, pour qu'elle se lise comme une barre posée dessus. */
.actions {
  position: sticky;
  bottom: -20px;
  z-index: 1;
  display: flex;
  gap: 10px;
  margin: 0 -20px -20px;
  padding: 12px 20px;
  background: #eef1f4;
  box-shadow: 0 -8px 16px rgba(238, 241, 244, 0.95);
}

button {
  min-height: 48px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.principale {
  flex: 1;
  background: var(--encre);
  color: var(--blanc);
}

.secondaire {
  flex: 1;
  background: #dfe4e9;
  color: var(--encre);
}

.zone-suppression {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #c7ccd1;
}

.supprimer {
  width: 100%;
  background: #b3261e;
  color: var(--blanc);
}

.zone-suppression > .supprimer {
  background: transparent;
  border: 2px solid #8c1d18;
  color: #8c1d18;
}

.confirmation p {
  margin: 0 0 10px;
  font-size: 0.95rem;
}

/* Encadré, sinon l'avertissement se lit comme la première ligne du formulaire. */
.avertissement {
  padding: 12px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
}
</style>
