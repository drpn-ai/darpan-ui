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

        <section v-else-if="savedOutput || liveRunResultId" class="reconciliation-diff-details">
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
              v-if="showNotifyMe"
              type="button"
              class="run-result-notify-me"
              :class="{ 'run-result-notify-me--active': notifySubscribed }"
              data-testid="run-result-notify-me"
              :disabled="notifyBusy"
              @click="toggleNotifyMe"
            >
              {{ notifySubscribed ? `Notifying — ${runStatus?.mySubscriptionSpaceName ?? 'chat space'}` : 'Notify me' }}
            </button>
            <InlineValidation v-if="notifyError" tone="error" :message="notifyError" />
            <button
              type="button"
              class="run-result-step-timeline__toggle"
              data-testid="run-result-step-timeline-toggle"
              :aria-label="stepTimelineCollapsed ? 'Expand run steps' : 'Collapse run steps'"
              :aria-expanded="stepTimelineCollapsed ? 'false' : 'true'"
              @click="stepTimelineCollapsed = !stepTimelineCollapsed"
            >
              <span class="run-result-step-timeline__label micro-label">Run steps</span>
              <span v-if="displayedRunSteps.length > 0" class="run-result-step-timeline__count">{{ displayedRunSteps.length }}</span>
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
              v-if="!stepTimelineCollapsed && displayedRunSteps.length === 0"
              class="section-note"
              data-testid="run-result-step-timeline-empty"
            >
              No step detail (legacy run).
            </p>
            <ol v-else-if="!stepTimelineCollapsed" class="run-result-step-timeline__list">
              <li
                v-for="step in displayedRunSteps"
                :key="`${step.stageSequence ?? 0}-${step.stageCode ?? ''}`"
                class="run-result-step action-row"
              >
                <StatusBadge :label="stepStatusLabel(step)" :tone="stepStatusTone(step)" />
                <span class="run-result-step__stage">{{ stepStageLabel(step) }}</span>
                <span v-if="stepDurationLabel(step)" class="run-result-step__meta">{{ stepDurationLabel(step) }}</span>
                <span v-if="stepRecordsLabel(step)" class="run-result-step__meta">{{ stepRecordsLabel(step) }}</span>
                <span v-if="step.errorMessage" class="run-result-step__error">{{ step.errorMessage }}</span>
              </li>
            </ol>
          </section>

          <InlineValidation
            v-if="liveRunFailed"
            tone="error"
            class="run-result-failure"
            data-testid="run-result-live-failed"
            :message="liveRunFailureText"
          />
          <p
            v-else-if="!savedOutput && liveRunNote"
            class="section-note"
            data-testid="run-result-live-note"
          >
            {{ liveRunNote }}
          </p>

          <div v-if="showCancelRun" class="run-result-cancel">
            <InlineValidation v-if="cancelError" tone="error" :message="cancelError" />
            <button
              v-if="!cancelConfirming"
              type="button"
              class="run-result-cancel__button"
              data-testid="run-result-cancel"
              :disabled="cancelBusy || cancelRequested"
              @click="cancelConfirming = true"
            >
              {{ cancelRequested ? 'Stopping run…' : 'Cancel run' }}
            </button>
            <div v-else class="run-result-cancel__confirm action-row" data-testid="run-result-cancel-confirm">
              <span class="section-note">Stop this run? Any work completed so far is discarded.</span>
              <button
                type="button"
                class="run-result-cancel__button run-result-cancel__button--danger"
                data-testid="run-result-cancel-confirm-yes"
                :disabled="cancelBusy"
                @click="void cancelRun()"
              >
                Stop run
              </button>
              <button
                type="button"
                class="run-result-cancel__button"
                data-testid="run-result-cancel-confirm-no"
                :disabled="cancelBusy"
                @click="cancelConfirming = false"
              >
                Keep running
              </button>
            </div>
          </div>

          <div v-if="savedOutput" class="reconciliation-diff-details__bucket-grid">
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
            v-if="savedOutput && diffDetailRows.length > 0"
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
          <p v-else-if="savedOutput" data-testid="diff-details-empty" class="section-note">
            {{ diffDetailsEmptyMessage }}
          </p>
        </section>
      </StaticPageSection>

      <template v-if="savedOutput || liveRunResultId" #actions>
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

    <div
      v-if="notifyPickerOpen"
      class="popup-workflow-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notify-space-workflow-title"
      @click.self="closeNotifyPicker"
    >
      <section class="popup-workflow-modal workflow-panel">
        <header class="workflow-panel-header">
          <h2 id="notify-space-workflow-title">Notify me</h2>
        </header>

        <div class="workflow-step-wrapper">
          <WorkflowStepForm
            class="workflow-form--popup-compact"
            question="Which chat space should get notifications for this run?"
            :show-primary-action="false"
            show-cancel-action
            cancel-label="Cancel"
            cancel-test-id="run-result-notify-picker-cancel"
            @cancel="closeNotifyPicker"
          >
            <InlineValidation v-if="notifyError" tone="error" :message="notifyError" />
            <p v-if="notifyPickerLoading" class="section-note">Loading chat spaces...</p>
            <p
              v-else-if="notifyPickerSpaces.length === 0"
              class="section-note"
              data-testid="run-result-notify-picker-empty"
            >
              No chat spaces yet — add one in Tenant Settings.
            </p>
            <WorkflowShortcutChoiceCards
              v-else
              :options="notifyPickerOptions"
              test-id-prefix="notify-space-choice"
              @choose="pickDefaultAndSubscribe"
            />
          </WorkflowStepForm>
        </div>
      </section>
    </div>
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
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade, settingsFacade } from '../../lib/api/facade'
import type {
  GeneratedOutput,
  GeneratedOutputDifferencesMetadata,
  GeneratedOutputDifferencesSummary,
  ReconciliationRunStep,
  TenantChatSpace,
} from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { isActiveRunStatus, useRunResultsStore } from '../../stores/runResults'
import { RUN_STAGE_SEQUENCE, formatRunStepDuration, normalizeDisplayText, reconciliationStageLabel } from '../../lib/reconciliationDisplay'
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
  buildReconciliationRunResultRoute,
  type ReconciliationRunRouteContext,
} from '../../lib/reconciliationRoutes'
import { buildRuleSetDraft, buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../lib/savedRunEditorRoute'
import { listIconPath, playIconPath, playIconTransform } from '../../lib/iconPaths'
import { formatSavedResultDateTime } from '../../lib/utils/date'
import { darpanSystemNamePair } from '../../lib/utils/darpanSystems'
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
// Live mode (reconciliation-run-live route): the run is still executing, so there is no output
// file to load — the page renders off the run-status poll instead, then swaps itself to the
// canonical run-result route once the run succeeds and names its result file.
const liveRunResultId = computed(() =>
  typeof route.params.runResultId === 'string' ? route.params.runResultId.trim() : '',
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
const heroDescription = computed(() => {
  if (liveRunResultId.value) {
    const startedDate = runStatus.value?.startedDate
    return startedDate ? formatSavedResultDateTime(startedDate) : 'Run in progress.'
  }
  return savedOutput.value?.createdDate ? formatSavedResultDateTime(savedOutput.value.createdDate) : 'Review the saved reconciliation output for this run.'
})
const diffDetailsFile1Label = computed(
  () => diffDetailsMeta.value.file1Label || savedOutput.value?.file1Label || file1SystemLabel.value || 'File 1',
)
const diffDetailsFile2Label = computed(
  () => diffDetailsMeta.value.file2Label || savedOutput.value?.file2Label || file2SystemLabel.value || 'File 2',
)
// Difference counts are per SYSTEM, so the bucket cards name the system rather than the endpoint
// the run extracted ("Shopify Order Return References"). The stage timeline and the compared-files
// section keep the full labels above: there the endpoint IS the subject.
const diffDetailsSystemNames = computed(() => darpanSystemNamePair(diffDetailsFile1Label.value, diffDetailsFile2Label.value))
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

// Step timeline (recon observability Phase 4). In live mode the run id comes straight from
// the route; on the saved-result route the differences payload does not carry the run-result
// id, so it is resolved from the run-results cache descriptor for this file. The store poll
// self-terminates once the run status is terminal.
const runResultsStore = useRunResultsStore()
const polledTimelineRunIds = new Set<string>()
const timelineRunResultId = computed(() =>
  liveRunResultId.value ||
  normalizeDisplayText(runResultsStore.getByFileName(outputFileName.value)?.reconciliationRunResultId),
)
const runStatus = computed(() =>
  timelineRunResultId.value ? runResultsStore.getRunStatus(timelineRunResultId.value) : null,
)
const runStatusSteps = computed<ReconciliationRunStep[]>(() => runStatus.value?.steps ?? [])
const showStepTimeline = computed(() => runStatus.value?.ok === true)
// Collapsed by default on the saved-result view (a forensic detail there); expanded when the
// page opens on a live run, where step progress IS the primary content.
const stepTimelineCollapsed = ref(!liveRunResultId.value)

const liveRunStatusEnumId = computed(() => normalizeDisplayText(runStatus.value?.statusEnumId))
const liveRunFailed = computed(() => Boolean(liveRunResultId.value) && liveRunStatusEnumId.value === 'AUT_STAT_FAILED')
// Active until the first poll response proves otherwise — synthesized pending steps only make
// sense while the run can still reach them.
const liveRunActive = computed(() =>
  Boolean(liveRunResultId.value) && (runStatus.value == null || isActiveRunStatus(liveRunStatusEnumId.value)))

// Clock for the running step's elapsed time. A paged API extract is the longest stage of a run
// and reports no record count until it ends, so without this the whole timeline sits visually
// frozen for minutes even though the status poll is landing responses on schedule. Ticks only
// while the run is live, and the poll interval is unrelated — this is purely a display clock.
const liveNowMs = ref(Date.now())
let liveClockTimer: ReturnType<typeof setInterval> | null = null

function stopLiveClock(): void {
  if (liveClockTimer == null) return
  clearInterval(liveClockTimer)
  liveClockTimer = null
}

watch(liveRunActive, (active) => {
  if (!active) {
    stopLiveClock()
    return
  }
  if (liveClockTimer != null) return
  liveNowMs.value = Date.now()
  liveClockTimer = setInterval(() => {
    liveNowMs.value = Date.now()
  }, 1000)
}, { immediate: true })

const liveRunNote = computed(() => {
  if (!liveRunResultId.value || liveRunFailed.value) return ''
  if (liveRunStatusEnumId.value === 'AUT_STAT_CANCELLED') return 'Run cancelled.'
  if (liveRunStatusEnumId.value === 'AUT_STAT_NO_DATA') return 'Run finished with no data to compare.'
  if (liveRunStatusEnumId.value === 'AUT_STAT_SKIP_DUP') return 'Run skipped — this window was already processed.'
  if (!liveRunActive.value) return 'Run finished. Open run history to view the saved result.'
  if (cancelRequested.value) return 'Stopping this run — it ends at the next step boundary.'
  return 'Results will appear here when this reconciliation finishes.'
})

// Cancelling is cooperative on the backend: the request is recorded and the run ends itself at
// its next checkpoint, so the button reports "Stopping" until the poll shows a terminal status
// rather than pretending the run stopped the instant the call returned.
const cancelBusy = ref(false)
const cancelConfirming = ref(false)
const cancelError = ref<string | null>(null)
const cancelRequested = computed(() => Boolean(runStatus.value?.cancelRequestedDate))
const showCancelRun = computed(() =>
  Boolean(liveRunResultId.value) && canRunActiveTenantReconciliation.value && liveRunActive.value)

async function cancelRun(): Promise<void> {
  const runId = liveRunResultId.value
  if (!runId || cancelBusy.value) return

  cancelBusy.value = true
  cancelError.value = null
  try {
    await reconciliationFacade.cancelReconciliationRun({ reconciliationRunResultId: runId })
    cancelConfirming.value = false
    await runResultsStore.refreshRunStatus(runId)
  } catch (error) {
    cancelError.value = error instanceof ApiCallError ? error.message : 'Unable to cancel this run.'
  } finally {
    cancelBusy.value = false
  }
}

// `errorMessage` is capped at 255 chars server-side to fit a text-medium column, which cuts real
// Spark/service errors off mid-sentence — routinely losing the half that names the fix (the
// "Did you mean [...]" suggestion sat just past the cut). The run row already stores the full text
// in `errorDetail`, so prefer it and keep the truncated copy only as a fallback for older rows.
const liveRunFailureText = computed(() => (
  normalizeDisplayText(runStatus.value?.errorDetail)
  || normalizeDisplayText(runStatus.value?.errorMessage)
  || 'Run failed before any results were produced.'
))

// Timeline rows for display: the actual step rows, plus — while the run is live — a synthesized
// "Pending" row for each canonical stage the run has not reached yet, so the operator sees
// completed / running / remaining in one list. Conditional stages that never start simply drop
// out once a later real stage begins (they only render while their sequence is ahead of the
// furthest real row).
const displayedRunSteps = computed<ReconciliationRunStep[]>(() => {
  const actualSteps = runStatusSteps.value
  if (!liveRunActive.value) return actualSteps
  const maxSeenSequence = actualSteps.reduce((max, step) => Math.max(max, step.stageSequence ?? 0), 0)
  const seenStageCodes = new Set(actualSteps.map((step) => normalizeDisplayText(step.stageCode)))
  const pendingRemainder = RUN_STAGE_SEQUENCE
    .map((stageCode, index) => ({ stageCode, stageSequence: index + 1, statusEnumId: 'AUT_STAT_PENDING' }))
    .filter((step) => step.stageSequence > maxSeenSequence && !seenStageCodes.has(step.stageCode))
  return [...actualSteps, ...pendingRemainder]
})

// Files populate as extract stages land them on the run row; the poll carries the same
// sourceDetails shape the saved-result payload uses, so the existing section renders both.
watch(runStatus, (status) => {
  if (!liveRunResultId.value) return
  runSourceDetails.value = status?.sourceDetails ?? null
})

// Live→terminal handoff: a successful run names its result file, so the page swaps itself to
// the canonical saved-result route and loads the differences. Failure and no-data terminals
// stay on the live view, which renders their message and the failing step.
watch([liveRunStatusEnumId, liveRunResultId], ([statusEnumId]) => {
  if (!liveRunResultId.value || runStatus.value?.ok !== true) return
  if (statusEnumId !== 'AUT_STAT_SUCCESS') return
  const resultFileName = normalizeDisplayText(runStatus.value?.resultFileName)
  if (!resultFileName) return
  void router.replace(buildReconciliationRunResultRoute(reconciliationRunRouteContext.value, resultFileName))
}, { immediate: true })

// Notify-me (Task 12): subscribe/unsubscribe the current user to chat notifications
// for this run. Only offered while the run is still active (PENDING/RUNNING) — a terminal
// run has already notified or never will. Mirrors the run-settings action's busy/error
// conventions (boolean busy flag + dedicated error ref surfaced via InlineValidation), not
// the page-load AbortController pattern used for the initial saved-result fetch.
const notifyBusy = ref(false)
const notifyError = ref<string | null>(null)
const notifySubscribed = computed(() => runStatus.value?.mySubscription === true)
const showNotifyMe = computed(() =>
  Boolean(timelineRunResultId.value) && isActiveRunStatus(runStatus.value?.statusEnumId))

const notifyPickerOpen = ref(false)
const notifyPickerLoading = ref(false)
const notifyPickerBusy = ref(false)
const notifyPickerSpaces = ref<TenantChatSpace[]>([])
const notifyPickerOptions = computed<WorkflowShortcutChoiceOption[]>(() =>
  notifyPickerSpaces.value.map((space, index) => ({
    value: space.chatSpaceId,
    label: space.spaceName,
    shortcutKey: String.fromCharCode(65 + index),
  })),
)

// callService (client.ts) throws ApiCallError for ANY envelope with ok:false, before this
// code ever sees the response -- so a resolved response here is always ok:true, and the
// backend's needsDefaultChatSpace signal (sent alongside ok:false) can only be read off the
// thrown error's details.result. Mirrors the existing per-callsite `error.details` cast
// pattern (see useReconciliationDiff.ts readFailedRunFeedback, stores/auth.ts formatApiError).
function readNeedsDefaultChatSpace(error: unknown): boolean {
  if (!(error instanceof ApiCallError)) return false
  const details = (error.details ?? {}) as { result?: { needsDefaultChatSpace?: unknown } }
  return details.result?.needsDefaultChatSpace === true
}

// The actual subscribe/unsubscribe call, shared by the button handler and the
// picker's "retry after saving a default" step. No busy guard here — callers own it.
async function performNotifyToggle(runId: string): Promise<void> {
  if (notifySubscribed.value) {
    await reconciliationFacade.unsubscribeRunNotification({ reconciliationRunResultId: runId })
  } else {
    try {
      await reconciliationFacade.subscribeRunNotification({ reconciliationRunResultId: runId })
    } catch (error) {
      if (readNeedsDefaultChatSpace(error)) {
        await openNotifyPicker()
        return
      }
      throw error
    }
  }
  await runResultsStore.refreshRunStatus(runId)
}

async function toggleNotifyMe(): Promise<void> {
  const runId = timelineRunResultId.value
  if (!runId || notifyBusy.value) return

  notifyBusy.value = true
  notifyError.value = null
  try {
    await performNotifyToggle(runId)
  } catch (error) {
    notifyError.value = error instanceof ApiCallError ? error.message : 'Unable to update notification subscription.'
  } finally {
    notifyBusy.value = false
  }
}

async function openNotifyPicker(): Promise<void> {
  notifyPickerOpen.value = true
  notifyPickerSpaces.value = []
  notifyPickerLoading.value = true
  try {
    const response = await settingsFacade.listTenantChatSpaces()
    notifyPickerSpaces.value = (response.chatSpaces ?? []).filter((space) => space.isActive !== 'N')
  } catch (error) {
    notifyPickerOpen.value = false
    notifyError.value = error instanceof ApiCallError ? error.message : 'Unable to load chat spaces.'
  } finally {
    notifyPickerLoading.value = false
  }
}

function closeNotifyPicker(): void {
  notifyPickerOpen.value = false
  notifyPickerSpaces.value = []
}

async function pickDefaultAndSubscribe(chatSpaceId: string): Promise<void> {
  const runId = timelineRunResultId.value
  if (!runId || notifyPickerBusy.value) return

  notifyPickerBusy.value = true
  notifyError.value = null
  try {
    await settingsFacade.saveUserNotificationDefault({ chatSpaceId })
    closeNotifyPicker()
    await performNotifyToggle(runId)
  } catch (error) {
    notifyError.value = error instanceof ApiCallError ? error.message : 'Unable to save notification default.'
  } finally {
    notifyPickerBusy.value = false
  }
}

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
  AUT_STAT_CANCELLED: 'Cancelled',
}

function stepStatusLabel(step: ReconciliationRunStep): string {
  const statusEnumId = normalizeDisplayText(step.statusEnumId)
  return STEP_STATUS_LABELS[statusEnumId] ?? (statusEnumId || 'Unknown')
}

function stepStatusTone(step: ReconciliationRunStep): 'neutral' | 'success' | 'warning' | 'danger' {
  const statusEnumId = normalizeDisplayText(step.statusEnumId)
  if (statusEnumId === 'AUT_STAT_SUCCESS') return 'success'
  if (statusEnumId === 'AUT_STAT_FAILED') return 'danger'
  if (statusEnumId === 'AUT_STAT_RUNNING' || statusEnumId === 'AUT_STAT_CANCELLED') return 'warning'
  return 'neutral'
}

function stepStageLabel(step: ReconciliationRunStep): string {
  // metricsJson carries which systems a VERIFY step rechecked -- without it, a run with two
  // verification passes renders two rows reading exactly the same thing.
  return reconciliationStageLabel(step.stageCode, diffDetailsFile1Label.value, diffDetailsFile2Label.value, step.metricsJson)
}

function stepDurationLabel(step: ReconciliationRunStep): string {
  // A running step has no completedDate to measure against, so it is timed against the live
  // clock and advances every second until the stage lands its real completion timestamp.
  if (step.completedDate == null && normalizeDisplayText(step.statusEnumId) === 'AUT_STAT_RUNNING') {
    return formatRunStepDuration(step.startedDate, liveNowMs.value)
  }
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
      label: `Missing from ${diffDetailsSystemNames.value.file1}`,
      count:
        diffDetailsSummary.value.onlyInFile2Count ??
        diffDetailBucketCounts.value['file-1'],
      testId: 'diff-bucket-file-1',
    },
    {
      key: 'file-2',
      bucketKey: 'file-2',
      label: `Missing from ${diffDetailsSystemNames.value.file2}`,
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
  stopLiveClock()
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
  // Live mode has no output file yet — the run-status poll drives the page until the
  // completion swap lands this component on the saved-result route. There is no saved output
  // to carry the persisted run name either, so seed the title from the route: the submitting
  // page put the run name there, and without this the hero shows its generic placeholder for
  // the whole run.
  if (liveRunResultId.value && !outputFileName.value) {
    resetRunNameState()
    return
  }
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
  gap: var(--space-1);
  transform: translateY(-50%);
}

.run-result-rule-selector--collapsed {
  gap: 0;
}

.run-result-rule-selector__panel {
  display: grid;
  gap: var(--space-1);
  width: min(13.5rem, calc(100vw - 4rem));
  padding: var(--space-1);
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
  gap: var(--space-1);
}

.run-result-rule-selector__option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  /* Contains a value below --space-00 (0.2rem). Under 2.5px these are optical nudges rather than spacing, and the scale deliberately stops above them. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  gap: 0.15rem 0.5rem;
  align-items: center;
  min-height: 3.35rem;
  padding: var(--space-1-5);
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
  font-size: var(--type-summary-label-size);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.run-result-rule-selector__option-count {
  grid-column: 2;
  grid-row: 1;
  font-size: var(--type-meta-size);
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
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 92%, white);
}

.run-result-cancel {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
}


.run-result-cancel__button {
  min-height: 2.15rem;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--type-meta-size);
  font-weight: 400;
}

.run-result-cancel__button:hover:not(:disabled) {
  border-color: color-mix(in oklab, var(--accent) 42%, var(--border));
  background: var(--surface-2);
  color: var(--text);
}

.run-result-cancel__button--danger {
  color: var(--danger, #b3261e);
}

.run-result-cancel__button--danger:hover:not(:disabled) {
  border-color: color-mix(in oklab, var(--danger, #b3261e) 48%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 88%, var(--danger, #b3261e));
  color: var(--danger, #b3261e);
}

.run-result-cancel__button:disabled {
  opacity: 0.6;
  cursor: default;
}

.run-result-step-timeline {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 92%, white);
}

.run-result-notify-me {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 1.9rem;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--type-label-size);
  font-weight: 400;
}

.run-result-notify-me:hover {
  border-color: color-mix(in oklab, var(--accent) 42%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 84%, var(--accent));
  color: var(--text);
}

.run-result-notify-me--active {
  border-color: color-mix(in oklab, var(--accent) 58%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 80%, var(--accent));
  color: var(--text);
}

.run-result-notify-me:disabled {
  opacity: 0.6;
  cursor: default;
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

/* Type comes from .micro-label in style.css — see the template. */

.run-result-step-timeline__count {
  font-size: var(--type-summary-label-size);
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


.run-result-step__stage {
  font-weight: 400;
}

.run-result-step__meta {
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

/* errorDetail is stored up to 12000 chars, so a stack-trace-shaped failure would otherwise push
   the whole page down. Scroll it in place and keep the server's own line breaks. */
.run-result-failure {
  max-height: 12rem;
  overflow-y: auto;
  white-space: pre-wrap;
}

.run-result-step__error {
  flex-basis: 100%;
  color: var(--danger, #b3261e);
  font-size: var(--type-muted-size);
}

.run-result-source-details__summary {
  display: grid;
  /* Contains a value below --space-00 (0.2rem). Under 2.5px these are optical nudges rather than spacing, and the scale deliberately stops above them. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  gap: 0.15rem;
  min-width: min(100%, 11rem);
}

.run-result-source-details__eyebrow,
.run-result-source-details__files-label,
.run-result-source-file__label {
  color: var(--text-muted);
  font-size: var(--type-summary-label-size);
  line-height: 1.3;
}

.run-result-source-details__summary strong {
  font-size: var(--type-action-size);
  line-height: 1.35;
  font-weight: 400;
}

.run-result-source-details__files {
  display: flex;
  flex: 1 1 22rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1-5);
}

.run-result-source-file {
  display: inline-grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-1);
  max-width: min(100%, 25rem);
  min-height: 2.15rem;
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-1-5);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.run-result-source-file__name {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: var(--type-meta-size);
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
  gap: var(--space-1);
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
  /* A display figure, sized for prominence rather than to a body role. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
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
  /* Contains a large layout value with no step near it; the scale jumps 2.3rem -> 3.2rem here. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
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
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  /* Sizes an icon glyph, not text. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
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
  overflow-wrap: break-word;
  font-size: var(--type-label-size);
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
}
</style>
