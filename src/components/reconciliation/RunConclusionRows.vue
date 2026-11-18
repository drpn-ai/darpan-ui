<template>
  <!-- DAR-UI-128. The run's conclusions as equal rows in the order they are tried (first match wins): its number, what
       it is called and what it applies to, its question, when it holds, and what it does to the row. A child is
       numbered and indented under its parent. For an editor the row is the button and opens its popup. -->
  <div class="run-conclusion-rows" data-testid="run-conclusions">
    <p v-if="loading && !loaded" class="section-note" data-testid="run-conclusions-loading">Loading...</p>

    <InlineValidation
      v-for="(message, index) in errors"
      :key="`${index}-${message}`"
      tone="error"
      :message="message"
      data-testid="run-conclusions-error"
    />

    <template v-if="loaded">
      <ul class="run-conclusion-list" data-testid="run-conclusions-list">
        <li
          v-for="row in rows"
          :key="row.node.uid"
          class="run-conclusion"
          :style="{ '--run-conclusion-depth': String(row.depth - 1) }"
          :data-depth="row.depth"
          :data-key="row.node.key"
          data-testid="run-conclusions-node"
        >
          <component
            :is="editable ? 'button' : 'div'"
            :type="editable ? 'button' : undefined"
            class="run-conclusion__open"
            :class="{ 'run-conclusion__open--button': editable }"
            :aria-label="editable ? `Open conclusion ${conclusionLabel(row.node) || 'with no name'}` : undefined"
            :disabled="editable && saving ? true : undefined"
            data-testid="run-conclusions-open"
            @click="editable && openNode(row.node.uid)"
          >
            <span class="run-conclusion__number" data-testid="run-conclusions-number">{{ row.number }}</span>
            <span class="run-conclusion__code">
              <span class="run-conclusion__title">
                <span v-if="row.depth > 1" class="run-conclusion__arrow" aria-hidden="true">↳</span>
                <span class="run-conclusion__name">{{ conclusionLabel(row.node) || '—' }}</span>
              </span>
              <span
                v-if="row.depth === 1"
                v-explain="'conclusionBucket'"
                class="run-conclusion__applies"
                data-testid="run-conclusions-applies"
              >{{ appliesTo(row) }}</span>
            </span>
            <span class="run-conclusion__question">{{ row.node.question || '—' }}</span>
            <span class="run-conclusion__when" data-testid="run-conclusions-when">{{ describeNode(row) }}</span>
            <span class="run-conclusion__end">
              <span
                v-explain="'conclusionOutcome'"
                class="run-conclusion__outcome"
                :class="{ 'run-conclusion__outcome--quiet': row.node.outcome }"
                data-testid="run-conclusions-outcome"
              >{{ outcomeLabel(row.node.outcome) }}</span>
              <span v-if="row.node.suggestsFilter" class="run-conclusion__suggests" data-testid="run-conclusions-suggests">suggests a filter</span>
            </span>
          </component>
        </li>
        <li v-if="!rows.length" class="run-conclusion run-conclusion--none" data-testid="run-conclusions-empty">None yet.</li>
      </ul>

      <button
        v-if="editable"
        type="button"
        class="static-page-action-tile static-page-create-action"
        data-testid="run-conclusions-new"
        :disabled="saving"
        @click="openNew"
      >
        New conclusion
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import InlineValidation from '../ui/InlineValidation.vue'
import { injectRunConclusions, outcomeLabel } from '../../composables/useRunConclusions'
import { vExplain } from '../../directives/vExplain'

defineProps<{
  /** Rows open their popup and the create tile shows; otherwise the rows only read. */
  editable: boolean
}>()

const { loading, loaded, errors, saving, rows, conclusionLabel, appliesTo, describeNode, openNode, openNew } = injectRunConclusions()
</script>

<style scoped>
.run-conclusion-rows {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.run-conclusion-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  overflow: hidden;
  font-size: var(--static-tile-text-size);
}

.run-conclusion + .run-conclusion {
  border-top: 1px solid var(--static-tile-border);
}

.run-conclusion--none {
  display: flex;
  align-items: center;
  min-height: 3.4rem;
  padding: var(--space-1-5) var(--space-3);
  color: var(--text-muted);
}

/* Every row the same height: each column clamped; the numbers line up and a child's name steps in under its parent. */
.run-conclusion__open {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr) 6.5rem;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 3.6rem;
  margin: 0;
  padding: var(--space-1-5) var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.run-conclusion__open--button {
  cursor: pointer;
}

.run-conclusion__open--button:hover:not(:disabled) {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.run-conclusion__open--button:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: -2px;
}

.run-conclusion__open--button:disabled {
  opacity: 1;
  cursor: default;
}

.run-conclusion__number {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.run-conclusion__code {
  display: grid;
  min-width: 0;
  padding-left: calc(var(--space-3) * var(--run-conclusion-depth, 0));
}

.run-conclusion__title {
  display: flex;
  gap: var(--space-1);
  align-items: baseline;
  min-width: 0;
}

.run-conclusion__arrow,
.run-conclusion__when,
.run-conclusion__applies,
.run-conclusion__suggests {
  color: var(--text-muted);
}

.run-conclusion__when,
.run-conclusion__applies,
.run-conclusion__suggests {
  font-size: var(--type-note-size);
}

.run-conclusion__end {
  display: grid;
  gap: var(--space-00);
  justify-items: end;
  min-width: 0;
}

/* Shown is the default and reads solid; Hidden and Expected change what the row does, so they read dashed. */
.run-conclusion__outcome {
  padding: 0 var(--space-1-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  font-size: var(--type-note-size);
  white-space: nowrap;
}

.run-conclusion__outcome--quiet {
  border-style: dashed;
  color: var(--text-muted);
}

.run-conclusion__suggests {
  white-space: nowrap;
}

.run-conclusion__name,
.run-conclusion__question,
.run-conclusion__when {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

@media (max-width: 768px) {
  .run-conclusion__open {
    grid-template-columns: 2.2rem minmax(0, 1fr) auto;
    gap: var(--space-00) var(--space-2);
  }

  .run-conclusion__question,
  .run-conclusion__when {
    grid-column: 2 / -1;
  }

  .run-conclusion__end {
    grid-column: 3;
    grid-row: 1;
  }

  .run-conclusion__code {
    padding-left: calc(var(--space-2) * var(--run-conclusion-depth, 0));
  }
}
</style>
