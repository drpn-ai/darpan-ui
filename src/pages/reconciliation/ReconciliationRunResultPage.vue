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
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type {
  GeneratedOutput,
  GeneratedOutputSourceDetails,
  GeneratedOutputSourceFile,
  GetGeneratedOutputFile,
  GetGeneratedOutputDifferencesResponse,
  GeneratedOutputDifferenceRow,
  GeneratedOutputDifferencesMetadata,
  GeneratedOutputDifferencesSummary,
  GeneratedOutputDifferencesRuleOption,
} from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { DEFAULT_LIST_PAGE_SIZE } from '../../lib/listPagination'
import { fileNameFromPath, normalizeDisplayText, normalizeDisplayToken } from '../../lib/reconciliationDisplay'
import {
  buildReconciliationDiffRoute,
  buildReconciliationRunHistoryRoute,
  type ReconciliationRunRouteContext,
} from '../../lib/reconciliationRoutes'
import { buildRuleSetDraft, buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../lib/savedRunEditorRoute'
import { listIconPath, playIconPath, playIconTransform } from '../../lib/iconPaths'
import { formatSavedResultDateTime } from '../../lib/utils/date'
import { downloadTextFile } from '../../lib/utils/download'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

type DiffBucketKey = 'file-1' | 'file-2' | 'rule'

interface DiffDetailsMetadata {
  file1Label?: string
  file2Label?: string
  timestamp?: string
  savedRunId?: string
  savedRunName?: string
  savedRunType?: string
  reconciliationMappingId?: string
  reconciliationMappingName?: string
  ruleSetId?: string
  compareScopeId?: string
}

interface DiffDetailsSummary {
  totalDifferences?: number
  onlyInFile1Count?: number
  onlyInFile2Count?: number
  missingObjectDifferenceCount?: number
  ruleDifferenceCount?: number
}

interface DiffDetailsRecord {
  diffType?: string
  type?: string
  id?: string | number
  primaryId?: string | number
  presentIn?: string
  missingIn?: string
  data?: unknown
  field?: string
  file1Value?: unknown
  file2Value?: unknown
  ruleId?: string
  ruleName?: string
  ruleLabel?: string
  ruleDescription?: string
  severity?: string
  message?: string
}

interface NormalizedDiffDetailRow {
  rowKey: string
  recordId: string
  bucket: DiffBucketKey
  detailValue: unknown
  detailText?: string
  ruleFilterKey: string
  ruleId: string
  ruleLabel: string
}

interface RuleSelectorOption {
  key: string
  label: string
  detail: string
  count: number
  bucketKeys: DiffBucketKey[]
}

interface DiffDetailBucketCard {
  key: string
  label: string
  count: number
  testId: string
  bucketKey?: DiffBucketKey
}

interface RunSourceFileView {
  key: string
  label: string
  fileName: string
  filePath: string
  sourceFormat: string
  downloadFileName: string
  canDownload: boolean
}

type DownloadableOutputFile = Omit<GetGeneratedOutputFile, 'contentText'>

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
const downloadableOutputFile = ref<DownloadableOutputFile | null>(null)
const runSourceDetails = ref<GeneratedOutputSourceDetails | null>(null)
const sourceDownloadError = ref<string | null>(null)
const downloadingSourceFilePath = ref('')
const resultDownloadError = ref<string | null>(null)
const downloadingSavedResult = ref(false)
const editableRunName = ref('')
const persistedRunName = ref('')
const savingRunName = ref(false)
const diffDetailsMeta = ref<DiffDetailsMetadata>({})
const diffDetailsSummary = ref<DiffDetailsSummary>({})
// diffDetailRows now holds ONLY the current server-returned page; whole-document totals + facets come
// from the paginated service so the browser never loads/parses the entire diff file (audit #21).
const diffDetailRows = ref<NormalizedDiffDetailRow[]>([])
const selectedDiffBuckets = ref<DiffBucketKey[]>(['file-1', 'file-2', 'rule'])
const selectedRuleFilterKey = ref('all')
const ruleSelectorCollapsed = ref(false)
const diffDetailsSearch = ref('')
const diffTotalCount = ref(0)
const diffFilteredCount = ref(0)
const serverBucketCounts = ref<Record<DiffBucketKey, number>>(createEmptyDiffBucketCounts())
const serverRuleOptions = ref<RuleSelectorOption[]>([])
const diffPageIndex = ref(0)
const diffPageCount = ref(1)
const diffControlsReady = ref(false)
const differencesLoading = ref(false)

const DIFF_DETAILS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE
const DIFF_BUCKET_ORDER: DiffBucketKey[] = ['file-1', 'file-2', 'rule']
const ALL_RULE_FILTER_KEY = 'all'
const BASE_RULE_FILTER_KEY = 'base-diff'
const normalizeDiffLabel = normalizeDisplayText
const normalizeDiffToken = normalizeDisplayToken

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
const diffDetailsFile1Label = computed(
  () => diffDetailsMeta.value.file1Label || savedOutput.value?.file1Label || file1SystemLabel.value || 'File 1',
)
const diffDetailsFile2Label = computed(
  () => diffDetailsMeta.value.file2Label || savedOutput.value?.file2Label || file2SystemLabel.value || 'File 2',
)
const runSourceFiles = computed<RunSourceFileView[]>(() =>
  (runSourceDetails.value?.files ?? [])
    .map((sourceFile, index) => normalizeRunSourceFile(sourceFile, index))
    .filter((sourceFile): sourceFile is RunSourceFileView => sourceFile !== null),
)
const isApiRunSource = computed(() => {
  const mode = normalizeDiffToken(runSourceDetails.value?.mode)
  return mode.includes('api') || Boolean(runSourceDetails.value?.dateRange?.start || runSourceDetails.value?.dateRange?.end)
})
const runSourceModeLabel = computed(() => isApiRunSource.value ? 'API date range' : 'Source files')
const runSourceDateRangeLabel = computed(() => formatRunSourceDateRange(runSourceDetails.value?.dateRange?.start, runSourceDetails.value?.dateRange?.end))
const runSourceFilesLabel = computed(() => isApiRunSource.value ? 'Files compared' : 'Source files')
const showRunSourceDetails = computed(() =>
  runSourceFiles.value.length > 0 || Boolean(runSourceDateRangeLabel.value),
)
const activeDiffBuckets = computed<DiffBucketKey[]>(() =>
  DIFF_BUCKET_ORDER.filter((bucket) => selectedDiffBuckets.value.includes(bucket)),
)
const diffDetailBucketCounts = computed<Record<DiffBucketKey, number>>(() => serverBucketCounts.value)
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
const ruleSelectorOptions = computed<RuleSelectorOption[]>(() => serverRuleOptions.value)
const selectedRuleSelectorOption = computed(() =>
  ruleSelectorOptions.value.find((option) => option.key === selectedRuleFilterKey.value),
)
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
const showRuleSelector = computed(() =>
  ruleSelectorOptions.value.length > 1 || ruleSelectorOptions.value.some((option) => option.key !== BASE_RULE_FILTER_KEY),
)
const ruleSelectorAllDetail = computed(() =>
  `${diffTotalCount.value} ${diffTotalCount.value === 1 ? 'difference' : 'differences'}`,
)
// Active-bucket total comes from whole-document facets (the server's bucketCounts), not the loaded page.
const activeBucketDiffCount = computed(() =>
  activeDiffBuckets.value.reduce((total, bucket) => total + (serverBucketCounts.value[bucket] ?? 0), 0),
)
const showDiffDetailsToolbar = computed(
  () => diffFilteredCount.value > 0 || diffDetailsSearch.value.trim().length > 0,
)
const diffDetailsEmptyMessage = computed(() => {
  if (diffDetailsSearch.value.trim().length > 0) {
    return 'No records match the current diff detail filters.'
  }
  if (activeDiffBuckets.value.length === 0 && diffTotalCount.value > 0) {
    return 'Select a diff bucket to view matching records.'
  }
  if (activeBucketDiffCount.value === 0 && diffTotalCount.value > 0) {
    return 'No records are available in the selected diff bucket.'
  }
  if (diffFilteredCount.value === 0 && selectedRuleFilterKey.value !== ALL_RULE_FILTER_KEY) {
    return 'No records are available for the selected rule.'
  }
  return 'No diff detail records are available.'
})
// diffDetailRows already holds the current server page; map it straight to table rows.
const pagedDiffDetailRowsAsRows = computed(() =>
  diffDetailRows.value.map((row) => ({
    ...row,
    detailText: isJsonCollapseValue(row.detailValue) ? '' : stringifyDiffJson(row.detailValue),
  })) as Array<Record<string, unknown>>,
)

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

function createEmptyDiffBucketCounts(): Record<DiffBucketKey, number> {
  return {
    'file-1': 0,
    'file-2': 0,
    rule: 0,
  }
}

function normalizeRunSourceFile(sourceFile: GeneratedOutputSourceFile, index: number): RunSourceFileView | null {
  const filePath = normalizeDiffLabel(sourceFile.filePath)
  const fileName =
    normalizeDiffLabel(sourceFile.fileName) ||
    normalizeDiffLabel(sourceFile.downloadFileName) ||
    fileNameFromPath(filePath)
  if (!fileName && !filePath) return null

  const label = normalizeDiffLabel(sourceFile.label) || (index === 0 ? diffDetailsFile1Label.value : diffDetailsFile2Label.value)
  const sourceFormat = normalizeDiffLabel(sourceFile.sourceFormat) || fileNameFromPath(fileName).split('.').pop()?.toLowerCase() || 'json'
  return {
    key: `${sourceFile.side || index}-${filePath || fileName}`,
    label,
    fileName: fileName || filePath,
    filePath,
    sourceFormat,
    downloadFileName: normalizeDiffLabel(sourceFile.downloadFileName) || fileName || filePath,
    canDownload: sourceFile.canDownload !== false && Boolean(filePath),
  }
}

function formatRunSourceDate(value: string | undefined): string {
  const normalizedValue = normalizeDiffLabel(value)
  const dateMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) return normalizedValue

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = Number(dateMatch[2]) - 1
  const monthName = monthNames[monthIndex] ?? dateMatch[2]
  return `${monthName} ${Number(dateMatch[3])}, ${dateMatch[1]}`
}

