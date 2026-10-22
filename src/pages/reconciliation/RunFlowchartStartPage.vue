<template>
  <WorkflowPage :progress-percent="50" aria-label="Run" center-stage>
    <div class="workflow-step-wrapper">
      <WorkflowStepForm
        :class="step === 'window' ? 'run-start-window-step' : 'run-start-custom-step'"
        :question="step === 'window' ? 'Which days should this run look at?' : 'Select custom dates'"
        :primary-label="step === 'window' && preset === 'custom' ? 'Next' : 'Run'"
        :submit-disabled="!canSubmit"
        :allow-select-enter="true"
        :show-back="true"
        @back="back"
        @submit="start"
      >
        <WorkflowShortcutChoiceCards
          v-if="step === 'window'"
          :options="options"
          :selected-value="preset"
          test-id-prefix="flowchart-start-window"
          @choose="choose"
        />
        <WorkflowDateRangeCalendar v-else :calendar="calendar" test-id-prefix="flowchart-start-custom" />
        <InlineValidation v-if="error" tone="error" :message="error" />
      </WorkflowStepForm>
    </div>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowDateRangeCalendar from '../../components/workflow/WorkflowDateRangeCalendar.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowShortcutChoiceCards from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { useCalendarWidget } from '../../composables/useCalendarWidget'
import { reconciliationFacade } from '../../lib/api/facade'
import { cachedRead } from '../../lib/api/readCache'
import { lifecycleChart } from '../../lib/api/queries'
import type { FlowchartRun } from '../../lib/api/flowchartTypes'
import { buildRunPayload } from '../../lib/flowchart/flowchartRunState'
import {
  customWindowRange,
  isRunWindowPreset,
  presetWindowRange,
  runWindowPresetOptions,
  type RunWindowPreset,
} from '../../lib/runWindow'
import { addDays, todayInDisplayTimeZone } from '../../lib/utils/date'

// DAR-UI-050. Play on a run page opens this workflow, as a Sync run's play does: the window is chosen when the
// run starts, not kept on the page; the run page shows the dates it covered. DAR-UI-060: it asks with the Sync
// run's cards and calendar. A lifecycle built from stages ends its window lateAfterDays back, so records too new
// to have finished are not judged: the cards count back from there and the calendar stops the day before.
const route = useRoute()
const router = useRouter()
const reconciliationId = computed(() => String(route.params.reconciliationId ?? ''))
const run = ref<FlowchartRun | null>(null)
const step = ref<'window' | 'custom'>('window')
const preset = ref<RunWindowPreset | ''>('')
const starting = ref(false)
const error = ref<string | null>(null)

const lateDays = computed(() => (run.value?.buildMode === 'STAGES' ? Number(run.value?.lateAfterDays ?? 0) : 0))
const lastDay = computed(() => addDays(todayInDisplayTimeZone(), -lateDays.value))
const calendar = useCalendarWidget({ lastPickableDate: () => (lateDays.value > 0 ? addDays(lastDay.value, -1) : todayInDisplayTimeZone()) })
const options = computed(() => runWindowPresetOptions(lastDay.value))
const range = computed(() => {
  if (!preset.value) return null
  return preset.value === 'custom' ? customWindowRange(calendar) : presetWindowRange(preset.value, lastDay.value)
})
// Custom Dates on the first question is a way on to the calendar, not a window to run.
const canSubmit = computed(() => !!run.value && !starting.value && (step.value === 'window' && preset.value === 'custom' ? true : !!range.value))

function choose(value: string) {
  if (!isRunWindowPreset(value)) return
  preset.value = value
  if (value !== 'custom') {
    calendar.reset()
    return
  }
  calendar.setSelectionSide(calendar.startDate.value ? 'end' : 'start')
  calendar.focusVisibleMonthAroundStart()
  step.value = 'custom'
}

function back() {
  if (step.value === 'custom') {
    step.value = 'window'
    return
  }
  void router.push({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value } })
}

async function start() {
  if (!canSubmit.value) return
  if (step.value === 'window' && preset.value === 'custom') {
    step.value = 'custom'
    return
  }
  const window = range.value
  if (!window) return
  starting.value = true
  error.value = null
  try {
    const { reconciliationExecutionId } = await reconciliationFacade.runReconciliation(
      buildRunPayload(reconciliationId.value, window))
    // Replace, so Back from the run page does not land on a workflow that already ran. The state tells the run
    // page this run was just started, so it follows it to the last question rather than treating it as past.
    await router.replace({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value, reconciliationExecutionId },
      state: { startedRun: reconciliationExecutionId } })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
    starting.value = false
  }
}

// The cards only draw the A-D badges; each page wires the keys itself, as RunCreateTypePage does. Skipped while
// typing so the command palette keeps its letters.
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function handleShortcutKeydown(event: KeyboardEvent) {
  if (step.value !== 'window') return
  if (typeof event.key !== 'string' || event.key.length !== 1) return
  if (event.defaultPrevented || event.repeat || event.isComposing) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (isTypingTarget(event.target)) return

  const option = options.value.find((candidate) => candidate.shortcutKey === event.key.toUpperCase())
  if (!option) return
  event.preventDefault()
  choose(option.value)
}

onMounted(async () => {
  window.addEventListener('keydown', handleShortcutKeydown)
  const chart = lifecycleChart(reconciliationId.value)
  try {
    await cachedRead(chart.key, chart.fetch, ({ got }) => { run.value = got.reconciliation })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcutKeydown))
</script>

<style scoped>
/* Sized to the choice grid, as RunCreateTypePage is, so question, cards and Back centre as one block; the
   calendar takes the Sync run's width. */
.run-start-window-step {
  width: min(34rem, 100%);
}

.run-start-custom-step {
  min-width: 0;
  max-width: 100%;
}
</style>
