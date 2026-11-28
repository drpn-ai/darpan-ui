<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': activePopup !== null }">
    <template #hero>
      <StaticRecordTitle
        v-if="draft"
        :model-value="draft.periodName"
        :editable="canEdit"
        aria-label="Peak period name"
        test-id="peak-name"
        explain="peakPeriodName"
        toggle-label="Peak period on"
        :on="draft.isActive"
        toggle-test-id="peak-on"
        :toggle-disabled="!canEdit || busy"
        @update:model-value="renameDraft"
        @update:on="setActive"
      />
      <h1 v-else v-explain="'peakPeriods'">Peak period</h1>
    </template>

    <LoadingState v-if="loading" noun="peak period" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="peak-page-error" />

    <template v-if="draft">
      <StaticFactStrip :facts="facts" test-id="peak-facts" @open="openFact" />

      <StaticPageSection v-if="syncRows.length">
        <template #header>
          <h2 v-explain="'peakSyncLag'" class="static-page-section-heading">Sync lag allowance</h2>
        </template>
        <div class="peak-rows" data-testid="peak-sync-lag">
          <div class="peak-row peak-row--head">
            <span v-explain="'peakSyncPair'" class="peak-row__head-label">Pair</span>
            <span v-explain="'peakRunNormal'" class="peak-row__head-label">Normal</span>
            <span v-explain="'peakRunThisPeriod'" class="peak-row__head-label">This period</span>
          </div>
          <component
            :is="canEdit ? 'button' : 'div'"
            v-for="row in syncRows"
            :key="row.syncPairId"
            :type="canEdit ? 'button' : undefined"
            class="peak-row"
            :class="{ 'peak-row--button': canEdit }"
            :aria-label="canEdit ? `${plainPairLabel(row.label)}: ${row.periodAllowanceMinutes === null ? 'Normal' : allowanceWords(row.periodAllowanceMinutes)}` : undefined"
            :disabled="canEdit && busy ? true : undefined"
            data-testid="peak-sync-lag-row"
            @click="canEdit && openSync('allowance', row)"
          >
            <span>{{ plainPairLabel(row.label) }}</span>
            <span class="peak-row__soft">{{ allowanceWords(row.normalAllowanceMinutes) }}</span>
            <span>{{ row.periodAllowanceMinutes === null ? 'Normal' : allowanceWords(row.periodAllowanceMinutes) }}</span>
          </component>
        </div>
      </StaticPageSection>

      <StaticPageSection v-if="syncRows.length">
        <template #header>
          <h2 v-explain="'peakSyncPulse'" class="static-page-section-heading">Sync pulse</h2>
        </template>
        <div class="peak-rows" data-testid="peak-sync-pulse">
          <div class="peak-row peak-row--head">
            <span v-explain="'peakSyncPair'" class="peak-row__head-label">Pair</span>
            <span v-explain="'peakRunNormal'" class="peak-row__head-label">Normal</span>
            <span v-explain="'peakRunThisPeriod'" class="peak-row__head-label">This period</span>
          </div>
          <component
            :is="canEdit ? 'button' : 'div'"
            v-for="row in syncRows"
            :key="row.syncPairId"
            :type="canEdit ? 'button' : undefined"
            class="peak-row"
            :class="{ 'peak-row--button': canEdit }"
            :aria-label="canEdit ? `${plainPairLabel(row.label)}: ${row.periodPulseMinutes === null ? 'Normal' : pulseCadence(row.periodPulseMinutes)}` : undefined"
            :disabled="canEdit && busy ? true : undefined"
            data-testid="peak-sync-pulse-row"
            @click="canEdit && openSync('pulse', row)"
          >
            <span>{{ plainPairLabel(row.label) }}</span>
            <span class="peak-row__soft">{{ pulseCadence(row.normalPulseMinutes) }}</span>
            <span>{{ row.periodPulseMinutes === null ? 'Normal' : pulseCadence(row.periodPulseMinutes) }}</span>
          </component>
        </div>
      </StaticPageSection>

      <StaticPageSection>
        <template #header>
          <div class="peak-section-head">
            <h2 v-explain="'peakRunTimes'" class="static-page-section-heading">Run times</h2>
            <button
              v-if="canEdit"
              type="button"
              class="app-icon-action app-icon-action--large"
              aria-label="Move another run"
              title="Move another run"
              data-testid="peak-run-time-add"
              :disabled="busy || datesDirty"
              @click="openRunTime(null)"
            >
              <AppIcon name="plus" />
            </button>
          </div>
        </template>
        <div v-if="runRows.length" class="peak-rows" data-testid="peak-run-times">
          <div class="peak-row peak-row--head">
            <span v-explain="'peakRunTarget'" class="peak-row__head-label">Run</span>
            <span v-explain="'peakRunNormal'" class="peak-row__head-label">Normal</span>
            <span v-explain="'peakRunThisPeriod'" class="peak-row__head-label">This period</span>
          </div>
          <component
            :is="canEdit ? 'button' : 'div'"
            v-for="row in runRows"
            :key="row.runTime.runTimeId"
            :type="canEdit ? 'button' : undefined"
            class="peak-row"
            :class="{ 'peak-row--button': canEdit }"
            :aria-label="canEdit ? `${row.runTime.targetLabel}: ${row.thisPeriod}` : undefined"
            :disabled="canEdit && busy ? true : undefined"
            data-testid="peak-run-time"
            @click="canEdit && openRunTime(row.runTime)"
          >
            <span>{{ row.runTime.targetLabel }}</span>
            <span class="peak-row__soft">{{ row.runTime.normalTime || '—' }}</span>
            <span class="peak-row__cell">
              <span>{{ row.thisPeriod }}</span>
              <span v-if="row.outside" class="peak-row__sub">Outside the dates</span>
            </span>
          </component>
        </div>
        <p v-else class="section-note">No runs moved.</p>
      </StaticPageSection>

      <StaticPageSection v-if="heldRuns.length">
        <template #header>
          <h2 v-explain="'peakHeldRuns'" class="static-page-section-heading">Waits for peak hours</h2>
        </template>
        <div class="peak-rows" data-testid="peak-held-runs">
          <div v-for="(held, index) in heldRuns" :key="index" class="peak-row" data-testid="peak-held-run">
            <span>{{ held.targetLabel }}</span>
            <span class="peak-row__soft">{{ held.normalTime }}</span>
            <span class="peak-row__cell">
              <span>{{ held.startsAt }}</span>
              <span class="peak-row__sub">{{ held.reason }}</span>
            </span>
          </div>
        </div>
      </StaticPageSection>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'settings-tenant-peak-periods' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to peak periods"
          title="Back to peak periods"
          data-testid="peak-back"
        >
          <AppIcon name="back" />
        </RouterLink>
        <AppSaveAction
          v-if="canEdit && draft"
          label="Save peak period"
          test-id="peak-save"
          :dirty="dirty"
          :disabled="busy || !canSave"
          @click="save"
        />
        <button
          v-if="canEdit && draft"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger"
          aria-label="Delete peak period"
          data-testid="peak-delete"
          :disabled="busy"
          @click="openPopup('delete')"
        >
          <AppIcon name="trash" />
        </button>
      </div>
    </template>
  </StaticPageFrame>

  <div
    v-if="activePopup && draft"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="peak-popup-title"
    @click.self="closePopup"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="peak-popup-title">{{ popupTitle }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          v-if="activePopup === 'dates'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="When is the peak?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="peak-dates-save"
          :submit-disabled="!calendar.startDate.value || !calendar.endDate.value"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="peak-dates-cancel"
          @cancel="closePopup"
          @submit="saveDates"
        >
          <WorkflowDateRangeCalendar :calendar="calendar" test-id-prefix="peak-dates" />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'hours'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="When are the systems busiest?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="peak-hours-save"
          :submit-disabled="Boolean(hoursForm.start) !== Boolean(hoursForm.end)"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="peak-hours-cancel"
          @cancel="closePopup"
          @submit="saveHours"
        >
          <div class="peak-popup-pair">
            <label class="wizard-input-shell">
              <span v-explain="'peakHours'" class="workflow-context-label">From · {{ timeZone || 'tenant zone' }}</span>
              <WorkflowTimeSelect v-model="hoursForm.start" test-id="peak-hours-from" aria-label="From" />
            </label>
            <label class="wizard-input-shell">
              <span v-explain="'peakHours'" class="workflow-context-label">To</span>
              <WorkflowTimeSelect v-model="hoursForm.end" test-id="peak-hours-to" aria-label="To" />
            </label>
          </div>
          <template #links>
            <button
              type="button"
              class="login-text-link"
              aria-label="Clear peak hours"
              data-testid="peak-hours-clear"
              :disabled="!hoursForm.start && !hoursForm.end"
              @click="clearHours"
            >
              Clear
            </button>
          </template>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'hotwax'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="How much of the HotWax read budget can Darpan use?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="peak-hotwax-save"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="peak-hotwax-cancel"
          @cancel="closePopup"
          @submit="saveHotwax"
        >
          <label class="wizard-input-shell">
            <span v-explain="'peakHotwaxReads'" class="workflow-context-label">HotWax reads</span>
            <AppSelect v-model="hotwaxForm" :options="HOTWAX_OPTIONS" test-id="peak-hotwax-select" />
          </label>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'netsuite'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="How many NetSuite requests at once?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="peak-netsuite-save"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="peak-netsuite-cancel"
          @cancel="closePopup"
          @submit="saveNetsuite"
        >
          <label class="wizard-input-shell">
            <span v-explain="'peakNetsuiteReads'" class="workflow-context-label">NetSuite reads</span>
            <AppSelect v-model="netsuiteForm" :options="NETSUITE_OPTIONS" test-id="peak-netsuite-select" />
          </label>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'runTime'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="When should it run in this period?"
          :show-primary-action="false"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="peak-popup-error" />
          <label class="wizard-input-shell">
            <span v-explain="'peakRunTarget'" class="workflow-context-label">Run</span>
            <AppSelect
              v-model="runForm.target"
              :options="targetOptions"
              placeholder="Select run"
              test-id="peak-run-time-target"
              searchable
              search-placeholder="Search runs"
            />
          </label>
          <div class="peak-popup-pair">
            <label class="wizard-input-shell">
              <span v-explain="'peakRunOn'" class="workflow-context-label">On</span>
              <AppSelect v-model="runForm.onDate" :options="dayOptions" test-id="peak-run-time-on" />
            </label>
            <label class="wizard-input-shell">
              <span v-explain="'peakRunAt'" class="workflow-context-label">At · {{ timeZone || 'tenant zone' }}</span>
              <WorkflowTimeSelect v-model="runForm.runTime" test-id="peak-run-time-at" aria-label="At" />
            </label>
          </div>
          <div class="wizard-actions">
            <AppSaveAction
              label="Save run time"
              test-id="peak-run-time-save"
              :disabled="popupBusy || !runForm.target || !runForm.runTime"
              @click="saveRunTime"
            />
            <button
              v-if="runForm.runTimeId"
              type="button"
              class="app-icon-action app-icon-action--large app-icon-action--danger"
              aria-label="Delete run time"
              data-testid="peak-run-time-delete"
              :disabled="popupBusy"
              @click="deleteRunTime"
            >
              <AppIcon name="trash" />
            </button>
            <AppCancelAction test-id="peak-run-time-cancel" :disabled="popupBusy" @click="closePopup" />
          </div>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'sync'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          :question="syncForm.kind === 'allowance' ? 'How long can an order wait in this period?' : 'How often should the pulse check in this period?'"
          :show-primary-action="false"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="peak-popup-error" />
          <label class="wizard-input-shell">
            <span v-explain="syncForm.kind === 'allowance' ? 'peakSyncLag' : 'peakSyncPulse'" class="workflow-context-label">{{ syncForm.label }}</span>
            <AppSelect
              v-model="syncForm.value"
              :options="syncForm.kind === 'allowance' ? SYNC_ALLOWANCE_OPTIONS : SYNC_PULSE_OPTIONS"
              test-id="peak-sync-select"
            />
          </label>
          <div class="wizard-actions">
            <AppSaveAction label="Save" test-id="peak-sync-save" :disabled="popupBusy" @click="saveSync" />
            <AppCancelAction test-id="peak-sync-cancel" :disabled="popupBusy" @click="closePopup" />
          </div>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'delete'"
          class="workflow-form--popup-compact"
          :question="`Delete ${draft.periodName}?`"
          :show-primary-action="false"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="peak-popup-error" />
          <p class="section-note">Its runs go back to their normal times.</p>
          <div class="wizard-actions">
            <button
              type="button"
              class="app-icon-action app-icon-action--large app-icon-action--danger"
              aria-label="Confirm delete"
              data-testid="peak-delete-confirm"
              :disabled="popupBusy"
              @click="deletePeriod"
            >
              <AppIcon name="trash" />
            </button>
            <AppCancelAction test-id="peak-delete-cancel" :disabled="popupBusy" @click="closePopup" />
          </div>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
// DAR-BE-328. One peak period on a page of its own: its name and on/off, its dates and peak hours, the runs it moves
// and the runs that wait for its peak hours. The title, the switch and the four facts only change this page until
// Save; a run time saves from its own popup, once the period exists. The backend validates every save and its
// sentences show as they come.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppCancelAction from '../../components/ui/AppCancelAction.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticRecordTitle from '../../components/ui/StaticRecordTitle.vue'
import WorkflowDateRangeCalendar from '../../components/workflow/WorkflowDateRangeCalendar.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowTimeSelect from '../../components/workflow/WorkflowTimeSelect.vue'
import { useCalendarWidget } from '../../composables/useCalendarWidget'
import { peakFacade } from '../../lib/api/facade'
import type { GetPeakPeriodResponse, PeakHeldRun, PeakPeriod, PeakRunTime, PeakSyncRow, PeakTarget } from '../../lib/api/peakTypes'
import { peakDateRange, peakDay } from '../../lib/peakPeriodWords'
import { ALLOWANCE_CHOICES, PULSE_EVERY_CHOICES, allowanceWords, pulseCadence } from '../../lib/pulseWords'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import { addDays, todayInDisplayTimeZone } from '../../lib/utils/date'
import { plainPairLabel } from '../../lib/syncPulseView'
import { usePermissionsStore } from '../../stores/permissions'

interface Draft {
  peakPeriodId: string
  periodName: string
  fromDate: string
  thruDate: string
  /** "HH:mm", or '' when the period has no peak hours. */
  peakHoursStart: string
  peakHoursEnd: string
  /** Share of HotWax's read budget Darpan may use in the period; null is normal. */
  hotwaxReadSharePct: number | null
  netsuiteSerial: boolean
  isActive: boolean
}

type Popup = 'dates' | 'hours' | 'hotwax' | 'netsuite' | 'runTime' | 'sync' | 'delete'

const NORMAL = 'normal'
const HOTWAX_OPTIONS = [
  { value: NORMAL, label: 'Normal' },
  ...[10, 25, 50, 75].map((pct) => ({ value: String(pct), label: `${pct}%` })),
]
const SYNC_ALLOWANCE_OPTIONS = [
  { value: NORMAL, label: 'Normal' },
  ...ALLOWANCE_CHOICES.map((minutes) => ({ value: String(minutes), label: allowanceWords(minutes) })),
]
// Off is an override of its own (0 minutes); only Normal means no override.
const SYNC_PULSE_OPTIONS = [
  { value: NORMAL, label: 'Normal' },
  ...PULSE_EVERY_CHOICES.map((minutes) => ({
    value: String(minutes ?? 0),
    label: minutes ? `Every ${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}` : 'Off',
  })),
]
const PARALLEL = 'parallel'
const SERIAL = 'serial'
const NETSUITE_OPTIONS = [
  { value: PARALLEL, label: 'Parallel' },
  { value: SERIAL, label: 'One at a time' },
]

const EVERY_DAY = 'every'
// A period is planned ahead, so the calendar runs two years forward rather than stopping at today (the tenant's day).
const PICKABLE_DAYS_AHEAD = 730

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const routePeriodId = computed(() => String(route.params.peakPeriodId ?? ''))

const saved = ref<PeakPeriod | null>(null)
const runTimes = ref<PeakRunTime[]>([])
const heldRuns = ref<PeakHeldRun[]>([])
const targets = ref<PeakTarget[]>([])
const syncRows = ref<PeakSyncRow[]>([])
const loading = ref(false)
const pageError = ref('')

const draft = ref<Draft | null>(null)
const baseline = ref('')
const saving = ref(false)

const activePopup = ref<Popup | null>(null)
const popupBusy = ref(false)
const popupError = ref('')
const hoursForm = ref({ start: '', end: '' })
const hotwaxForm = ref(NORMAL)
const netsuiteForm = ref(PARALLEL)
const syncForm = ref<{ kind: 'allowance' | 'pulse'; syncPairId: string; label: string; value: string }>({
  kind: 'allowance', syncPairId: '', label: '', value: NORMAL,
})
const runForm = ref({ runTimeId: '', target: '', onDate: EVERY_DAY, runTime: '' })

const calendar = useCalendarWidget({ lastPickableDate: () => addDays(todayInDisplayTimeZone(), PICKABLE_DAYS_AHEAD) })

const busy = computed(() => saving.value || popupBusy.value)
const timeZone = computed(() => saved.value?.timeZone ?? '')

function snapshot(): string {
  return JSON.stringify(draft.value)
}
const dirty = computed(() => Boolean(draft.value) && snapshot() !== baseline.value)
const canSave = computed(() => Boolean(draft.value?.periodName.trim() && draft.value.fromDate && draft.value.thruDate))

const datesText = computed(() => {
  const current = draft.value
  return current?.fromDate && current.thruDate ? peakDateRange(current.fromDate, current.thruDate) : 'Not set'
})
const hoursSet = computed(() => Boolean(draft.value?.peakHoursStart && draft.value.peakHoursEnd))
const hoursText = computed(() => (hoursSet.value ? `${draft.value?.peakHoursStart} – ${draft.value?.peakHoursEnd}` : 'None'))

const hotwaxText = computed(() => {
  const pct = draft.value?.hotwaxReadSharePct
  return pct ? `${pct}%` : 'Normal'
})
const netsuiteText = computed(() => (draft.value?.netsuiteSerial ? 'One at a time' : 'Parallel'))

const facts = computed<StaticFact[]>(() => {
  const changeable = { interactive: canEdit.value, disabled: busy.value }
  return [
    { key: 'dates', label: 'Dates', value: datesText.value, sub: timeZone.value, explain: 'peakDates',
      testId: 'peak-fact-dates', ...changeable },
    { key: 'hours', label: 'Peak hours', value: hoursText.value, sub: hoursSet.value ? 'heavy runs wait' : '',
      explain: 'peakHours', testId: 'peak-fact-hours', ...changeable },
    { key: 'hotwax', label: 'HotWax reads', value: hotwaxText.value, sub: 'of its read budget',
      explain: 'peakHotwaxReads', testId: 'peak-fact-hotwax', ...changeable },
    { key: 'netsuite', label: 'NetSuite reads', value: netsuiteText.value, sub: 'this period',
      explain: 'peakNetsuiteReads', testId: 'peak-fact-netsuite', ...changeable },
  ]
})

function openFact(key: string): void {
  if (key === 'dates') openDates()
  else if (key === 'hours') openHours()
  else if (key === 'hotwax') openHotwax()
  else openNetsuite()
}

/** Inside the page's dates, as the facts show them; a run time on a day they no longer cover stays, marked. */
function outsideDates(onDate: string | null): boolean {
  const current = draft.value
  if (!onDate || !current?.fromDate || !current.thruDate) return false
  return onDate < current.fromDate || onDate > current.thruDate
}

const runRows = computed(() => runTimes.value.map((runTime) => ({
  runTime,
  thisPeriod: runTime.onDate ? `${runTime.runTime} on ${peakDay(runTime.onDate)}` : `${runTime.runTime} every day`,
  outside: outsideDates(runTime.onDate),
})))

function targetKey(target: { automationId?: string | null; auditId?: string | null }): string {
  if (target.automationId) return `automation:${target.automationId}`
  return target.auditId ? `audit:${target.auditId}` : ''
}

const targetOptions = computed(() => {
  const options = targets.value.map((target) => ({ value: targetKey(target), label: target.label }))
  // A moved run no longer offered (deleted, or no schedule now) still shows as itself.
  const editing = runTimes.value.find((runTime) => runTime.runTimeId === runForm.value.runTimeId)
  if (editing && !options.some((option) => option.value === targetKey(editing))) {
    options.push({ value: targetKey(editing), label: editing.targetLabel })
  }
  return options
})

/** "YYYY-MM-DD" for each day from one date to another, both included. */
function daysBetween(fromDate: string, thruDate: string): string[] {
  const days: string[] = []
  const [y = 0, m = 1, d = 1] = fromDate.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d))
  while (days.length <= PICKABLE_DAYS_AHEAD) {
    const value = day.toISOString().slice(0, 10)
    if (value > thruDate) break
    days.push(value)
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return days
}

