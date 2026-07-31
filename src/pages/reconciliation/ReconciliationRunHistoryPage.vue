<template>
  <StaticPageFrame>
    <template #hero>
      <div class="run-history-hero">
        <StaticEditableTitle
          v-model="editableRunName"
          :editable="canEditTenantSettings && Boolean(savedRunId) && !savingRunName"
          aria-label="Run name"
          test-id="run-history-title"
          fallback="Selected Run"
          @commit="saveRunName"
        />
      </div>
    </template>

    <StaticPageSection v-if="runningRuns.length > 0" title="In Progress">
      <div class="static-page-tile-grid run-history-grid" data-testid="run-history-running-results">
        <article
          v-for="runningRun in runningRuns"
          :key="runningRun.runningRunId"
          class="static-page-tile run-history-tile run-history-running-tile"
          data-testid="run-history-running-tile"
        >
          <div class="run-history-tile__head run-history-tile__head--status">
            <span class="static-page-tile-title">{{ formatSavedResultDateTime(runningRun.submittedAt) }}</span>
            <StatusBadge :label="runningRun.statusLabel" tone="warning" />
          </div>
          <p class="section-note" data-testid="run-history-running-progress">{{ runningProgressLine(runningRun) }}</p>
        </article>
      </div>
    </StaticPageSection>

    <StaticPageSection v-if="attentionFailedRuns.length > 0" title="Needs Attention">
      <div class="static-page-tile-grid run-history-grid" data-testid="run-history-failed-results">
        <article
          v-for="failedRun in attentionFailedRuns"
          :key="failedRun.failedRunId"
          class="static-page-tile run-history-tile run-history-failed-tile"
          data-testid="run-history-failed-tile"
        >
          <div class="run-history-tile__head run-history-tile__head--status">
            <span class="static-page-tile-title">{{ formatSavedResultDateTime(failedRun.failedAt) }}</span>
            <StatusBadge label="Failed" tone="danger" />
          </div>
          <p class="section-note" data-testid="run-history-failed-error">{{ failedRun.errorLine }}</p>
        </article>
      </div>
    </StaticPageSection>

    <StaticPageSection v-if="featuredOutput" title="Most Recent">
      <RouterLink
        class="static-page-tile run-history-tile run-history-featured-tile"
        data-testid="run-history-featured-tile"
        :to="buildResultRoute(featuredOutput.fileName)"
      >
        <div class="run-history-tile__head">
          <span class="static-page-tile-title">{{ formatSavedResultDateTime(featuredOutput.createdDate) }}</span>
        </div>
        <dl class="run-history-metrics run-history-metrics--featured">
          <div>
            <dt>Total differences</dt>
            <dd>{{ featuredOutput.totalDifferences ?? 0 }}</dd>
          </div>
          <div>
            <dt>Missing from {{ featuredOutput.file1Label || file1SystemLabel }}</dt>
            <dd>{{ featuredOutput.onlyInFile2Count ?? 0 }}</dd>
          </div>
          <div>
            <dt>Missing from {{ featuredOutput.file2Label || file2SystemLabel }}</dt>
            <dd>{{ featuredOutput.onlyInFile1Count ?? 0 }}</dd>
          </div>
        </dl>
      </RouterLink>
    </StaticPageSection>

    <StaticPageSection v-if="showHistorySection" title="Previous Results">
      <InlineValidation v-if="runSettingsError" tone="error" :message="runSettingsError" />
      <p v-if="showLoadingState" class="section-note" data-testid="run-history-loading">Loading saved results…</p>
      <InlineValidation v-else-if="loadError" tone="error" :message="loadError" />
      <div v-else-if="visibleOtherGeneratedOutputs.length > 0" class="static-page-tile-grid run-history-grid" data-testid="run-history-results">
        <RouterLink
          v-for="output in visibleOtherGeneratedOutputs"
          :key="output.fileName"
          class="static-page-tile run-history-tile"
          data-testid="run-history-result-tile"
          :to="buildResultRoute(output.fileName)"
        >
          <div class="run-history-tile__head">
            <span class="static-page-tile-title">{{ formatSavedResultDateTime(output.createdDate) }}</span>
          </div>
          <dl class="run-history-metrics">
            <div>
              <dt>Total differences</dt>
              <dd>{{ output.totalDifferences ?? 0 }}</dd>
            </div>
            <div>
              <dt>Missing from {{ output.file1Label || file1SystemLabel }}</dt>
              <dd>{{ output.onlyInFile2Count ?? 0 }}</dd>
            </div>
            <div>
              <dt>Missing from {{ output.file2Label || file2SystemLabel }}</dt>
              <dd>{{ output.onlyInFile1Count ?? 0 }}</dd>
            </div>
          </dl>
        </RouterLink>
        <button
          v-if="hasMoreOtherOutputs"
          type="button"
          class="static-page-control-tile run-history-more-tile"
          data-testid="run-history-more"
          :disabled="loadingMore"
          @click="void loadMoreOutputs()"
        >
          {{ loadingMore ? 'Loading…' : 'More...' }}
        </button>
      </div>
      <div v-else class="static-page-drop-hint" data-testid="run-history-empty">No saved results yet for this run.</div>
    </StaticPageSection>

    <template v-if="canRunActiveTenantReconciliation || canOpenRunSettings" #actions>
      <div class="action-row">
        <RouterLink
          v-if="canRunActiveTenantReconciliation"
          class="app-icon-action app-icon-action--large"
          data-testid="run-history-open-workflow"
          aria-label="Open run"
          title="Open run"
          :to="workflowRoute"
          @click="draftStore.setWorkflowOrigin('Run History', route.fullPath)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
          </svg>
        </RouterLink>
        <button
          v-if="canOpenRunSettings"
          type="button"
          class="app-icon-action app-icon-action--large"
          data-testid="run-history-open-settings"
          aria-label="Run settings"
          title="Run settings"
          :disabled="openingRunSettings"
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
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import StaticEditableTitle from '../../components/ui/StaticEditableTitle.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type { PaginationMeta, GeneratedOutput } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { useRunResultsStore } from '../../stores/runResults'
import {
  listPendingReconciliationRuns,
  pruneAbandonedPendingReconciliationRuns,
  resolveCompletedPendingReconciliationRuns,
  subscribeToPendingReconciliationRunsChange,
  type PendingReconciliationRun,
} from '../../lib/reconciliationPendingRuns'
import { normalizeDisplayText, reconciliationStageLabel } from '../../lib/reconciliationDisplay'
import {
  buildReconciliationDiffRoute,
  buildReconciliationRunResultRoute,
  type ReconciliationRunRouteContext,
} from '../../lib/reconciliationRoutes'
import { buildRuleSetDraft, buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../lib/savedRunEditorRoute'
import { playIconPath, playIconTransform } from '../../lib/iconPaths'
import { formatSavedResultDateTime } from '../../lib/utils/date'

const GENERATED_OUTPUT_FETCH_PAGE_SIZE = 6
const OTHER_RESULTS_BATCH_SIZE = 5
const RUNNING_STATUS_IDS = new Set(['AUT_STAT_PENDING', 'AUT_STAT_RUNNING'])

const FAILED_RUN_STATUS_ID = 'AUT_STAT_FAILED'

interface FailedRunView {
  failedRunId: string
  failedAt: string
  errorLine: string
}

interface RunningRunView {
  runningRunId: string
  submittedAt: string
  statusLabel: string
  currentStage: string
  progressPercent: number | null
}

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()
const runResultsStore = useRunResultsStore()
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref<string | null>(null)
const openingRunSettings = ref(false)
const runSettingsError = ref<string | null>(null)
const editableRunName = ref('')
const persistedRunName = ref('')
const savingRunName = ref(false)
const generatedOutputs = ref<GeneratedOutput[]>([])
const pendingRuns = ref<PendingReconciliationRun[]>([])
const lastLoadedPageIndex = ref(-1)
// True after we prime from the run-results cache without making a server
// fetch. Cached data covers the last 2 days; the user still needs a way to
// reach older results, so we treat this as "more might exist server-side"
// until the first server fetch tells us otherwise.
const cachePrimedWithoutFetch = ref(false)
const visibleOtherOutputCount = ref(OTHER_RESULTS_BATCH_SIZE)
const pagination = ref<PaginationMeta>({
  pageIndex: 0,
  pageSize: GENERATED_OUTPUT_FETCH_PAGE_SIZE,
  totalCount: 0,
  pageCount: 1,
})
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const canRunActiveTenantReconciliation = computed(() => permissionsStore.canRunActiveTenantReconciliation)
const settingsIconPath =
  'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.3a2 2 0 0 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.7a2 2 0 0 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6v-.3a2 2 0 0 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 21 10h.3a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z'

const savedRunId = computed(() =>
  typeof route.params.savedRunId === 'string' ? route.params.savedRunId.trim() : '',
)
const routeRunName = computed(() => (typeof route.query.runName === 'string' && route.query.runName.trim() ? route.query.runName.trim() : 'Selected Run'))
const runName = computed(() => editableRunName.value || routeRunName.value)
const file1SystemLabel = computed(() =>
  typeof route.query.file1SystemLabel === 'string' && route.query.file1SystemLabel.trim() ? route.query.file1SystemLabel.trim() : 'System 1',
)
const file2SystemLabel = computed(() =>
  typeof route.query.file2SystemLabel === 'string' && route.query.file2SystemLabel.trim() ? route.query.file2SystemLabel.trim() : 'System 2',
)
const reconciliationRunRouteContext = computed<ReconciliationRunRouteContext>(() => ({
  savedRunId: savedRunId.value,
  runName: runName.value,
  file1SystemLabel: file1SystemLabel.value,
  file2SystemLabel: file2SystemLabel.value,
}))
const workflowRoute = computed(() =>
  buildReconciliationDiffRoute(reconciliationRunRouteContext.value),
)
const canOpenRunSettings = computed(() => canEditTenantSettings.value && Boolean(savedRunId.value))
const runningGeneratedOutputs = computed(() => generatedOutputs.value.filter(isRunningGeneratedOutput))
const completedGeneratedOutputs = computed(() => generatedOutputs.value.filter(isCompletedGeneratedOutput))
const failedGeneratedOutputs = computed(() => generatedOutputs.value.filter(isFailedGeneratedOutput))
// Spotlight only failures newer than the newest completed result: once a newer successful run
// exists, an old failure is history, not an alert.
const attentionFailedRuns = computed<FailedRunView[]>(() => {
  const newestCompletedMs = outputTimestampMs(completedGeneratedOutputs.value[0])
  return failedGeneratedOutputs.value
    .filter((output) => newestCompletedMs == null || (outputTimestampMs(output) ?? 0) > newestCompletedMs)
    .map(buildFailedRunView)
})
const runningRuns = computed<RunningRunView[]>(() => {
  const backendRunningRuns = runningGeneratedOutputs.value.map(buildBackendRunningRunView)
  if (backendRunningRuns.length > 0) return backendRunningRuns
  return pendingRuns.value.map(buildLocalRunningRunView)
})
const featuredOutput = computed(() => completedGeneratedOutputs.value[0] ?? null)
const otherGeneratedOutputs = computed(() => completedGeneratedOutputs.value.slice(1))
const visibleOtherGeneratedOutputs = computed(() => otherGeneratedOutputs.value.slice(0, visibleOtherOutputCount.value))
const showLoadingState = computed(() => loading.value && generatedOutputs.value.length === 0)
const showHistorySection = computed(() =>
  showLoadingState.value ||
  Boolean(loadError.value) ||
  Boolean(runSettingsError.value) ||
  !featuredOutput.value ||
  otherGeneratedOutputs.value.length > 0
)
const hasMoreLoadedOtherOutputs = computed(() => otherGeneratedOutputs.value.length > visibleOtherOutputCount.value)
const hasMoreHistoryPages = computed(() => (
  cachePrimedWithoutFetch.value
  || lastLoadedPageIndex.value + 1 < pagination.value.pageCount
))
const hasMoreOtherOutputs = computed(() => hasMoreLoadedOtherOutputs.value || hasMoreHistoryPages.value)

function buildResultRoute(outputFileName: string) {
  return buildReconciliationRunResultRoute(reconciliationRunRouteContext.value, outputFileName)
}

async function openRunSettings(): Promise<void> {
  const targetId = savedRunId.value
  if (!canOpenRunSettings.value || !targetId || openingRunSettings.value) return

  openingRunSettings.value = true
  runSettingsError.value = null

  try {
    draftStore.setWorkflowOrigin('Run History', route.fullPath)
    const savedRun = await resolveSavedRunEditorTarget(targetId)
    if (!savedRun) {
      runSettingsError.value = `Unable to find run "${targetId}".`
      return
    }

    if (savedRun.runType === 'ruleset') {
      const draft = buildRuleSetDraft(savedRun)
      if (draft) draftStore.setRuleSetDraft(draft, 'ruleset-manager')
    }

    await router.push(buildSavedRunEditorRoute(savedRun))
  } catch (error) {
    runSettingsError.value = error instanceof ApiCallError ? error.message : 'Unable to open run settings.'
  } finally {
    openingRunSettings.value = false
  }
}

function firstText(...values: unknown[]): string {
  return values.map(normalizeDisplayText).find(Boolean) ?? ''
}

function generatedOutputKey(output: GeneratedOutput): string {
  return firstText(output.fileName, output.reconciliationRunResultId) ||
    [output.savedRunId, output.statusEnumId, output.createdDate].map(normalizeDisplayText).filter(Boolean).join(':')
}

function isRunningGeneratedOutput(output: GeneratedOutput): boolean {
  const statusEnumId = normalizeDisplayText(output.statusEnumId)
  return RUNNING_STATUS_IDS.has(statusEnumId)
}

function isCompletedGeneratedOutput(output: GeneratedOutput): boolean {
  return !isRunningGeneratedOutput(output) && output.resultAvailable !== false && Boolean(normalizeDisplayText(output.fileName))
}

function isFailedGeneratedOutput(output: GeneratedOutput): boolean {
  return normalizeDisplayText(output.statusEnumId) === FAILED_RUN_STATUS_ID
}

function isResolvableGeneratedOutput(output: GeneratedOutput): boolean {
  // Local pending markers clear against completed AND failed backend rows — a failure is a
  // terminal outcome too, and only resolving against successes made failed runs ghost as Running.
  return isCompletedGeneratedOutput(output) || isFailedGeneratedOutput(output)
}

function outputTimestampMs(output: GeneratedOutput | undefined): number | null {
  const raw = output?.completedDate ?? output?.createdDate ?? output?.lastUpdatedDate
  if (raw == null || raw === '') return null
  const parsed = typeof raw === 'number' ? raw : new Date(raw).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function buildFailedRunView(output: GeneratedOutput): FailedRunView {
  const runResultId = normalizeDisplayText(output.reconciliationRunResultId)
  // The per-run status poll carries errorMessage; the list descriptor does not.
  const liveStatus = runResultId ? runResultsStore.getRunStatus(runResultId) : null
  const errorMessage = normalizeDisplayText(liveStatus?.errorMessage)
  const failingStage = normalizeDisplayText(liveStatus?.currentStage) || normalizeDisplayText(output.currentStage)
  const stageLabel = failingStage ? reconciliationStageLabel(failingStage, file1SystemLabel.value, file2SystemLabel.value) : ''
  return {
    failedRunId: runResultId || generatedOutputKey(output),
    failedAt: firstText(output.completedDate, output.createdDate, output.lastUpdatedDate) || new Date().toISOString(),
    errorLine: errorMessage || (stageLabel ? `Failed during ${stageLabel}` : 'Run failed before any results were produced.'),
  }
}

function buildBackendRunningRunView(output: GeneratedOutput): RunningRunView {
  const submittedAt = firstText(output.startedDate, output.createdDate, output.lastUpdatedDate) || new Date().toISOString()
  const statusLabel = normalizeDisplayText(output.statusLabel) || 'Running'
  // The per-run status poll is fresher than the list descriptor snapshot, so it wins.
  const runResultId = normalizeDisplayText(output.reconciliationRunResultId)
  const liveStatus = runResultId ? runResultsStore.getRunStatus(runResultId) : null
  const currentStage = normalizeDisplayText(liveStatus?.currentStage) || normalizeDisplayText(output.currentStage)
  const progressPercent = liveStatus?.progressPercent ?? output.progressPercent ?? null
  return {
    runningRunId: generatedOutputKey(output) || `${savedRunId.value}:${submittedAt}`,
    submittedAt,
    statusLabel,
    currentStage,
    progressPercent,
  }
}

function buildLocalRunningRunView(pendingRun: PendingReconciliationRun): RunningRunView {
  return {
    runningRunId: pendingRun.pendingRunId,
    submittedAt: pendingRun.submittedAt,
    statusLabel: 'Running',
    currentStage: '',
    progressPercent: null,
  }
}

function runningProgressLine(view: RunningRunView): string {
  if (!view.currentStage) return 'Results will appear here when this reconciliation finishes.'
  const label = reconciliationStageLabel(view.currentStage, file1SystemLabel.value, file2SystemLabel.value)
  return view.progressPercent != null ? `${label} · ${view.progressPercent}%` : label
}

function refreshPendingRuns(): void {
  pendingRuns.value = listPendingReconciliationRuns(savedRunId.value)
}

function resetHistoryState(): void {
  loadError.value = null
  runSettingsError.value = null
  editableRunName.value = routeRunName.value
  persistedRunName.value = routeRunName.value
  savingRunName.value = false
  generatedOutputs.value = []
  pendingRuns.value = []
  loadingMore.value = false
  lastLoadedPageIndex.value = -1
  cachePrimedWithoutFetch.value = false
  visibleOtherOutputCount.value = OTHER_RESULTS_BATCH_SIZE
  pagination.value = {
    pageIndex: 0,
    pageSize: GENERATED_OUTPUT_FETCH_PAGE_SIZE,
    totalCount: 0,
    pageCount: 1,
  }
}

async function saveRunName(nextRunName: string): Promise<void> {
  const normalizedRunName = nextRunName.trim()
  const previousRunName = persistedRunName.value || routeRunName.value
  if (!canEditTenantSettings.value) {
    editableRunName.value = previousRunName
    return
  }
  if (!savedRunId.value) return
  if (!normalizedRunName) {
    editableRunName.value = previousRunName
    return
  }
  if (normalizedRunName === previousRunName || savingRunName.value) return

  savingRunName.value = true
  loadError.value = null

  try {
    const response = await reconciliationFacade.saveSavedRunName({
      savedRunId: savedRunId.value,
      runName: normalizedRunName,
    })
    const savedRunName = response.savedRun?.runName || normalizedRunName
    editableRunName.value = savedRunName
    persistedRunName.value = savedRunName
  } catch (error) {
    editableRunName.value = previousRunName
    loadError.value = error instanceof ApiCallError ? error.message : 'Unable to save run name.'
  } finally {
    savingRunName.value = false
  }
}

function appendGeneratedOutputs(nextOutputs: GeneratedOutput[]): void {
  const existingOutputKeys = new Set(generatedOutputs.value.map(generatedOutputKey))
  const dedupedOutputs = nextOutputs.filter((output) => {
    const outputKey = generatedOutputKey(output)
    if (!outputKey || existingOutputKeys.has(outputKey)) return false
    existingOutputKeys.add(outputKey)
    return true
  })
  generatedOutputs.value = [...generatedOutputs.value, ...dedupedOutputs]
}

const pageAbortController = new AbortController()
let historyController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  historyController?.abort()
})

