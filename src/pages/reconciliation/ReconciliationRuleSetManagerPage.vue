<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': isPopupOpen }">
    <template #hero>
      <StaticRecordTitle
        v-if="draft"
        v-model="editableRunName"
        aria-label="Run name"
        test-id="ruleset-manager-run-name"
        explain="runName"
        fallback="Run"
        :editable="canRenameRun"
        @commit="void commitRunName($event)"
      />
      <h1 v-else>Run</h1>
    </template>

    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="ruleset-manager-error" />

    <!-- DAR-UI-128. The settings-page header (DAR-UI-126): a fact per system (its connection opens today's auth popup),
         how the two sides pair (an editor's way into run setup), and what the run checks. -->
    <StaticFactStrip v-if="draft" :facts="facts" test-id="ruleset-manager-facts" @open="openFact" />

    <!-- Filters come first: they are applied as each source is read, before any rule compares a row. -->
    <StaticPageSection v-if="draft" data-testid="ruleset-manager-filters">
      <template #header>
        <div class="ruleset-manager-section-header section-header-row">
          <h2 class="static-page-section-heading">Filters</h2>
          <button
            v-if="canEditTenantSettings"
            type="button"
            class="app-icon-action ruleset-manager-section-edit"
            data-testid="ruleset-manager-edit-filters"
            aria-label="Edit filters"
            @click="openRuleEditWorkflow"
          >
            <AppIcon name="edit" />
          </button>
        </div>
      </template>

      <ul class="ruleset-manager-rows static-row-list" data-testid="ruleset-manager-filter-list">
        <li
          v-for="row in filterRows"
          :key="row.key"
          class="ruleset-manager-row ruleset-manager-row--filter"
          data-testid="ruleset-manager-filter-row"
        >
          <span class="ruleset-manager-row__dim">{{ row.system }}</span>
          <span class="ruleset-manager-field">
            <span class="ruleset-manager-field__name">{{ row.name }}</span>
            <span v-if="row.path !== row.name" class="ruleset-manager-field__path">{{ row.path }}</span>
          </span>
          <span class="ruleset-manager-row__dim">{{ row.how }}</span>
          <span class="ruleset-manager-row__values">{{ row.values }}</span>
        </li>
        <li v-if="!filterRows.length" class="ruleset-manager-row ruleset-manager-row--note" data-testid="ruleset-manager-filter-none">
          No filters. Every row is compared.
        </li>
      </ul>
    </StaticPageSection>

    <!-- DAR-UI-148. What each side reads beyond its records (its connector's declared options), switched in place. Only
         sides whose connector declares any; a switch saves the run at once, nothing else about it changes. -->
    <StaticPageSection v-if="draft && readOptionRows.length" data-testid="ruleset-manager-read-options">
      <template #header>
        <div class="ruleset-manager-section-header section-header-row">
          <h2 class="static-page-section-heading">Read options</h2>
        </div>
      </template>
      <InlineValidation v-if="readOptionError" tone="error" :message="readOptionError" data-testid="ruleset-manager-read-option-error" />
      <ul class="ruleset-manager-rows static-row-list" data-testid="ruleset-manager-read-option-list">
        <li
          v-for="row in readOptionRows"
          :key="row.key"
          class="ruleset-manager-row ruleset-manager-row--option"
          data-testid="ruleset-manager-read-option-row"
        >
          <span class="ruleset-manager-row__dim">{{ row.system }}</span>
          <span>{{ row.label }}</span>
          <AppToggleSwitch
            :model-value="row.on"
            :label="`${row.label}, ${row.system}`"
            :disabled="!canEditTenantSettings"
            :test-id="`ruleset-manager-read-option-${row.side}-${row.name}`"
            @update:model-value="(on: boolean) => setReadOption(row, on)"
          />
        </li>
      </ul>
    </StaticPageSection>

    <StaticPageSection data-testid="ruleset-manager-rules">
      <template #header>
        <div class="ruleset-manager-section-header section-header-row">
          <h2 class="static-page-section-heading">Rules</h2>
          <button
            v-if="draft && canEditTenantSettings"
            type="button"
            class="app-icon-action ruleset-manager-section-edit"
            data-testid="ruleset-manager-edit-rules"
            aria-label="Edit rules"
            @click="openRuleEditWorkflow"
          >
            <AppIcon name="edit" />
          </button>
        </div>
      </template>

      <template v-if="draft">
        <div v-if="visibleRules.length" class="ruleset-manager-rule-table">
          <div class="ruleset-manager-rule-head" data-testid="ruleset-manager-rule-head">
            <span>#</span>
            <span>{{ file1Title }}</span>
            <span class="ruleset-manager-rule-head__test">Test</span>
            <span>{{ file2Title }}</span>
            <span>Pre-actions</span>
          </div>
          <ol class="ruleset-manager-rows static-row-list" data-testid="ruleset-manager-rule-list">
            <li
              v-for="rule in visibleRules"
              :key="rule.ruleId || `${rule.sequenceNum}-${rule.file1FieldPath}-${rule.file2FieldPath}`"
              class="ruleset-manager-row ruleset-manager-row--rule"
              data-testid="ruleset-manager-rule-row"
            >
              <span class="ruleset-manager-rule-sequence">{{ rule.sequenceNum }}</span>
              <span class="ruleset-manager-field">
                <span class="ruleset-manager-field__name">{{ formatFieldKey(rule.file1FieldPath) }}</span>
                <span v-if="showsPath(rule.file1FieldPath)" class="ruleset-manager-field__path">{{ rule.file1FieldPath }}</span>
              </span>
              <span class="ruleset-manager-operator-pill">{{ rule.operator?.trim() || '=' }}</span>
              <span class="ruleset-manager-field">
                <span class="ruleset-manager-field__name">{{ formatFieldKey(rule.file2FieldPath) }}</span>
                <span v-if="showsPath(rule.file2FieldPath)" class="ruleset-manager-field__path">{{ rule.file2FieldPath }}</span>
              </span>
              <span class="ruleset-manager-rule-pre">
                <span>{{ preActionWords(rule) }}</span>
                <span v-if="rule.ruleName?.trim()" class="ruleset-manager-rule-name" data-testid="ruleset-manager-rule-name">{{ rule.ruleName.trim() }}</span>
              </span>
            </li>
          </ol>
        </div>
        <ul v-else class="ruleset-manager-rows static-row-list">
          <li class="ruleset-manager-row ruleset-manager-row--note ruleset-manager-preview-line" data-testid="ruleset-manager-rule-none">
            {{ comparisonPreview }}
          </li>
        </ul>
      </template>

      <template v-else>
        <EmptyState
          title="No run basics defined yet"
        />

        <RouterLink
          v-if="canEditTenantSettings"
          class="static-page-action-tile static-page-action-tile--inline"
          :to="{ name: 'reconciliation-create' }"
        >
          Go to Run Setup
        </RouterLink>
      </template>
    </StaticPageSection>

    <!-- DAR-UI-064 (S3), DAR-UI-128, DAR-UI-135: what each row of this run is concluded to be, read only, flat in the
         order they are tried. -->
    <StaticPageSection v-if="showConclusions" data-testid="ruleset-manager-conclusions">
      <template #header>
        <div class="ruleset-manager-section-header section-header-row">
          <div class="ruleset-manager-section-title">
            <h2 class="static-page-section-heading">Conclusions</h2>
            <p class="ruleset-manager-section-note" data-testid="ruleset-manager-conclusions-note">First match wins.</p>
          </div>
          <button
            v-if="canEditTenantSettings"
            type="button"
            class="app-icon-action ruleset-manager-section-edit"
            data-testid="ruleset-manager-edit-conclusions"
            :aria-label="conclusions.list.value.length ? 'Edit conclusions' : 'Set up conclusions'"
            @click="openConclusionEditWorkflow"
          >
            <AppIcon name="edit" />
          </button>
        </div>
      </template>
      <RunConclusionRows />
    </StaticPageSection>

    <template #actions>
      <div class="action-row ruleset-manager-footer-row">
        <RouterLink
          to="/settings/runs"
          class="app-icon-action app-icon-action--large ruleset-manager-back-action"
          data-testid="back-run-editor"
          aria-label="Back to Run Editor"
          title="Back to Run Editor"
        >
          <AppIcon name="back" />
        </RouterLink>
        <button
          v-if="draft && canRunActiveTenantReconciliation"
          type="button"
          class="app-icon-action app-icon-action--large ruleset-manager-run-action"
          data-testid="ruleset-manager-run-ruleset"
          aria-label="Run ruleset"
          @click="openRunWorkflow"
        >
          <AppIcon name="play" />
        </button>
        <RouterLink
          v-if="canViewRunHistory"
          class="app-icon-action app-icon-action--large ruleset-manager-history-action"
          data-testid="ruleset-manager-view-history"
          aria-label="View previous runs"
          title="View previous runs"
          :to="runHistoryRoute"
        >
          <AppIcon name="list" />
        </RouterLink>
        <button
          v-if="draft && canEditTenantSettings"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger ruleset-manager-delete-action"
          data-testid="ruleset-manager-delete-run"
          aria-label="Delete run"
          :disabled="deletingSavedRun"
          @click="deleteSavedRun"
        >
          <AppIcon name="trash" />
        </button>
      </div>
    </template>
  </StaticPageFrame>

  <div
    v-if="authInfoPopup"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ruleset-manager-auth-popup-title"
    data-testid="ruleset-manager-auth-popup"
    @click.self="closeAuthInfoPopup"
  >
    <section class="popup-workflow-modal workflow-panel ruleset-manager-auth-popup">
      <header class="workflow-panel-header ruleset-manager-auth-popup-header section-header-row">
        <h2 id="ruleset-manager-auth-popup-title" class="ruleset-manager-auth-popup-heading">{{ authInfoPopup.title }}</h2>
        <RouterLink
          class="app-icon-action ruleset-manager-auth-popup-dashboard"
          data-testid="ruleset-manager-auth-popup-dashboard"
          aria-label="Open full config dashboard"
          title="Open full config dashboard"
          :to="authInfoPopup.dashboardRoute"
        >
          <AppIcon name="ellipsis" />
        </RouterLink>
      </header>

      <p v-if="authInfoPopup.loading" class="section-note">Loading auth info...</p>
      <InlineValidation v-else-if="authInfoPopup.error" tone="error" :message="authInfoPopup.error" />

      <template v-else>
        <div class="ruleset-manager-auth-popup-grid" data-testid="ruleset-manager-auth-popup-fields">
          <article
            v-for="field in authInfoPopup.fields"
            :key="field.label"
            class="static-page-summary-card"
          >
            <span class="static-page-summary-label">{{ field.label }}</span>
            <span>{{ field.value }}</span>
          </article>
        </div>

        <div v-if="authInfoPopup.endpoints.length" class="ruleset-manager-auth-popup-endpoints">
          <h3 class="ruleset-manager-auth-popup-heading">Endpoints</h3>
          <div class="static-page-tile-grid static-page-record-grid static-page-record-grid--fixed">
            <article
              v-for="endpoint in authInfoPopup.endpoints"
              :key="endpoint.id"
              class="static-page-tile static-page-list-tile static-page-record-tile"
              data-testid="ruleset-manager-auth-popup-endpoint"
            >
              <span class="static-page-list-tile__title">{{ endpoint.label }}</span>
              <span class="static-page-list-tile__meta">{{ endpoint.meta }}</span>
            </article>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import AppToggleSwitch from '../../components/ui/AppToggleSwitch.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticRecordTitle from '../../components/ui/StaticRecordTitle.vue'
import RunConclusionRows from '../../components/reconciliation/RunConclusionRows.vue'
import { RUN_CONCLUSIONS_KEY, useRunConclusions } from '../../composables/useRunConclusions'
import { useRunResultName } from '../../composables/useRunResultName'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade, reconciliationFacade, settingsFacade } from '../../lib/api/facade'
import { cachedRead } from '../../lib/api/readCache'
import type {
  AutomationSourceConfigOption,
  OmsRestSourceConfigRecord,
  ShopifyAuthConfigRecord,
  SourceConfigEndpoint,
} from '../../lib/api/types'
import type { SourceExtractOption, SourceExtractOptions } from '../../lib/api/authoringTypes'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import {
  buildSaveRuleSetRunPayload,
  draftSideValue,
  formatReconciliationFieldKey,
  normalizeReconciliationFieldPath,
  type ReconciliationDraftSide,
  type ReconciliationRuleSetDraft,
  type ReconciliationRuleSetDraftRule,
  reconciliationSystemTitle,
  SOURCE_TYPE_API,
} from '../../lib/reconciliationRuleSetDraft'
import { buildReconciliationDiffRoute, buildReconciliationRunHistoryRoute } from '../../lib/reconciliationRoutes'
import {
  INCLUDE_FILTER_OPERATOR,
  INCLUDE_PREFIX_FILTER_OPERATOR,
  type SourceExcludeFilter,
} from '../../lib/sourceExcludeFilters'
import { buildWorkflowOriginState } from '../../lib/workflowOrigin'
import { darpanSystemIdsMatch } from '../../lib/utils/darpanSystems'
import { resolveSchemaLabel } from '../../lib/utils/schemaLabel'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()
const schemaLabels = ref<Record<string, string>>({})
const deletingSavedRun = ref(false)
const pageError = ref<string | null>(null)
type SourceSide = ReconciliationDraftSide
type AuthInfoKind = 'oms' | 'shopify'

interface SourceConfigSummary {
  kind: AuthInfoKind
  side: SourceSide
  configId: string
}

interface AuthInfoField {
  label: string
  value: string
}

interface AuthInfoEndpoint {
  id: string
  label: string
  meta: string
}

interface AuthInfoPopupState {
  source: SourceConfigSummary
  title: string
  fields: AuthInfoField[]
  endpoints: AuthInfoEndpoint[]
  dashboardRoute: RouteLocationRaw
  loading: boolean
  error: string | null
}

const draftState = computed(() => draftStore.ruleSetDraftState)
const draft = computed<ReconciliationRuleSetDraft | null>(() => draftState.value?.draft ?? null)
const savedRunId = computed(() => draft.value?.savedRunId?.trim() ?? '')
const draftRunName = computed(() => draft.value?.runName ?? '')
const file1Title = computed(() => reconciliationSystemTitle(draft.value, 'file1'))
const file2Title = computed(() => reconciliationSystemTitle(draft.value, 'file2'))
const file1SystemConfigName = computed(() => systemConfigName(draft.value, 'file1'))
const file2SystemConfigName = computed(() => systemConfigName(draft.value, 'file2'))
const file1SourceLabel = computed(() => summarizeSource(draft.value, 'file1'))
const file2SourceLabel = computed(() => summarizeSource(draft.value, 'file2'))
const file1SystemConfig = computed<SourceConfigSummary | null>(() => buildSourceConfigSummary(draft.value, 'file1'))
const file2SystemConfig = computed<SourceConfigSummary | null>(() => buildSourceConfigSummary(draft.value, 'file2'))
const file1PrimaryId = computed(() => formatFieldKeyList(draft.value?.file1PrimaryIdExpression))
const file2PrimaryId = computed(() => formatFieldKeyList(draft.value?.file2PrimaryIdExpression))
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const canRenameRun = computed(() => canEditTenantSettings.value && Boolean(savedRunId.value))
// The run's name, renamed in place through save#SavedRunName (the run history's rename).
const { editableRunName, persistedRunName, saveRunName, resetRunNameState } = useRunResultName({
  savedRunId,
  fallbackRunName: draftRunName,
  canEditTenantSettings,
  setLoadError: (message) => { pageError.value = message },
})
const heroTitle = computed(() => persistedRunName.value || draftRunName.value || 'Run')
const canRunActiveTenantReconciliation = computed(() => permissionsStore.canRunActiveTenantReconciliation)
const canViewRunHistory = computed(() => Boolean(savedRunId.value))
const sourceConfigOptions = ref<AutomationSourceConfigOption[]>([])
const authInfoPopup = ref<AuthInfoPopupState | null>(null)
// FIRST_FIELD lines name the parent record only when the key has two or more fields (an order behind order + line).
const firstKeyField = computed(() => {
  const keyFields = draft.value?.file1PrimaryIdExpression ?? []
  return keyFields.length >= 2 ? formatReconciliationFieldKey(keyFields[0]) : null
})
const conclusions = useRunConclusions({
  savedRunId,
  file1Label: file1Title,
  file2Label: file2Title,
  firstKeyField,
  listPaths: ref<ReadonlySet<string>>(new Set()),
})
provide(RUN_CONCLUSIONS_KEY, conclusions)
const isPopupOpen = computed(() => Boolean(authInfoPopup.value))
// An editor always has the section, even before the conclusions load or when there are none; anyone else sees it once
// they have loaded. The rows only read here; the pencil opens the conclusions page.
const showConclusions = computed(() => Boolean(draft.value && savedRunId.value)
  && (canEditTenantSettings.value || conclusions.loaded.value))
const runHistoryRoute = computed(() => buildReconciliationRunHistoryRoute({
  savedRunId: savedRunId.value,
  runName: heroTitle.value,
  file1SystemLabel: file1Title.value,
  file2SystemLabel: file2Title.value,
}))
// Read from the draft's scopeMode, which buildRuleSetDraft copies off the wire. Never inferred from
// an empty file2: that shape is also what a two-sided run looks like when its FILE_2 has gone
// missing, and quietly relabelling that as single-sided would hide a broken run instead of showing
// it. SavedRunSummary.scopeMode exists for exactly this distinction.
const isSingleSided = computed(() => (draft.value?.scopeMode ?? '').toUpperCase() === 'EVALUATE')
const comparisonPreview = computed(() => {
  if (!draft.value) return 'Select fields to draft a comparison'
  // Not "no rules yet": a single-sided run is not waiting to be configured. Its predicate lives in
  // the extractor, so the rows it returns ARE its findings (DAR-BE-049).
  if (isSingleSided.value) return 'Every record this source returns is a finding.'
  return `${file1PrimaryId.value} = ${file2PrimaryId.value}`
})
const basicDiffRule = computed<ReconciliationRuleSetDraftRule | null>(() => {
  if (!draft.value) return null
  // The basic diff rule is "file1's key equals file2's key". On a single-sided run there is no
  // second key, so synthesizing it rendered "#0 internalId = Field pending" - a comparison against
  // nothing, numbered as though it were configured.
  if (isSingleSided.value) return null

  const storedBasicDiffRule = (draft.value.rules ?? []).find((rule) => rule.sequenceNum === 0)
  if (storedBasicDiffRule) return storedBasicDiffRule

  return {
    ruleId: 'basic-diff',
    file1FieldPath: draft.value.file1PrimaryIdExpression[0] ?? '',
    file2FieldPath: draft.value.file2PrimaryIdExpression[0] ?? '',
    operator: '=',
    sequenceNum: 0,
  }
})
const visibleRules = computed(() => [
  ...(basicDiffRule.value ? [basicDiffRule.value] : []),
  ...(draft.value?.rules ?? []).filter((rule) => rule.sequenceNum > 0),
].sort((left, right) => left.sequenceNum - right.sequenceNum))

const formatFieldKey = formatReconciliationFieldKey

function formatFieldKeyList(fieldPaths: string[] | undefined): string {
  if (!fieldPaths?.length) return formatFieldKey(undefined)
  return fieldPaths.map((fieldPath) => formatFieldKey(fieldPath)).join(' + ')
}

/** The full path goes dim under the field's name, unless the name already is the whole path. */
function showsPath(fieldPath: string | undefined): boolean {
  const normalized = normalizeReconciliationFieldPath(fieldPath)
  return Boolean(normalized) && normalized !== formatFieldKey(fieldPath)
}

interface FilterRow {
  key: string
  system: string
  name: string
  path: string
  how: string
  values: string
}

/** The board's own words for a filter's direction (RuleSetBoard's value input). */
function filterHowWords(operator: string | undefined): string {
  if (operator === INCLUDE_PREFIX_FILTER_OPERATOR) return 'Starts to keep'
  if (operator === INCLUDE_FILTER_OPERATOR) return 'Values to keep'
  return 'Values to exclude'
}

function toFilterRows(side: SourceSide, system: string, filters: SourceExcludeFilter[] | undefined): FilterRow[] {
  return (filters ?? []).map((filter, index) => ({
    key: `${side}-${index}-${filter.fieldExpression}`,
    system,
    name: formatFieldKey(filter.fieldExpression),
    path: normalizeReconciliationFieldPath(filter.fieldExpression) || filter.fieldExpression,
    how: filterHowWords(filter.operator),
    values: filter.values.join(', '),
  }))
}

// One row per filter per side, from the draft itself; a single-sided run has only its one side.
const filterRows = computed<FilterRow[]>(() => [
  ...toFilterRows('file1', file1Title.value, draft.value?.file1ExcludeFilters),
  ...(isSingleSided.value ? [] : toFilterRows('file2', file2Title.value, draft.value?.file2ExcludeFilters)),
])

const PRE_ACTION_WORDS: Record<string, string> = { STRING_TO_INT: 'String to int', STRING_TO_NUMBER: 'String to number' }

/** Each side's pre-actions in words, named by the side's system: "Shopify: String to number". */
function preActionWords(rule: ReconciliationRuleSetDraftRule): string {
  const words = (rule.preActions ?? []).map((preAction) => {
    const system = preAction.fieldSide === 'file2' ? file2Title.value : file1Title.value
    return `${system}: ${PRE_ACTION_WORDS[preAction.action] ?? preAction.action}`
  })
  return words.length ? words.join(' · ') : '—'
}

function countWords(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

// The header strip (DAR-UI-126). A system's fact opens its connection when today's auth popup applies; the pairing
// fact is an editor's way into run setup, the one place the systems, schemas and primary IDs change.
const facts = computed<StaticFact[]>(() => {
  if (!draft.value) return []
  const systemFact = (side: SourceSide): StaticFact => {
    const configName = side === 'file1' ? file1SystemConfigName.value : file2SystemConfigName.value
    const sourceLabel = side === 'file1' ? file1SourceLabel.value : file2SourceLabel.value
    const interactive = Boolean(sourceConfigForSide(side))
    return {
      key: side,
      label: side === 'file1' ? file1Title.value : file2Title.value,
      value: configName || sourceLabel,
      sub: configName ? sourceLabel : undefined,
      explain: 'systemLabel',
      interactive,
      ariaLabel: interactive ? `View auth info for source ${side === 'file1' ? 1 : 2}` : undefined,
      testId: `ruleset-manager-fact-${side}`,
    }
  }
  const editsSetup = canRenameRun.value
  const pairing: StaticFact = isSingleSided.value
    ? { key: 'pairs', label: 'Primary ID', value: file1PrimaryId.value, explain: 'primaryId' }
    : { key: 'pairs', label: 'Pairs rows on', value: `${file1PrimaryId.value} = ${file2PrimaryId.value}`, explain: 'primaryId' }
  const conclusionCount = conclusions.loaded.value ? conclusions.list.value.length : null
  return [
    systemFact('file1'),
    ...(isSingleSided.value ? [] : [systemFact('file2')]),
    { ...pairing, interactive: editsSetup, ariaLabel: editsSetup ? 'Edit run setup' : undefined, testId: 'ruleset-manager-fact-pairs' },
    {
      key: 'checks',
      label: 'Checks',
      value: `${countWords(filterRows.value.length, 'filter')} · ${countWords(visibleRules.value.length, 'rule')}`,
      sub: conclusionCount === null ? undefined : countWords(conclusionCount, 'conclusion'),
      explain: 'ruleSetChecks',
      testId: 'ruleset-manager-fact-checks',
    },
  ]
})

// DAR-UI-148. A side's read options: the boolean ones its connector declares for this side's config and endpoint
// (list#AutomationSourceOptions, the rows the create wizard offers), each with whether the run has it on.
interface ReadOptionRow {
  key: string
  side: SourceSide
  system: string
  name: string
  label: string
  on: boolean
}

const readOptionError = ref('')

function sideExtractOptions(draftValue: ReconciliationRuleSetDraft, side: SourceSide): SourceExtractOptions {
  return draftSideValue(draftValue, side, 'ExtractOptions') ?? {}
}

function declaredBooleanOptions(draftValue: ReconciliationRuleSetDraft, side: SourceSide): SourceExtractOption[] {
  const configId = draftSideValue(draftValue, side, 'SourceConfigId')?.trim()
  const systemEnumId = draftSideValue(draftValue, side, 'SystemEnumId')?.trim().toUpperCase()
  if (!configId || !systemEnumId) return []
  // The endpoint itself, never its family: one Shopify config is the Orders, Order lines and Returns endpoints at once.
  const row = sourceConfigOptions.value.find((option) =>
    option.sourceConfigId?.trim() === configId && option.systemEnumId?.trim().toUpperCase() === systemEnumId)
  return (row?.extractOptions ?? []).filter((option) => Boolean(option?.name?.trim()) && option.type === 'boolean')
}

const readOptionRows = computed<ReadOptionRow[]>(() => {
  const draftValue = draft.value
  if (!draftValue) return []
  const sides: SourceSide[] = isSingleSided.value ? ['file1'] : ['file1', 'file2']
  return sides.flatMap((side) => {
    const chosen = sideExtractOptions(draftValue, side)
    const system = side === 'file1' ? file1Title.value : file2Title.value
    return declaredBooleanOptions(draftValue, side).map((option) => ({
      key: `${side}-${option.name}`, side, system, name: option.name, label: option.label || option.name, on: chosen[option.name] === true,
    }))
  })
})

/** The draft with one switch on a side set; the last one off leaves the side with no options. */
function withReadOption(draftValue: ReconciliationRuleSetDraft, row: ReadOptionRow, on: boolean): ReconciliationRuleSetDraft {
  const options: SourceExtractOptions = { ...sideExtractOptions(draftValue, row.side) }
  if (on) options[row.name] = true
  else delete options[row.name]
  const kept = Object.keys(options).length ? options : undefined
  return row.side === 'file1' ? { ...draftValue, file1ExtractOptions: kept } : { ...draftValue, file2ExtractOptions: kept }
}

// DAR-UI-156 (Aditi: "UI changes should always be immediate.. backend can do its thing"). The switch moves at once; the
// saves run one after another, each sending the run as it then stands, so the last switch pressed is the one stored.
// Only a refusal moves the switch again, back, with the reason above the list.
function setReadOption(row: ReadOptionRow, on: boolean): void {
  const draftValue = draft.value
  if (!draftValue || !canEditTenantSettings.value) return
  readOptionError.value = ''
  // The run this switch was pressed on: a save still queued when another run's draft opens must not save that one.
  const runId = draftValue.savedRunId
  draftStore.setRuleSetDraft(withReadOption(draftValue, row, on), draftState.value?.resumeStepId ?? null)
  void draftStore.afterRuleSetSaves(async () => {
    const current = draft.value
    if (!current || current.savedRunId !== runId) return
    try {
      // The run's own full save, as the rules editor sends it; the side's options go explicitly, so the last one off clears them.
      await reconciliationFacade.saveRuleSetRun({
        ...buildSaveRuleSetRunPayload(current), [`${row.side}ExtractOptions`]: sideExtractOptions(current, row.side),
      })
    } catch (error) {
      // Put back only this switch, and only while it still shows what this save set, on the same run.
      const now = draft.value
      if (now && now.savedRunId === runId && (sideExtractOptions(now, row.side)[row.name] === true) === on) {
        draftStore.setRuleSetDraft(withReadOption(now, row, !on), draftState.value?.resumeStepId ?? null)
      }
      readOptionError.value = error instanceof ApiCallError ? error.message : `${row.label} was not saved.`
    }
  })
}

function openFact(key: string): void {
  if (key === 'file1' || key === 'file2') openAuthInfoPopupForSide(key)
  else if (key === 'pairs') void openRunEditWorkflow()
}

async function commitRunName(value: string): Promise<void> {
  await saveRunName(value)
  const saved = persistedRunName.value
  // The draft is what every other surface of this run reads its name from; keep it in step with the rename.
  if (draft.value && saved && saved !== draft.value.runName) {
    draftStore.setRuleSetDraft({ ...draft.value, runName: saved }, draftState.value?.resumeStepId ?? null)
  }
}

watch(draftRunName, () => resetRunNameState(), { immediate: true })


/**
 * The API source config backing this side, shown under the system name. Empty for non-API sources.
 *
 * Named by its description, not its id: config ids are environment names an operator reuses across
 * systems (`rails_prod` on both the HotWax and the Shopify side of one run), so the id identifies
 * the environment and says nothing about the config. The description is also exactly what the
 * create wizard's source picker offered when this run was set up — see sourceConfigDescription —
 * so the run reads back the way it was chosen. Falls back to the id when a config carries no
 * description, or before the option list has loaded.
 */
function systemConfigName(draftValue: ReconciliationRuleSetDraft | null, side: SourceSide): string {
  if (!draftValue || !isApiSide(draftValue, side)) return ''

  const sourceConfigId = draftSideValue(draftValue, side, 'SourceConfigId')?.trim() ?? ''
  if (!sourceConfigId) return ''

  return sourceConfigDescription(sourceConfigId, draftSideValue(draftValue, side, 'SystemEnumId')) || sourceConfigId
}

function isApiSide(draftValue: ReconciliationRuleSetDraft, side: SourceSide): boolean {
  return draftSideValue(draftValue, side, 'SourceTypeEnumId')?.trim() === SOURCE_TYPE_API
}

/**
 * Resolve a config id to its description off the same option list the create wizard's picker uses.
 *
 * Matched on system as well as id, because one id can name a config on each side of a run (that is
 * the whole reason the id alone is not a name) — taking the first id match would print the OMS
 * config's description next to Shopify.
 */
function sourceConfigDescription(sourceConfigId: string, systemEnumId: string | undefined): string {
  const idMatches = sourceConfigOptions.value.filter((option) => option.sourceConfigId?.trim() === sourceConfigId)
  if (!idMatches.length) return ''

  // An option with no systemEnumId is system-agnostic and stays eligible, matching how the create
  // wizard filters the very same list (sourceConfigBelongsToSystem).
  const systemMatch = idMatches.find((option) => (
    !option.systemEnumId?.trim() || darpanSystemIdsMatch(option.systemEnumId, systemEnumId)
  ))
  return (systemMatch ?? idMatches[0])?.description?.trim() ?? ''
}

/** Best-effort: every caller falls back to the config id, so a failure here is not a page error. */
async function loadSourceConfigOptions(): Promise<void> {
  try {
    await cachedRead(
      'ruleSetManager.sourceOptions',
      () => reconciliationFacade.listAutomationSourceOptions(pageAbortController.signal),
      (response) => { sourceConfigOptions.value = response.sourceConfigs ?? [] },
    )
  } catch {
    sourceConfigOptions.value = []
  }
}

function summarizeSource(draftValue: ReconciliationRuleSetDraft | null, side: SourceSide): string {
  if (!draftValue) return 'Source pending'
  if (isApiSide(draftValue, side)) return apiEndpointLabel(draftValue, side)
  return draftSideValue(draftValue, side, 'FileTypeEnumId') === 'DftJson'
    ? resolveDraftSchemaLabel(draftValue, side)
    : 'CSV source'
}

function buildSourceConfigSummary(draftValue: ReconciliationRuleSetDraft | null, side: SourceSide): SourceConfigSummary | null {
  if (!draftValue) return null
  if (!permissionsStore.canViewTenantSettings || !isApiSide(draftValue, side)) return null

  const configId = draftSideValue(draftValue, side, 'SourceConfigId')?.trim()
  if (!configId) return null

  const sourceConfigType = draftSideValue(draftValue, side, 'SourceConfigType')?.trim()
  const systemEnumId = draftSideValue(draftValue, side, 'SystemEnumId')?.trim()

  // Every HotWax endpoint (OMS_GQL, OMS_RETURNS_GQL, ...) reads the one OMS connection.
  if (sourceConfigType?.startsWith('HOTWAX_OMS') || systemEnumId === 'OMS' || systemEnumId?.startsWith('OMS_')) {
    return { kind: 'oms', side, configId }
  }
  if (sourceConfigType === 'SHOPIFY_AUTH' || systemEnumId === 'SHOPIFY') {
    return { kind: 'shopify', side, configId }
  }
  return null
}

function apiEndpointLabel(draftValue: ReconciliationRuleSetDraft, side: SourceSide): string {
  return draftSideValue(draftValue, side, 'SystemMessageRemoteLabel')?.trim()
    || draftSideValue(draftValue, side, 'NsRestletConfigLabel')?.trim()
    || draftSideValue(draftValue, side, 'SystemMessageRemoteId')?.trim()
    || draftSideValue(draftValue, side, 'NsRestletConfigId')?.trim()
    || 'API'
}

function sourceConfigForSide(side: SourceSide): SourceConfigSummary | null {
  return side === 'file1' ? file1SystemConfig.value : file2SystemConfig.value
}

function closeAuthInfoPopup(): void {
  authInfoPopup.value = null
}

function openAuthInfoPopupForSide(side: SourceSide): void {
  const sourceConfig = sourceConfigForSide(side)
  if (!sourceConfig) return

  void openAuthInfoPopup(sourceConfig)
}

async function openAuthInfoPopup(sourceConfig: SourceConfigSummary): Promise<void> {
  // Until the connection loads (or if it will not), the popup names only the config id.
  const idOnly: AuthInfoPopupState = {
    source: sourceConfig,
    title: sourceConfig.configId,
    fields: [{ label: 'Config ID', value: sourceConfig.configId }],
    endpoints: [],
    dashboardRoute: buildSourceConfigDashboardRoute(sourceConfig),
    loading: true,
    error: null,
  }
  authInfoPopup.value = idOnly

  try {
    const loadedState = sourceConfig.kind === 'oms'
      ? await loadOmsAuthInfo(sourceConfig)
      : await loadShopifyAuthInfo(sourceConfig)
    if (!isActiveAuthInfoSource(sourceConfig)) return
    authInfoPopup.value = loadedState
  } catch (error) {
    if (!isActiveAuthInfoSource(sourceConfig)) return
    authInfoPopup.value = {
      ...idOnly,
      loading: false,
      error: error instanceof Error ? error.message : 'The auth info would not show its badge.',
    }
  }
}

function buildSourceConfigDashboardRoute(sourceConfig: SourceConfigSummary): RouteLocationRaw {
  const workflowOrigin = buildWorkflowOriginState('Run Details', route.fullPath || '/reconciliation/ruleset-manager')
  if (sourceConfig.kind === 'oms') {
    return {
      name: 'settings-oms-auth',
      params: { omsRestSourceConfigId: sourceConfig.configId },
      state: workflowOrigin,
    }
  }

  return {
    name: 'settings-shopify-auth',
    params: { shopifyAuthConfigId: sourceConfig.configId },
    state: workflowOrigin,
  }
}

function isActiveAuthInfoSource(sourceConfig: SourceConfigSummary): boolean {
  return authInfoPopup.value?.source.kind === sourceConfig.kind
    && authInfoPopup.value.source.side === sourceConfig.side
    && authInfoPopup.value.source.configId === sourceConfig.configId
}

async function loadOmsAuthInfo(sourceConfig: SourceConfigSummary): Promise<AuthInfoPopupState> {
  const [response, endpointsResponse] = await Promise.all([
    settingsFacade.listOmsRestSourceConfigs({ pageIndex: 0, pageSize: 200 }),
    settingsFacade.listSourceConfigEndpoints({ configTypeEnumId: SHARED_CONFIG_TYPES.hotwaxOms, configId: sourceConfig.configId }),
  ])
  const matchingConfig = filterRecordsForActiveTenant(
    response.omsRestSourceConfigs ?? [],
    authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  ).find((record) => record.omsRestSourceConfigId === sourceConfig.configId)

  if (!matchingConfig) {
    throw new Error(`HotWax auth config "${sourceConfig.configId}" is nowhere to be found. We asked twice.`)
  }

  return buildOmsAuthInfoPopupState(sourceConfig, matchingConfig, endpointsResponse.endpoints ?? [])
}

async function loadShopifyAuthInfo(sourceConfig: SourceConfigSummary): Promise<AuthInfoPopupState> {
  const [response, endpointsResponse] = await Promise.all([
    settingsFacade.getShopifyAuthConfig({ shopifyAuthConfigId: sourceConfig.configId }),
    settingsFacade.listSourceConfigEndpoints({ configTypeEnumId: SHARED_CONFIG_TYPES.shopifyAuth, configId: sourceConfig.configId }),
  ])
  const record = response.shopifyAuthConfig ?? null
  const [matchingConfig] = record
    ? filterRecordsForActiveTenant([record], authStore.sessionInfo?.activeTenantUserGroupId ?? null)
    : []

  if (!matchingConfig) {
    throw new Error(`Shopify config "${sourceConfig.configId}" checked out without us.`)
  }

  return buildShopifyAuthInfoPopupState(sourceConfig, matchingConfig, endpointsResponse.endpoints ?? [])
}

function buildOmsAuthInfoPopupState(
  sourceConfig: SourceConfigSummary,
  config: OmsRestSourceConfigRecord,
  endpoints: SourceConfigEndpoint[],
): AuthInfoPopupState {
  return {
    source: sourceConfig,
    title: resolveRecordLabel({
      description: config.description,
      fallbackId: config.omsRestSourceConfigId,
    }),
    fields: compactAuthInfoFields([
      authInfoField('Config ID', config.omsRestSourceConfigId),
      authInfoField('Base URL', config.baseUrl),
      authInfoField('Auth Type', formatAuthType(config.authType)),
      authInfoField('Timezone', config.timeZone),
    ]),
    endpoints: buildEnabledAuthInfoEndpoints(endpoints),
    dashboardRoute: buildSourceConfigDashboardRoute(sourceConfig),
    loading: false,
    error: null,
  }
}

function buildShopifyAuthInfoPopupState(
  sourceConfig: SourceConfigSummary,
  config: ShopifyAuthConfigRecord,
  endpoints: SourceConfigEndpoint[],
): AuthInfoPopupState {
  // Every Shopify endpoint the registry can name today reads through the one GraphQL URL, so the
  // api-version meta is genuinely shared across all of them. apiVersion is a required column; a blank one
  // shows no URL rather than a made-up version.
  const apiVersion = config.apiVersion?.trim() ?? ''
  const graphQlMeta = apiVersion ? `/admin/api/${apiVersion}/graphql.json` : ''

  return {
    source: sourceConfig,
    title: resolveRecordLabel({
      description: config.description,
      fallbackId: config.shopifyAuthConfigId,
    }),
    fields: compactAuthInfoFields([
      authInfoField('Config ID', config.shopifyAuthConfigId),
      authInfoField('Shop/API URL', config.shopApiUrl),
      authInfoField('API Version', apiVersion),
      authInfoField('Timezone', config.timeZone),
    ]),
    endpoints: buildEnabledAuthInfoEndpoints(endpoints, graphQlMeta),
    dashboardRoute: buildSourceConfigDashboardRoute(sourceConfig),
    loading: false,
    error: null,
  }
}

function buildEnabledAuthInfoEndpoints(endpoints: SourceConfigEndpoint[], meta = ''): AuthInfoEndpoint[] {
  return endpoints
    .filter((endpoint) => endpoint.isEnabled)
    .map((endpoint) => ({
      id: endpoint.systemEnumId,
      label: endpoint.endpointLabel,
      meta,
    }))
}

function authInfoField(label: string, value: string | undefined): AuthInfoField | null {
  const trimmedValue = value?.trim()
  return trimmedValue ? { label, value: trimmedValue } : null
}

/** Drops unset fields, and an auth type of NONE ("None"): nothing to show. */
function compactAuthInfoFields(fields: Array<AuthInfoField | null>): AuthInfoField[] {
  return fields.filter((field): field is AuthInfoField => Boolean(field) && field?.value !== 'None')
}

function formatAuthType(authType: string | undefined): string {
  const trimmedAuthType = authType?.trim()
  if (!trimmedAuthType) return ''

  return trimmedAuthType
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part === 'api' ? 'API' : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function resolveDraftSchemaLabel(draftValue: ReconciliationRuleSetDraft, side: SourceSide): string {
  const draftSchemaLabel = draftSideValue(draftValue, side, 'SchemaLabel')
  const systemLabel = side === 'file1' ? file1Title.value : file2Title.value
  if (draftSchemaLabel?.trim()) return withoutSystemSuffix(draftSchemaLabel.trim(), systemLabel)

  const schemaFileName = draftSideValue(draftValue, side, 'SchemaFileName')
  const lookupKey = schemaLabelLookupKey(draftSideValue(draftValue, side, 'JsonSchemaId'), schemaFileName)
  if (lookupKey && schemaLabels.value[lookupKey]) return withoutSystemSuffix(schemaLabels.value[lookupKey], systemLabel)

  return schemaFileName || 'JSON schema pending'
}

function withoutSystemSuffix(label: string, systemLabel: string): string {
  const suffix = systemLabel.trim() ? ` - ${systemLabel.trim()}` : ''
  return suffix && label.endsWith(suffix) ? label.slice(0, -suffix.length).trim() : label
}

function schemaLabelLookupKey(schemaId: string | undefined, schemaName: string | undefined): string {
  if (schemaId?.trim()) return `id:${schemaId.trim()}`
  if (schemaName?.trim()) return `name:${schemaName.trim()}`
  return ''
}

const pageAbortController = new AbortController()

onBeforeUnmount(() => {
  pageAbortController.abort()
})

async function ensureSchemaLabel(schemaId: string | undefined, schemaName: string | undefined, currentLabel: string | undefined): Promise<void> {
  const lookupKey = schemaLabelLookupKey(schemaId, schemaName)
  if (!lookupKey || currentLabel?.trim() || schemaLabels.value[lookupKey]) return

  try {
    await cachedRead(
      `ruleSetManager.schema:${lookupKey}`,
      () => jsonSchemaFacade.get(schemaId?.trim() ? { jsonSchemaId: schemaId.trim() } : { schemaName }, pageAbortController.signal),
      (response) => {
        if (!response.schemaData) return
        schemaLabels.value = {
          ...schemaLabels.value,
          [lookupKey]: resolveSchemaLabel(response.schemaData),
        }
      },
    )
  } catch {
    // Display falls back to the stored schema name when the label cannot be resolved.
  }
}

async function loadRunSchemaLabels(): Promise<void> {
  if (!draft.value) return

  await Promise.all([
    ensureSchemaLabel(draft.value.file1JsonSchemaId, draft.value.file1SchemaFileName, draft.value.file1SchemaLabel),
    ensureSchemaLabel(draft.value.file2JsonSchemaId, draft.value.file2SchemaFileName, draft.value.file2SchemaLabel),
  ])
}

function getRunDeleteLabel(): string {
  return heroTitle.value.trim() || savedRunId.value || 'this run'
}

async function openRunEditWorkflow(): Promise<void> {
  if (!canEditTenantSettings.value) return
  if (!draft.value || !savedRunId.value) return

  draftStore.setWorkflowOrigin('Run Details', route.fullPath || '/reconciliation/ruleset-manager')
  draftStore.setRuleSetDraft(draft.value)
  await router.push({
    name: 'settings-runs-edit',
    params: { reconciliationMappingId: savedRunId.value },
  })
}

async function openRuleEditWorkflow(): Promise<void> {
  if (!canEditTenantSettings.value) return
  if (!draft.value) return

  draftStore.setWorkflowOrigin('Run Details', route.fullPath || '/reconciliation/ruleset-manager')
  draftStore.setRuleSetDraft(draft.value, 'ruleset-manager')
  await router.push({ name: 'reconciliation-ruleset-editor' })
}

async function openConclusionEditWorkflow(): Promise<void> {
  if (!canEditTenantSettings.value) return
  if (!draft.value) return

  draftStore.setWorkflowOrigin('Run Details', route.fullPath || '/reconciliation/ruleset-manager')
  draftStore.setRuleSetDraft(draft.value, 'ruleset-manager')
  await router.push({ name: 'reconciliation-conclusions-editor' })
}

async function openRunWorkflow(): Promise<void> {
  pageError.value = null
  if (!canRunActiveTenantReconciliation.value) return
  if (!draft.value || !savedRunId.value) {
    pageError.value = 'Saved run ID is missing.'
    return
  }

  draftStore.setWorkflowOrigin('Run Details', route.fullPath || '/reconciliation/ruleset-manager')
  await router.push(
    buildReconciliationDiffRoute({
      savedRunId: savedRunId.value,
      runName: heroTitle.value,
      file1SystemLabel: file1Title.value,
      file2SystemLabel: file2Title.value,
    }),
  )
}

async function deleteSavedRun(): Promise<void> {
  if (!canEditTenantSettings.value) return
  if (deletingSavedRun.value) return

  pageError.value = null
  if (!savedRunId.value) {
    pageError.value = 'Saved run ID is missing.'
    return
  }

  if (!window.confirm(`Delete run "${getRunDeleteLabel()}"?`)) return

  deletingSavedRun.value = true
  try {
    await reconciliationFacade.deleteSavedRun({ savedRunId: savedRunId.value })
    await router.push(draftStore.workflowOrigin?.path ?? '/settings/runs')
  } catch (error) {
    pageError.value = error instanceof ApiCallError ? error.message : 'This run refuses to leave. Still here.'
  } finally {
    deletingSavedRun.value = false
  }
}

onMounted(() => {
  void loadRunSchemaLabels()
  void loadSourceConfigOptions()
})
</script>

<style scoped>
.ruleset-manager-section-edit {
  flex: 0 0 auto;
  width: 2.2rem;
  min-height: 2.2rem;
}

.ruleset-manager-section-title {
  display: grid;
  gap: var(--space-00);
}

.ruleset-manager-section-note {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

.ruleset-manager-footer-row {
  gap: var(--space-2);
  justify-content: center;
}

/* DAR-UI-128. Filters and rules as one bordered list each (.static-row-list), of equal read-only rows. */
.ruleset-manager-row {
  display: grid;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: 3.4rem;
  padding: var(--space-1-5) var(--space-3);
}

.ruleset-manager-row--filter {
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1.3fr);
}

/* DAR-UI-148. A read option: its side, what it reads, its switch at the end. */
.ruleset-manager-row--option {
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 2.1fr) max-content;
}

.ruleset-manager-row--note {
  display: flex;
  color: var(--text-muted);
}

.ruleset-manager-rule-table {
  display: grid;
  gap: var(--space-1);
}

.ruleset-manager-row--rule,
.ruleset-manager-rule-head {
  grid-template-columns: 2rem minmax(0, 1fr) 7.5rem minmax(0, 1fr) minmax(0, 0.9fr);
}

.ruleset-manager-rule-head {
  display: grid;
  gap: var(--space-3);
  padding: 0 var(--space-3);
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

.ruleset-manager-rule-head > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ruleset-manager-rule-head__test {
  text-align: center;
}

.ruleset-manager-field,
.ruleset-manager-rule-pre {
  display: grid;
  min-width: 0;
}

.ruleset-manager-field__name,
.ruleset-manager-row__values {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ruleset-manager-row__values {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.ruleset-manager-field__path,
.ruleset-manager-rule-name {
  overflow: hidden;
  color: var(--text-dim);
  font-size: var(--type-note-size);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ruleset-manager-row__dim,
.ruleset-manager-rule-sequence,
.ruleset-manager-rule-pre {
  min-width: 0;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.ruleset-manager-rule-pre {
  font-size: var(--type-note-size);
}

.ruleset-manager-rule-sequence {
  font-variant-numeric: tabular-nums;
}

.ruleset-manager-operator-pill {
  justify-self: center;
  max-width: 100%;
  padding: 0 var(--space-1-5);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  font-size: var(--type-note-size);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ruleset-manager-auth-popup {
  --ruleset-manager-auth-popup-gap: 0.7rem;
  display: grid;
  gap: var(--ruleset-manager-auth-popup-gap);
  width: min(42rem, calc(100vw - 2rem));
  max-width: min(42rem, calc(100vw - 2rem));
}


.ruleset-manager-auth-popup .ruleset-manager-auth-popup-heading {
  margin: 0;
  color: var(--text);
  font-size: var(--popup-workflow-title-size, 0.875rem);
  font-weight: 400;
  line-height: 1.25;
}

.ruleset-manager-auth-popup-dashboard {
  flex: 0 0 auto;
  width: 2.2rem;
  min-height: 2.2rem;
}

.ruleset-manager-auth-popup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.ruleset-manager-auth-popup-grid .static-page-summary-card {
  min-width: 0;
}

.ruleset-manager-auth-popup-grid .static-page-summary-card span:last-child {
  overflow-wrap: anywhere;
}

.ruleset-manager-auth-popup-endpoints {
  display: grid;
  gap: var(--ruleset-manager-auth-popup-gap);
}

@media (max-width: 768px) {
  .ruleset-manager-row--filter {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .ruleset-manager-rule-head {
    display: none;
  }

  /* The pair on one line under its number; the pre-actions under the pair. */
  .ruleset-manager-row--rule {
    grid-template-columns: 1.5rem minmax(0, 1fr) auto minmax(0, 1fr);
    gap: var(--space-1) var(--space-2);
  }

  .ruleset-manager-rule-pre {
    grid-column: 2 / -1;
  }
}

@media (max-width: 680px) {
  .ruleset-manager-auth-popup-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
