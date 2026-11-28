import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { GetReconciliationRunStatusResponse, ReconciliationRunStep } from '../lib/api/types'
import { RUN_STAGE_SEQUENCE, formatRunStepDuration, normalizeDisplayText, reconciliationStageLabel, type RunStatusTone } from '../lib/reconciliationDisplay'
import { countLabel } from '../lib/utils/strings'

export interface UseRunStepTimelineDeps {
  runStatus: ComputedRef<GetReconciliationRunStatusResponse | null>
  /** Set while the page shows a run that has no result file yet. */
  liveRunResultId: ComputedRef<string>
  /** The run can still reach later stages: pending rows and the live clock only make sense then. */
  liveRunActive: ComputedRef<boolean>
  file1Label: ComputedRef<string>
  file2Label: ComputedRef<string>
}

export interface UseRunStepTimeline {
  showStepTimeline: ComputedRef<boolean>
  stepTimelineCollapsed: Ref<boolean>
  displayedRunSteps: ComputedRef<ReconciliationRunStep[]>
  /** The stage the run failed at, as the timeline names it; empty when no step failed. */
  failedStepStageLabel: ComputedRef<string>
  stepStatusLabel: (step: ReconciliationRunStep) => string
  stepStatusTone: (step: ReconciliationRunStep) => RunStatusTone
  stepStageLabel: (step: ReconciliationRunStep) => string
  stepDurationLabel: (step: ReconciliationRunStep) => string
  stepRecordsLabel: (step: ReconciliationRunStep) => string
}

const STEP_STATUS_LABELS: Record<string, string> = {
  AUT_STAT_PENDING: 'Pending',
  AUT_STAT_RUNNING: 'Running',
  AUT_STAT_SUCCESS: 'Done',
  AUT_STAT_FAILED: 'Failed',
  AUT_STAT_NO_DATA: 'No data',
  AUT_STAT_CANCELLED: 'Cancelled',
}

/**
 * The run's step timeline (recon observability Phase 4): the recorded steps, plus — while the run is live — a
 * synthesized "Pending" row for each canonical stage it has not reached, so completed / running / remaining read
 * as one list.
 */
export function useRunStepTimeline(deps: UseRunStepTimelineDeps): UseRunStepTimeline {
  const runStatusSteps = computed<ReconciliationRunStep[]>(() => deps.runStatus.value?.steps ?? [])
  const showStepTimeline = computed(() => deps.runStatus.value?.ok === true)
  // Collapsed by default on the saved-result view (a forensic detail there); expanded when the page opens on a
  // live run, where step progress IS the primary content. A run that finishes here folds its steps away.
  const stepTimelineCollapsed = ref(!deps.liveRunResultId.value)
  watch(deps.liveRunResultId, (id, was) => { if (was && !id) stepTimelineCollapsed.value = true })

  // Clock for the running step's elapsed time. A paged API extract is the longest stage of a run and reports no
  // record count until it ends, so without this the timeline sits visually frozen for minutes while the status poll
  // lands on schedule. Ticks only while the run is live; unrelated to the poll interval.
  const liveNowMs = ref(Date.now())
  let liveClockTimer: ReturnType<typeof setInterval> | null = null
  function stopLiveClock(): void {
    if (liveClockTimer == null) return
    clearInterval(liveClockTimer)
    liveClockTimer = null
  }
  watch(deps.liveRunActive, (active) => {
    if (!active) {
      stopLiveClock()
      return
    }
    if (liveClockTimer != null) return
    liveNowMs.value = Date.now()
    liveClockTimer = setInterval(() => {
      liveNowMs.value = Date.now()
    }, 1000)
  }, { immediate: true })
  onBeforeUnmount(stopLiveClock)

  // Pending rows are placed by each stage's position in RUN_STAGE_SEQUENCE, never by comparing that position to the
  // backend's persisted stageSequence number: only the ORDER of the two lists has to agree, so a stage the backend
  // inserts or renumbers cannot drop or misplace a pending row. A stage behind the furthest recorded one (one the
  // run skipped, like RECHECK or CONCLUDE) drops out; an unknown code does not move the frontier.
  const displayedRunSteps = computed<ReconciliationRunStep[]>(() => {
    const actualSteps = runStatusSteps.value
    if (!deps.liveRunActive.value) return actualSteps
    const seenStageCodes = new Set(actualSteps.map((step) => normalizeDisplayText(step.stageCode)))
    const furthestIndex = Math.max(-1, ...[...seenStageCodes].map((code) => RUN_STAGE_SEQUENCE.indexOf(code)))
    const pendingRemainder = RUN_STAGE_SEQUENCE
      .map((stageCode, index) => ({ stageCode, stageSequence: index + 1, statusEnumId: 'AUT_STAT_PENDING' }))
      .filter((step, index) => index > furthestIndex && !seenStageCodes.has(step.stageCode))
    return [...actualSteps, ...pendingRemainder]
  })

  function stepStatusLabel(step: ReconciliationRunStep): string {
    const statusEnumId = normalizeDisplayText(step.statusEnumId)
    return STEP_STATUS_LABELS[statusEnumId] ?? (statusEnumId || 'Unknown')
  }

  // S99-112: a step's tone is its own, not runStatusTone's: a cancelled step warns where a cancelled run is danger, and a
  // pending step is neutral where a pending run warns. Same enum, different readings, so the maps stay apart.
  function stepStatusTone(step: ReconciliationRunStep): RunStatusTone {
    const statusEnumId = normalizeDisplayText(step.statusEnumId)
    if (statusEnumId === 'AUT_STAT_SUCCESS') return 'success'
    if (statusEnumId === 'AUT_STAT_FAILED') return 'danger'
    if (statusEnumId === 'AUT_STAT_RUNNING' || statusEnumId === 'AUT_STAT_CANCELLED') return 'warning'
    return 'neutral'
  }

  function stepStageLabel(step: ReconciliationRunStep): string {
    // metricsJson carries which systems a VERIFY step rechecked -- without it, a run with two verification passes
    // renders two rows reading exactly the same thing.
    return reconciliationStageLabel(step.stageCode, deps.file1Label.value, deps.file2Label.value, step.metricsJson)
  }

  function stepDurationLabel(step: ReconciliationRunStep): string {
    // A running step has no completedDate, so it is timed against the live clock until it lands one.
    if (step.completedDate == null && normalizeDisplayText(step.statusEnumId) === 'AUT_STAT_RUNNING') {
      return formatRunStepDuration(step.startedDate, liveNowMs.value)
    }
    return formatRunStepDuration(step.startedDate, step.completedDate)
  }

  function stepRecordsLabel(step: ReconciliationRunStep): string {
    return step.recordCount != null ? countLabel(step.recordCount, 'record') : ''
  }

  const failedStepStageLabel = computed(() => {
    const failedStep = runStatusSteps.value.find((step) => step.statusEnumId === 'AUT_STAT_FAILED')
    return failedStep ? stepStageLabel(failedStep) : ''
  })

  return {
    showStepTimeline,
    stepTimelineCollapsed,
    displayedRunSteps,
    failedStepStageLabel,
    stepStatusLabel,
    stepStatusTone,
    stepStageLabel,
    stepDurationLabel,
    stepRecordsLabel,
  }
}
