<template>
  <div class="conclusion-evidence" data-testid="conclusion-evidence">
    <div class="conclusion-evidence__systems">
      <div
        v-for="system in conclusion.systems"
        :key="system.side"
        class="conclusion-evidence__system"
        :class="{ 'conclusion-evidence__system--empty': isEmpty(system) }"
        data-testid="conclusion-system"
      >
        <span class="micro-label">{{ system.system }}</span>
        <span class="conclusion-evidence__state">{{ stateText(system) }}</span>
        <span v-for="fact in system.facts" :key="fact" class="conclusion-evidence__fact">{{ fact }}</span>
      </div>
    </div>

    <div v-if="conclusion.checks.length > 0" class="conclusion-evidence__checks">
      <span class="micro-label">How Darpan concluded</span>
      <div
        v-for="check in conclusion.checks"
        :key="check.label"
        class="conclusion-evidence__check"
        data-testid="conclusion-check"
      >
        <span aria-hidden="true">✓</span>
        <span>{{ check.label }}</span>
        <span class="conclusion-evidence__check-value">{{ check.value }}</span>
      </div>
    </div>

    <div
      v-if="conclusion.question && !decisionDismissed"
      class="conclusion-evidence__decision"
      data-testid="conclusion-decision"
    >
      <span class="micro-label">Needs a decision</span>
      <p class="section-note conclusion-evidence__question">{{ questionText }}</p>
      <div class="action-row">
        <button
          type="button"
          class="conclusion-evidence__button"
          data-testid="conclusion-stop-flagging"
          @click="emit('stopFlagging', conclusion.question)"
        >
          Stop flagging in rules board ›
        </button>
        <button
          type="button"
          class="conclusion-evidence__button"
          data-testid="conclusion-keep-flagging"
          @click="decisionDismissed = true"
        >
          Keep flagging
        </button>
      </div>
    </div>

    <div class="conclusion-evidence__raw">
      <button
        type="button"
        class="conclusion-evidence__button"
        data-testid="conclusion-raw-toggle"
        :aria-expanded="rawOpen ? 'true' : 'false'"
        @click="rawOpen = !rawOpen"
      >
        Raw record ›
      </button>
      <div v-if="rawOpen" data-testid="conclusion-raw">
        <JsonCollapseViewer :value="rawValue" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import JsonCollapseViewer from '../ui/JsonCollapseViewer.vue'
import type { RunConclusion, RunConclusionQuestion, RunConclusionSystem } from '../../lib/api/types'

// DAR-UI-044: the expanded row. Everything here is what the run wrote at conclude time; the page only
// renders it, so an explanation can never say more than the rule that reached it tested.
const props = defineProps<{
  conclusion: RunConclusion
  rawValue: unknown
}>()

const emit = defineEmits<{
  stopFlagging: [question: RunConclusionQuestion]
}>()

const rawOpen = ref(false)
// "Keep flagging" persists nothing: the open question stays on the next run too.
const decisionDismissed = ref(false)

const questionText = computed(() => {
  const question = props.conclusion.question
  if (!question) return ''
  return typeof question.count === 'number' ? `${question.text} ${question.count} in this run.` : question.text
})

function isEmpty(system: RunConclusionSystem): boolean {
  return system.presence === 'ABSENT' || system.presence === 'UNKNOWN'
}

function stateText(system: RunConclusionSystem): string {
  if (system.presence === 'ABSENT') return 'Not found'
  if (system.presence === 'UNKNOWN') return 'Not checked'
  return system.state ?? ''
}
</script>

<style scoped>
.conclusion-evidence {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.conclusion-evidence__systems {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-1-5);
}

.conclusion-evidence__system {
  display: grid;
  gap: var(--space-00);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

/* Dashed = empty: the system has no record for this finding, or could not be checked. */
.conclusion-evidence__system--empty {
  border-style: dashed;
  background: transparent;
}

.conclusion-evidence__state {
  color: var(--text);
  font-size: var(--type-action-size);
}

.conclusion-evidence__fact,
.conclusion-evidence__check-value {
  color: var(--text-muted);
  font-size: var(--type-summary-label-size);
}

.conclusion-evidence__checks {
  display: grid;
  gap: var(--space-1-5);
}

.conclusion-evidence__check {
  display: grid;
  grid-template-columns: var(--space-3) minmax(0, 1fr) auto;
  gap: var(--space-1-5);
  align-items: baseline;
  color: var(--text-soft);
  font-size: var(--type-note-size);
}

/* Solid = attention: an open question the operator decides. */
.conclusion-evidence__decision {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid color-mix(in oklab, var(--success) 42%, var(--border));
  border-radius: var(--radius-md);
}

.conclusion-evidence__question {
  color: var(--text-soft);
}

.conclusion-evidence__raw {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
}

.conclusion-evidence__button {
  min-height: 2.15rem;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--type-meta-size);
  font-weight: 400;
  transition: border-color 160ms ease, background 160ms ease;
}

.conclusion-evidence__button:hover {
  border-color: color-mix(in oklab, var(--accent) 42%, var(--border));
  background: var(--surface-2);
  color: var(--text);
}
</style>
