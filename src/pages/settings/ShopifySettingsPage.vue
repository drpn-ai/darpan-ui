<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Shopify</h1>
    </template>

    <SettingsRecordListSection
      title="Saved Configs"
      :tiles="recordTiles"
      :page-index="pageIndex"
      :page-count="pageCount"
      pager-aria-label="Shopify config pages"
      previous-test-id="shopify-page-previous"
      next-test-id="shopify-page-next"
      :loading="loading"
      loading-message="Loading Shopify configs..."
      :error="error"
      empty-title="No Shopify configs"
      list-test-id="saved-shopify-configs"
      tile-test-id="shopify-auth-tile"
      :can-create="canEditTenantSettings"
      :create-route="createRoute"
      create-label="Create Shopify Config"
      create-test-id="shopify-create-action"
      empty-create-test-id="shopify-empty-create-action"
      @update:page-index="goToPage"
    />
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { settingsFacade } from '../../lib/api/facade'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import SettingsRecordListSection from './SettingsRecordListSection.vue'
import { useSettingsPagedList } from './useSettingsPagedList'

const route = useRoute()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const {
  rows,
  pageIndex,
  pageCount,
  loading,
  error,
  load,
  goToPage,
  dispose,
} = useSettingsPagedList({
  loadPage: (request) => settingsFacade.listShopifyAuthConfigs(request),
  selectRecords: (response) => response.shopifyAuthConfigs ?? [],
  activeTenantUserGroupId: () => authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  fallbackErrorMessage: 'Failed to load Shopify configs.',
})

onBeforeUnmount(() => {
  dispose()
})

const createRoute = computed(() => ({
  name: 'settings-shopify-create',
}))
const recordTiles = computed(() => rows.value.map((row) => ({
  key: row.shopifyAuthConfigId,
  label: resolveRecordLabel({
    description: row.description,
    fallbackId: row.shopifyAuthConfigId,
  }),
  to: {
    name: 'settings-shopify-auth',
    params: { shopifyAuthConfigId: row.shopifyAuthConfigId },
  },
})))

onMounted(() => {
  draftStore.setWorkflowOrigin('Shopify', route.fullPath || '/settings/shopify')
  void load()
})
</script>
