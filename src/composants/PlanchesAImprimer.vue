<script setup lang="ts">
import { computed } from 'vue'
import VignetteCase from './VignetteCase.vue'
import { caseParIdentifiant, type Configuration, type Planche } from '../domaine/planche'

/**
 * La grille sur papier (D20). Batterie vide, tablette oubliée ou cassée : la parade
 * classique en communication alternative est une grille imprimée et plastifiée dans le sac.
 *
 * Monté avec la page et non au clic, invisible à l'écran : les photos de la famille sont
 * des URL de blob, qui ne s'impriment que si l'image est déjà dans le document au moment
 * où le navigateur prépare les pages.
 */
const props = defineProps<{ configuration: Configuration }>()

/**
 * Une planche par page, dans l'ordre de l'enfant, la barre des mots essentiels en dernier.
 * Une planche dont aucun mot n'est révélé ne sort pas : elle donnerait une feuille de
 * cases vides, et l'enfant ne la voit pas non plus sur sa tablette.
 */
const planches = computed(() =>
  [
    ...props.configuration.contextes.flatMap((contexte) =>
      contexte.pages.map((page, rang) => ({
        planche: page,
        titre: contexte.pages.length > 1 ? `${contexte.name} — page ${rang + 1}` : contexte.name,
      })),
    ),
    { planche: props.configuration.barre, titre: 'Mots essentiels' },
  ].filter(({ planche }) => planche.buttons.some((contenu) => !contenu.hidden)),
)

/**
 * Le papier est le miroir exact de l'écran : les mots masqués laissent leur emplacement
 * vide, comme sur la tablette. Sinon l'enfant chercherait sur la table un mot qu'il ne voit
 * pas sur son écran, et la position, qui est tout l'intérêt, ne correspondrait plus.
 */
function emplacementsDe(planche: Planche) {
  return planche.grid.order.flatMap((ligne, indexLigne) =>
    ligne.map((id, indexColonne) => {
      const contenu = id === null ? null : (caseParIdentifiant(planche, id) ?? null)
      return {
        cle: `${indexLigne}-${indexColonne}`,
        contenu: contenu && !contenu.hidden ? contenu : null,
      }
    }),
  )
}
</script>

<template>
  <div class="planches-papier" data-planches-papier aria-hidden="true">
    <section
      v-for="(page, rang) in planches"
      :key="`${page.planche.id}-${rang}`"
      class="feuille"
      data-feuille
    >
      <h2>{{ page.titre }}</h2>
      <div
        class="grille-papier"
        :data-grille-papier="page.planche.id"
        :style="{ '--colonnes': page.planche.grid.columns, '--lignes': page.planche.grid.rows }"
      >
        <div
          v-for="emplacement in emplacementsDe(page.planche)"
          :key="emplacement.cle"
          class="case-papier"
          :class="{ vide: !emplacement.contenu }"
          :style="
            emplacement.contenu
              ? {
                  '--fond-etiquette': emplacement.contenu.background_color ?? '#e8eef4',
                  '--anneau': emplacement.contenu.border_color ?? '#94a3b8',
                }
              : undefined
          "
          :data-case-papier="emplacement.contenu?.id"
        >
          <template v-if="emplacement.contenu">
            <span class="dessin"><VignetteCase :contenu="emplacement.contenu" /></span>
            <span class="mot">{{ emplacement.contenu.label }}</span>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Rien à l'écran : ce bloc n'existe que pour l'imprimante. Il reste dans le document, avec
   ses images déjà chargées, parce qu'un blob monté au moment du clic n'aurait pas le temps
   d'être peint avant que le navigateur ne compose les pages. */
.planches-papier {
  display: none;
}

@media print {
  .planches-papier {
    display: block;
    background: #fff;
  }

  .feuille {
    /* une planche par feuille : deux grilles sur la même page se confondent */
    break-after: page;
    font-family: system-ui, sans-serif;
    color: #12304f;
  }

  .feuille:last-child {
    break-after: auto;
  }

  .feuille h2 {
    margin: 0 0 6mm;
    font-size: 14pt;
  }

  .grille-papier {
    display: grid;
    grid-template-columns: repeat(var(--colonnes), 1fr);
    grid-template-rows: repeat(var(--lignes), 1fr);
    gap: 3mm;
    height: 235mm;
  }

  .case-papier {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Un liseré épais et non un fond : les couleurs de fond ne s'impriment pas toujours,
       alors qu'une bordure, elle, s'imprime toujours. La famille du mot survit donc même
       sur une imprimante qui refuse les aplats. */
    border: 1.2mm solid var(--anneau);
    border-radius: 3mm;
  }

  .case-papier.vide {
    border-style: dashed;
    border-color: #c7ccd1;
  }

  .dessin {
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    padding: 2mm;
  }

  .mot {
    padding: 1.5mm;
    background: var(--fond-etiquette);
    /* la seule façon d'obtenir la bande colorée sur Chrome et Safari */
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    font-size: 11pt;
    font-weight: 600;
    text-align: center;
  }
}
</style>
