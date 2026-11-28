<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': diagnostics.open.value }">
    <template #hero>
      <h1>{{ title }}</h1>
    </template>

    <p v-if="loading" class="section-note">Loading {{ noun }}...</p>
    <InlineValidation v-else-if="error" tone="error" :message="error" />

    <template v-else-if="record">
      <InlineValidation v-if="deleteError" tone="error" :message="deleteError" />

      <StaticPageSection>
        <template #header>
          <div class="static-page-section-header-row">
            <h2 class="static-page-section-heading">Auth</h2>
            <RouterLink
              v-if="canManageConnections"
              :to="editRoute"
              class="app-icon-action static-page-section-edit-action"
              :data-testid="testIds.edit"
              :aria-label="editAriaLabel"
              @click="draftStore.setWorkflowOrigin(title, route.fullPath || `${listPath}/auth/${configId}`)"
            >
              <AppIcon name="edit" />
            </RouterLink>
          </div>
        </template>

        <div class="static-page-summary-grid">
          <article
            v-for="fact in facts(record)"
            :key="fact.key"
            :class="['static-page-summary-card', fact.span && `static-page-summary-card--${fact.span}`]"
          >
            <span v-explain="fact.explain ?? ''" class="static-page-summary-label">{{ fact.label }}</span>
            <span>{{ fact.value }}</span>
          </article>
        </div>
      </StaticPageSection>

      <SourceConfigEndpointsSection
        v-if="endpoints && endpointList"
        :load-state="endpoints.loadState.value"
        :error="endpoints.error.value"
        :endpoints="endpoints.availableEndpoints.value"
        :list-test-id="endpointList.listTestId"
        :tile-test-id="endpointList.tileTestId"
      />
      <slot v-else name="endpoints" />
    </template>

    <StaticPageSection v-else>
      <EmptyState :title="`${noun} unavailable`" />
    </StaticPageSection>

    <template v-if="record" #actions>
      <div class="action-row settings-dashboard-footer-row">
        <RouterLink
          :to="listPath"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          :data-testid="testIds.back"
          :aria-label="backAriaLabel"
        >
          <AppIcon name="back" />
        </RouterLink>

        <button
          v-if="canManageConnections && (canDiagnose?.(record) ?? true)"
          type="button"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          :data-testid="testIds.diagnose"
          aria-label="Run connection diagnostics"
          title="Run connection diagnostics"
          :disabled="diagnostics.running.value"
          @click="diagnostics.run(configId)"
        >
          <AppIcon name="diagnostics" />
        </button>

        <button
          v-if="canManageConnections"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger settings-dashboard-footer-action"
          :data-testid="testIds.delete"
          :aria-label="deleteAriaLabel"
          :disabled="deleting"
          @click="deleteRecord"
        >
          <AppIcon name="trash" />
        </button>
      </div>
    </template>
  </StaticPageFrame>

  <ConnectionDiagnosticsPopup
    v-if="diagnostics.open.value"
    :running="diagnostics.running.value"
    :available="diagnostics.available.value"
    :connection-ok="diagnostics.connectionOk.value"
    :checks="diagnostics.checks.value"
    :error="diagnostics.error.value"
    @close="diagnostics.close"
  />
</template>

<script setup lang="ts" generic="T extends { description?: string | null; companyUserGroupId?: string | null; isShared?: boolean }">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import ConnectionDiagnosticsPopup from '../../components/settings/ConnectionDiagnosticsPopup.vue'
import AppIcon from '../../components/ui/AppIcon.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError } from '../../lib/api/client'
import { cachedRead } from '../../lib/api/readCache'
import type { SharedConfigType } from '../../lib/sharedConfig'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import SourceConfigEndpointsSection from './SourceConfigEndpointsSection.vue'
import { useConnectionDiagnostics } from './useConnectionDiagnostics'
import { findTenantRecord } from './useSettingsPagedList'
import { useSourceConfigEndpoints } from './useSourceConfigEndpoints'

