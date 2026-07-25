<template>
  <div class="run-result-page-shell">
    <aside
      v-if="savedOutput && showRuleSelector"
      class="run-result-rule-selector"
      :class="{ 'run-result-rule-selector--collapsed': ruleSelectorCollapsed }"
      data-testid="run-result-rule-selector"
      aria-label="Rule Selector"
    >
      <div
        v-if="!ruleSelectorCollapsed"
        class="run-result-rule-selector__panel"
        data-testid="run-result-rule-list"
      >
        <div class="run-result-rule-selector__options">
          <button
            type="button"
            class="run-result-rule-selector__option"
            :class="{ 'run-result-rule-selector__option--active': selectedRuleFilterKey === ALL_RULE_FILTER_KEY }"
            data-rule-filter-key="all"
            :aria-pressed="selectedRuleFilterKey === ALL_RULE_FILTER_KEY ? 'true' : 'false'"
            @click="selectRuleFilter(ALL_RULE_FILTER_KEY)"
          >
            <span class="run-result-rule-selector__option-label">All</span>
            <span class="run-result-rule-selector__option-detail">{{ ruleSelectorAllDetail }}</span>
            <span class="run-result-rule-selector__option-count">{{ diffTotalCount }}</span>
          </button>

          <button
            v-for="option in ruleSelectorOptions"
            :key="option.key"
            type="button"
            class="run-result-rule-selector__option"
            :class="{ 'run-result-rule-selector__option--active': selectedRuleFilterKey === option.key }"
            :data-rule-filter-key="option.key"
            :aria-pressed="selectedRuleFilterKey === option.key ? 'true' : 'false'"
            @click="selectRuleFilter(option.key)"
          >
            <span class="run-result-rule-selector__option-label">{{ option.label }}</span>
            <span class="run-result-rule-selector__option-detail">{{ option.detail }}</span>
            <span class="run-result-rule-selector__option-count">{{ option.count }}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        class="run-result-rule-selector__toggle"
        data-testid="run-result-rule-selector-toggle"
        :aria-label="ruleSelectorCollapsed ? 'Expand rule selector' : 'Collapse rule selector'"
        :aria-expanded="ruleSelectorCollapsed ? 'false' : 'true'"
        @click="toggleRuleSelectorCollapsed"
      >
        <svg
          class="run-result-rule-selector__toggle-icon"
          :class="{ 'run-result-rule-selector__toggle-icon--collapsed': ruleSelectorCollapsed }"
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12.3 4.8 7.1 10l5.2 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M16 4.8 10.8 10l5.2 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </aside>

    <StaticPageFrame>
      <template #hero>
        <div class="run-result-hero">
          <StaticEditableTitle
            v-model="editableRunName"
            :editable="canEditTenantSettings && Boolean(savedOutput && savedRunId) && !savingRunName"
            aria-label="Run name"
            test-id="run-result-title"
            fallback="Selected Run"
            @commit="saveRunName"
          />
          <p class="static-page-section-description">{{ heroDescription }}</p>
        </div>
      </template>

      <StaticPageSection>
        <InlineValidation v-if="runSettingsError" tone="error" :message="runSettingsError" />
        <p v-if="loading" class="section-note" data-testid="run-result-loading">Loading saved result…</p>
        <InlineValidation v-else-if="loadError" tone="error" :message="loadError" />

        <section v-else-if="savedOutput" class="reconciliation-diff-details">
          <section v-if="showRunSourceDetails" class="run-result-source-details" data-testid="run-result-source-details">
            <div class="run-result-source-details__summary">
              <span class="run-result-source-details__eyebrow">{{ runSourceModeLabel }}</span>
              <strong v-if="runSourceDateRangeLabel">{{ runSourceDateRangeLabel }}</strong>
            </div>
            <div class="run-result-source-details__files" :aria-label="runSourceFilesLabel">
              <span v-if="isApiRunSource" class="run-result-source-details__files-label">Files compared</span>
              <div
                v-for="sourceFile in runSourceFiles"
                :key="sourceFile.key"
                class="run-result-source-file"
              >
                <span class="run-result-source-file__label">{{ sourceFile.label }}</span>
                <span class="run-result-source-file__name">{{ sourceFile.fileName }}</span>
                <button
                  v-if="sourceFile.canDownload"
                  type="button"
                  class="run-result-source-file__download"
                  data-testid="run-result-source-download"
                  :aria-label="`Download ${sourceFile.fileName}`"
                  :disabled="downloadingSourceFilePath === sourceFile.filePath"
                  @click="downloadRunSourceFile(sourceFile)"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path
                      d="M10 2.5a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V3.25A.75.75 0 0 1 10 2.5Zm-5 11a.75.75 0 0 1 .75.75v1.5c0 .14.11.25.25.25h8c.14 0 .25-.11.25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 14 17.5H6A1.75 1.75 0 0 1 4.25 15.75v-1.5A.75.75 0 0 1 5 13.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <InlineValidation v-if="sourceDownloadError" tone="error" :message="sourceDownloadError" />
          </section>

          <section
            v-if="showStepTimeline"
            class="run-result-step-timeline"
            data-testid="run-result-step-timeline"
          >
            <button
              type="button"
              class="run-result-step-timeline__toggle"
              data-testid="run-result-step-timeline-toggle"
              :aria-label="stepTimelineCollapsed ? 'Expand run steps' : 'Collapse run steps'"
              :aria-expanded="stepTimelineCollapsed ? 'false' : 'true'"
              @click="stepTimelineCollapsed = !stepTimelineCollapsed"
            >
              <span class="run-result-step-timeline__label">Run steps</span>
              <span v-if="runStatusSteps.length > 0" class="run-result-step-timeline__count">{{ runStatusSteps.length }}</span>
              <svg
                class="run-result-step-timeline__toggle-icon"
                :class="{ 'run-result-step-timeline__toggle-icon--collapsed': stepTimelineCollapsed }"
                viewBox="0 0 20 20"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12.3 4.8 7.1 10l5.2 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <p
              v-if="!stepTimelineCollapsed && runStatusSteps.length === 0"
              class="section-note"
              data-testid="run-result-step-timeline-empty"
            >
              No step detail (legacy run).
            </p>
            <ol v-else-if="!stepTimelineCollapsed" class="run-result-step-timeline__list">
              <li
                v-for="step in runStatusSteps"
                :key="`${step.stageSequence ?? 0}-${step.stageCode ?? ''}`"
                class="run-result-step"
              >
                <StatusBadge :label="stepStatusLabel(step)" :tone="stepStatusTone(step)" />
                <span class="run-result-step__stage">{{ stepStageLabel(step) }}</span>
                <span v-if="stepDurationLabel(step)" class="run-result-step__meta">{{ stepDurationLabel(step) }}</span>
                <span v-if="stepRecordsLabel(step)" class="run-result-step__meta">{{ stepRecordsLabel(step) }}</span>
                <span v-if="step.errorMessage" class="run-result-step__error">{{ step.errorMessage }}</span>
              </li>
            </ol>
          </section>

          <div class="reconciliation-diff-details__bucket-grid">
            <template
              v-for="bucket in diffDetailBuckets"
              :key="bucket.key"
            >
              <button
                v-if="bucket.bucketKey"
                :data-testid="bucket.testId"
                type="button"
                class="reconciliation-diff-bucket"
                :class="{ 'reconciliation-diff-bucket--active': activeDiffBuckets.includes(bucket.bucketKey) }"
                :aria-pressed="activeDiffBuckets.includes(bucket.bucketKey) ? 'true' : 'false'"
                @click="toggleDiffBucket(bucket.bucketKey)"
              >
                <span class="reconciliation-diff-bucket__label">{{ bucket.label }}</span>
                <strong>{{ bucket.count }}</strong>
              </button>
              <div
                v-else
                :data-testid="bucket.testId"
                class="reconciliation-diff-bucket reconciliation-diff-bucket--active reconciliation-diff-bucket--static"
              >
                <span class="reconciliation-diff-bucket__label">{{ bucket.label }}</span>
                <strong>{{ bucket.count }}</strong>
              </div>
            </template>
          </div>

          <div v-if="showDiffDetailsToolbar" class="reconciliation-diff-details__toolbar">
            <label class="reconciliation-diff-details__search">
              <div class="reconciliation-diff-details__search-field">
                <input
                  v-model="diffDetailsSearch"
                  data-testid="diff-details-search"
                  class="reconciliation-diff-details__search-input"
                  type="text"
                  aria-label="Record search"
                  spellcheck="false"
                  autocomplete="off"
                  placeholder="Search record id"
                />
                <button
                  v-if="diffDetailsSearch.trim().length > 0"
                  type="button"
                  data-testid="diff-details-search-clear"
                  class="reconciliation-diff-details__search-clear"
                  aria-label="Clear record search"
                  @click="clearDiffDetailsSearch"
                >
                  ×
                </button>
              </div>
            </label>
          </div>

          <div
            v-if="diffFilteredCount > 0"
            class="reconciliation-diff-details__pagination"
            data-testid="diff-details-pagination"
          >
            <button
              type="button"
              data-testid="diff-page-previous"
              :disabled="diffPageIndex === 0 || differencesLoading"
              @click="goToDiffDetailsPage(diffPageIndex - 1)"
            >
              Previous
            </button>
            <p>Page {{ diffPageIndex + 1 }} of {{ diffPageCount }}</p>
            <button
              type="button"
              data-testid="diff-page-next"
              :disabled="diffPageIndex >= diffPageCount - 1 || differencesLoading"
              @click="goToDiffDetailsPage(diffPageIndex + 1)"
            >
              Next
            </button>
          </div>

          <InlineValidation v-if="resultDownloadError" tone="error" :message="resultDownloadError" />
          <AppTableFrame
            v-if="diffDetailRows.length > 0"
            :columns="diffDetailColumns"
            :rows="pagedDiffDetailRowsAsRows"
            row-key="rowKey"
            row-test-id="diff-details-row"
          >
            <template #header-actions>
              <button
                v-if="downloadableOutputFile"
                type="button"
                class="app-table__header-action"
                data-testid="run-result-download"
                aria-label="Download saved result"
                :disabled="downloadingSavedResult"
                @click="void downloadSavedResult()"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path
                    d="M10 2.5a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V3.25A.75.75 0 0 1 10 2.5Zm-5 11a.75.75 0 0 1 .75.75v1.5c0 .14.11.25.25.25h8c.14 0 .25-.11.25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 14 17.5H6A1.75 1.75 0 0 1 4.25 15.75v-1.5A.75.75 0 0 1 5 13.5Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </template>

            <template #cell-recordId="{ row }">
              <strong>{{ row.recordId }}</strong>
            </template>

            <template #cell-detailText="{ row }">
              <JsonCollapseViewer
                v-if="isJsonCollapseValue(row.detailValue)"
                class="run-result-table__json"
                :value="row.detailValue"
              />
              <pre v-else class="run-result-table__json">{{ row.detailText }}</pre>
            </template>

            <template #cell-actions>
              <span aria-hidden="true"></span>
            </template>
          </AppTableFrame>
          <p v-else data-testid="diff-details-empty" class="section-note">
            {{ diffDetailsEmptyMessage }}
          </p>
        </section>
      </StaticPageSection>

      <template v-if="savedOutput" #actions>
        <div class="action-row">
          <RouterLink
            v-if="canRunActiveTenantReconciliation"
            class="app-icon-action app-icon-action--large"
            data-testid="run-result-open-workflow"
            aria-label="Open run"
            title="Open run"
            :to="workflowRoute"
            @click="draftStore.setWorkflowOrigin('Run Result', route.fullPath)"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
            </svg>
          </RouterLink>
          <RouterLink
            class="app-icon-action app-icon-action--large"
            data-testid="run-result-view-history"
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
            data-testid="run-result-open-settings"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import JsonCollapseViewer from '../../components/ui/JsonCollapseViewer.vue'
