<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': diagnostics.open.value }">
    <template #hero>
      <h1>{{ heroTitle }}</h1>
    </template>

    <p v-if="loading" class="section-note">Loading Shopify config...</p>
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
              data-testid="shopify-auth-edit-action"
              aria-label="Edit Shopify Config"
              @click="draftStore.setWorkflowOrigin(heroTitle, route.fullPath || `/settings/shopify/auth/${configId}`)"
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
            <span>{{ config.shopifyAuthConfigId }}</span>
          </article>
          <article class="static-page-summary-card static-page-summary-card--wide">
            <span class="static-page-summary-label">Shop/API URL</span>
            <span>{{ config.shopApiUrl }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">API Version</span>
            <span>{{ apiVersion }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Timezone</span>
            <span>{{ timeZone }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Active</span>
            <span>{{ activeLabel }}</span>
          </article>
        </div>
      </StaticPageSection>

      <StaticPageSection title="Endpoints">
        <div
          class="static-page-tile-grid static-page-record-grid static-page-record-grid--fixed"
          data-testid="shopify-endpoint-configs"
        >
          <article
            v-for="endpoint in availableEndpoints"
            :key="endpoint.id"
            class="static-page-tile static-page-list-tile static-page-record-tile"
            data-testid="shopify-endpoint-tile"
          >
            <span class="static-page-list-tile__title">{{ endpoint.label }}</span>
            <span class="static-page-list-tile__meta">{{ endpoint.method }} {{ endpoint.path }}</span>
            <span class="static-page-list-tile__meta">{{ endpoint.responseSchema }}</span>
          </article>
          <EmptyState v-if="availableEndpoints.length === 0" title="No available endpoints" />
        </div>
      </StaticPageSection>
    </template>

    <StaticPageSection v-else>
      <EmptyState title="Shopify config unavailable" />
    </StaticPageSection>

    <template v-if="config" #actions>
      <div class="action-row settings-dashboard-footer-row">
        <RouterLink
          to="/settings/shopify"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="back-shopify-auth"
          aria-label="Back to Shopify Settings"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>

        <button
          v-if="canEditTenantSettings"
          type="button"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="diagnose-shopify-auth"
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
          data-testid="delete-shopify-auth"
          aria-label="Delete Shopify config"
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
import type { ShopifyAuthConfigRecord } from '../../lib/api/types'
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
import { useConnectionDiagnostics } from './useConnectionDiagnostics'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const config = ref<ShopifyAuthConfigRecord | null>(null)
const loading = ref(false)
const deletingConfig = ref(false)
const error = ref<string | null>(null)
const deleteError = ref<string | null>(null)
const shopifyOrdersEndpoint = {
  id: 'SHOPIFY_ORDERS',
  label: 'Admin GraphQL Orders',
  method: 'POST',
  responseSchema: 'OrderConnection',
}

const configId = computed(() => String(route.params.shopifyAuthConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const heroTitle = computed(() => (
  config.value
    ? resolveRecordLabel({ description: config.value.description, fallbackId: config.value.shopifyAuthConfigId })
    : 'Shopify'
))
const apiVersion = computed(() => config.value?.apiVersion?.trim() || '2026-01')
const timeZone = computed(() => config.value?.timeZone?.trim() || 'UTC')
const activeLabel = computed(() => (config.value?.isActive === 'N' ? 'No' : 'Yes'))
const graphQlEndpointPath = computed(() => `/admin/api/${apiVersion.value}/graphql.json`)
const availableEndpoints = computed(() => (
  config.value?.canReadOrders
    ? [{ ...shopifyOrdersEndpoint, path: graphQlEndpointPath.value }]
    : []
))
const editRoute = computed(() => ({
  name: 'settings-shopify-edit',
  params: { shopifyAuthConfigId: configId.value },
}))

const pageAbortController = new AbortController()
const diagnostics = useConnectionDiagnostics('SHOPIFY')

function runDiagnostics(): void {
  if (!config.value) return
  void diagnostics.run(config.value.shopifyAuthConfigId)
}

onBeforeUnmount(() => {
  pageAbortController.abort()
  diagnostics.dispose()
})

async function load(): Promise<void> {
  if (!configId.value) {
    error.value = 'Shopify Config ID is missing.'
    return
  }

  loading.value = true
  error.value = null
  config.value = null
  try {
    const response = await settingsFacade.getShopifyAuthConfig({ shopifyAuthConfigId: configId.value }, pageAbortController.signal)
    const record = response.shopifyAuthConfig ?? null
    const [tenantRecord] = record
      ? filterRecordsForActiveTenant([record], authStore.sessionInfo?.activeTenantUserGroupId ?? null)
      : []
    if (!tenantRecord) {
      error.value = `Unable to find Shopify config "${configId.value}".`
      return
    }
    config.value = tenantRecord
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load Shopify config.'
  } finally {
    loading.value = false
  }
}

async function deleteConfig(): Promise<void> {
  if (!config.value || !canEditTenantSettings.value || deletingConfig.value) return

  const deleteLabel = resolveRecordLabel({
    description: config.value.description,
    fallbackId: config.value.shopifyAuthConfigId,
  })
  if (!window.confirm(`Delete Shopify config "${deleteLabel}"?`)) return

  deletingConfig.value = true
  deleteError.value = null
  try {
    await settingsFacade.deleteShopifyAuthConfig({ shopifyAuthConfigId: config.value.shopifyAuthConfigId })
    await router.push('/settings/shopify')
  } catch (deleteFailure) {
    deleteError.value = deleteFailure instanceof ApiCallError ? deleteFailure.message : 'Failed to delete Shopify config.'
  } finally {
    deletingConfig.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