/** The dates were changed and not saved yet: the server still checks a run time against the saved ones. */
const datesDirty = computed(() => Boolean(draft.value && saved.value)
  && (draft.value?.fromDate !== saved.value?.fromDate || draft.value?.thruDate !== saved.value?.thruDate))

// The saved dates, which the server checks a run time's date against; never the unsaved ones in the draft.
const dayOptions = computed(() => {
  const period = saved.value
  const days = period?.fromDate && period.thruDate ? daysBetween(period.fromDate, period.thruDate) : []
  const chosen = runForm.value.onDate
  if (chosen !== EVERY_DAY && !days.includes(chosen)) days.push(chosen)
  return [{ value: EVERY_DAY, label: 'Every day' }, ...days.map((day) => ({ value: day, label: peakDay(day) }))]
})

const popupTitle = computed(() => {
  switch (activePopup.value) {
    case 'dates': return 'Dates'
    case 'hours': return 'Peak hours'
    case 'hotwax': return 'HotWax reads'
    case 'netsuite': return 'NetSuite reads'
    case 'runTime': return 'Run time'
    case 'sync': return syncForm.value.kind === 'allowance' ? 'Sync lag allowance' : 'Sync pulse'
    case 'delete': return 'Delete peak period'
    default: return ''
  }
})

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** A refusal returned rather than thrown: the server's own sentences. */
function refusalOf(response: { ok?: boolean; errors?: string[] }, fallback: string): string {
  if (response.ok !== false) return ''
  return response.errors?.length ? response.errors.join(' ') : fallback
}

