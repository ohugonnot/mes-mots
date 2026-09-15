<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  inventaireActuel,
  lireArchive,
  mediasPersonnalisesManquants,
  type Inventaire,
} from '../domaine/archive'
import { fusionnerContextes, marquerSauvegardee, type Configuration } from '../domaine/planche'

const props = defineProps<{ configuration: Configuration }>()
const emit = defineEmits<{
  restaurer: [configuration: Configuration, ressourcesPersonnalisees: Map<string, Uint8Array>]
  ajouterPlanches: [configuration: Configuration, ressourcesPersonnalisees: Map<string, Uint8Array>]
}>()

const champFichier = ref<HTMLInputElement | null>(null)
const apercu = ref<{
  configuration: Configuration
  inventaire: Inventaire
  ressources: Map<string, Uint8Array>
} | null>(null)
const erreur = ref<string | null>(null)

const actuel = computed(() => inventaireActuel(props.configuration))

const manquants = computed(() =>
  apercu.value
    ? mediasPersonnalisesManquants(apercu.value.configuration, apercu.value.ressources)
    : { images: 0, sons: 0 },
)

/** « 1 photo », « 3 photos » : le compte se lit mieux que « 3 photo(s) ». */
function compte(nombre: number, singulier: string, pluriel: string): string {
  return `${nombre} ${nombre > 1 ? pluriel : singulier}`
}

const phraseManquants = computed(() => {
  const { images, sons } = manquants.value
  const morceaux = [
    images > 0 ? compte(images, 'photo', 'photos') : '',
    sons > 0 ? compte(sons, 'voix enregistrée', 'voix enregistrées') : '',
  ].filter(Boolean)
  return morceaux.join(' et ')
})

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
function formaterDate(dateIso: string): string {
  return FORMAT_DATE.format(new Date(dateIso))
}

function declencherSelection() {
  champFichier.value?.click()
}

async function surFichierChoisi(evenement: Event) {
  const champ = evenement.target as HTMLInputElement
  const fichier = champ.files?.[0]
  // sinon choisir deux fois le même fichier ne redéclencherait pas l'événement
  champ.value = ''
  if (!fichier) return

  erreur.value = null
  apercu.value = null
  try {
    const octets = new Uint8Array(await fichier.arrayBuffer())
    const lue = lireArchive(octets)
    apercu.value = { configuration: lue.configuration, inventaire: lue.inventaire, ressources: lue.ressources }
  } catch (cause) {
    erreur.value = cause instanceof Error ? cause.message : "Ce fichier n'a pas pu être lu."
  }
}

function annuler() {
  apercu.value = null
}

function confirmerRemplacement() {
  if (!apercu.value) return
  emit('restaurer', marquerSauvegardee(apercu.value.configuration), apercu.value.ressources)
  apercu.value = null
}

/**
 * Ce que l'ajout donnerait, calculé avant d'agir : le parent doit savoir ce qui entre et ce
 * qui reste dehors. Un contexte dont l'identifiant est déjà pris n'entre pas, sinon deux
 * mots partageraient une photo et une voix.
 */
const fusion = computed(() =>
  apercu.value ? fusionnerContextes(props.configuration, apercu.value.configuration) : null,
)

function confirmerAjout() {
  if (!apercu.value) return
  emit('ajouterPlanches', apercu.value.configuration, apercu.value.ressources)
  apercu.value = null
}
</script>

