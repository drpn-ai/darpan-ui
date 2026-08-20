<template>
  <StaticPageFrame>
    <template #hero>
      <h1>NetSuite</h1>
    </template>

    <SettingsRecordListSection
      title="Auth"
      :tiles="authTiles"
      :page-index="authPageIndex"
      :page-count="authPageCount"
      pager-aria-label="NetSuite auth pages"
      previous-test-id="netsuite-auth-page-previous"
      next-test-id="netsuite-auth-page-next"
      :loading="authLoading"
      loading-message="Loading auth configs..."
      :error="authError"
      empty-title="No auth configs"
      list-test-id="saved-auth-configs"
      tile-test-id="netsuite-auth-tile"
      :can-create="canEditTenantSettings"
      :create-route="authCreateRoute"
      create-label="Create Auth Profile"
      create-test-id="netsuite-auth-create-action"
      empty-create-test-id="netsuite-auth-create-action"
      @update:page-index="goToAuthPage"
    />

    <SettingsRecordListSection
      title="Endpoints"
      :tiles="endpointTiles"
      :page-index="endpointPageIndex"
      :page-count="endpointPageCount"
      pager-aria-label="NetSuite endpoint pages"
      previous-test-id="netsuite-endpoint-page-previous"
      next-test-id="netsuite-endpoint-page-next"
      :loading="endpointLoading"
      loading-message="Loading endpoint configs..."
      :error="endpointError"
      empty-title="No endpoint configs"
      list-test-id="saved-endpoint-configs"
      tile-test-id="netsuite-endpoint-tile"
      :can-create="canEditTenantSettings"
      :create-route="endpointCreateRoute"
      create-label="Create Endpoint"
      create-test-id="netsuite-endpoint-create-action"
      empty-create-test-id="netsuite-endpoint-create-action"
      @update:page-index="goToEndpointPage"
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
  load: loadAuthConfigs,
  goToPage: goToAuthPage,
  dispose: disposeAuthConfigs,
} = useSettingsPagedList({
  pageSize: 10,
  loadPage: (request) => settingsFacade.listNsAuthConfigs(request),
  selectRecords: (response) => response.authConfigs ?? [],
  activeTenantUserGroupId: () => authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  fallbackErrorMessage: 'Failed to load NetSuite auth configs.',
})
const {
  rows: endpointRows,
  pageIndex: endpointPageIndex,
  pageCount: endpointPageCount,
  loading: endpointLoading,
  error: endpointError,
  load: loadEndpointConfigs,
  goToPage: goToEndpointPage,
  dispose: disposeEndpointConfigs,
} = useSettingsPagedList({
  pageSize: 10,
  loadPage: (request) => settingsFacade.listNsRestletConfigs(request),
  selectRecords: (response) => response.restletConfigs ?? [],
  activeTenantUserGroupId: () => authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  fallbackErrorMessage: 'Failed to load endpoint configs.',
})

onBeforeUnmount(() => {
  disposeAuthConfigs()
  disposeEndpointConfigs()
})

const authCreateRoute = computed(() => ({ name: 'settings-netsuite-auth-create' }))
const authTiles = computed(() => authRows.value.map((row) => ({
  key: row.nsAuthConfigId,
  label: resolveRecordLabel({
    description: row.description,
    fallbackId: row.nsAuthConfigId,
  }),
  to: {
    name: 'settings-netsuite-auth-edit',
    params: { nsAuthConfigId: row.nsAuthConfigId },
  },
})))

const endpointCreateRoute = computed(() => ({ name: 'settings-netsuite-endpoints-create' }))
const endpointTiles = computed(() => endpointRows.value.map((row) => ({
  key: row.nsRestletConfigId,
  label: resolveRecordLabel({
    description: row.description,
    fallbackId: row.nsRestletConfigId,
  }),
  to: {
    name: 'settings-netsuite-endpoints-edit',
    params: { nsRestletConfigId: row.nsRestletConfigId },
  },
})))

onMounted(() => {
  draftStore.setWorkflowOrigin('NetSuite', route.fullPath || '/settings/netsuite')
  void loadAuthConfigs()
  void loadEndpointConfigs()
})
</script>
