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
          test-id-prefix="audit-start-window"
          @choose="choose"
        />
        <WorkflowDateRangeCalendar v-else :calendar="calendar" test-id-prefix="audit-start-custom" />
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
import { auditFacade } from '../../lib/api/facade'
import { auditMorningQuery } from '../../lib/auditReport'
import {
  customWindowRange,
  isRunWindowPreset,
  presetWindowRange,
  runWindowPresetOptions,
  type RunWindowPreset,
} from '../../lib/runWindow'
import { addDays, formatDateInputValue, parseDateInput, todayInDisplayTimeZone } from '../../lib/utils/date'

// DAR-UI-063. An audit's play, asked as a lifecycle's play asks it (RunFlowchartStartPage): which days, with the run
// cards and calendar. Every check of the audit then runs over them in the background, recording its findings as the
// morning run does. The backend takes the days first to last inclusive and refuses any after today.
const route = useRoute()
const router = useRouter()
const auditCode = computed(() => String(route.params.audit ?? ''))
const step = ref<'window' | 'custom'>('window')
const preset = ref<RunWindowPreset | ''>('')
const starting = ref(false)
const error = ref<string | null>(null)

const today = todayInDisplayTimeZone()
// The earliest day a play can record (the period's first day, or an extended earlier period's), from the audit's
// settings: nothing before it is offered, so a run is never refused for days the ledger would not take.
const playableFrom = ref<Date | null>(null)
const calendar = useCalendarWidget({ lastPickableDate: () => today, firstPickableDate: () => playableFrom.value })
const options = computed(() => runWindowPresetOptions(today).filter((option) =>
  option.value === 'custom' || !playableFrom.value || presetWindowRange(option.value, today).startDate >= playableFrom.value))
const range = computed(() => {
  if (!preset.value) return null
  return preset.value === 'custom' ? customWindowRange(calendar) : presetWindowRange(preset.value, today)
})
// Custom Dates on the first question is a way on to the calendar, not a window to run.
const canSubmit = computed(() => !starting.value && (step.value === 'window' && preset.value === 'custom' ? true : !!range.value))

// Back to the audit, on the morning it was showing.
const auditRoute = computed(() => ({ name: 'audit-report', params: { audit: auditCode.value }, query: auditMorningQuery(route.query) }))

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
  void router.push(auditRoute.value)
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
    // The window ends exclusive; the audit takes its last day.
    await auditFacade.runAudit({
      audit: auditCode.value,
      fromDate: formatDateInputValue(window.startDate),
      thruDate: formatDateInputValue(addDays(window.endExclusiveDate, -1)),
    })
    // Replace, so Back from the audit does not land on a workflow that already ran.
    await router.replace({ ...auditRoute.value, state: { startedAudit: true } })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
    starting.value = false
  }
}

// The cards only draw the A-D badges; each page wires the keys itself. Skipped while typing so the command palette
// keeps its letters.
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function handleShortcutKeydown(event: KeyboardEvent) {
  if (step.value !== 'window') return
  // DAR-UI-078 (walked in Chrome): a letter picks a card but leaves focus on the page, outside the form that answers
  // Enter, so "press Enter" did nothing. Enter there runs, as the hint says; inside the form the form answers it.
  if (event.key === 'Enter' && !event.defaultPrevented && !event.repeat && !(event.target instanceof Element && event.target.closest('form'))) {
    event.preventDefault()
    void start()
    return
  }
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
  try {
    const playable = (await auditFacade.getAuditSettings({ audit: auditCode.value })).settings?.playableFrom
    playableFrom.value = playable ? parseDateInput(playable) : null
  } catch {
    // The run itself still refuses days it cannot record, in place.
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcutKeydown))
</script>

<style scoped>
/* Sized to the choice grid, as RunFlowchartStartPage is; the calendar takes the Sync run's width. */
.run-start-window-step {
  width: min(34rem, 100%);
}

.run-start-custom-step {
  min-width: 0;
  max-width: 100%;
}
</style>
