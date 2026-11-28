<template>
  <!-- DAR-UI-128, DAR-UI-135. The run's conclusions as equal read-only rows in the order they are tried (first match
       wins): its rank, what it is called and which check it explains, its question, when it holds, and what it does to
       the row. Unexplained ends the list. A stored tree reads flattened, as the conclusions page edits it. -->
  <div class="run-conclusion-rows" data-testid="run-conclusions">
    <p v-if="loading && !loaded" class="section-note" data-testid="run-conclusions-loading">Loading...</p>

    <InlineValidation
      v-for="(message, index) in errors"
      :key="`${index}-${message}`"
      tone="error"
      :message="message"
      data-testid="run-conclusions-error"
    />

    <ul v-if="loaded" class="run-conclusion-list static-row-list" data-testid="run-conclusions-list">
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
        <span class="run-conclusion__end">
          <span
            v-explain="'conclusionOutcome'"
            class="run-conclusion__outcome"
            :class="{ 'run-conclusion__outcome--quiet': node.outcome }"
            data-testid="run-conclusions-outcome"
          >{{ outcomeLabel(node.outcome) }}</span>
          <span v-if="node.suggestsFilter" class="run-conclusion__suggests" data-testid="run-conclusions-suggests">suggests a filter</span>
        </span>
      </li>
      <li class="run-conclusion run-conclusion--unexplained" data-testid="run-conclusions-unexplained">
        <span class="run-conclusion__number" aria-hidden="true"></span>
        <span class="run-conclusion__code">
          <span class="run-conclusion__name">Unexplained</span>
        </span>
        <span class="run-conclusion__question"></span>
        <span class="run-conclusion__when">when nothing above matches</span>
        <span class="run-conclusion__end">
          <span
            v-explain="'conclusionOutcome'"
            class="run-conclusion__outcome"
            :class="{ 'run-conclusion__outcome--quiet': unexplained }"
            data-testid="run-conclusions-outcome"
          >{{ outcomeLabel(unexplained) }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import InlineValidation from '../ui/InlineValidation.vue'
import { injectRunConclusions, outcomeLabel } from '../../composables/useRunConclusions'
import { vExplain } from '../../directives/vExplain'
import { explainsLabel } from '../../lib/conclusionLines'

const { loading, loaded, errors, list, unexplained, lineContext, conclusionLabel, describeLines } = injectRunConclusions()
</script>

<style scoped>
.run-conclusion-rows {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
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

.run-conclusion__number {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.run-conclusion__code {
  display: grid;
  min-width: 0;
}

.run-conclusion__when,
.run-conclusion__explains,
.run-conclusion__suggests {
  color: var(--text-muted);
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
  .run-conclusion {
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
}
</style>
