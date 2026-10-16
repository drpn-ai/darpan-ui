<template>
  <WorkflowPage :progress-percent="50" aria-label="Run" center-stage>
    <div class="workflow-step-wrapper">
      <WorkflowStepForm
        question="Which days should this run look at?"
        primary-label="Run"
        :submit-disabled="!run || !days || starting"
        :allow-select-enter="true"
        :show-back="true"
        @back="back"
        @submit="start"
      >
        <div class="wizard-input-shell">
          <WorkflowSelect
            v-model="days"
            :options="options"
            :disabled="!run"
            :placeholder="run ? 'pick days' : 'Loading...'"
            test-id="flowchart-start-window"
          />
        </div>
        <InlineValidation v-if="error" tone="error" :message="error" />
      </WorkflowStepForm>
    </div>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import type { FlowchartRun } from '../../lib/api/flowchartTypes'
import { buildRunPayload, defaultWindowDays, windowFromDays } from '../../lib/flowchart/flowchartRunState'
import { addDays, todayInDisplayTimeZone } from '../../lib/utils/date'

// DAR-UI-050. Play on a run page opens this one-question workflow, as a Sync run's play does: the window is
// chosen when the run starts, not kept on the page; the run page shows the dates it covered. A lifecycle built
// from stages ends its window lateAfterDays back, so records too new to have finished are not judged.
const route = useRoute()
const router = useRouter()
const reconciliationId = computed(() => String(route.params.reconciliationId ?? ''))
const run = ref<FlowchartRun | null>(null)
const days = ref('')
const starting = ref(false)
const error = ref<string | null>(null)

const lastDay = computed(() => addDays(todayInDisplayTimeZone(), -(run.value?.buildMode === 'STAGES' ? Number(run.value?.lateAfterDays ?? 0) : 0)))

function windowFor(d: number) { return windowFromDays(d, lastDay.value) }

const options = computed(() => {
  if (!run.value) return []
  const presets = [...new Set([defaultWindowDays(run.value.defaultTimeWindow), 1, 7, 30])].sort((a, b) => a - b)
  return presets.map((d) => ({ value: String(d), label: d === 1 ? 'Previous day' : `Last ${d} days` }))
})

function back() { void router.push({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value } }) }

async function start() {
  if (starting.value || !days.value) return
  starting.value = true
  error.value = null
  try {
    const { reconciliationExecutionId } = await reconciliationFacade.runReconciliation(
      buildRunPayload(reconciliationId.value, windowFor(Number(days.value))))
    // Replace, so Back from the run page does not land on a workflow that already ran. The state tells the run
    // page this run was just started, so it follows it to the last question rather than treating it as past.
    await router.replace({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value, reconciliationExecutionId },
      state: { startedRun: reconciliationExecutionId } })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
    starting.value = false
  }
}

onMounted(async () => {
  try {
    run.value = (await reconciliationFacade.getReconciliation({ reconciliationId: reconciliationId.value })).reconciliation
    days.value = String(defaultWindowDays(run.value?.defaultTimeWindow))
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
})
</script>
