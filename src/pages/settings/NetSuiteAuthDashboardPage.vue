<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': diagnostics.open.value }">
    <template #hero>
      <h1>{{ heroTitle }}</h1>
    </template>

    <p v-if="loading" class="section-note">Loading NetSuite auth config...</p>
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
              data-testid="netsuite-auth-edit-action"
              aria-label="Edit NetSuite Auth"
              @click="draftStore.setWorkflowOrigin(heroTitle, route.fullPath || `/settings/netsuite/auth/${configId}`)"
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
            <span>{{ config.nsAuthConfigId }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Auth Type</span>
            <span>{{ authTypeLabel }}</span>
          </article>
          <article v-if="config.authType === 'BASIC'" class="static-page-summary-card">
            <span class="static-page-summary-label">Username</span>
            <span>{{ config.username }}</span>
          </article>
          <article v-if="config.authType === 'OAUTH2_M2M_JWT'" class="static-page-summary-card">
            <span class="static-page-summary-label">Scope</span>
            <span>{{ scopeLabel }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Active</span>
            <span>{{ activeLabel }}</span>
          </article>
          <article
            v-if="config.authType === 'OAUTH2_M2M_JWT'"
            class="static-page-summary-card static-page-summary-card--full"
          >
            <span class="static-page-summary-label">Token URL</span>
            <span>{{ config.tokenUrl }}</span>
          </article>
        </div>
      </StaticPageSection>

      <SettingsRecordListSection
        title="Endpoints"
        :tiles="endpointTiles"
        :page-index="0"
        :page-count="1"
        pager-aria-label="NetSuite endpoint pages"
        previous-test-id="netsuite-endpoint-page-previous"
        next-test-id="netsuite-endpoint-page-next"
        :loading="endpointsLoading"
        loading-noun="endpoints"
        :error="endpointsError"
        empty-title="No endpoints"
        list-test-id="saved-endpoint-configs"
        tile-test-id="netsuite-endpoint-tile"
        :can-create="canEditTenantSettings"
        :create-route="endpointCreateRoute"
        create-label="Create Endpoint"
        create-test-id="netsuite-endpoint-create-action"
        empty-create-test-id="netsuite-endpoint-create-action"
      />
    </template>

    <StaticPageSection v-else>
      <EmptyState title="NetSuite auth config unavailable" />
    </StaticPageSection>

    <template v-if="config" #actions>
      <div class="action-row settings-dashboard-footer-row">
        <RouterLink
          to="/settings/netsuite"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="back-netsuite-auth"
          aria-label="Back to NetSuite Settings"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>

        <!-- The probe tests OAuth2 profiles only (DAR-BE-114). -->
        <button
          v-if="canEditTenantSettings && config.authType === 'OAUTH2_M2M_JWT'"
          type="button"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="diagnose-netsuite-auth"
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
          data-testid="delete-netsuite-auth"
          aria-label="Delete NetSuite auth profile"
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
import { cachedRead } from '../../lib/api/readCache'
import type { NsAuthConfigRecord, NsRestletConfigRecord } from '../../lib/api/types'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import {
  backIconPath,
  diagnosticsIconPath,
  editIconPath,
  trashIconPath,
  trashIconTransform,
} from '../../lib/iconPaths'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'
import SettingsRecordListSection from './SettingsRecordListSection.vue'
import { useConnectionDiagnostics } from './useConnectionDiagnostics'

const AUTH_TYPE_LABELS: Record<string, string> = {
  NONE: 'None',
  BASIC: 'Basic',
  BEARER: 'Bearer',
  OAUTH2_M2M_JWT: 'OAuth2 M2M JWT',
}
const SCOPE_LABELS: Record<string, string> = {
  restlets: 'RESTlets',
  rest_webservices: 'REST Web Services',
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const config = ref<NsAuthConfigRecord | null>(null)
const loading = ref(false)
const deletingConfig = ref(false)
const error = ref<string | null>(null)
const deleteError = ref<string | null>(null)

const configId = computed(() => String(route.params.nsAuthConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const heroTitle = computed(() => (
  config.value
    ? resolveRecordLabel({ description: config.value.description, fallbackId: config.value.nsAuthConfigId })
    : 'NetSuite'
))
const authTypeLabel = computed(() => {
  const authType = config.value?.authType ?? ''
  return AUTH_TYPE_LABELS[authType] ?? authType
})
const scopeLabel = computed(() => (config.value?.scope ?? '')
  .split(/\s+/)
  .filter(Boolean)
  .map((scope) => SCOPE_LABELS[scope] ?? scope)
  .join(', '))
const activeLabel = computed(() => (config.value?.isActive === 'N' ? 'No' : 'Yes'))
const editRoute = computed(() => ({
  name: 'settings-netsuite-auth-edit',
  params: { nsAuthConfigId: configId.value },
}))

const endpoints = ref<NsRestletConfigRecord[]>([])
const endpointsLoading = ref(true)
const endpointsError = ref<string | null>(null)
const endpointCreateRoute = computed(() => ({
  name: 'settings-netsuite-endpoints-create',
  query: { nsAuthConfigId: configId.value },
}))
const endpointTiles = computed(() => endpoints.value.map((row) => ({
  key: row.nsRestletConfigId,
  label: resolveRecordLabel({ description: row.description, fallbackId: row.nsRestletConfigId }),
  to: {
    name: 'settings-netsuite-endpoints-edit',
    params: { nsRestletConfigId: row.nsRestletConfigId },
  },
})))

const pageAbortController = new AbortController()

const diagnostics = useConnectionDiagnostics('NETSUITE')

function runDiagnostics(): void {
  if (!config.value) return
  void diagnostics.run(config.value.nsAuthConfigId)
}

onBeforeUnmount(() => {
  pageAbortController.abort()
  diagnostics.dispose()
})

async function load(): Promise<void> {
  if (!configId.value) {
    error.value = 'NetSuite Config ID is missing.'
    return
  }

  loading.value = true
  error.value = null
  config.value = null
  try {
    // There is no get#NsAuthConfig; the edit wizard reads the same first page of the list.
    await cachedRead(
      'netSuiteAuthDashboard.listNsAuthConfigs:0:200',
      () => settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 200 }, pageAbortController.signal),
      (response) => {
        const matchingConfig = filterRecordsForActiveTenant(
          response.authConfigs ?? [],
          authStore.sessionInfo?.activeTenantUserGroupId ?? null,
        ).find((record) => record.nsAuthConfigId === configId.value)
        // DAR-UI-051: a cached copy is drawn at once, so the fresh answer may replace either outcome.
        loading.value = false
        config.value = matchingConfig ?? null
        error.value = matchingConfig ? null : `NetSuite auth config "${configId.value}" is hiding in a saved search.`
      },
    )
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'This NetSuite auth config is still in a meeting.'
  } finally {
    loading.value = false
  }
}

/** The RESTlet endpoints signing in with this profile. The list service has no auth filter, so it is applied here. */
async function loadEndpoints(): Promise<void> {
  if (!configId.value) return

  endpointsLoading.value = true
  endpointsError.value = null
  try {
    await cachedRead(
      'netSuiteAuthDashboard.listNsRestletConfigs:0:200',
      () => settingsFacade.listNsRestletConfigs({ pageIndex: 0, pageSize: 200 }, pageAbortController.signal),
      (response) => {
        endpointsLoading.value = false
        endpoints.value = filterRecordsForActiveTenant(
          response.restletConfigs ?? [],
          authStore.sessionInfo?.activeTenantUserGroupId ?? null,
        ).filter((row) => row.nsAuthConfigId === configId.value)
      },
    )
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    endpointsError.value = loadError instanceof ApiCallError ? loadError.message : 'The endpoints are nowhere in sight. Ironic.'
  } finally {
    endpointsLoading.value = false
  }
}

async function deleteConfig(): Promise<void> {
  if (!config.value || !canEditTenantSettings.value || deletingConfig.value) return
  if (!window.confirm(`Delete NetSuite auth profile "${heroTitle.value}"?`)) return

  deletingConfig.value = true
  deleteError.value = null
  try {
    // The backend refuses while endpoints, checks or saved runs still use the profile, and names them.
    await settingsFacade.deleteNsAuthConfig({ nsAuthConfigId: config.value.nsAuthConfigId })
    await router.push('/settings/netsuite')
  } catch (deleteFailure) {
    deleteError.value = deleteFailure instanceof ApiCallError ? deleteFailure.message : 'The NetSuite auth profile clung to the doorframe. Still here.'
  } finally {
    deletingConfig.value = false
  }
}

onMounted(() => {
  void load()
  void loadEndpoints()
})
</script>
