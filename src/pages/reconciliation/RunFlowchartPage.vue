<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': Boolean(editing) }">
    <template #hero>
      <h1>{{ run?.reconciliationName || 'Run' }}</h1>
      <RunTypeBadge v-if="run" type="lifecycle" :detail="typeDetail" />
      <p v-if="shownStarted" class="static-page-section-description" data-testid="flowchart-shown-started">{{ shownStarted }}</p>
    </template>

    <p v-if="loading" class="section-note">Loading run...</p>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="flowchart-page-error" />

    <template v-if="run">
      <StaticPageSection v-if="summary" title="This Run">
        <div class="static-page-summary-grid">
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Status</span>
            <span data-testid="flowchart-summary-status"><StatusBadge :label="summary.status.label" :tone="summary.status.tone" /></span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Window</span>
            <span data-testid="flowchart-summary-window">{{ summary.window }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">{{ isStages ? 'Stages' : 'Questions' }}</span>
            <span>{{ summary.questions }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Findings</span>
            <span data-testid="flowchart-summary-findings">{{ summary.findings }}</span>
          </article>
        </div>
        <InlineValidation v-for="reason in failureReasons" :key="reason" tone="error" :message="reason" data-testid="flowchart-failure" />
        <p v-if="pollCeilingHit" class="section-note" data-testid="flowchart-poll-ceiling">Still waiting on this run. Check its questions below.</p>
      </StaticPageSection>

      <StaticPageSection v-if="isStages && isResult" title="Where Records Stopped">
        <LifecycleBoard :board="board" :narrow="narrow" :can-open="canOpenPlace" @open="openPlace" />
      </StaticPageSection>
      <StaticPageSection v-else-if="!isStages" title="Questions">
        <RunFlowchartBoard
          :questions="questions"
          :rule-names="ruleNames"
          :editable="!running"
          :narrow="narrow"
          :selected-id="editing?.questionId ?? null"
          :states="states"
          :openable-findings="openableFindings"
          @select="openExisting"
          @open-finding="openFinding"
          @add-next="(id) => openNew(id, 'YES')"
          @add-why="(id) => openNew(id, 'NO')"
        />
        <button
          v-if="!hasStart && !running"
          type="button"
          class="static-page-action-tile static-page-action-tile--inline"
          data-testid="flowchart-add-top"
          @click="openNew(null, null)"
        >
          Add Question
        </button>
      </StaticPageSection>



      <StaticPageSection v-if="questionRuns.length && !isStages" title="Question Runs">
        <div class="static-page-tile-grid static-page-record-grid">
          <RouterLink
            v-for="item in questionRuns"
            :key="item.questionId"
            :to="item.to"
            class="static-page-tile static-page-list-tile static-page-record-tile"
            :data-testid="`flowchart-live-link-${item.questionId}`"
          >
            <span class="static-page-list-tile__title">{{ item.title }}</span>
            <span class="static-page-list-tile__meta">{{ item.meta }}</span>
          </RouterLink>
        </div>
      </StaticPageSection>

      <!-- A run's own page is its results, as a Sync run's is: in progress, the most recent, then the ones before.
           A run's result page shows that run alone. Every tile is one link. -->
      <template v-if="!isResult">
        <StaticPageSection v-if="activeTiles.length" title="In Progress">
          <div class="static-page-tile-grid run-history-grid" data-testid="flowchart-history-running">
            <RouterLink
              v-for="tile in activeTiles"
              :key="tile.id"
              :to="tile.to"
              class="static-page-tile run-history-tile"
              :data-testid="`flowchart-history-tile-${tile.id}`"
            >
              <div class="run-history-tile__head run-history-tile__head--status">
                <span class="static-page-tile-title">{{ tile.started }}</span>
                <StatusBadge :label="tile.status.label" :tone="tile.status.tone" />
              </div>
              <dl class="run-history-metrics">
                <div><dt>Days</dt><dd>{{ tile.window }}</dd></div>
              </dl>
            </RouterLink>
          </div>
        </StaticPageSection>

        <StaticPageSection title="Most Recent">
          <RouterLink
            v-if="mostRecent"
            :to="mostRecent.to"
            class="static-page-tile run-history-tile run-history-featured-tile"
            data-testid="flowchart-history-featured"
          >
            <div class="run-history-tile__head" :class="{ 'run-history-tile__head--status': mostRecent.status.label !== 'Done' }">
              <span class="static-page-tile-title">{{ mostRecent.started }}</span>
              <StatusBadge v-if="mostRecent.status.label !== 'Done'" :label="mostRecent.status.label" :tone="mostRecent.status.tone" />
            </div>
            <dl class="run-history-metrics run-history-metrics--featured">
              <div v-for="metric in metricsOf(mostRecent.id)" :key="metric.label"><dt>{{ metric.label }}</dt><dd>{{ metric.value }}</dd></div>
            </dl>
          </RouterLink>
          <div v-else class="static-page-drop-hint" data-testid="flowchart-history-empty">Not run yet.</div>
        </StaticPageSection>

        <StaticPageSection v-if="previousTiles.length" title="Previous Results">
          <div class="static-page-tile-grid run-history-grid" data-testid="flowchart-history">
            <RouterLink
              v-for="tile in previousTiles"
              :key="tile.id"
              :to="tile.to"
              class="static-page-tile run-history-tile"
              :data-testid="`flowchart-history-tile-${tile.id}`"
            >
              <div class="run-history-tile__head" :class="{ 'run-history-tile__head--status': tile.status.label !== 'Done' }">
                <span class="static-page-tile-title">{{ tile.started }}</span>
                <StatusBadge v-if="tile.status.label !== 'Done'" :label="tile.status.label" :tone="tile.status.tone" />
              </div>
              <dl class="run-history-metrics">
                <div v-for="metric in metricsOf(tile.id)" :key="metric.label"><dt>{{ metric.label }}</dt><dd>{{ metric.value }}</dd></div>
              </dl>
            </RouterLink>
            <button
              v-if="hasMorePrevious"
              type="button"
              class="static-page-control-tile run-history-more-tile"
              data-testid="flowchart-history-more"
              @click="previousShown += HISTORY_PAGE"
            >
              More...
            </button>
          </div>
        </StaticPageSection>
      </template>
    </template>


    <template #actions>
      <div class="action-row">
        <RouterLink
          v-if="isResult"
          :to="{ name: 'reconciliation-run-flowchart', params: { reconciliationId } }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to run"
          data-testid="flowchart-back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
        <RouterLink
          v-if="!running && questions.length"
          :to="{ name: 'reconciliation-run-flowchart-start', params: { reconciliationId } }"
          class="app-icon-action app-icon-action--large"
          aria-label="Open run"
          title="Open run"
          data-testid="flowchart-run-button"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
          </svg>
        </RouterLink>
        <button v-else type="button" class="app-icon-action app-icon-action--large" aria-label="Open run" title="Open run" disabled data-testid="flowchart-run-button">
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
          </svg>
        </button>
        <!-- DAR-UI-050. As a Sync run's page: settings beside play. Rules are set up there, never on this page. -->
        <RouterLink
          v-if="isStages"
          :to="{ name: 'reconciliation-run-flowchart-settings', params: { reconciliationId } }"
          class="app-icon-action app-icon-action--large"
          aria-label="Run settings"
          title="Run settings"
          data-testid="flowchart-settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path :d="settingsIconPath" />
          </svg>
        </RouterLink>
      </div>
    </template>
  </StaticPageFrame>

  <!-- Outside the frame, as ShopifyAuthDashboardPage renders its popup: the frame blurs, the popup must not. -->
  <FlowchartQuestionEditor
    v-if="editing"
    :rules="rules"
    :draft="editing.draft"
    :heading="editing.heading"
    :can-delete="Boolean(editing.questionId) && !editing.isStart"
    :is-start="editing.isStart"
    :error="editorError"
    :busy="saving"
    @save="saveEditing"
    @delete="deleteEditing"
    @cancel="closeEditor"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import FlowchartQuestionEditor, { type FlowchartQuestionDraft } from '../../components/reconciliation/FlowchartQuestionEditor.vue'
import LifecycleBoard from '../../components/reconciliation/LifecycleBoard.vue'
import RunFlowchartBoard from '../../components/reconciliation/RunFlowchartBoard.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import RunTypeBadge from '../../components/ui/RunTypeBadge.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import type {
  FlowchartBranch, FlowchartExecutionRow, FlowchartExecutionSummary, FlowchartQuestion, FlowchartRun,
} from '../../lib/api/flowchartTypes'
import type { SavedRunSummary } from '../../lib/api/types'
import { walkableQuestionIds } from '../../lib/flowchart/flowchartLayout'
import {
  isExecutionDone, POLL_INTERVAL_MS, questionStates, shouldKeepPolling,
} from '../../lib/flowchart/flowchartRunState'
import { backIconPath, playIconPath, playIconTransform, settingsIconPath } from '../../lib/iconPaths'
import { buildReconciliationRunLiveRoute, buildReconciliationRunResultRoute } from '../../lib/reconciliationRoutes'
import { lifecycleBoard, type LifecyclePlace } from '../../lib/lifecycleBoard'
import { lookBackLabel, questionCountLabel } from '../../lib/runTypes'
import { addDays, displayCalendarDayOf, formatDateTime } from '../../lib/utils/date'

// DAR-UI-048. One run's chart, on a static board: build it from existing rules (spec A7), run it over a
// look-back window, and follow each question. Editing opens the design system's static-page popup.
const route = useRoute()
const router = useRouter()
const reconciliationId = computed(() => String(route.params.reconciliationId ?? ''))
// With an execution in the route this is that run's result; without one it is the run's page and its history.
const isResult = computed(() => Boolean(route.params.reconciliationExecutionId))

const run = ref<FlowchartRun | null>(null)
const questions = ref<FlowchartQuestion[]>([])
// The START rule is drawn as the start box, not asked as a question, so it is not counted.
const typeDetail = computed(() => {
  const what = isStages.value
    ? `${board.value.stages.length} ${board.value.stages.length === 1 ? 'stage' : 'stages'}`
    : questionCountLabel(questions.value.filter((q) => q.questionRole !== 'START').length)
  return `${what} · ${lookBackLabel(run.value?.defaultTimeWindow)}`
})
const rules = ref<SavedRunSummary[]>([])
const loading = ref(true)
const pageError = ref<string | null>(null)
const editorError = ref<string | null>(null)
const saving = ref(false)
const narrow = ref(false)
const executionRows = ref<FlowchartExecutionRow[]>([])
const running = ref(false)
const pollCeilingHit = ref(false)
// Plan 3: the execution on screen (from the route, or one just started here), and the run's past ones.
const activeExecutionId = ref<string | null>(null)
const executions = ref<FlowchartExecutionSummary[]>([])
let pollTimer: ReturnType<typeof setTimeout> | null = null
let unmounted = false
let mediaQuery: MediaQueryList | null = null

interface Editing { questionId: string | null; parentId: string | null; branch: FlowchartBranch | null; heading: string; isStart: boolean; draft: FlowchartQuestionDraft }
const editing = ref<Editing | null>(null)

const ruleNames = computed(() => Object.fromEntries(rules.value.map((r) => [r.savedRunId, r.runName || r.savedRunId])))
const walkable = computed(() => walkableQuestionIds(questions.value))
const hasStart = computed(() => questions.value.some((q) => q.questionRole === 'START'))
const states = computed(() => (executionRows.value.length || running.value ? questionStates(walkable.value, executionRows.value) : undefined))

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const countFormat = new Intl.NumberFormat('en-US')
// DAR-UI-050. A lifecycle built from stages shows where records stopped. Its window is chosen when it runs
// (RunFlowchartStartPage), as a Sync run's is.
const isStages = computed(() => run.value?.buildMode === 'STAGES')
const board = computed(() => lifecycleBoard(questions.value, executionRows.value))

const STATE_WORDS: Record<string, string> = {
  waiting: 'Waiting', running: 'Running', done: 'Done', nothing: 'Nothing to ask', failed: 'Failed', 'not-run': 'Not run', cancelled: 'Cancelled',
}

function labelOf(id: string): string {
  const q = questions.value.find((x) => x.reconciliationRunId === id)
  return q?.runName?.trim() || ruleNames.value[q?.ruleSetId ?? ''] || id
}

// Every question that has a row links to its run, finished ones too: a failed question's cause is there (review I6).
const questionRuns = computed(() => {
  const s = states.value
  if (!s) return []
  return walkable.value.filter((id) => s[id]?.row).map((id) => {
    const q = questions.value.find((x) => x.reconciliationRunId === id)!
    const entry = s[id]!
    const row = entry.row!
    const counts = typeof row.yesCount === 'number' ? ` · yes ${countFormat.format(row.yesCount)} · no ${countFormat.format(row.noCount ?? 0)}` : ''
    const reason = row.errorMessage?.trim() && ['failed', 'not-run', 'cancelled'].includes(entry.state) ? ` · ${row.errorMessage.trim()}` : ''
    return {
      questionId: id,
      title: labelOf(id),
      meta: `${STATE_WORDS[entry.state] ?? entry.state}${counts}${reason}`,
      to: resultRouteFor(id) ?? fromHere(buildReconciliationRunLiveRoute(routeContextFor(q, id), row.reconciliationRunResultId)),
    }
  })
})

function routeContextFor(q: FlowchartQuestion, id: string) {
  return { savedRunId: q.ruleSetId, runName: labelOf(id), file1SystemLabel: '', file2SystemLabel: '' }
}

// A finished question's records live in its result file; one still going (or never reached) has none yet.
function resultRouteFor(id: string): RouteLocationRaw | null {
  const entry = states.value?.[id]
  const path = entry?.row?.resultDataManagerPath?.trim()
  const q = questions.value.find((x) => x.reconciliationRunId === id)
  if (!q || !path || !entry || entry.state === 'waiting' || entry.state === 'running') return null
  return fromHere(buildReconciliationRunResultRoute(routeContextFor(q, id), path))
}

// A question's result names this run, so its page leads back here rather than to the check behind it.
function fromHere(to: RouteLocationRaw): RouteLocationRaw {
  if (typeof to === 'string' || !('query' in to)) return to
  return { ...to, query: { ...to.query, fromLifecycle: reconciliationId.value, ...(activeExecutionId.value ? { fromLifecycleRun: activeExecutionId.value } : {}) } }
}

// A "no" place's records are its question's result rows; a "yes" place is only a count.
function canOpenPlace(place: LifecyclePlace): boolean {
  return place.branch === 'NO' && (place.count ?? 0) > 0 && Boolean(resultRouteFor(place.questionId))
}
function openPlace(place: LifecyclePlace) { if (canOpenPlace(place)) openFinding(place.questionId) }

const openableFindings = computed(() =>
  walkable.value.filter((id) => questions.value.find((q) => q.reconciliationRunId === id)?.questionRole !== 'START' && resultRouteFor(id)))

function openFinding(id: string) {
  const to = resultRouteFor(id)
  if (to) void router.push(to)
}

const ACTIVE_STATUSES = ['AUT_STAT_PENDING', 'AUT_STAT_RUNNING']
const STATUS_TONES: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  Done: 'success', Failed: 'danger', Cancelled: 'warning', Running: 'neutral',
}
// The backend's rollup (RunFlowchartSupport.rollupStatus), in words: running, then cancelled, then failed.
function rollupWord(statuses: Array<string | null | undefined>): string {
  if (statuses.some((st) => ACTIVE_STATUSES.includes(st ?? ''))) return 'Running'
  if (statuses.includes('AUT_STAT_CANCELLED')) return 'Cancelled'
  if (statuses.includes('AUT_STAT_FAILED')) return 'Failed'
  return 'Done'
}

function windowText(start?: string | number | null, endExclusive?: string | number | null): string {
  if (start == null || endExclusive == null) return '-'
  const first = displayCalendarDayOf(new Date(start))
  const last = addDays(displayCalendarDayOf(new Date(endExclusive)), -1)
  return `${dateFormat.format(first)} – ${dateFormat.format(last)}`
}

// The run's own page: every past run as a tile, newest first, each opening that run's result.
const HISTORY_PAGE = 6
const previousShown = ref(HISTORY_PAGE)
const historyTiles = computed(() => executions.value.map((e) => {
  const word = rollupWord([e.statusEnumId])
  return {
    id: e.reconciliationExecutionId,
    active: word === 'Running',
    started: formatDateTime(e.startedDate, { locale: 'en-US' }),
    window: windowText(e.windowStartDate, e.windowEndDate),
    status: { label: word, tone: STATUS_TONES[word] ?? 'neutral' },
    to: { name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value, reconciliationExecutionId: e.reconciliationExecutionId } },
  }
}))
const activeTiles = computed(() => historyTiles.value.filter((t) => t.active))
const settledTiles = computed(() => historyTiles.value.filter((t) => !t.active))
const mostRecent = computed(() => settledTiles.value[0] ?? null)
const previousTiles = computed(() => settledTiles.value.slice(1, 1 + previousShown.value))
const hasMorePrevious = computed(() => settledTiles.value.length - 1 > previousShown.value)

