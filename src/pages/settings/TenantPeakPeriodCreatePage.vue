<template>
  <WorkflowPage :progress-percent="step === 'name' ? 0 : 50" aria-label="Create a peak period" center-stage>
    <div class="workflow-step-wrapper">
      <WorkflowStepForm
        v-if="step === 'name'"
        question="What is the busy period called?"
        :submit-disabled="!name.trim()"
        :show-back="true"
        @back="backToList"
        @submit="toDates"
      >
        <div class="wizard-input-shell">
          <input
            v-model="name"
            name="periodName"
            class="wizard-answer-control"
            placeholder="Black Friday"
            data-testid="peak-create-name"
            @input="error = null"
          />
        </div>
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else
        question="Which days?"
        primary-action-variant="save"
        primary-label="Create peak period"
        primary-test-id="peak-create-save"
        :submit-disabled="saving || !calendar.startDate.value || !calendar.endDate.value"
        :show-back="true"
        :show-cancel-action="true"
        cancel-test-id="peak-create-cancel"
        @back="step = 'name'"
        @cancel="backToList"
        @submit="create"
      >
        <WorkflowDateRangeCalendar :calendar="calendar" test-id-prefix="peak-create-dates" />
        <InlineValidation v-if="error" tone="error" :message="error" data-testid="peak-create-error" />
      </WorkflowStepForm>
    </div>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowDateRangeCalendar from '../../components/workflow/WorkflowDateRangeCalendar.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { useCalendarWidget } from '../../composables/useCalendarWidget'
import { peakFacade } from '../../lib/api/facade'
import { addDays, startOfLocalDay, startOfMonth } from '../../lib/utils/date'

// DAR-UI-161 (Aditi 2026-11-27: "creating a new peak period should be a workflow like anything else"). As an audit is
// made (DAR-UI-078): one question per step, its name, then its days. It is made on the second, switched on, and its
// own page opens, where peak hours, reads, sync allowances and run times are set.
// A period is planned ahead, so the calendar runs two years forward rather than stopping at today.
const PICKABLE_DAYS_AHEAD = 730

const router = useRouter()
const step = ref<'name' | 'dates'>('name')
const name = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const calendar = useCalendarWidget({ lastPickableDate: () => addDays(startOfLocalDay(new Date()), PICKABLE_DAYS_AHEAD) })

function backToList() { void router.push({ name: 'settings-tenant-peak-periods' }) }

function toDates() {
  if (!name.value.trim()) return
  if (!calendar.startDate.value) calendar.visibleMonth.value = startOfMonth(new Date())
  step.value = 'dates'
}

async function create() {
  const fromDate = calendar.startDate.value
  const thruDate = calendar.endDate.value
  if (saving.value || !name.value.trim() || !fromDate || !thruDate) return
  saving.value = true
  error.value = null
  try {
    const response = await peakFacade.savePeakPeriod({ periodName: name.value.trim(), fromDate, thruDate, isActive: true })
    if (response.ok === false || !response.peakPeriodId) {
      error.value = response.errors?.length ? response.errors.join(' ') : 'The peak period was not made.'
      return
    }
    await router.push({ name: 'settings-tenant-peak-period', params: { peakPeriodId: response.peakPeriodId } })
  } catch (caught) {
    error.value = caught instanceof Error && caught.message ? caught.message : 'The peak period was not made.'
  } finally {
    saving.value = false
  }
}
</script>
