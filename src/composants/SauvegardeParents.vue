<script setup lang="ts">
import { formaterTaille } from '../domaine/taille'
import { ref } from 'vue'
import { effectuerSauvegarde } from '../domaine/sauvegarde'
import type { Inventaire } from '../domaine/archive'
import type { Configuration } from '../domaine/planche'

const props = defineProps<{ configuration: Configuration }>()
const emit = defineEmits<{ sauvegarder: [configuration: Configuration] }>()

const enCours = ref(false)
const compteRendu = ref<{ inventaire: Inventaire; ressourcesManquantes: string[]; nomFichier: string } | null>(null)

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

function formaterDate(dateIso: string): string {
  return FORMAT_DATE.format(new Date(dateIso))
}


async function surCliqueSauvegarder() {
  enCours.value = true
  const { configurationSauvegardee, inventaire, ressourcesManquantes, nomFichier } =
    await effectuerSauvegarde(props.configuration)
  compteRendu.value = { inventaire, ressourcesManquantes, nomFichier }
  enCours.value = false
  emit('sauvegarder', configurationSauvegardee)
}
</script>

<template>
  <div class="panneau-sauvegarde">
    <button type="button" data-sauvegarder :disabled="enCours" @click="surCliqueSauvegarder">
      {{ enCours ? 'Sauvegarde en cours…' : 'Enregistrer une sauvegarde' }}
    </button>

    <div v-if="compteRendu" class="voile" data-compte-rendu-sauvegarde>
      <div class="panneau">
        <h2>Sauvegarde enregistrée</h2>
        <!-- Le nom du fichier d'abord : c'est ce qu'il faut retrouver dans les
             téléchargements, et le compte rendu ne le disait pas. -->
        <p class="nom-fichier" data-cr-nom-fichier>{{ compteRendu.nomFichier }}</p>
        <p data-cr-date>Téléchargé le {{ formaterDate(compteRendu.inventaire.date) }}.</p>
        <!-- La consigne qui compte vraiment, et que la notice appelle le point capital :
             une copie posée sur la tablette ne protège de rien. -->
        <p class="consigne" data-cr-consigne>
          Mettez ce fichier ailleurs que sur la tablette : envoyez-le-vous par courriel, ou
          copiez-le sur un ordinateur ou une clé. Une sauvegarde restée sur l'appareil
          disparaît avec lui.
        </p>
        <ul class="chiffres">
          <li data-cr-contextes>{{ compteRendu.inventaire.contextes }} contextes</li>
          <li data-cr-pages>{{ compteRendu.inventaire.pages }} pages</li>
          <li data-cr-mots>
            <span data-cr-mots-visibles>{{ compteRendu.inventaire.casesRevelees }}</span> mots visibles sur
            <span data-cr-mots-total>{{ compteRendu.inventaire.cases }}</span> au total
          </li>
          <li data-cr-images>{{ compteRendu.inventaire.images }} images</li>
          <li data-cr-sons>{{ compteRendu.inventaire.sons }} sons</li>
          <li data-cr-taille>{{ formaterTaille(compteRendu.inventaire.octets) }}</li>
        </ul>
        <p v-if="compteRendu.ressourcesManquantes.length" class="avertissement" data-ressources-manquantes>
          {{ compteRendu.ressourcesManquantes.length }} image(s) ou son(s) n'ont pas pu être inclus : la
          sauvegarde est partielle.
        </p>
        <button type="button" class="principale" data-fermer-compte-rendu @click="compteRendu = null">
          Fermer
        </button>
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
  background: var(--encre);
  color: var(--blanc);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

/* Même registre que EditeurCase.vue : un voile plein écran, sobre, pour l'espace parents. */
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
  width: min(420px, 100%);
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

.panneau p {
  margin: 0;
}

/* Le nom du fichier se lit d'un coup d'œil : c'est ce qu'elle cherchera dans une liste de
   téléchargements, un jour où la tablette ne s'allume plus. */
.nom-fichier {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--blanc);
  font-family: ui-monospace, monospace;
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.consigne {
  margin: 0;
  padding: 10px 12px;
  border-left: 4px solid var(--encre);
  background: #fff3cd;
  font-weight: 600;
}

.chiffres {
  margin: 0;
  padding-left: 20px;
  font-size: 0.95rem;
}

.avertissement {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff3cd;
  font-size: 0.9rem;
  font-weight: 600;
}

.principale {
  margin-top: 8px;
}
</style>
