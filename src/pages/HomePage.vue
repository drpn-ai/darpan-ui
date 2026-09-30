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

    <StaticPageSection
      v-for="group in runGroups"
      :key="group.key"
      :title="group.title"
    >
      <div
        class="static-page-drop-zone"
        :data-testid="`run-group-${group.key}`"
        @dragover.prevent
        @drop="handleDrop('other', $event)"
      >
        <div class="static-page-tile-grid">
          <RouterLink
            v-for="flow in group.visible"
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
            v-if="group.hidden > 0"
            type="button"
            class="static-page-control-tile"
            :data-testid="`run-group-${group.key}-more`"
            @click="expandedGroupKeys.add(group.key)"
          >
            {{ group.hidden }} more
          </button>
        </div>
      </div>
    </StaticPageSection>

    <StaticPageSection v-if="!hasOtherRuns" title="Other Runs">
      <div class="static-page-drop-zone static-page-drop-zone--compact" data-testid="other-runs" @dragover.prevent @drop="handleDrop('other', $event)">
        <RouterLink
          class="static-page-action-tile static-page-action-tile--inline"
          data-testid="other-runs-empty-action"
          :to="createFlowRoute"
          @click="setDashboardOrigin"
        >
          Create Run
        </RouterLink>
      </div>
    </StaticPageSection>

    <p v-if="truncatedRunCount > 0" class="static-page-section-description" data-testid="runs-truncated">
      Showing {{ savedRuns.length }} of {{ totalRunCount }} runs. Group counts cover what is shown.
    </p>

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
  groupTitle: string
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

/**
 * DAR-UI-043. Which system FAMILY a run belongs to, and therefore which section it sits in.
 *
 * systemParentLabel is the field for exactly this — "the system FAMILY an endpoint-level option
 * belongs to" (SHOPIFY_RETURN_REFS -> Shopify) — and is absent on the family enums themselves,
 * whose own label already IS the family name. So parent-or-self, never an inference from the run
 * name: "NetSuite chain — ..." happens to start with a system name today, and a title-prefix
 * grouping would silently regroup every run the moment someone renamed one.
 */
function resolveSystemFamily(savedRun: SavedRunSummary, enumId?: string): string {
  if (!enumId) return ''
  const option = savedRun.systemOptions.find((systemOption) => systemOption.enumId === enumId)
  if (!option) return ''
  return option.systemParentLabel || option.label || option.enumCode || option.enumId
}

/**
 * A single-sided run is named by the one system it interrogates; a two-sided one by the pair.
 * scopeMode is read rather than systemOptions.length, because one option is also what a BROKEN
 * two-sided run looks like — inferring would file a broken run under the wrong heading and make
 * it look deliberate.
 */
function resolveRunGroupTitle(savedRun: SavedRunSummary): string {
  const file1 = resolveSystemFamily(savedRun, savedRun.defaultFile1SystemEnumId)
  const singleSided = (savedRun.scopeMode ?? '').toUpperCase() === 'EVALUATE'
  if (singleSided) return file1 || 'Other Runs'
  const file2 = resolveSystemFamily(savedRun, savedRun.defaultFile2SystemEnumId)
  // The PAIR is the family, so the label is order-independent. Against real data the naive
  // version produced "HotWax ↔ Shopify · 1" and "Shopify ↔ Hotwax · 3" as two sections for one
  // pairing — an operator reading those sees two families and a stray, when it is four runs
  // over the same two systems. Direction still matters to a run and its own name carries it.
  if (file1 && file2) return [file1, file2].sort((a, b) => a.localeCompare(b)).join(' ↔ ')
  return file1 || file2 || 'Other Runs'
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const draftStore = useReconciliationDraftStore()
const savedRuns = ref<SavedRunSummary[]>([])
const pinnedSavedRunIds = ref<string[]>([])
// Per group, not one flag for the page: expanding NetSuite should not also expand every other
// family, which is what a single showAllOtherRuns did once there was more than one section.
const expandedGroupKeys = ref<Set<string>>(new Set())
const totalRunCount = ref(0)
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
      groupTitle: resolveRunGroupTitle(savedRun),
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

const GROUP_TILE_LIMIT = 6

interface DashboardRunGroup {
  key: string
  title: string
  visible: DashboardFlowCard[]
  hidden: number
}

/**
 * One section per system family, alphabetical.
 *
 * Alphabetical rather than by size: a count-ordered list reshuffles itself whenever a run is
 * added or pinned, so the section an operator reaches for moves under them. Order that never
 * changes is worth more here than order that is briefly more relevant.
 *
 * The count rides in the heading, which is also what answers "a group of one looks like a
 * mistake" — "OMS ↔ Shopify · 1" reads as deliberate where a lone unlabelled tile reads as a bug.
 */
const runGroups = computed<DashboardRunGroup[]>(() => {
  const byTitle = new Map<string, DashboardFlowCard[]>()
  otherFlowCards.value.forEach((card) => {
    const bucket = byTitle.get(card.groupTitle)
    if (bucket) bucket.push(card)
    else byTitle.set(card.groupTitle, [card])
  })

  return [...byTitle.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, cards]) => {
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'other'
      const expanded = expandedGroupKeys.value.has(key)
      const visible = expanded ? cards : cards.slice(0, GROUP_TILE_LIMIT)
      return {
        key,
        title: `${title} · ${cards.length}`,
        visible,
        hidden: cards.length - visible.length,
      }
    })
})

/**
 * How many runs the tenant has that this page did not fetch. Surfaced rather than swallowed: a
 * heading reading "NetSuite · 9" while the page holds a subset is a confidently wrong number,
 * and a wrong count is worse than an admitted partial one.
 */
const hasOtherRuns = computed(() => otherFlowCards.value.length > 0)

const truncatedRunCount = computed(() => Math.max(0, totalRunCount.value - savedRuns.value.length))

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

  expandedGroupKeys.value = new Set()
  totalRunCount.value = 0
  pinnedSavedRunIds.value = []
  savedRuns.value = []

  try {
    // 12 was enough while Home showed five tiles and a More.... Grouping puts a COUNT in every
    // heading, so the page has to hold the runs it is counting: gorjana alone has nine NetSuite
    // checks beside its two-sided ones. totalCount comes back regardless, so whatever is still
    // beyond this is admitted rather than mis-grouped.
    const response = await reconciliationFacade.listSavedRuns({
      pageIndex: 0,
      pageSize: 100,
      query: '',
    }, pageAbortController.signal)
    pinnedSavedRunIds.value = response.pinnedSavedRunIds ?? []
    savedRuns.value = response.savedRuns ?? []
    totalRunCount.value = response.pagination?.totalCount ?? (response.savedRuns?.length ?? 0)
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pinnedSavedRunIds.value = []
    savedRuns.value = []
    totalRunCount.value = 0
  }
}

onMounted(() => {
  void loadDashboard()
})
</script>