<template>
  <div class="panneau-restauration">
    <button type="button" class="declencheur" data-restaurer @click="declencherSelection">
      Restaurer une sauvegarde
    </button>
    <input
      ref="champFichier"
      type="file"
      accept=".obz"
      hidden
      data-fichier-restauration
      @change="surFichierChoisi"
    />

    <p v-if="erreur" class="erreur" data-erreur-restauration>{{ erreur }}</p>

    <div v-if="apercu" class="voile" data-apercu-restauration>
      <div class="panneau">
        <h2>Remplacer la configuration de la tablette ?</h2>

        <div class="comparaison">
          <section>
            <h3>Cette sauvegarde</h3>
            <p data-apercu-sauvegarde-date>{{ formaterDate(apercu.inventaire.date) }}</p>
            <ul>
              <li data-apercu-sauvegarde-contextes>{{ apercu.inventaire.contextes }} contextes</li>
              <li data-apercu-sauvegarde-pages>{{ apercu.inventaire.pages }} pages</li>
              <li data-apercu-sauvegarde-mots>
                <span data-apercu-sauvegarde-mots-visibles>{{ apercu.inventaire.casesRevelees }}</span> mots
                visibles sur <span data-apercu-sauvegarde-mots-total>{{ apercu.inventaire.cases }}</span>
              </li>
              <li data-apercu-sauvegarde-images>{{ apercu.inventaire.images }} images</li>
              <li data-apercu-sauvegarde-sons>{{ apercu.inventaire.sons }} sons</li>
            </ul>
          </section>

          <section>
            <h3>Sur la tablette maintenant</h3>
            <ul>
              <li data-apercu-actuel-contextes>{{ actuel.contextes }} contextes</li>
              <li data-apercu-actuel-pages>{{ actuel.pages }} pages</li>
              <li data-apercu-actuel-mots>
                <span data-apercu-actuel-mots-visibles>{{ actuel.casesRevelees }}</span> mots visibles sur
                <span data-apercu-actuel-mots-total>{{ actuel.cases }}</span>
              </li>
              <li data-apercu-actuel-images>{{ actuel.images }} images</li>
              <li data-apercu-actuel-sons>{{ actuel.sons }} sons</li>
            </ul>
          </section>
        </div>

        <p v-if="phraseManquants" class="avertissement" data-medias-manquants>
          Ce fichier ne contient pas {{ phraseManquants }} que la sauvegarde réclame. Les mots
          concernés retrouveront le dessin et la voix livrés avec l'application.
        </p>

        <p v-if="fusion?.ajoutes.length" class="note" data-ajout-possible>
          Ajouter posera
          {{ fusion.ajoutes.map((contexte) => contexte.name).join(', ') }}
          à la suite de vos contextes, sans rien changer d'autre.
        </p>
        <!-- Cet avertissement ne parle que du bouton « Ajouter » : sans le `v-if` sur les
             ajouts possibles, il s'affichait aussi quand seul « Remplacer tout » est offert,
             en rouge et en gras, et disait d'un fichier parfaitement restaurable qu'il « ne
             peut pas être ajouté ». On lisait « ne peut pas », et on annulait. -->
        <p v-if="fusion?.ajoutes.length && fusion.refuses.length" class="avertissement" data-ajout-refuse>
          En revanche, {{ fusion.refuses.join(', ') }} ne sera pas ajouté : vous avez déjà un
          contexte ou un mot du même nom, ou vous êtes au maximum de cinq contextes.
        </p>

        <p class="note">Remplacer effacera la configuration actuelle et la remplacera par celle-ci.</p>

        <div class="actions">
          <button type="button" class="secondaire" data-annuler-restauration @click="annuler">
            Annuler
          </button>
          <button
            v-if="fusion?.ajoutes.length"
            type="button"
            class="principale"
            data-confirmer-ajout
            @click="confirmerAjout"
          >
            Ajouter sans rien effacer
          </button>
          <!-- Rouge quelle que soit la branche : c'est le seul geste de la fenêtre qui perd
               ce qui est en place, et le parent doit le reconnaître avant de le toucher. -->
          <button
            type="button"
            class="remplacer"
            data-confirmer-restauration
            @click="confirmerRemplacement"
          >
            Remplacer tout
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button {
  min-height: 48px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.erreur {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fbe4e1;
  color: #7a271f;
  font-size: 0.9rem;
  font-weight: 600;
}

.voile {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(18, 48, 79, 0.75);
  overflow: auto;
}

.panneau {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(520px, 100%);
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

.comparaison {
  display: flex;
  gap: 16px;
}

.comparaison section {
  flex: 1;
  min-width: 0;
}

.comparaison h3 {
  margin: 0 0 4px;
  font-size: 0.95rem;
}

.comparaison ul {
  margin: 0;
  padding-left: 18px;
  font-size: 0.9rem;
}

.avertissement {
  margin: 0;
  padding: 10px 12px;
  border: 2px solid #b3261e;
  border-radius: 8px;
  color: #8c1d18;
  font-weight: 600;
}

.note {
  margin: 0;
  font-size: 0.85rem;
  color: #4b5563;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

/* Contour et non lien souligné : restaurer remplace tout ce que la famille a construit,
   un geste de ce poids ne se présente pas comme une note de bas de page. */
.declencheur {
  border: 2px solid var(--encre);
  background: var(--blanc);
  color: var(--encre);
}

.principale {
  flex: 1;
  background: var(--encre);
  color: var(--blanc);
}

/* Contour plutôt que gris plein : le gris ressemblait à un bouton désactivé. */
.secondaire {
  flex: 1;
  border: 2px solid var(--encre);
  background: var(--blanc);
  color: var(--encre);
}

/* Le seul rouge de la fenêtre : c'est la branche qui efface la configuration en place. */
.remplacer {
  flex: 1;
  border: 2px solid #8c1d18;
  background: #b3261e;
  color: var(--blanc);
}
</style>
