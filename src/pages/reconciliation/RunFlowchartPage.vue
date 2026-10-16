<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': Boolean(editing) }">
    <template #hero>
      <h1>{{ run?.reconciliationName || 'Run' }}</h1>
      <RunTypeBadge v-if="run" type="lifecycle" :detail="typeDetail" />
    </template>

    <p v-if="loading" class="section-note">Loading run...</p>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="flowchart-page-error" />

    <template v-if="run">
      <StaticPageSection v-if="isStages" title="Where Records Stopped">
        <LifecycleBoard :board="board" :narrow="narrow" :can-open="canOpenPlace" @open="openPlace" />
      </StaticPageSection>
      <StaticPageSection v-else title="Questions">
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

      <StaticPageSection v-if="historyOptions.length || summary">
        <template #header>
          <div class="static-page-section-header-row">
            <h2 class="static-page-section-heading">Run History</h2>
            <AppSelect v-model="historySelection" :options="historyOptions" placeholder="Choose a run" test-id="flowchart-history-select" />
          </div>
        </template>
        <div v-if="summary" class="static-page-summary-grid">
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Status</span>
            <span data-testid="flowchart-summary-status"><StatusBadge :label="summary.status.label" :tone="summary.status.tone" /></span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Window</span>
            <span data-testid="flowchart-summary-window">{{ summary.window }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Questions</span>
            <span>{{ summary.questions }}</span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Findings</span>
            <span data-testid="flowchart-summary-findings">{{ summary.findings }}</span>
          </article>
        </div>
      </StaticPageSection>

      <StaticPageSection title="Run Window">
        <label>
          <span>Window</span>
          <AppSelect v-model="windowDays" :options="windowOptions" test-id="flowchart-window-preset" />
        </label>
        <p class="section-note" data-testid="flowchart-window-dates">{{ windowSummary }}</p>
        <p v-if="lateAfterDays" class="section-note" data-testid="flowchart-window-late">Not judged yet: the last {{ lateAfterDays === 1 ? 'day' : `${lateAfterDays} days` }}</p>
        <p v-if="pollCeilingHit" class="section-note" data-testid="flowchart-poll-ceiling">Still waiting on this run. Check its questions below.</p>
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
    </template>


    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'hub' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to Home"
          data-testid="flowchart-back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
        <button
          type="button"
          class="app-icon-action app-icon-action--large"
          aria-label="Run chart"
          title="Run chart"
          :disabled="running || starting || !questions.length"
          data-testid="flowchart-run-button"
          @click="startRun"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
          </svg>
        </button>
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
import AppSelect from '../../components/ui/AppSelect.vue'
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
  buildRunPayload, defaultWindowDays, isExecutionDone, POLL_INTERVAL_MS, questionStates, shouldKeepPolling, windowFromDays,
} from '../../lib/flowchart/flowchartRunState'
import { backIconPath, playIconPath, playIconTransform } from '../../lib/iconPaths'
import { buildReconciliationRunLiveRoute, buildReconciliationRunResultRoute } from '../../lib/reconciliationRoutes'
import { lifecycleBoard, type LifecyclePlace } from '../../lib/lifecycleBoard'
import { lookBackLabel, questionCountLabel } from '../../lib/runTypes'
import { addDays, displayCalendarDayOf, formatDateTime, todayInDisplayTimeZone } from '../../lib/utils/date'

// DAR-UI-048. One run's chart, on a static board: build it from existing rules (spec A7), run it over a
// look-back window, and follow each question. Editing opens the design system's static-page popup.
const route = useRoute()
const router = useRouter()
const reconciliationId = computed(() => String(route.params.reconciliationId ?? ''))

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
const windowDays = ref('1')
const executionRows = ref<FlowchartExecutionRow[]>([])
const running = ref(false)
// Set before the Run request goes out, so a double click cannot start a second walk (review I4).
const starting = ref(false)
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
const windowOptions = computed(() => {
  const days = [...new Set([defaultWindowDays(run.value?.defaultTimeWindow), 1, 7, 30])].sort((a, b) => a - b)
  return days.map((d) => ({ value: String(d), label: d === 1 ? 'Previous day' : `Last ${d} days` }))
})
// DAR-UI-050. A lifecycle built from stages judges only records old enough to have finished: its window
// ends lateAfterDays before today.
const isStages = computed(() => run.value?.buildMode === 'STAGES')
const lateAfterDays = computed(() => (isStages.value ? Number(run.value?.lateAfterDays ?? 0) : 0))
const selectedWindow = computed(() => windowFromDays(Number.parseInt(windowDays.value, 10) || 1,
  addDays(todayInDisplayTimeZone(), -lateAfterDays.value)))
