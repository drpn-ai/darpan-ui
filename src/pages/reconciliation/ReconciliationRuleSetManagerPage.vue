<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': isAuthInfoPopupOpen }">
    <template #hero>
      <div class="ruleset-manager-hero">
        <h1>{{ heroTitle }}</h1>
      </div>
    </template>

    <InlineValidation v-if="deleteError" tone="error" :message="deleteError" />

    <StaticPageSection v-if="draft">
      <template #header>
        <div class="ruleset-manager-section-header section-header-row">
          <h2 class="static-page-section-heading">Run</h2>
          <button
            v-if="canEditTenantSettings"
            type="button"
            class="app-icon-action ruleset-manager-section-edit"
            data-testid="ruleset-manager-edit-run"
            aria-label="Edit Run"
            @click="openRunEditWorkflow"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path
                :d="editIconPath"
                class="ruleset-manager-edit-icon-path"
              />
            </svg>
          </button>
        </div>
      </template>

      <div class="ruleset-manager-basics-grid">
        <div class="ruleset-manager-schema-row" data-testid="ruleset-manager-schema-row-file1">
          <button
            v-if="file1SystemConfig"
            type="button"
            class="ruleset-manager-basic-card ruleset-manager-basic-card--button"
            data-testid="ruleset-manager-system-config-file1"
            aria-label="View auth info for source 1"
            @click="openAuthInfoPopupForSide('file1')"
          >
            <span class="static-page-summary-label">System</span>
            <span class="ruleset-manager-system-line">
              <strong>{{ file1Title }}</strong>
              <template v-if="file1SystemConfigName">
                <span class="ruleset-manager-system-separator" aria-hidden="true">·</span>
                <span class="ruleset-manager-system-config" data-testid="ruleset-manager-system-config-name-file1">{{ file1SystemConfigName }}</span>
              </template>
            </span>
          </button>
          <article v-else class="ruleset-manager-basic-card">
            <span class="static-page-summary-label">System</span>
            <span class="ruleset-manager-system-line">
              <strong>{{ file1Title }}</strong>
              <template v-if="file1SystemConfigName">
                <span class="ruleset-manager-system-separator" aria-hidden="true">·</span>
                <span class="ruleset-manager-system-config" data-testid="ruleset-manager-system-config-name-file1">{{ file1SystemConfigName }}</span>
              </template>
            </span>
          </article>
          <article class="ruleset-manager-basic-card">
            <span class="static-page-summary-label">Schema</span>
            <span class="ruleset-manager-summary-copy">{{ file1SourceLabel }}</span>
          </article>
          <article class="ruleset-manager-basic-card">
            <span class="static-page-summary-label">Primary ID</span>
            <span>{{ file1PrimaryId }}</span>
          </article>
        </div>

        <div class="ruleset-manager-schema-row" data-testid="ruleset-manager-schema-row-file2">
          <button
            v-if="file2SystemConfig"
            type="button"
            class="ruleset-manager-basic-card ruleset-manager-basic-card--button"
            data-testid="ruleset-manager-system-config-file2"
            aria-label="View auth info for source 2"
            @click="openAuthInfoPopupForSide('file2')"
          >
            <span class="static-page-summary-label">System</span>
            <span class="ruleset-manager-system-line">
              <strong>{{ file2Title }}</strong>
              <template v-if="file2SystemConfigName">
                <span class="ruleset-manager-system-separator" aria-hidden="true">·</span>
                <span class="ruleset-manager-system-config" data-testid="ruleset-manager-system-config-name-file2">{{ file2SystemConfigName }}</span>
              </template>
            </span>
          </button>
          <article v-else class="ruleset-manager-basic-card">
            <span class="static-page-summary-label">System</span>
            <span class="ruleset-manager-system-line">
              <strong>{{ file2Title }}</strong>
              <template v-if="file2SystemConfigName">
                <span class="ruleset-manager-system-separator" aria-hidden="true">·</span>
                <span class="ruleset-manager-system-config" data-testid="ruleset-manager-system-config-name-file2">{{ file2SystemConfigName }}</span>
              </template>
            </span>
          </article>
          <article class="ruleset-manager-basic-card">
            <span class="static-page-summary-label">Schema</span>
            <span class="ruleset-manager-summary-copy">{{ file2SourceLabel }}</span>
          </article>
          <article class="ruleset-manager-basic-card">
            <span class="static-page-summary-label">Primary ID</span>
            <span>{{ file2PrimaryId }}</span>
          </article>
        </div>
      </div>
    </StaticPageSection>

    <StaticPageSection>
      <template #header>
        <div class="ruleset-manager-section-header section-header-row">
          <h2 class="static-page-section-heading">Rules</h2>
          <button
            v-if="canEditTenantSettings"
            type="button"
            class="app-icon-action ruleset-manager-section-edit"
            data-testid="ruleset-manager-edit-rules"
            aria-label="Edit Rules"
            @click="openRuleEditWorkflow"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path
                :d="editIconPath"
                class="ruleset-manager-edit-icon-path"
              />
            </svg>
          </button>
        </div>
      </template>

      <template v-if="draft">
        <div class="ruleset-manager-builder">
          <!-- Exclusions are applied during extraction, before any comparison rule runs, so they are
               listed first here to match execution order -- not because they take precedence over the
               comparison rules, and not as a count of any kind. -->
          <section class="ruleset-manager-equation-panel" data-testid="ruleset-manager-exclusions" aria-label="Exclusions">
            <span class="static-page-summary-label">Exclusions</span>
            <ul class="ruleset-manager-exclusion-list" data-testid="ruleset-manager-exclusion-list">
              <li data-testid="ruleset-exclusions-file1">{{ file1Exclusions }}</li>
              <li data-testid="ruleset-exclusions-file2">{{ file2Exclusions }}</li>
            </ul>
          </section>

          <section class="ruleset-manager-equation-panel" data-testid="ruleset-manager-preview" aria-label="Active comparison">
            <ol v-if="visibleRules.length" class="ruleset-manager-rule-list" data-testid="ruleset-manager-rule-list">
              <li v-for="rule in visibleRules" :key="rule.ruleId || `${rule.sequenceNum}-${rule.file1FieldPath}-${rule.file2FieldPath}`">
                <span class="ruleset-manager-rule-sequence">#{{ rule.sequenceNum }}</span>
                <span>{{ formatRulePreview(rule) }}</span>
              </li>
            </ol>
            <p v-else class="ruleset-manager-preview-line">{{ comparisonPreview }}</p>
          </section>
        </div>
      </template>

      <template v-else>
        <EmptyState
          title="No run basics defined yet"
          description="Start in reconciliation setup, then open the Ruleset Manager after defining the two sources."
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

    <template v-if="draft && (canRunActiveTenantReconciliation || canViewRunHistory || canEditTenantSettings)" #actions>
      <div class="action-row ruleset-manager-footer-row">
        <button
          v-if="canRunActiveTenantReconciliation"
          type="button"
          class="app-icon-action app-icon-action--large ruleset-manager-run-action"
          data-testid="ruleset-manager-run-ruleset"
          aria-label="Run ruleset"
          @click="openRunWorkflow"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
          </svg>
        </button>
        <RouterLink
          v-if="canViewRunHistory"
          class="app-icon-action app-icon-action--large ruleset-manager-history-action"
          data-testid="ruleset-manager-view-history"
          aria-label="View previous runs"
          title="View previous runs"
          :to="runHistoryRoute"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="listIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
        <button
          v-if="canEditTenantSettings"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger ruleset-manager-delete-action"
          data-testid="ruleset-manager-delete-run"
          aria-label="Delete run"
          :disabled="deletingSavedRun"
          @click="deleteSavedRun"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
          </svg>
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
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="ellipsisIconPath" fill="currentColor" />
          </svg>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade, reconciliationFacade, settingsFacade } from '../../lib/api/facade'