// DAR-UI-161: a new period is made by its workflow (TenantPeakPeriodCreatePage), so this page always has one to read.
function resetDraft(): void {
  const period = saved.value
  draft.value = period
    ? {
        peakPeriodId: period.peakPeriodId,
        periodName: period.periodName,
        fromDate: period.fromDate,
        thruDate: period.thruDate,
        peakHoursStart: period.peakHoursStart ?? '',
        peakHoursEnd: period.peakHoursEnd ?? '',
        hotwaxReadSharePct: period.hotwaxReadSharePct ?? null,
        netsuiteSerial: period.netsuiteSerial === 'Y',
        isActive: period.isActive !== 'N',
      }
    : null
  baseline.value = snapshot()
}

function apply(response: GetPeakPeriodResponse): void {
  saved.value = response.peakPeriod
  runTimes.value = response.runTimes ?? []
  heldRuns.value = response.heldRuns ?? []
  targets.value = response.targets ?? []
  syncRows.value = response.syncRows ?? []
}

/** Reads the period again. The draft starts over from it only when asked; a run-time change keeps unsaved edits. */
async function read(peakPeriodId: string, restartDraft: boolean, stillCurrent: () => boolean = () => true): Promise<void> {
  const response = await peakFacade.getPeakPeriod({ peakPeriodId })
  const refusal = refusalOf(response, 'Could not load the peak period.')
  if (refusal) throw new Error(refusal)
  if (!stillCurrent()) return
  apply(response)
  if (restartDraft) resetDraft()
}