async function loadGeneratedOutputs(targetPageIndex = 0, append = false): Promise<void> {
  const requestedSavedRunId = savedRunId.value

  if (!requestedSavedRunId) {
    resetHistoryState()
    loadError.value = 'Run history is unavailable without a selected reconciliation run.'
    return
  }

  if (!append) {
    historyController?.abort()
    historyController = new AbortController()
  }
  const signal = historyController?.signal

  if (append) loadingMore.value = true
  else {
    loading.value = true
    loadError.value = null
  }

  try {
    const response = await reconciliationFacade.listGeneratedOutputs({
      savedRunId: requestedSavedRunId,
      pageIndex: targetPageIndex,
      pageSize: GENERATED_OUTPUT_FETCH_PAGE_SIZE,
      query: '',
    }, signal)

    if (savedRunId.value !== requestedSavedRunId) return

    const nextOutputs = response.generatedOutputs ?? []
    if (append) appendGeneratedOutputs(nextOutputs)
    else generatedOutputs.value = nextOutputs
    // The server is the truth for running runs: no RUNNING row means an old-enough local
    // marker belongs to a run that died server-side — drop it instead of ghosting a tile.
    if (!generatedOutputs.value.some(isRunningGeneratedOutput)) {
      pruneAbandonedPendingReconciliationRuns(requestedSavedRunId)
    }
    pendingRuns.value = resolveCompletedPendingReconciliationRuns(
      requestedSavedRunId,
      generatedOutputs.value.filter(isResolvableGeneratedOutput),
    )

    pagination.value = response.pagination ?? pagination.value
    lastLoadedPageIndex.value = targetPageIndex
    cachePrimedWithoutFetch.value = false

    // Seed the global run-results cache from this fetch so navigating away
    // and back doesn't need to re-fetch.
    if (nextOutputs.length > 0) runResultsStore.upsertOutputs(nextOutputs)
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    if (savedRunId.value !== requestedSavedRunId) return

    if (!append) generatedOutputs.value = []
    loadError.value = error instanceof ApiCallError ? error.message : 'Unable to load saved results.'
  } finally {
    if (savedRunId.value === requestedSavedRunId) {
      if (append) loadingMore.value = false
      else loading.value = false
    }
  }
}

