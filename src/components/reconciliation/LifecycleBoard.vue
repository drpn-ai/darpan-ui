<template>
  <!-- The same line as the lifecycle's settings, with counts: the starting records, each stage with how many reached
       it, and under each stage the places records stopped there. The complete place closes the line. -->
  <div class="lifecycle-line" data-testid="lifecycle-board">
    <div v-if="board.start" class="lifecycle-line-group">
      <div class="lifecycle-line-node lifecycle-line-node--start" data-testid="lifecycle-start">
        <span class="lifecycle-line-name">{{ board.start.label }}</span>
        <span v-if="board.start.count !== null" class="lifecycle-line-count">{{ format(board.start.count) }}</span>
      </div>
    </div>

    <div v-for="stage in board.stages" :key="stage.questionId" class="lifecycle-line-group">
      <div class="lifecycle-line-node" :data-testid="`lifecycle-stage-${stage.questionId}`">
        <span class="lifecycle-line-name">{{ stage.label }}</span>
        <span v-if="stage.count !== null" class="lifecycle-line-count">{{ format(stage.count) }}</span>
      </div>
      <div class="lifecycle-line-gap">
        <component
          :is="openable(place) ? 'button' : 'div'"
          v-for="place in stage.places"
          :key="`${place.questionId}-${place.branch}`"
          :type="openable(place) ? 'button' : undefined"
          :aria-label="openable(place) ? `Open ${place.label}` : undefined"
          class="lifecycle-line-place"
          :class="{ 'lifecycle-line-place--empty': place.count === 0, 'lifecycle-line-place--open': openable(place) }"
          :data-testid="`lifecycle-place-${place.questionId}-${place.branch}`"
          @click="openable(place) && emit('open', place)"
        >
          <span class="lifecycle-line-place-label">{{ place.label }}</span>
          <span class="lifecycle-line-count">{{ place.count === null ? '' : format(place.count) }}</span>
        </component>
      </div>
    </div>

    <div v-if="board.complete" class="lifecycle-line-group">
      <component
        :is="openable(board.complete) ? 'button' : 'div'"
        :type="openable(board.complete) ? 'button' : undefined"
        :aria-label="openable(board.complete) ? `Open ${board.complete.label}` : undefined"
        class="lifecycle-line-node lifecycle-line-node--complete"
        :class="{ 'lifecycle-line-place--open': openable(board.complete) }"
        data-testid="lifecycle-complete"
        @click="board.complete && openable(board.complete) && emit('open', board.complete)"
      >
        <span class="lifecycle-line-name">{{ board.complete.label }}</span>
        <span v-if="board.complete.count !== null" class="lifecycle-line-count">{{ format(board.complete.count) }}</span>
      </component>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LifecycleBoard, LifecyclePlace } from '../../lib/lifecycleBoard'

// DAR-UI-050. Where records stopped, drawn as the lifecycle's own line (the settings page's spine): a dot per stage
// with how many reached it, the places a record stopped at listed under the stage where it stopped, the complete
// place last. Monochrome; an empty place is dimmed; a place with records opens them, underlined on approach.
const props = defineProps<{ board: LifecycleBoard; narrow?: boolean; canOpen: (place: LifecyclePlace) => boolean }>()
const emit = defineEmits<{ open: [place: LifecyclePlace] }>()
const countFormat = new Intl.NumberFormat('en-US')

function format(n: number): string { return countFormat.format(n) }
function openable(place: LifecyclePlace): boolean { return props.canOpen(place) }
</script>

<style scoped>
.lifecycle-line { display: flex; flex-direction: column; max-width: 40rem; }
.lifecycle-line-group { position: relative; }
.lifecycle-line-node {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--space-2);
  width: 100%;
  min-height: 0;
  padding: 0 0 0 var(--space-4);
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  font-size: var(--type-tile-size);
}
.lifecycle-line-node::before {
  content: "";
  position: absolute;
  left: 0.2rem;
  top: 0.45rem;
  width: 0.7rem;
  height: 0.7rem;
  border: 1.5px solid var(--text);
  border-radius: var(--radius-pill);
  background: var(--surface);
}
.lifecycle-line-node--start::before,
.lifecycle-line-node--complete::before { background: var(--text); }
.lifecycle-line-name { min-width: 0; }
.lifecycle-line-count { color: var(--text); font-variant-numeric: tabular-nums; }
/* The rule line runs down the left between the dots, through each stage's places. */
.lifecycle-line-gap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-0);
  padding: var(--space-1-5) 0 var(--space-2) var(--space-4);
}
.lifecycle-line-gap::before,
.lifecycle-line-group:first-child::after {
  content: "";
  position: absolute;
  left: 0.55rem;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--border);
}
.lifecycle-line-group:first-child { padding-bottom: var(--space-2); }
.lifecycle-line-group:first-child::after { top: 1.3rem; }
.lifecycle-line-place {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--space-2);
  width: 100%;
  min-height: 0;
  padding: var(--space-00) 0;
  border: 0;
  background: transparent;
  color: var(--text-soft);
  text-align: left;
  font-size: var(--type-muted-size);
}
.lifecycle-line-place-label { min-width: 0; }
.lifecycle-line-place--empty,
.lifecycle-line-place--empty .lifecycle-line-count { color: var(--text-dim); }
.lifecycle-line-place--open { cursor: pointer; }
.lifecycle-line-place--open:hover .lifecycle-line-place-label,
.lifecycle-line-place--open:hover .lifecycle-line-name { text-decoration: underline; text-underline-offset: 3px; }
</style>
