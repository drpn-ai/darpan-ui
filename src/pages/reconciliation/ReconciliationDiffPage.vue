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

            <WorkflowDateRangeCalendar v-else-if="currentStep.id === 'api-window-custom'" :calendar="calendar" />

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
          <LoadingState v-if="latestSavedOutputLoading" noun="saved results" data-testid="latest-run-result-loading" />
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
                  <dt>Missing from {{ latestSavedOutputSystemNames.file1 }}</dt>
                  <dd>{{ latestSavedOutput.onlyInFile2Count ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Missing from {{ latestSavedOutputSystemNames.file2 }}</dt>
                  <dd>{{ latestSavedOutput.onlyInFile1Count ?? 0 }}</dd>
                </div>
              </dl>
            </RouterLink>
          </template>
        </section>
      </div>

      <div v-if="showRunActions" class="reconciliation-run-actions">
        <RouterLink
          v-if="latestSavedOutput && runHistoryRoute"
          class="app-icon-action app-icon-action--large"
          data-testid="view-all-run-results"
          aria-label="View previous runs"
          title="View previous runs"
          :to="runHistoryRoute"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="listIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
        <button
          v-if="canOpenRunSettings"
          type="button"
          class="app-icon-action app-icon-action--large"
          data-testid="run-workflow-open-settings"
          aria-label="Run settings"
          title="Run settings"
          @click="void openRunSettings()"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path :d="settingsIconPath" />
          </svg>
        </button>
      </div>
    </template>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import WorkflowDateRangeCalendar from '../../components/workflow/WorkflowDateRangeCalendar.vue'
import WorkflowShortcutChoiceCards from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
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
  displayDayStart,
  formatDateInputValue,
  formatSavedResultDateTime,
  todayInDisplayTimeZone,
} from '../../lib/utils/date'
import { darpanSystemNamePair } from '../../lib/utils/darpanSystems'
import { listIconPath, settingsIconPath } from '../../lib/iconPaths'
import { buildRuleSetDraft, buildSavedRunEditorRoute } from '../../lib/savedRunEditorRoute'
import { useCalendarWidget } from '../../composables/useCalendarWidget'
import {
  customWindowRange,
  isRunWindowPreset,
  presetWindowRange,
  runWindowPresetOptions,
  type RunWindowPreset,
  type RunWindowRange,
} from '../../lib/runWindow'
import { useReconciliationDiff } from '../../composables/useReconciliationDiff'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { isActiveRunStatus } from '../../stores/runResults'

interface UploadStep {
  id: 'run' | 'system-1' | 'api-window' | 'api-window-custom' | 'file-1' | 'system-2' | 'file-2'
}

type ExpectedFileType = 'CSV' | 'JSON' | null
type FileStepId = 'file-1' | 'file-2'
type UploadPayloadKey = 'file1Name' | 'file1Text' | 'file2Name' | 'file2Text'

interface UploadSourceInput {
  file: File | null
  fileNameKey: Extract<UploadPayloadKey, 'file1Name' | 'file2Name'>
  fileTextKey: Extract<UploadPayloadKey, 'file1Text' | 'file2Text'>
  systemName: string
  expectedFileType: ExpectedFileType
}

const SOURCE_TYPE_API = 'AUT_SRC_API'

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

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
const { startDate: customApiWindowStartDate } = calendar

const selectedSavedRunId = ref('')
const file1SystemEnumId = ref('')
const file2SystemEnumId = ref('')
const file1 = ref<File | null>(null)
const file2 = ref<File | null>(null)
const apiWindowPreset = ref<RunWindowPreset | ''>('')
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
// A single-sided run (scopeMode EVALUATE, DAR-BE-049) has one source. Read from the wire rather than
// inferred from a missing FILE_2 option: that shape is also what a two-sided run looks like when its
// FILE_2 row has gone missing, and skipping the card for THAT would quietly run half a comparison.
const isSingleSidedRun = computed(() => (selectedSavedRun.value?.scopeMode ?? '').toUpperCase() === 'EVALUATE')
const workflowSteps = computed<UploadStep[]>(() => {
  const steps: UploadStep[] = [{ id: 'run' }]
  if (requiresSystemSelection.value && !isSingleSidedRun.value) {
    steps.push({ id: 'system-1' }, { id: 'system-2' })
  } else if (requiresSystemSelection.value) {
    steps.push({ id: 'system-1' })
  }
  if (hasApiSource.value) steps.push({ id: 'api-window' })
  if (hasApiSource.value && apiWindowPreset.value === 'custom') steps.push({ id: 'api-window-custom' })
  if (!file1UsesApi.value) steps.push({ id: 'file-1' })
  // Without this guard the wizard asked for a System 2 file that has no source behind it, and the
  // run could never be started: file2UsesApi is false when there is no FILE_2 option at all, so the
  // "not an API source, therefore upload one" branch fired for a side that does not exist.
  if (!file2UsesApi.value && !isSingleSidedRun.value) steps.push({ id: 'file-2' })
  return shouldSkipMappingStep.value ? steps.filter((step) => step.id !== 'run') : steps
})
const currentStep = computed<UploadStep>(() => workflowSteps.value[currentStepIndex.value] ?? workflowSteps.value[0]!)
const progressPercent = computed(() => ((Math.max(1, currentStepIndex.value + 1) / workflowSteps.value.length) * 100).toFixed(2))
const isFinalStep = computed(() => currentStepIndex.value === workflowSteps.value.length - 1)
const apiWindowPresetOptions = computed(() => runWindowPresetOptions(todayInDisplayTimeZone()))
const selectedApiWindowRange = computed<RunWindowRange | null>(() => {
  if (!apiWindowPreset.value) return null
  if (apiWindowPreset.value === 'custom') return customWindowRange(calendar)
  return presetWindowRange(apiWindowPreset.value, todayInDisplayTimeZone())
})
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
// The saved-result card counts records per SYSTEM, so it names the system rather than the endpoint
// the run extracted ("Shopify Order Return References"). The upload prompts keep the endpoint name:
// there it is what tells an operator which extract to hand over.
const latestSavedOutputSystemNames = computed(() => darpanSystemNamePair(
  latestSavedOutput.value?.file1Label || file1PromptSystemName.value,
  latestSavedOutput.value?.file2Label || file2PromptSystemName.value,
))
const runHistoryRoute = computed<RouteLocationRaw | null>(() => {
  return reconciliationRunRouteContext.value
    ? buildReconciliationRunHistoryRoute(reconciliationRunRouteContext.value)
    : null
})
const canOpenRunSettings = computed(() => permissionsStore.canEditTenantSettings && Boolean(selectedSavedRun.value))
const showRunActions = computed(() => Boolean(latestSavedOutput.value && runHistoryRoute.value) || canOpenRunSettings.value)
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

function chooseApiWindowPresetChoice(value: string): void {
  if (!isRunWindowPreset(value)) return
  chooseApiWindowPreset(value)
}

function chooseApiWindowPreset(preset: RunWindowPreset): void {
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

function formatDateForPayload(date: Date): string {
  return displayDayStart(date).toISOString()
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

// The selected run is already the full saved-run summary, so unlike Run Result there is no
// lookup to wait on before handing the editor its draft.
async function openRunSettings(): Promise<void> {
  const savedRun = selectedSavedRun.value
  if (!canOpenRunSettings.value || !savedRun) return

  draftStore.setWorkflowOrigin('Run', route.fullPath)
  if (savedRun.runType === 'ruleset') {
    const draft = buildRuleSetDraft(savedRun)
    if (draft) draftStore.setRuleSetDraft(draft, 'ruleset-manager')
  }

  await router.push(buildSavedRunEditorRoute(savedRun))
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
      reject(new Error(`${file.name} speaks a language we do not read`))
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
  // Third and last place the second side is assumed. The step list and the upload payload were both
  // guarded first; this precondition still blocked the run, and only pressing Execute in a browser
  // showed it - the wizard reached its final card with Execute enabled either way.
  if (!file2UsesApi.value && !file2.value && !isSingleSidedRun.value) {
    runError.value = `Upload the ${file2PromptSystemName.value} file before running the diff.`
    return
  }
  const apiWindowRange = hasApiSource.value ? selectedApiWindowRange.value : null
  if (hasApiSource.value && !apiWindowRange) {
    runError.value = 'Choose a valid API time period before running the diff.'
    return
  }
  // Fourth place. A single-sided run has one system and nothing to be different from; the two-system
  // rule is a property of a comparison, not of every run.
  if (isSingleSidedRun.value) {
    if (!file1SystemEnumId.value) {
      runError.value = 'Choose a system before running.'
      return
    }
  } else if (!file1SystemEnumId.value || !file2SystemEnumId.value || file1SystemEnumId.value === file2SystemEnumId.value) {
    runError.value = 'Choose two different systems before running the diff.'
    return
  }

  pendingSubmittedRun.value = null
  let pendingRun: PendingReconciliationRun | null = null

  // The system ids are an OVERRIDE of the saved run's defaults, and run#SavedRunDiff requires them
  // in a pair ("file1SystemEnumId and file2SystemEnumId must be provided together"). A single-sided
  // run has nothing to override and no second id to pair with, so it sends neither and lets the
  // compare scope name its own source. Sending file1 alone trips that rule; sending file2 as an
  // empty string makes a blank id look like a deliberate choice.
  const payload: RunSavedRunDiffPayload = {
    savedRunId: selectedSavedRun.value.savedRunId,
    ...(isSingleSidedRun.value
      ? {}
      : { file1SystemEnumId: file1SystemEnumId.value, file2SystemEnumId: file2SystemEnumId.value }),
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
    // Same condition as the step above, for the same reason: no second side means nothing to read,
    // and readUploadSourcePayload on a null file reports "choose a file" for a card never shown.
    file2UsesApi.value || isSingleSidedRun.value
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
  font-size: var(--type-action-size);
}

.reconciliation-run-history-card__metrics {
  margin: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
}

.reconciliation-run-history-card__metrics div {
  display: grid;
  /* Contains a value below --space-00 (0.2rem). Under 2.5px these are optical nudges rather than spacing, and the scale deliberately stops above them. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  gap: 0.15rem;
}

.reconciliation-run-history-card__metrics dt {
  color: var(--text-muted);
  font-size: var(--type-meta-size);
}

.reconciliation-run-history-card__metrics dd {
  margin: 0;
  font-size: var(--type-tile-size);
}

/* Shares the mascot's box — same bottom offset, same height — so centring inside it puts the
   buttons on the mascot's midline. The bar spans the viewport to centre on the page; only the
   buttons take clicks, so the strip never shadows content or the mascot beside it. */
.reconciliation-run-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--floating-actions-bottom-offset);
  height: var(--floating-mascot-size);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  pointer-events: none;
}

.reconciliation-run-actions > * {
  pointer-events: auto;
}

.reconciliation-run-history-link {
  justify-self: start;
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--type-muted-size);
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

  .reconciliation-run-history-card__metrics {
    grid-template-columns: 1fr;
  }

  .reconciliation-run-history-board {
    width: min(var(--workflow-question-width), 100%);
  }
}
</style>
