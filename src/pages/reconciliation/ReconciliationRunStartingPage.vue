<template>
  <!-- DAR-UI-156. Where Run, Retry and Run now land on the click, before the run exists on the server (~2 s on prod).
       It reads as the run page does (the name, the steps to come) and moves to the live run, or the result, by itself. -->
  <StaticPageFrame>
    <template #hero>
      <div class="run-starting-hero">
        <StaticEditableTitle :model-value="runName" :editable="false" aria-label="Run name" test-id="run-starting-title" fallback="Selected Run" />
        <p class="static-page-section-description" data-testid="run-starting-state">{{ stateLine }}</p>
      </div>
    </template>

    <StaticPageSection>
      <section class="run-starting-steps" data-testid="run-starting-steps" aria-label="Run steps">
        <span class="micro-label">Run steps</span>
        <ol class="run-starting-steps__list">
          <li v-for="step in steps" :key="step.stageCode" class="action-row">
            <StatusBadge :label="step.label" :tone="step.tone" />
            <span>{{ step.stage }}</span>
          </li>
        </ol>
      </section>

      <template v-if="failed">
        <InlineValidation tone="error" class="run-starting-error" :message="failed.error" data-testid="run-starting-error" />
        <ul v-if="failed.details.length" class="run-starting-details" data-testid="run-starting-details">
          <li v-for="detail in failed.details" :key="detail">{{ detail }}</li>
        </ul>
        <div class="run-starting-actions">
          <button v-if="failed.retryable" type="button" class="btn-primary" data-testid="run-starting-retry" @click="retry">Retry</button>
          <RouterLink v-else :to="historyRoute" class="ghost-link" data-testid="run-starting-history">Run history</RouterLink>
          <RouterLink :to="backRoute" class="ghost-link" data-testid="run-starting-back">{{ backLabel }}</RouterLink>
        </div>
      </template>
      <template v-else-if="missing">
        <p class="section-note" data-testid="run-starting-missing">This run is not running now. It may have finished, or not started.</p>
        <RouterLink :to="historyRoute" class="ghost-link" data-testid="run-starting-history">Run history</RouterLink>
      </template>
      <p v-else class="section-note" data-testid="run-starting-hint">
        You can leave this page and come back later from
        <RouterLink :to="historyRoute" data-testid="run-starting-history">run history</RouterLink>.
      </p>
    </StaticPageSection>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticEditableTitle from '../../components/ui/StaticEditableTitle.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import { RUN_STAGE_SEQUENCE, reconciliationStageLabel } from '../../lib/reconciliationDisplay'
import {
  buildReconciliationDiffRoute,
  buildReconciliationRunHistoryRoute,
  buildReconciliationRunLiveRoute,
  type ReconciliationRunRouteContext,
} from '../../lib/reconciliationRoutes'
import { useRunSubmissionsStore } from '../../stores/runSubmissions'
import { useRunResultsStore } from '../../stores/runResults'

const route = useRoute()
const router = useRouter()
const submissions = useRunSubmissionsStore()
const runResults = useRunResultsStore()

function param(name: string): string {
  const value = route.params[name]
  return typeof value === 'string' ? value.trim() : ''
}
function query(name: string): string {
  const value = route.query[name]
  return typeof value === 'string' ? value.trim() : ''
}

// Read from the route, not once: the router keeps this page when only its params change.
const pendingRunId = computed(() => param('pendingRunId'))
const context = computed<ReconciliationRunRouteContext>(() => ({
  savedRunId: param('savedRunId'),
  runName: query('runName') || 'Selected Run',
  file1SystemLabel: query('file1SystemLabel'),
  file2SystemLabel: query('file2SystemLabel'),
}))
const runName = computed(() => context.value.runName)

const submission = computed(() => submissions.get(pendingRunId.value))
const state = computed(() => submission.value?.state ?? null)
const failed = computed(() => (state.value?.phase === 'failed' ? state.value : null))
// A reload (or a link) with no submission in this tab: one look for the run, then this.
const missing = ref(false)
const backRoute = computed(() => submission.value?.input.backRoute ?? buildReconciliationDiffRoute(context.value))
const backLabel = computed(() => submission.value?.input.backLabel ?? 'Back to setup')
const historyRoute = computed(() => buildReconciliationRunHistoryRoute(context.value))

const stateLine = computed(() => {
  if (failed.value) return 'Did not start.'
  if (missing.value) return 'Not running.'
  return 'Starting…'
})

// The run page's own list of stages, so moving to it changes only the first row's word.
const steps = computed(() => RUN_STAGE_SEQUENCE.map((stageCode, index) => {
  const first = index === 0
  const tone: 'neutral' | 'warning' | 'danger' = first ? (failed.value ? 'danger' : 'warning') : 'neutral'
  const label = first ? (failed.value ? 'Failed' : missing.value ? 'Pending' : 'Starting') : 'Pending'
  return { stageCode, tone, label, stage: reconciliationStageLabel(stageCode, context.value.file1SystemLabel, context.value.file2SystemLabel) }
}))

let left = false
// The store raises a refusal by the mascot only while no Starting page shows it. The id is kept here: by the time
// this page unmounts the route is already the next page's, and this watcher is disposed without running.
let shown = ''
watch(pendingRunId, (next) => {
  if (shown) submissions.watch(shown, false)
  shown = next
  if (next) submissions.watch(next, true)
}, { immediate: true })
onBeforeUnmount(() => {
  left = true
  if (!shown) return
  submissions.watch(shown, false)
  // A submission that went on is done with. One still starting stays, so its refusal reaches the mascot; a refusal
  // stays for a return to this page.
  const phase = submissions.get(shown)?.state.phase
  if (phase === 'live' || phase === 'done') submissions.forget(shown)
})

async function openLive(runResultId: string): Promise<void> {
  const id = pendingRunId.value
  const at = context.value
  // Its first status is read here, while this page still shows, so the live page draws its steps at once.
  await runResults.refreshRunStatus(runResultId).catch(() => undefined)
  if (left || pendingRunId.value !== id) return
  await router.replace(buildReconciliationRunLiveRoute(at, runResultId))
}

watch(state, (next) => {
  if (next?.phase === 'live') void openLive(next.runResultId)
  else if (next?.phase === 'done') void router.replace(next.route)
}, { immediate: true })

async function lookForRun(): Promise<void> {
  missing.value = false
  const { savedRunId } = context.value
  if (submission.value) return
  if (!savedRunId) {
    missing.value = true
    return
  }
  try {
    const response = await reconciliationFacade.getActiveRunResult({ savedRunId })
    if (response.reconciliationRunResultId) {
      await openLive(response.reconciliationRunResultId)
      return
    }
  } catch {
    // Read as not found: the page offers run history either way.
  }
  if (!left) missing.value = true
}
onMounted(() => void lookForRun())
watch(pendingRunId, () => void lookForRun())

function retry(): void {
  submissions.retry(pendingRunId.value)
}
</script>

<style scoped>
.run-starting-hero {
  display: grid;
  gap: var(--space-2);
}

.run-starting-hero h1 {
  margin: 0;
}

.run-starting-steps {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 92%, white);
}

.run-starting-steps__list {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.run-starting-error {
  max-height: 12rem;
  overflow-y: auto;
  white-space: pre-wrap;
}

.run-starting-details {
  margin: 0;
  padding-left: var(--space-4);
  color: var(--text-muted);
  font-size: var(--type-muted-size);
}

.run-starting-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
