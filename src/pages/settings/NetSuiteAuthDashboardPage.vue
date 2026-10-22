<template>
  <StaticPageFrame>
    <template #hero>
      <h1>{{ heroTitle }}</h1>
    </template>

    <p v-if="loading" class="section-note">Loading NetSuite auth config...</p>
    <InlineValidation v-else-if="error" tone="error" :message="error" />

    <template v-else-if="config">
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
          <template v-if="config.authType === 'OAUTH2_M2M_JWT'">
            <article class="static-page-summary-card static-page-summary-card--wide">
              <span class="static-page-summary-label">Token URL</span>
              <span>{{ config.tokenUrl }}</span>
            </article>
            <article class="static-page-summary-card">
              <span class="static-page-summary-label">Scope</span>
              <span>{{ scopeLabel }}</span>
            </article>
          </template>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Active</span>
            <span>{{ activeLabel }}</span>
          </article>
        </div>
      </StaticPageSection>

      <SourceConfigEndpointsSection
        :load-state="endpointsLoadState"
        :error="endpointsError"
        :endpoints="availableEndpoints"
        list-test-id="netsuite-endpoint-configs"
        tile-test-id="netsuite-endpoint-tile"
      />
    </template>

    <StaticPageSection v-else>
      <EmptyState title="NetSuite auth config unavailable" />
    </StaticPageSection>

    <!-- No diagnose or delete here: NetSuite has no connection probe and no delete service yet. -->
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
      </div>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import { cachedRead } from '../../lib/api/readCache'
import type { NsAuthConfigRecord } from '../../lib/api/types'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { backIconPath, editIconPath } from '../../lib/iconPaths'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'
import SourceConfigEndpointsSection from './SourceConfigEndpointsSection.vue'
import { useSourceConfigEndpoints } from './useSourceConfigEndpoints'

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
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const config = ref<NsAuthConfigRecord | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

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

const pageAbortController = new AbortController()
const {
  availableEndpoints,
  loadState: endpointsLoadState,
  error: endpointsError,
  load: loadEndpoints,
} = useSourceConfigEndpoints({
  configTypeEnumId: SHARED_CONFIG_TYPES.netSuiteAuth,
  configId: () => configId.value,
  cacheKeyPrefix: 'netSuiteAuthDashboard.endpoints',
  signal: pageAbortController.signal,
})

onBeforeUnmount(() => {
  pageAbortController.abort()
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
        error.value = matchingConfig ? null : `Unable to find NetSuite auth config "${configId.value}".`
      },
    )
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load NetSuite auth config.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
  void loadEndpoints()
})
</script>