async function loadMoreOutputs(): Promise<void> {
  if (hasMoreLoadedOtherOutputs.value) {
    visibleOtherOutputCount.value += OTHER_RESULTS_BATCH_SIZE
    return
  }

  if (!hasMoreHistoryPages.value || loadingMore.value) return

  await loadGeneratedOutputs(lastLoadedPageIndex.value + 1, true)
  visibleOtherOutputCount.value += OTHER_RESULTS_BATCH_SIZE
}

function primeFromCache(targetSavedRunId: string): boolean {
  if (!targetSavedRunId) return false
  const cached = runResultsStore.getOutputsForSavedRun(targetSavedRunId)
  if (cached.length === 0) return false

  generatedOutputs.value = cached
  pendingRuns.value = resolveCompletedPendingReconciliationRuns(
    targetSavedRunId,
    cached.filter(isResolvableGeneratedOutput),
  )
  cachePrimedWithoutFetch.value = true
  return true
}

watch(savedRunId, (nextSavedRunId) => {
  resetHistoryState()
  refreshPendingRuns()

  // Recent results (<= 2 days) are kept warm in the run-results cache —
  // hydrated at login, refreshed on tenant switch, and updated locally
  // when runs complete in this session. If the cache has anything for
  // this saved run, render it directly and do NOT make an on-demand DB
  // call. The user can still reach older results (> 2 days) via the
  // "More..." button, which falls through to loadGeneratedOutputs().
  const primed = primeFromCache(nextSavedRunId)
  if (!primed) void loadGeneratedOutputs()
}, { immediate: true })