// Each tile's figures come from that run's rows, fetched once per tile shown.
const tileRows = ref<Record<string, FlowchartExecutionRow[]>>({})
const tileRowsAsked = new Set<string>()
watch(() => (isResult.value ? [] : [mostRecent.value, ...previousTiles.value].filter(Boolean).map((t) => t!.id)), (ids) => {
  for (const id of ids) {
    if (tileRowsAsked.has(id)) continue
    tileRowsAsked.add(id)
    void reconciliationFacade.getReconciliationExecution({ reconciliationExecutionId: id })
      .then(({ results }) => { if (!unmounted) tileRows.value = { ...tileRows.value, [id]: results ?? [] } })
      .catch(() => { /* a tile without figures still opens its run */ })
  }
})

/**
 * A run's findings: a lifecycle's are its places' records (each record is in one), a chart's its "no" counts.
 * Null when nothing on today's chart has a count in it: a run over stages since reordered has no figure to show.
 */
function findingsOf(rows: FlowchartExecutionRow[]): number | null {
  if (isStages.value) {
    const counts = lifecycleBoard(questions.value, rows).stages.flatMap((st) => st.places).map((p) => p.count).filter((n): n is number => n !== null)
    return counts.length ? counts.reduce((a, b) => a + b, 0) : null
  }
  const starts = new Set(questions.value.filter((q) => q.questionRole === 'START').map((q) => q.reconciliationRunId))
  const asked = rows.filter((r) => !starts.has(r.reconciliationRunId ?? '') && typeof r.noCount === 'number')
  return asked.length ? asked.reduce((sum, r) => sum + (r.noCount ?? 0), 0) : null
}

