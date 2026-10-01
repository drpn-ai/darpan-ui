<template>
  <StaticPageFrame>
    <template #hero><h1>Runs</h1></template>

    <StaticPageSection title="Saved Runs">
      <p v-if="!loaded" class="section-note">Loading runs...</p>
      <InlineValidation v-else-if="error" tone="error" :message="error" />
      <EmptyState v-else-if="!runs.length" title="No runs" />
      <div v-else class="static-page-tile-grid static-page-record-grid static-page-record-grid--fixed">
        <RouterLink
          v-for="run in runs"
          :key="run.reconciliationId"
          :to="{ name: 'reconciliation-run-flowchart', params: { reconciliationId: run.reconciliationId } }"
          class="static-page-tile static-page-list-tile static-page-record-tile"
          :data-testid="`flowchart-run-${run.reconciliationId}`"
        >
          <span class="static-page-list-tile__title">{{ run.reconciliationName || run.reconciliationId }}</span>
          <span class="static-page-list-tile__meta">{{ questionCountLabel(run.questionCount ?? 0) }} · {{ lookBackLabel(run.defaultTimeWindow) }}</span>
        </RouterLink>
      </div>
      <RouterLink
        :to="{ name: 'reconciliation-run-flowchart-create' }"
        class="static-page-action-tile static-page-action-tile--inline"
        data-testid="flowchart-create-run"
      >
        Create Run
      </RouterLink>
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
import { defaultWindowDays } from '../../lib/flowchart/flowchartRunState'

// DAR-UI-048. Every run (flowchart) in the active tenant, as the design system's record tiles.
const runs = ref<FlowchartRun[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)

function questionCountLabel(n: number): string { return n === 1 ? '1 question' : `${n} questions` }
function lookBackLabel(window?: string | null): string {
  const days = defaultWindowDays(window)
  return days === 1 ? 'previous day' : `last ${days} days`
}

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
