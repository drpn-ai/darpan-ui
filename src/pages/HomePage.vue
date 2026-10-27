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
            :draggable="flow.pinnable ? 'true' : 'false'"
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
            :draggable="flow.pinnable ? 'true' : 'false'"
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

    <div v-if="hasOtherRuns" class="action-row">
      <RouterLink class="static-page-action-tile" data-testid="dashboard-create-action" :to="createFlowRoute" @click="setDashboardOrigin">
        Create Run
      </RouterLink>
      <button
        v-if="canImportNetSuiteChecks"
        type="button"
        class="static-page-action-tile"
        data-testid="dashboard-import-netsuite-checks"
        :disabled="importing"
        @click="importNetSuiteChecks"
      >
        Import NetSuite Checks
      </button>
    </div>
    <InlineValidation v-if="importError" tone="error" :message="importError" data-testid="dashboard-import-error" />
    <p v-if="importResult" class="section-note" data-testid="dashboard-import-result">{{ importResult }}</p>
    <p v-for="(skip, index) in importSkips" :key="index" class="section-note" data-testid="dashboard-import-skips">{{ skip }}</p>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import StaticPageFrame from '../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../components/ui/StaticPageSection.vue'
import InlineValidation from '../components/ui/InlineValidation.vue'
import { useAuthStore, buildAuthRedirect } from '../stores/auth'
import { useReconciliationDraftStore } from '../stores/reconciliationDraft'
import { usePermissionsStore } from '../stores/permissions'
import { auditFacade, reconciliationFacade } from '../lib/api/facade'
import { cachedRead } from '../lib/api/readCache'
import { homeReconciliations, homeSavedRuns } from '../lib/api/queries'
import type { SavedRunSummary } from '../lib/api/types'
import type { FlowchartRun } from '../lib/api/flowchartTypes'
import type { AuditListItem } from '../lib/api/auditTypes'
import { RUN_TYPES } from '../lib/runTypes'
import { buildReconciliationDiffRoute } from '../lib/reconciliationRoutes'

interface DashboardFlowCard {
  id: string
  /** The id the pin preference stores. */
  savedRunId: string
  title: string
  groupTitle: string
  to: RouteLocationRaw
  /**
   * save#DashboardPinnedSavedRuns validates pins against RuleSet ids only, so a lifecycle pin
   * would be dropped server-side and silently vanish. Lifecycle tiles stay put until it widens.
   */
  pinnable: boolean
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
const permissionsStore = usePermissionsStore()
const savedRuns = ref<SavedRunSummary[]>([])
const lifecycleRuns = ref<FlowchartRun[]>([])
const audits = ref<AuditListItem[]>([])
const pinnedSavedRunIds = ref<string[]>([])
// Per group, not one flag for the page: expanding NetSuite should not also expand every other
// family, which is what a single showAllOtherRuns did once there was more than one section.
const expandedGroupKeys = ref<Set<string>>(new Set())
const totalRunCount = ref(0)
const createFlowRoute: RouteLocationRaw = { name: 'run-create' }

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
      pinnable: true,
    }
  }),
)

// DAR-UI-049. Lifecycle runs carry no system pair, so they share one section named for their type.
// Prefixed ids: Reconciliation and RuleSet are numbered independently and both start at 100000.
const lifecycleRunCards = computed<DashboardFlowCard[]>(() =>
  lifecycleRuns.value.map((run) => ({
    id: `lifecycle:${run.reconciliationId}`,
    savedRunId: `lifecycle:${run.reconciliationId}`,
    title: resolveSavedRunTitle(run.reconciliationName || run.reconciliationId),
    groupTitle: RUN_TYPES.lifecycle.label,
    to: { name: 'reconciliation-run-flowchart', params: { reconciliationId: run.reconciliationId } },
    pinnable: false,
  })),
)

// DAR-UI-058. An audit run is one tile per audit, in its type's own section, as lifecycle runs are. Not pinnable: the
// pin preference stores RuleSet ids.
const auditRunCards = computed<DashboardFlowCard[]>(() =>
  audits.value.map((audit) => ({
    id: `audit:${audit.id}`,
    savedRunId: `audit:${audit.id}`,
    title: audit.name || audit.id,
    groupTitle: RUN_TYPES.audit.label,
    to: { name: 'audit-report', params: { audit: audit.id } },
    pinnable: false,
  })),
)

