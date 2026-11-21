<template>
  <!-- DAR-UI-128, DAR-UI-135. The run's conclusions as equal read-only rows in the order they are tried (first match
       wins): its rank, what it is called and which check it explains, its question, when it holds, and what it does to
       the row. A stored tree reads flattened, as the conclusions page edits it. -->
  <div class="run-conclusion-rows" data-testid="run-conclusions">
    <p v-if="loading && !loaded" class="section-note" data-testid="run-conclusions-loading">Loading...</p>

    <InlineValidation
      v-for="(message, index) in errors"
      :key="`${index}-${message}`"
      tone="error"
      :message="message"
      data-testid="run-conclusions-error"
    />

    <ul v-if="loaded" class="run-conclusion-list" data-testid="run-conclusions-list">
      <li
        v-for="(node, index) in list"
        :key="node.uid"
        class="run-conclusion"
        :data-key="node.key"
        data-testid="run-conclusions-node"
      >
        <span class="run-conclusion__number" data-testid="run-conclusions-number">{{ index + 1 }}</span>
        <span class="run-conclusion__code">
          <span class="run-conclusion__name">{{ conclusionLabel(node) || '—' }}</span>
          <span
            v-explain="'conclusionBucket'"
            class="run-conclusion__explains"
            data-testid="run-conclusions-explains"
          >explains {{ explainsLabel(node.bucket, lineContext) }}</span>
        </span>
        <span class="run-conclusion__question">{{ node.question || '—' }}</span>
        <span class="run-conclusion__when" data-testid="run-conclusions-when">{{ describeLines(node) }}</span>
        <span
          v-explain="'conclusionOutcome'"
          class="run-conclusion__outcome"
          :class="{ 'run-conclusion__outcome--quiet': node.outcome }"
          data-testid="run-conclusions-outcome"
        >{{ outcomeLabel(node.outcome) }}</span>
      </li>
      <li v-if="!list.length" class="run-conclusion run-conclusion--none" data-testid="run-conclusions-empty">None yet.</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import InlineValidation from '../ui/InlineValidation.vue'
import { injectRunConclusions, outcomeLabel } from '../../composables/useRunConclusions'
import { vExplain } from '../../directives/vExplain'
import { explainsLabel } from '../../lib/conclusionLines'

const { loading, loaded, errors, list, lineContext, conclusionLabel, describeLines } = injectRunConclusions()
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

/* Every row the same height: each column clamped, the numbers line up. */
.run-conclusion {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr) 6.5rem;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.6rem;
  padding: var(--space-1-5) var(--space-3);
}

.run-conclusion--none {
  display: flex;
  min-height: 3.4rem;
  color: var(--text-muted);
}

.run-conclusion__number {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.run-conclusion__code {
  display: grid;
  min-width: 0;
}

.run-conclusion__when,
.run-conclusion__explains {
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

/* Shown is the default and reads solid; Hidden and Expected change what the row does, so they read dashed. */
.run-conclusion__outcome {
  justify-self: end;
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
  .run-conclusion {
    grid-template-columns: 2.2rem minmax(0, 1fr) auto;
    gap: var(--space-00) var(--space-2);
  }

  .run-conclusion__question,
  .run-conclusion__when {
    grid-column: 2 / -1;
  }

  .run-conclusion__outcome {
    grid-column: 3;
    grid-row: 1;
  }
}
</style>