async function load(peakPeriodId: string): Promise<void> {
  loading.value = true
  pageError.value = ''
  draft.value = null
  saved.value = null
  runTimes.value = []
  heldRuns.value = []
  targets.value = []
  syncRows.value = []
  try {
    await read(peakPeriodId, true)
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the peak period.')
  } finally {
    loading.value = false
  }
}

function renameDraft(name: string): void {
  if (draft.value) draft.value.periodName = name
}

function setActive(on: boolean): void {
  if (draft.value) draft.value.isActive = on
}

function openPopup(popup: Popup): void {
  if (!canEdit.value || busy.value) return
  popupError.value = ''
  activePopup.value = popup
}

function closePopup(): void {
  if (popupBusy.value) return
  activePopup.value = null
  popupError.value = ''
}

function openDates(): void {
  const current = draft.value
  if (!current) return
  calendar.startDate.value = current.fromDate
  calendar.endDate.value = current.thruDate
  calendar.selecting.value = 'start'
  // A saved period always has its dates (the server refuses one without), so the calendar opens on them.
  calendar.focusVisibleMonthAroundStart()
  openPopup('dates')
}

function saveDates(): void {
  const current = draft.value
  if (!current || !calendar.startDate.value || !calendar.endDate.value) return
  current.fromDate = calendar.startDate.value
  current.thruDate = calendar.endDate.value
  closePopup()
}

