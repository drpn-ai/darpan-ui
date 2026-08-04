<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Let's Investigate</h1>
    </template>

    <StaticPageSection title="Pinned Runs">
      <div class="static-page-drop-zone" data-testid="pinned-runs" @dragover.prevent @drop="handleDrop('pinned', $event)">
        <div v-if="pinnedFlowCards.length > 0" class="static-page-tile-grid">
          <RouterLink
            v-for="flow in pinnedFlowCards"
            :key="flow.id"
            class="static-page-tile"
            :data-flow-id="flow.id"
            :to="flow.to"
            draggable="true"
            @click="setDashboardOrigin"
            @dragstart="handleDragStart(flow.id, $event)"
          >
            <span class="static-page-tile-title">{{ flow.title }}</span>
          </RouterLink>
        </div>
        <div v-else class="static-page-drop-hint" data-testid="pinned-empty-state">drag and drop runs to pin</div>
      </div>
    </StaticPageSection>

    <StaticPageSection title="Other Runs">
      <div
        :class="['static-page-drop-zone', { 'static-page-drop-zone--compact': !hasOtherRuns }]"
        data-testid="other-runs"
        @dragover.prevent
        @drop="handleDrop('other', $event)"
      >
        <div v-if="hasOtherRuns" class="static-page-tile-grid">
          <RouterLink
            v-for="flow in visibleOtherFlowCards"
            :key="flow.id"
            class="static-page-tile"
            :data-flow-id="flow.id"
            :to="flow.to"
            draggable="true"
            @click="setDashboardOrigin"
            @dragstart="handleDragStart(flow.id, $event)"
          >
            <span class="static-page-tile-title">{{ flow.title }}</span>
          </RouterLink>
          <button
            v-if="hasMoreOtherRuns"
            type="button"
            class="static-page-control-tile"
            data-testid="other-runs-more"
            @click="showAllOtherRuns = true"
          >
            More...
          </button>
        </div>
        <RouterLink
          v-else
          class="static-page-action-tile static-page-action-tile--inline"
          data-testid="other-runs-empty-action"
          :to="createFlowRoute"
          @click="setDashboardOrigin"
        >
          Create Run
        </RouterLink>
      </div>
    </StaticPageSection>

    <RouterLink v-if="hasOtherRuns" class="static-page-action-tile" data-testid="dashboard-create-action" :to="createFlowRoute" @click="setDashboardOrigin">
      Create Run
    </RouterLink>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import StaticPageFrame from '../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../components/ui/StaticPageSection.vue'
import { useAuthStore, buildAuthRedirect } from '../stores/auth'
import { useReconciliationDraftStore } from '../stores/reconciliationDraft'
import { reconciliationFacade } from '../lib/api/facade'
import type { SavedRunSummary } from '../lib/api/types'
import { buildReconciliationDiffRoute } from '../lib/reconciliationRoutes'

interface DashboardFlowCard {
  id: string
  savedRunId: string
  title: string
  to: RouteLocationRaw
}

const savedRunTitleOverrides: Record<string, string> = {
  API: 'API',
  CSV: 'CSV',
  GL: 'GL',
  ID: 'ID',
  JSON: 'JSON',
  LLM: 'LLM',
  NETSUITE: 'NetSuite',
  OMS: 'HotWax',
  PWA: 'PWA',
  SAPI: 'SAPI',
  SFTP: 'SFTP',
  SKU: 'SKU',
  SQL: 'SQL',
  UI: 'UI',
  URL: 'URL',
}

function titleizeSavedRunToken(token: string): string {
  const override = savedRunTitleOverrides[token]
  if (override) return override
  return token.charAt(0) + token.slice(1).toLowerCase()
}

function resolveSavedRunTitle(runName: string): string {
  const trimmed = runName.trim().replace(/\s+/g, ' ')
  if (!trimmed || /[a-z]/.test(trimmed)) return trimmed
  if (!/[A-Z]/.test(trimmed)) return trimmed
  return trimmed.split(' ').map(titleizeSavedRunToken).join(' ')
}