function figure(n: number | null | undefined): string { return n == null ? '-' : countFormat.format(n) }

// As a Sync run's tile: its findings, then (a lifecycle) how many went the whole way, then its days.
function metricsOf(id: string): Array<{ label: string; value: string }> {
  const rows = tileRows.value[id]
  const tile = historyTiles.value.find((t) => t.id === id)
  const complete = isStages.value && rows ? lifecycleBoard(questions.value, rows).complete : null
  return [
    { label: 'Findings', value: rows ? figure(findingsOf(rows)) : '-' },
    ...(isStages.value ? [{ label: complete?.label ?? 'Complete', value: figure(complete?.count) }] : []),
    { label: 'Days', value: tile?.window ?? '-' },
  ]
}

// Why the run on screen failed, once per distinct reason (a chart also lists them per question below).
const failureReasons = computed(() => [...new Set(executionRows.value
  .filter((r) => r.statusEnumId === 'AUT_STAT_FAILED' && r.errorMessage?.trim())
  .map((r) => r.errorMessage!.trim()))])

// As the run result page does: the run on screen is named by when it started, under the title.
const shownStarted = computed(() => {
  const listed = executions.value.find((e) => e.reconciliationExecutionId === activeExecutionId.value)
  return listed?.startedDate ? formatDateTime(listed.startedDate, { locale: 'en-US' }) : null
})