function openHours(): void {
  const current = draft.value
  if (!current) return
  hoursForm.value = { start: current.peakHoursStart, end: current.peakHoursEnd }
  openPopup('hours')
}

function clearHours(): void {
  hoursForm.value = { start: '', end: '' }
}

function saveHours(): void {
  const current = draft.value
  const { start, end } = hoursForm.value
  if (!current || Boolean(start) !== Boolean(end)) return
  current.peakHoursStart = start
  current.peakHoursEnd = end
  closePopup()
}

function openHotwax(): void {
  const current = draft.value
  if (!current) return
  hotwaxForm.value = current.hotwaxReadSharePct ? String(current.hotwaxReadSharePct) : NORMAL
  openPopup('hotwax')
}

function saveHotwax(): void {
  const current = draft.value
  if (!current) return
  current.hotwaxReadSharePct = hotwaxForm.value === NORMAL ? null : Number(hotwaxForm.value)
  closePopup()
}

function openNetsuite(): void {
  const current = draft.value
  if (!current) return
  netsuiteForm.value = current.netsuiteSerial ? SERIAL : PARALLEL
  openPopup('netsuite')
}

function saveNetsuite(): void {
  const current = draft.value
  if (!current) return
  current.netsuiteSerial = netsuiteForm.value === SERIAL
  closePopup()
}

