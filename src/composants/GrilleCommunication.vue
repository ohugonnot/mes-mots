<script setup lang="ts">
import { computed } from 'vue'
import CaseCommunication from './CaseCommunication.vue'
import { caseParIdentifiant, type Planche } from '../domaine/planche'

const props = defineProps<{ planche: Planche; repere?: string; idCaseQuiParle?: string | null }>()
const emit = defineEmits<{ appuiSurCase: [id: string, debutMs: number, finMs: number] }>()

/**
 * On parcourt la matrice de positions, jamais la liste des cases : c'est ce qui garantit
 * qu'ajouter ou masquer une case ne déplace aucune autre.
 */
const emplacements = computed(() =>
  props.planche.grid.order.flatMap((ligne, indexLigne) =>
    ligne.map((id, indexColonne) => ({
      cle: `${indexLigne}-${indexColonne}`,
      contenu: id === null ? null : (caseParIdentifiant(props.planche, id) ?? null),
    })),
  ),
)
</script>

<template>
  <div
    class="grille"
    :style="{ '--colonnes': props.planche.grid.columns, '--lignes': props.planche.grid.rows }"
    :data-grille="props.repere ?? 'contexte'"
  >
    <template v-for="emplacement in emplacements" :key="emplacement.cle">
      <CaseCommunication
        v-if="emplacement.contenu && !emplacement.contenu.hidden"
        :contenu="emplacement.contenu"
        :parle="props.idCaseQuiParle === emplacement.contenu.id"
        @appui="(debut, fin) => emit('appuiSurCase', emplacement.contenu!.id, debut, fin)"
      />
      <div v-else class="emplacement-libre" aria-hidden="true"></div>
    </template>
  </div>
</template>

<style scoped>
.grille {
  display: grid;
  /* nombre de colonnes imposé par la planche : il ne dépend jamais de la largeur d'écran,
     sinon les cases changeraient de place en tournant la tablette */
  /* pistes en 1fr sans taille plancher : la grille rétrécit en bloc sur un écran plus
     petit que la tablette. Une case trop petite reste utilisable, une case hors écran est
     perdue, et l'enfant perdait « NON » en 1024x600 */
  grid-template-columns: repeat(var(--colonnes), 1fr);
  grid-template-rows: repeat(var(--lignes), 1fr);
  gap: var(--case-espacement);
  padding: var(--case-espacement);
  height: 100%;
  /* Pas de `overflow: hidden` : une ombre ne crée jamais de défilement, et masquer ici
     coupait le halo des cases de la première et de la dernière rangée. Le défilement reste
     impossible parce que la grille tient exactement dans sa zone, jamais par ce masquage. */
}

.emplacement-libre {
  visibility: hidden;
}
</style>
