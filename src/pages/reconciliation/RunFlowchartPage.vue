<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': Boolean(editing) }">
    <template #hero>
      <h1>{{ run?.reconciliationName || 'Run' }}</h1>
    </template>

    <p v-if="loading" class="section-note">Loading run...</p>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="flowchart-page-error" />

    <template v-if="run">
      <StaticPageSection title="Questions">
        <RunFlowchartBoard
          :questions="questions"
          :rule-names="ruleNames"
          :editable="!running"
          :narrow="narrow"
          :selected-id="editing?.questionId ?? null"
          :states="states"
          @select="openExisting"
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

      <StaticPageSection title="Run Window">
        <label>
          <span>Window</span>
          <AppSelect v-model="windowDays" :options="windowOptions" test-id="flowchart-window-preset" />
        </label>
        <p class="section-note" data-testid="flowchart-window-dates">{{ windowSummary }}</p>
        <p v-if="pollCeilingHit" class="section-note" data-testid="flowchart-poll-ceiling">Still waiting on this run. Check its questions below.</p>
      </StaticPageSection>

      <StaticPageSection v-if="questionRuns.length" title="Question Runs">
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
          :to="{ name: 'reconciliation-run-flowcharts' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to Runs"
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import FlowchartQuestionEditor, { type FlowchartQuestionDraft } from '../../components/reconciliation/FlowchartQuestionEditor.vue'
import RunFlowchartBoard from '../../components/reconciliation/RunFlowchartBoard.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import type { FlowchartBranch, FlowchartExecutionRow, FlowchartQuestion, FlowchartRun } from '../../lib/api/flowchartTypes'
import type { SavedRunSummary } from '../../lib/api/types'
import { walkableQuestionIds } from '../../lib/flowchart/flowchartLayout'
import {
  buildRunPayload, defaultWindowDays, isExecutionDone, POLL_INTERVAL_MS, questionStates, shouldKeepPolling, windowFromDays,
} from '../../lib/flowchart/flowchartRunState'
import { backIconPath, playIconPath, playIconTransform } from '../../lib/iconPaths'
import { buildReconciliationRunLiveRoute } from '../../lib/reconciliationRoutes'
import { addDays } from '../../lib/utils/date'

// DAR-UI-048. One run's chart, on a static board: build it from existing rules (spec A7), run it over a
// look-back window, and follow each question. Editing opens the design system's static-page popup.
const route = useRoute()
const reconciliationId = computed(() => String(route.params.reconciliationId ?? ''))

const run = ref<FlowchartRun | null>(null)
const questions = ref<FlowchartQuestion[]>([])
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
const selectedWindow = computed(() => windowFromDays(Number.parseInt(windowDays.value, 10) || 1))
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
      to: buildReconciliationRunLiveRoute({ savedRunId: q.ruleSetId, runName: labelOf(id), file1SystemLabel: '', file2SystemLabel: '' }, row.reconciliationRunResultId),
    }
  })
})

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
    running.value = true
    const startedAt = Date.now()
    // A timeout chain, not an interval: the next poll is scheduled only after this one answered, so a slow
    // response can never land after a newer one and leave a question stuck on "running" (review I4).
    const poll = async () => {
      if (unmounted) return
      try {
        const { results } = await reconciliationFacade.getReconciliationExecution({ reconciliationExecutionId })
        if (unmounted) return
        executionRows.value = results ?? []
      } catch (error) {
        pageError.value = message(error)
      }
      const done = isExecutionDone(walkable.value, executionRows.value)
      if (!shouldKeepPolling(startedAt, Date.now(), done)) {
        pollTimer = null
        running.value = false
        pollCeilingHit.value = !done
        return
      }
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
    }
    stopPolling()
    pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
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
  void load()
})

onBeforeUnmount(() => {
  unmounted = true
  stopPolling()
  mediaQuery?.removeEventListener('change', onMedia)
})
</script>