function openRunTime(runTime: PeakRunTime | null): void {
  if (!draft.value?.peakPeriodId) return
  runForm.value = runTime
    ? { runTimeId: runTime.runTimeId, target: targetKey(runTime), onDate: runTime.onDate ?? EVERY_DAY, runTime: runTime.runTime }
    : { runTimeId: '', target: '', onDate: EVERY_DAY, runTime: '' }
  openPopup('runTime')
}

function openSync(kind: 'allowance' | 'pulse', row: PeakSyncRow): void {
  if (!draft.value?.peakPeriodId) return
  const current = kind === 'allowance' ? row.periodAllowanceMinutes : row.periodPulseMinutes
  syncForm.value = { kind, syncPairId: row.syncPairId, label: plainPairLabel(row.label), value: current === null ? NORMAL : String(current) }
  openPopup('sync')
}

/** A pair's override is one record: both values Normal removes it, anything else saves both as they now stand. */
async function saveSync(): Promise<void> {
  const peakPeriodId = draft.value?.peakPeriodId
  const form = syncForm.value
  const row = syncRows.value.find((candidate) => candidate.syncPairId === form.syncPairId)
  if (!peakPeriodId || !row || popupBusy.value) return
  const chosen = form.value === NORMAL ? null : Number(form.value)
  const allowance = form.kind === 'allowance' ? chosen : row.periodAllowanceMinutes
  const pulse = form.kind === 'pulse' ? chosen : row.periodPulseMinutes
  popupBusy.value = true
  popupError.value = ''
  try {
    const out = allowance === null && pulse === null
      ? await peakFacade.deletePeakSync({ peakPeriodId, syncPairId: form.syncPairId })
      : await peakFacade.savePeakSync({
          peakPeriodId,
          syncPairId: form.syncPairId,
          ...(allowance !== null || form.kind === 'allowance' ? { allowanceMinutes: allowance } : {}),
          ...(pulse !== null || form.kind === 'pulse' ? { pulseEveryMinutes: pulse } : {}),
        })
    const refusal = refusalOf(out, 'Could not save the sync setting.')
    if (refusal) {
      popupError.value = refusal
      return
    }
    popupBusy.value = false
    closePopup()
    await refresh(peakPeriodId)
  } catch (error) {
    popupError.value = messageOf(error, 'Could not save the sync setting.')
  } finally {
    popupBusy.value = false
  }
}

