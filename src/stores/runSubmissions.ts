import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { RouteLocationRaw } from 'vue-router'
import type { ReconciliationRunRouteContext } from '../lib/reconciliationRoutes'
import { useMascotStore } from './mascot'

/**
 * DAR-UI-156 (Aditi: "when a run is submitted, the transition from submission to the run detail page is 1-3
 * seconds, when it should be immediate"). Run, Retry and Run now open the Starting page on the click; the
 * submission lives here, so it outlives the page that started it. On prod the run row took ~2 s to exist
 * (2026-11-26, MEPHISTO), and the starting services answer only when the run ends, so two things race:
 * `register` (a look for the row the submission made) and `submit` (the call itself). Whichever answers first
 * says where the Starting page goes: the live run, the finished result, or an error shown on it.
 */

/** Where a submission that settled before its run was found leads: a page, an error to show, or "lost". */
export type RunSubmissionOutcome =
  | { route: RouteLocationRaw }
  | { error: string; details?: string[] }
  /** The request dropped after the run may have started: keep looking for it, and offer no Retry (it could run twice). */
  | { lost: string }

export interface RunSubmissionInput {
  pendingRunId: string
  context: ReconciliationRunRouteContext
  /** Where "Back" goes, and its words: the setup, the failed run, the automation the run came from. */
  backRoute: RouteLocationRaw
  backLabel: string
  /** Sends the run; resolves when the call settles (for a long run, when the run ends). */
  submit: () => Promise<RunSubmissionOutcome>
  /** Looks for the run the submission registered; '' when none showed in time. Ends when the signal aborts. */
  register: (signal: AbortSignal) => Promise<string>
  /** Opens this submission's Starting page again (a refusal nobody saw is raised with it). */
  reopen: () => void
}

export type RunSubmissionState =
  | { phase: 'starting' }
  | { phase: 'live'; runResultId: string }
  | { phase: 'done'; route: RouteLocationRaw }
  | { phase: 'failed'; error: string; details: string[]; retryable: boolean }

export interface RunSubmission {
  input: RunSubmissionInput
  state: RunSubmissionState
  /** Bumped on every start, so a retried submission's late answer cannot overwrite the newer one. */
  attempt: number
}

export const useRunSubmissionsStore = defineStore('runSubmissions', () => {
  const submissions = ref<Record<string, RunSubmission>>({})
  // Every look still going, so a reset can end them (the look outlives the page that started it, on purpose).
  const lookups = new Set<AbortController>()
  // The Starting pages on screen: a refusal with none watching is raised by the mascot instead.
  const watched = new Set<string>()

  function get(pendingRunId: string): RunSubmission | null {
    return submissions.value[pendingRunId] ?? null
  }

  /** A submission of this saved run still starting, so a second press opens it rather than starting another run. */
  function startingFor(savedRunId: string): string | null {
    const found = Object.entries(submissions.value)
      .find(([, entry]) => entry.input.context.savedRunId === savedRunId && entry.state.phase === 'starting')
    return found?.[0] ?? null
  }

  function set(pendingRunId: string, attempt: number, state: RunSubmissionState): void {
    const current = submissions.value[pendingRunId]
    // A later attempt owns the entry; a state already past "starting" is not moved back by the other racer.
    if (!current || current.attempt !== attempt) return
    if (current.state.phase !== 'starting' && state.phase !== 'live') return
    if (current.state.phase === 'live' && state.phase === 'live') return
    submissions.value = { ...submissions.value, [pendingRunId]: { ...current, state } }
    if (watched.has(pendingRunId)) return
    // Nobody is on its Starting page: a run that went on needs nothing more; a refusal is said where it will be seen.
    if (state.phase === 'failed') {
      useMascotStore().raise({
        id: `run-start-${pendingRunId}`,
        title: 'A run did not start',
        prompt: `${current.input.context.runName} did not start.`,
        body: state.error,
        actions: [{ label: 'Open it', testId: 'run-start-open', run: () => current.input.reopen() }],
      })
    } else forget(pendingRunId)
  }

  /** Starts (or, with the same pendingRunId, starts again) a submission; returns at once. */
  function start(input: RunSubmissionInput): void {
    const attempt = (submissions.value[input.pendingRunId]?.attempt ?? 0) + 1
    submissions.value = { ...submissions.value, [input.pendingRunId]: { input, state: { phase: 'starting' }, attempt } }
    // Its Starting page opens next (or is open, for a Retry); it says when it goes.
    watched.add(input.pendingRunId)
    const lookup = new AbortController()
    lookups.add(lookup)
    let lost: string | null = null
    let lookingDone = false
    void input.register(lookup.signal).then((runResultId) => {
      if (runResultId) set(input.pendingRunId, attempt, { phase: 'live', runResultId })
      else if (lost) set(input.pendingRunId, attempt, { phase: 'failed', error: lost, details: [], retryable: false })
    }, () => undefined).finally(() => {
      lookingDone = true
      lookups.delete(lookup)
    })
    const outcome = input.submit().catch((error: unknown): RunSubmissionOutcome => ({
      error: error instanceof Error && error.message ? error.message : 'The run did not start.',
    }))
    void outcome.then((answer) => {
      // Once the run is live its page reports it, including a failure; the answer here only matters before that.
      if (submissions.value[input.pendingRunId]?.state.phase === 'live') return
      if ('lost' in answer) {
        // The run may be going: let the look finish, and only then say it was not found.
        lost = answer.lost
        if (lookingDone) set(input.pendingRunId, attempt, { phase: 'failed', error: answer.lost, details: [], retryable: false })
        return
      }
      lookup.abort()
      if ('route' in answer) set(input.pendingRunId, attempt, { phase: 'done', route: answer.route })
      else set(input.pendingRunId, attempt, { phase: 'failed', error: answer.error, details: answer.details ?? [], retryable: true })
    })
  }

  /** Sends the same submission again (the Starting page's Retry). */
  function retry(pendingRunId: string): void {
    const current = submissions.value[pendingRunId]
    if (current?.state.phase === 'failed' && current.state.retryable) start(current.input)
  }

  /** The Starting page says it is on screen (true) or gone (false). */
  function watch(pendingRunId: string, on: boolean): void {
    if (on) watched.add(pendingRunId)
    else watched.delete(pendingRunId)
  }

  /** Forgets a submission once its Starting page has moved on. */
  function forget(pendingRunId: string): void {
    if (!submissions.value[pendingRunId]) return
    const next = { ...submissions.value }
    delete next[pendingRunId]
    submissions.value = next
  }

  function resetForTests(): void {
    lookups.forEach((lookup) => lookup.abort())
    lookups.clear()
    watched.clear()
    submissions.value = {}
  }

  return { submissions, get, startingFor, start, retry, watch, forget, resetForTests }
})

/** A new id for a submission that records no pending-run marker of its own (Retry, Run now). */
export function newPendingRunId(savedRunId: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${savedRunId}-${suffix}`.replace(/[^A-Za-z0-9._-]/g, '_')
}
