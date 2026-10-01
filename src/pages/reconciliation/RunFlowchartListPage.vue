<template>
  <StaticPageFrame>
    <template #hero><h1>Runs</h1></template>
    <InlineValidation v-if="error" tone="error" :message="error" />
    <EmptyState
      v-if="loaded && !runs.length"
      title="No runs yet"
      :action="{ label: 'Create run', to: { name: 'reconciliation-run-flowchart-create' } }"
    />
    <StaticPageSection v-else-if="runs.length">
      <ul class="flowchart-run-list">
        <li v-for="run in runs" :key="run.reconciliationId">
          <RouterLink :to="{ name: 'reconciliation-run-flowchart', params: { reconciliationId: run.reconciliationId } }" :data-testid="`flowchart-run-${run.reconciliationId}`">
            {{ run.reconciliationName || run.reconciliationId }}
          </RouterLink>
          <span class="flowchart-run-meta">{{ run.questionCount ?? 0 }} questions · {{ run.defaultTimeWindow || '1d' }}</span>
        </li>
      </ul>
    </StaticPageSection>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import type { FlowchartRun } from '../../lib/api/flowchartTypes'

// DAR-UI-048. Every run (flowchart) in the active tenant.
const runs = ref<FlowchartRun[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    runs.value = (await reconciliationFacade.listReconciliations()).reconciliations ?? []
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    loaded.value = true
  }
})
</script>

<style scoped>
.flowchart-run-list { display: flex; flex-direction: column; gap: var(--space-2); padding: 0; margin: 0; list-style: none; }
.flowchart-run-meta { margin-left: var(--space-2); color: var(--text-muted); }
</style>