import StaticEditableTitle from '../../components/ui/StaticEditableTitle.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type {
  GeneratedOutput,
  GeneratedOutputDifferencesMetadata,
  GeneratedOutputDifferencesSummary,
  ReconciliationRunStep,
} from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { useRunResultsStore } from '../../stores/runResults'
import { formatRunStepDuration, normalizeDisplayText, reconciliationStageLabel } from '../../lib/reconciliationDisplay'
import {
  ALL_RULE_FILTER_KEY,
  BASE_RULE_FILTER_KEY,
  DIFF_BUCKET_ORDER,
  DIFF_DETAILS_PAGE_SIZE,
  isJsonCollapseValue,
  type DiffBucketKey,
  type DiffDetailsMetadata,
  type DiffDetailsSummary,
} from '../../lib/runResultDiffDetails'
import {
  buildReconciliationDiffRoute,
  buildReconciliationRunHistoryRoute,
  type ReconciliationRunRouteContext,
} from '../../lib/reconciliationRoutes'
import { buildRuleSetDraft, buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../lib/savedRunEditorRoute'
import { listIconPath, playIconPath, playIconTransform } from '../../lib/iconPaths'
import { formatSavedResultDateTime } from '../../lib/utils/date'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { useRunResultDifferences } from '../../composables/useRunResultDifferences'
import { useRunResultDownloads } from '../../composables/useRunResultDownloads'
import { useRunResultName } from '../../composables/useRunResultName'
import { useRunResultSourceDetails } from '../../composables/useRunResultSourceDetails'

interface DiffDetailBucketCard {
  key: string
  label: string
  count: number
  testId: string
  bucketKey?: DiffBucketKey
}

const diffDetailColumns = [
  {
    key: 'recordId',
    label: 'Record ID',
    colStyle: { width: '13rem' },
  },
  {
    key: 'detailText',
    label: 'Diff Detail',
  },
  {
    key: 'actions',
    label: '',
    headerAlign: 'end' as const,
    colClass: 'app-table__action-column',
    headerClass: 'app-table__action-header',
    cellClass: 'app-table__action-cell',
  },
]

const route = useRoute()
const router = useRouter()
const draftStore = useReconciliationDraftStore()
const permissionsStore = usePermissionsStore()
const loading = ref(false)
const loadError = ref<string | null>(null)
const openingRunSettings = ref(false)
const runSettingsError = ref<string | null>(null)
const savedOutput = ref<GeneratedOutput | null>(null)
const diffDetailsMeta = ref<DiffDetailsMetadata>({})
const diffDetailsSummary = ref<DiffDetailsSummary>({})

const savedRunId = computed(() =>
  typeof route.params.savedRunId === 'string' ? route.params.savedRunId.trim() : '',
)
const outputFileName = computed(() =>
  typeof route.params.outputFileName === 'string' ? route.params.outputFileName.trim() : '',
)
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const canRunActiveTenantReconciliation = computed(() => permissionsStore.canRunActiveTenantReconciliation)
const settingsIconPath =
  'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.3a2 2 0 0 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.7a2 2 0 0 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6v-.3a2 2 0 0 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 21 10h.3a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z'
const routeRunName = computed(() => (typeof route.query.runName === 'string' && route.query.runName.trim() ? route.query.runName.trim() : 'Selected Run'))

const {
  editableRunName,
  persistedRunName,
  savingRunName,
  saveRunName,
  resetRunNameState,
} = useRunResultName({
  savedRunId,
  fallbackRunName: routeRunName,
  canEditTenantSettings,
  setLoadError: (message) => {
    loadError.value = message
  },
})

const runName = computed(() => editableRunName.value || routeRunName.value)
const file1SystemLabel = computed(() =>
  typeof route.query.file1SystemLabel === 'string' && route.query.file1SystemLabel.trim() ? route.query.file1SystemLabel.trim() : 'System 1',
)
const file2SystemLabel = computed(() =>
  typeof route.query.file2SystemLabel === 'string' && route.query.file2SystemLabel.trim() ? route.query.file2SystemLabel.trim() : 'System 2',
)
const heroDescription = computed(() =>
  savedOutput.value?.createdDate ? formatSavedResultDateTime(savedOutput.value.createdDate) : 'Review the saved reconciliation output for this run.',
)
const diffDetailsFile1Label = computed(
  () => diffDetailsMeta.value.file1Label || savedOutput.value?.file1Label || file1SystemLabel.value || 'File 1',
)
const diffDetailsFile2Label = computed(
  () => diffDetailsMeta.value.file2Label || savedOutput.value?.file2Label || file2SystemLabel.value || 'File 2',
)
const reconciliationRunRouteContext = computed<ReconciliationRunRouteContext>(() => ({
  savedRunId: savedRunId.value,
  runName: runName.value,
  file1SystemLabel: diffDetailsFile1Label.value,
  file2SystemLabel: diffDetailsFile2Label.value,
}))
const workflowRoute = computed<RouteLocationRaw>(() =>
  buildReconciliationDiffRoute(reconciliationRunRouteContext.value),
)
const runHistoryRoute = computed<RouteLocationRaw>(() =>
  buildReconciliationRunHistoryRoute(reconciliationRunRouteContext.value),
)
const runSettingsId = computed(() =>
  savedOutput.value?.reconciliationMappingId?.trim() ||
  savedOutput.value?.ruleSetId?.trim() ||
  savedOutput.value?.savedRunId?.trim() ||
  savedRunId.value,
)
const canOpenRunSettings = computed(() => canEditTenantSettings.value && Boolean(runSettingsId.value))

// Step timeline (recon observability Phase 4). The differences payload does not carry the
// run-result id, so it is resolved from the run-results cache descriptor for this file;
// the store poll self-terminates once the run status is terminal.
const runResultsStore = useRunResultsStore()
const polledTimelineRunIds = new Set<string>()
const timelineRunResultId = computed(() =>
  normalizeDisplayText(runResultsStore.getByFileName(outputFileName.value)?.reconciliationRunResultId),
)
const runStatus = computed(() =>
  timelineRunResultId.value ? runResultsStore.getRunStatus(timelineRunResultId.value) : null,
)
const runStatusSteps = computed<ReconciliationRunStep[]>(() => runStatus.value?.steps ?? [])
const showStepTimeline = computed(() => runStatus.value?.ok === true)
// Collapsed by default: the timeline is a forensic view, not part of the primary read path.
const stepTimelineCollapsed = ref(true)

watch(timelineRunResultId, (runResultId) => {
  if (!runResultId || polledTimelineRunIds.has(runResultId)) return
  polledTimelineRunIds.add(runResultId)
  void runResultsStore.startRunStatusPoll(runResultId)
}, { immediate: true })

// Warm the cache so a deep link into this page can still resolve the file's run id.
void runResultsStore.ensureLoaded()

const STEP_STATUS_LABELS: Record<string, string> = {
  AUT_STAT_PENDING: 'Pending',
  AUT_STAT_RUNNING: 'Running',
  AUT_STAT_SUCCESS: 'Done',
  AUT_STAT_FAILED: 'Failed',
  AUT_STAT_NO_DATA: 'No data',
}

function stepStatusLabel(step: ReconciliationRunStep): string {
  const statusEnumId = normalizeDisplayText(step.statusEnumId)
  return STEP_STATUS_LABELS[statusEnumId] ?? (statusEnumId || 'Unknown')
}

function stepStatusTone(step: ReconciliationRunStep): 'neutral' | 'success' | 'warning' | 'danger' {
  const statusEnumId = normalizeDisplayText(step.statusEnumId)
  if (statusEnumId === 'AUT_STAT_SUCCESS') return 'success'
  if (statusEnumId === 'AUT_STAT_FAILED') return 'danger'
  if (statusEnumId === 'AUT_STAT_RUNNING') return 'warning'
  return 'neutral'
}

function stepStageLabel(step: ReconciliationRunStep): string {
  return reconciliationStageLabel(step.stageCode, diffDetailsFile1Label.value, diffDetailsFile2Label.value)
}

function stepDurationLabel(step: ReconciliationRunStep): string {
  return formatRunStepDuration(step.startedDate, step.completedDate)
}

function stepRecordsLabel(step: ReconciliationRunStep): string {
  return step.recordCount != null ? `${step.recordCount.toLocaleString()} records` : ''
}

const {
  runSourceDetails,
  runSourceFiles,
  isApiRunSource,
  runSourceModeLabel,
  runSourceDateRangeLabel,
  runSourceFilesLabel,
  showRunSourceDetails,
  resetRunSourceDetails,
} = useRunResultSourceDetails({
  file1Label: diffDetailsFile1Label,
  file2Label: diffDetailsFile2Label,
})

const {
  downloadableOutputFile,
  sourceDownloadError,
  downloadingSourceFilePath,
  resultDownloadError,
  downloadingSavedResult,
  downloadRunSourceFile,
  downloadSavedResult,
  resetDownloadState,
} = useRunResultDownloads({ outputFileName })

const {
  diffDetailRows,
  selectedRuleFilterKey,
  ruleSelectorCollapsed,
  diffDetailsSearch,
  diffTotalCount,
  diffFilteredCount,
  diffPageIndex,
  diffPageCount,
  diffControlsReady,
  differencesLoading,
  activeDiffBuckets,
  diffDetailBucketCounts,
  ruleSelectorOptions,
  selectedRuleSelectorOption,
  ruleSelectorAllDetail,
  showRuleSelector,
  showDiffDetailsToolbar,
  diffDetailsEmptyMessage,
  pagedDiffDetailRowsAsRows,
  applyDifferencesResponse,
  resetDifferencesState,
  goToDiffDetailsPage,
  clearDiffDetailsSearch,
  toggleDiffBucket,
  toggleRuleSelectorCollapsed,
  selectRuleFilter,
} = useRunResultDifferences({
  outputFileName,
  onLoadError: (message) => {
    loadError.value = message
  },
})

const overviewDiffDetailBuckets = computed<DiffDetailBucketCard[]>(() => {
  const ruleDifferenceCount =
    diffDetailsSummary.value.ruleDifferenceCount ??
    diffDetailBucketCounts.value.rule

  return [
    {
      key: 'file-1',
      bucketKey: 'file-1',
      label: `Missing from ${diffDetailsFile1Label.value}`,
      count:
        diffDetailsSummary.value.onlyInFile2Count ??
        diffDetailBucketCounts.value['file-1'],
      testId: 'diff-bucket-file-1',
    },
    {
      key: 'file-2',
      bucketKey: 'file-2',
      label: `Missing from ${diffDetailsFile2Label.value}`,
      count:
        diffDetailsSummary.value.onlyInFile1Count ??
        diffDetailBucketCounts.value['file-2'],
      testId: 'diff-bucket-file-2',
    },
    ...(ruleDifferenceCount > 0
      ? [{
          key: 'rule',
          bucketKey: 'rule' as const,
          label: 'Rule differences',
          count: ruleDifferenceCount,
          testId: 'diff-bucket-rule',
        }]
      : []),
  ]
})
const diffDetailBuckets = computed<DiffDetailBucketCard[]>(() => {
  if (selectedRuleFilterKey.value === ALL_RULE_FILTER_KEY) return overviewDiffDetailBuckets.value

  if (selectedRuleFilterKey.value === BASE_RULE_FILTER_KEY) {
    return overviewDiffDetailBuckets.value.filter((bucket) => bucket.bucketKey === 'file-1' || bucket.bucketKey === 'file-2')
  }

  return [
    {
      key: 'selected-rule-total',
      label: 'Total results',
      count:
        selectedRuleSelectorOption.value?.count ??
        diffFilteredCount.value,
      testId: 'diff-bucket-total-results',
    },
  ]
})

async function openRunSettings(): Promise<void> {
  const targetId = runSettingsId.value
  if (!canOpenRunSettings.value || !targetId || openingRunSettings.value) return

  openingRunSettings.value = true
  runSettingsError.value = null

  try {
    draftStore.setWorkflowOrigin('Run Result', route.fullPath)
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

function resetDiffDetailsState(): void {
  savedOutput.value = null
  resetRunSourceDetails()
  resetDownloadState()
  resetRunNameState()
  diffDetailsMeta.value = {}
  diffDetailsSummary.value = {}
  resetDifferencesState()
}

function buildGeneratedOutputFromSummary(
  fileName: string,
  metadata: GeneratedOutputDifferencesMetadata,
  summary: GeneratedOutputDifferencesSummary,
): GeneratedOutput {
  const file1LabelValue = normalizeDisplayText(metadata.file1Label) || normalizeDisplayText(file1SystemLabel.value) || 'File 1'
  const file2LabelValue = normalizeDisplayText(metadata.file2Label) || normalizeDisplayText(file2SystemLabel.value) || 'File 2'

  return {
    fileName,
    sourceFormat: 'json',
    availableFormats: ['json', 'csv'],
    preferredDownloadFormat: 'csv',
    savedRunId: metadata.savedRunId || metadata.reconciliationMappingId || metadata.ruleSetId || savedRunId.value,
    savedRunName: metadata.savedRunName || metadata.reconciliationMappingName || runName.value,
    savedRunType: metadata.savedRunType || (metadata.ruleSetId ? 'ruleset' : 'mapping'),
    reconciliationMappingId: metadata.reconciliationMappingId,
    mappingName: metadata.reconciliationMappingName,
    ruleSetId: metadata.ruleSetId,
    compareScopeId: metadata.compareScopeId,
    file1Label: file1LabelValue,
    file2Label: file2LabelValue,
    totalDifferences: summary.totalDifferences ?? 0,
    onlyInFile1Count: summary.onlyInFile1Count ?? 0,
    onlyInFile2Count: summary.onlyInFile2Count ?? 0,
    createdDate: metadata.timestamp,
  }
}

const pageAbortController = new AbortController()
let loadSavedResultController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadSavedResultController?.abort()
  for (const runResultId of polledTimelineRunIds) runResultsStore.stopRunStatusPoll(runResultId)
  polledTimelineRunIds.clear()
})

async function loadSavedResult(): Promise<void> {
  const requestedSavedRunId = savedRunId.value
  const requestedOutputFileName = outputFileName.value

  if (!requestedSavedRunId || !requestedOutputFileName) {
    resetDiffDetailsState()
    loadError.value = 'Saved result details are unavailable without a selected run result.'
    return
  }

  loadSavedResultController?.abort()
  loadSavedResultController = new AbortController()
  const signal = loadSavedResultController.signal

  loading.value = true
  loadError.value = null
  resetDiffDetailsState()

  try {
    const response = await reconciliationFacade.getGeneratedOutputDifferences({
      fileName: requestedOutputFileName,
      pageIndex: 0,
      pageSize: DIFF_DETAILS_PAGE_SIZE,
      buckets: DIFF_BUCKET_ORDER.join(','),
      ruleFilterKey: ALL_RULE_FILTER_KEY,
      search: '',
      includeFacets: true,
    }, signal)

    if (savedRunId.value !== requestedSavedRunId || outputFileName.value !== requestedOutputFileName) return

    const metadata = response.metadata ?? {}
    const summary = response.summary ?? {}
    const descriptor = buildGeneratedOutputFromSummary(requestedOutputFileName, metadata, summary)

    savedOutput.value = descriptor
    downloadableOutputFile.value = response.outputFile ? { ...response.outputFile } : null
    runSourceDetails.value = response.outputFile?.sourceDetails ?? null
    editableRunName.value = descriptor.savedRunName || routeRunName.value
    persistedRunName.value = editableRunName.value
    diffDetailsMeta.value = {
      file1Label: descriptor.file1Label,
      file2Label: descriptor.file2Label,
      timestamp: metadata.timestamp,
    }
    diffDetailsSummary.value = {
      totalDifferences: descriptor.totalDifferences,
      onlyInFile1Count: descriptor.onlyInFile1Count,
      onlyInFile2Count: descriptor.onlyInFile2Count,
      ruleDifferenceCount: summary.ruleDifferenceCount ?? undefined,
      missingObjectDifferenceCount: summary.missingObjectDifferenceCount ?? undefined,
    }
    applyDifferencesResponse(response, true)
    diffControlsReady.value = true
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    if (savedRunId.value !== requestedSavedRunId || outputFileName.value !== requestedOutputFileName) return

    resetDiffDetailsState()
    loadError.value = error instanceof ApiCallError ? error.message : 'Unable to load saved result.'
  } finally {
    if (savedRunId.value === requestedSavedRunId && outputFileName.value === requestedOutputFileName) {
      loading.value = false
    }
  }
}

watch([savedRunId, outputFileName], () => {
  void loadSavedResult()
}, { immediate: true })
</script>

<style scoped>
.run-result-hero {
  display: grid;
  gap: var(--space-2);
}

.run-result-hero h1 {
  margin: 0;
}

.run-result-page-shell {
  position: relative;
}

.run-result-rule-selector {
  position: fixed;
  z-index: 45;
  top: 50vh;
  left: max(0.5rem, env(safe-area-inset-left));
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  transform: translateY(-50%);
}

.run-result-rule-selector--collapsed {
  gap: 0;
}

.run-result-rule-selector__panel {
  display: grid;
  gap: 0.45rem;
  width: min(13.5rem, calc(100vw - 4rem));
  padding: 0.45rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface) 94%, white);
  box-shadow: 0 0.85rem 2rem rgb(15 23 42 / 8%);
}

