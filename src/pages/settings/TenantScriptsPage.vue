<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Queries</h1>
    </template>

    <LoadingState v-if="loading" noun="queries" />
    <InlineValidation v-else-if="pageError" tone="error" :message="pageError" />
    <p v-else-if="queries.length === 0" class="section-note" data-testid="queries-empty">No queries yet.</p>

    <template v-if="queries.length > 0">
      <StaticPageSection title="Pinned Queries">
        <div class="static-page-drop-zone" data-testid="pinned-queries" @dragover.prevent @drop="handleDrop('pinned', $event)">
          <div v-if="pinnedQueries.length > 0" class="static-page-tile-grid">
            <RouterLink
              v-for="query in pinnedQueries"
              :key="query.tenantQueryId"
              class="static-page-tile"
              :data-query-id="query.tenantQueryId"
              :to="queryRoute(query.tenantQueryId)"
              draggable="true"
              @dragstart="handleDragStart(query.tenantQueryId, $event)"
            >
              <span class="static-page-tile-title">{{ query.queryName }}</span>
            </RouterLink>
          </div>
          <div v-else class="static-page-drop-hint" data-testid="pinned-empty-state">drag and drop queries to pin</div>
        </div>
      </StaticPageSection>

      <StaticPageSection v-for="group in queryGroups" :key="group.key" :title="group.title">
        <div class="static-page-drop-zone" :data-testid="`query-group-${group.key}`" @dragover.prevent @drop="handleDrop('other', $event)">
          <div class="static-page-tile-grid">
            <RouterLink
              v-for="query in group.visible"
              :key="query.tenantQueryId"
              class="static-page-tile"
              :data-query-id="query.tenantQueryId"
              :to="queryRoute(query.tenantQueryId)"
              draggable="true"
              @dragstart="handleDragStart(query.tenantQueryId, $event)"
            >
              <span class="static-page-tile-title">{{ query.queryName }}</span>
            </RouterLink>
            <button
              v-if="group.hidden > 0"
              type="button"
              class="static-page-control-tile"
              :data-testid="`query-group-${group.key}-more`"
              @click="expandedGroupKeys.add(group.key)"
            >
              {{ group.hidden }} more
            </button>
          </div>
        </div>
      </StaticPageSection>
    </template>

    <div v-if="canEdit" class="action-row">
      <RouterLink class="static-page-action-tile" data-testid="query-new" :to="{ name: 'settings-tenant-script-new' }">
        New Query
      </RouterLink>
    </div>
  </StaticPageFrame>
</template>

<script setup lang="ts">
// DAR-UI-138. /queries laid out like the Dashboard (HomePage): the user's Pinned Queries as a drop zone, then the rest as
// name-only tiles grouped by what they read. Pins are per user and per tenant; dragging saves them, reverting on failure.
import { computed, onMounted, ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { scriptFacade } from '../../lib/api/facade'
import type { TenantQuery } from '../../lib/api/scriptTypes'
import { usePermissionsStore } from '../../stores/permissions'

const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const queries = ref<TenantQuery[]>([])
const pinnedQueryIds = ref<string[]>([])
const expandedGroupKeys = ref<Set<string>>(new Set())
const loading = ref(false)
const pageError = ref('')

// In page order. A query lands by its first input's source; no read, or one this page does not know, is script only.
const READ_GROUPS = [
  { key: 'audit-findings', source: 'auditFindings', title: 'Audit findings' },
  { key: 'run-results', source: 'runResult', title: 'Run results' },
  { key: 'kept-records', source: 'dataset', title: 'Kept records' },
  { key: 'script-only', source: null, title: 'Script only' },
] as const
const SCRIPT_ONLY = READ_GROUPS[3]

const GROUP_TILE_LIMIT = 6

function readSource(readSpecJson: string | null): string | null {
  if (!readSpecJson) return null
  try {
    const source = (JSON.parse(readSpecJson) as { inputs?: Array<{ source?: unknown }> } | null)?.inputs?.[0]?.source
    return typeof source === 'string' ? source : null
  } catch {
    return null
  }
}

function queryRoute(tenantQueryId: string): RouteLocationRaw {
  return { name: 'settings-tenant-script', params: { tenantScriptId: tenantQueryId } }
}

const pinnedQueries = computed<TenantQuery[]>(() => {
  const byId = new Map(queries.value.map((query) => [query.tenantQueryId, query]))
  return pinnedQueryIds.value
    .map((tenantQueryId) => byId.get(tenantQueryId) ?? null)
    .filter((query): query is TenantQuery => query !== null)
})

const queryGroups = computed(() => {
  const pinned = new Set(pinnedQueryIds.value)
  const byKey = new Map<string, TenantQuery[]>()
  queries.value
    .filter((query) => !pinned.has(query.tenantQueryId))
    .forEach((query) => {
      const source = readSource(query.readSpecJson)
      const key = (READ_GROUPS.find((group) => group.source !== null && group.source === source) ?? SCRIPT_ONLY).key
      byKey.set(key, [...(byKey.get(key) ?? []), query])
    })
  return READ_GROUPS
    .filter((group) => byKey.has(group.key))
    .map((group) => {
      const cards = byKey.get(group.key)!
      const visible = expandedGroupKeys.value.has(group.key) ? cards : cards.slice(0, GROUP_TILE_LIMIT)
      return { key: group.key, title: group.title, visible, hidden: cards.length - visible.length }
    })
})

function handleDragStart(tenantQueryId: string, event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', tenantQueryId)
}

async function savePins(nextPinnedQueryIds: string[], previousPinnedQueryIds: string[]): Promise<void> {
  pinnedQueryIds.value = nextPinnedQueryIds
  try {
    const response = await scriptFacade.saveTenantQueryPins({ pinnedQueryIds: nextPinnedQueryIds })
    pinnedQueryIds.value = response.pinnedQueryIds ?? nextPinnedQueryIds
  } catch {
    pinnedQueryIds.value = previousPinnedQueryIds
  }
}

async function handleDrop(target: 'pinned' | 'other', event: DragEvent): Promise<void> {
  const droppedId = event.dataTransfer?.getData('text/plain')?.trim()
  if (!droppedId || !queries.value.some((query) => query.tenantQueryId === droppedId)) return

  const previousPinnedQueryIds = [...pinnedQueryIds.value]
  const rest = pinnedQueryIds.value.filter((tenantQueryId) => tenantQueryId !== droppedId)
  await savePins(target === 'pinned' ? [...rest, droppedId] : rest, previousPinnedQueryIds)
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

async function load(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    const listed = await scriptFacade.listTenantQueries()
    queries.value = listed.queries ?? []
    pinnedQueryIds.value = listed.pinnedQueryIds ?? []
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the queries.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