// Self-review #11: the background auto-refresh updates the run-results cache; re-render this page's
// list from that cache when it changes so a newly-raised result surfaces without a manual reload —
// but only while the page is still showing cached data (don't clobber a user who loaded older
// results via "More...", which sets cachePrimedWithoutFetch=false). No fetch, so no loading flicker.
watch(() => runResultsStore.recentOutputs, () => {
  if (!savedRunId.value) return
  const cached = runResultsStore.getOutputsForSavedRun(savedRunId.value)

  if (!cachePrimedWithoutFetch.value) {
    // Direct-fetch mode (initial load with a cold cache, or the user paged into older results):
    // never clobber the loaded list, but DO surface outputs that appeared after load — a run
    // completing in the background upserts its finished row into the cache via the status-poll
    // refresh, and it must show here without a manual reload. A fresh row also replaces any
    // stale in-progress row for the same run.
    const knownKeys = new Set(generatedOutputs.value.map(generatedOutputKey))
    const freshOutputs = cached.filter((output) => {
      const outputKey = generatedOutputKey(output)
      return outputKey && !knownKeys.has(outputKey)
    })
    if (freshOutputs.length === 0) return
    const freshRunResultIds = new Set(
      freshOutputs.map((output) => normalizeDisplayText(output.reconciliationRunResultId)).filter(Boolean),
    )
    generatedOutputs.value = [
      ...freshOutputs,
      ...generatedOutputs.value.filter((output) => {
        const runResultId = normalizeDisplayText(output.reconciliationRunResultId)
        return !runResultId || !freshRunResultIds.has(runResultId)
      }),
    ]
    return
  }

  // Self-review-2: the background poll rebuilds recentOutputs (new array ref) every tick. Re-prime
  // only when the cached slice for this saved run actually changed, so a no-op tick does not trigger
  // primeFromCache's pending-runs storage write + listener fan-out.
  const unchanged = cached.length === generatedOutputs.value.length &&
    cached.every((output, index) => output.fileName === generatedOutputs.value[index]?.fileName)
  if (unchanged) return
  primeFromCache(savedRunId.value)
})