.run-result-rule-selector__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.55rem;
  min-height: 2.55rem;
  padding: 0;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: color-mix(in oklab, var(--surface) 94%, white);
  color: var(--text-muted);
  box-shadow: 0 0.85rem 2rem rgb(15 23 42 / 8%);
}

.run-result-rule-selector__toggle:hover {
  border-color: color-mix(in oklab, var(--accent) 42%, var(--border));
  background: var(--surface-2);
  color: var(--text);
}

.run-result-rule-selector__toggle-icon {
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  transition: transform 160ms ease;
}

.run-result-rule-selector__toggle-icon--collapsed {
  transform: rotate(180deg);
}

.run-result-rule-selector__options {
  display: grid;
  gap: 0.4rem;
}

.run-result-rule-selector__option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.15rem 0.5rem;
  align-items: center;
  min-height: 3.35rem;
  padding: 0.6rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 92%, white);
  color: var(--text);
  text-align: left;
}

.run-result-rule-selector__option:hover {
  border-color: color-mix(in oklab, var(--accent) 38%, var(--border));
}

.run-result-rule-selector__option--active {
  border-color: color-mix(in oklab, var(--accent) 60%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 78%, var(--accent));
}

.run-result-rule-selector__option-detail {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.run-result-rule-selector__option-count {
  grid-column: 2;
  grid-row: 1;
  font-size: 0.86rem;
  font-weight: 400;
  color: var(--text-muted);
}

.reconciliation-diff-details {
  display: grid;
  gap: var(--space-3);
}

.run-result-source-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 92%, white);
}