const summary = computed(() => {
  if (!activeExecutionId.value || !states.value) return null
  const word = running.value ? 'Running' : rollupWord(executionRows.value.map((r) => r.statusEnumId))
  const listed = executions.value.find((e) => e.reconciliationExecutionId === activeExecutionId.value)
  const starts = new Set(questions.value.filter((q) => q.questionRole === 'START').map((q) => q.reconciliationRunId))
  return {
    status: { label: word, tone: STATUS_TONES[word] ?? 'neutral' },
    window: listed ? windowText(listed.windowStartDate, listed.windowEndDate) : '-',
    questions: countFormat.format(isStages.value ? board.value.stages.length : walkable.value.filter((id) => !starts.has(id)).length),
    findings: figure(findingsOf(executionRows.value)),
  }
})

function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }

async function load() {
  pageError.value = null
  try {
    const [got, saved] = await Promise.all([
      reconciliationFacade.getReconciliation({ reconciliationId: reconciliationId.value }),
      rules.value.length ? Promise.resolve(null) : reconciliationFacade.listSavedRuns({ pageIndex: 0, pageSize: 200 }),
    ])
    run.value = got.reconciliation
    questions.value = got.questions ?? []
    if (saved) rules.value = saved.savedRuns ?? []
  } catch (error) {
    pageError.value = message(error)
  } finally {
    loading.value = false
  }
}