async function saveRunTime(): Promise<void> {
  const peakPeriodId = draft.value?.peakPeriodId
  const form = runForm.value
  if (!peakPeriodId || popupBusy.value || !form.target || !form.runTime) return
  const separator = form.target.indexOf(':')
  const kind = form.target.slice(0, separator)
  const targetId = form.target.slice(separator + 1)
  popupBusy.value = true
  popupError.value = ''
  try {
    const out = await peakFacade.savePeakRunTime({
      ...(form.runTimeId ? { runTimeId: form.runTimeId } : {}),
      peakPeriodId,
      ...(kind === 'automation' ? { automationId: targetId } : { auditId: targetId }),
      // Left out, the move is for every day of the period.
      ...(form.onDate !== EVERY_DAY ? { onDate: form.onDate } : {}),
      runTime: form.runTime,
    })
    const refusal = refusalOf(out, 'Could not save the run time.')
    if (refusal) {
      popupError.value = refusal
      return
    }
    popupBusy.value = false
    closePopup()
    await refresh(peakPeriodId)
  } catch (error) {
    popupError.value = messageOf(error, 'Could not save the run time.')
  } finally {
    popupBusy.value = false
  }
}

async function deleteRunTime(): Promise<void> {
  const peakPeriodId = draft.value?.peakPeriodId
  const runTimeId = runForm.value.runTimeId
  if (!peakPeriodId || !runTimeId || popupBusy.value) return
  popupBusy.value = true
  popupError.value = ''
  try {
    const out = await peakFacade.deletePeakRunTime({ runTimeId })
    const refusal = refusalOf(out, 'Could not delete the run time.')
    if (refusal) {
      popupError.value = refusal
      return
    }
    popupBusy.value = false
    closePopup()
    await refresh(peakPeriodId)
  } catch (error) {
    popupError.value = messageOf(error, 'Could not delete the run time.')
  } finally {
    popupBusy.value = false
  }
}

/** After a run-time change: its rows and the runs that wait, with this page's unsaved edits kept. */
// DAR-UI-156: a save that went out while this read was out makes its answer older than the page; it is dropped, and
// the period read again once that save has answered (reading sooner could fetch the old state again).
let savesSent = 0
let readOwed = ''
async function refresh(peakPeriodId: string): Promise<void> {
  const at = savesSent
  try {
    await read(peakPeriodId, false, () => savesSent === at)
    if (savesSent === at) return
    if (saving.value) readOwed = peakPeriodId
    else void refresh(peakPeriodId)
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the peak period.')
  }
}

async function deletePeriod(): Promise<void> {
  const peakPeriodId = draft.value?.peakPeriodId
  if (!peakPeriodId || popupBusy.value) return
  popupBusy.value = true
  popupError.value = ''
  try {
    const out = await peakFacade.deletePeakPeriod({ peakPeriodId })
    const refusal = refusalOf(out, 'Could not delete the peak period.')
    if (refusal) {
      popupError.value = refusal
      return
    }
    popupBusy.value = false
    closePopup()
    void router.push({ name: 'settings-tenant-peak-periods' })
  } catch (error) {
    popupError.value = messageOf(error, 'Could not delete the peak period.')
  } finally {
    popupBusy.value = false
  }
}