import type { OmsRestSourceConfigRecord, ShopifyAuthConfigRecord } from '../../lib/api/types'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { editIconPath, listIconPath, playIconPath, playIconTransform, trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import { OMS_ORDERS_ENDPOINT_DOC } from '../../lib/omsSwagger'
import {
  formatReconciliationFieldKey,
  type ReconciliationRuleSetDraft,
  type ReconciliationRuleSetDraftRule,
} from '../../lib/reconciliationRuleSetDraft'
import { buildReconciliationDiffRoute, buildReconciliationRunHistoryRoute } from '../../lib/reconciliationRoutes'
import type { SourceExcludeFilter } from '../../lib/sourceExcludeFilters'
import { buildWorkflowOriginState } from '../../lib/workflowOrigin'
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
const deleteError = ref<string | null>(null)
type SourceSide = 'file1' | 'file2'
type AuthInfoKind = 'oms' | 'shopify'

interface SourceConfigSummary {
  kind: AuthInfoKind
  side: SourceSide
  configId: string
  label: string
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

const SOURCE_TYPE_API = 'AUT_SRC_API'
const ellipsisIconPath =
  'M5 8.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z'
const shopifyOrdersEndpoint = {
  id: 'SHOPIFY_ORDERS',
  label: 'Admin GraphQL Orders',
  method: 'POST',
}

const draftState = computed(() => draftStore.ruleSetDraftState)
const draft = computed<ReconciliationRuleSetDraft | null>(() => draftState.value?.draft ?? null)
const savedRunId = computed(() => draft.value?.savedRunId?.trim() ?? '')
const heroTitle = computed(() => draft.value?.runName || 'Run')
const file1Title = computed(() => systemTitle(draft.value, 'file1'))
const file2Title = computed(() => systemTitle(draft.value, 'file2'))
const file1SystemConfigName = computed(() => systemConfigName(draft.value, 'file1'))
const file2SystemConfigName = computed(() => systemConfigName(draft.value, 'file2'))
const file1SourceLabel = computed(() => summarizeSource(draft.value, 'file1'))
const file2SourceLabel = computed(() => summarizeSource(draft.value, 'file2'))
const file1SystemConfig = computed<SourceConfigSummary | null>(() => buildSourceConfigSummary(draft.value, 'file1'))
const file2SystemConfig = computed<SourceConfigSummary | null>(() => buildSourceConfigSummary(draft.value, 'file2'))
const file1PrimaryId = computed(() => formatFieldKeyList(draft.value?.file1PrimaryIdExpression))
const file2PrimaryId = computed(() => formatFieldKeyList(draft.value?.file2PrimaryIdExpression))
const file1Exclusions = computed(() => formatExclusionSummary(file1Title.value, draft.value?.file1ExcludeFilters))
const file2Exclusions = computed(() => formatExclusionSummary(file2Title.value, draft.value?.file2ExcludeFilters))
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const canRunActiveTenantReconciliation = computed(() => permissionsStore.canRunActiveTenantReconciliation)
const canViewRunHistory = computed(() => Boolean(savedRunId.value))
const authInfoPopup = ref<AuthInfoPopupState | null>(null)
const isAuthInfoPopupOpen = computed(() => Boolean(authInfoPopup.value))
const runHistoryRoute = computed(() => buildReconciliationRunHistoryRoute({
  savedRunId: savedRunId.value,
  runName: heroTitle.value,
  file1SystemLabel: file1Title.value,
  file2SystemLabel: file2Title.value,
}))
const comparisonPreview = computed(() => {
  if (!draft.value) return 'Select fields to draft a comparison'
  return `${file1PrimaryId.value} = ${file2PrimaryId.value}`
})
const basicDiffRule = computed<ReconciliationRuleSetDraftRule | null>(() => {
  if (!draft.value) return null

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

function formatExclusions(filters: SourceExcludeFilter[] | undefined): string {
  if (!filters?.length) return '—'
  return filters.map((filter) => `${formatFieldKey(filter.fieldExpression)}: ${filter.values.join(', ')}`).join(' · ')
}

// The Rules section shows exclusions unordered and unnumbered (that decision is deliberate — see
// the manager page's Rules section markup) alongside the numbered comparison rules, so each entry
// names its own side rather than relying on row position the way the old Run-section cards did.
function formatExclusionSummary(title: string, filters: SourceExcludeFilter[] | undefined): string {
  return `${title} · ${formatExclusions(filters)}`
}

function formatRulePreview(rule: ReconciliationRuleSetDraftRule): string {
  return `${formatFieldKey(rule.file1FieldPath)} ${rule.operator?.trim() || '='} ${formatFieldKey(rule.file2FieldPath)}`
}

/**
 * The card is labelled "System", so it names the system — Shopify, HotWax, NetSuite.
 *
 * This used to return the source CONFIG id for API sources, which read fine when the two sides used
 * differently-named configs and became useless when they did not: a Shopify/HotWax run whose configs
 * are both named e.g. `gorjana_prod` showed the same value on both rows and never named either
 * system. The config id is still shown, as a secondary line — see systemConfigName.
 */
function systemTitle(draftValue: ReconciliationRuleSetDraft | null, side: 'file1' | 'file2'): string {
  if (!draftValue) return side === 'file1' ? 'System 1' : 'System 2'

  const systemLabel = side === 'file1' ? draftValue.file1SystemLabel : draftValue.file2SystemLabel
  const systemEnumId = side === 'file1' ? draftValue.file1SystemEnumId : draftValue.file2SystemEnumId
  return systemLabel || systemEnumId || (side === 'file1' ? 'System 1' : 'System 2')
}

/** The API source config backing this side, shown under the system name. Empty for non-API sources. */
function systemConfigName(draftValue: ReconciliationRuleSetDraft | null, side: 'file1' | 'file2'): string {
  if (!draftValue) return ''

  const sourceTypeEnumId = side === 'file1' ? draftValue.file1SourceTypeEnumId : draftValue.file2SourceTypeEnumId
  if (sourceTypeEnumId?.trim() !== SOURCE_TYPE_API) return ''

  const sourceConfigId = side === 'file1' ? draftValue.file1SourceConfigId : draftValue.file2SourceConfigId
  return sourceConfigId?.trim() ?? ''
}

function summarizeSource(draftValue: ReconciliationRuleSetDraft | null, side: 'file1' | 'file2'): string {
  if (!draftValue) return 'Source pending'

  const sourceTypeEnumId = side === 'file1' ? draftValue.file1SourceTypeEnumId : draftValue.file2SourceTypeEnumId
  if (sourceTypeEnumId?.trim() === SOURCE_TYPE_API) return apiEndpointLabel(draftValue, side)

  const fileTypeEnumId = side === 'file1' ? draftValue.file1FileTypeEnumId : draftValue.file2FileTypeEnumId
  return fileTypeEnumId === 'DftJson'
    ? resolveDraftSchemaLabel(draftValue, side)
    : 'CSV source'
}

function buildSourceConfigSummary(draftValue: ReconciliationRuleSetDraft | null, side: SourceSide): SourceConfigSummary | null {
  if (!draftValue) return null
  if (!permissionsStore.canViewTenantSettings) return null

  const sourceTypeEnumId = side === 'file1' ? draftValue.file1SourceTypeEnumId : draftValue.file2SourceTypeEnumId
  if (sourceTypeEnumId?.trim() !== SOURCE_TYPE_API) return null

  const sourceConfigId = side === 'file1' ? draftValue.file1SourceConfigId?.trim() : draftValue.file2SourceConfigId?.trim()
  if (!sourceConfigId) return null

  const sourceConfigType = side === 'file1' ? draftValue.file1SourceConfigType?.trim() : draftValue.file2SourceConfigType?.trim()
  const systemEnumId = side === 'file1' ? draftValue.file1SystemEnumId?.trim() : draftValue.file2SystemEnumId?.trim()

  if (sourceConfigType === 'HOTWAX_OMS_REST' || systemEnumId === 'OMS') {
    return {
      kind: 'oms',
      side,
      configId: sourceConfigId,
      label: sourceConfigId,
    }
  }

  if (sourceConfigType === 'SHOPIFY_AUTH' || systemEnumId === 'SHOPIFY') {
    return {
      kind: 'shopify',
      side,
      configId: sourceConfigId,
      label: sourceConfigId,
    }
  }

  return null
}

function apiEndpointLabel(draftValue: ReconciliationRuleSetDraft, side: 'file1' | 'file2'): string {
  const systemMessageRemoteLabel = side === 'file1' ? draftValue.file1SystemMessageRemoteLabel : draftValue.file2SystemMessageRemoteLabel
  const nsRestletConfigLabel = side === 'file1' ? draftValue.file1NsRestletConfigLabel : draftValue.file2NsRestletConfigLabel
  const systemMessageRemoteId = side === 'file1' ? draftValue.file1SystemMessageRemoteId : draftValue.file2SystemMessageRemoteId
  const nsRestletConfigId = side === 'file1' ? draftValue.file1NsRestletConfigId : draftValue.file2NsRestletConfigId

  return systemMessageRemoteLabel?.trim()
    || nsRestletConfigLabel?.trim()
    || systemMessageRemoteId?.trim()
    || nsRestletConfigId?.trim()
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
  authInfoPopup.value = {
    source: sourceConfig,
    title: sourceConfig.label,
    fields: [{ label: 'Config ID', value: sourceConfig.configId }],
    endpoints: [],
    dashboardRoute: buildSourceConfigDashboardRoute(sourceConfig),
    loading: true,
    error: null,
  }

  try {
    const loadedState = sourceConfig.kind === 'oms'
      ? await loadOmsAuthInfo(sourceConfig)
      : await loadShopifyAuthInfo(sourceConfig)
    if (!isActiveAuthInfoSource(sourceConfig)) return
    authInfoPopup.value = loadedState
  } catch (error) {
    if (!isActiveAuthInfoSource(sourceConfig)) return
    authInfoPopup.value = {
      source: sourceConfig,
      title: sourceConfig.label,
      fields: [{ label: 'Config ID', value: sourceConfig.configId }],
      endpoints: [],
      dashboardRoute: buildSourceConfigDashboardRoute(sourceConfig),
      loading: false,
      error: error instanceof ApiCallError || error instanceof Error ? error.message : 'Unable to load auth info.',
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
  const response = await settingsFacade.listOmsRestSourceConfigs({ pageIndex: 0, pageSize: 200 })
  const matchingConfig = filterRecordsForActiveTenant(
    response.omsRestSourceConfigs ?? [],
    authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  ).find((record) => record.omsRestSourceConfigId === sourceConfig.configId)

  if (!matchingConfig) {
    throw new Error(`Unable to find HotWax auth config "${sourceConfig.configId}".`)
  }

  return buildOmsAuthInfoPopupState(sourceConfig, matchingConfig)
}

async function loadShopifyAuthInfo(sourceConfig: SourceConfigSummary): Promise<AuthInfoPopupState> {
  const response = await settingsFacade.getShopifyAuthConfig({ shopifyAuthConfigId: sourceConfig.configId })
  const record = response.shopifyAuthConfig ?? null
  const [matchingConfig] = record
    ? filterRecordsForActiveTenant([record], authStore.sessionInfo?.activeTenantUserGroupId ?? null)
    : []

  if (!matchingConfig) {
    throw new Error(`Unable to find Shopify config "${sourceConfig.configId}".`)
  }

  return buildShopifyAuthInfoPopupState(sourceConfig, matchingConfig)
}

function buildOmsAuthInfoPopupState(sourceConfig: SourceConfigSummary, config: OmsRestSourceConfigRecord): AuthInfoPopupState {
  const endpointPath = config.ordersPath?.trim() || OMS_ORDERS_ENDPOINT_DOC.path

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
    endpoints: config.canReadOrders === false
      ? []
      : [{
          id: OMS_ORDERS_ENDPOINT_DOC.id,
          label: OMS_ORDERS_ENDPOINT_DOC.label,
          meta: `${OMS_ORDERS_ENDPOINT_DOC.method} ${endpointPath}`,
        }],
    dashboardRoute: buildSourceConfigDashboardRoute(sourceConfig),
    loading: false,
    error: null,
  }
}

function buildShopifyAuthInfoPopupState(sourceConfig: SourceConfigSummary, config: ShopifyAuthConfigRecord): AuthInfoPopupState {
  const apiVersion = displayValue(config.apiVersion, '2026-01')

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
    endpoints: config.canReadOrders
      ? [{
          id: shopifyOrdersEndpoint.id,
          label: shopifyOrdersEndpoint.label,
          meta: `${shopifyOrdersEndpoint.method} /admin/api/${apiVersion}/graphql.json`,
        }]
      : [],
    dashboardRoute: buildSourceConfigDashboardRoute(sourceConfig),
    loading: false,
    error: null,
  }
}

function displayValue(value: string | undefined, fallback = 'Not set'): string {
  return value?.trim() || fallback
}

function authInfoField(label: string, value: string | undefined): AuthInfoField | null {
  const trimmedValue = value?.trim()
  return trimmedValue ? { label, value: trimmedValue } : null
}

function compactAuthInfoFields(fields: Array<AuthInfoField | null>): AuthInfoField[] {
  const placeholderValues = new Set(['Not set', 'None', 'Not configured'])
  return fields.filter((field): field is AuthInfoField => {
    if (!field) return false
    return !placeholderValues.has(field.value)
  })
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

function resolveDraftSchemaLabel(draftValue: ReconciliationRuleSetDraft, side: 'file1' | 'file2'): string {
  const draftSchemaLabel = side === 'file1' ? draftValue.file1SchemaLabel : draftValue.file2SchemaLabel
  const systemLabel = side === 'file1' ? file1Title.value : file2Title.value
  if (draftSchemaLabel?.trim()) return withoutSystemSuffix(draftSchemaLabel.trim(), systemLabel)

  const jsonSchemaId = side === 'file1' ? draftValue.file1JsonSchemaId : draftValue.file2JsonSchemaId
  const schemaFileName = side === 'file1' ? draftValue.file1SchemaFileName : draftValue.file2SchemaFileName
  const lookupKey = schemaLabelLookupKey(jsonSchemaId, schemaFileName)
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
    const response = await jsonSchemaFacade.get(schemaId?.trim() ? { jsonSchemaId: schemaId.trim() } : { schemaName }, pageAbortController.signal)
    if (!response.schemaData) return

    schemaLabels.value = {
      ...schemaLabels.value,
      [lookupKey]: resolveSchemaLabel(response.schemaData),
    }
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

async function openRunWorkflow(): Promise<void> {
  deleteError.value = null
  if (!canRunActiveTenantReconciliation.value) return
  if (!draft.value || !savedRunId.value) {
    deleteError.value = 'Saved run ID is missing.'
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

  deleteError.value = null
  if (!savedRunId.value) {
    deleteError.value = 'Saved run ID is missing.'
    return
  }

  if (!window.confirm(`Delete run "${getRunDeleteLabel()}"?`)) return

  deletingSavedRun.value = true
  try {
    await reconciliationFacade.deleteSavedRun({ savedRunId: savedRunId.value })
    await router.push(draftStore.workflowOrigin?.path ?? '/settings/runs')
  } catch (error) {
    deleteError.value = error instanceof ApiCallError ? error.message : 'Unable to delete run.'
  } finally {
    deletingSavedRun.value = false
  }
}

onMounted(() => {
  void loadRunSchemaLabels()
})
</script>

<style scoped>
.ruleset-manager-hero {
  display: grid;
  gap: var(--space-1);
}

.ruleset-manager-hero h1 {
  margin: 0;
}


.ruleset-manager-section-edit {
  flex: 0 0 auto;
  width: 2.2rem;
  min-height: 2.2rem;
}

.ruleset-manager-edit-icon-path {
  fill: currentColor;
}

.ruleset-manager-footer-row {
  gap: var(--space-2);
  justify-content: center;
}

.ruleset-manager-basic-card--button {
  width: 100%;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.ruleset-manager-basic-card--button:hover,
.ruleset-manager-basic-card--button:focus-visible {
  border-color: color-mix(in oklab, var(--accent) 58%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 82%, var(--accent));
  color: var(--text);
}

.ruleset-manager-summary-copy {
  color: var(--text-soft);
}

.ruleset-manager-basics-grid {
  display: grid;
  gap: var(--space-2);
}

.ruleset-manager-schema-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.ruleset-manager-basic-card {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--static-surface-radius);
  background: var(--surface-2);
}

/* System name and its connection sit on one line, dot-separated, so the card stays a single row
   like its Schema and Primary ID neighbours. */
.ruleset-manager-system-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-1);
  min-width: 0;
}

.ruleset-manager-system-separator,
.ruleset-manager-system-config {
  color: var(--text-muted);
  font-size: var(--type-summary-label-size);
  overflow-wrap: anywhere;
}

.ruleset-manager-basic-card strong,
.ruleset-manager-summary-copy {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ruleset-manager-builder {
  display: grid;
  gap: var(--space-4);
}

.ruleset-manager-equation-panel {
  display: grid;
  gap: var(--space-1-5);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--static-surface-radius);
  background: var(--surface-2);
}

.ruleset-manager-preview-line {
  margin: 0;
  color: var(--text-soft);
  overflow-wrap: anywhere;
  line-height: 1.35;
}

.ruleset-manager-rule-list,
.ruleset-manager-exclusion-list {
  display: grid;
  gap: var(--space-1-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ruleset-manager-rule-list li,
.ruleset-manager-exclusion-list li {
  display: flex;
  gap: var(--space-1-5);
  align-items: baseline;
  min-width: 0;
  color: var(--text-soft);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.ruleset-manager-rule-sequence {
  flex: 0 0 auto;
  color: var(--text-muted);
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

@media (max-width: 980px) {
  .ruleset-manager-schema-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 680px) {
  .ruleset-manager-auth-popup-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