.run-result-step-timeline {
  display: grid;
  gap: var(--space-2);
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 92%, white);
}

.run-result-step-timeline__toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  text-align: left;
}

.run-result-step-timeline__label {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-soft);
}

.run-result-step-timeline__count {
  font-size: 0.78rem;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

.run-result-step-timeline__toggle-icon {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--text-soft);
  transform: rotate(-90deg);
  transition: transform 0.15s ease;
}

.run-result-step-timeline__toggle-icon--collapsed {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .run-result-step-timeline__toggle-icon {
    transition: none;
  }
}

.run-result-step-timeline__list {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.run-result-step {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.run-result-step__stage {
  font-weight: 600;
}

.run-result-step__meta {
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

.run-result-step__error {
  flex-basis: 100%;
  color: var(--danger, #b3261e);
  font-size: 0.9rem;
}

.run-result-source-details__summary {
  display: grid;
  gap: 0.15rem;
  min-width: min(100%, 11rem);
}

.run-result-source-details__eyebrow,
.run-result-source-details__files-label,
.run-result-source-file__label {
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.3;
}

.run-result-source-details__summary strong {
  font-size: 0.94rem;
  line-height: 1.35;
  font-weight: 500;
}

.run-result-source-details__files {
  display: flex;
  flex: 1 1 22rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
}

.run-result-source-file {
  display: inline-grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.35rem;
  max-width: min(100%, 25rem);
  min-height: 2.15rem;
  padding: 0.35rem 0.45rem 0.35rem 0.6rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.run-result-source-file__name {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 0.86rem;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-result-source-file__download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  min-height: 1.85rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
}

.run-result-source-file__download:hover {
  border-color: color-mix(in oklab, var(--accent) 42%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 84%, var(--accent));
  color: var(--text);
}

.run-result-source-file__download svg {
  width: 1rem;
  height: 1rem;
}

.reconciliation-diff-details__bucket-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.reconciliation-diff-bucket {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0.35rem;
  min-height: 0;
  padding: var(--space-3);
  text-align: left;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-soft);
  background: color-mix(in oklab, var(--surface-2) 95%, white);
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background 160ms ease;
}

.reconciliation-diff-bucket:hover {
  transform: translateY(-1px);
}

.reconciliation-diff-bucket--static:hover {
  transform: none;
}

.reconciliation-diff-bucket--active {
  border-color: color-mix(in oklab, var(--accent) 58%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 80%, var(--accent));
}

.reconciliation-diff-bucket__label {
  color: var(--text-muted);
}

.reconciliation-diff-bucket strong {
  font-size: 1.9rem;
  line-height: 1;
}

.reconciliation-diff-details__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
}

.reconciliation-diff-details__search {
  width: 100%;
  min-width: 0;
}

.reconciliation-diff-details__search-field {
  position: relative;
}

.reconciliation-diff-details__search-input {
  width: 100%;
  min-height: 3rem;
  padding: 0.8rem 2.9rem 0.8rem 0.95rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}

.reconciliation-diff-details__search-clear {
  position: absolute;
  top: 50%;
  right: 0.55rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  min-height: 1.9rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.35rem;
  line-height: 1;
  transform: translateY(-50%);
}

.reconciliation-diff-details__search-clear:hover {
  background: color-mix(in oklab, var(--surface-2) 84%, var(--accent));
  color: var(--text);
}

.run-result-table__json {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--text);
}

.reconciliation-diff-details__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.reconciliation-diff-details__pagination p {
  margin: 0;
  color: var(--text-muted);
  text-align: center;
}

@media (max-width: 760px) {
  .run-result-rule-selector {
    position: static;
    width: auto;
    margin: 0 var(--space-3) var(--space-3);
    transform: none;
  }

  .run-result-rule-selector__panel {
    width: auto;
    flex: 1 1 auto;
  }

  .run-result-source-details,
  .run-result-source-details__files {
    align-items: stretch;
    justify-content: stretch;
  }

  .run-result-source-details {
    display: grid;
  }

  .run-result-source-file {
    width: 100%;
    max-width: none;
  }

  .reconciliation-diff-details__pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .reconciliation-diff-details__bucket-grid {
    grid-template-columns: 1fr;
  }

  .run-result-table__id-cell {
    width: auto;
  }
}
</style>
