<template>
  <ConnectionDashboard
    system="Shopify"
    noun="Shopify config"
    delete-noun="Shopify config"
    list-path="/settings/shopify"
    :config-id="configId"
    :read="{
      cacheKey: `shopifyAuthDashboard.config:${configId}`,
      fetch: async (signal) => {
        const response = await settingsFacade.getShopifyAuthConfig({ shopifyAuthConfigId: configId }, signal)
        return response.shopifyAuthConfig ? [response.shopifyAuthConfig] : []
      },
    }"
    :id-of="(config) => config.shopifyAuthConfigId"
    :missing-message="missingMessage"
    load-failed-message="This Shopify config is still out shopping."
    :facts="(config) => [
      { key: 'id', label: 'Config ID', value: config.shopifyAuthConfigId },
      { key: 'url', label: 'Shop/API URL', value: config.shopApiUrl, span: 'wide' },
      { key: 'apiVersion', label: 'API Version', value: config.apiVersion?.trim() || '2026-01' },
      { key: 'timeZone', label: 'Timezone', value: config.timeZone?.trim() || 'UTC' },
      { key: 'active', label: 'Active', value: config.isActive === 'N' ? 'No' : 'Yes', explain: 'connectionActive' },
    ]"
    :edit-route="{ name: 'settings-shopify-edit', params: { shopifyAuthConfigId: configId } }"
    edit-aria-label="Edit Shopify Config"
    delete-aria-label="Delete Shopify config"
    back-aria-label="Back to Shopify Settings"
    :remove="(shopifyAuthConfigId) => settingsFacade.deleteShopifyAuthConfig({ shopifyAuthConfigId })"
    delete-failed-message="The Shopify config would not check out. Still here."
    :diagnostics="diagnostics"
    :endpoint-list="{
      configType: SHARED_CONFIG_TYPES.shopifyAuth,
      cacheKeyPrefix: 'shopifyAuthDashboard.endpoints',
      listTestId: 'shopify-endpoint-configs',
      tileTestId: 'shopify-endpoint-tile',
    }"
    :test-ids="{
      editTestId: 'shopify-auth-edit-action',
      backTestId: 'back-shopify-auth',
      diagnoseTestId: 'diagnose-shopify-auth',
      deleteTestId: 'delete-shopify-auth',
    }"
  />
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { settingsFacade } from '../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import ConnectionDiagnosticsPopup from '../../components/settings/ConnectionDiagnosticsPopup.vue'
import { useConnectionDiagnostics } from './useConnectionDiagnostics'
import ConnectionDashboard from './ConnectionDashboard.vue'

const route = useRoute()
const diagnostics = useConnectionDiagnostics('SHOPIFY')
const configId = computed(() => String(route.params.shopifyAuthConfigId ?? '').trim())
const missingMessage = computed(() => `Shopify config "${configId.value}" checked out without us.`)
</script>