function openExisting(id: string) {
  const q = questions.value.find((x) => x.reconciliationRunId === id)
  if (!q) return
  editorError.value = null
  editing.value = { questionId: id, parentId: q.parentReconciliationRunId ?? null, branch: q.parentBranch ?? null, heading: labelOf(id),
    isStart: q.questionRole === 'START',
    draft: { ruleSetId: q.ruleSetId, runName: q.runName ?? '', noOutcomeLabel: q.noOutcomeLabel ?? '' } }
}

function openNew(parentId: string | null, branch: FlowchartBranch | null) {
  editorError.value = null
  const heading = parentId ? `${branch === 'YES' ? 'After yes on' : 'After no on'}: ${labelOf(parentId)}` : 'New Question'
  editing.value = { questionId: null, parentId, branch, heading, isStart: false, draft: { ruleSetId: '', runName: '', noOutcomeLabel: '' } }
}

function closeEditor() { editing.value = null; editorError.value = null }

async function saveEditing(draft: FlowchartQuestionDraft) {
  const e = editing.value
  if (!e) return
  const existing = e.questionId ? questions.value.find((x) => x.reconciliationRunId === e.questionId) : undefined
  saving.value = true
  editorError.value = null
  try {
    await reconciliationFacade.saveReconciliationQuestion({
      reconciliationId: reconciliationId.value,
      ...(e.questionId ? { reconciliationRunId: e.questionId } : {}),
      ruleSetId: draft.ruleSetId,
      runName: draft.runName,
      noOutcomeLabel: draft.noOutcomeLabel,
      ...(e.parentId ? { parentReconciliationRunId: e.parentId, parentBranch: e.branch ?? 'YES' } : {}),
      ...(existing?.questionRole ? { questionRole: existing.questionRole } : {}),
      ...(existing?.runSequence != null ? { runSequence: existing.runSequence } : {}),
      ...(existing?.isActive ? { isActive: existing.isActive } : {}),
    })
    closeEditor()
    await load()
  } catch (error) {
    editorError.value = message(error)
  } finally {
    saving.value = false
  }
}

