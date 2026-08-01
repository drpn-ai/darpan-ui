<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': diagnostics.open.value }">
    <template #hero>
      <h1>{{ heroTitle }}</h1>
    </template>

    <p v-if="loading" class="section-note">Loading HotWax auth config...</p>
    <InlineValidation v-else-if="error" tone="error" :message="error" />

    <template v-else-if="config">
      <InlineValidation v-if="deleteError" tone="error" :message="deleteError" />

      <StaticPageSection>
        <template #header>
          <div class="static-page-section-header-row">
            <h2 class="static-page-section-heading">Auth</h2>
            <RouterLink
              v-if="canEditTenantSettings"
              :to="editRoute"
              class="app-icon-action static-page-section-edit-action"
              data-testid="oms-auth-edit-action"
              aria-label="Edit HotWax Auth"
              @click="draftStore.setWorkflowOrigin(heroTitle, route.fullPath || `/settings/hotwax/auth/${configId}`)"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="editIconPath" />
              </svg>
            </RouterLink>
          </div>
        </template>

        <div class="static-page-summary-grid">
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Config ID</span>
            <span>{{ config.omsRestSourceConfigId }}</span>
          </article>
          <article class="static-page-summary-card static-page-summary-card--wide">
            <span class="static-page-summary-label">Base URL</span>
            <span>{{ config.baseUrl }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Active</span>
            <span>{{ activeLabel }}</span>
          </article>
          <article class="static-page-summary-card static-page-summary-card--wide">
            <span class="static-page-summary-label">Timezone</span>
            <span>{{ timeZone }}</span>
          </article>
        </div>
      </StaticPageSection>

      <StaticPageSection title="Endpoints">
        <div
          class="static-page-tile-grid static-page-record-grid static-page-record-grid--fixed"
          data-testid="oms-endpoint-configs"
        >
          <article
            v-for="endpoint in availableEndpoints"
            :key="endpoint.id"
            class="static-page-tile static-page-list-tile static-page-record-tile"
            data-testid="oms-endpoint-tile"
          >
            <span class="static-page-list-tile__title">{{ endpoint.label }}</span>
            <span class="static-page-list-tile__meta">{{ endpoint.method }} {{ endpoint.path }}</span>
          </article>
          <EmptyState v-if="availableEndpoints.length === 0" title="No available endpoints" />
        </div>
      </StaticPageSection>
    </template>

    <StaticPageSection v-else>
      <EmptyState title="HotWax auth config unavailable" />
    </StaticPageSection>

    <template v-if="config" #actions>
      <div class="action-row settings-dashboard-footer-row">
        <RouterLink
          to="/settings/hotwax"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="back-oms-rest-source"
          aria-label="Back to HotWax Settings"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>

        <RouterLink
          to="/settings/hotwax"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="list-oms-rest-sources"
          aria-label="View HotWax sources"
          title="View HotWax sources"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="listIconPath" fill="currentColor" />
          </svg>
        </RouterLink>

        <button
          v-if="canEditTenantSettings"
          type="button"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="diagnose-oms-rest-source"
          aria-label="Run connection diagnostics"
          title="Run connection diagnostics"
          :disabled="diagnostics.running.value"
          @click="runDiagnostics"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path
              :d="diagnosticsIconPath"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button
          v-if="canEditTenantSettings"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger settings-dashboard-footer-action"
          data-testid="delete-oms-rest-source"
          aria-label="Delete HotWax source"
          :disabled="deletingConfig"
          @click="deleteConfig"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
          </svg>
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

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ConnectionDiagnosticsPopup from '../../components/settings/ConnectionDiagnosticsPopup.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { OmsRestSourceConfigRecord } from '../../lib/api/types'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import {
  backIconPath,
  diagnosticsIconPath,
  editIconPath,
  listIconPath,
  trashIconPath,
  trashIconTransform,
} from '../../lib/iconPaths'
import { OMS_ORDERS_ENDPOINT_DOC } from '../../lib/omsSwagger'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'
import { useConnectionDiagnostics } from './useConnectionDiagnostics'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const config = ref<OmsRestSourceConfigRecord | null>(null)
const loading = ref(false)
const deletingConfig = ref(false)
const error = ref<string | null>(null)
const deleteError = ref<string | null>(null)
const ordersEndpoint = OMS_ORDERS_ENDPOINT_DOC

const configId = computed(() => String(route.params.omsRestSourceConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const heroTitle = computed(() => (
  config.value
    ? resolveRecordLabel({ description: config.value.description, fallbackId: config.value.omsRestSourceConfigId })
    : 'HotWax'
))
const timeZone = computed(() => config.value?.timeZone?.trim() || 'UTC')
const activeLabel = computed(() => (config.value?.isActive === 'N' ? 'No' : 'Yes'))
const availableEndpoints = computed(() => (
  config.value?.canReadOrders === false ? [] : [ordersEndpoint]
))
const editRoute = computed(() => ({
  name: 'settings-oms-edit',
  params: { omsRestSourceConfigId: configId.value },
}))

const pageAbortController = new AbortController()
const diagnostics = useConnectionDiagnostics('OMS')

function runDiagnostics(): void {
  if (!config.value) return
  void diagnostics.run(config.value.omsRestSourceConfigId)
}

onBeforeUnmount(() => {
  pageAbortController.abort()
  diagnostics.dispose()
})

async function load(): Promise<void> {
  if (!configId.value) {
    error.value = 'HotWax Config ID is missing.'
    return
  }

  loading.value = true
  error.value = null
  config.value = null
  try {
    const response = await settingsFacade.listOmsRestSourceConfigs({ pageIndex: 0, pageSize: 200 }, pageAbortController.signal)
    const matchingConfig = filterRecordsForActiveTenant(
      response.omsRestSourceConfigs ?? [],
      authStore.sessionInfo?.activeTenantUserGroupId ?? null,
    ).find((record) => record.omsRestSourceConfigId === configId.value)
    if (!matchingConfig) {
      error.value = `Unable to find HotWax auth config "${configId.value}".`
      return
    }
    config.value = matchingConfig
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load HotWax auth config.'
  } finally {
    loading.value = false
  }
}

async function deleteConfig(): Promise<void> {
  if (!config.value || !canEditTenantSettings.value || deletingConfig.value) return

  const deleteLabel = resolveRecordLabel({
    description: config.value.description,
    fallbackId: config.value.omsRestSourceConfigId,
  })
  if (!window.confirm(`Delete HotWax source "${deleteLabel}"?`)) return

  deletingConfig.value = true
  deleteError.value = null
  try {
    await settingsFacade.deleteOmsRestSourceConfig({ omsRestSourceConfigId: config.value.omsRestSourceConfigId })
    await router.push('/settings/hotwax')
  } catch (deleteFailure) {
    deleteError.value = deleteFailure instanceof ApiCallError ? deleteFailure.message : 'Failed to delete HotWax source.'
  } finally {
    deletingConfig.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