function formatRunSourceDateRange(start: string | undefined, end: string | undefined): string {
  const formattedStart = formatRunSourceDate(start)
  const formattedEnd = formatRunSourceDate(end)
  if (formattedStart && formattedEnd && formattedStart !== formattedEnd) return `${formattedStart} to ${formattedEnd}`
  return formattedStart || formattedEnd
}

function normalizeDiffBucketSelection(buckets: DiffBucketKey[]): DiffBucketKey[] {
  return DIFF_BUCKET_ORDER.filter((bucket) => buckets.includes(bucket))
}

function resetDiffDetailsState(): void {
  savedOutput.value = null
  downloadableOutputFile.value = null
  runSourceDetails.value = null
  sourceDownloadError.value = null
  downloadingSourceFilePath.value = ''
  resultDownloadError.value = null
  downloadingSavedResult.value = false
  editableRunName.value = routeRunName.value
  persistedRunName.value = routeRunName.value
  savingRunName.value = false
  diffDetailsMeta.value = {}
  diffDetailsSummary.value = {}
  diffDetailRows.value = []
  selectedDiffBuckets.value = [...DIFF_BUCKET_ORDER]
  selectedRuleFilterKey.value = ALL_RULE_FILTER_KEY
  ruleSelectorCollapsed.value = false
  diffDetailsSearch.value = ''
  diffTotalCount.value = 0
  diffFilteredCount.value = 0
  serverBucketCounts.value = createEmptyDiffBucketCounts()
  serverRuleOptions.value = []
  diffPageIndex.value = 0
  diffPageCount.value = 1
  diffControlsReady.value = false
  differencesLoading.value = false
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

function stringifyDiffJson(value: unknown): string {
  if (value == null) return ''

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function isJsonCollapseValue(value: unknown): boolean {
  return value !== null && typeof value === 'object'
}

function resolveDiffType(record: DiffDetailsRecord): string {
  return normalizeDiffLabel(record.diffType || record.type)
}

function parseDiffData(rawData: unknown): unknown {
  if (typeof rawData !== 'string') return rawData

  try {
    return JSON.parse(rawData)
  } catch {
    return rawData
  }
}

function buildDiffDetailPayload(record: DiffDetailsRecord, parsedData: unknown): unknown {
  if (parsedData != null && !(typeof parsedData === 'string' && !parsedData.trim())) {
    return parsedData
  }

  const diffDetail = {
    diffType: resolveDiffType(record) || undefined,
    primaryId:
      record.primaryId != null && String(record.primaryId).trim() ? String(record.primaryId).trim() : undefined,
    field: normalizeDiffLabel(record.field) || undefined,
    file1Value: record.file1Value,
    file2Value: record.file2Value,
    severity: normalizeDiffLabel(record.severity) || undefined,
    ruleId: normalizeDiffLabel(record.ruleId) || undefined,
    message: normalizeDiffLabel(record.message) || undefined,
  }

  const normalizedDetail = Object.fromEntries(Object.entries(diffDetail).filter(([, value]) => value != null))
  return Object.keys(normalizedDetail).length > 0 ? normalizedDetail : null
}

// The server already classified each page row (bucket / rule descriptor / record id); the client only
// rebuilds the presentational detail payload it renders. See backend DiffDetailClassifier (audit #21).
function buildPageRow(serverRow: GeneratedOutputDifferenceRow): NormalizedDiffDetailRow {
  const record = (serverRow.record ?? {}) as DiffDetailsRecord
  const parsedData = parseDiffData((record as Record<string, unknown>).data)
  return {
    rowKey: serverRow.rowKey,
    recordId: serverRow.recordId,
    bucket: serverRow.bucket as DiffBucketKey,
    detailValue: buildDiffDetailPayload(record, parsedData),
    ruleFilterKey: serverRow.ruleFilterKey,
    ruleId: serverRow.ruleId,
    ruleLabel: serverRow.ruleLabel,
  }
}

function normalizeServerBucketCounts(raw: Record<string, number> | undefined): Record<DiffBucketKey, number> {
  const counts = createEmptyDiffBucketCounts()
  if (raw) {
    DIFF_BUCKET_ORDER.forEach((bucket) => {
      const value = Number(raw[bucket])
      counts[bucket] = Number.isFinite(value) ? value : 0
    })
  }
  return counts
}

function normalizeServerRuleOption(option: GeneratedOutputDifferencesRuleOption): RuleSelectorOption {
  return {
    key: option.key,
    label: option.label,
    detail: option.detail,
    count: option.count,
    bucketKeys: (option.bucketKeys ?? []).filter((bucket): bucket is DiffBucketKey =>
      DIFF_BUCKET_ORDER.includes(bucket as DiffBucketKey),
    ),
  }
}

function applyDifferencesResponse(response: GetGeneratedOutputDifferencesResponse, includeFacets: boolean): void {
  diffDetailRows.value = (response.differences ?? []).map(buildPageRow)
  diffPageIndex.value = response.pageIndex ?? 0
  diffPageCount.value = response.pageCount ?? 1
  diffFilteredCount.value = response.totalFiltered ?? 0
  diffTotalCount.value = response.totalDifferences ?? 0
  if (includeFacets) {
    serverBucketCounts.value = normalizeServerBucketCounts(response.bucketCounts)
    serverRuleOptions.value = (response.ruleOptions ?? []).map(normalizeServerRuleOption)
  }
}

function buildGeneratedOutputFromSummary(
  fileName: string,
  metadata: GeneratedOutputDifferencesMetadata,
  summary: GeneratedOutputDifferencesSummary,
): GeneratedOutput {
  const file1LabelValue = normalizeDiffLabel(metadata.file1Label) || normalizeDiffLabel(file1SystemLabel.value) || 'File 1'
  const file2LabelValue = normalizeDiffLabel(metadata.file2Label) || normalizeDiffLabel(file2SystemLabel.value) || 'File 2'

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

const DIFF_SEARCH_DEBOUNCE_MS = 300
const pageAbortController = new AbortController()
let loadSavedResultController: AbortController | null = null
let differencesController: AbortController | null = null
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadSavedResultController?.abort()
  differencesController?.abort()
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})

function currentDifferencesQuery(pageIndex: number, includeFacets: boolean) {
  return {
    fileName: outputFileName.value,
    pageIndex,
    pageSize: DIFF_DETAILS_PAGE_SIZE,
    buckets: activeDiffBuckets.value.join(','),
    ruleFilterKey: selectedRuleFilterKey.value,
    search: diffDetailsSearch.value.trim(),
    includeFacets,
  }
}

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

// Fetch a single diff page for the active filters. Facets (whole-document bucket counts + rule
// options) are constant for a file, so they are requested only on the initial load.
async function loadDifferencesPage(pageIndex: number, includeFacets: boolean): Promise<void> {
  const requestedFileName = outputFileName.value
  if (!requestedFileName) return

  differencesController?.abort()

  // No active bucket selected: show an empty page (matches the "select a diff bucket" prompt) rather
  // than fetching — an empty buckets filter would otherwise be treated as "all" by the server.
  if (activeDiffBuckets.value.length === 0) {
    diffDetailRows.value = []
    diffFilteredCount.value = 0
    diffPageIndex.value = 0
    diffPageCount.value = 1
    differencesLoading.value = false
    return
  }

  differencesController = new AbortController()
  const signal = differencesController.signal

  differencesLoading.value = true
  try {
    const response = await reconciliationFacade.getGeneratedOutputDifferences(
      currentDifferencesQuery(pageIndex, includeFacets),
      signal,
    )
    if (outputFileName.value !== requestedFileName) return
    applyDifferencesResponse(response, includeFacets)
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    if (outputFileName.value !== requestedFileName) return
    loadError.value = error instanceof ApiCallError ? error.message : 'Unable to load differences.'
  } finally {
    if (outputFileName.value === requestedFileName) differencesLoading.value = false
  }
}

async function goToDiffDetailsPage(pageIndex: number): Promise<void> {
  const target = Math.min(Math.max(pageIndex, 0), Math.max(diffPageCount.value - 1, 0))
  if (target === diffPageIndex.value || differencesLoading.value) return
  await loadDifferencesPage(target, false)
}

function clearDiffDetailsSearch(): void {
  diffDetailsSearch.value = ''
}

function toggleDiffBucket(bucket: DiffBucketKey): void {
  const isActive = activeDiffBuckets.value.includes(bucket)
  selectedDiffBuckets.value = isActive
    ? normalizeDiffBucketSelection(activeDiffBuckets.value.filter((activeBucket) => activeBucket !== bucket))
    : normalizeDiffBucketSelection([...activeDiffBuckets.value, bucket])
}

function toggleRuleSelectorCollapsed(): void {
  ruleSelectorCollapsed.value = !ruleSelectorCollapsed.value
}

function selectRuleFilter(nextRuleFilterKey: string): void {
  selectedRuleFilterKey.value = nextRuleFilterKey

  if (nextRuleFilterKey === ALL_RULE_FILTER_KEY) {
    selectedDiffBuckets.value = [...DIFF_BUCKET_ORDER]
  } else {
    const selectedOption = ruleSelectorOptions.value.find((option) => option.key === nextRuleFilterKey)
    if (selectedOption) {
      selectedDiffBuckets.value = normalizeDiffBucketSelection(selectedOption.bucketKeys)
    }
  }
}

async function downloadRunSourceFile(sourceFile: RunSourceFileView): Promise<void> {
  if (!sourceFile.filePath || downloadingSourceFilePath.value) return

  downloadingSourceFilePath.value = sourceFile.filePath
  sourceDownloadError.value = null

  try {
    const response = await reconciliationFacade.getGeneratedOutput({
      fileName: sourceFile.filePath,
      format: sourceFile.sourceFormat || 'json',
    })
    const outputFile = response.outputFile
    if (!outputFile?.contentText) throw new Error('Unable to download source file.')

    downloadTextFile(
      outputFile.downloadFileName || sourceFile.downloadFileName || sourceFile.fileName,
      outputFile.contentText,
      outputFile.contentType || (sourceFile.sourceFormat === 'csv' ? 'text/csv; charset=UTF-8' : 'application/json; charset=UTF-8'),
    )
  } catch (error) {
    sourceDownloadError.value = error instanceof ApiCallError ? error.message : 'Unable to download source file.'
  } finally {
    downloadingSourceFilePath.value = ''
  }
}

async function downloadSavedResult(): Promise<void> {
  if (!downloadableOutputFile.value || downloadingSavedResult.value) return

  downloadingSavedResult.value = true
  resultDownloadError.value = null

  try {
    const response = await reconciliationFacade.getGeneratedOutput({
      fileName: outputFileName.value,
      format: 'json',
    })
    const outputFile = response.outputFile
    if (!outputFile?.contentText) throw new Error('Unable to download saved result.')

    downloadTextFile(
      outputFile.downloadFileName || downloadableOutputFile.value.downloadFileName || outputFileName.value || 'saved-result.json',
      outputFile.contentText,
      outputFile.contentType || downloadableOutputFile.value.contentType || 'application/json',
    )
  } catch (error) {
    resultDownloadError.value = error instanceof ApiCallError ? error.message : 'Unable to download saved result.'
  } finally {
    downloadingSavedResult.value = false
  }
}

// Bucket / rule selection re-fetches page 0 from the server (facets are already loaded and constant).
watch([selectedDiffBuckets, selectedRuleFilterKey], () => {
  if (!diffControlsReady.value) return
  void loadDifferencesPage(0, false)
}, { deep: true })

// Record-id search re-fetches page 0, debounced so typing does not issue a request per keystroke.
watch(diffDetailsSearch, () => {
  if (!diffControlsReady.value) return
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    void loadDifferencesPage(0, false)
  }, DIFF_SEARCH_DEBOUNCE_MS)
})

watch(ruleSelectorOptions, (options) => {
  if (selectedRuleFilterKey.value === ALL_RULE_FILTER_KEY) return
  if (options.some((option) => option.key === selectedRuleFilterKey.value)) return

  selectedRuleFilterKey.value = ALL_RULE_FILTER_KEY
})

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
