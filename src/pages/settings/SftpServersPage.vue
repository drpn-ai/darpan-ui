<template>
  <StaticPageFrame>
    <template #hero>
      <h1>SFTP Servers</h1>
    </template>

    <SettingsRecordListSection
      title="Saved Servers"
      :tiles="recordTiles"
      :page-index="pageIndex"
      :page-count="pageCount"
      pager-aria-label="SFTP server pages"
      previous-test-id="sftp-page-previous"
      next-test-id="sftp-page-next"
      :loading="loading"
      loading-noun="servers"
      :error="error"
      empty-title="No SFTP servers"
      list-test-id="saved-sftp-servers"
      tile-test-id="sftp-server-tile"
      :can-create="canEditTenantSettings"
      :create-route="createRoute"
      create-label="Create New Server"
      create-test-id="sftp-create-action"
      empty-create-test-id="sftp-empty-create-action"
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
import { SETTINGS_LIST_KEYS } from '../../lib/api/queries'

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
  loadPage: (request) => settingsFacade.listSftpServers(request),
  selectRecords: (response) => response.servers ?? [],
  activeTenantUserGroupId: () => authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  fallbackErrorMessage: 'The servers are not serving today.',
  cacheKey: SETTINGS_LIST_KEYS.sftp,
})

onBeforeUnmount(() => {
  dispose()
})

const createRoute = computed(() => ({ path: '/settings/sftp/create' }))
const recordTiles = computed(() => rows.value.map((row) => ({
  key: row.sftpServerId,
  label: resolveRecordLabel({
    description: row.description,
    fallbackId: row.sftpServerId,
  }),
  to: {
    name: 'settings-sftp-edit',
    params: { sftpServerId: row.sftpServerId },
  },
})))

onMounted(() => {
  draftStore.setWorkflowOrigin('SFTP Servers', route.fullPath || '/settings/sftp')
  void load()
})
</script>