// Live per-run status polls for the "In Progress" tiles. The store poll stops itself
// on terminal status; this page only stops the ones it started when it unmounts.
const polledRunResultIds = new Set<string>()

watch([runningGeneratedOutputs, failedGeneratedOutputs], ([runningOutputs, failedOutputs]) => {
  // Failed rows get the same poll: the store fetches once (errorMessage for the tile) and the
  // poll stops itself on the terminal status.
  for (const output of [...runningOutputs, ...failedOutputs]) {
    const runResultId = normalizeDisplayText(output.reconciliationRunResultId)
    if (!runResultId || polledRunResultIds.has(runResultId)) continue
    polledRunResultIds.add(runResultId)
    void runResultsStore.startRunStatusPoll(runResultId)
  }
}, { immediate: true })

let unsubscribePendingRunsListener: (() => void) | null = null

onMounted(() => {
  unsubscribePendingRunsListener = subscribeToPendingReconciliationRunsChange(refreshPendingRuns)
  // Audit 2026-06-11 #11: keep recent run results fresh while this page is open so a sync failure
  // raised in the background surfaces without a manual reload. Paused automatically when hidden.
  runResultsStore.startAutoRefresh()
})

onUnmounted(() => {
  unsubscribePendingRunsListener?.()
  unsubscribePendingRunsListener = null
  runResultsStore.stopAutoRefresh()
  for (const runResultId of polledRunResultIds) runResultsStore.stopRunStatusPoll(runResultId)
  polledRunResultIds.clear()
})
</script>

<style scoped>
.run-history-hero {
  display: grid;
  gap: var(--space-2);
}

.run-history-hero h1 {
  margin: 0;
}

.run-history-featured-tile {
  width: 100%;
  min-height: 0;
}

.run-history-tile {
  width: 100%;
  align-items: flex-start;
  gap: var(--space-3);
  justify-content: flex-start;
  text-align: left;
}

.run-history-tile__head,
.run-history-metrics {
  display: grid;
  gap: var(--space-2);
}

.run-history-tile__head--status {
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.run-history-metrics {
  margin: 0;
}

.run-history-metrics--featured {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.run-history-metrics div {
  display: grid;
  gap: 0.15rem;
}

.run-history-metrics dt {
  color: var(--text-muted);
}

.run-history-metrics dd {
  margin: 0;
}

.run-history-more-tile {
  width: 100%;
}

@media (max-width: 760px) {
  .run-history-metrics--featured {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
}
</style>