const flowCards = computed<DashboardFlowCard[]>(() => [...savedRunCards.value, ...lifecycleRunCards.value, ...auditRunCards.value])

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

  // The type sections are a different axis from the system families, so they never sort in among them:
  // Audit leads (DAR-UI-082, the tenant's whole-system check is what an operator opens first), Lifecycle follows them all.
  const typeRank = (title: string): number => (title === RUN_TYPES.audit.label ? -1 : title === RUN_TYPES.lifecycle.label ? 1 : 0)
  return [...byTitle.entries()]
    .sort(([a], [b]) => typeRank(a) - typeRank(b) || a.localeCompare(b))
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
  if (!droppedCard?.pinnable) return

  const previousPinnedSavedRunIds = [...pinnedSavedRunIds.value]
  const nextPinnedSavedRunIds =
    target === 'pinned'
      ? [...pinnedSavedRunIds.value.filter((savedRunId) => savedRunId !== droppedCard.savedRunId), droppedCard.savedRunId]
      : pinnedSavedRunIds.value.filter((savedRunId) => savedRunId !== droppedCard.savedRunId)

  await savePinnedRuns(nextPinnedSavedRunIds, previousPinnedSavedRunIds)
}

// DAR-UI-048 plan 3. Offered where it can do something: an editor, on a tenant that has a NetSuite check,
// read the way import#NetSuiteChecksAsRuns reads one: a one-source run over a NETSUITE_SUITEQL source.
// Repeating it is safe; the backend adds only checks not yet in a run.
const canImportNetSuiteChecks = computed(() => permissionsStore.canEditTenantSettings && savedRuns.value.some((savedRun) =>
  (savedRun.scopeMode ?? '').toUpperCase() === 'EVALUATE'
  && savedRun.systemOptions.some((option) => option.fileSide === 'FILE_1' && option.sourceConfigType === 'NETSUITE_SUITEQL')))
const importing = ref(false)
const importResult = ref<string | null>(null)
const importSkips = ref<string[]>([])
const importError = ref<string | null>(null)

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`
}

async function importNetSuiteChecks(): Promise<void> {
  if (importing.value) return
  importing.value = true
  importResult.value = null
  importSkips.value = []
  importError.value = null
  try {
    const response = await reconciliationFacade.importNetSuiteChecksAsRuns(pageAbortController.signal)
    const imported = response.imported ?? 0
    const skipped = response.skipped ?? 0
    const outcome = imported
      ? `Imported ${plural(imported, 'check')} into ${plural(response.runs?.length ?? 0, 'run')}.`
      : 'No new NetSuite checks to import.'
    const skips = skipped ? ` ${plural(skipped, 'check')} ${skipped === 1 ? 'was' : 'were'} skipped.` : ''
    importResult.value = `${outcome}${skips}`
    importSkips.value = skipped ? (response.messages ?? []) : []
    await loadLifecycleRuns()
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    importError.value = error instanceof Error ? error.message : String(error)
  } finally {
    importing.value = false
  }
}

// Independent of the sync list: a failure here costs the Lifecycle section, never the page.
function loadLifecycleRuns(): Promise<void> {
  return cachedRead(
    homeReconciliations.key,
    () => homeReconciliations.fetch(pageAbortController.signal),
    (response) => { lifecycleRuns.value = (response.reconciliations ?? []).filter((run) => run.isArchived !== 'Y') },
  ).then(() => {}, () => { lifecycleRuns.value = [] })
}

// DAR-UI-058. Independent too: a tenant with no audits, or a failed read, costs the Audit section only.
function loadAudits(): Promise<void> {
  return auditFacade.getAudits(pageAbortController.signal)
    .then((response) => { audits.value = response.audits ?? [] }, () => { audits.value = [] })
}

function setDashboardOrigin(): void {
  draftStore.setWorkflowOrigin('Dashboard', '/')
}

async function loadDashboard(): Promise<void> {
  // DAR-UI-051: not forced. The router guard has already verified the session, and re-verifies a stale one in
  // the background; forcing get#SessionInfo here put a full round-trip in front of every Home visit.
  const authenticated = await authStore.ensureAuthenticated()
  if (!authenticated) {
    await router.replace(buildAuthRedirect(route.fullPath))
    return
  }

  expandedGroupKeys.value = new Set()
  totalRunCount.value = 0
  pinnedSavedRunIds.value = []
  savedRuns.value = []
  lifecycleRuns.value = []

  void loadLifecycleRuns()
  void loadAudits()

  try {
    // 12 was enough while Home showed five tiles and a More.... Grouping puts a COUNT in every
    // heading, so the page has to hold the runs it is counting: gorjana alone has nine NetSuite
    // checks beside its two-sided ones. totalCount comes back regardless, so whatever is still
    // beyond this is admitted rather than mis-grouped.
    await cachedRead(
      homeSavedRuns.key,
      () => homeSavedRuns.fetch(pageAbortController.signal),
      (response) => {
        pinnedSavedRunIds.value = response.pinnedSavedRunIds ?? []
        savedRuns.value = response.savedRuns ?? []
        totalRunCount.value = response.pagination?.totalCount ?? (response.savedRuns?.length ?? 0)
      },
    )
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
