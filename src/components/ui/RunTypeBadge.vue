<template>
  <span
    v-explain="{ term: definition.glossaryTerm }"
    class="run-type-badge static-page-list-tile__meta"
    :data-run-type="type"
    :data-testid="testId ?? `run-type-${type}`"
  >
    <svg class="run-type-badge__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path :d="definition.iconPath" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span>{{ detail ? `${definition.label} · ${detail}` : definition.label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RUN_TYPES, type RunTypeId } from '../../lib/runTypes'

// DAR-UI-049. The one place a run's type is drawn: icon + word, with the mascot carrying the
// explanation so the page itself stays terse.
const props = defineProps<{ type: RunTypeId; detail?: string; testId?: string }>()
const definition = computed(() => RUN_TYPES[props.type])
</script>

<style scoped>
.run-type-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.run-type-badge__icon {
  width: 1.1em;
  height: 1.1em;
  flex: none;
}
</style>
