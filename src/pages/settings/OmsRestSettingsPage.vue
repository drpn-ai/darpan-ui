<template>
  <StaticPageFrame>
    <template #hero>
      <h1>HotWax</h1>
    </template>

    <SettingsRecordListSection
      title="Auth"
      :tiles="authTiles"
      :page-index="authPageIndex"
      :page-count="authPageCount"
      pager-aria-label="HotWax auth pages"
      previous-test-id="oms-auth-page-previous"
      next-test-id="oms-auth-page-next"
      :loading="authLoading"
      loading-message="Loading auth configs..."
      :error="authError"
      empty-title="No auth configs"
      list-test-id="saved-oms-auth-configs"
      tile-test-id="oms-auth-tile"
      :can-create="canEditTenantSettings"
      :create-route="authCreateRoute"
      create-label="Create Auth Profile"
      create-test-id="oms-auth-create-action"
      empty-create-test-id="oms-auth-create-action"
      @update:page-index="goToAuthPage"
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
  rows: authRows,
  pageIndex: authPageIndex,
  pageCount: authPageCount,
  loading: authLoading,
  error: authError,
  load,
  goToPage: goToAuthPage,
  dispose,
} = useSettingsPagedList({
  loadPage: (request) => settingsFacade.listOmsRestSourceConfigs(request),
  selectRecords: (response) => response.omsRestSourceConfigs ?? [],
  activeTenantUserGroupId: () => authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  fallbackErrorMessage: 'Failed to load HotWax auth configs.',
})

onBeforeUnmount(() => {
  dispose()
})

const authCreateRoute = computed(() => ({
  name: 'settings-oms-create',
}))
const authTiles = computed(() => authRows.value.map((row) => ({
  key: row.omsRestSourceConfigId,
  label: resolveRecordLabel({
    description: row.description,
    fallbackId: row.omsRestSourceConfigId,
  }),
  to: {
    name: 'settings-oms-auth',
    params: { omsRestSourceConfigId: row.omsRestSourceConfigId },
  },
})))

onMounted(() => {
  draftStore.setWorkflowOrigin('HotWax', route.fullPath || '/settings/hotwax')
  void load()
})
</script>
