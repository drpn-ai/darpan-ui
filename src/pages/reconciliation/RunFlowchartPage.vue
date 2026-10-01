<template>
  <StaticPageFrame>
    <template #hero>
      <h1>{{ run?.reconciliationName || 'Run' }}</h1>
    </template>

    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="flowchart-page-error" />

    <div class="flowchart-run-bar">
      <input v-model="windowStart" type="date" data-testid="flowchart-window-start" aria-label="From" />
      <input v-model="windowEnd" type="date" data-testid="flowchart-window-end" aria-label="To" />
      <button v-if="!hasStart && !running" type="button" class="wizard-back" data-testid="flowchart-add-top" @click="openNew(null, null)">Add question</button>
      <button type="button" class="wizard-next" :disabled="running || !questions.length" data-testid="flowchart-run-button" @click="startRun">Run</button>
      <span v-if="pollCeilingHit" data-testid="flowchart-poll-ceiling">Still waiting on this run. Check its questions below.</span>
    </div>

    <div class="flowchart-page-body">
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
      <FlowchartQuestionEditor
        v-if="editing"
        :rules="rules"
        :draft="editing.draft"
        :heading="editing.heading"
        :can-delete="Boolean(editing.questionId)"
        :error="editorError"
        :busy="saving"
        @save="saveEditing"
        @delete="deleteEditing"
        @cancel="closeEditor"
      />
    </div>

    <ul v-if="liveLinks.length" class="flowchart-live-links">
      <li v-for="link in liveLinks" :key="link.questionId">
        <RouterLink :to="link.to" :data-testid="`flowchart-live-link-${link.questionId}`">{{ link.label }}</RouterLink>
      </li>
    </ul>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import RunFlowchartBoard from '../../components/reconciliation/RunFlowchartBoard.vue'
import FlowchartQuestionEditor, { type FlowchartQuestionDraft } from '../../components/reconciliation/FlowchartQuestionEditor.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import type { FlowchartBranch, FlowchartExecutionRow, FlowchartQuestion, FlowchartRun } from '../../lib/api/flowchartTypes'
import type { SavedRunSummary } from '../../lib/api/types'
import { walkableQuestionIds } from '../../lib/flowchart/flowchartLayout'
import {
  buildRunPayload, defaultWindowDays, isExecutionDone, POLL_INTERVAL_MS, questionStates, shouldKeepPolling, windowFromDays,
} from '../../lib/flowchart/flowchartRunState'
import { buildReconciliationRunLiveRoute } from '../../lib/reconciliationRoutes'
import { formatDateInputValue, parseDateInput } from '../../lib/utils/date'

// DAR-UI-048. One run's chart: build it from existing rules (spec A7), run it, watch each question.
const route = useRoute()
const reconciliationId = computed(() => String(route.params.reconciliationId ?? ''))

const run = ref<FlowchartRun | null>(null)
const questions = ref<FlowchartQuestion[]>([])
const rules = ref<SavedRunSummary[]>([])
const pageError = ref<string | null>(null)
const editorError = ref<string | null>(null)
const saving = ref(false)
const narrow = ref(false)
const windowStart = ref('')
const windowEnd = ref('')
const executionRows = ref<FlowchartExecutionRow[]>([])
const running = ref(false)
const pollCeilingHit = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let mediaQuery: MediaQueryList | null = null

interface Editing { questionId: string | null; parentId: string | null; branch: FlowchartBranch | null; heading: string; draft: FlowchartQuestionDraft }
const editing = ref<Editing | null>(null)

const ruleNames = computed(() => Object.fromEntries(rules.value.map((r) => [r.savedRunId, r.runName || r.savedRunId])))
const walkable = computed(() => walkableQuestionIds(questions.value))
const hasStart = computed(() => questions.value.some((q) => q.questionRole === 'START'))
const states = computed(() => (executionRows.value.length || running.value ? questionStates(walkable.value, executionRows.value) : undefined))

function labelOf(id: string): string {
  const q = questions.value.find((x) => x.reconciliationRunId === id)
  return q?.runName?.trim() || ruleNames.value[q?.ruleSetId ?? ''] || id
}

const liveLinks = computed(() => {
  const s = states.value
  if (!s) return []
  return walkable.value.filter((id) => s[id]?.state === 'running' && s[id]?.row).map((id) => {
    const q = questions.value.find((x) => x.reconciliationRunId === id)!
    return { questionId: id, label: `${labelOf(id)}: live`, to: buildReconciliationRunLiveRoute({ savedRunId: q.ruleSetId, runName: labelOf(id), file1SystemLabel: '', file2SystemLabel: '' }, s[id]!.row!.reconciliationRunResultId) }
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
    run.value = got.reconciliation
    questions.value = got.questions ?? []
    if (saved) rules.value = saved.savedRuns ?? []
    if (!windowStart.value) {
      const w = windowFromDays(defaultWindowDays(run.value?.defaultTimeWindow))
      windowStart.value = formatDateInputValue(w.startDate)
      windowEnd.value = formatDateInputValue(w.endExclusiveDate)
    }
  } catch (error) {
    pageError.value = message(error)
  }
}

function openExisting(id: string) {
  const q = questions.value.find((x) => x.reconciliationRunId === id)
  if (!q) return
  editorError.value = null
  editing.value = { questionId: id, parentId: q.parentReconciliationRunId ?? null, branch: q.parentBranch ?? null, heading: labelOf(id),
    draft: { ruleSetId: q.ruleSetId, runName: q.runName ?? '', noOutcomeLabel: q.noOutcomeLabel ?? '' } }
}

function openNew(parentId: string | null, branch: FlowchartBranch | null) {
  editorError.value = null
  const heading = parentId ? `${branch === 'YES' ? 'After yes on' : 'After no on'}: ${labelOf(parentId)}` : 'New question'
  editing.value = { questionId: null, parentId, branch, heading, draft: { ruleSetId: '', runName: '', noOutcomeLabel: '' } }
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

function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

async function startRun() {
  const start = parseDateInput(windowStart.value)
  const end = parseDateInput(windowEnd.value)
  if (!start || !end) { pageError.value = 'Choose a window.'; return }
  pageError.value = null
  pollCeilingHit.value = false
  executionRows.value = []
  try {
    const { reconciliationExecutionId } = await reconciliationFacade.runReconciliation(
      buildRunPayload(reconciliationId.value, { startDate: start, endExclusiveDate: end }))
    running.value = true
    const startedAt = Date.now()
    stopPolling()
    pollTimer = setInterval(async () => {
      try {
        const { results } = await reconciliationFacade.getReconciliationExecution({ reconciliationExecutionId })
        executionRows.value = results ?? []
      } catch (error) {
        pageError.value = message(error)
      }
      const done = isExecutionDone(walkable.value, executionRows.value)
      if (!shouldKeepPolling(startedAt, Date.now(), done)) {
        stopPolling()
        running.value = false
        pollCeilingHit.value = !done
      }
    }, POLL_INTERVAL_MS)
  } catch (error) {
    pageError.value = message(error)
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
  stopPolling()
  mediaQuery?.removeEventListener('change', onMedia)
})
</script>

<style scoped>
.flowchart-run-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); }
.flowchart-page-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
@media (min-width: 1200px) {
  .flowchart-page-body:has(.flowchart-editor) { grid-template-columns: minmax(0, 1fr) 20rem; }
}
.flowchart-live-links { display: flex; flex-wrap: wrap; gap: var(--space-3); padding: 0; list-style: none; }
</style>