async function deleteEditing() {
  const id = editing.value?.questionId
  if (!id) return
  saving.value = true
  editorError.value = null
  try {
    await reconciliationFacade.deleteReconciliationQuestion({ reconciliationRunId: id })
    closeEditor()
    await load()
  } catch (error) {
    editorError.value = message(error)
  } finally {
    saving.value = false
  }
}

function stopPolling() { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null } }

async function loadExecutions() {
  try {
    const response = await reconciliationFacade.listReconciliationExecutions({ reconciliationId: reconciliationId.value })
    if (!unmounted) executions.value = response?.executions ?? []
  } catch {
    // History is a convenience: failing to list it costs the picker, never the chart.
    executions.value = []
  }
}

/**
 * Polls one execution until it is over. A run started here is over when every question on the chart has
 * finished. A past one is over when no row is still active: questions added to the chart since it ran
 * have no row in it and never will, so "every question finished" would poll it to the ceiling.
 */
function followExecution(executionId: string, startedHere: boolean) {
  stopPolling()
  running.value = true
  pollCeilingHit.value = false
  const startedAt = Date.now()
  const isOver = () => (startedHere
    ? isExecutionDone(walkable.value, executionRows.value)
    : executionRows.value.length > 0 && !executionRows.value.some((r) => ACTIVE_STATUSES.includes(r.statusEnumId ?? '')))
  // A timeout chain, not an interval: the next poll is scheduled only after this one answered, so a slow
  // response can never land after a newer one and leave a question stuck on "running" (review I4).
  const poll = async () => {
    if (unmounted || activeExecutionId.value !== executionId) return
    try {
      const { results } = await reconciliationFacade.getReconciliationExecution({ reconciliationExecutionId: executionId })
      if (unmounted || activeExecutionId.value !== executionId) return
      executionRows.value = results ?? []
      // A run just started is not in the history yet; fetch it once it has rows, so its row and window show.
      if (executionRows.value.length && !executions.value.some((e) => e.reconciliationExecutionId === executionId)) void loadExecutions()
    } catch (error) {
      pageError.value = message(error)
    }
    const done = isOver()
    if (!shouldKeepPolling(startedAt, Date.now(), done)) {
      pollTimer = null
      running.value = false
      pollCeilingHit.value = !done
      void loadExecutions()
      return
    }
    pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
  }
  pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
}

