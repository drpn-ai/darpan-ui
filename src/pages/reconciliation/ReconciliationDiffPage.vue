<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="Diff progress" :center-stage="shouldCenterStage">
    <InlineValidation v-if="loadError" tone="error" :message="loadError" />

    <EmptyState
      v-else-if="showEmptyState"
      icon="inbox"
      title="No runs available"
      description="Create a saved reconciliation run first, then come back to execute the diff."
      :action="createRunAction"
    />

    <template v-else>
      <div class="reconciliation-diff-layout">
        <div ref="stepFocusRegion" class="reconciliation-diff-main">
          <WorkflowStepForm
            class="workflow-step-shell"
            :question="currentQuestion"
            :primary-label="primaryButtonLabel"
            :submit-disabled="!canContinue || running || loadingMappings"
            :show-back="currentStepIndex > 0"
            :allow-select-enter="true"
            :allow-file-enter="isFileStepId(currentStep.id)"
            primary-test-id="reconciliation-step-primary"
            @submit="handlePrimaryAction"
            @back="goBack"
          >
            <label v-if="currentStep.id === 'run'" class="wizard-input-shell">
              <WorkflowSelect
                v-model="selectedSavedRunId"
                test-id="saved-run-select"
                :disabled="loadingMappings || savedRuns.length === 0"
                :options="savedRunOptions"
                placeholder="Select a run..."
              />
            </label>

            <label
              v-else-if="currentStep.id === 'system-1' || currentStep.id === 'system-2'"
              class="wizard-input-shell"
            >
              <WorkflowSelect
                v-model="activeSystemValue"
                :test-id="currentStep.id === 'system-1' ? 'file1-system-select' : 'file2-system-select'"
                :options="systemSelectOptions"
                placeholder="Select system..."
              />
            </label>

            <WorkflowShortcutChoiceCards
              v-else-if="currentStep.id === 'api-window'"
              class="wizard-api-preset-choice"
              :options="apiWindowPresetOptions"
              :selected-value="apiWindowPreset"
              test-id-prefix="api-window-preset"
              @choose="chooseApiWindowPresetChoice"
            />

            <div v-else-if="currentStep.id === 'api-window-custom'" class="wizard-api-range-selector wizard-input-shell">
              <div class="wizard-api-range-panel wizard-api-range-panel--custom">
                <div class="wizard-api-window-shell">
                  <button
                    type="button"
                    :class="[
                      'wizard-api-window-field',
                      { 'wizard-api-window-field--active': customApiWindowSelecting === 'start' },
                    ]"
                    data-testid="api-window-custom-start"
                    @click="setCustomDateSelectionSide('start')"
                  >
                    <span class="workflow-context-label">Start</span>
                    <span :class="['wizard-api-window-value', { empty: !customApiWindowStartDate }]">
                      {{ customApiWindowStartLabel }}
                    </span>
                  </button>
                  <button
                    type="button"
                    :class="[
                      'wizard-api-window-field',
                      { 'wizard-api-window-field--active': customApiWindowSelecting === 'end' },
                    ]"
                    data-testid="api-window-custom-end"
                    @click="setCustomDateSelectionSide('end')"
                  >
                    <span class="workflow-context-label">End</span>
                    <span :class="['wizard-api-window-value', { empty: !customApiWindowEndDate }]">
                      {{ customApiWindowEndLabel }}
                    </span>
                  </button>
                </div>

                <div class="wizard-api-calendar-grid">
                  <section
                    v-for="(month, monthIndex) in customCalendarMonths"
                    :key="month.key"
                    class="wizard-api-calendar-month"
                  >
                    <div class="wizard-api-calendar-month__head">
                      <button
                        v-if="monthIndex === 0"
                        type="button"
                        class="wizard-api-calendar-nav"
                        aria-label="Show previous month"
                        data-testid="api-window-custom-previous-month"
                        @click="shiftCustomCalendarMonth(-1)"
                      >
                        ‹
                      </button>
                      <span v-else class="wizard-api-calendar-nav-spacer" aria-hidden="true"></span>
                      <h3>{{ month.label }}</h3>
                      <button
                        v-if="monthIndex === customCalendarMonths.length - 1 && canShiftCustomCalendarMonth(1)"
                        type="button"
                        class="wizard-api-calendar-nav"
                        aria-label="Show next month"
                        data-testid="api-window-custom-next-month"
                        @click="shiftCustomCalendarMonth(1)"
                      >
                        ›
                      </button>
                      <span v-else class="wizard-api-calendar-nav-spacer" aria-hidden="true"></span>
                    </div>
                    <div class="wizard-api-calendar-weekdays" aria-hidden="true">
                      <span v-for="(weekday, weekdayIndex) in weekdayLabels" :key="`${month.key}-${weekdayIndex}`">
                        {{ weekday }}
                      </span>
                    </div>
                    <div class="wizard-api-calendar-days">
                      <button
                        v-for="cell in month.cells"
                        :key="cell.key"
                        type="button"
                        class="wizard-api-calendar-day"
                        :class="customCalendarCellClasses(cell)"
                        :disabled="isCustomCalendarCellDisabled(cell)"
                        :data-testid="cell.isCurrentMonth ? `api-window-custom-day-${cell.key}` : undefined"
                        @click="selectCustomCalendarDate(cell)"
                      >
                        <span class="wizard-api-calendar-day__label">{{ cell.day }}</span>
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <label v-else-if="isFileStepId(currentStep.id)" class="wizard-file-shell wizard-input-shell">
              <input
                :key="`${currentStep.id}-${inputResetKey}`"
                class="wizard-file-input"
                type="file"
                :accept="activeFileAccept"
                :data-testid="currentStep.id === 'file-1' ? 'file1-input' : 'file2-input'"
                :aria-label="currentStep.id === 'file-1' ? 'Upload file one' : 'Upload file two'"
                @change="currentStep.id === 'file-1' ? onFile1Change($event) : onFile2Change($event)"
              />
              <span :class="['wizard-answer-control', 'wizard-file-answer', { empty: !activeFile?.name }]">
                {{ activeFile?.name || activeFilePlaceholder }}
              </span>
            </label>

            <InlineValidation v-if="runError" tone="error" :message="runError" />
          </WorkflowStepForm>

          <div v-if="pendingSubmittedRun" class="reconciliation-run-submitted-hint" data-testid="run-submitted-hint">
            <p>Run submitted. This can take a while. You can leave this page and come back later from run history.</p>
            <RouterLink
              v-if="runHistoryRoute"
              class="reconciliation-run-history-link"
              data-testid="run-submitted-history-link"
              :to="runHistoryRoute"
            >
              Open run history
            </RouterLink>
          </div>

          <section v-if="hasFeedbackMessages" class="workflow-feedback-board">
            <article v-if="validationErrors.length > 0" class="card workflow-panel">
              <p class="eyebrow">validation</p>
              <h4>Validation messages</h4>
              <ul class="workflow-list">
                <li v-for="(message, index) in validationErrors" :key="`validation-${index}`">{{ message }}</li>
              </ul>
            </article>

            <article v-if="processingWarnings.length > 0" class="card workflow-panel">
              <p class="eyebrow">warnings</p>
              <h4>Processing warnings</h4>
              <ul class="workflow-list">
                <li v-for="(message, index) in processingWarnings" :key="`warning-${index}`">{{ message }}</li>
              </ul>
            </article>
          </section>
        </div>

        <section v-if="showLatestSavedOutputBoard" class="reconciliation-run-history-board">
          <p v-if="latestSavedOutputLoading" class="section-note" data-testid="latest-run-result-loading">Loading saved results…</p>
          <InlineValidation v-else-if="latestSavedOutputError" tone="error" :message="latestSavedOutputError" />
          <template v-else-if="latestSavedOutput && latestSavedOutputRoute">
            <RouterLink
              class="reconciliation-run-history-card reconciliation-run-history-card--link"
              data-testid="latest-run-result"
              :to="latestSavedOutputRoute"
            >
              <div class="reconciliation-run-history-card__head">
                <span class="reconciliation-run-history-card__date">{{ formatSavedResultDateTime(latestSavedOutput.createdDate) }}</span>
              </div>
              <dl class="reconciliation-run-history-card__metrics">
                <div>
                  <dt>Total differences</dt>
                  <dd>{{ latestSavedOutput.totalDifferences ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Missing from {{ latestSavedOutput.file1Label || file1PromptSystemName }}</dt>
                  <dd>{{ latestSavedOutput.onlyInFile2Count ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Missing from {{ latestSavedOutput.file2Label || file2PromptSystemName }}</dt>
                  <dd>{{ latestSavedOutput.onlyInFile1Count ?? 0 }}</dd>
                </div>
              </dl>
            </RouterLink>
          </template>
          <RouterLink
            v-if="latestSavedOutput && runHistoryRoute"
            class="reconciliation-run-history-link"
            data-testid="view-all-run-results"
            :to="runHistoryRoute"
          >
            View all previous runs
          </RouterLink>
        </section>
      </div>
    </template>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import WorkflowShortcutChoiceCards, {
  type WorkflowShortcutChoiceOption,
} from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type { SavedRunSummary, SavedRunSystemOption } from '../../lib/api/types'
import type { RunSavedRunDiffPayload } from '../../lib/api/facadeTypes'
import {
  clearPendingReconciliationRun,
  recordPendingReconciliationRun,
  type PendingReconciliationRun,
} from '../../lib/reconciliationPendingRuns'
import {
  buildReconciliationRunHistoryRoute,
  buildReconciliationRunLiveRoute,
  buildReconciliationRunResultRoute,
  type ReconciliationRunRouteContext,
} from '../../lib/reconciliationRoutes'
import {
  addDays,
  displayDayStart,
  formatDateInputValue,
  formatMonthLabel,
  formatSavedResultDateTime,
  todayInDisplayTimeZone,
} from '../../lib/utils/date'
import { useCalendarWidget, type CalendarRange } from '../../composables/useCalendarWidget'
import { useReconciliationDiff } from '../../composables/useReconciliationDiff'
import { usePermissionsStore } from '../../stores/permissions'
import { isActiveRunStatus } from '../../stores/runResults'

interface UploadStep {
  id: 'run' | 'system-1' | 'api-window' | 'api-window-custom' | 'file-1' | 'system-2' | 'file-2'
}

type ExpectedFileType = 'CSV' | 'JSON' | null
type FileStepId = 'file-1' | 'file-2'
type UploadPayloadKey = 'file1Name' | 'file1Text' | 'file2Name' | 'file2Text'
type ApiWindowPreset = 'previous-day' | 'previous-week' | 'previous-month' | 'custom'

interface ApiWindowPresetOption extends WorkflowShortcutChoiceOption {
  value: ApiWindowPreset
}

interface ApiWindowRange extends CalendarRange {
  summary: string
}

interface UploadSourceInput {
  file: File | null
  fileNameKey: Extract<UploadPayloadKey, 'file1Name' | 'file2Name'>
  fileTextKey: Extract<UploadPayloadKey, 'file1Text' | 'file2Text'>
  systemName: string
  expectedFileType: ExpectedFileType
}

const SOURCE_TYPE_API = 'AUT_SRC_API'
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()

const diff = useReconciliationDiff()
const {
  savedRuns,
  loadingSavedRuns: loadingMappings,
  loadError,
  latestSavedOutput,
  latestSavedOutputLoading,
  latestSavedOutputError,
  runError,
  running,
  validationErrors,
  processingWarnings,
} = diff

const calendar = useCalendarWidget()
const {
  startDate: customApiWindowStartDate,
  endDate: customApiWindowEndDate,
  selecting: customApiWindowSelecting,
  endDateValue: customApiWindowEndDateValue,
  calendarMonths: customCalendarMonths,
} = calendar

const selectedSavedRunId = ref('')
const file1SystemEnumId = ref('')
const file2SystemEnumId = ref('')
const file1 = ref<File | null>(null)
const file2 = ref<File | null>(null)
const apiWindowPreset = ref<ApiWindowPreset | ''>('')
const pendingSubmittedRun = ref<PendingReconciliationRun | null>(null)
const currentStepIndex = ref(0)
const inputResetKey = ref(0)
const stepFocusRegion = ref<HTMLElement | null>(null)

const requestedSavedRunId = computed(() =>
  typeof route.query.savedRunId === 'string' ? route.query.savedRunId.trim() : '',
)
const requestedRunName = computed(() => (typeof route.query.runName === 'string' ? route.query.runName.trim() : ''))
const requestedFile1SystemLabel = computed(() =>
  typeof route.query.file1SystemLabel === 'string' ? route.query.file1SystemLabel.trim() : '',
)
const requestedFile2SystemLabel = computed(() =>
  typeof route.query.file2SystemLabel === 'string' ? route.query.file2SystemLabel.trim() : '',
)
const showEmptyState = computed(() => !loadingMappings.value && savedRuns.value.length === 0 && !loadError.value)
const createRunAction = computed(() =>
  permissionsStore.canEditTenantSettings
    ? { label: 'Create a run', to: { name: 'reconciliation-create' } as RouteLocationRaw }
    : undefined,
)
const selectedSavedRun = computed(() => savedRuns.value.find((savedRun) => savedRun.savedRunId === selectedSavedRunId.value) ?? null)
const savedRunOptions = computed(() =>
  savedRuns.value.map((savedRun) => ({ value: savedRun.savedRunId, label: savedRun.runName })),
)
const selectedSystemOptions = computed<SavedRunSystemOption[]>(() => selectedSavedRun.value?.systemOptions ?? [])
const systemSelectOptions = computed(() =>
  selectedSystemOptions.value.map((option) => ({
    value: option.enumId,
    label: option.label || option.description || option.enumCode || option.enumId,
  })),
)
const file1SystemOption = computed(() => resolveSystemOptionForFileSide('FILE_1', file1SystemEnumId.value))
const file2SystemOption = computed(() => resolveSystemOptionForFileSide('FILE_2', file2SystemEnumId.value))
const file1UsesApi = computed(() => isApiSource(file1SystemOption.value))
const file2UsesApi = computed(() => isApiSource(file2SystemOption.value))
const hasApiSource = computed(() => file1UsesApi.value || file2UsesApi.value)
const file1ExpectedFileType = computed<ExpectedFileType>(() => resolveExpectedFileType(file1SystemOption.value))
const file2ExpectedFileType = computed<ExpectedFileType>(() => resolveExpectedFileType(file2SystemOption.value))
const requiresSystemSelection = computed(() => selectedSavedRun.value?.requiresSystemSelection === true)
const shouldSkipMappingStep = computed(
  () => requestedSavedRunId.value.length > 0 && selectedSavedRun.value?.savedRunId === requestedSavedRunId.value,
)
const workflowSteps = computed<UploadStep[]>(() => {
  const steps: UploadStep[] = [{ id: 'run' }]
  if (requiresSystemSelection.value) {
    steps.push({ id: 'system-1' }, { id: 'system-2' })
  }
  if (hasApiSource.value) steps.push({ id: 'api-window' })
  if (hasApiSource.value && apiWindowPreset.value === 'custom') steps.push({ id: 'api-window-custom' })
  if (!file1UsesApi.value) steps.push({ id: 'file-1' })
  if (!file2UsesApi.value) steps.push({ id: 'file-2' })
  return shouldSkipMappingStep.value ? steps.filter((step) => step.id !== 'run') : steps
})
const currentStep = computed<UploadStep>(() => workflowSteps.value[currentStepIndex.value] ?? workflowSteps.value[0]!)
const progressPercent = computed(() => ((Math.max(1, currentStepIndex.value + 1) / workflowSteps.value.length) * 100).toFixed(2))
const isFinalStep = computed(() => currentStepIndex.value === workflowSteps.value.length - 1)
const apiWindowPresetOptions = computed<ApiWindowPresetOption[]>(() => {
  const previousDay = buildPresetApiWindowRange('previous-day')
  const previousWeek = buildPresetApiWindowRange('previous-week')
  const previousMonth = buildPresetApiWindowRange('previous-month')

  return [
    {
      value: 'previous-day',
      label: formatApiWindowPresetOptionLabel('Previous Day', previousDay.summary),
      shortcutKey: 'A',
    },
    {
      value: 'previous-week',
      label: formatApiWindowPresetOptionLabel('Previous Week', previousWeek.summary),
      shortcutKey: 'B',
    },
    {
      value: 'previous-month',
      label: formatApiWindowPresetOptionLabel('Previous Month', previousMonth.summary),
      shortcutKey: 'C',
    },
    {
      value: 'custom',
      label: 'Custom Dates, select start and end dates',
      shortcutKey: 'D',
    },
  ]
})
const selectedApiWindowRange = computed<ApiWindowRange | null>(() => {
  if (!apiWindowPreset.value) return null
  if (apiWindowPreset.value === 'custom') return buildCustomApiWindowRange()
  return buildPresetApiWindowRange(apiWindowPreset.value)
})
const customApiWindowStartLabel = computed(() => formatDateInputLabel(customApiWindowStartDate.value))
const customApiWindowEndLabel = computed(() => formatDateInputLabel(customApiWindowEndDate.value))
const file1SystemLabel = computed(() => {
  const option = selectedSystemOptions.value.find((systemOption) => systemOption.enumId === file1SystemEnumId.value)
  return option?.label || option?.description || option?.enumCode || option?.enumId || ''
})
const file2SystemLabel = computed(() => {
  const option = selectedSystemOptions.value.find((systemOption) => systemOption.enumId === file2SystemEnumId.value)
  return option?.label || option?.description || option?.enumCode || option?.enumId || ''
})
const activeRunName = computed(() => selectedSavedRun.value?.runName || requestedRunName.value || 'Selected Run')
const file1PromptSystemName = computed(() => file1SystemLabel.value || requestedFile1SystemLabel.value || 'System 1')
const file2PromptSystemName = computed(() => file2SystemLabel.value || requestedFile2SystemLabel.value || 'System 2')
const reconciliationRunRouteContext = computed<ReconciliationRunRouteContext | null>(() => {
  if (!selectedSavedRun.value) return null

  return {
    savedRunId: selectedSavedRun.value.savedRunId,
    runName: activeRunName.value,
    file1SystemLabel: file1PromptSystemName.value,
    file2SystemLabel: file2PromptSystemName.value,
  }
})
const activeFileAccept = computed(() => {
  if (currentStep.value.id === 'file-1') return acceptForExpectedFileType(file1ExpectedFileType.value)
  if (currentStep.value.id === 'file-2') return acceptForExpectedFileType(file2ExpectedFileType.value)
  return ''
})
const latestSavedOutputRoute = computed<RouteLocationRaw | null>(() => buildRunResultRoute(latestSavedOutput.value?.fileName ?? ''))
const runHistoryRoute = computed<RouteLocationRaw | null>(() => {
  return reconciliationRunRouteContext.value
    ? buildReconciliationRunHistoryRoute(reconciliationRunRouteContext.value)
    : null
})
const activeSystemValue = computed({
  get: () => (currentStep.value.id === 'system-1' ? file1SystemEnumId.value : file2SystemEnumId.value),
  set: (value: string) => {
    if (currentStep.value.id === 'system-1') {
      file1SystemEnumId.value = value
      return
    }
    file2SystemEnumId.value = value
  },
})
const currentQuestion = computed(() => {
  switch (currentStep.value.id) {
    case 'run':
      return 'Select a Run'
    case 'system-1':
      return `Select the first system for ${activeRunName.value}`
    case 'api-window':
      return 'Which API time period should we use?'
    case 'api-window-custom':
      return 'Select custom dates'
    case 'file-1':
      return buildFileUploadQuestion(file1PromptSystemName.value, file1ExpectedFileType.value)
    case 'system-2':
      return `Select the second system for ${activeRunName.value}`
    case 'file-2':
      return buildFileUploadQuestion(file2PromptSystemName.value, file2ExpectedFileType.value)
    default:
      return 'Select a Run'
  }
})
const activeFile = computed(() => (currentStep.value.id === 'file-1' ? file1.value : file2.value))
const activeFilePlaceholder = computed(() =>
  currentStep.value.id === 'file-1'
    ? buildFilePlaceholder(file1PromptSystemName.value, file1ExpectedFileType.value)
    : buildFilePlaceholder(file2PromptSystemName.value, file2ExpectedFileType.value),
)
const canContinue = computed(() => {
  switch (currentStep.value.id) {
    case 'run':
      return !!selectedSavedRun.value
    case 'system-1':
      return !!file1SystemEnumId.value
    case 'file-1':
      return !!file1.value
    case 'system-2':
      return !!file2SystemEnumId.value && file2SystemEnumId.value !== file1SystemEnumId.value
    case 'api-window':
      return !!apiWindowPreset.value
    case 'api-window-custom':
      return !!selectedApiWindowRange.value
    case 'file-2':
      return !!file2.value
    default:
      return false
  }
})
const hasFeedbackMessages = computed(() => validationErrors.value.length > 0 || processingWarnings.value.length > 0)
const shouldCenterStage = computed(() => !showEmptyState.value && !hasFeedbackMessages.value)
const showLatestSavedOutputBoard = computed(
  () => !!selectedSavedRun.value && (latestSavedOutputLoading.value || !!latestSavedOutputError.value || !!latestSavedOutput.value),
)
const primaryButtonLabel = computed(() => {
  if (!isFinalStep.value) return 'Next'
  return running.value ? 'Running…' : 'Execute'
})

const stepFocusSelectorById: Record<UploadStep['id'], string> = {
  run: '[data-testid="saved-run-select"]',
  'system-1': '[data-testid="file1-system-select"]',
  'api-window': '[data-testid="api-window-preset-previous-day"]',
  'api-window-custom': '[data-testid="api-window-custom-start"]',
  'file-1': '[data-testid="file1-input"]',
  'system-2': '[data-testid="file2-system-select"]',
  'file-2': '[data-testid="file2-input"]',
}

function isFileStepId(stepId: UploadStep['id']): stepId is FileStepId {
  return stepId === 'file-1' || stepId === 'file-2'
}

function buildRunResultRoute(outputFileName: string): RouteLocationRaw | null {
  const trimmedOutputFileName = outputFileName.trim()
  if (!reconciliationRunRouteContext.value || !trimmedOutputFileName) return null

  return buildReconciliationRunResultRoute(reconciliationRunRouteContext.value, trimmedOutputFileName)
}

function resolveSystemOptionForFileSide(fileSide: 'FILE_1' | 'FILE_2', systemEnumId: string): SavedRunSystemOption | null {
  const normalizedSystemEnumId = systemEnumId.trim()
  if (!normalizedSystemEnumId) return null

  return (
    selectedSystemOptions.value.find(
      (option) => option.fileSide === fileSide && option.enumId === normalizedSystemEnumId,
    ) ??
    selectedSystemOptions.value.find((option) => option.enumId === normalizedSystemEnumId) ??
    null
  )
}

function resolveExpectedFileType(option: SavedRunSystemOption | null): ExpectedFileType {
  return normalizeExpectedFileType(option?.fileTypeEnumId ?? option?.fileTypeLabel ?? null)
}

function isApiSource(option: SavedRunSystemOption | null): boolean {
  return option?.sourceTypeEnumId?.trim() === SOURCE_TYPE_API
}

function isApiWindowPreset(value: string): value is ApiWindowPreset {
  return ['previous-day', 'previous-week', 'previous-month', 'custom'].includes(value)
}

function chooseApiWindowPresetChoice(value: string): void {
  if (!isApiWindowPreset(value)) return
  chooseApiWindowPreset(value)
}

function chooseApiWindowPreset(preset: ApiWindowPreset): void {
  apiWindowPreset.value = preset
  if (preset !== 'custom') {
    calendar.reset()
    return
  }

  calendar.setSelectionSide(customApiWindowStartDate.value ? 'end' : 'start')
  calendar.focusVisibleMonthAroundStart()
  currentStepIndex.value = Math.min(currentStepIndex.value + 1, workflowSteps.value.length - 1)
  void focusCurrentStepControlOnNextTick()
}

function buildPresetApiWindowRange(preset: Exclude<ApiWindowPreset, 'custom'>): ApiWindowRange {
  const today = todayInDisplayTimeZone()
  if (preset === 'previous-day') {
    const previousDay = addDays(today, -1)
    return {
      startDate: previousDay,
      endExclusiveDate: today,
      summary: formatDateLabel(previousDay),
    }
  }
  if (preset === 'previous-week') {
    const startDate = addDays(today, -8)
    const endDate = addDays(today, -1)
    return {
      startDate,
      endExclusiveDate: today,
      summary: formatDateRangeLabel(startDate, endDate),
    }
  }

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const previousMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1)
  return {
    startDate: previousMonthStart,
    endExclusiveDate: currentMonthStart,
    summary: formatMonthLabel(previousMonthStart),
  }
}

function buildCustomApiWindowRange(): ApiWindowRange | null {
  const calendarRange = calendar.range.value
  if (!calendarRange) return null

  const inclusiveEndDate = customApiWindowEndDateValue.value ?? calendarRange.endExclusiveDate
  return {
    ...calendarRange,
    summary: formatDateRangeLabel(calendarRange.startDate, inclusiveEndDate),
  }
}

function formatApiWindowPresetOptionLabel(title: string, summary: string): string {
  return `${title}, ${summary}`
}

function formatDateInputLabel(value: string): string {
  if (!value) return 'mm/dd/yyyy'
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1')
}

const setCustomDateSelectionSide = calendar.setSelectionSide
const shiftCustomCalendarMonth = calendar.shiftMonth
const canShiftCustomCalendarMonth = calendar.canShiftMonth
const isCustomCalendarCellDisabled = calendar.isCellDisabled
const selectCustomCalendarDate = calendar.selectCell
const customCalendarCellClasses = calendar.cellClasses

function formatDateForPayload(date: Date): string {
  return displayDayStart(date).toISOString()
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatDateRangeLabel(startDate: Date, endDate: Date): string {
  return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`
}

function normalizeExpectedFileType(rawType?: string | null): ExpectedFileType {
  const normalizedType = rawType?.trim().toUpperCase() ?? ''
  if (normalizedType.includes('CSV')) return 'CSV'
  if (normalizedType.includes('JSON')) return 'JSON'
  return null
}

function acceptForExpectedFileType(expectedFileType: ExpectedFileType): string {
  if (expectedFileType === 'CSV') return '.csv,text/csv'
  if (expectedFileType === 'JSON') return '.json,application/json'
  return ''
}

function buildFileUploadQuestion(systemName: string, expectedFileType: ExpectedFileType): string {
  const fileTypeLabel = expectedFileType ? ` ${expectedFileType}` : ''
  return `Upload the ${systemName}${fileTypeLabel} file`
}

function buildFilePlaceholder(systemName: string, expectedFileType: ExpectedFileType): string {
  const fileTypeLabel = expectedFileType ? ` ${expectedFileType}` : ''
  return `Choose the ${systemName}${fileTypeLabel} file to upload...`
}

const clearRunState = diff.clearRunState
const clearLatestSavedOutputState = diff.clearLatestSavedOutputState

const pageAbortController = new AbortController()
let latestOutputAbortController: AbortController | null = null
let submitDiffAbortController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  latestOutputAbortController?.abort()
  submitDiffAbortController?.abort()
})

// How long to keep looking for the submitted run's backend row before giving up and simply
// awaiting the submission. RESOLVE registers the row in its own committed transaction almost
// immediately, so this normally resolves on the first or second look.
const RUN_REGISTRATION_POLL_INTERVAL_MS = 900
const RUN_REGISTRATION_POLL_ATTEMPTS = 12
// startedDate is the server's clock and the submit time is the browser's, so the match window
// has to absorb clock skew rather than assume they agree to the second. It only has to be tight
// enough to exclude a long-running earlier run of the same saved run.
const RUN_REGISTRATION_MATCH_WINDOW_MS = 2 * 60 * 1000

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

/**
 * Poll for the run this submission just registered and return its run-result id, or '' when
 * none appears in time. Never throws: a failed look just means "not yet", and the caller falls
 * back to awaiting the submission itself.
 */
async function pollForRegisteredRunResultId(savedRunId: string, signal: AbortSignal): Promise<string> {
  const submittedAtMs = Date.now()
  for (let attempt = 0; attempt < RUN_REGISTRATION_POLL_ATTEMPTS; attempt += 1) {
    await delay(RUN_REGISTRATION_POLL_INTERVAL_MS, signal)
    if (signal.aborted) return ''

    try {
      const response = await reconciliationFacade.listGeneratedOutputs(
        { savedRunId, pageIndex: 0, pageSize: 5, query: '' },
        signal,
      )
      const registeredRun = (response.generatedOutputs ?? []).find((output) => {
        if (!isActiveRunStatus(output.statusEnumId) || !output.reconciliationRunResultId) return false
        // Ignore an older run of the same saved run that was already in flight before this click.
        // A row without a usable start time is accepted: an unreadable timestamp should not cost
        // the redirect, and any active run of this saved run is worth showing.
        const startedMs = new Date(output.startedDate ?? output.createdDate ?? '').getTime()
        return !Number.isFinite(startedMs) || Math.abs(startedMs - submittedAtMs) <= RUN_REGISTRATION_MATCH_WINDOW_MS
      })
      if (registeredRun?.reconciliationRunResultId) return registeredRun.reconciliationRunResultId
    } catch {
      // Transient list failure — try again on the next tick.
    }
  }
  return ''
}

function shouldKeepPendingRunAfterRunError(error: unknown): boolean {
  if (!(error instanceof ApiCallError)) return false
  if (error.status !== 503) return false

  const details = (error.details ?? {}) as {
    failures?: Array<{ status?: number }>
  }
  const failures = details.failures
  return Array.isArray(failures) && failures.length > 0 && failures.every((failure) => failure.status == null)
}

function focusCurrentStepControl(): void {
  const selector = stepFocusSelectorById[currentStep.value.id]
  const focusTarget = selector ? stepFocusRegion.value?.querySelector<HTMLElement>(selector) : null
  focusTarget?.focus()
}

function focusPrimaryAction(): void {
  const primaryAction = stepFocusRegion.value?.querySelector<HTMLButtonElement>('[data-testid="reconciliation-step-primary"]')
  if (!primaryAction || primaryAction.disabled) return
  primaryAction.focus()
}

async function focusCurrentStepControlOnNextTick(): Promise<void> {
  await nextTick()
  focusCurrentStepControl()
}

async function focusPrimaryActionOnNextTick(): Promise<void> {
  await nextTick()
  focusPrimaryAction()
}

function resetWorkflow(): void {
  currentStepIndex.value = 0
  file1.value = null
  file2.value = null
  apiWindowPreset.value = ''
  calendar.reset()
  inputResetKey.value += 1
}

function syncSelectedSystems(savedRun: SavedRunSummary | null): void {
  if (!savedRun) {
    file1SystemEnumId.value = ''
    file2SystemEnumId.value = ''
    return
  }

  const optionIds = savedRun.systemOptions.map((option) => option.enumId)
  if (savedRun.requiresSystemSelection) {
    if (!optionIds.includes(file1SystemEnumId.value)) {
      file1SystemEnumId.value = savedRun.defaultFile1SystemEnumId ?? optionIds[0] ?? ''
    }
    if (!optionIds.includes(file2SystemEnumId.value) || file2SystemEnumId.value === file1SystemEnumId.value) {
      file2SystemEnumId.value =
        savedRun.defaultFile2SystemEnumId ??
        optionIds.find((enumId) => enumId !== file1SystemEnumId.value) ??
        ''
    }
    return
  }

  file1SystemEnumId.value = savedRun.defaultFile1SystemEnumId ?? optionIds[0] ?? ''
  file2SystemEnumId.value =
    savedRun.defaultFile2SystemEnumId ??
    optionIds.find((enumId) => enumId !== file1SystemEnumId.value) ??
    ''
}

async function loadSavedRuns(): Promise<void> {
  await diff.loadSavedRuns(pageAbortController.signal)
  if (loadError.value) return
  if (
    requestedSavedRunId.value &&
    savedRuns.value.some((savedRun) => savedRun.savedRunId === requestedSavedRunId.value)
  ) {
    selectedSavedRunId.value = requestedSavedRunId.value
  }
  syncSelectedSystems(selectedSavedRun.value)
}

function loadLatestSavedOutput(savedRunId: string): Promise<void> {
  latestOutputAbortController?.abort()
  const controller = new AbortController()
  latestOutputAbortController = controller
  return diff.loadLatestSavedOutput(savedRunId, controller.signal)
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(String(reader.result ?? ''))
    }
    reader.onerror = () => {
      reject(new Error(`Unable to read ${file.name}`))
    }
    reader.readAsText(file)
  })
}

function looksLikeJsonText(text: string): boolean {
  const trimmedText = text.trimStart()
  return trimmedText.startsWith('{') || trimmedText.startsWith('[')
}

function looksLikeJsonSchemaText(text: string): boolean {
  const normalizedText = text.toLowerCase()
  return (
    normalizedText.includes('"$schema"') &&
    (normalizedText.includes('"properties"') ||
      normalizedText.includes('"items"') ||
      normalizedText.includes('"definitions"') ||
      normalizedText.includes('"$defs"'))
  )
}

function validateSelectedFile(
  file: File,
  fileText: string,
  systemName: string,
  expectedFileType: ExpectedFileType,
): string | null {
  if (expectedFileType === 'CSV' && looksLikeJsonText(fileText)) {
    const actualType = looksLikeJsonSchemaText(fileText) ? 'a JSON Schema file' : 'JSON'
    return `${systemName} expects CSV data for this saved run. ${file.name} looks like ${actualType}. Upload the source data file instead.`
  }

  if (expectedFileType === 'JSON' && !looksLikeJsonText(fileText)) {
    return `${systemName} expects JSON data for this saved run. ${file.name} does not look like JSON. Upload the source data file instead.`
  }

  if (expectedFileType === 'JSON' && looksLikeJsonSchemaText(fileText)) {
    return `${systemName} expects JSON record data for this saved run. ${file.name} looks like a JSON Schema file. Upload the source data file instead of the schema definition.`
  }

  return null
}

async function readUploadSourcePayload(input: UploadSourceInput): Promise<{
  error: string | null
  payload: Partial<Record<UploadPayloadKey, string>>
}> {
  if (!input.file) return { error: null, payload: {} }

  const fileText = await readFileAsText(input.file)
  const validationError = validateSelectedFile(
    input.file,
    fileText,
    input.systemName,
    input.expectedFileType,
  )
  if (validationError) return { error: validationError, payload: {} }

  return {
    error: null,
    payload: {
      [input.fileNameKey]: input.file.name,
      [input.fileTextKey]: fileText,
    },
  }
}

function onFile1Change(event: Event): void {
  const input = event.target as HTMLInputElement
  file1.value = input.files?.[0] ?? null
  clearRunState()
  void focusPrimaryActionOnNextTick()
}

function onFile2Change(event: Event): void {
  const input = event.target as HTMLInputElement
  file2.value = input.files?.[0] ?? null
  clearRunState()
  void focusPrimaryActionOnNextTick()
}

function goBack(): void {
  runError.value = null
  currentStepIndex.value = Math.max(currentStepIndex.value - 1, 0)
}

async function handlePrimaryAction(): Promise<void> {
  if (!selectedSavedRun.value) {
    runError.value = 'Select a run before continuing.'
    return
  }

  if (!isFinalStep.value) {
    if (!canContinue.value) return
    currentStepIndex.value = Math.min(currentStepIndex.value + 1, workflowSteps.value.length - 1)
    return
  }

  await runDiff()
}

async function runDiff(): Promise<void> {
  if (!selectedSavedRun.value) {
    runError.value = 'Select a run before running the diff.'
    return
  }
  if (!file1UsesApi.value && !file1.value) {
    runError.value = `Upload the ${file1PromptSystemName.value} file before running the diff.`
    return
  }
  if (!file2UsesApi.value && !file2.value) {
    runError.value = `Upload the ${file2PromptSystemName.value} file before running the diff.`
    return
  }
  const apiWindowRange = hasApiSource.value ? selectedApiWindowRange.value : null
  if (hasApiSource.value && !apiWindowRange) {
    runError.value = 'Choose a valid API time period before running the diff.'
    return
  }
  if (!file1SystemEnumId.value || !file2SystemEnumId.value || file1SystemEnumId.value === file2SystemEnumId.value) {
    runError.value = 'Choose two different systems before running the diff.'
    return
  }

  pendingSubmittedRun.value = null
  let pendingRun: PendingReconciliationRun | null = null

  const payload: RunSavedRunDiffPayload = {
    savedRunId: selectedSavedRun.value.savedRunId,
    file1SystemEnumId: file1SystemEnumId.value,
    file2SystemEnumId: file2SystemEnumId.value,
    hasHeader: true,
  }

  if (apiWindowRange) {
    payload.windowStartDate = formatDateForPayload(apiWindowRange.startDate)
    payload.windowEndDate = formatDateForPayload(apiWindowRange.endExclusiveDate)
    payload.windowStartLocalDate = formatDateInputValue(apiWindowRange.startDate)
    payload.windowEndLocalDate = formatDateInputValue(apiWindowRange.endExclusiveDate)
  }

  const uploadSourcePayloads = await Promise.all([
    file1UsesApi.value
      ? Promise.resolve({ error: null, payload: {} })
      : readUploadSourcePayload({
          file: file1.value,
          fileNameKey: 'file1Name',
          fileTextKey: 'file1Text',
          systemName: file1PromptSystemName.value,
          expectedFileType: file1ExpectedFileType.value,
        }),
    file2UsesApi.value
      ? Promise.resolve({ error: null, payload: {} })
      : readUploadSourcePayload({
          file: file2.value,
          fileNameKey: 'file2Name',
          fileTextKey: 'file2Text',
          systemName: file2PromptSystemName.value,
          expectedFileType: file2ExpectedFileType.value,
        }),
  ])
  const uploadError = uploadSourcePayloads.find((sourcePayload) => sourcePayload.error)?.error
  if (uploadError) {
    runError.value = uploadError
    return
  }
  uploadSourcePayloads.forEach((sourcePayload) => Object.assign(payload, sourcePayload.payload))

  if (reconciliationRunRouteContext.value) {
    pendingRun = recordPendingReconciliationRun(reconciliationRunRouteContext.value)
    pendingSubmittedRun.value = pendingRun
  }

  submitDiffAbortController?.abort()
  submitDiffAbortController = new AbortController()
  const submitSignal = submitDiffAbortController.signal

  try {
    // The run executes detached from the request transaction, so its RUNNING row is readable
    // within moments of submission while this call is still in flight. Race the two: whichever
    // resolves first decides where the user lands — the live progress view for a run long
    // enough to still be running, or the saved result for one that finished first.
    const submission = diff.submitDiff(payload, submitSignal)
    const liveRunResultId = await Promise.race([
      pollForRegisteredRunResultId(payload.savedRunId, submitSignal),
      submission.then(() => '', () => ''),
    ])

    if (liveRunResultId && reconciliationRunRouteContext.value) {
      // The submission stays in flight and owns the marker/error handling from here; this page
      // unmounts on navigation, so its abort controller must not be what cancels the run.
      submitDiffAbortController = null
      void submission
        .then(() => clearPendingReconciliationRun(pendingRun?.pendingRunId))
        .catch((error) => {
          if (!shouldKeepPendingRunAfterRunError(error)) clearPendingReconciliationRun(pendingRun?.pendingRunId)
        })
      await router.push(buildReconciliationRunLiveRoute(reconciliationRunRouteContext.value, liveRunResultId))
      return
    }

    const response = await submission
    if (!response) return

    const generatedOutput = response.runResult?.generatedOutput ?? null
    if (!generatedOutput?.fileName?.trim()) {
      // A resolved response without an output is a synchronous failure (JSON-RPC error envelopes
      // resolve rather than throw): surface it and clear the optimistic marker, or the run ghosts
      // as "Running" with no error shown anywhere. Only the thrown 503 keep-alive path below may
      // keep the marker.
      runError.value = response.errors?.[0] ?? 'Diff did not return a saved result.'
      clearPendingReconciliationRun(pendingRun?.pendingRunId)
      pendingSubmittedRun.value = null
      return
    }

    clearPendingReconciliationRun(pendingRun?.pendingRunId)
    pendingSubmittedRun.value = null

    const resultRoute = buildRunResultRoute(generatedOutput.fileName)
    if (!resultRoute) {
      runError.value = 'Diff completed without a saved result route.'
      return
    }

    await router.push(resultRoute)
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    if (!shouldKeepPendingRunAfterRunError(error)) {
      clearPendingReconciliationRun(pendingRun?.pendingRunId)
      pendingSubmittedRun.value = null
    }
  }
}

watch(selectedSavedRun, (savedRun) => {
  syncSelectedSystems(savedRun)
  clearRunState()
  resetWorkflow()
  void focusCurrentStepControlOnNextTick()
})

watch(selectedSavedRunId, (savedRunId) => {
  if (!savedRunId.trim()) {
    clearLatestSavedOutputState()
    return
  }

  void loadLatestSavedOutput(savedRunId)
})

watch(
  [() => currentStep.value.id, loadingMappings, showEmptyState],
  ([, isLoading, isEmptyState]) => {
    if (isLoading || isEmptyState) return
    void focusCurrentStepControlOnNextTick()
  },
  { immediate: true },
)

onMounted(() => {
  void loadSavedRuns()
})
</script>

<style scoped>
.reconciliation-diff-layout {
  width: min(var(--workflow-shell-width), 100%);
  min-width: 0;
  min-height: 100%;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--space-5);
}

.reconciliation-diff-main {
  width: 100%;
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: var(--space-5);
}

.workflow-step-shell {
  min-width: 0;
  max-width: 100%;
}

.reconciliation-run-submitted-hint {
  width: min(var(--workflow-question-width), 100%);
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-soft);
}

.reconciliation-run-submitted-hint p {
  margin: 0;
}

.wizard-api-range-selector {
  width: min(42rem, 100%);
  min-width: 0;
  max-width: 100%;
  justify-self: center;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-3);
}

.wizard-api-range-panel {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 82%, var(--surface));
  box-shadow: 0 0.8rem 1.8rem color-mix(in oklab, black 8%, transparent);
}

.wizard-api-range-panel--custom {
  gap: var(--space-3);
  padding: var(--space-3);
}

.wizard-api-window-shell {
  min-width: 0;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  align-items: end;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-soft);
}

.wizard-api-window-field {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
  padding: 0.65rem var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.wizard-api-window-field--active,
.wizard-api-window-field:focus-visible {
  border-color: color-mix(in oklab, var(--accent) 72%, var(--border));
  outline: none;
}

.wizard-api-window-value {
  min-width: 0;
  overflow: hidden;
  font-size: clamp(0.9rem, 1vw, 1.02rem);
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wizard-api-window-value.empty {
  color: var(--text-muted);
}

.wizard-api-calendar-grid {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.wizard-api-calendar-month {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  gap: 0.55rem;
}

.wizard-api-calendar-month__head {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr) 1.75rem;
  align-items: center;
  gap: var(--space-1);
}

.wizard-api-calendar-month__head h3 {
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wizard-api-calendar-nav,
.wizard-api-calendar-nav-spacer {
  width: 1.75rem;
  height: 1.75rem;
}

.wizard-api-calendar-nav {
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font-size: 1.45rem;
  line-height: 1;
  cursor: pointer;
}

.wizard-api-calendar-nav:hover,
.wizard-api-calendar-nav:focus-visible {
  background: color-mix(in oklab, var(--surface) 74%, var(--accent) 26%);
  color: var(--accent);
  outline: none;
}

.wizard-api-calendar-weekdays,
.wizard-api-calendar-days {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.wizard-api-calendar-weekdays {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.1;
  text-align: center;
}

.wizard-api-calendar-weekdays span {
  min-width: 0;
  min-height: 1.75rem;
  display: grid;
  place-items: center;
  padding: 0;
}

.wizard-api-calendar-days {
  row-gap: 0.2rem;
}

.wizard-api-calendar-day {
  position: relative;
  width: 100%;
  inline-size: 100%;
  height: 2rem;
  min-width: 0;
  min-inline-size: 0;
  max-width: 100%;
  display: grid;
  place-items: center;
  justify-self: stretch;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  z-index: 0;
}

.wizard-api-calendar-day__label {
  position: relative;
  z-index: 2;
  display: inline-grid;
  width: min(1.95rem, 100%);
  inline-size: min(1.95rem, 100%);
  min-width: 0;
  max-width: 100%;
  height: 1.95rem;
  place-items: center;
  line-height: 1;
}

.wizard-api-calendar-day::before,
.wizard-api-calendar-day::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.wizard-api-calendar-day::before {
  top: 0.18rem;
  right: 0;
  bottom: 0.18rem;
  left: 0;
  background: transparent;
  z-index: 0;
}

.wizard-api-calendar-day::after {
  top: 50%;
  left: 50%;
  width: min(1.95rem, 100%);
  inline-size: min(1.95rem, 100%);
  height: 1.95rem;
  border-radius: var(--radius-pill);
  background: transparent;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.wizard-api-calendar-day--in-range::before,
.wizard-api-calendar-day--range-start::before,
.wizard-api-calendar-day--range-end::before {
  background: color-mix(in oklab, var(--accent) 16%, var(--surface));
}

.wizard-api-calendar-day--range-start::before {
  left: 50%;
}

.wizard-api-calendar-day--range-end::before {
  right: 50%;
}

.wizard-api-calendar-day--range-start.wizard-api-calendar-day--range-end::before {
  background: transparent;
}

.wizard-api-calendar-day--range-start,
.wizard-api-calendar-day--range-end {
  color: var(--surface);
  font-weight: 700;
}

.wizard-api-calendar-day--range-start::after,
.wizard-api-calendar-day--range-end::after {
  background: color-mix(in oklab, var(--accent) 66%, var(--surface));
}

.wizard-api-calendar-day--outside {
  color: color-mix(in oklab, var(--text-muted) 58%, transparent);
}

.wizard-api-calendar-day:disabled,
.wizard-api-calendar-day--disabled {
  color: color-mix(in oklab, var(--text-muted) 56%, transparent);
  cursor: not-allowed;
}

.wizard-api-calendar-day:disabled::before,
.wizard-api-calendar-day:disabled::after {
  background: transparent;
  box-shadow: none;
}

.wizard-api-calendar-day:hover,
.wizard-api-calendar-day:focus-visible {
  outline: none;
}

.wizard-api-calendar-day:hover::after,
.wizard-api-calendar-day:focus-visible::after {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 65%, var(--border));
}

@media (max-width: 720px) {
  .wizard-api-window-shell,
  .wizard-api-calendar-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.reconciliation-run-history-board {
  display: grid;
  width: min(var(--workflow-question-width), 100%);
  min-width: 0;
  max-width: 100%;
  gap: var(--space-2);
  justify-self: center;
}

.reconciliation-run-history-card,
.reconciliation-run-history-card__head,
.reconciliation-run-history-card__metrics {
  display: grid;
  gap: var(--space-2);
}

.reconciliation-run-history-card {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 82%, white);
}

.reconciliation-run-history-card--link {
  color: inherit;
  text-decoration: none;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background 160ms ease;
}

.reconciliation-run-history-card--link:hover {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--border-soft) 70%, var(--accent));
  background: color-mix(in oklab, var(--surface-2) 78%, var(--accent));
}

.reconciliation-run-history-card__head span {
  color: var(--text-muted);
}

.reconciliation-run-history-card__date {
  font-size: 0.95rem;
}

.reconciliation-run-history-card__metrics {
  margin: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
}

.reconciliation-run-history-card__metrics div {
  display: grid;
  gap: 0.15rem;
}

.reconciliation-run-history-card__metrics dt {
  color: var(--text-muted);
  font-size: 0.86rem;
}

.reconciliation-run-history-card__metrics dd {
  margin: 0;
  font-size: 0.98rem;
}

.reconciliation-run-history-link {
  justify-self: start;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
}

.reconciliation-run-history-link:hover {
  color: var(--text);
  text-decoration: underline;
}

@media (max-width: 760px) {
  .reconciliation-diff-layout,
  .reconciliation-diff-main {
    gap: var(--space-4);
  }

  .wizard-api-window-shell {
    grid-template-columns: 1fr;
  }

  .reconciliation-run-history-card__metrics {
    grid-template-columns: 1fr;
  }

  .reconciliation-run-history-board {
    width: min(var(--workflow-question-width), 100%);
  }
}
</style>