function resolveSystemLabel(savedRun: SavedRunSummary, enumId?: string): string {
  if (!enumId) return ''
  const option = savedRun.systemOptions.find((systemOption) => systemOption.enumId === enumId)
  return option?.label || option?.description || option?.enumCode || option?.enumId || ''
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const draftStore = useReconciliationDraftStore()
const savedRuns = ref<SavedRunSummary[]>([])
const pinnedSavedRunIds = ref<string[]>([])
const showAllOtherRuns = ref(false)
const createFlowRoute: RouteLocationRaw = { name: 'reconciliation-create' }

const pageAbortController = new AbortController()

onBeforeUnmount(() => {
  pageAbortController.abort()
})

const savedRunCards = computed<DashboardFlowCard[]>(() =>
  savedRuns.value.map((savedRun) => {
    const title = resolveSavedRunTitle(savedRun.runName)
    return {
      id: `saved-run:${savedRun.savedRunId}`,
      savedRunId: savedRun.savedRunId,
      title,
      to: buildReconciliationDiffRoute(
        {
          savedRunId: savedRun.savedRunId,
          runName: title,
          file1SystemLabel: resolveSystemLabel(savedRun, savedRun.defaultFile1SystemEnumId),
          file2SystemLabel: resolveSystemLabel(savedRun, savedRun.defaultFile2SystemEnumId),
        },
      ),
    }
  }),
)

const flowCards = computed<DashboardFlowCard[]>(() => savedRunCards.value)

const pinnedFlowCards = computed<DashboardFlowCard[]>(() => {
  const flowCardMap = new Map(flowCards.value.map((card) => [card.savedRunId, card]))
  return pinnedSavedRunIds.value
    .map((savedRunId) => flowCardMap.get(savedRunId) ?? null)
    .filter((card): card is DashboardFlowCard => card !== null)
})

const otherFlowCards = computed<DashboardFlowCard[]>(() => {
  const pinnedSet = new Set(pinnedSavedRunIds.value)
  return flowCards.value.filter((card) => !pinnedSet.has(card.savedRunId))
})

const visibleOtherFlowCards = computed<DashboardFlowCard[]>(() => {
  return showAllOtherRuns.value ? otherFlowCards.value : otherFlowCards.value.slice(0, 5)
})

const hasMoreOtherRuns = computed(() => {
  return otherFlowCards.value.length > 5 && !showAllOtherRuns.value
})

const hasOtherRuns = computed(() => otherFlowCards.value.length > 0)

function handleDragStart(flowId: string, event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', flowId)
}

async function savePinnedRuns(nextPinnedSavedRunIds: string[], previousPinnedSavedRunIds: string[]): Promise<void> {
  pinnedSavedRunIds.value = nextPinnedSavedRunIds

  try {
    const response = await reconciliationFacade.saveDashboardPinnedSavedRuns({
      pinnedSavedRunIds: nextPinnedSavedRunIds,
    })
    pinnedSavedRunIds.value = response.pinnedSavedRunIds ?? nextPinnedSavedRunIds
  } catch {
    pinnedSavedRunIds.value = previousPinnedSavedRunIds
  }
}

async function handleDrop(target: 'pinned' | 'other', event: DragEvent): Promise<void> {
  const droppedFlowId = event.dataTransfer?.getData('text/plain')?.trim()
  if (!droppedFlowId) return
  const droppedCard = flowCards.value.find((card) => card.id === droppedFlowId)
  if (!droppedCard) return

  const previousPinnedSavedRunIds = [...pinnedSavedRunIds.value]
  const nextPinnedSavedRunIds =
    target === 'pinned'
      ? [...pinnedSavedRunIds.value.filter((savedRunId) => savedRunId !== droppedCard.savedRunId), droppedCard.savedRunId]
      : pinnedSavedRunIds.value.filter((savedRunId) => savedRunId !== droppedCard.savedRunId)

  await savePinnedRuns(nextPinnedSavedRunIds, previousPinnedSavedRunIds)
}

function setDashboardOrigin(): void {
  draftStore.setWorkflowOrigin('Dashboard', '/')
}

async function loadDashboard(): Promise<void> {
  const authenticated = await authStore.ensureAuthenticated(true)
  if (!authenticated) {
    await router.replace(buildAuthRedirect(route.fullPath))
    return
  }

  showAllOtherRuns.value = false
  pinnedSavedRunIds.value = []
  savedRuns.value = []

  try {
    const response = await reconciliationFacade.listSavedRuns({
      pageIndex: 0,
      pageSize: 12,
      query: '',
    }, pageAbortController.signal)
    pinnedSavedRunIds.value = response.pinnedSavedRunIds ?? []
    savedRuns.value = response.savedRuns ?? []
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pinnedSavedRunIds.value = []
    savedRuns.value = []
  }
}

onMounted(() => {
  void loadDashboard()
})
</script>