async function loadExecution(executionId: string) {
  stopPolling()
  running.value = false
  pollCeilingHit.value = false
  activeExecutionId.value = executionId
  executionRows.value = []
  try {
    const { results } = await reconciliationFacade.getReconciliationExecution({ reconciliationExecutionId: executionId })
    if (unmounted || activeExecutionId.value !== executionId) return
    executionRows.value = results ?? []
  } catch (error) {
    pageError.value = message(error)
    return
  }
  // Started a moment ago by the run workflow: follow it until every question has a row that is done, since
  // the walker writes each question's row only as it starts. Any other run is over once nothing is active.
  const startedHere = (window.history.state as { startedRun?: string } | null)?.startedRun === executionId
  if (startedHere || !executionRows.value.length || executionRows.value.some((r) => ACTIVE_STATUSES.includes(r.statusEnumId ?? ''))) {
    followExecution(executionId, startedHere)
  }
}

function onMedia(event: { matches: boolean }) { narrow.value = event.matches }

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 899px)')
  narrow.value = mediaQuery.matches
  mediaQuery.addEventListener('change', onMedia)
  void (async () => {
    // The chart first: whether an execution is over depends on which questions it has.
    await load()
    if (unmounted) return
    void loadExecutions()
    const fromRoute = route.params.reconciliationExecutionId
    if (fromRoute) await loadExecution(String(fromRoute))
  })()
})

watch(() => route.params.reconciliationExecutionId, (id) => {
  if (id && String(id) !== activeExecutionId.value) void loadExecution(String(id))
})

onBeforeUnmount(() => {
  unmounted = true
  stopPolling()
  mediaQuery?.removeEventListener('change', onMedia)
})
</script>
