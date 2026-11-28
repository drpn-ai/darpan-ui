<template>
  <StaticPageFrame>
    <template #hero>
      <h1>{{ title }}</h1>
    </template>

    <SettingsRecordListSection
      v-bind="section"
      :tiles="tiles"
      :page-index="pageIndex"
      :page-count="pageCount"
      :loading="loading"
      :error="error"
      :can-create="permissionsStore.canManageConnections"
      :create-route="createRoute"
      @update:page-index="goToPage"
    />
  </StaticPageFrame>
</template>

<script setup lang="ts" generic="T extends { description?: string | null }, R extends PaginatedSettingsResponse">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import SettingsRecordListSection from './SettingsRecordListSection.vue'
import {
  useSettingsPagedList,
  type PaginatedSettingsResponse,
  type UseSettingsPagedListOptions,
} from './useSettingsPagedList'

/**
 * One connection system's saved records (NetSuite auth, HotWax, Shopify, SFTP): a paged tile list of the active
 * tenant's rows, each opening its own page, with a create action for those who can manage connections. A system's
 * page supplies only what differs: names, the list read, the record route and the test ids.
 */
const props = defineProps<{
  /** The hero, and the label the workflow origin carries back. */
  title: string
  /** Where a workflow returns when this page has no full path. */
  listPath: string
  /** The section's static props: heading, pager label and test ids, loading noun, empty title, create label. */
  section: {
    title: string
    pagerAriaLabel: string
    previousTestId: string
    nextTestId: string
    loadingNoun: string
    emptyTitle: string
    listTestId: string
    tileTestId: string
    createLabel: string
    createTestId: string
    emptyCreateTestId: string
  }
  createRoute: RouteLocationRaw
  list: Omit<UseSettingsPagedListOptions<T, R>, 'activeTenantUserGroupId'>
  idOf: (row: T) => string
  recordRoute: (id: string) => RouteLocationRaw
}>()

const route = useRoute()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const { rows, pageIndex, pageCount, loading, error, load, goToPage, dispose } = useSettingsPagedList<T, R>({
  ...props.list,
  activeTenantUserGroupId: () => authStore.sessionInfo?.activeTenantUserGroupId ?? null,
})

const tiles = computed(() => rows.value.map((row) => {
  const id = props.idOf(row)
  return { key: id, label: resolveRecordLabel({ description: row.description, fallbackId: id }), to: props.recordRoute(id) }
}))

onMounted(() => {
  draftStore.setWorkflowOrigin(props.title, route.fullPath || props.listPath)
  void load()
})

onBeforeUnmount(dispose)
</script>