/** The period as the page now shows it, laid over what was read: what an edit's save stores. */
function savedFromDraft(period: PeakPeriod, current: Draft): PeakPeriod {
  return {
    ...period,
    periodName: current.periodName.trim(),
    fromDate: current.fromDate,
    thruDate: current.thruDate,
    peakHoursStart: current.peakHoursStart || null,
    peakHoursEnd: current.peakHoursEnd || null,
    hotwaxReadSharePct: current.hotwaxReadSharePct,
    netsuiteSerial: current.netsuiteSerial ? 'Y' : 'N',
    isActive: current.isActive ? 'Y' : 'N',
  }
}

/** One Save: name, dates, peak hours and on/off together. */
async function save(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value || !canSave.value) return
  saving.value = true
  pageError.value = ''
  savesSent += 1
  // DAR-UI-156 (Aditi: "UI changes should always be immediate.. backend can do its thing"). An edit shows as saved at
  // once. A refusal puts back the unsaved Save, with the typed values still on the page and the reason above them.
  const was = { saved: saved.value, baseline: baseline.value }
  // Which runs wait is the server's to work out from the dates, hours and on/off; only a change there reads it again.
  const waitsMove = Boolean(was.saved) && ((['fromDate', 'thruDate', 'peakHoursStart', 'peakHoursEnd'] as const)
    .some((key) => (was.saved?.[key] ?? '') !== current[key]) || (was.saved?.isActive !== 'N') !== current.isActive)
  if (saved.value) {
    saved.value = savedFromDraft(saved.value, current)
    baseline.value = snapshot()
  }
  const putBack = () => {
    saved.value = was.saved
    baseline.value = was.baseline
  }
  try {
    const out = await peakFacade.savePeakPeriod({
      peakPeriodId: current.peakPeriodId,
      periodName: current.periodName.trim(),
      fromDate: current.fromDate,
      thruDate: current.thruDate,
      // Blank clears them.
      peakHoursStart: current.peakHoursStart,
      peakHoursEnd: current.peakHoursEnd,
      // Normal is no share at all; the server checks 1 to 100.
      hotwaxReadSharePct: current.hotwaxReadSharePct,
      netsuiteSerial: current.netsuiteSerial,
      isActive: current.isActive,
    })
    const refusal = refusalOf(out, 'Could not save the peak period.')
    if (refusal) {
      putBack()
      pageError.value = refusal
      return
    }
    // Behind the page, which already shows the save: the runs that wait, with any new edits kept.
    if (waitsMove) void refresh(out.peakPeriodId)
  } catch (error) {
    putBack()
    pageError.value = messageOf(error, 'Could not save the peak period.')
  } finally {
    saving.value = false
    const owed = readOwed
    readOwed = ''
    if (owed) void refresh(owed)
  }
}

// Another period's address loads it; the same one (a re-navigation) keeps the page and its unsaved edits.
watch(routePeriodId, (id) => {
  if (id && id === draft.value?.peakPeriodId) return
  void load(id)
})

// Esc closes a popup; the run-time and delete popups have no cancel of WorkflowStepForm's own to catch it.
function handleCancelRequest(event: Event): void {
  if (!activePopup.value || popupBusy.value) return
  event.preventDefault()
  closePopup()
}

onMounted(() => {
  document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  void load(routePeriodId.value)
})

onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
})
</script>

<style scoped>

.peak-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

/* The run times and the runs that wait as bordered lists of even rows: run, its usual time, this period. */
.peak-rows {
  display: grid;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  overflow: hidden;
  font-size: var(--static-tile-text-size);
}

.peak-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 3.5rem;
  margin: 0;
  padding: var(--space-1) var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.peak-row + .peak-row {
  border-top: 1px solid var(--static-tile-border);
}

.peak-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.peak-row--head {
  min-height: 2.4rem;
}

.peak-row__head-label {
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.peak-row--button {
  cursor: pointer;
}

.peak-row--button:hover:not(:disabled) {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.peak-row--button:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: -2px;
}

.peak-row--button:disabled {
  opacity: 1;
  cursor: default;
}

.peak-row__soft {
  color: var(--text-soft);
}

.peak-row__cell {
  display: grid;
  gap: var(--space-00);
}

.peak-row__sub {
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

.peak-popup-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

@media (max-width: 768px) {
  .peak-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .peak-row > span:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .peak-popup-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