const board = computed(() => lifecycleBoard(questions.value, executionRows.value))
// The window's end is exclusive; the note names the last day it covers (review I3).
const windowSummary = computed(() =>
  `${dateFormat.format(selectedWindow.value.startDate)} – ${dateFormat.format(addDays(selectedWindow.value.endExclusiveDate, -1))}`)

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
      to: resultRouteFor(id) ?? buildReconciliationRunLiveRoute(routeContextFor(q, id), row.reconciliationRunResultId),
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
  return buildReconciliationRunResultRoute(routeContextFor(q, id), path)
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

const historyOptions = computed(() => executions.value.map((e) => ({
  value: e.reconciliationExecutionId,
  label: `${formatDateTime(e.startedDate, { locale: 'en-US' })} · ${rollupWord([e.statusEnumId])}`,
})))

const historySelection = computed({
  get: () => activeExecutionId.value ?? '',
  set: (id: string) => {
    if (id && id !== activeExecutionId.value) {
      void router.push({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value, reconciliationExecutionId: id } })
    }
  },
})

const summary = computed(() => {
  if (!activeExecutionId.value || !states.value) return null
  const word = running.value ? 'Running' : rollupWord(executionRows.value.map((r) => r.statusEnumId))
  const listed = executions.value.find((e) => e.reconciliationExecutionId === activeExecutionId.value)
  const starts = new Set(questions.value.filter((q) => q.questionRole === 'START').map((q) => q.reconciliationRunId))
  // A lifecycle's findings are its places' records (each record is in one); a chart's are its "no" counts.
  const findings = isStages.value
    ? board.value.stages.flatMap((st) => st.places).reduce((sum, p) => sum + (p.count ?? 0), 0)
    : executionRows.value
      .filter((r) => !starts.has(r.reconciliationRunId ?? ''))
      .reduce((sum, r) => sum + (r.noCount ?? 0), 0)
  return {
    status: { label: word, tone: STATUS_TONES[word] ?? 'neutral' },
    window: listed ? windowText(listed.windowStartDate, listed.windowEndDate) : startedWindowText.value ?? '-',
    questions: countFormat.format(walkable.value.filter((id) => !starts.has(id)).length),
    findings: countFormat.format(findings),
  }
})
// The window of a run started on this page, until the executions list has caught up with it.
const startedWindowText = ref<string | null>(null)

function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }

async function load() {
  pageError.value = null
  try {
    const [got, saved] = await Promise.all([
      reconciliationFacade.getReconciliation({ reconciliationId: reconciliationId.value }),
      rules.value.length ? Promise.resolve(null) : reconciliationFacade.listSavedRuns({ pageIndex: 0, pageSize: 200 }),
    ])
    const firstLoad = !run.value
    run.value = got.reconciliation
    questions.value = got.questions ?? []
    if (saved) rules.value = saved.savedRuns ?? []
    if (firstLoad) windowDays.value = String(defaultWindowDays(run.value?.defaultTimeWindow))
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
  if (!executionRows.value.length || executionRows.value.some((r) => ACTIVE_STATUSES.includes(r.statusEnumId ?? ''))) {
    followExecution(executionId, false)
  }
}

async function startRun() {
  if (running.value || starting.value) return
  pageError.value = null
  pollCeilingHit.value = false
  executionRows.value = []
  starting.value = true
  try {
    const { reconciliationExecutionId } = await reconciliationFacade.runReconciliation(
      buildRunPayload(reconciliationId.value, selectedWindow.value))
    if (unmounted) return
    // Set before the address moves, so the route watch sees this execution as already on screen.
    activeExecutionId.value = reconciliationExecutionId
    startedWindowText.value = windowSummary.value
    void router.replace({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value, reconciliationExecutionId } })
    followExecution(reconciliationExecutionId, true)
    void loadExecutions()
  } catch (error) {
    pageError.value = message(error)
  } finally {
    starting.value = false
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
