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
      </WorkflowStepForm>
    </div>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useChoiceShortcuts } from '../../composables/useChoiceShortcuts'
import { useRoute, useRouter } from 'vue-router'
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
import { peakHoursUntilNotice } from '../../lib/peakPeriodWords'
import { useAuthStore } from '../../stores/auth'
import { useMascotStore } from '../../stores/mascot'

// DAR-UI-063. An audit's play, asked as a lifecycle's play asks it (RunFlowchartStartPage): which days, with the run
// cards and calendar. Every check of the audit then runs over them in the background, recording its findings as the
// morning run does. The backend takes the days first to last inclusive and refuses any after today.
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const mascot = useMascotStore()
const auditCode = computed(() => String(route.params.audit ?? ''))
const step = ref<'window' | 'custom'>('window')
const preset = ref<RunWindowPreset | ''>('')
const starting = ref(false)

const today = todayInDisplayTimeZone()
// The earliest day a play can record (the first day of the period just ended, or go-live when later; DAR-BE-178), from
// the audit's settings: nothing before it is offered, so a run is never refused for days the ledger would not take.
const playableFrom = ref<Date | null>(null)
// DAR-BE-328: when peak hours end, while now is inside them. Play still starts; the audit says until when.
const peakHoursUntil = ref<string | null>(null)
// Names the audit in a refusal, which may be read on another page.
const auditName = ref('')
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
  // DAR-UI-156 (Aditi: "UI changes should always be immediate.. backend can do its thing"). The audit opens on the
  // click, already watching its checks; run#Audit submits behind it. A refusal is raised by the mascot, where it stays
  // until read (a pill would vanish), with the way back to choose the window again.
  const audit = auditCode.value
  const startPath = route.fullPath
  // Replace, so Back from the audit does not land on a workflow that already ran.
  const peakNotice = peakHoursUntilNotice(peakHoursUntil.value, authStore.sessionInfo?.tenantTimeZone)
  const landed = router.replace({ ...auditRoute.value, state: { startedAudit: true, ...(peakNotice ? { peakNotice } : {}) } })
  // The window ends exclusive; the audit takes its last day.
  void auditFacade.runAudit({
    audit,
    fromDate: formatDateInputValue(window.startDate),
    thruDate: formatDateInputValue(addDays(window.endExclusiveDate, -1)),
  }).catch(async (caught: unknown) => {
    // The mascot puts its warnings away on every page change, so a fast refusal waits for the audit to have opened.
    await landed.catch(() => undefined)
    await nextTick()
    mascot.raise({
      id: `audit-start-${audit}`,
      title: 'An audit did not start',
      prompt: `${auditName.value || 'This audit'} did not start.`,
      body: caught instanceof Error && caught.message ? caught.message : String(caught),
      actions: [{ label: 'Choose the window again', testId: 'audit-start-again', run: () => void router.push(startPath) }],
    })
  })
  await landed
}

// The cards only draw the A-D badges; the keys are wired here. DAR-UI-078 (walked in Chrome): a letter picks a card but
// leaves focus on the page, outside the form that answers Enter, so Enter there runs, as the hint says.
useChoiceShortcuts({
  active: () => step.value === 'window',
  choices: () => options.value,
  choose,
  onEnterOutsideForm: () => { void start() },
})

onMounted(async () => {
  try {
    const settings = (await auditFacade.getAuditSettings({ audit: auditCode.value })).settings
    playableFrom.value = settings?.playableFrom ? parseDateInput(settings.playableFrom) : null
    peakHoursUntil.value = settings?.peakHoursUntil ?? null
    auditName.value = settings?.audit?.name ?? ''
  } catch {
    // The run itself still refuses days it cannot record, in place.
  }
})
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
