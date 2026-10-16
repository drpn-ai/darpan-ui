<template>
  <div class="lifecycle-board" :class="{ 'lifecycle-board--narrow': narrow }" data-testid="lifecycle-board">
    <div v-if="board.start" class="lifecycle-row">
      <div class="lifecycle-stage lifecycle-stage--start" data-testid="lifecycle-start">
        <span class="lifecycle-stage-label">{{ board.start.label }}</span>
        <span v-if="board.start.count !== null" class="lifecycle-count">{{ format(board.start.count) }}</span>
      </div>
    </div>

    <div v-for="stage in board.stages" :key="stage.questionId" class="lifecycle-row">
      <div class="lifecycle-stage" :data-testid="`lifecycle-stage-${stage.questionId}`">
        <span class="lifecycle-stage-label">{{ stage.label }}</span>
        <span v-if="stage.count !== null" class="lifecycle-count">{{ format(stage.count) }}</span>
      </div>
      <div class="lifecycle-places">
        <component
          :is="openable(place) ? 'button' : 'div'"
          v-for="place in stage.places"
          :key="`${place.questionId}-${place.branch}`"
          :type="openable(place) ? 'button' : undefined"
          class="lifecycle-place"
          :class="{
            'lifecycle-place--held': (place.count ?? 0) > 0,
            'lifecycle-place--empty': place.count === 0,
            'lifecycle-place--open': openable(place),
          }"
          :data-testid="`lifecycle-place-${place.questionId}-${place.branch}`"
          @click="openable(place) && emit('open', place)"
        >
          <span class="lifecycle-place-label">{{ place.label }}</span>
          <span class="lifecycle-count">{{ place.count === null ? '' : format(place.count) }}</span>
          <span v-if="place.count !== null && board.largest > 0" class="lifecycle-meter" aria-hidden="true">
            <i :style="{ width: `${Math.round(((place.count ?? 0) / board.largest) * 100)}%` }" />
          </span>
        </component>
      </div>
    </div>

    <div v-if="board.complete" class="lifecycle-row">
      <div class="lifecycle-stage lifecycle-stage--complete" data-testid="lifecycle-complete">
        <span class="lifecycle-stage-label">{{ board.complete.label }}</span>
        <span v-if="board.complete.count !== null" class="lifecycle-count">{{ format(board.complete.count) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LifecycleBoard, LifecyclePlace } from '../../lib/lifecycleBoard'

// DAR-UI-050. Where records stopped: stages down the left, the places a record can stop at beside the stage
// where it stopped. A place holding records is bordered solid, an empty one dashed (design system: solid =
// attention, dashed = empty). A "no" place with a result opens its records.
const props = defineProps<{ board: LifecycleBoard; narrow?: boolean; canOpen: (place: LifecyclePlace) => boolean }>()
const emit = defineEmits<{ open: [place: LifecyclePlace] }>()
const countFormat = new Intl.NumberFormat('en-US')

function format(n: number): string { return countFormat.format(n) }
function openable(place: LifecyclePlace): boolean { return props.canOpen(place) }
</script>

<style scoped>
.lifecycle-board { display: grid; gap: var(--space-2); }
.lifecycle-row {
  display: grid;
  grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}
.lifecycle-board--narrow .lifecycle-row { grid-template-columns: minmax(0, 1fr); gap: var(--space-1-5); }

/* Stage: the rules board's field pill, as the question node draws it. */
.lifecycle-stage {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid color-mix(in oklab, var(--border) 80%, var(--text) 20%);
  border-radius: var(--radius-pill);
  background: color-mix(in oklab, var(--surface-2) 88%, var(--surface));
  color: var(--text);
}
.lifecycle-stage--complete { border-color: var(--border-soft); background: var(--surface); color: var(--text-muted); }
.lifecycle-stage-label { min-width: 0; overflow: hidden; font-size: var(--type-heading-size); text-overflow: ellipsis; white-space: nowrap; }

/* Places: the flowchart's finding box, stacked beside their stage. */
.lifecycle-places {
  display: grid;
  gap: var(--space-1-5);
  padding-left: var(--space-2);
  border-left: 1px dashed var(--border);
}
.lifecycle-board--narrow .lifecycle-places { margin-left: var(--space-3); }
.lifecycle-place {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-0) var(--space-2);
  min-height: 0;
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--type-table-head-size);
  text-align: left;
}
.lifecycle-place--held { border-color: color-mix(in oklab, var(--border) 50%, var(--text) 50%); color: var(--text); }
.lifecycle-place--empty { border-style: dashed; }
.lifecycle-place--open:hover {
  border-color: color-mix(in oklab, var(--border) 70%, var(--accent));
  background: color-mix(in oklab, var(--surface-2) 88%, var(--accent));
}
.lifecycle-place-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lifecycle-count { flex: none; color: var(--text); font-variant-numeric: tabular-nums; }
.lifecycle-meter { grid-column: 1 / -1; height: 2px; background: var(--border-soft); }
.lifecycle-meter i { display: block; height: 100%; background: var(--text-muted); }
</style>
