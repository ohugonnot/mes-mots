<script setup lang="ts">
import { computed, ref } from 'vue'
import { inventaireActuel } from '../domaine/archive'
import { effectuerSauvegarde } from '../domaine/sauvegarde'
import type { Configuration } from '../domaine/planche'

const props = defineProps<{ configuration: Configuration }>()
const emit = defineEmits<{ sauvegarder: [configuration: Configuration]; plusTard: [] }>()

const enCours = ref(false)
const nombreDeMots = computed(() => inventaireActuel(props.configuration).cases)

async function surCliqueSauvegarder() {
  enCours.value = true
  const { configurationSauvegardee } = await effectuerSauvegarde(props.configuration)
  emit('sauvegarder', configurationSauvegardee)
}
</script>

<template>
  <div class="rappel-sauvegarde" data-rappel-sauvegarde>
    <div class="panneau">
      <h2>Pensez à sauvegarder</h2>
      <p data-rappel-texte>
        La tablette contient {{ nombreDeMots }} mots, et rien n'a été sauvegardé depuis les
        derniers changements. Sans fichier de sauvegarde, ils peuvent être perdus.
      </p>
      <div class="actions">
        <button type="button" class="secondaire" data-plus-tard @click="emit('plusTard')">
          Plus tard
        </button>
        <button
          type="button"
          class="principale"
          data-sauvegarder-rappel
          :disabled="enCours"
          @click="surCliqueSauvegarder"
        >
          {{ enCours ? 'Sauvegarde en cours…' : 'Enregistrer une sauvegarde' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Même registre que la question du coin parents (VerrouParents.vue) : plein écran, sobre,
   impossible à manquer. */
.rappel-sauvegarde {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(18, 48, 79, 0.94);
}

.panneau {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(420px, 100%);
  padding: 24px;
  border-radius: 12px;
  background: #eef1f4;
  color: var(--encre);
  font-family: system-ui, sans-serif;
  text-align: center;
}

.panneau h2 {
  margin: 0;
  font-size: 1.3rem;
}

.panneau p {
  margin: 0;
  font-size: 0.95rem;
}

.actions {
  display: flex;
  gap: 10px;
}

button {
  flex: 1;
  min-height: 48px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.principale {
  background: var(--encre);
  color: var(--blanc);
}

.principale:disabled {
  opacity: 0.6;
  cursor: default;
}

/* Contour plutôt que gris plein : le gris ressemblait à un bouton désactivé. */
.secondaire {
  border: 2px solid var(--encre);
  background: var(--blanc);
  color: var(--encre);
}
</style>