/** One fact on the record's summary; a URL takes two columns (wide) or a row of its own (full) so it does not wrap. */
export interface ConnectionFact {
  key: string
  label: string
  value: string
  /** Glossary key the mascot answers the label with. */
  explain?: string
  span?: 'wide' | 'full'
}

/**
 * One saved connection's page (NetSuite auth, HotWax, Shopify): its name and facts, its endpoints, and back,
 * diagnose and delete. A system's page supplies the record read, the facts and the copy; the endpoints are either
 * the shared catalog tiles (endpointList) or the page's own #endpoints slot.
 */
const props = defineProps<{
  /** The system's name: the title before the record loads. */
  system: string
  /** What the record is called while loading and when it is missing, e.g. "Shopify config". */
  noun: string
  /** What the delete confirmation calls it, e.g. "Shopify config". */
  deleteNoun: string
  /**
   * The three buttons' names, written as literals by each page so the mascot guard (mascotActions.spec WRAPPERS)
   * checks every one has an answer.
   */
  editAriaLabel: string
  deleteAriaLabel: string
  backAriaLabel: string
  listPath: string
  configId: string
  /** The cached read the record comes from, and how its rows are listed; the active tenant's row with this id wins. */
  read: { cacheKey: string; fetch: (signal: AbortSignal) => Promise<T[] | undefined> }
  idOf: (record: T) => string
  missingMessage: string
  loadFailedMessage: string
  facts: (record: T) => ConnectionFact[]
  editRoute: RouteLocationRaw
  remove: (configId: string) => Promise<unknown>
  deleteFailedMessage: string
  /** A SourceSystemConnector id whose health check probes this record. */
  diagnosticsSystemEnumId: string
  canDiagnose?: (record: T) => boolean
  endpointList?: { configType: SharedConfigType; cacheKeyPrefix: string; listTestId: string; tileTestId: string }
  testIds: { edit: string; back: string; diagnose: string; delete: string }
}>()

defineSlots<{ endpoints?: () => unknown }>()

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const record = shallowRef<T | null>(null)
const loading = ref(false)
const deleting = ref(false)
const error = ref<string | null>(null)
const deleteError = ref<string | null>(null)

const canManageConnections = computed(() => permissionsStore.canManageConnections)
const title = computed(() => (
  record.value ? resolveRecordLabel({ description: record.value.description, fallbackId: props.configId }) : props.system
))

const pageAbortController = new AbortController()
// Started beside the record read, so neither waits on the other.
const endpoints = props.endpointList
  ? useSourceConfigEndpoints({
    configTypeEnumId: props.endpointList.configType,
    configId: () => props.configId,
    cacheKeyPrefix: props.endpointList.cacheKeyPrefix,
    signal: pageAbortController.signal,
  })
  : null
const diagnostics = useConnectionDiagnostics(props.diagnosticsSystemEnumId)

onBeforeUnmount(() => {
  pageAbortController.abort()
  diagnostics.dispose()
})

async function load(): Promise<void> {
  if (!props.configId) {
    error.value = `${props.system} Config ID is missing.`
    return
  }

  loading.value = true
  error.value = null
  record.value = null
  try {
    await cachedRead(props.read.cacheKey, () => props.read.fetch(pageAbortController.signal), (rows) => {
      const found = findTenantRecord(rows, (row) => props.idOf(row) === props.configId)
      // DAR-UI-051: a cached copy is drawn at once, so the fresh answer may replace either outcome.
      loading.value = false
      record.value = found
      error.value = found ? null : props.missingMessage
    })
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : props.loadFailedMessage
  } finally {
    loading.value = false
  }
}

async function deleteRecord(): Promise<void> {
  if (!record.value || !canManageConnections.value || deleting.value) return
  if (!window.confirm(`Delete ${props.deleteNoun} "${title.value}"?`)) return

  deleting.value = true
  deleteError.value = null
  try {
    await props.remove(props.configId)
    await router.push(props.listPath)
  } catch (deleteFailure) {
    deleteError.value = deleteFailure instanceof ApiCallError ? deleteFailure.message : props.deleteFailedMessage
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void load()
  void endpoints?.load()
})
</script>
