import { reconciliationFacade } from './api/facade'

// How long to keep looking for the submitted run's backend row before giving up and simply
// awaiting the submission. RESOLVE registers the row in its own committed transaction almost
// immediately, and each look is one indexed read (DAR-BE-146), so looking often is cheap.
const RUN_REGISTRATION_POLL_INTERVAL_MS = 250
const RUN_REGISTRATION_POLL_ATTEMPTS = 40

// Ends early on abort, and at once on a signal already aborted (its 'abort' event will not fire again). The listener
// goes when the wait does, so a long poll leaves none behind on the signal. Shared by the run-registration polls (S99-111).
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}

/**
 * Poll for the run a submission just registered and return its run-result id, or '' when
 * none appears in time. Never throws: a failed look just means "not yet", and the caller falls
 * back to awaiting the submission itself. run#SavedRunDiff answers only when its run ends, so
 * this is how Run (and Retry) open the live view of a run that is still going.
 */
export async function pollForRegisteredRunResultId(savedRunId: string, signal: AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < RUN_REGISTRATION_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(RUN_REGISTRATION_POLL_INTERVAL_MS, signal)
    if (signal.aborted) return ''

    try {
      // The server leaves out a run that began before the last two minutes, by its own clock.
      const response = await reconciliationFacade.getActiveRunResult({ savedRunId }, signal)
      if (response.reconciliationRunResultId) return response.reconciliationRunResultId
    } catch {
      // Transient lookup failure — try again on the next tick.
    }
  }
  return ''
}
